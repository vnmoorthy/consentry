// Re-shoot just the expanded tour panel: `pnpm tsx scripts/capture-tour.mts`
import { chromium } from 'playwright-core';
const BASE = process.env.CONSENTRY_URL ?? 'http://localhost:8787';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1512, height: 945 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { localStorage.setItem('consentry:welcomed:v1', '1'); localStorage.setItem('consentry:tour:v1:compact', '0'); localStorage.setItem('consentry:tour:v1', '2'); });
const p = await ctx.newPage();
await p.goto(`${BASE}/#/`);
await p.waitForTimeout(1500);
await p.getByRole('button', { name: /Demo tour/ }).click();
await p.waitForTimeout(1000);
await p.screenshot({ path: 'assets/screenshots/tour.png' });
await b.close();
