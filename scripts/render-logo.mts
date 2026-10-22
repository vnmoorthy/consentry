import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const svg = readFileSync(process.argv[2], 'utf8');
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', '<svg width="512" height="512" ')}</body></html>`);
await p.screenshot({ path: process.argv[3], omitBackground: true });
await b.close();
