// Renders video/script.json into the presenter's guide, docs/VIDEO_SCRIPT.md: `pnpm tsx scripts/video/script-md.ts`
import { readFileSync, writeFileSync } from 'node:fs';

const WPM = 150;
const script = JSON.parse(readFileSync('video/script.json', 'utf8')) as { title: string; pauseSeconds: number; sections: { id: string; title: string; screen: string; say: string }[] };
const words = (s: string) => s.trim().split(/\s+/).length;
const totalWords = script.sections.reduce((n, s) => n + words(s.say), 0);
const speech = (totalWords / WPM) * 60;
const recording = speech + script.pauseSeconds * (script.sections.length + 1);
// compose.ts keeps ~0.6 s between sections and adds a 4 s end card.
const video = speech + 0.6 * script.sections.length + 4;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

const rows = script.sections.map((s, i) => `### ${i + 1}. ${s.title}\n\n*On screen: ${s.screen}*\n\n> ${s.say}\n\n*(pause, 2 seconds)*\n`);

const md = `# What to read for the product video

You read this to your webcam. I record the product to match your voice, then put your face in a circle in the bottom-left corner, with your voice as the soundtrack.

**${totalWords} words.** Your recording will be about **${mmss(recording)}** with the pauses. The finished video is about **${mmss(video)}**, because I trim the pauses.

## Before you hit record

- **Use QuickTime Player → File → New Movie Recording** (Photo Booth works too). A phone propped up sideways is fine.
- **Keep your face in the middle of the frame**, head and shoulders, camera at eye level. I crop the circle from the center.
- **Face a window or a lamp.** Don't sit with a bright window behind you.
- **Pick a quiet room.** The laptop mic is fine at arm's length.
- **Read it out loud once first.** It's written to be spoken, so it should feel natural by the second time.

## While you record

1. **Start with 2 seconds of silence**, then begin with section 1.
2. **Pause for about 2 seconds between sections.** That's how I find where each one starts. Inside a section, talk normally.
3. **If you trip over a line**, stop, stay quiet for **5 seconds**, then start *that section* again from its first sentence. I'll throw away the bad take automatically.
4. **Small wording changes are fine.** Say it the way you'd say it, but keep the sections in order. I time each click to roughly where you are in the section.
5. **End with 2 seconds of silence**, then stop recording.

Don't read the section titles or the *On screen* lines. Those just tell you what viewers will be looking at.

**Saying it:** VIN rhymes with "pin". Read MCP, API and HTTP letter by letter. Smile on the first and last lines. It comes through in your voice.

## When you're done

Save the file (.mov, .mp4 or .m4v) into **\`consentry/video/input/\`** and tell me **"recorded"**.

---

## The script

${rows.join('\n')}
---

*Generated from \`video/script.json\` by \`pnpm tsx scripts/video/script-md.ts\`. Speaking time assumes ${WPM} words per minute.*
`;
writeFileSync('docs/VIDEO_SCRIPT.md', md);
console.log(`docs/VIDEO_SCRIPT.md · ${totalWords} words · recording ≈${mmss(recording)} · video ≈${mmss(video)}`);
