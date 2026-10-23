# Word-level transcript of the presenter's recording, on-device (faster-whisper, cached model).
# Usage: uv run --python 3.11 --with faster-whisper python scripts/video/transcribe.py <video> [model] [out.json]
# Writes video/build/transcript.json (by default): [{"word": "Quick", "start": 0.82, "end": 1.1}, ...]
import json
import subprocess
import sys
import time

from faster_whisper import WhisperModel

src = sys.argv[1]
model_name = sys.argv[2] if len(sys.argv) > 2 else "medium"
out = sys.argv[3] if len(sys.argv) > 3 else "video/build/transcript.json"
wav = out.replace(".json", ".16k.wav")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vn", "-ac", "1", "-ar", "16000", wav], check=True)

t0 = time.time()
model = WhisperModel(model_name, device="cpu", compute_type="int8")
# The script is the best prompt: it teaches the model our product names.
prompt = "Consentry, Maya, Yosemite, VIN, RideNow, TableTap, MCP, Claude Code, Cursor, HTTP gateway."
segments, info = model.transcribe(wav, language="en", word_timestamps=True, vad_filter=False, initial_prompt=prompt, condition_on_previous_text=False)
words = []
for seg in segments:
    for w in seg.words or []:
        words.append({"word": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3), "p": round(w.probability, 3)})
json.dump(words, open(out, "w"), indent=0)
print(f"{len(words)} words in {time.time() - t0:.0f}s with {model_name} · audio {info.duration:.1f}s")
