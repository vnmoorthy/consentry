# Original background score for the product video, synthesized from scratch (no samples, no licensing).
# Usage: uv run --python 3.11 --with numpy --with scipy python scripts/video/music.py <total_s> <endcard_s> <out.wav>
#
# An upbeat D-major track for a fast product demo (I–vi–IV–V, two bars per chord): bright plucked
# arpeggios with ping-pong delay, pulsing eighth-note bass, four-on-the-floor kick, claps and hats,
# with the classic side-chain "pump" on the pads. The tempo is nudged (≈116 BPM) so the closing
# card lands on a downbeat, where the track resolves on the tonic and rings out.
import sys
import wave

import numpy as np
import scipy.signal as sg

SR = 48000
total, endcard, out = float(sys.argv[1]), float(sys.argv[2]), sys.argv[3]
rng = np.random.default_rng(7)

bars = max(16, round(endcard / (240 / 116) / 8) * 8)
BAR = endcard / bars
BEAT = BAR / 4
N = int((total + 1) * SR)
bus = {k: np.zeros((2, N)) for k in ("pad", "pluck", "bass", "drums", "bell")}


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


CHORDS = [
    [50, 54, 57, 61, 64],  # Dmaj9
    [47, 54, 57, 61, 62],  # Bm11
    [43, 50, 54, 57, 59],  # Gmaj9 (no 3rd in the bass)
    [45, 52, 57, 59, 61],  # A add9
]
ROOTS = [38, 35, 31, 33]


def add(name, start, sig, pan=0.0):
    i = int(start * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    bus[name][0, i : i + len(sig)] += sig * l
    bus[name][1, i : i + len(sig)] += sig * r


def pad(m, t0, length, amp):
    rel = 2.6
    t = np.arange(int((length + rel) * SR)) / SR
    env = np.minimum(1, t / 1.6) ** 1.5 * np.where(t < length, 1.0, np.exp(-(t - length) / 0.9))
    env *= 1 + 0.06 * np.sin(2 * np.pi * 0.21 * t + rng.uniform(0, 6))
    for det, pan in ((-0.08, -0.55), (0.0, 0.0), (0.08, 0.55)):
        f = hz(m + det)
        sig = sum((1 / k**1.7) * np.sin(2 * np.pi * f * k * t + rng.uniform(0, 6)) for k in range(1, 7))
        add("pad", t0, amp * env * sig / 3, pan)


def pluck(m, t0, amp, pan):
    t = np.arange(int(1.8 * SR)) / SR
    f = hz(m)
    env = (1 - np.exp(-t / 0.003)) * np.exp(-t / 0.42)
    sig = np.sin(2 * np.pi * f * t) + 0.32 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.18) + 0.1 * np.sin(2 * np.pi * 3.01 * f * t) * np.exp(-t / 0.08)
    add("pluck", t0, amp * env * sig, pan)


def bass(m, t0, length, amp):
    t = np.arange(int((length + 0.4) * SR)) / SR
    env = np.minimum(1, t / 0.025) * np.where(t < length, np.exp(-t / 3.0), np.exp(-length / 3.0) * np.exp(-(t - length) / 0.12))
    f = hz(m)
    add("bass", t0, amp * env * (np.sin(2 * np.pi * f * t) + 0.18 * np.sin(4 * np.pi * f * t)))


def kick(t0, amp):
    t = np.arange(int(0.45 * SR)) / SR
    f = 46 + 70 * np.exp(-t / 0.035)
    add("drums", t0, amp * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16))


def noise_hit(t0, amp, lo, hi, decay, pan):
    t = np.arange(int(decay * 6 * SR)) / SR
    n = sg.sosfilt(sg.butter(2, [lo, hi], "bandpass", fs=SR, output="sos"), rng.standard_normal(len(t)))
    add("drums", t0, amp * n * (1 - np.exp(-t / 0.002)) * np.exp(-t / decay), pan)


def bell(m, t0, amp):
    t = np.arange(int(5 * SR)) / SR
    f = hz(m)
    sig = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d) for a, r, d in ((1, 1, 2.2), (0.4, 2.0, 1.2), (0.22, 3.01, 0.6), (0.1, 4.2, 0.3)))
    add("bell", t0, amp * sig * (1 - np.exp(-t / 0.002)), 0.2)


# ── Arrangement ──────────────────────────────────────────────────────────────
ARP = [0, 2, 1, 3, 2, 4, 3, 1, 0, 2, 1, 3, 4, 3, 2, 1]
INTRO = 4
for b in range(0, bars, 2):
    ci = (b // 2) % 4
    t0 = b * BAR
    chord = CHORDS[ci]
    intro = b < INTRO
    breakdown = (b % 32) == 30 and b > 8
    build = b >= bars - 8
    for m in chord:
        pad(m, t0, 2 * BAR, 0.04)
    tones = [m + 12 for m in chord[1:]] + [chord[1] + 24]
    for i in range(16):
        idx = ARP[i % len(ARP)] % len(tones)
        vel = 0.05 * (1.0 if i % 2 == 0 else 0.72) * rng.uniform(0.88, 1.05)
        pluck(tones[idx], t0 + i * 0.5 * BEAT + rng.uniform(0, 0.006), vel, -0.4 if i % 2 else 0.4)
        if build and i % 2 == 0:
            pluck(tones[idx] + 12, t0 + i * 0.5 * BEAT + 0.008, vel * 0.4, 0.6)
    if not intro:
        root = ROOTS[ci] + 12
        for k in range(16):
            bass(root + (12 if k % 4 == 3 else 0), t0 + k * 0.5 * BEAT, 0.42 * BEAT, 0.075 if k % 2 == 0 else 0.055)
    if not intro and not breakdown:
        for beat in range(8):
            kick(t0 + beat * BEAT, 0.16)
            if beat % 2 == 1:
                noise_hit(t0 + beat * BEAT, 0.075, 1100, 5200, 0.085, 0.05)  # clap
                noise_hit(t0 + beat * BEAT + 0.012, 0.04, 1500, 6000, 0.05, -0.1)
            noise_hit(t0 + (beat + 0.5) * BEAT, 0.032, 7000, 14000, 0.035, 0.3)  # offbeat hat
            for q in (0.25, 0.75):
                noise_hit(t0 + (beat + q) * BEAT, 0.011, 8000, 15000, 0.015, -0.3)
    elif intro:
        # Riser into the drop.
        t = np.arange(int(2 * BAR * SR)) / SR
        n = sg.sosfilt(sg.butter(2, [2000, 9000], "bandpass", fs=SR, output="sos"), rng.standard_normal(len(t)))
        add("drums", t0, 0.03 * n * (t / t[-1]) ** 2)

# Resolve on the tonic at the closing card and let it ring.
end_len = total - endcard
for m in CHORDS[0] + [62 + 12]:
    pad(m, endcard, max(1.0, end_len - 2.6), 0.05)
bass(ROOTS[0], endcard, max(0.5, end_len - 1.0), 0.14)
for i, m in enumerate((74, 78, 81, 86)):
    bell(m, endcard + i * 0.18, 0.05)
kick(endcard, 0.18)


# ── Mix ──────────────────────────────────────────────────────────────────────
def lowpass(x, fc, order=2):
    return sg.sosfilt(sg.butter(order, fc, "lowpass", fs=SR, output="sos"), x, axis=-1)


def hall(rt60=2.6, pre=0.02):
    n = int(rt60 * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((2, n)) * np.exp(-6.9 * t / rt60)
    ir = lowpass(ir, 5200)
    ir[:, : int(pre * SR)] = 0
    return ir / np.sqrt((ir**2).sum(axis=1, keepdims=True))


tt = np.arange(N) / SR
phase = np.mod(tt, BEAT)
pump = np.where((tt >= INTRO * BAR) & (tt < endcard), 1 - 0.42 * np.exp(-phase / 0.11), 1.0)
for k in ("pad", "pluck", "bass"):
    bus[k] *= pump
bus["pad"] = lowpass(bus["pad"], 3200)
bus["pluck"] = lowpass(bus["pluck"], 8000)
bus["bass"] = lowpass(bus["bass"], 400)
# Ping-pong dotted-eighth delay on the pluck.
d = int(0.75 * BEAT * SR)
dl = np.zeros_like(bus["pluck"])
for k in range(1, 5):
    src = lowpass(bus["pluck"][(k + 1) % 2], 3000 - 400 * k)
    dl[k % 2, k * d :] += (0.33**k) * src[: N - k * d]
bus["pluck"] += dl
ir = hall()
send = 0.5 * bus["pad"] + 0.55 * bus["pluck"] + 0.18 * bus["drums"] + 0.6 * bus["bell"]
wet = np.stack([sg.fftconvolve(send[c], ir[c])[:N] for c in range(2)])
mix = bus["pad"] + bus["pluck"] + bus["bass"] + bus["drums"] + bus["bell"] + 0.38 * wet
mix = sg.sosfilt(sg.butter(2, 50, "highpass", fs=SR, output="sos"), mix, axis=-1)

# Gentle glue: slow RMS leveling, soft clip, fades.
rms = np.sqrt(sg.sosfilt(sg.butter(1, 0.5, "lowpass", fs=SR, output="sos"), (mix**2).mean(axis=0)) + 1e-9)
mix *= np.clip(0.12 / rms, 0.6, 1.6) ** 0.5
mix = np.tanh(mix * 1.4) / 1.4
n_total = int(total * SR)
mix = mix[:, :n_total]
t = np.arange(n_total) / SR
mix *= np.minimum(1, t / 2.5) * np.clip((total - t) / 3.5, 0, 1) ** 1.5
mix *= 0.89 / np.abs(mix).max()

with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix.T * 32767).astype("<i2").tobytes())
print(f"{out}: {total:.1f}s · {bars} bars at {240 / BAR:.1f} BPM · resolves at {endcard:.1f}s")
