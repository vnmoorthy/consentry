// Turns the presenter's take into an edit: what to keep, where each section starts, and when each word lands.
// Usage: `pnpm tsx scripts/video/timeline.ts` (after transcribe.py) → video/build/timeline.json
//
// 1. Aligns the word-level transcript to the script (fuzzy Needleman–Wunsch), so ad-libs and
//    skipped words don't throw the timing off.
// 2. Applies the stumble cuts listed in video/edit.json, snapping each cut to the quietest 10 ms
//    nearby so the joins are inaudible.
// 3. Places section boundaries in the pauses between the last word of one section and the first of
//    the next, and gives every script word a time on the output timeline (for the screen recorder).
// 4. Writes caption cues from what was actually said, spelled the way the script spells it.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { BUILD, findRecording, isMain, loadScript, sh, words as splitWords } from './lib';

/** Silence before the first word, while the opening shot settles. */
export const PRE_ROLL = 1.2;
/** How long the last word rings before the end card. */
const TAIL = 0.9;

interface Word { word: string; start: number; end: number }
export interface Timeline {
  source: string;
  /** Kept ranges of the source recording, in order. */
  keep: [number, number][];
  /** Output time = PRE_ROLL + (time within the kept ranges) / speed. */
  preRoll: number;
  speed: number;
  duration: number;
  sections: { id: string; start: number; end: number; words: number[] }[];
  captions: { start: number; end: number; words: { text: string; start: number; end: number }[] }[];
}

const NUMBERS: Record<string, string> = { '15': 'fifteen', '30': 'thirty', '10': 'ten', '5': 'five' };
const norm = (w: string) => {
  const s = w.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9']/g, '');
  return NUMBERS[s] ?? s;
};

function similarity(a: string, b: string) {
  if (a === b) return 1;
  if (a.length < 3 || b.length < 3) return 0;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - dp[a.length][b.length] / Math.max(a.length, b.length);
}

/** Global alignment; returns transcript index for each script word (or -1). */
function align(script: string[], heard: string[]): number[] {
  const n = script.length;
  const m = heard.length;
  const GAP = -1;
  const score = new Float64Array((n + 1) * (m + 1));
  const move = new Uint8Array((n + 1) * (m + 1)); // 1 diag, 2 up (skip script), 3 left (skip heard)
  const at = (i: number, j: number) => i * (m + 1) + j;
  for (let i = 1; i <= n; i++) (score[at(i, 0)] = i * GAP), (move[at(i, 0)] = 2);
  for (let j = 1; j <= m; j++) (score[at(0, j)] = j * GAP), (move[at(0, j)] = 3);
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) {
      const sim = similarity(script[i - 1], heard[j - 1]);
      const diag = score[at(i - 1, j - 1)] + (sim === 1 ? 3 : sim >= 0.6 ? 1.5 : -1.5);
      const up = score[at(i - 1, j)] + GAP;
      const left = score[at(i, j - 1)] + GAP;
      const best = Math.max(diag, up, left);
      score[at(i, j)] = best;
      move[at(i, j)] = best === diag ? 1 : best === up ? 2 : 3;
    }
  const out = new Array(n).fill(-1);
  for (let i = n, j = m; i > 0 || j > 0; ) {
    const mv = move[at(i, j)];
    if (mv === 1) {
      if (similarity(script[i - 1], heard[j - 1]) >= 0.6) out[i - 1] = j - 1;
      i--, j--;
    } else if (mv === 2) i--;
    else j--;
  }
  return out;
}

/** 10 ms RMS envelope of the recording's audio. */
function envelope(file: string): Float32Array {
  const raw = `${BUILD}/voice-env.s16`;
  sh('ffmpeg', ['-v', 'error', '-y', '-i', file, '-vn', '-ac', '1', '-ar', '16000', '-f', 's16le', raw]);
  const buf = readFileSync(raw);
  const pcm = new Int16Array(buf.buffer, buf.byteOffset, buf.length >> 1);
  const env = new Float32Array(Math.floor(pcm.length / 160));
  for (let f = 0; f < env.length; f++) {
    let s = 0;
    for (let k = f * 160; k < f * 160 + 160; k++) s += pcm[k] * pcm[k];
    env[f] = Math.sqrt(s / 160);
  }
  return env;
}

/** The quietest point within ±win seconds of t. */
function quietest(env: Float32Array, t: number, win = 0.12) {
  let best = Math.round(t * 100);
  for (let f = Math.max(0, Math.round((t - win) * 100)); f <= Math.min(env.length - 1, Math.round((t + win) * 100)); f++) {
    // Smooth over 30 ms so we land in a real gap, not between two cycles of a vowel.
    const e = (env[f - 1] ?? env[f]) + env[f] + (env[f + 1] ?? env[f]);
    const b = (env[best - 1] ?? env[best]) + env[best] + (env[best + 1] ?? env[best]);
    if (e < b) best = f;
  }
  return best / 100;
}

export function buildTimeline(file: string): Timeline {
  const script = loadScript();
  const transcriptFile = existsSync(`${BUILD}/transcript-medium.json`) ? `${BUILD}/transcript-medium.json` : `${BUILD}/transcript.json`;
  const heard: Word[] = JSON.parse(readFileSync(transcriptFile, 'utf8')).filter((w: Word) => norm(w.word));
  const edit = existsSync('video/edit.json') ? JSON.parse(readFileSync('video/edit.json', 'utf8')) : { cuts: [] };
  const env = envelope(file);

  // 1 · Align.
  const scriptWords: { section: number; text: string }[] = [];
  script.sections.forEach((s, i) => splitWords(s.say).forEach((text) => scriptWords.push({ section: i, text })));
  const match = align(
    scriptWords.map((w) => norm(w.text)),
    heard.map((w) => norm(w.word)),
  );

  // 2 · Cuts → kept ranges (source seconds).
  const first = heard[0].start;
  const last = heard[heard.length - 1].end;
  const cuts: [number, number][] = (edit.cuts as { from: number; to: number; win?: number }[]).map((c) => [quietest(env, c.from, c.win), quietest(env, c.to, c.win)]);
  cuts.sort((a, b) => a[0] - b[0]);
  const keep: [number, number][] = [];
  let cursor = Math.max(0, quietest(env, first - 0.12, 0.1));
  for (const [a, b] of cuts) {
    if (a > cursor) keep.push([cursor, a]);
    cursor = Math.max(cursor, b);
  }
  keep.push([cursor, Math.min(last + TAIL, env.length / 100)]);

  // Tighten dead air: every silence longer than `longerThan` keeps only `keep` seconds, split
  // around its middle. Silence = 10 ms frames under the noise floor + `aboveFloorDb`.
  const tp = edit.tightenPauses as { longerThan: number; keep: number; aboveFloorDb: number } | undefined;
  let tightened = 0;
  if (tp) {
    const db = Array.from(env, (r) => 20 * Math.log10(r / 32768 + 1e-9));
    const sorted = [...db].sort((a, b) => a - b);
    const thr = sorted[Math.floor(sorted.length * 0.1)] + tp.aboveFloorDb;
    const split: [number, number][] = [];
    for (const [a, b] of keep) {
      let from = a;
      let run = -1;
      for (let f = Math.ceil(a * 100); f <= Math.floor(b * 100); f++) {
        const quiet = db[f] < thr && f / 100 < last;
        if (quiet && run < 0) run = f;
        if (!quiet && run >= 0) {
          const len = (f - run) / 100;
          if (len >= tp.longerThan) {
            const mid = (run + f) / 200;
            split.push([from, mid - tp.keep / 2]);
            from = mid + tp.keep / 2;
            tightened += len - tp.keep;
          }
          run = -1;
        }
      }
      split.push([from, b]);
    }
    keep.splice(0, keep.length, ...split.filter(([a, b]) => b - a > 0.02));
  }
  const speed: number = edit.speed ?? 1;
  const toOut = (t: number) => {
    let acc = 0;
    for (const [a, b] of keep) {
      if (t < a) break;
      if (t <= b) return PRE_ROLL + (acc + (t - a)) / speed;
      acc += b - a;
    }
    return PRE_ROLL + acc / speed;
  };
  // Whisper's word edges are approximate (and it sometimes merges a stutter into one long word):
  // a word survives when its middle does, or when a quarter second of it is still on the timeline.
  const kept = (w: Word) => keep.some(([a, b]) => ((w.start + w.end) / 2 >= a && (w.start + w.end) / 2 <= b) || Math.min(b, w.end) - Math.max(a, w.start) >= 0.25);
  const duration = PRE_ROLL + keep.reduce((s, [a, b]) => s + b - a, 0) / speed;

  // 3 · Word times and section boundaries.
  const K = script.sections.length;
  const times: number[] = scriptWords.map((_, i) => (match[i] >= 0 && kept(heard[match[i]]) ? toOut(heard[match[i]].start) : NaN));
  for (let i = 0; i < times.length; i++) {
    if (!Number.isNaN(times[i])) continue;
    let a = i - 1;
    while (a >= 0 && Number.isNaN(times[a])) a--;
    let b = i + 1;
    while (b < times.length && Number.isNaN(times[b])) b++;
    const ta = a >= 0 ? times[a] : PRE_ROLL;
    const tb = b < times.length ? times[b] : duration - TAIL / speed;
    times[i] = ta + ((tb - ta) * (i - a)) / (b - a);
  }
  const firstHeard: number[] = [];
  const lastHeard: number[] = [];
  for (let s = 0; s < K; s++) {
    const idx = scriptWords.map((w, i) => (w.section === s ? match[i] : -1)).filter((j) => j >= 0);
    firstHeard.push(Math.min(...idx));
    lastHeard.push(Math.max(...idx));
  }
  const bounds = [0];
  for (let s = 1; s < K; s++) {
    // Spoken titles and ad-libs between two sections belong to the next one: cut at the longest pause.
    let bestK = lastHeard[s - 1];
    let bestGap = -1;
    for (let k = lastHeard[s - 1]; k < firstHeard[s]; k++) {
      const gap = heard[k + 1].start - heard[k].end;
      if (gap > bestGap) (bestGap = gap), (bestK = k);
    }
    const next = heard[bestK + 1];
    bounds.push(toOut(next.start) - Math.min(0.35, Math.max(0.05, bestGap * 0.6)));
  }
  bounds.push(duration);
  const sections = script.sections.map((s, i) => ({
    id: s.id,
    start: +bounds[i].toFixed(3),
    end: +bounds[i + 1].toFixed(3),
    words: scriptWords.flatMap((w, k) => (w.section === i ? [+(times[k] - bounds[i]).toFixed(3)] : [])),
  }));

  // 4 · Captions from what was actually said, with product names spelled right.
  const fixes: [RegExp, string][] = (edit.spelling ?? []).map(([a, b]: [string, string]) => [new RegExp(`^${a}$`, 'i'), b]);
  const skip: [number, number][] = (edit.captionSkip ?? []).map((r: number[]) => [r[0], r[1]]);
  const spoken: { text: string; start: number; end: number }[] = [];
  for (const w of heard) {
    const mid = (w.start + w.end) / 2;
    if (!kept(w) || skip.some(([a, b]) => mid >= a && mid <= b)) continue;
    let text = w.word;
    const punct = text.match(/[.,?!:]+$/)?.[0] ?? '';
    for (const [re, to] of fixes) if (re.test(text.slice(0, text.length - punct.length))) text = to + punct;
    if (/^-/.test(text) && spoken.length) {
      spoken[spoken.length - 1].text += text;
      spoken[spoken.length - 1].end = +toOut(w.end).toFixed(3);
      continue;
    }
    spoken.push({ text, start: +toOut(w.start).toFixed(3), end: +toOut(w.end).toFixed(3) });
  }
  // Multi-word mishearings ("card code" → "Claude Code"), then sentence case across the cuts.
  const bare = (t: string) => t.toLowerCase().replace(/[^a-z0-9']/g, '');
  for (const [from, to] of (edit.phrases ?? []) as [string[], string[]][])
    for (let i = 0; i + from.length <= spoken.length; i++)
      if (from.every((f, k) => bare(spoken[i + k].text) === f)) to.forEach((t, k) => (spoken[i + k].text = t + (spoken[i + k].text.match(/[.,?!:]$/)?.[0] ?? '')));
  spoken.forEach((w, i) => {
    if (i === 0 || /[.?!]$/.test(spoken[i - 1].text)) w.text = w.text.charAt(0).toUpperCase() + w.text.slice(1);
  });
  const captions: Timeline['captions'] = [];
  let cur: Timeline['captions'][number] | null = null;
  for (const w of spoken) {
    const len = cur ? cur.words.map((x) => x.text).join(' ').length : 0;
    const prev = cur?.words[cur.words.length - 1];
    const brk = !cur || len + 1 + w.text.length > 34 || w.start - prev!.end > 0.55 || (/[.?!]$/.test(prev!.text) && len > 10) || w.start - cur.start > 3.2;
    if (brk) {
      cur = { start: w.start, end: w.end, words: [] };
      captions.push(cur);
    }
    cur!.words.push(w);
    cur!.end = w.end;
  }
  captions.forEach((c, i) => (c.end = +Math.min(c.end + 0.35, captions[i + 1]?.start ?? duration).toFixed(3)));

  // Report.
  const matched = match.filter((j) => j >= 0).length;
  console.log(`Transcript: ${transcriptFile} · ${heard.length} words heard · ${matched}/${scriptWords.length} script words matched`);
  console.log(`Cuts: ${cuts.map(([a, b]) => `${a.toFixed(2)}–${b.toFixed(2)}`).join(', ') || 'none'}`);
  console.log(`Tightened pauses by ${tightened.toFixed(1)}s · speed ×${speed} · output ${duration.toFixed(1)}s (pre-roll ${PRE_ROLL}s) · ${keep.length} kept ranges`);
  for (const s of sections) console.log(`  ${s.id.padEnd(12)} ${s.start.toFixed(2).padStart(7)} → ${s.end.toFixed(2).padStart(7)}  (${(s.end - s.start).toFixed(1)}s)`);
  return { source: file, keep: keep.map(([a, b]) => [+a.toFixed(3), +b.toFixed(3)] as [number, number]), preRoll: PRE_ROLL, speed, duration: +duration.toFixed(3), sections, captions };
}

if (isMain(import.meta.url)) {
  const file = findRecording(process.argv[2]);
  const t = buildTimeline(file);
  writeFileSync(`${BUILD}/timeline.json`, JSON.stringify(t, null, 1));
  console.log(`→ ${BUILD}/timeline.json · ${t.captions.length} caption cues`);
}
