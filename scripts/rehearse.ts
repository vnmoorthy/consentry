// Timed rehearsal of the guided demo tour, driven through the real tour panel.
// Usage: gateway running (`pnpm start`), then `pnpm tsx scripts/rehearse.ts [outdir]`
import { chromium, type Page } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.CONSENTRY_URL ?? 'http://localhost:8787';
const OUT = process.argv[2] ?? 'rehearsal';
mkdirSync(OUT, { recursive: true });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const api = (path: string, body?: unknown, method = 'POST') => fetch(`${BASE}${path}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

await api('/api/reset');
const state = await (await fetch(`${BASE}/api/state`)).json();
console.log(`Brain: ${state.settings.agentMode} · ${state.settings.model} · effort ${state.settings.effort}\n`);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1512, height: 945 } });
await ctx.addInitScript(() => {
  if (sessionStorage.getItem('rehearsal')) return;
  sessionStorage.setItem('rehearsal', '1');
  localStorage.setItem('consentry:welcomed:v1', '1');
  localStorage.setItem('consentry:tour:v1', '0');
  localStorage.setItem('consentry:tour:v1:compact', '0');
});
const page = await ctx.newPage();
const errors: string[] = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 200)));

await page.goto(BASE);
await page.getByText('Your agent,').first().waitFor({ timeout: 30000 });
await wait(800);
if (!(await page.locator('[data-tour-action]').count())) await page.locator('[data-demo-toggle]').click({ timeout: 15000 });
await page.locator('[data-tour-action]').waitFor({ timeout: 10000 });
await wait(400);

const idle = () => page.waitForFunction(() => document.querySelector('textarea')?.getAttribute('placeholder')?.startsWith('Ask'), null, { timeout: 150000 });

/** Answer any consent prompts until the agent is idle. Returns how many prompts appeared. */
let firstText = 0;
async function untilIdle(firstKey: string) {
  let prompts = 0;
  const started = Date.now();
  firstText = 0;
  const deadline = Date.now() + 150000;
  while (Date.now() < deadline) {
    const isIdle = await page.evaluate(() => document.querySelector('textarea')?.getAttribute('placeholder')?.startsWith('Ask'));
    if (!firstText && (await page.evaluate(() => document.body.innerText.includes('▍')))) firstText = (Date.now() - started) / 1000;
    if (isIdle) return prompts;
    if (await page.getByText('Consent required').first().isVisible().catch(() => false)) {
      await wait(900); // a presenter reads the prompt
      await page.keyboard.press(prompts === 0 ? firstKey : '1');
      prompts++;
      await wait(400);
    }
    await wait(150);
  }
  throw new Error('agent never went idle');
}

interface Row { n: number; title: string; budget: number; seconds: number; note: string }
const rows: Row[] = [];

const total = Number((await page.locator('text=/Tour \\d+\\/\\d+/').first().textContent())?.match(/\/(\d+)/)?.[1] ?? 12);
for (let n = 1; n <= total; n++) {
  const title = (await page.locator('[data-tour-action]').locator('xpath=ancestor::div[contains(@class,"p-5")]').locator('h3').first().textContent())?.trim() ?? `Chapter ${n}`;
  const t0 = Date.now();
  let note = '';
  await page.locator('[data-tour-action]').click({ force: true });
  await wait(700);
  try {
    if (/Meet Maya/.test(title)) {
      const card = page.locator('div.panel', { hasText: 'Social Security Number' }).first();
      await card.getByRole('button', { name: 'Reveal' }).click();
      await wait(1200);
      await card.getByRole('button', { name: 'Hide' }).click();
    } else if (/Real public data|Claude as the brain/.test(title)) {
      const prompts = await untilIdle('1');
      if (prompts) note += `${prompts} consent prompt(s) · `;
      if (firstText) note += `first text ${firstText.toFixed(1)}s · `;
      if (/Claude/.test(title)) {
        await page.getByRole('button', { name: /What Claude saw/ }).last().click();
        await wait(600);
      }
    } else if (/Consent that means/.test(title)) {
      const prompts = await untilIdle('3');
      note += `${prompts} consent prompt(s) · ${firstText ? `first text ${firstText.toFixed(1)}s · ` : ''}`;
    } else if (/Partners get the least|Exact address/.test(title)) {
      const prompts = await untilIdle('1');
      note += `${prompts} consent prompt(s) · ${firstText ? `first text ${firstText.toFixed(1)}s · ` : ''}`;
    } else if (/receipt/i.test(title)) {
      await page.getByText('HASH CHAIN VERIFIED').waitFor({ timeout: 10000 });
      await wait(800);
      await page.keyboard.press('Escape');
    } else if (/Who knows what/.test(title)) {
      await page.getByRole('button', { name: /TableTap/ }).first().click();
      await page.getByRole('button', { name: /Request deletion/ }).click();
      await page.getByRole('button', { name: /Send request/ }).click();
      await page.getByText(/confirmed deletion/).waitFor({ timeout: 15000 });
      await wait(600);
      await page.keyboard.press('Escape');
    } else if (/Attack your own agent/.test(title)) {
      await page.getByText('Tampering detected').waitFor({ timeout: 150000 });
    } else if (/Proof, not promises/.test(title)) {
      await page.getByRole('button', { name: /Tamper/ }).click();
      await wait(500);
      await page.getByRole('button', { name: /Verify chain/ }).click();
      await page.getByText(/broken at #/).first().waitFor({ timeout: 20000 });
      await page.getByRole('button', { name: /Re-seal/ }).click();
      await wait(500);
    } else if (/Rules in plain English/.test(title)) {
      await page.getByRole('button', { name: 'Never let the AI see my medications' }).click();
      await page.getByRole('button', { name: /Add rule/ }).click();
      await wait(500);
    } else {
      await wait(800);
    }
  } catch (err: any) {
    note += `⚠️ ${String(err.message).split('\n')[0].slice(0, 120)} · `;
  }
  const seconds = (Date.now() - t0) / 1000;
  // Server-side breakdown of the last run in this chapter.
  const ev: any[] = await (await fetch(`${BASE}/api/recent-events`)).json();
  const lastStart = [...ev].reverse().find((e) => e.type === 'run.start' && e.ts >= t0);
  if (lastStart) {
    const runEv = ev.filter((e) => e.runId === lastStart.runId);
    const end = runEv.find((e) => e.type === 'run.end');
    const firstCall = runEv.find((e) => e.type === 'tool.call');
    const calls = runEv.filter((e) => e.type === 'tool.call').length;
    const consentWait = runEv.filter((e) => e.type === 'consent.request').reduce((s, c) => {
      const r = ev.find((x) => x.type === 'consent.resolved' && x.id === c.request.id);
      return s + (r ? r.ts - c.ts : 0);
    }, 0);
    const toolMs = runEv.filter((e) => e.type === 'tool.result').reduce((s, e) => s + (e.ms ?? 0), 0);
    const msg = runEv.find((e) => e.type === 'agent.message');
    const total = end ? end.ts - lastStart.ts : 0;
    note += `run ${(total / 1000).toFixed(1)}s (first tool ${firstCall ? ((firstCall.ts - lastStart.ts) / 1000).toFixed(1) : '–'}s · ${calls} calls · tools ${(toolMs / 1000).toFixed(1)}s · consent ${(consentWait / 1000).toFixed(1)}s · model ≈${((total - toolMs - consentWait) / 1000).toFixed(1)}s) · answer ${msg?.text?.length ?? 0} chars`;
  }
  const budget = [35, 45, 60, 50, 30, 25, 50, 60, 40, 35, 40, 30][n - 1] ?? 30;
  rows.push({ n, title, budget, seconds, note });
  console.log(`${String(n).padStart(2)}. ${title.padEnd(30)} ${seconds.toFixed(1).padStart(6)}s  (budget ${budget}s)  ${note}`);
  await page.screenshot({ path: `${OUT}/ch${String(n).padStart(2, '0')}.png` });
  if (n < total) {
    await page.locator('[data-tour-next]').click({ force: true });
    await wait(500);
  }
}

const sum = rows.reduce((s, r) => s + r.seconds, 0);
console.log(`\nAction time: ${sum.toFixed(0)}s across ${rows.length} chapters (talk budget ${rows.reduce((s, r) => s + r.budget, 0)}s)`);
console.log(errors.length ? `Console errors (${errors.length}):\n  ${[...new Set(errors)].slice(0, 10).join('\n  ')}` : 'No console errors');
writeFileSync(`${OUT}/timings.json`, JSON.stringify({ rows, errors }, null, 2));
await browser.close();
