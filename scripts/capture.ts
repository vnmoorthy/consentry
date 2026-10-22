// Drives the real app with Chrome and captures README screenshots + demo frames (→ GIF/MP4 via ffmpeg).
// Usage: start the gateway (`pnpm start`), then `pnpm tsx scripts/capture.ts`
import { chromium, type Page } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.CONSENTRY_URL ?? 'http://localhost:8787';
const OUT = 'assets/screenshots';
const VIDEO = 'assets/video';
mkdirSync(OUT, { recursive: true });
mkdirSync(VIDEO, { recursive: true });

const api = (path: string, body?: unknown, method = 'POST') => fetch(`${BASE}${path}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
const reset = () => api('/api/reset');
const brain = (agentMode: 'autopilot' | 'claude') => api('/api/settings', { agentMode }, 'PUT');
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hasClaude = async () => ((await (await fetch(`${BASE}/api/state`)).json()).settings.hasApiKey as boolean);

async function chip(page: Page, prompt: string) {
  await page.locator(`button[title^="${prompt}"]`).first().click();
}
async function waitIdle(page: Page) {
  await page.waitForFunction(() => document.querySelector('textarea')?.getAttribute('placeholder')?.startsWith('Ask'), null, { timeout: 120000 });
}

const claudeAvailable = await hasClaude();
const browser = await chromium.launch({ channel: 'chrome', headless: true });

// ── Screenshots ─────────────────────────────────────────────────────────────
{
  await reset();
  await brain('autopilot');
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 945 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => localStorage.setItem('consentry:tour:v1:compact', '1'));
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.getByText('The consent firewall for AI agents').first().waitFor();
  await wait(3200);
  await page.screenshot({ path: `${OUT}/welcome.png` });
  await page.getByRole('button', { name: /Explore on my own/ }).click();
  await wait(900);
  await page.screenshot({ path: `${OUT}/gallery.png` });

  await chip(page, 'Is Saturday good for a hike');
  await waitIdle(page);
  await wait(1500);

  await chip(page, 'Book a vegetarian dinner');
  await page.getByText('Consent required').waitFor({ timeout: 30000 });
  await wait(700);
  await page.screenshot({ path: `${OUT}/consent.png` });
  await page.getByRole('button', { name: /Share minimized version/ }).click();
  await wait(700);
  await page.screenshot({ path: `${OUT}/command-live.png` });
  await waitIdle(page);
  await wait(2200);
  await page.screenshot({ path: `${OUT}/command.png` });

  await page.getByRole('button', { name: 'Privacy receipt' }).last().click();
  await wait(1400);
  await page.screenshot({ path: `${OUT}/receipt.png` });
  await page.keyboard.press('Escape');
  await wait(500);

  await chip(page, 'Do a safety sweep');
  await page.getByText('Consent required').waitFor({ timeout: 30000 });
  await page.keyboard.press('3');
  await waitIdle(page);
  await wait(800);

  await page.goto(`${BASE}/#/footprint`);
  await wait(1500);
  await page.screenshot({ path: `${OUT}/footprint.png` });
  await page.getByRole('button', { name: /TableTap/ }).first().click();
  await wait(700);
  await page.getByRole('button', { name: /Request deletion/ }).click();
  await wait(1000);
  await page.getByRole('button', { name: /Send request/ }).click();
  await page.getByText(/confirmed deletion/).waitFor({ timeout: 10000 });
  await wait(600);
  await page.screenshot({ path: `${OUT}/deletion.png` });
  await page.keyboard.press('Escape');

  await page.goto(`${BASE}/#/redteam`);
  await page.getByRole('button', { name: /Run all/ }).click();
  await page.getByText('Tampering detected').waitFor({ timeout: 120000 });
  await wait(1200);
  await page.screenshot({ path: `${OUT}/redteam.png` });

  await page.goto(`${BASE}/#/ledger`);
  await wait(1200);
  await page.getByRole('button', { name: /Tamper/ }).click();
  await wait(800);
  await page.getByRole('button', { name: /Verify chain/ }).click();
  await page.getByText(/broken at #/).first().waitFor({ timeout: 20000 });
  await wait(800);
  await page.screenshot({ path: `${OUT}/ledger.png` });
  await page.getByRole('button', { name: /Re-seal/ }).click();
  await wait(800);

  await page.goto(`${BASE}/#/policies`);
  await wait(600);
  await page.getByPlaceholder(/Never share my health data/).fill('Never let the AI see my medications');
  await page.getByRole('button', { name: /Compile/ }).click();
  await wait(1000);
  await page.screenshot({ path: `${OUT}/policies.png` });

  await page.goto(`${BASE}/#/vault`);
  await wait(1000);
  await page.screenshot({ path: `${OUT}/vault.png` });

  await page.goto(`${BASE}/#/connections`);
  await wait(3500);
  await page.screenshot({ path: `${OUT}/connections.png` });

  // The guided tour, expanded.
  await page.evaluate(() => localStorage.setItem('consentry:tour:v1:compact', '0'));
  await page.goto(`${BASE}/#/`);
  await page.reload();
  await wait(1200);
  await page.getByRole('button', { name: /Demo tour/ }).click();
  await wait(900);
  await page.screenshot({ path: `${OUT}/tour.png` });

  if (claudeAvailable) {
    await brain('claude');
    await page.evaluate(() => localStorage.setItem('consentry:tour:v1:compact', '1'));
    await page.reload();
    await wait(1200);
    await page.locator('textarea').fill('My SSN is 078-05-1120 and my card is 4242 4242 4242 4242. Is the air OK at home today?');
    await page.keyboard.press('Enter');
    await waitIdle(page);
    await wait(1200);
    await page.getByRole('button', { name: /What Claude saw/ }).last().click();
    await wait(900);
    await page.screenshot({ path: `${OUT}/claude.png` });
  }
  await ctx.close();
}

// ── Demo recording: CDP screencast frames → GIF/MP4 via system ffmpeg ─────────
{
  await reset();
  await brain('autopilot');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    localStorage.setItem('consentry:welcomed:v1', '1');
    localStorage.setItem('consentry:tour:v1:compact', '1');
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const frames: { file: string; ts: number }[] = [];
  let n = 0;
  cdp.on('Page.screencastFrame', async (f: any) => {
    const file = `${VIDEO}/f${String(n++).padStart(5, '0')}.jpg`;
    writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, ts: f.metadata.timestamp });
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await page.goto(BASE);
  await wait(1200);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 82, maxWidth: 1440, maxHeight: 900, everyNthFrame: 1 });
  await wait(1500);
  await chip(page, 'Book a vegetarian dinner');
  await page.getByText('Consent required').waitFor({ timeout: 30000 });
  await wait(2200);
  await page.getByRole('button', { name: /Share minimized version/ }).click();
  await waitIdle(page);
  await wait(2600);
  await chip(page, 'Do a safety sweep');
  await page.getByText('Consent required').waitFor({ timeout: 30000 });
  await wait(1800);
  await page.keyboard.press('3');
  await waitIdle(page);
  await wait(2600);
  await page.getByRole('button', { name: 'Privacy receipt' }).last().click();
  await wait(2600);
  await page.keyboard.press('Escape');
  await wait(400);
  await page.goto(`${BASE}/#/footprint`);
  await wait(2800);
  await cdp.send('Page.stopScreencast');
  await ctx.close();
  const lines: string[] = [];
  for (let i = 0; i < frames.length; i++) {
    const d = i < frames.length - 1 ? Math.max(0.02, frames[i + 1].ts - frames[i].ts) : 1.5;
    lines.push(`file '${frames[i].file.split('/').pop()}'`, `duration ${d.toFixed(3)}`);
  }
  lines.push(`file '${frames[frames.length - 1].file.split('/').pop()}'`);
  writeFileSync(`${VIDEO}/frames.txt`, lines.join('\n'));
  console.log(`captured ${frames.length} frames`);
}

await browser.close();
await reset();
if (claudeAvailable) await brain('claude');
console.log('screenshots saved to', OUT);
