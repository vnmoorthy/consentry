// Consentry pitch deck — generated with pptxgenjs, then animated by animate.py (Morph + entrance effects).
// Element names drive the motion: "!!orb" / "!!logo" morph between slides; "anim-<step>-<effect>-…" build in.
import pptxgen from 'pptxgenjs';
import QRCode from 'qrcode';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
const THEME_SCRIPT = process.env.PPTX_APPLY_THEME;
const OUT = '../Consentry-pitch.pptx';
const M = 'media/';

const THEME = {
  name: 'Consentry Ember Horizon',
  headFontFace: 'Calibri',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: '0E0F0C', lt1: 'FFFFFF', dk2: '1A1B17', lt2: 'CDC7BB',
    accent1: 'EFA56F', accent2: 'F6D8B4', accent3: 'FBBF24', accent4: 'FB7185', accent5: '60A5FA', accent6: '34D399',
    hlink: 'EFA56F', folHlink: 'F6D8B4',
  },
};
const HEX = { ink: '0E0F0C', panel: '1A1B17', panel2: '22231E', line: '33342E', muted: 'A7A196', soft: 'CDC7BB', white: 'FFFFFF', mint: 'EFA56F', violet: 'F6D8B4', amber: 'FBBF24', rose: 'FB7185', sky: '60A5FA', green: '34D399' };

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = 'Consentry — the consent firewall for AI agents';
pres.subject = 'National Renaissance Hackathon at super{set}';
pres.author = 'vnmoorthy';
pres.company = 'Consentry';
const C = pres.SchemeColor;

// ── Layouts ────────────────────────────────────────────────────────────────
pres.defineSlideMaster({
  title: 'COVER',
  background: { path: M + 'bg-cover.png' },
  objects: [],
});
pres.defineSlideMaster({
  title: 'CONTENT',
  background: { path: M + 'bg-content.png' },
  margin: [0.5, 0.6, 0.6, 0.6],
  objects: [
    { placeholder: { options: { name: 'kicker', type: 'body', x: 0.6, y: 0.42, w: 10.8, h: 0.34, fontSize: 12, bold: true, color: C.accent1, charSpacing: 3, margin: 0, valign: 'middle' }, text: '' } },
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.78, w: 11.2, h: 0.85, fontSize: 34, bold: true, color: C.background1, margin: 0, valign: 'middle', align: 'left' }, text: '' } },
    { text: { text: 'C O N S E N T R Y   ·   the consent firewall for AI agents', options: { x: 0.6, y: 7.02, w: 6, h: 0.3, fontSize: 10, color: '77736A', margin: 0, isTextBox: true } } },
  ],
  slideNumber: { x: 12.35, y: 7.02, w: 0.4, h: 0.3, fontSize: 10, color: '77736A', align: 'right' },
});

// ── Helpers ────────────────────────────────────────────────────────────────
const orb = (s, x, y, size = 6.5) => s.addImage({ path: M + 'orb.png', x, y, w: size, h: size, objectName: '!!orb', transparency: 10 });
const logo = (s, x = 12.12, y = 0.36, size = 0.62) => s.addImage({ path: M + 'logo.png', x, y, w: size, h: size, objectName: '!!logo' });
const header = (s, kicker, title) => {
  s.addText(kicker, { placeholder: 'kicker' });
  s.addText(title, { placeholder: 'title' });
};
const card = (s, name, x, y, w, h, fill = HEX.panel, line = HEX.line) =>
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.14, fill: { color: fill, transparency: 8 }, line: { color: line, width: 1 }, objectName: name });
const text = (s, name, t, o) => s.addText(t, { isTextBox: true, margin: 0, color: HEX.white, fontSize: 15, ...o, objectName: name });
const dot = (s, name, x, y, d, color, label, fontSize = 15) => {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color, transparency: 78 }, line: { color, width: 1.25 }, objectName: name + '-c' });
  if (label) s.addText(label, { x, y, w: d, h: d, align: 'center', valign: 'middle', fontSize, bold: true, color, margin: 0, isTextBox: true, objectName: name + '-t' });
};
const pill = (s, name, t, x, y, w, color) => {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.42, rectRadius: 0.21, fill: { color, transparency: 86 }, line: { color, width: 1 }, objectName: name + '-bg' });
  s.addText(t, { x, y, w, h: 0.42, align: 'center', valign: 'middle', fontSize: 13, bold: true, color, margin: 0, isTextBox: true, objectName: name + '-t' });
};
const frame = (s, name, path, x, y, w, h) => {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - 0.06, y: y - 0.06, w: w + 0.12, h: h + 0.12, rectRadius: 0.12, fill: { color: HEX.panel }, line: { color: '3A3A33', width: 1 }, shadow: { type: 'outer', color: 'EFA56F', opacity: 0.22, blur: 24, offset: 0, angle: 90 }, objectName: name + '-frame' });
  s.addImage({ path, x, y, w, h, objectName: name });
};

// ── 1 · Cover ──────────────────────────────────────────────────────────────
pres.addSection({ title: 'Opening' });
{
  const s = pres.addSlide({ masterName: 'COVER', sectionTitle: 'Opening' });
  orb(s, 7.6, -1.6, 7.5);
  logo(s, 0.7, 0.9, 1.05);
  text(s, 'anim-1-fade-wordmark', 'C O N S E N T R Y', { x: 1.95, y: 1.18, w: 4.5, h: 0.5, fontSize: 22, color: HEX.white, charSpacing: 4 });
  text(s, 'anim-1-fade-kicker', 'NATIONAL RENAISSANCE HACKATHON  ·  SUPER{SET}', { x: 0.7, y: 2.2, w: 6.2, h: 0.35, fontSize: 13, bold: true, color: HEX.mint, charSpacing: 3 });
  text(s, 'anim-2-rise-title', [
    { text: 'The consent firewall', options: { breakLine: true } },
    { text: 'for AI agents', options: { color: HEX.mint } },
  ], { x: 0.7, y: 2.65, w: 6.6, h: 1.85, fontSize: 52, bold: true, valign: 'top' });
  text(s, 'anim-3-fade-sub', "Your agent can use the world's public data. The world can't use yours.", { x: 0.7, y: 4.6, w: 6.0, h: 0.85, fontSize: 20, color: HEX.soft, valign: 'top' });
  pill(s, 'anim-4-rise-p1', 'Track 1 · Public Data APIs', 0.7, 5.75, 2.95, HEX.sky);
  pill(s, 'anim-4-rise-p2', 'Track 2 · Personal Agents & Privacy', 3.8, 5.75, 3.6, HEX.violet);
  frame(s, 'anim-5-zoom-shot', M + 'command-live.jpg', 7.35, 1.35, 5.45, 3.41);
  text(s, 'anim-6-fade-link', 'github.com/vnmoorthy/consentry   ·   vnmoorthy.github.io/consentry', { x: 7.35, y: 4.98, w: 5.45, h: 0.35, fontSize: 12, color: HEX.muted, align: 'right' });
  [['12', 'live public-data APIs', HEX.mint], ['19', 'firewalled MCP tools', HEX.violet], ['5/5', 'red-team attacks contained', HEX.green]].forEach(([n, l, col], i) => {
    const x = 0.7 + i * 2.35;
    text(s, `anim-7-rise-sn${i}`, n, { x, y: 6.35, w: 2.2, h: 0.55, fontSize: 30, bold: true, color: col, valign: 'middle' });
    text(s, `anim-7-rise-sl${i}`, l, { x, y: 6.88, w: 2.2, h: 0.3, fontSize: 12, color: HEX.muted });
  });
  s.addNotes(
    "Every agent demo you'll see today asks you to hand over your life: your address, your card, your diagnosis. Then it sends that data to whatever tool it feels like calling. We built Consentry, a consent firewall for AI agents. Your agent can use the world's public data. The world can't use yours.",
  );
}

// ── 2 · Problem ────────────────────────────────────────────────────────────
pres.addSection({ title: 'Problem' });
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Problem' });
  orb(s, -2.6, 3.2, 6.5);
  logo(s);
  header(s, 'THE PROBLEM', 'Agents now hold the keys to your life');
  const rows = [
    ['1', HEX.rose, 'All-or-nothing context', 'Once your address, card or diagnosis is in the context window, every tool, partner and model provider it touches can receive it.'],
    ['2', HEX.amber, 'Tool output can hijack the agent', 'One poisoned review or web page can tell the agent to send your data somewhere else. That is indirect prompt injection.'],
    ['3', HEX.violet, 'No proof, no recourse', 'Nobody can show what was shared, with whom, or why. Consent today is a banner you clicked once.'],
  ];
  rows.forEach(([n, col, h, b], i) => {
    const y = 1.95 + i * 1.6;
    dot(s, `anim-${i + 1}-rise-n${n}`, 0.6, y, 0.62, col, n, 18);
    text(s, `anim-${i + 1}-rise-h${n}`, h, { x: 1.45, y: y - 0.04, w: 5.0, h: 0.42, fontSize: 20, bold: true });
    text(s, `anim-${i + 1}-rise-b${n}`, b, { x: 1.45, y: y + 0.42, w: 5.1, h: 0.95, fontSize: 15, color: HEX.soft, valign: 'top' });
  });
  // diagram: your data → agent → everyone
  card(s, 'anim-4-fade-diag', 6.95, 1.85, 5.8, 4.75, HEX.panel);
  const data = ['SSN', 'Real card', 'Home address', 'Anxiety meds'];
  const dest = ['Weather API', 'Restaurant app', 'Pharmacy', 'telemetry-cdn.io'];
  data.forEach((d, i) => {
    const y = 2.35 + i * 1.0;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.2, y, w: 1.55, h: 0.48, rectRadius: 0.24, fill: { color: HEX.rose, transparency: 85 }, line: { color: HEX.rose, width: 1 }, objectName: `anim-5-fade-d${i}` });
    s.addText(d, { x: 7.2, y, w: 1.55, h: 0.48, align: 'center', valign: 'middle', fontSize: 13, bold: true, color: 'FDA4AF', margin: 0, isTextBox: true, objectName: `anim-5-fade-dt${i}` });
    const y2 = 2.35 + i * 1.0;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 10.95, y: y2, w: 1.6, h: 0.48, rectRadius: 0.1, fill: { color: HEX.panel2 }, line: { color: i === 3 ? HEX.rose : '3A3A33', width: 1 }, objectName: `anim-7-fade-r${i}` });
    s.addText(d === 'Anxiety meds' ? dest[i] : dest[i], { x: 10.95, y: y2, w: 1.6, h: 0.48, align: 'center', valign: 'middle', fontSize: 12, color: i === 3 ? 'FDA4AF' : HEX.soft, margin: 0, isTextBox: true, objectName: `anim-7-fade-rt${i}` });
  });
  s.addShape(pres.shapes.OVAL, { x: 9.25, y: 3.4, w: 1.2, h: 1.2, fill: { color: HEX.violet, transparency: 80 }, line: { color: HEX.violet, width: 1.5 }, objectName: 'anim-6-zoom-agent' });
  s.addText('AI agent', { x: 9.25, y: 3.4, w: 1.2, h: 1.2, align: 'center', valign: 'middle', fontSize: 14, bold: true, color: 'DDD6FE', margin: 0, isTextBox: true, objectName: 'anim-6-zoom-agentt' });
  for (let i = 0; i < 4; i++) {
    const yA = 2.59 + i * 1.0;
    const up = yA > 4.0;
    s.addShape(pres.shapes.LINE, { x: 8.75, y: Math.min(yA, 4.0), w: 0.5, h: Math.abs(4.0 - yA) || 0.01, line: { color: HEX.rose, width: 1.25 }, flipV: up, objectName: `anim-6-fade-l${i}` });
    s.addShape(pres.shapes.LINE, { x: 10.45, y: Math.min(yA, 4.0), w: 0.5, h: Math.abs(4.0 - yA) || 0.01, line: { color: HEX.rose, width: 1.25, endArrowType: 'triangle' }, flipV: !up, objectName: `anim-7-fade-m${i}` });
  }
  text(s, 'anim-8-fade-cap', 'Today: whatever is in context can go anywhere.', { x: 7.2, y: 6.12, w: 5.4, h: 0.35, fontSize: 13, italic: true, color: HEX.muted });
  s.addNotes(
    'Agents are going from chatbots to doers: they book, buy, refill and ride. But context is all or nothing. Whatever the agent knows, every tool it calls can learn, and so can the model provider. One poisoned web page can redirect it. And afterwards nobody can prove what was shared.',
  );
}

// ── 3 · Insight ────────────────────────────────────────────────────────────
pres.addSection({ title: 'Solution' });
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Solution' });
  orb(s, 7.2, 0.4, 6.8);
  logo(s, 11.1, 1.72, 1.2);
  header(s, 'THE INSIGHT', "Don't trust the model. Enforce at the boundary");
  text(s, 'anim-1-fade-lead', 'Consentry sits between your agent and everything it talks to (tools, partners, MCP servers, even the LLM) and decides what leaves, field by field.', { x: 0.6, y: 1.85, w: 10.0, h: 0.9, fontSize: 18, color: HEX.soft, valign: 'top' });
  const left = ['Agent sees your raw data', 'Every tool gets everything', 'Consent is a banner', 'Logs you have to trust'];
  const right = ['Agent sees only vault tokens', 'Each field judged per recipient & purpose', 'Consent in-flow, minimized by default', 'SHA-256 hash-chained receipts'];
  card(s, 'anim-2-rise-cl', 0.6, 3.0, 5.6, 3.55, HEX.panel);
  text(s, 'anim-2-rise-tl', 'TODAY', { x: 0.95, y: 3.25, w: 3, h: 0.35, fontSize: 13, bold: true, color: HEX.rose, charSpacing: 3 });
  left.forEach((t, i) => text(s, `anim-2-rise-l${i}`, '✕   ' + t, { x: 0.95, y: 3.8 + i * 0.62, w: 5.1, h: 0.45, fontSize: 16, color: HEX.soft }));
  card(s, 'anim-3-rise-cr', 6.55, 3.0, 6.2, 3.55, '241A12', 'EFA56F');
  text(s, 'anim-3-rise-tr', 'WITH CONSENTRY', { x: 6.9, y: 3.25, w: 4, h: 0.35, fontSize: 13, bold: true, color: HEX.mint, charSpacing: 3 });
  right.forEach((t, i) => text(s, `anim-3-rise-r${i}`, '✓   ' + t, { x: 6.9, y: 3.8 + i * 0.62, w: 5.7, h: 0.45, fontSize: 16, bold: true }));
  s.addNotes(
    "Our principle: don't trust the model, enforce at the boundary. A model that usually refuses is not a control. Consentry is a single choke point. Every field in every request is classified and judged on data type, recipient and purpose. The LLM is treated as a recipient too, so it only sees tokens.",
  );
}

// ── 4 · How it works ───────────────────────────────────────────────────────
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Solution' });
  orb(s, -2.2, -1.5, 6.0);
  logo(s);
  header(s, 'HOW IT WORKS', 'One choke point for every byte that leaves');
  const effects = [
    ['ALLOW', HEX.green, 'Your VIN → NHTSA, to check safety recalls'],
    ['MINIMIZE', HEX.amber, 'Home GPS → ~10 km grid for weather APIs'],
    ['ASK', HEX.sky, 'Allergy → TableTap? You decide, mid-run'],
    ['DENY', HEX.rose, 'SSN, real card, mental health: never'],
  ];
  effects.forEach(([e, col, d], i) => {
    const y = 1.9 + i * 1.12;
    card(s, `anim-${i + 1}-rise-e${i}`, 0.6, y, 4.75, 0.95, HEX.panel);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.82, y: y + 0.27, w: 1.25, h: 0.42, rectRadius: 0.21, fill: { color: col, transparency: 82 }, line: { color: col, width: 1 }, objectName: `anim-${i + 1}-rise-ep${i}` });
    s.addText(e, { x: 0.82, y: y + 0.27, w: 1.25, h: 0.42, align: 'center', valign: 'middle', fontSize: 12, bold: true, color: col, margin: 0, isTextBox: true, charSpacing: 2, objectName: `anim-${i + 1}-rise-et${i}` });
    text(s, `anim-${i + 1}-rise-ed${i}`, d, { x: 2.25, y: y + 0.1, w: 3.0, h: 0.75, fontSize: 14, color: HEX.soft, valign: 'middle' });
  });
  frame(s, 'anim-5-zoom-flow', M + 'flowmap-crop.png', 5.85, 1.95, 6.85, 3.65);
  text(s, 'anim-6-fade-det', 'Detects your data via vault fingerprints · tokens · checksums (Luhn, SSN) · health lexicon · geo-proximity', { x: 5.85, y: 5.85, w: 6.85, h: 0.7, fontSize: 14, color: HEX.muted, valign: 'top' });
  s.addNotes(
    'Four outcomes per field. Allow: my VIN goes to NHTSA for recalls. Minimize: my exact GPS becomes a 10-kilometer grid for the weather API. Ask: the agent pauses and I decide. Deny: my SSN, real card and mental-health data never leave. This is the live data-flow map from the product. Every packet is a field, colored by its fate.',
  );
}

// ── 5 · Minimization ───────────────────────────────────────────────────────
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Solution' });
  orb(s, 9.6, 3.6, 6.0);
  logo(s);
  header(s, 'DATA MINIMIZATION', 'Share the least that still gets the job done');
  const hdr = (t) => ({ text: t, options: { bold: true, color: HEX.mint, fontSize: 12, fill: { color: '241A12' } } });
  const row = (a, b, c, d, col = HEX.amber) => [
    { text: a, options: { bold: true, color: HEX.white } },
    { text: b, options: { color: HEX.muted, fontFace: 'Courier New', fontSize: 12 } },
    { text: c, options: { color: col, fontFace: 'Courier New', fontSize: 12, bold: true } },
    { text: d, options: { color: HEX.soft } },
  ];
  s.addTable(
    [
      [hdr('Your data'), hdr('In your vault'), hdr('What they actually get'), hdr('Recipient')],
      row('Home GPS', '37.7612,-122.4148', '37.8,-122.4  (≈10 km)', 'Open-Meteo, USGS'),
      row('Home address', '88 Larkspur Alley…', 'Mission District, SF', 'BiteFinder'),
      row('Phone', '(415) 555-0142', '+1 (628) 555-0606 relay', 'TableTap'),
      row('Card', '•••• 4242', 'single-use virtual card', 'TableTap'),
      row('Birthday', '1991-04-12', 'age 35–39', 'QuickQuote'),
      row('Allergy', 'Severe peanut allergy', 'Peanut-free meal required', 'TableTap'),
      row('Medication', 'Albuterol (ProAir)', 'albuterol', 'openFDA'),
      row('SSN', '078-05-1120', 'never leaves', 'anyone', HEX.rose),
    ],
    { x: 0.6, y: 1.9, w: 8.55, colW: [1.45, 2.4, 2.75, 1.95], fontSize: 13, color: HEX.soft, fill: { color: HEX.panel }, border: { type: 'solid', pt: 0.75, color: '33342E' }, rowH: 0.5, valign: 'middle', margin: [0, 0.1, 0, 0.12], objectName: 'anim-1-fade-table' },
  );
  card(s, 'anim-2-zoom-call', 9.55, 1.9, 3.2, 4.5, HEX.panel, HEX.amber);
  text(s, 'anim-2-zoom-ct', 'QuickQuote asked for 8 fields to give a car-insurance quote.', { x: 9.85, y: 2.15, w: 2.65, h: 1.1, fontSize: 15, bold: true, valign: 'top' });
  const stats = [['2', 'exact (with your OK)', HEX.green], ['4', 'minimized', HEX.amber], ['2', 'withheld', HEX.rose]];
  stats.forEach(([n, l, col], i) => {
    text(s, `anim-3-rise-sn${i}`, n, { x: 9.85, y: 3.35 + i * 0.78, w: 0.7, h: 0.7, fontSize: 40, bold: true, color: col, valign: 'middle' });
    text(s, `anim-3-rise-sl${i}`, l, { x: 10.6, y: 3.35 + i * 0.78, w: 2.0, h: 0.7, fontSize: 14, color: HEX.soft, valign: 'middle' });
  });
  text(s, 'anim-4-fade-cq', 'The quote still came back. They never needed your SSN.', { x: 9.85, y: 5.7, w: 2.7, h: 0.6, fontSize: 13, italic: true, color: HEX.muted, valign: 'top' });
  s.addNotes(
    "Minimizers keep the task working while shrinking what leaves. Exact GPS becomes a 10-km grid. My phone and email become relay aliases. My card becomes a single-use, merchant-locked virtual card. My allergy becomes 'peanut-free meal required', not a diagnosis. An insurance API asked for eight fields. It got two exact, four minimized, two withheld, and still produced the quote.",
  );
}

// ── 6 · Consent + receipts ─────────────────────────────────────────────────
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Solution' });
  orb(s, 3.5, 3.8, 6.0);
  logo(s);
  header(s, 'CONSENT & PROOF', 'Consent you can feel. Receipts you can verify');
  frame(s, 'anim-1-rise-consent', M + 'consent-crop.png', 0.65, 1.9, 3.95, 4.95);
  frame(s, 'anim-2-rise-receipt', M + 'receipt-crop.png', 4.95, 1.75, 2.5, 5.08);
  const pts = [
    [HEX.sky, 'The agent pauses mid-run', 'No pre-checked boxes. You see exact vs. minimized side by side, plus the recipient’s retention.'],
    [HEX.green, 'Grants that expire', '“30 days” creates a scoped grant (data × recipient × purpose) you can revoke any time.'],
    [HEX.violet, 'A receipt for every run', 'What left, in what form, to whom, and what was withheld.'],
    [HEX.mint, 'Tamper-evident ledger', 'SHA-256 chain over canonical JSON. Edit one entry and verification fails from there.'],
  ];
  pts.forEach(([col, h, b], i) => {
    const y = 1.95 + i * 1.2;
    dot(s, `anim-${3 + i}-rise-pd${i}`, 7.85, y + 0.02, 0.44, col, String(i + 1), 14);
    text(s, `anim-${3 + i}-rise-ph${i}`, h, { x: 8.45, y, w: 4.3, h: 0.4, fontSize: 17, bold: true });
    text(s, `anim-${3 + i}-rise-pb${i}`, b, { x: 8.45, y: y + 0.4, w: 4.3, h: 0.72, fontSize: 13.5, color: HEX.soft, valign: 'top' });
  });
  s.addNotes(
    "When it matters, the agent stops and asks. Exact versus minimized, side by side, with the partner's own retention policy. Choose minimized, once, thirty days, or deny. Every run prints a privacy receipt, and every decision is hash-chained, so if anyone edits history we catch it.",
  );
}

// ── 7 · Live demo / public data ────────────────────────────────────────────
pres.addSection({ title: 'Demo' });
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Demo' });
  orb(s, 8.8, -1.2, 6.5);
  logo(s);
  header(s, 'LIVE DEMO · TRACK 1', 'Real public data, flowing through the firewall');
  frame(s, 'anim-1-zoom-gif', M + 'demo.gif', 0.65, 1.9, 7.6, 4.75);
  const groups = [
    ['Government (.gov)', HEX.sky, ['National Weather Service alerts', 'USGS earthquakes', 'NHTSA VIN decode + recalls', 'openFDA drug & food recalls, labels', 'OpenFEMA disaster declarations']],
    ['Open data', HEX.mint, ['Open-Meteo forecast, air quality, geocoding', 'Wikipedia']],
  ];
  let y = 1.9;
  groups.forEach(([g, col, items], gi) => {
    text(s, `anim-${2 + gi}-fade-g${gi}`, g.toUpperCase(), { x: 8.7, y, w: 4, h: 0.32, fontSize: 12, bold: true, color: col, charSpacing: 2 });
    y += 0.4;
    items.forEach((it, i) => {
      text(s, `anim-${2 + gi}-rise-i${gi}${i}`, it, { x: 8.7, y, w: 4.05, h: 0.34, fontSize: 14, color: HEX.white, bullet: { indent: 14 } });
      y += 0.36;
    });
    y += 0.16;
  });
  card(s, 'anim-4-rise-nk', 8.7, 5.68, 4.05, 0.98, '241A12', 'EFA56F');
  text(s, 'anim-4-rise-nkt', 'No keys, no accounts. 12 live APIs, and they only ever see a coarsened location.', { x: 8.9, y: 5.72, w: 3.7, h: 0.9, fontSize: 13.5, color: HEX.soft, valign: 'middle' });
  s.addNotes(
    'This is the real product. The weather, air quality, alerts, earthquakes, vehicle and drug recalls are live from twelve public APIs: NWS, USGS, NHTSA, openFDA, OpenFEMA, Open-Meteo and Wikipedia. Watch the booking: TableTap gets my real name, a relay phone, a relay email and a single-use card. My allergy goes out as a dietary need only after I approve it.',
  );
}

// ── 8 · Red team ───────────────────────────────────────────────────────────
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Demo' });
  orb(s, -1.8, 2.8, 6.4);
  logo(s);
  header(s, 'RED TEAM', 'We attacked our own agent');
  text(s, 'anim-1-zoom-big', '5/5', { x: 0.6, y: 1.8, w: 4.2, h: 1.9, fontSize: 110, bold: true, color: HEX.mint, valign: 'middle' });
  text(s, 'anim-2-fade-bl', 'attacks contained', { x: 0.65, y: 3.65, w: 4.2, h: 0.5, fontSize: 24, bold: true });
  text(s, 'anim-3-fade-bp', 'Even a simulated compromised agent that obeys injected instructions can’t move the SSN, the real card or mental-health data. Those bytes never cross the boundary.', { x: 0.65, y: 4.3, w: 4.1, h: 1.9, fontSize: 15, color: HEX.soft, valign: 'top' });
  const attacks = [
    ['Poisoned restaurant review', 'Hidden HTML comment orders exfiltration → quarantined (score 1.0), run tainted, exfil call blocked'],
    ['Zero-click image exfiltration', 'Markdown image smuggles email + vault token → URL stripped, token neutralized'],
    ['Secrets pasted into the prompt', 'Model receives {{vault:card}} and [Government ID withheld]'],
    ['Over-collecting partner', '8 fields asked → 2 exact, 4 minimized, 2 withheld; the quote still works'],
    ['Rewrite the audit log', 'Hash mismatch detected at the exact edited entry'],
  ];
  attacks.forEach(([h, b], i) => {
    const y = 1.85 + i * 0.97;
    card(s, `anim-${4 + i}-rise-a${i}`, 5.2, y, 7.55, 0.85, HEX.panel);
    dot(s, `anim-${4 + i}-rise-ad${i}`, 5.4, y + 0.2, 0.45, HEX.green, '✓', 14);
    text(s, `anim-${4 + i}-rise-ah${i}`, h, { x: 6.05, y: y + 0.07, w: 6.5, h: 0.36, fontSize: 15.5, bold: true });
    text(s, `anim-${4 + i}-rise-ab${i}`, b, { x: 6.05, y: y + 0.42, w: 6.55, h: 0.38, fontSize: 12.5, color: HEX.soft });
  });
  s.addNotes(
    "We didn't just build defenses, we attacked them. A restaurant review hides instructions to send my SSN to a tracking domain, and we simulate an agent that actually obeys. Ingress quarantine catches it, the run is tainted, default-deny egress blocks the domain, and hard lines hold. Five attacks, five contained.",
  );
}

// ── 9 · Architecture ───────────────────────────────────────────────────────
pres.addSection({ title: 'Build' });
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Build' });
  orb(s, 9.5, 3.5, 5.5);
  logo(s);
  header(s, 'ARCHITECTURE', 'One TypeScript core. Runs everywhere');
  frame(s, 'anim-1-zoom-arch', '../../assets/architecture.png', 0.65, 1.85, 8.25, 5.05);
  const pts = [
    ['Isomorphic core', 'Same engine in Node and the browser (WebCrypto)'],
    ['Gateway', 'Hono · SSE · SQLite · AES-256-GCM vault'],
    ['Local-first', 'The live demo has no backend at all'],
    ['MCP server', 'Claude Desktop, Claude Code, Cursor'],
    ['Claude or Autopilot', 'LLM optional; tokens only'],
  ];
  pts.forEach(([h, b], i) => {
    const y = 1.9 + i * 0.98;
    text(s, `anim-${2 + i}-rise-h${i}`, h, { x: 9.3, y, w: 3.45, h: 0.38, fontSize: 16, bold: true, color: i % 2 ? HEX.violet : HEX.mint });
    text(s, `anim-${2 + i}-rise-b${i}`, b, { x: 9.3, y: y + 0.38, w: 3.45, h: 0.5, fontSize: 13, color: HEX.soft, valign: 'top' });
  });
  s.addNotes(
    "Under the hood: one isomorphic TypeScript core that runs in Node and in the browser. A Hono gateway with server-sent events, an SQLite ledger and an AES-256-GCM vault. An MCP bridge so Claude Desktop, Claude Code or Cursor can route tool calls through it. And a local-first mode, so the live demo has no backend at all.",
  );
}

// ── 10 · Business + ask ────────────────────────────────────────────────────
pres.addSection({ title: 'Close' });
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Close' });
  orb(s, 3.2, -2.4, 7.0);
  logo(s);
  header(s, 'WHY NOW · BUSINESS', 'Consent management for the agent era');
  const tiers = [
    ['Open source', 'Free', HEX.mint, 'Firewall, MCP server, ledger, local-first app. Developers adopt it bottom-up.'],
    ['Team gateway', 'Per agent seat', HEX.violet, 'Shared policies, SSO, SIEM export, per-agent data budgets, consent inbox.'],
    ['Enterprise', 'Annual', HEX.amber, 'HIPAA "minimum necessary" & CCPA policy packs, ledger anchoring, deletion-request automation.'],
  ];
  tiers.forEach(([h, p, col, b], i) => {
    const x = 0.6 + i * 4.1;
    card(s, `anim-${1 + i}-rise-t${i}`, x, 1.9, 3.85, 2.45, HEX.panel);
    text(s, `anim-${1 + i}-rise-th${i}`, h, { x: x + 0.3, y: 2.12, w: 3.3, h: 0.45, fontSize: 20, bold: true, color: col });
    text(s, `anim-${1 + i}-rise-tp${i}`, p.toUpperCase(), { x: x + 0.3, y: 2.58, w: 3.3, h: 0.3, fontSize: 11, bold: true, color: HEX.muted, charSpacing: 2 });
    text(s, `anim-${1 + i}-rise-tb${i}`, b, { x: x + 0.3, y: 2.98, w: 3.3, h: 1.25, fontSize: 14, color: HEX.soft, valign: 'top' });
  });
  text(s, 'anim-4-fade-why', 'Privacy law already demands purpose limitation and data minimization. Autonomous agents make both impossible without a boundary. Consentry is that boundary, and every decision comes with proof.', { x: 0.6, y: 4.7, w: 8.3, h: 1.1, fontSize: 16, color: HEX.soft, valign: 'top' });
  text(s, 'anim-5-rise-close', 'Your data. Your rules. Your receipt.', { x: 0.6, y: 5.95, w: 8.3, h: 0.6, fontSize: 26, bold: true, color: HEX.white });
  const qr = await QRCode.toDataURL('https://vnmoorthy.github.io/consentry/', { margin: 1, width: 600, color: { dark: '0E0F0CFF', light: 'FFFFFFFF' } });
  card(s, 'anim-6-zoom-qrbg', 9.55, 4.55, 3.2, 2.3, 'FFFFFF', 'FFFFFF');
  s.addImage({ data: qr.replace('data:', ''), x: 9.7, y: 4.7, w: 2.0, h: 2.0, objectName: 'anim-6-zoom-qr' });
  text(s, 'anim-6-zoom-qrt', 'Try the live demo', { x: 11.75, y: 4.8, w: 0.95, h: 1.8, fontSize: 12, bold: true, color: HEX.ink, valign: 'middle' });
  text(s, 'anim-7-fade-links', 'github.com/vnmoorthy/consentry', { x: 9.55, y: 6.92, w: 3.2, h: 0.3, fontSize: 11, color: HEX.muted, align: 'center' });
  s.addNotes(
    "Why now? Agents are shipping into every app, and privacy law already demands purpose limitation and minimization. Without a boundary like this, agents can't comply. Our model is an open-source core, a team gateway, and enterprise policy packs and anchoring. It's open source today; scan to try it. Your data, your rules, your receipt.",
  );
}

await pres.writeFile({ fileName: OUT });
if (THEME_SCRIPT && existsSync(THEME_SCRIPT)) {
  const { applyTheme } = require(THEME_SCRIPT);
  await applyTheme(OUT, THEME);
  console.log('theme applied');
}
console.log('wrote', OUT);
