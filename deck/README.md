# Pitch deck

- **[Consentry-pitch.pptx](Consentry-pitch.pptx)**: 10 slides with Morph transitions (the shield and glow travel between slides), auto-playing entrance builds and an embedded animated demo. Open it in PowerPoint (Keynote works with simpler transitions).
- **[Consentry-pitch.pdf](Consentry-pitch.pdf)**: static export for quick viewing on GitHub.
- **Script:** [docs/PITCH_STORYBOARD.md](../docs/PITCH_STORYBOARD.md). The speaker notes in the deck match it.

## Rebuild (deck as code)

```bash
cd deck/src
npm install            # pptxgenjs + qrcode
npm run media          # regenerate media/demo.gif from assets/demo.mp4 (needs ffmpeg)
npm run build          # build.mjs (layout + content) → animate.py (Morph + entrance timing)
```

`build.mjs` names elements `!!orb` / `!!logo` (morph targets) and `anim-<step>-<fade|rise|zoom>-…` (entrance choreography). `animate.py` turns those names into OOXML `<p:transition>` and `<p:timing>` trees.
