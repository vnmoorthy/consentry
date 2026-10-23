// Records the product, one clip per narrated section, choreographed to the presenter's actual words.
// Usage: gateway running (`pnpm start`), then `pnpm tsx scripts/video/record.ts`
//
// Reads video/build/timeline.json (from timeline.ts): each section's length and the time of every
// script word. Each action is keyed to the phrase that mentions it, so the click lands as it's said.
// The camera work happens in the page: a CSS transform on #root zooms onto whatever is being talked
// about, re-rasterized by Chrome so text stays crisp, with a fake cursor that zooms along.
// Output: video/build/screen/<id>.mp4 plus <id>.json (stretches where the agent was busy).
import { chromium, type Locator, type Page } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { BUILD, WPM, isMain, loadScript, phraseIndex, sh, words, type Section } from './lib';

const BASE = process.env.CONSENTRY_URL ?? 'http://localhost:8787';
// 1536×864 CSS px at 1.25× = 1920×1080 frames.
const W = 1536;
const H = 864;
const DPR = 1.25;
/** Left strip kept clear of zoom targets: the presenter's webcam circle lives in the bottom-left. */
const SAFE_LEFT = 250;
/** Actions start this early so the cursor arrives as the word is spoken. */
const LEAD = 0.45;
const SCREEN = `${BUILD}/screen`;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const api = (path: string, body?: unknown, method = 'POST') => fetch(`${BASE}${path}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

interface Timing { length: number; words: number[] }

function timings(sections: Section[]): Map<string, Timing> {
  const file = `${BUILD}/timeline.json`;
  const out = new Map<string, Timing>();
  if (existsSync(file)) {
    for (const s of JSON.parse(readFileSync(file, 'utf8')).sections) out.set(s.id, { length: s.end - s.start, words: s.words });
  } else {
    console.log('No video/build/timeline.json yet: estimating timing from the script.');
    for (const s of sections) {
      const n = words(s.say).length;
      const per = 60 / WPM;
      out.set(s.id, { length: n * per + 0.6, words: Array.from({ length: n }, (_, i) => 0.3 + i * per) });
    }
  }
  return out;
}

/**
 * In-page helpers: a zoomable camera on #root, plus a cursor layer that moves with it.
 * Injected as a string: tsx wraps named functions in a `__name()` helper that doesn't exist in the page.
 */
const PAGE_JS = `(() => {
  const EASE = 'cubic-bezier(.65,0,.35,1)';
  function layer() {
    let l = document.getElementById('rec-layer');
    if (!l) {
      l = document.createElement('div');
      l.id = 'rec-layer';
      Object.assign(l.style, { position: 'fixed', inset: '0', zIndex: '2147483647', pointerEvents: 'none', transformOrigin: '0 0' });
      const c = document.createElement('div');
      c.id = 'rec-cursor';
      c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M5 2.8 19.2 12.6l-6.4 1.2 3.7 6.9-2.7 1.4-3.7-6.9-4.9 4.4z" fill="#fff" stroke="#0e0f0c" stroke-width="1.2" stroke-linejoin="round"/></svg>';
      Object.assign(c.style, { position: 'absolute', left: '0', top: '0', opacity: '0', transform: 'translate(1180px, 620px)', transition: 'opacity .35s', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,.55))' });
      l.appendChild(c);
      document.documentElement.appendChild(l);
    }
    return l;
  }
  window.__rec = {
    camera(s, tx, ty, ms) {
      const t = 'translate(' + tx + 'px, ' + ty + 'px) scale(' + s + ')';
      for (const el of [document.getElementById('root'), layer()]) {
        el.style.transformOrigin = '0 0';
        el.style.transition = 'transform ' + ms + 'ms ' + (ms > 4000 ? 'linear' : EASE);
        el.style.transform = t;
      }
    },
    move(x, y, ms) {
      const c = layer().querySelector('#rec-cursor');
      c.style.transition = 'transform ' + ms + 'ms cubic-bezier(.22,.8,.26,1), opacity .35s';
      c.style.opacity = '1';
      c.style.transform = 'translate(' + (x - 5) + 'px, ' + (y - 3) + 'px)';
    },
    hide() {
      layer().querySelector('#rec-cursor').style.opacity = '0';
    },
    ripple(x, y) {
      const r = document.createElement('div');
      Object.assign(r.style, { position: 'absolute', left: (x - 22) + 'px', top: (y - 22) + 'px', width: '44px', height: '44px', borderRadius: '50%', border: '2px solid #efa56f', background: 'rgba(239,165,111,.2)' });
      layer().appendChild(r);
      r.animate([{ transform: 'scale(.35)', opacity: 1 }, { transform: 'scale(1.5)', opacity: 0 }], { duration: 520, easing: 'ease-out' }).onfinish = () => r.remove();
    },
  };
})();`;

type Target = Locator | { x: number; y: number; width: number; height: number };

class Director {
  /** Cursor position in page (unzoomed) coordinates. */
  cursor = { x: 1180, y: 620 };
  cam = { s: 1, tx: 0, ty: 0 };
  constructor(readonly page: Page) {}

  nav = (label: string) => this.page.locator('aside nav a', { hasText: label }).first();
  composer = () => this.page.locator('textarea').first();
  /** The open modal card or drawer. */
  dialog = () => this.page.locator('div.fixed.inset-0 > div:not(.absolute), div.fixed.inset-0 > aside').last();
  /** The latest agent answer bubble. */
  answer = () => this.page.locator('.md').last();

  private toPage = (x: number, y: number) => ({ x: (x - this.cam.tx) / this.cam.s, y: (y - this.cam.ty) / this.cam.s });

  async box(t: Target) {
    if (!('boundingBox' in t)) return t;
    await t.scrollIntoViewIfNeeded({ timeout: 3000 });
    const b = await t.boundingBox();
    if (!b) throw new Error('element has no box');
    return b;
  }

  async moveTo(x: number, y: number, ms?: number) {
    const p = this.toPage(x, y);
    const d = ms ?? Math.round(Math.min(620, Math.max(260, Math.hypot(p.x - this.cursor.x, p.y - this.cursor.y) * 0.55 * this.cam.s)));
    await this.page.evaluate(([x, y, d]) => (window as any).__rec.move(x, y, d), [p.x, p.y, d]);
    this.cursor = p;
    await wait(d + 80);
    await this.page.mouse.move(x, y);
  }
  /** Camera moves never abort a shot: a missing element skips just that move and is reported. */
  warnings: string[] = [];
  phrase = '';
  /** Clicks and camera moves, in seconds from the section start: compose.ts adds sound design on them. */
  events: { t: number; kind: 'click' | 'whoosh' }[] = [];
  t0 = 0;
  private mark = (kind: 'click' | 'whoosh') => this.events.push({ kind, t: +((Date.now() - this.t0) / 1000).toFixed(3) });
  private async safe<T>(what: string, fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn();
    } catch (err: any) {
      this.warnings.push(`"${this.phrase}" ${what}: ${String(err.message).split('\n')[0].slice(0, 90)}`);
      return undefined;
    }
  }
  point = (t: Target, dx = 0.5, dy = 0.5) => this.safe('point', () => this.rawPoint(t, dx, dy));
  click = (t: Target) => this.safe('click', () => this.rawClick(t));
  type = (t: Locator, text: string, seconds: number) => this.safe('type', () => this.rawType(t, text, seconds));
  zoom = (t: Target, opts: Parameters<Director['rawZoom']>[1] = {}) => this.safe('zoom', () => this.rawZoom(t, opts));

  private async rawPoint(t: Target, dx = 0.5, dy = 0.5) {
    const b = await this.box(t);
    const x = b.x + b.width * dx;
    const y = b.y + b.height * dy;
    await this.moveTo(x, y);
    return { x, y };
  }
  private async rawClick(t: Target) {
    const { x, y } = await this.rawPoint(t);
    const p = this.toPage(x, y);
    await this.page.evaluate(([x, y]) => (window as any).__rec.ripple(x, y), [p.x, p.y]);
    this.mark('click');
    await this.page.mouse.click(x, y);
    await wait(250);
  }
  /** Types like a person, finishing in about `seconds`. */
  private async rawType(t: Locator, text: string, seconds: number) {
    await this.rawClick(t);
    await t.pressSequentially(text, { delay: Math.max(22, Math.min(85, (seconds * 1000) / text.length)) });
  }
  hideCursor = () => this.page.evaluate(() => (window as any).__rec.hide());

  private async camera(s: number, tx: number, ty: number, ms: number) {
    if (ms > 0 && ms <= 4000) this.mark('whoosh');
    await this.page.evaluate(([s, tx, ty, ms]) => (window as any).__rec.camera(s, tx, ty, ms), [s, tx, ty, ms]);
    this.cam = { s, tx, ty };
    await wait(Math.min(ms, 4000) + 60);
  }
  /** Frames `t` (with padding) as large as `max` allows, centered right of the webcam strip. */
  private async rawZoom(t: Target, opts: { max?: number; pad?: number; ms?: number; part?: [number, number, number, number] } = {}) {
    const b = await this.box(t);
    const tl = this.toPage(b.x, b.y);
    let r = { x: tl.x, y: tl.y, w: b.width / this.cam.s, h: b.height / this.cam.s };
    if (opts.part) {
      const [px, py, pw, ph] = opts.part;
      r = { x: r.x + r.w * px, y: r.y + r.h * py, w: r.w * pw, h: r.h * ph };
    }
    const pad = opts.pad ?? 28;
    let s = Math.min(opts.max ?? 1.7, (W - SAFE_LEFT) / (r.w + 2 * pad), H / (r.h + 2 * pad));
    if (s < 1.08) return this.unzoom(opts.ms);
    s = +s.toFixed(3);
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    const tx = clamp((SAFE_LEFT + W) / 2 - s * (r.x + r.w / 2), W - s * W, 0);
    const ty = clamp(H / 2 - s * (r.y + r.h / 2), H - s * H, 0);
    await this.camera(s, +tx.toFixed(1), +ty.toFixed(1), opts.ms ?? 620);
  }
  async unzoom(ms = 560) {
    if (this.cam.s === 1 && !this.cam.tx && !this.cam.ty) return;
    await this.camera(1, 0, 0, ms);
  }
  /** A slow, linear push-in (for still shots). */
  async drift(s: number, seconds: number) {
    await this.page.evaluate(([s, tx, ty, ms]) => (window as any).__rec.camera(s, tx, ty, ms), [s, (W * (1 - s)) / 2, (H * (1 - s)) / 2, seconds * 1000]);
    this.cam = { s, tx: (W * (1 - s)) / 2, ty: (H * (1 - s)) / 2 };
  }
  async resetCamera() {
    await this.page.evaluate(() => (window as any).__rec.camera(1, 0, 0, 0));
    this.cam = { s: 1, tx: 0, ty: 0 };
  }

  idle = () => this.page.waitForFunction(() => document.querySelector('textarea')?.getAttribute('placeholder')?.startsWith('Ask'), null, { timeout: 150000 });
  consent = () => this.page.getByText('Consent required').first().waitFor({ timeout: 60000 });
}

/** What happens on screen in a section. `at(phrase)` waits until that phrase is spoken. */
interface Scene {
  prep?(d: Director): Promise<void>;
  run(d: Director, at: (phrase: string) => Promise<void>, busy: <T>(p: Promise<T>) => Promise<T>, span: (a: string, b: string) => number): Promise<void>;
}

const SCENES: Record<string, Scene> = {
  hook: {
    async prep(d) {
      await d.page.evaluate(() => window.dispatchEvent(new CustomEvent('consentry:welcome')));
      await wait(60);
    },
    async run(d, at) {
      await d.drift(1.06, 24);
      await at("The world doesn't get to use yours");
      await d.resetCamera();
      await d.point(d.page.getByRole('button', { name: /Explore on my own/ }));
      await at('use yours');
      await wait(500);
      await d.click(d.page.getByRole('button', { name: /Explore on my own/ }));
    },
  },
  vault: {
    async run(d, at) {
      await at('Meet Maya');
      await d.point(d.page.getByText('demo persona').first());
      await at("She's not real");
      await d.click(d.nav('Vault'));
      const ssn = d.page.locator('div.panel', { hasText: 'Social Security Number' }).first();
      await at('Social Security number, credit card');
      await d.zoom(ssn, { max: 1.6, pad: 120 });
      await d.click(ssn.getByRole('button', { name: 'Reveal' }));
      await at('all locked in this vault');
      await d.click(ssn.getByRole('button', { name: 'Hide' }));
      await at("And here's the trick");
      const token = d.page.getByText('{{vault:home_location}}').first();
      await d.zoom(token.locator('xpath=ancestor::div[contains(@class,"panel")][1]'), { max: 1.5 });
      await at('It only gets placeholder tokens');
      await d.point(token);
    },
  },
  'public-data': {
    async prep(d) {
      await d.resetCamera();
    },
    async run(d, at, busy, span) {
      await at("let's actually use it");
      await d.click(d.nav('Command Center'));
      await at("I'm going to ask");
      await d.type(d.composer(), 'Is Saturday good for a hike in Yosemite with my asthma?', span("I'm going to ask", 'Now watch the feed'));
      await d.page.keyboard.press('Enter');
      await at('Now watch the feed');
      await d.zoom(d.page.locator('[data-demo="feed"]'), { max: 1.45 });
      await busy(d.idle());
      await at('every call says clean');
      await d.point(d.page.locator('[data-demo="feed"]').getByText(/^clean$/i).first());
      await at('The asthma part');
      await d.zoom(d.answer(), { max: 1.5, part: [0, 0.45, 1, 0.55] });
      await d.point(d.page.getByText('For your asthma').last());
      await at("on Maya's own device");
      // Public data has limits, and the answer says so: hold on that block into the next section.
      await d.page.evaluate(`(() => {
        const p = [...document.querySelectorAll('.md p')].filter((x) => x.textContent.includes('Data limits')).pop();
        if (p) { p.classList.add('demo-highlight'); p.nextElementSibling?.classList.add('demo-highlight'); }
      })()`);
      await d.point(d.page.getByText('Data limits').last());
    },
  },
  consent: {
    async run(d, at, busy, span) {
      await at("Now let's get personal");
      await d.unzoom();
      await at("I'll ask it to check");
      await d.type(d.composer(), 'Do a safety sweep: has anything I own or take been recalled?', span("I'll ask it to check", 'Her car'));
      await d.page.keyboard.press('Enter');
      await busy(d.consent());
      await at('But her medications');
      await wait(400);
      await d.zoom(d.dialog(), { max: 1.4 });
      await at('showing exactly what would go out');
      await d.point(d.page.getByText(/minimized/i).filter({ visible: true }).first());
      await at("I'll say yes for thirty days");
      await d.click(d.page.getByRole('button', { name: /30 days/ }));
      await d.unzoom();
      await busy(d.idle());
      await at('Her anxiety meds');
      await d.zoom(d.answer(), { max: 1.45 });
      await d.point(d.answer(), 0.35, 0.6);
    },
  },
  partners: {
    async run(d, at, busy, span) {
      await at('Apps get even less');
      await d.unzoom();
      await at("Let's book dinner");
      await d.type(d.composer(), 'Book a vegetarian dinner for 2 tonight at 7:30', span("Let's book dinner", 'The restaurant finder'));
      await d.page.keyboard.press('Enter');
      await busy(d.consent());
      await wait(300);
      await d.zoom(d.dialog(), { max: 1.4 });
      await at('The booking app gets');
      await d.click(d.page.getByRole('button', { name: /Share minimized version/ }));
      await d.unzoom();
      await busy(d.idle());
      await at('And her peanut allergy');
      await d.zoom(d.answer(), { max: 1.45 });
      await d.point(d.page.getByText(/peanut-free/i).last());
    },
  },
  ride: {
    async run(d, at, busy, span) {
      await at('Sometimes an app genuinely needs more');
      await d.unzoom();
      await at('Say I want a ride home');
      await d.type(d.composer(), 'Get me a ride home from Verdant Kitchen at 9:30 PM', span('Say I want a ride home', 'RideNow wants'));
      await d.page.keyboard.press('Enter');
      await busy(d.consent());
      await wait(300);
      await d.zoom(d.dialog(), { max: 1.4 });
      await at('offers the nearest street corner');
      await d.click(d.page.getByRole('button', { name: /Share minimized version/ }));
      await d.unzoom();
      await busy(d.idle());
      await at('The driver still finds her');
      await d.point(d.answer(), 0.35, 0.4);
    },
  },
  receipt: {
    async run(d, at) {
      await at('she gets a receipt');
      await d.click(d.page.getByRole('button', { name: 'Privacy receipt' }).last());
      await wait(700);
      await d.zoom(d.dialog(), { max: 1.3, pad: 16 });
      await at('backed by a ledger');
      await d.point(d.page.getByText(/hash chain verified/i).first());
    },
  },
  footprint: {
    async run(d, at) {
      await d.unzoom(600);
      await d.page.keyboard.press('Escape');
      await at('this is my favorite screen');
      await d.click(d.nav('Footprint'));
      await at('Red means they know it exactly');
      await d.zoom(d.page.locator('[data-demo="matrix"]'), { max: 1.35, part: [0, 0, 1, 0.75] });
      await at('if she wants a company to forget her');
      await d.unzoom(600);
      await d.click(d.page.getByRole('button', { name: /TableTap/ }).first());
      await wait(600);
      await d.zoom(d.dialog(), { max: 1.5, part: [0, 0, 1, 0.55] });
      await at('One click');
      await d.click(d.page.getByRole('button', { name: /Request deletion/ }));
      await wait(500);
      await d.zoom(d.dialog(), { max: 1.3 });
      await at('listing exactly what they got');
      await d.click(d.page.getByRole('button', { name: /Send request/ }));
    },
  },
  redteam: {
    async prep(d) {
      await d.resetCamera();
      await d.page.keyboard.press('Escape');
      await wait(300);
      await d.page.keyboard.press('Escape');
      await wait(400);
    },
    async run(d, at, busy) {
      await at('we tried to break it');
      await d.click(d.nav('Red Team'));
      await at('This restaurant review');
      await d.click(d.page.locator('[data-demo="run-all"]'));
      await busy(d.page.getByText('Tampering detected').first().waitFor({ timeout: 150000 }));
      await at('Consentry spots the attack');
      await d.point(d.page.getByText('Contained').first());
      await at('Five attacks');
      await d.zoom(d.page.getByText('attacks contained').locator('xpath=ancestor::div[contains(@class,"panel")][1]'), { max: 1.6, pad: 60 });
    },
  },
  ledger: {
    async run(d, at, busy) {
      await at("you don't have to trust us");
      await d.unzoom(700);
      await d.click(d.nav('Ledger'));
      await at('if anyone goes back and edits history');
      await d.click(d.page.locator('[data-demo="tamper"]'));
      await at('the check breaks');
      await d.click(d.page.locator('[data-demo="verify"]'));
      await busy(d.page.getByText(/broken at #/).first().waitFor({ timeout: 20000 }));
      await d.zoom(d.page.getByText(/broken at #/).first(), { max: 1.5, pad: 140 });
    },
  },
  rules: {
    async prep(d) {
      await d.resetCamera();
      const reseal = d.page.getByRole('button', { name: /Re-seal/ });
      if (await reseal.isVisible().catch(() => false)) await reseal.click();
      await wait(500);
    },
    async run(d, at, _busy, span) {
      await at('Want to change the rules');
      await d.click(d.nav('Policies'));
      await wait(300);
      await d.zoom(d.page.locator('[data-demo="composer"]'), { max: 1.5 });
      await at('Never let the AI see');
      await d.type(d.page.getByPlaceholder(/Never share my health data/), 'Never let the AI see my medications', span('Never let the AI see', 'Done'));
      await d.click(d.page.getByRole('button', { name: /Compile/ }));
      await wait(600);
      await d.zoom(d.page.locator('[data-demo="composer"]'), { max: 1.45 });
      await at("That's now a real rule");
      await d.click(d.page.getByRole('button', { name: /Add rule/ }));
      const sim = d.page.locator('div.panel', { hasText: 'Policy simulator' }).first();
      await at('And this simulator');
      await d.zoom(sim, { max: 1.45 });
      await d.point(sim.locator('select').nth(0));
      await sim.locator('select').nth(0).selectOption('v_albuterol');
      await at('by whom, and why');
      await d.point(sim.locator('select').nth(1));
      await sim.locator('select').nth(1).selectOption('claude');
      await wait(600);
      await d.point(sim, 0.5, 0.82);
    },
  },
  claude: {
    async prep() {
      await api('/api/settings', { agentMode: 'claude' }, 'PUT');
      await wait(800);
    },
    async run(d, at, busy, span) {
      await at('So far, that was');
      await d.unzoom(700);
      await d.click(d.nav('Command Center'));
      await at('Now Claude is the brain');
      await d.zoom(d.page.locator('main').getByText(/Claude · claude-/).first(), { max: 1.7, pad: 90 });
      await at("I'm going to overshare");
      await d.unzoom(600);
      await d.type(d.composer(), 'My SSN is 078-05-1120 and my card is 4242 4242 4242 4242. Is the air OK at home today?', Math.min(4, span("I'm going to overshare", 'Watch what the model actually gets')));
      await d.page.keyboard.press('Enter');
      await at('Watch what the model actually gets');
      const card = d.page.getByText('[Government ID withheld]').first();
      await d.zoom(card.locator('xpath=ancestor::div[contains(@class,"rounded")][2]'), { max: 1.6 });
      await d.point(card);
      await busy(d.idle());
      await at('It still answers me');
      await d.zoom(d.answer(), { max: 1.4 });
      await at('rounded to about ten kilometers');
      await d.unzoom(600);
      await d.zoom(d.page.getByText(/≈10 km/).first().locator('xpath=ancestor::div[contains(@class,"rounded")][2]'), { max: 1.6 });
      await d.point(d.page.getByText(/≈10 km/).first());
    },
  },
  close: {
    async prep(d) {
      await d.resetCamera();
    },
    async run(d, at) {
      await at("You don't have to use our agent");
      await d.click(d.nav('Connections'));
      await wait(300);
      await d.zoom(d.page.locator('[data-demo="mcp"]'), { max: 1.5 });
      await at('plugs into Claude Desktop');
      await d.point(d.page.getByText('Claude Code', { exact: true }).first());
      await at("If you're a company");
      await d.unzoom(900);
      await d.hideCursor();
      await at("It's open source");
      await d.page.evaluate(() => window.dispatchEvent(new CustomEvent('consentry:welcome')));
      await wait(300);
      await d.drift(1.05, 14);
    },
  },
};

function encode(id: string, frames: { data: Buffer; ts: number }[], t0: number, t1: number) {
  if (!frames.length) throw new Error(`no frames captured for ${id}`);
  const dir = `${BUILD}/frames/${id}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const lines: string[] = [];
  frames.forEach((f, i) => {
    const name = `${String(i).padStart(5, '0')}.jpg`;
    writeFileSync(`${dir}/${name}`, f.data);
    const from = i === 0 ? t0 : f.ts;
    const to = i + 1 < frames.length ? frames[i + 1].ts : t1;
    lines.push(`file '${name}'`, `duration ${Math.max(0.001, to - from).toFixed(4)}`);
  });
  lines.push(`file '${String(frames.length - 1).padStart(5, '0')}.jpg'`);
  writeFileSync(`${dir}/list.txt`, lines.join('\n'));
  sh('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', `${dir}/list.txt`, '-vf', 'fps=30,scale=1920:1080:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'fast', '-crf', '14', '-movflags', '+faststart', `${SCREEN}/${id}.mp4`]);
  rmSync(dir, { recursive: true, force: true });
}

export async function record(opts: { headed?: boolean; only?: string[]; until?: string; from?: string } = {}) {
  const script = loadScript();
  const time = timings(script.sections);
  mkdirSync(SCREEN, { recursive: true });

  const state = await (await fetch(`${BASE}/api/state`)).json().catch(() => null);
  if (!state) throw new Error(`The gateway isn't running at ${BASE}. Start it with \`pnpm start\`.`);
  const originalMode = state.settings.agentMode;
  if (!state.settings.hasApiKey) console.log('⚠️ No Anthropic key: the "claude" section will fall back to Autopilot.');
  await api('/api/reset');
  await api('/api/settings', { agentMode: 'autopilot' }, 'PUT');

  const browser = await chromium.launch({ channel: 'chrome', headless: !opts.headed });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
  await ctx.addInitScript(() => {
    localStorage.setItem('consentry:welcomed:v1', '1');
    localStorage.setItem('consentry:recording', '1');
  });
  await ctx.addInitScript({ content: PAGE_JS });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(BASE);
  await page.getByText('Your agent,').first().waitFor({ timeout: 30000 });
  await wait(1500);
  const cdp = await ctx.newCDPSession(page);
  const d = new Director(page);

  const report: string[] = [];
  const from = opts.from ? script.sections.findIndex((s) => s.id === opts.from) : 0;
  for (const section of script.sections.slice(from)) {
    const scene = SCENES[section.id];
    const t = time.get(section.id);
    if (!scene || !t) throw new Error(`no scene or timing for section "${section.id}"`);
    await scene.prep?.(d);
    const busyRanges: [number, number][] = [];
    const warnings: string[] = [];
    let start = 0;
    const at = async (phrase: string) => {
      d.phrase = phrase;
      const ms = start + (t.words[phraseIndex(section.say, phrase)] - LEAD) * 1000 - Date.now();
      if (ms > 0) await wait(ms);
    };
    const span = (a: string, b: string) => Math.max(1.2, t.words[phraseIndex(section.say, b)] - t.words[phraseIndex(section.say, a)] - 0.6);
    const busy = async <T>(p: Promise<T>) => {
      const a = (Date.now() - start) / 1000;
      try {
        return await p;
      } finally {
        busyRanges.push([a, (Date.now() - start) / 1000]);
      }
    };

    const frames: { data: Buffer; ts: number }[] = [];
    const onFrame = (f: any) => {
      frames.push({ data: Buffer.from(f.data, 'base64'), ts: f.metadata.timestamp });
      void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    };
    cdp.on('Page.screencastFrame', onFrame);
    const t0 = Date.now() / 1000;
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W * DPR, maxHeight: H * DPR, everyNthFrame: 1 });
    start = Date.now();
    d.t0 = start;
    d.events = [];
    try {
      await scene.run(d, at, busy, span);
    } catch (err: any) {
      warnings.push(String(err.message).split('\n')[0].slice(0, 160));
    }
    warnings.push(...d.warnings.splice(0));
    const left = start + t.length * 1000 + 300 - Date.now();
    if (left > 0) await wait(left);
    const t1 = Date.now() / 1000;
    await cdp.send('Page.stopScreencast');
    cdp.off('Page.screencastFrame', onFrame);

    if (!opts.only || opts.only.includes(section.id)) {
      encode(section.id, frames, t0, t1);
      const length = t1 - t0;
      writeFileSync(`${SCREEN}/${section.id}.json`, JSON.stringify({ id: section.id, length, target: t.length, busy: busyRanges.filter(([a, b]) => b - a > 1.5), events: d.events.splice(0) }, null, 2));
      const fps = frames.length / length;
      const line = `${section.id.padEnd(12)} ${length.toFixed(1).padStart(5)}s for ${t.length.toFixed(1)}s of voice · ${fps.toFixed(0)} fps${length > t.length + 1 ? ' · runs long (compose fast-forwards the waits)' : ''}${warnings.length ? ` · ⚠️ ${warnings.join('; ')}` : ''}`;
      report.push(line);
      console.log(line);
    }
    if (section.id === opts.until) break;
  }

  await browser.close();
  await api('/api/reset');
  await api('/api/settings', { agentMode: originalMode }, 'PUT');
  if (errors.length) console.log(`Page errors:\n  ${[...new Set(errors)].join('\n  ')}`);
  writeFileSync(`${SCREEN}/report.txt`, report.join('\n'));
}

if (isMain(import.meta.url)) {
  const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
  const until = process.argv.find((a) => a.startsWith('--until='))?.slice(8);
  const from = process.argv.find((a) => a.startsWith('--from='))?.slice(7);
  await record({ headed: process.argv.includes('--headed'), only, until, from });
}
