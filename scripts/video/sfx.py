# Sound design for the product video, synthesized (no samples): a soft whoosh on every camera move,
# a crisp tick on every click, and a pop when a chapter tag appears.
# Usage: uv run --python 3.11 --with numpy --with scipy python scripts/video/sfx.py <events.json> <total_s> <out.wav>
import json
import sys
import wave

import numpy as np
import scipy.signal as sg

SR = 48000
events, total, out = json.load(open(sys.argv[1])), float(sys.argv[2]), sys.argv[3]
rng = np.random.default_rng(3)
N = int((total + 1) * SR)
mix = np.zeros((2, N))


def bp(x, lo, hi):
    return sg.sosfilt(sg.butter(2, [lo, hi], "bandpass", fs=SR, output="sos"), x)


def put(t0, sig, pan=0.0):
    i = int(t0 * SR)
    if i >= N or i < 0:
        return
    sig = sig[: N - i]
    mix[0, i : i + len(sig)] += sig * np.cos((pan + 1) * np.pi / 4)
    mix[1, i : i + len(sig)] += sig * np.sin((pan + 1) * np.pi / 4)


def whoosh():
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    env = np.minimum(1, t / 0.16) ** 2 * np.exp(-np.maximum(0, t - 0.16) / 0.09)
    low, high = bp(noise, 300, 1800), bp(noise, 1800, 7000)
    mixk = np.clip(t / 0.3, 0, 1)
    return 0.11 * env * ((1 - mixk) * low + mixk * 0.7 * high)


def click():
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    tick = bp(rng.standard_normal(n), 2500, 9000) * np.exp(-t / 0.0025)
    body = np.sin(2 * np.pi * 1750 * t) * np.exp(-t / 0.012)
    return 0.22 * tick + 0.05 * body


def pop():
    n = int(0.16 * SR)
    t = np.arange(n) / SR
    f = 640 + 520 * (1 - np.exp(-t / 0.03))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.25 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    return 0.1 * s * (1 - np.exp(-t / 0.002)) * np.exp(-t / 0.05)


for e in events:
    if e["kind"] == "whoosh":
        put(e["t"] - 0.12, whoosh(), rng.uniform(-0.3, 0.3))
    elif e["kind"] == "click":
        put(e["t"] + 0.02, click(), 0.1)
    elif e["kind"] == "pop":
        put(e["t"], pop(), -0.2)

mix = mix[:, : int(total * SR)]
mix = np.tanh(mix * 1.2) / 1.2
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mix.T, -1, 1) * 32767).astype("<i2").tobytes())
print(f"{out}: {len(events)} sound events")
