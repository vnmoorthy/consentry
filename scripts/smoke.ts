// End-to-end smoke test against the live public APIs: `pnpm tsx scripts/smoke.ts`
import { ConsentryRuntime, MemoryStore, REDTEAM } from '../packages/core/src';

const rt = await ConsentryRuntime.create({ store: new MemoryStore(), mode: 'local' });
rt.on((e) => {
  if (e.type === 'consent.request' && !e.request.agentName?.includes('Red-team')) {
    console.log(`   ⏸ consent: ${e.request.items.map((i) => i.itemLabel).join(', ')} → ${e.request.recipientName} — auto allow_once`);
    setTimeout(() => rt.resolveConsent(e.request.id, 'allow_once'), 50);
  }
  if (e.type === 'firewall.egress') {
    const d = e.result.decisions.map((x) => `${x.itemLabel}:${x.action}${x.action === 'minimized' ? `(${x.after})` : ''}`).join(', ');
    console.log(`   ⇢ ${e.tool} → ${e.recipientId} [${e.result.verdict}] ${d}${e.result.blockedReason ? ' — ' + e.result.blockedReason : ''}`);
  }
  if (e.type === 'firewall.ingress') console.log(`   ☣ ingress ${e.tool}: ${e.result.threats.map((t) => `${t.kind} ${t.score}`).join(', ')}`);
  if (e.type === 'tool.result') console.log(`   ✓ ${e.tool} ${e.ok ? 'ok' : 'FAIL'} ${e.ms}ms — ${e.summary}`);
});

const prompts = [
  'Is Saturday good for a hike in Yosemite with my asthma?',
  'Do a safety sweep: has anything I own or take been recalled?',
  'Book a vegetarian dinner for 2 tonight at 7:30',
  'Get me a ride home from Verdant Kitchen at 9:30 PM',
  'Refill my inhaler',
  'Any earthquakes near me this month?',
  'What have you shared about me?',
];
let failures = 0;
for (const p of prompts) {
  console.log(`\n▶ ${p}`);
  const t = Date.now();
  const out = await rt.chat(p);
  console.log(`   ⏱ ${Date.now() - t}ms\n` + out.split('\n').map((l) => '   │ ' + l).join('\n'));
  if (/went wrong|couldn't|unreachable|unavailable/i.test(out)) failures++;
}
for (const s of REDTEAM) {
  console.log(`\n☠ RED TEAM: ${s.title}`);
  const r = await rt.runRedTeam(s.id);
  console.log(`   ${r.contained ? '✅ CONTAINED' : '❌ LEAKED'} — ${r.headline}`);
  for (const l of r.layers) console.log(`   · ${l.name}: ${l.result} — ${l.detail}`);
  if (!r.contained) failures++;
}
const v = await rt.verifyLedger();
console.log(`\nLedger: ${rt.ledger.entries.length} entries, verify=${v.ok}, head=${v.head?.slice(0, 16)}… · privacy score ${rt.privacyScore()} · stats ${JSON.stringify(rt.state.stats)}`);
console.log(failures ? `\n❌ ${failures} failure(s)` : '\n✅ all scenarios passed');
process.exit(failures ? 1 : 0);
