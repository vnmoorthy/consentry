// Screenshot every route for visual QA: `pnpm tsx scripts/qa-pages.mts <outdir>`
import { chromium } from 'playwright-core';
const out = process.argv[2] ?? 'qa';
const BASE = process.env.CONSENTRY_URL ?? 'http://localhost:8787';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1512, height: 945 } });
await ctx.addInitScript(() => { localStorage.setItem('consentry:welcomed:v1', '1'); localStorage.setItem('consentry:tour:v1:compact', '1'); });
const p = await ctx.newPage();
for (const r of ['', 'footprint', 'vault', 'policies', 'ledger', 'connections', 'redteam', 'settings']) {
  await p.goto(`${BASE}/#/${r}`);
  await p.waitForTimeout(r === 'connections' ? 3500 : 1600);
  await p.screenshot({ path: `${out}/${r || 'command'}.png` });
}
await b.close();
