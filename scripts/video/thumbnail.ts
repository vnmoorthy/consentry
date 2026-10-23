// A 1280×720 thumbnail from real frames: the consent prompt from the demo, the presenter's face in
// the ember ring, and a headline. Usage: `pnpm tsx scripts/video/thumbnail.ts` (after compose.ts)
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { BUILD, OUTPUT, isMain, loadScript, phraseIndex, probe, sh } from './lib';
import type { Timeline } from './timeline';

export async function thumbnail() {
  const t: Timeline = JSON.parse(readFileSync(`${BUILD}/timeline.json`, 'utf8'));
  const script = loadScript();
  const at = (id: string, phrase: string) => {
    const s = t.sections.find((x) => x.id === id)!;
    return s.start + s.words[phraseIndex(script.sections.find((x) => x.id === id)!.say, phrase)];
  };
  // The consent prompt, zoomed in, a beat after it's mentioned.
  const shot = `${BUILD}/thumb-screen.png`;
  // (cropped right of the webcam circle, so the face isn't in the thumbnail twice)
  sh('ffmpeg', ['-y', '-v', 'error', '-ss', (at('consent', 'showing exactly what would go out') + 0.4).toFixed(2), '-i', `${OUTPUT}/consentry-demo.mp4`, '-frames:v', '1', '-vf', 'crop=1500:1000:420:0', shot]);
  // The presenter mid-sentence, from the hook.
  const src = probe(t.source);
  const side = Math.round(src.height * 0.85);
  const face = `${BUILD}/thumb-face.png`;
  sh('ffmpeg', ['-y', '-v', 'error', '-ss', '24', '-i', t.source, '-frames:v', '1', '-vf', `crop=${side}:${side}:${Math.round(src.width * 0.53 - side / 2)}:0,scale=420:420,eq=brightness=0.04:contrast=1.08:saturation=1.1`, face]);

  const b64 = (f: string) => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.setContent(
    `<!doctype html><html><head><link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@500;700;800&display=block" rel="stylesheet"><style>
    *{margin:0;box-sizing:border-box}body{width:1280px;height:720px;overflow:hidden;font-family:'Work Sans',sans-serif;-webkit-font-smoothing:antialiased;background:linear-gradient(160deg,#16171a,#0e0f0c 65%)}
    .glow{position:absolute;right:-120px;top:120px;width:900px;height:620px;border-radius:50%;background:radial-gradient(closest-side,rgba(239,165,111,.35),transparent 70%);filter:blur(20px)}
    .shot{position:absolute;right:-60px;top:70px;width:820px;border-radius:22px;overflow:hidden;transform:rotate(-3deg);box-shadow:0 40px 90px -20px rgba(0,0,0,.85),0 0 0 2px rgba(239,165,111,.55)}
    .shot img{display:block;width:100%}
    .copy{position:absolute;left:56px;top:64px;width:600px}
    .tag{display:inline-block;font-size:20px;font-weight:700;letter-spacing:.32em;color:#efa56f;text-transform:uppercase}
    h1{margin-top:18px;font-size:62px;line-height:1.02;font-weight:800;color:#fff;letter-spacing:-.02em;text-shadow:0 6px 30px rgba(0,0,0,.6)}
    h1 em{font-style:normal;color:#efa56f}
    .face{position:absolute;left:56px;bottom:44px;width:220px;height:220px;border-radius:50%;padding:6px;background:conic-gradient(from 210deg,#efa56f,#f6d8b4,#efa56f,#c9814f,#efa56f);box-shadow:0 20px 50px -10px rgba(0,0,0,.8)}
    .face img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block}
    .pill{position:absolute;left:300px;bottom:92px;font-size:26px;font-weight:700;color:#0e0f0c;background:#efa56f;padding:12px 22px;border-radius:16px}
    </style></head><body>
    <div class="glow"></div>
    <div class="shot"><img src="${b64(shot)}"></div>
    <div class="copy"><div class="tag">Consentry</div><h1>Your AI agent can use the world&rsquo;s data. <em>Not yours.</em></h1></div>
    <div class="face"><img src="${b64(face)}"></div>
    <div class="pill">5-min demo · open source</div>
    </body></html>`,
    { waitUntil: 'networkidle' },
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUTPUT}/consentry-demo-thumbnail.png` });
  await browser.close();
  console.log(`→ ${OUTPUT}/consentry-demo-thumbnail.png`);
}

if (isMain(import.meta.url)) await thumbnail();
