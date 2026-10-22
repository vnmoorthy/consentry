// Renders the README banner and architecture diagram from HTML: `pnpm tsx scripts/render-assets.ts`
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const [src, out, w, h] of [
  ['assets/src/banner.html', 'assets/banner.png', 1280, 640],
  ['assets/src/architecture.html', 'assets/architecture.png', 1600, 980],
] as const) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await page.goto('file://' + resolve(src));
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out });
  await page.close();
  console.log('rendered', out);
}
await browser.close();
