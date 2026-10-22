// End-to-end check of Claude mode: `pnpm tsx scripts/claude-check.ts`
// Runs real scenarios with Claude as the agent brain, auto-answers consent prompts, and intercepts every
// request to api.anthropic.com to prove none of the user's raw vault values ever reached the model.
import { existsSync, readFileSync } from 'node:fs';
import { ConsentryRuntime, MemoryStore, seedVault, type RuntimeEvent } from '../packages/core/src';

for (const line of existsSync('.env') ? readFileSync('.env', 'utf8').split('\n') : []) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) {
  console.error('No ANTHROPIC_API_KEY in .env or the environment.');
  process.exit(2);
}

// Raw values that must never appear in anything sent to Claude (policy allows health conditions/meds/allergy).
const vault = seedVault();
const raw = (key: string) => vault.find((v) => v.key === key)!.value;
const FORBIDDEN: [string, string][] = [
  ['full name', raw('full_name')],
  ['email', raw('email')],
  ['phone', '555-0142'],
  ['home address', '88 Larkspur'],
  ['home GPS', '37.7612'],
  ['date of birth', raw('date_of_birth')],
  ['SSN', raw('ssn')],
  ['card', '4242 4242'],
  ['card (digits)', '4242424242424242'],
  ['anxiety medication', 'Sertraline'],
  ['mental-health condition', 'anxiety'],
  ['employer', 'Lumen Health'],
  ['VIN', raw('car_vin')],
];

const leaks: string[] = [];
let llmRequests = 0;
let llmMs = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === 'string' ? input : input?.url ?? String(input);
  if (url.includes('api.anthropic.com')) {
    llmRequests++;
    const body = typeof init?.body === 'string' ? init.body : '';
    for (const [label, value] of FORBIDDEN) if (body.toLowerCase().includes(value.toLowerCase())) leaks.push(`${label} in request #${llmRequests}`);
    const t = Date.now();
    const res = await realFetch(input, init);
    llmMs += Date.now() - t;
    return res;
  }
  return realFetch(input, init);
}) as typeof fetch;

const rt = await ConsentryRuntime.create({ store: new MemoryStore(), mode: 'local', envApiKey: KEY, envModel: process.env.CONSENTRY_MODEL || undefined, envEffort: (process.env.CONSENTRY_EFFORT as any) || undefined });
console.log(`Agent brain: ${rt.settings.agentMode} · model ${rt.settings.model} · effort ${rt.settings.effort}\n`);

rt.on((e: RuntimeEvent) => {
  if (e.type === 'consent.request') {
    const health = e.request.items.some((i) => i.category.startsWith('health.medication'));
    const d = health ? 'allow_once' : 'minimize';
    console.log(`   ✋ consent: ${e.request.items.map((i) => i.itemLabel).join(', ')} → ${e.request.recipientName} — auto ${d}`);
    setTimeout(() => rt.resolveConsent(e.request.id, d), 80);
  }
  if (e.type === 'llm.egress' && e.decisions.length) console.log(`   ✳️ prompt to Claude: "${e.sanitized}"`);
  if (e.type === 'agent.step') console.log(`   · ${e.text}`);
  if (e.type === 'firewall.egress') {
    const d = e.result.decisions.map((x) => `${x.itemLabel}:${x.action}${x.action === 'minimized' ? `(${x.after})` : ''}`).join(', ');
    console.log(`   ⇢ ${e.tool} → ${e.recipientId} [${e.result.verdict}] ${d}${e.result.blockedReason ? ' — ' + e.result.blockedReason : ''}`);
  }
  if (e.type === 'firewall.ingress') console.log(`   ☣ quarantined from ${e.tool}: ${e.result.threats.map((t) => `${t.kind} ${t.score}`).join(', ')}`);
});

const scenarios: { prompt: string; opts?: any; expect?: (out: string) => string | null }[] = [
  { prompt: 'Is Saturday good for a hike in Yosemite with my asthma?' },
  { prompt: 'Do a safety sweep: has anything I own or take been recalled?' },
  { prompt: 'Book a vegetarian dinner for 2 tonight at 7:30' },
  { prompt: 'My SSN is 078-05-1120 and my card is 4242 4242 4242 4242. Is the air OK at home today?' },
  { prompt: 'Find me a good Indian restaurant nearby and book it for 2 at 8pm', opts: { scenario: { poisonReviews: true } } },
];

let failures = 0;
for (const s of scenarios) {
  console.log(`▶ ${s.prompt}${s.opts?.scenario ? '   [poisoned reviews ON]' : ''}`);
  const t = Date.now();
  const before = llmRequests;
  const out = await rt.chat(s.prompt, s.opts);
  const fell = /falling back to on-device Autopilot/.test(JSON.stringify(rt.recentEvents.slice(-40)));
  console.log(`   ⏱ ${((Date.now() - t) / 1000).toFixed(1)}s · ${llmRequests - before} Claude request(s)${fell ? ' · FELL BACK TO AUTOPILOT' : ''}`);
  console.log(out.split('\n').slice(0, 14).map((l) => '   │ ' + l).join('\n') + '\n');
  if (fell || /went wrong/i.test(out)) failures++;
}

const v = await rt.verifyLedger();
console.log(`Claude requests: ${llmRequests} · avg ${(llmMs / Math.max(1, llmRequests) / 1000).toFixed(1)}s each · ledger ${rt.ledger.entries.length} entries, verify=${v.ok}`);
console.log(leaks.length ? `❌ RAW DATA SENT TO CLAUDE: ${[...new Set(leaks)].join('; ')}` : '✅ No raw vault values were ever sent to Claude');
console.log(failures ? `❌ ${failures} scenario(s) failed or fell back` : '✅ All Claude-mode scenarios completed');
process.exit(leaks.length || failures ? 1 : 0);
