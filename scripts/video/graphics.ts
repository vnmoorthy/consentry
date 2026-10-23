// Renders the video's graphics in Chrome, in the product's Ember Horizon style: the webcam ring and
// mask, one chapter tag per section, and the end card. Usage: `pnpm tsx scripts/video/graphics.ts`
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { BUILD, isMain, loadScript } from './lib';

export const GFX = `${BUILD}/gfx`;
/** Webcam circle: diameter and margin from the bottom-left corner, in output pixels. */
export const CAM = { d: 290, margin: 36, ring: 5 };

const FONT = '<link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600&display=block" rel="stylesheet">';
const BASE_CSS = `*{margin:0;box-sizing:border-box} body{background:transparent;font-family:'Work Sans',system-ui,sans-serif;-webkit-font-smoothing:antialiased}`;

export async function renderGraphics() {
  mkdirSync(GFX, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const shot = async (html: string, file: string, size: { w: number; h: number }, opts: { transparent?: boolean } = {}) => {
    await page.setViewportSize({ width: size.w, height: size.h });
    await page.setContent(`<!doctype html><html><head>${FONT}<style>${BASE_CSS}</style></head><body>${html}</body></html>`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${GFX}/${file}`, omitBackground: opts.transparent ?? true, clip: { x: 0, y: 0, width: size.w, height: size.h } });
  };

  // Mask (luma = alpha) for the face, antialiased by the browser.
  await shot(`<div style="width:${CAM.d}px;height:${CAM.d}px;background:#000"><div style="width:100%;height:100%;border-radius:50%;background:#fff"></div></div>`, 'mask.png', { w: CAM.d, h: CAM.d }, { transparent: false });

  // Ring + soft shadow, drawn on a canvas 60px larger than the circle on each side.
  const R = CAM.d + 120;
  await shot(
    `<div style="position:relative;width:${R}px;height:${R}px">
      <div style="position:absolute;left:60px;top:60px;width:${CAM.d}px;height:${CAM.d}px;border-radius:50%;box-shadow:0 18px 50px -8px rgba(0,0,0,.75),0 0 0 1px rgba(0,0,0,.35)"></div>
      <div style="position:absolute;left:${60 - CAM.ring}px;top:${60 - CAM.ring}px;width:${CAM.d + 2 * CAM.ring}px;height:${CAM.d + 2 * CAM.ring}px;border-radius:50%;padding:${CAM.ring}px;background:conic-gradient(from 210deg,#efa56f,#f6d8b4,#efa56f,#c9814f,#efa56f);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - ${CAM.ring}px),#000 calc(100% - ${CAM.ring}px + 1px))"></div>
      <div style="position:absolute;left:${60 - CAM.ring - 6}px;top:${60 - CAM.ring - 6}px;width:${CAM.d + 2 * CAM.ring + 12}px;height:${CAM.d + 2 * CAM.ring + 12}px;border-radius:50%;box-shadow:0 0 28px rgba(239,165,111,.28)"></div>
    </div>`,
    'ring.png',
    { w: R, h: R },
  );
  // Clear the shadow from inside the circle so the face isn't darkened (drawn under the face anyway).

  // Chapter tags: a name-tag pill that straddles the bottom of the circle.
  for (const [i, s] of loadScript().sections.entries()) {
    await shot(
      `<div style="display:inline-flex;align-items:center;gap:12px;padding:9px 18px 9px 12px;border-radius:999px;background:rgba(14,15,12,.92);border:1px solid rgba(239,165,111,.45);box-shadow:0 10px 30px -6px rgba(0,0,0,.7);color:#fff;font-size:21px;font-weight:500;white-space:nowrap" id="p">
        <span style="font-size:14px;font-weight:600;letter-spacing:.12em;color:#0e0f0c;background:#efa56f;border-radius:999px;padding:3px 8px">${String(i + 1).padStart(2, '0')}</span>${s.title}
      </div>`,
      `chapter-${String(i + 1).padStart(2, '0')}.png`,
      { w: 420, h: 60 },
    );
    // Crop to the pill itself.
    const b = await page.locator('#p').boundingBox();
    await page.screenshot({ path: `${GFX}/chapter-${String(i + 1).padStart(2, '0')}.png`, omitBackground: true, clip: { x: 0, y: 0, width: Math.ceil(b!.width) + 2, height: Math.ceil(b!.height) + 2 } });
  }

  // End card.
  await shot(
    `<div style="position:relative;width:1920px;height:1080px;overflow:hidden;background:linear-gradient(180deg,#121310 0%,#191a1c 60%,#0e0f0c 100%);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
      <div style="position:absolute;left:0;right:0;top:61%;height:1px;background:linear-gradient(90deg,transparent,rgba(142,166,189,.35) 15%,rgba(247,217,185,.35) 55%,rgba(255,232,206,.85) 82%,transparent)"></div>
      <div style="position:absolute;top:61%;left:52%;width:1100px;height:600px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(closest-side,rgba(247,217,185,.22),rgba(239,165,111,.1) 45%,transparent 75%);filter:blur(10px)"></div>
      <svg width="86" height="86" viewBox="0 0 64 64" style="position:relative;margin-bottom:34px"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6d8b4"/><stop offset="1" stop-color="#efa56f"/></linearGradient></defs><path d="M32 4 54 12v18c0 14-9.5 25-22 30C19.5 55 10 44 10 30V12z" fill="none" stroke="url(#g)" stroke-width="3.5" stroke-linejoin="round"/><circle cx="32" cy="29" r="6" fill="url(#g)"/><path d="M32 35v9" stroke="url(#g)" stroke-width="3.5" stroke-linecap="round"/></svg>
      <div style="position:relative;font-size:96px;font-weight:500;letter-spacing:.34em;padding-left:.34em;line-height:1;text-transform:uppercase">Consentry</div>
      <div style="position:relative;margin-top:28px;font-size:18px;font-weight:500;letter-spacing:.42em;text-transform:uppercase;color:#efa56f">The consent firewall for AI agents</div>
      <div style="position:relative;margin-top:150px;font-size:30px;font-weight:400;color:#d9d4cb">Your data. Your rules. <span style="color:#fff">Your receipt.</span></div>
      <div style="position:relative;margin-top:44px;display:flex;gap:22px;font-size:22px">
        <span style="padding:14px 26px;border-radius:16px;background:#efa56f;color:#0e0f0c;font-weight:600">Try it: vnmoorthy.github.io/consentry</span>
        <span style="padding:14px 26px;border-radius:16px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.04);font-weight:500">★ github.com/vnmoorthy/consentry</span>
      </div>
      <div style="position:relative;margin-top:30px;font-size:15px;letter-spacing:.06em;color:#8f8a80">Open source · Real public APIs: Open-Meteo, NWS, USGS, NHTSA, openFDA, OpenFEMA · Partners simulated</div>
    </div>`,
    'endcard.png',
    { w: 1920, h: 1080 },
    { transparent: false },
  );
  await browser.close();
}

if (isMain(import.meta.url)) {
  await renderGraphics();
  console.log(`graphics → ${GFX}`);
}
