"""Builds the 30.000 s mix: VO (placed at 1.5 s), synthesized ambient bed, quiet event SFX.

Output: film/out/audio_mix.wav (48 kHz, stereo, 16-bit PCM). Encoded to AAC by render.mjs --encode.
Deterministic: fixed RNG seed, no stock audio.
"""
import os
import subprocess
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_WAV = os.path.join(HERE, '..', 'out', 'audio_mix.wav')
VO_SRC = os.path.join(HERE, 'vo_source.mp3')
SR = 48000
DUR = 30.0
N = int(round(DUR * SR))
VO_START = 1.5
rng = np.random.default_rng(20261010)


def decode_vo():
    # loudness-normalise the VO first (EBU R128, -16 LUFS integrated) so the mix levels are predictable
    tmp = os.path.join(HERE, '..', 'out', 'vo_norm.wav')
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', VO_SRC,
                    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ac', '2', '-ar', str(SR), tmp], check=True)
    with wave.open(tmp, 'rb') as w:
        raw = w.readframes(w.getnframes())
        ch = w.getnchannels()
    a = np.frombuffer(raw, dtype=np.int16).astype(np.float32).reshape(-1, ch) / 32768.0
    return a


def place(vo):
    out = np.zeros((N, 2), dtype=np.float32)
    s = int(round(VO_START * SR))
    n = min(vo.shape[0], N - s)
    out[s:s + n] = vo[:n]
    return out


def ramp(n, a, b):
    """smooth 0->1 between sample a and b (cosine)."""
    x = np.clip((np.arange(n) - a) / max(1, b - a), 0, 1)
    return 0.5 - 0.5 * np.cos(np.pi * x)


def bed():
    """Soft ambient pad: four chords, detuned sines, slow swell, sub root, sparkle at changes."""
    t = np.arange(N) / SR
    chords = [  # Hz, four voices per chord; 7.5 s each
        [130.81, 164.81, 196.00, 246.94],   # C3 E3 G3 B3
        [110.00, 130.81, 164.81, 196.00],   # A2 C3 E3 G3
        [87.31, 110.00, 130.81, 164.81],    # F2 A2 C3 E3
        [98.00, 123.47, 146.83, 164.81],    # G2 B2 D3 E3
    ]
    seg = DUR / len(chords)
    left = np.zeros(N); right = np.zeros(N)
    for i, ch in enumerate(chords):
        t0, t1 = i * seg, (i + 1) * seg
        m = (t >= t0 - 0.5) & (t < t1 + 0.5)
        idx = np.where(m)[0]
        if idx.size == 0:
            continue
        tt = t[idx]
        env = np.clip((tt - t0) / 2.2, 0, 1) * (0.5 - 0.5 * np.cos(np.pi * np.clip((t1 + 0.5 - tt) / 2.0, 0, 1)))
        env = env * (0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * tt + i))  # gentle breathing
        for k, f in enumerate(ch):
            pan = -0.35 + 0.7 * k / (len(ch) - 1)
            detune = 1 + 0.0015 * (k - 1.5)
            v = 0.5 * np.sin(2 * np.pi * f * tt) + 0.5 * np.sin(2 * np.pi * f * detune * tt + 0.7)
            v += 0.12 * np.sin(2 * np.pi * 2 * f * tt + 0.3)
            v = v * env * 0.040
            left[idx] += v * (0.5 - pan / 2)
            right[idx] += v * (0.5 + pan / 2)
        root = ch[0] / 2
        sub = 0.055 * np.sin(2 * np.pi * root * tt) * env
        left[idx] += sub; right[idx] += sub
        # sparkle on each chord entry
        spark_t = t0 + 0.25
        for j, f in enumerate(ch[2:]):
            ts = spark_t + j * 0.35
            ds = np.clip(t - ts, 0, None)
            s = np.where(t >= ts, np.exp(-ds * 2.4) * np.sin(2 * np.pi * f * 4 * t), 0.0) * 0.006
            left += s * (0.6 if j % 2 else 0.4); right += s * (0.4 if j % 2 else 0.6)
    return np.stack([left, right], axis=1).astype(np.float32)


def bell(f, dur, amp, pan=0.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    v = (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * 2.01 * f * tt)) * np.exp(-tt * 9.0) * amp
    v *= 0.5 - 0.5 * np.cos(np.pi * np.clip(tt / 0.012, 0, 1))
    return v, pan


def sfx():
    """Quiet, motion-synced soft ticks/shimmers (construction, morph air, typographic reveals)."""
    out = np.zeros((N, 2), dtype=np.float32)
    events = [
        (0.22, 'tick', 2100, 0.9), (0.85, 'shim', 1500, 0.8), (5.0, 'shim', 1280, 0.6), (6.7, 'tick', 1760, 0.6),
        (8.4, 'tick', 1980, 0.6), (10.0, 'air', 0, 1.0), (10.3, 'tick', 2350, -0.5), (10.5, 'tick', 2100, 0.5),
        (10.7, 'tick', 1870, -0.3), (10.9, 'tick', 2600, 0.4), (14.0, 'shim', 1100, 0.5), (15.2, 'tick', 1760, 0.4),
        (17.2, 'tick', 1980, 0.3), (18.0, 'shim', 1400, 0.5), (20.0, 'shim', 1560, 0.7), (20.2, 'tick', 2100, 0.3),
        (22.0, 'tick', 1760, 0.3), (23.0, 'tick', 2350, 0.3), (25.6, 'shim', 1200, 0.5), (26.5, 'tick', 1870, 0.3),
        (27.2, 'tick', 2100, 0.3),
    ]
    for ts, kind, f, pan in events:
        i0 = int(ts * SR)
        if kind == 'air':
            n = int(0.9 * SR)
            noise = rng.standard_normal(n).astype(np.float32)
            # one-pole smoothing for a soft airy band, slowly rising
            k = 0.985
            sm = np.zeros(n, dtype=np.float32); acc = 0.0
            for i in range(n):
                acc = k * acc + (1 - k) * noise[i]; sm[i] = acc
            env = np.sin(np.pi * np.linspace(0, 1, n)) ** 2
            v = sm * env * 0.05
            m = min(n, N - i0)
            out[i0:i0 + m, 0] += v[:m] * 0.6; out[i0:i0 + m, 1] += v[:m] * 0.6
            continue
        dur = 0.5 if kind == 'shim' else 0.22
        amp = 0.010 if kind == 'shim' else 0.007
        v, _ = bell(f, dur, amp)
        m = min(len(v), N - i0)
        out[i0:i0 + m, 0] += v[:m] * (0.5 - pan * 0.35)
        out[i0:i0 + m, 1] += v[:m] * (0.5 + pan * 0.35)
    return out


def envelope(x, win):
    e = np.convolve(np.abs(x).mean(axis=1), np.ones(win) / win, mode='same')
    return e


def main():
    vo = place(decode_vo())
    music = bed() * 1.0
    fx = sfx()
    mix_music = music + fx
    # ducking: music ~4 dB lower under speech
    env = envelope(vo, int(0.12 * SR))
    speech = np.clip(env / 0.02, 0, 1)
    duck = 1.0 - (1.0 - 10 ** (-4.0 / 20)) * speech
    mix_music = mix_music * duck[:, None]
    # master fades on the bed: slow in 0-2 s, gentle out 28-30 s (video holds, no fade)
    t = np.arange(N) / SR
    fade = np.clip(t / 2.0, 0, 1) * np.clip((DUR - t) / 2.0, 0, 1)
    fade = np.where(t > 28.0, 0.5 - 0.5 * np.cos(np.pi * np.clip((DUR - t) / 2.0, 0, 1)), fade)
    fade = np.minimum(fade, 1.0)
    bed_gain = float(os.environ.get('BED_GAIN', '2.1'))
    final = vo + mix_music * fade[:, None] * bed_gain
    peak = np.max(np.abs(final))
    if peak > 0.97:
        final *= 0.97 / peak
    pcm = (np.clip(final, -1, 1) * 32767).astype('<i2')
    os.makedirs(os.path.dirname(OUT_WAV), exist_ok=True)
    with wave.open(OUT_WAV, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print('wrote', OUT_WAV, 'samples', N, 'duration', N / SR, 'peak', float(np.max(np.abs(final))))


if __name__ == '__main__':
    main()
