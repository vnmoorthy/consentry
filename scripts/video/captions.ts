// Burned-in captions for social feeds (autoplay is muted), word by word: the spoken word lights up
// in ember, upcoming words are dimmed. This ffmpeg has no libass, so each caption state is rendered
// in Chrome and stitched into one transparent overlay track.
// Usage: `pnpm tsx scripts/video/captions.ts` (after compose.ts) → video/output/consentry-demo-captions.mp4
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { BUILD, OUTPUT, isMain, sh } from './lib';
import type { Timeline } from './timeline';

const DIR = `${BUILD}/captions`;
const BOX = { w: 1400, h: 120 };
/** Centered in the area right of the webcam circle, just above the bottom edge. */
const POS = { x: Math.round((360 + 1920) / 2 - BOX.w / 2), y: 1080 - BOX.h - 34 };
const END_CARD = 4;

export async function burnCaptions() {
  const t: Timeline = JSON.parse(readFileSync(`${BUILD}/timeline.json`, 'utf8'));
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: BOX.w, height: BOX.h } });
  await page.setContent(
    `<!doctype html><html><head><link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@500;600&display=block" rel="stylesheet">
    <style>*{margin:0}body{background:transparent;width:${BOX.w}px;height:${BOX.h}px;display:flex;align-items:center;justify-content:center;font-family:'Work Sans',sans-serif;-webkit-font-smoothing:antialiased}
    #c{padding:12px 26px 14px;border-radius:18px;background:rgba(14,15,12,.82);box-shadow:0 10px 34px -8px rgba(0,0,0,.7);font-size:42px;font-weight:600;letter-spacing:-.005em;white-space:nowrap;color:rgba(255,255,255,.5)}
    #c .s{color:#fff}#c .n{color:#efa56f}#c:empty{display:none}</style></head><body><div id="c"></div></body></html>`,
    { waitUntil: 'networkidle' },
  );
  await page.evaluate(() => document.fonts.ready);
  const show = (words: string[], at: number) =>
    page.evaluate(([words, at]) => {
      const c = document.getElementById('c')!;
      c.innerHTML = '';
      (words as string[]).forEach((w, i) => {
        const s = document.createElement('span');
        s.textContent = (i ? ' ' : '') + w;
        if (i < (at as number)) s.className = 's';
        if (i === at) s.className = 'n';
        c.appendChild(s);
      });
    }, [words, at] as const);

  const list: string[] = [];
  let n = 0;
  const frame = async (words: string[], at: number) => {
    await show(words, at);
    const file = `${String(n++).padStart(4, '0')}.png`;
    await page.screenshot({ path: `${DIR}/${file}`, omitBackground: true });
    return file;
  };
  const blank = await frame([], -1);
  const push = (file: string, d: number) => d > 0.001 && list.push(`file '${file}'`, `duration ${d.toFixed(3)}`);

  let clock = 0;
  for (const c of t.captions) {
    push(blank, c.start - clock);
    const texts = c.words.map((w) => w.text);
    for (let i = 0; i < c.words.length; i++) {
      const from = i === 0 ? c.start : c.words[i].start;
      const to = i + 1 < c.words.length ? c.words[i + 1].start : c.end;
      push(await frame(texts, i), to - from);
    }
    clock = c.end;
  }
  push(blank, t.duration + END_CARD - clock);
  list.push(`file '${blank}'`);
  writeFileSync(`${DIR}/list.txt`, list.join('\n'));
  await browser.close();
  console.log(`${n} caption states rendered`);

  const master = `${OUTPUT}/consentry-demo.mp4`;
  const out = `${OUTPUT}/consentry-demo-captions.mp4`;
  sh('ffmpeg', ['-y', '-v', 'error', '-i', master, '-f', 'concat', '-safe', '0', '-i', `${DIR}/list.txt`, '-filter_complex', `[1:v]fps=30,format=rgba[cap];[0:v][cap]overlay=x=${POS.x}:y=${POS.y}:eof_action=pass,format=yuv420p[v]`, '-map', '[v]', '-map', '0:a', '-c:v', 'libx264', '-preset', process.env.PRESET ?? 'faster', '-crf', '18', '-c:a', 'copy', '-movflags', '+faststart', out]);
  console.log(`→ ${out}`);
}

if (isMain(import.meta.url)) await burnCaptions();
