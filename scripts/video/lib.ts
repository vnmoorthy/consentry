// Shared helpers for the product-video pipeline (segment → record → compose).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const INPUT = 'video/input';
export const BUILD = 'video/build';
export const OUTPUT = 'video/output';
for (const d of [INPUT, BUILD, OUTPUT]) mkdirSync(d, { recursive: true });

export interface Section { id: string; title: string; screen: string; say: string }
export interface Script { title: string; pauseSeconds: number; sections: Section[] }
/** One narrated section located in the presenter's recording (seconds). */
export interface Span { id: string; start: number; end: number }

export const loadScript = (): Script => JSON.parse(readFileSync('video/script.json', 'utf8'));
export const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
export const WPM = 140;

/** Index of the script word where `phrase` begins inside `say`. */
export function phraseIndex(say: string, phrase: string): number {
  const norm = (w: string) => w.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9']/g, '');
  const all = words(say).map(norm);
  const p = words(phrase).map(norm);
  for (let i = 0; i + p.length <= all.length; i++) if (p.every((w, j) => all[i + j] === w)) return i;
  throw new Error(`phrase not found in narration: "${phrase}"`);
}

export function sh(cmd: string, args: string[], opts: { quiet?: boolean } = {}): string {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) {
    if (!opts.quiet) console.error(r.stderr?.slice(-4000));
    throw new Error(`${cmd} exited with ${r.status}`);
  }
  return (r.stdout ?? '') + (r.stderr ?? '');
}

export const duration = (file: string) => Number(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]).trim());

export function probe(file: string): { width: number; height: number; hasVideo: boolean; hasAudio: boolean } {
  const j = JSON.parse(sh('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', file]));
  const v = j.streams.find((s: any) => s.codec_type === 'video');
  // Phone footage is often stored landscape with a rotation tag; ffmpeg auto-rotates, so swap here too.
  const rot = Math.abs(Number(v?.side_data_list?.find((d: any) => d.rotation !== undefined)?.rotation ?? v?.tags?.rotate ?? 0));
  const [w, h] = rot === 90 || rot === 270 ? [v?.height, v?.width] : [v?.width, v?.height];
  return { width: w ?? 0, height: h ?? 0, hasVideo: !!v, hasAudio: j.streams.some((s: any) => s.codec_type === 'audio') };
}

/** The presenter's recording: an explicit path, else the newest video in video/input. */
export function findRecording(arg?: string): string {
  if (arg) {
    if (!existsSync(arg)) throw new Error(`not found: ${arg}`);
    return arg;
  }
  const vids = readdirSync(INPUT)
    .filter((f) => /\.(mov|mp4|m4v|webm|mkv)$/i.test(f) && !f.startsWith('_'))
    .map((f) => join(INPUT, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!vids.length) throw new Error(`No recording in ${INPUT}/. Save your video there (any of .mov .mp4 .m4v) and run again.`);
  return vids[0];
}

export const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

/** True when this module is the script being run (not imported). */
export const isMain = (url: string) => !!process.argv[1] && fileURLToPath(url) === resolve(process.argv[1]);
