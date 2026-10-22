// Latency benchmark of Claude models on real demo scenarios: `pnpm tsx scripts/model-bench.ts`
import { existsSync, readFileSync } from 'node:fs';
import { ConsentryRuntime, MemoryStore } from '../packages/core/src';

for (const line of existsSync('.env') ? readFileSync('.env', 'utf8').split('\n') : []) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const KEY = process.env.ANTHROPIC_API_KEY!;
const MODELS = (process.argv[2] ?? 'claude-opus-5-5,claude-sonnet-5-5,claude-haiku-5-5').split(',');
const PROMPTS = ['Is Saturday good for a hike in Yosemite with my asthma?', 'Book a vegetarian dinner for 2 tonight at 7:30', 'Do a safety sweep: has anything I own or take been recalled?'];
console.log('model'.padEnd(20), PROMPTS.map((p) => p.slice(0, 22).padEnd(24)).join(''), 'avg');
for (const model of MODELS) {
  const rt = await ConsentryRuntime.create({ store: new MemoryStore(), mode: 'local', envApiKey: KEY, envModel: model, envEffort: 'low' });
  rt.on((e) => {
    if (e.type === 'consent.request') setTimeout(() => rt.resolveConsent(e.request.id, e.request.items.some((i) => i.category === 'health.medication') ? 'allow_always' : 'minimize'), 50);
  });
  const cells: string[] = [];
  let sum = 0;
  for (const p of PROMPTS) {
    const t = Date.now();
    const out = await rt.chat(p);
    const s = (Date.now() - t) / 1000;
    sum += s;
    const fell = /Autopilot/.test(JSON.stringify(rt.recentEvents.slice(-30).filter((e: any) => e.type === 'agent.step')));
    cells.push(`${s.toFixed(1)}s/${out.length}c${fell ? ' FB' : ''}`.padEnd(24));
  }
  console.log(model.padEnd(20), cells.join(''), (sum / PROMPTS.length).toFixed(1) + 's');
}
