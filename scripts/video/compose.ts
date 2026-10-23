// Assembles the final product video: screen recording + presenter's webcam circle + voice + score.
// Usage: `pnpm tsx scripts/video/compose.ts [--captions]` → video/output/consentry-demo.mp4 (+ .srt)
//
// Frame-exact edit: every section is trimmed to a frame count derived from absolute timeline
// times, so voice and screen never drift. Audio: the presenter's voice (cleaned, compressed, a
// little presence) over the score, which ducks under speech and has a mid-range pocket carved out
// for the voice; the mix is loudness-normalized in two passes to -14 LUFS (YouTube / LinkedIn).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { BUILD, OUTPUT, isMain, loadScript, probe, sh } from './lib';
import { CAM, GFX } from './graphics';
import type { Timeline } from './timeline';

const FPS = 30;
const END_CARD = 4;
const OUT = `${OUTPUT}/consentry-demo.mp4`;

const srtTime = (t: number) => {
  const ms = Math.round(t * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

export function writeSrt(t: Timeline, file: string) {
  writeFileSync(file, t.captions.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.words.map((w) => w.text).join(' ')}\n`).join('\n'));
}

export function compose(opts: { audioOnly?: boolean; reuseAudio?: boolean } = {}) {
  const t: Timeline = JSON.parse(readFileSync(`${BUILD}/timeline.json`, 'utf8'));
  const script = loadScript();
  const total = t.duration + END_CARD;
  const frames = (s: number) => Math.round(s * FPS);
  if (!existsSync(`${BUILD}/music.wav`)) throw new Error('missing video/build/music.wav: run music.py');

  // ── Sound design: clicks and camera moves from the recording, pops on chapter tags ──
  const sfxEvents: { t: number; kind: string }[] = [];
  t.sections.forEach((s, i) => {
    sfxEvents.push({ t: (i === 0 ? t.preRoll + 0.4 : s.start + 0.45) + 0.05, kind: 'pop' });
    const path = `${BUILD}/screen/${s.id}.json`;
    if (!existsSync(path)) return;
    const meta = JSON.parse(readFileSync(path, 'utf8'));
    const len = s.end - s.start;
    const over = meta.length - 0.3 - len;
    const wait = (meta.busy as [number, number][]).filter(([a, b]) => b - a - over >= 1).sort((x, y) => y[1] - y[0] - (x[1] - x[0]))[0];
    const map = (x: number) => {
      if (over <= 0.25) return x;
      if (!wait) return (x * len) / (meta.length - 0.3);
      const [a, b] = wait;
      return x < a ? x : x <= b ? a + ((x - a) * (b - a - over)) / (b - a) : x - over;
    };
    for (const e of meta.events ?? []) {
      const at = map(e.t);
      if (at >= 0 && at < len) sfxEvents.push({ t: +(s.start + at).toFixed(3), kind: e.kind });
    }
  });
  writeFileSync(`${BUILD}/sfx-events.json`, JSON.stringify(sfxEvents));
  sh('uv', ['run', '--python', '3.11', '--with', 'numpy', '--with', 'scipy', 'python', 'scripts/video/sfx.py', `${BUILD}/sfx-events.json`, String(total), `${BUILD}/sfx.wav`]);

  // ── Audio (rendered first so it can be loudness-measured) ──────────────────
  const voiceParts = t.keep.map(([a, b], k) => `[0:a]atrim=start=${a}:end=${b},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st=${(b - a - 0.012).toFixed(3)}:d=0.012[a${k}]`);
  const audioGraph = [
    ...voiceParts,
    `${t.keep.map((_, k) => `[a${k}]`).join('')}concat=n=${t.keep.length}:v=0:a=1,atempo=${t.speed ?? 1},pan=stereo|c0=c0|c1=c0,highpass=f=75,afftdn=nr=10:nf=-42,acompressor=threshold=-21dB:ratio=3:attack=8:release=180:makeup=2.5,equalizer=f=220:t=q:w=1:g=-1.5,equalizer=f=3500:t=q:w=1.2:g=2,adelay=${Math.round(t.preRoll * 1000)}:all=1,apad=whole_dur=${total}[voice]`,
    `[voice]asplit=2[vmix][vkey]`,
    `[1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.3,equalizer=f=1100:t=q:w=1.3:g=-4,equalizer=f=2600:t=q:w=1.5:g=-2[mus]`,
    `[mus][vkey]sidechaincompress=threshold=0.015:ratio=5:attack=50:release=650:makeup=1[duck]`,
    `[2:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=1.3[sfx]`,
    `[vmix][duck][sfx]amix=inputs=3:duration=first:normalize=0,atrim=end=${total}[mix]`,
  ].join(';');
  const mixWav = `${BUILD}/mix.wav`;
  const finalWav = `${BUILD}/mix-14lufs.wav`;
  if (!(opts.reuseAudio && existsSync(finalWav))) {
  sh('ffmpeg', ['-y', '-v', 'error', '-i', t.source, '-i', `${BUILD}/music.wav`, '-i', `${BUILD}/sfx.wav`, '-filter_complex', audioGraph, '-map', '[mix]', '-ar', '48000', '-c:a', 'pcm_s16le', mixWav]);
  const measured = sh('ffmpeg', ['-hide_banner', '-i', mixWav, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']);
  const m = JSON.parse(measured.slice(measured.lastIndexOf('{'), measured.lastIndexOf('}') + 1));
  sh('ffmpeg', ['-y', '-v', 'error', '-i', mixWav, '-af', `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`, '-c:a', 'pcm_s16le', finalWav]);
  console.log(`audio: ${m.input_i} LUFS → -14 LUFS`);
  }
  if (opts.audioOnly) return;
  for (const s of t.sections) if (!existsSync(`${BUILD}/screen/${s.id}.mp4`)) throw new Error(`missing screen clip for ${s.id}: run record.ts`);

  // ── Video ──────────────────────────────────────────────────────────────────
  const src = probe(t.source);
  // Head-and-shoulders square from the webcam, nudged to where the face sits in this take.
  const side = Math.min(src.height, Math.round(src.height * 0.85));
  const cx = Math.round(src.width * 0.53);
  const crop = `crop=${side}:${side}:${Math.max(0, Math.min(src.width - side, cx - side / 2))}:0`;

  const inputs: string[] = ['-i', t.source, '-i', finalWav];
  const screenIdx = inputs.length / 2;
  for (const s of t.sections) inputs.push('-i', `${BUILD}/screen/${s.id}.mp4`);
  const loop = (file: string, dur: number) => inputs.push('-loop', '1', '-framerate', String(FPS), '-t', dur.toFixed(3), '-i', file);
  const maskIdx = inputs.filter((x) => x === '-i').length;
  loop(`${GFX}/mask.png`, total);
  const ringIdx = maskIdx + 1;
  loop(`${GFX}/ring.png`, total);
  const chapterIdx = ringIdx + 1;
  script.sections.forEach((_, i) => loop(`${GFX}/chapter-${String(i + 1).padStart(2, '0')}.png`, 3.8));
  const endIdx = chapterIdx + script.sections.length;
  loop(`${GFX}/endcard.png`, END_CARD + 0.2);

  const g: string[] = [];
  // Screen: each section trimmed to its exact frame count. When the live agent made a take run long,
  // the waiting stretch is time-lapsed so the actions after it land back on their words.
  t.sections.forEach((s, i) => {
    const want = frames(s.end) - frames(s.start);
    const meta = JSON.parse(readFileSync(`${BUILD}/screen/${s.id}.json`, 'utf8'));
    const over = meta.length - 0.3 - (s.end - s.start);
    const src = `[${screenIdx + i}:v]settb=AVTB,setpts=PTS-STARTPTS`;
    const fit = `fps=${FPS},tpad=stop_mode=clone:stop_duration=2,trim=end_frame=${want},setpts=PTS-STARTPTS[s${i}]`;
    const wait = (meta.busy as [number, number][]).filter(([a, b]) => b - a - over >= 1).sort((x, y) => y[1] - y[0] - (x[1] - x[0]))[0];
    if (over > 0.25 && wait) {
      const [a, b] = wait;
      const k = ((b - a - over) / (b - a)).toFixed(5);
      g.push(`${src},split=3[p${i}a][p${i}b][p${i}c]`);
      g.push(`[p${i}a]trim=end=${a},setpts=PTS-STARTPTS[q${i}a]`);
      g.push(`[p${i}b]trim=start=${a}:end=${b},setpts=(PTS-STARTPTS)*${k}[q${i}b]`);
      g.push(`[p${i}c]trim=start=${b},setpts=PTS-STARTPTS[q${i}c]`);
      g.push(`[q${i}a][q${i}b][q${i}c]concat=n=3:v=1:a=0,${fit}`);
      console.log(`  ${s.id}: time-lapsed the ${(b - a).toFixed(1)}s agent wait by ${over.toFixed(1)}s`);
    } else if (over > 0.25) {
      g.push(`${src},setpts=PTS*${((s.end - s.start) / (meta.length - 0.3)).toFixed(5)},${fit}`);
      console.log(`  ${s.id}: sped up ${over.toFixed(1)}s overall`);
    } else g.push(`${src},${fit}`);
  });
  g.push(`${t.sections.map((_, i) => `[s${i}]`).join('')}concat=n=${t.sections.length}:v=1:a=0,tpad=stop_mode=clone:stop_duration=${END_CARD + 0.5},trim=end_frame=${frames(total)},format=yuv420p[screen]`);

  // Webcam: same kept ranges as the voice, so lips stay in sync.
  t.keep.forEach(([a, b], k) => g.push(`[0:v]trim=start=${a}:end=${b},setpts=PTS-STARTPTS[v${k}]`));
  g.push(`${t.keep.map((_, k) => `[v${k}]`).join('')}concat=n=${t.keep.length}:v=1:a=0,setpts=PTS/${t.speed ?? 1},fps=${FPS},${crop},scale=${CAM.d}:${CAM.d}:flags=lanczos,eq=brightness=0.03:contrast=1.06:saturation=1.08,format=rgba[cam]`);
  g.push(`[${maskIdx}:v]scale=${CAM.d}:${CAM.d},format=gray[mask]`);
  const faceLen = t.duration - t.preRoll;
  g.push(`[cam][mask]alphamerge,fade=t=in:st=0:d=0.45:alpha=1,fade=t=out:st=${(faceLen - 0.6).toFixed(3)}:d=0.6:alpha=1,setpts=PTS+${t.preRoll}/TB[face]`);
  g.push(`[${ringIdx}:v]format=rgba,fade=t=in:st=${t.preRoll}:d=0.45:alpha=1,fade=t=out:st=${(t.duration - 0.6).toFixed(3)}:d=0.6:alpha=1[ring]`);

  const camX = CAM.margin;
  const camY = 1080 - CAM.margin - CAM.d;
  g.push(`[screen][ring]overlay=x=${camX - 60}:y=${camY - 60}:eof_action=pass[b0]`);
  g.push(`[b0][face]overlay=x=${camX}:y=${camY}:eof_action=pass[b1]`);
  let last = 'b1';
  t.sections.forEach((s, i) => {
    const at = i === 0 ? t.preRoll + 0.4 : s.start + 0.45;
    g.push(`[${chapterIdx + i}:v]format=rgba,fade=t=in:st=0:d=0.35:alpha=1,fade=t=out:st=3.35:d=0.45:alpha=1,setpts=PTS+${at.toFixed(3)}/TB[c${i}]`);
    g.push(`[${last}][c${i}]overlay=x=${camX + CAM.d / 2}-overlay_w/2:y=${camY + CAM.d + 2}-overlay_h/2:eof_action=pass[k${i}]`);
    last = `k${i}`;
  });
  g.push(`[${endIdx}:v]format=rgba,fade=t=in:st=0:d=0.8:alpha=1,setpts=PTS+${t.duration.toFixed(3)}/TB[end]`);
  g.push(`[${last}][end]overlay=eof_action=pass,format=yuv420p[vout]`);

  writeFileSync(`${BUILD}/compose-graph.txt`, g.join(';\n'));
  sh('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex_script', `${BUILD}/compose-graph.txt`, '-map', '[vout]', '-map', '1:a', '-r', String(FPS), '-c:v', 'libx264', '-preset', process.env.PRESET ?? 'faster', '-crf', '18', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-t', total.toFixed(3), '-movflags', '+faststart', OUT]);
  writeSrt(t, OUT.replace('.mp4', '.srt'));
  console.log(`→ ${OUT} (${total.toFixed(1)}s) + .srt`);
}

if (isMain(import.meta.url)) compose({ audioOnly: process.argv.includes('--audio-only'), reuseAudio: process.argv.includes('--reuse-audio') });
