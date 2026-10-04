"""Builds public/audio/soundtrack.wav: the voiceover + procedural music beds + sound effects.

Everything is synthesised here (no third-party audio). Cue times are absolute seconds in the
voiceover and mirror the visual cues in src/scenes/*.tsx.
"""
import subprocess
import numpy as np
from scipy import signal

SR = 48000
DUR = 232.0
N = int(DUR * SR)
rng = np.random.default_rng(3)


# ---------------------------------------------------------------- helpers
def t_axis(d):
    return np.arange(int(d * SR)) / SR


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def sos(kind, f, order=2):
    return signal.butter(order, f, btype=kind, fs=SR, output="sos")


def filt(x, kind, f, order=2):
    return signal.sosfilt(sos(kind, f, order), x)


def noise(d):
    return rng.standard_normal(int(d * SR))


def env_exp(d, decay):
    return np.exp(-t_axis(d) / decay)


def fade(x, a=0.005, r=0.02):
    n = len(x)
    e = np.ones(n)
    na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    if na:
        e[:na] = np.linspace(0, 1, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return x * e


class Bus:
    def __init__(self):
        self.L = np.zeros(N)
        self.R = np.zeros(N)

    def add(self, x, t, gain=1.0, pan=0.0):
        i = int(t * SR)
        if i >= N or i + len(x) <= 0:
            return
        if i < 0:
            x = x[-i:]
            i = 0
        x = x[: N - i]
        gl = gain * np.sqrt(0.5 * (1 - pan))
        gr = gain * np.sqrt(0.5 * (1 + pan))
        self.L[i : i + len(x)] += x * gl
        self.R[i : i + len(x)] += x * gr

    def gate(self, a, b, fade_s=0.05):
        """Mute outside [a, b] with short fades (keeps sections tidy)."""
        e = np.zeros(N)
        ia, ib = int(a * SR), int(b * SR)
        e[ia:ib] = 1
        k = int(fade_s * SR)
        if k:
            e[ia : ia + k] = np.linspace(0, 1, k)[: len(e[ia : ia + k])]
            e[max(0, ib - k) : ib] = np.linspace(1, 0, len(e[max(0, ib - k) : ib]))
        return e


# ---------------------------------------------------------------- instruments
def kick(level=1.0, d=0.38):
    t = t_axis(d)
    f = 45 + 115 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.16)
    click = filt(noise(d), "highpass", 2500) * np.exp(-t / 0.003) * 0.25
    return fade(body + click) * level


def snare(level=1.0):
    d = 0.25
    t = t_axis(d)
    n = filt(noise(d), "bandpass", [1200, 6000]) * np.exp(-t / 0.07)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05)
    return fade(0.6 * n + 0.5 * tone) * level


def clap(level=1.0):
    d = 0.3
    t = t_axis(d)
    n = filt(noise(d), "bandpass", [900, 3500])
    e = np.zeros_like(t)
    for off in (0, 0.011, 0.022):
        e += np.where(t >= off, np.exp(-(t - off) / (0.009 if off < 0.02 else 0.09)), 0)
    return fade(n * e * 0.5) * level


def hat(level=1.0, open_=False):
    d = 0.25 if open_ else 0.06
    t = t_axis(d)
    return fade(filt(noise(d), "highpass", 7500) * np.exp(-t / (0.08 if open_ else 0.018))) * level


def pluck(freq, d=0.9, bright=1.0, level=1.0):
    t = t_axis(d)
    x = sum((1 / k ** (1.6 - 0.4 * bright)) * np.sin(2 * np.pi * freq * k * t) * np.exp(-t * k / (0.35 * d)) for k in range(1, 7))
    return fade(x * np.exp(-t / (0.45 * d)), 0.002, 0.05) * level


def bass(freq, d=0.22, level=1.0):
    t = t_axis(d)
    x = sum((1 / k) * np.sin(2 * np.pi * freq * k * t) for k in range(1, 9))
    x = filt(x, "lowpass", 420)
    return fade(x * np.exp(-t / 0.18), 0.003, 0.03) * level


def pad(freqs, d, attack=1.5, release=1.5, level=1.0, cutoff=1800):
    t = t_axis(d)
    x = np.zeros_like(t)
    for f in freqs:
        for det in (-0.003, 0.0, 0.003):
            x += np.sin(2 * np.pi * f * (1 + det) * t + rng.uniform(0, 6.28))
            x += 0.3 * np.sin(2 * np.pi * 2 * f * (1 + det) * t)
    x = filt(x, "lowpass", cutoff)
    lfo = 1 + 0.08 * np.sin(2 * np.pi * 0.17 * t)
    e = np.minimum(1, t / attack) * np.minimum(1, (d - t) / release).clip(0, 1)
    x = x * e * lfo
    return x / (np.abs(x).max() + 1e-9) * level


def whoosh(d=0.5, up=True, level=1.0):
    n = noise(d)
    t = t_axis(d)
    blocks = 24
    out = np.zeros_like(n)
    bl = len(n) // blocks + 1
    for b in range(blocks):
        a = b * bl
        seg = n[a : a + bl]
        if not len(seg):
            break
        p = b / (blocks - 1)
        c = 400 + (p if up else 1 - p) * 4500
        out[a : a + bl] = filt(seg, "bandpass", [c * 0.6, c * 1.6])
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    return fade(out * e) * level


def boom(level=1.0, d=1.6):
    t = t_axis(d)
    f = 30 + 70 * np.exp(-t / 0.12)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.55)
    crack = filt(noise(d), "lowpass", 2500) * np.exp(-t / 0.08) * 0.35
    return fade(body + crack, 0.002, 0.2) * level


def pop(level=1.0, f0=900):
    d = 0.12
    t = t_axis(d)
    f = f0 * (0.55 + 0.45 * np.exp(-t / 0.02))
    return fade(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.035)) * level


def click(level=1.0):
    d = 0.012
    return fade(filt(noise(d), "highpass", 3000) * env_exp(d, 0.002), 0.0005, 0.004) * level


def typekey(level=1.0):
    d = 0.06
    t = t_axis(d)
    body = filt(noise(d), "bandpass", [700, 2500]) * np.exp(-t / 0.012)
    return fade(body * 0.6 + np.pad(click(), (0, len(t) - len(click())))) * level * rng.uniform(0.7, 1.0)


def thud(level=1.0):
    d = 0.35
    t = t_axis(d)
    f = 60 + 60 * np.exp(-t / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.1)
    return fade(body + 0.3 * filt(noise(d), "lowpass", 1200) * np.exp(-t / 0.03)) * level


def paper(level=1.0):
    d = 0.18
    t = t_axis(d)
    n = filt(noise(d), "bandpass", [700, 5000]) * np.exp(-t / 0.035)
    return fade(n + 0.4 * thud()[: len(n)]) * level


def tape(level=1.0):
    d = 0.22
    t = t_axis(d)
    am = 0.5 + 0.5 * signal.sawtooth(2 * np.pi * 70 * t)
    n = filt(noise(d), "bandpass", [1800, 7000]) * am * np.sin(np.pi * t / d)
    return fade(n) * level


def shutter(level=1.0):
    x = np.zeros(int(0.09 * SR))
    c = click() * 1.5
    x[: len(c)] += c
    x[int(0.045 * SR) : int(0.045 * SR) + len(c)] += c * 0.8
    return x * level


def ding(freq=1318.5, level=1.0, d=2.2):
    t = t_axis(d)
    x = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t / 0.3)
    return fade(x * np.exp(-t / 0.7), 0.002, 0.3) * level


def snip(level=1.0):
    x = np.zeros(int(0.15 * SR))
    for off in (0.0, 0.06):
        t = t_axis(0.05)
        ring = np.sin(2 * np.pi * 3200 * t) * np.exp(-t / 0.012) * 0.4
        c = click(1.2)
        i = int(off * SR)
        x[i : i + len(ring)] += ring
        x[i : i + len(c)] += c
    return x * level


def glitch(d, level=1.0):
    n = int(d * SR)
    x = np.zeros(n)
    i = 0
    while i < n:
        L = int(rng.uniform(0.01, 0.06) * SR)
        f = rng.uniform(80, 2000)
        t = np.arange(min(L, n - i)) / SR
        kind = rng.integers(3)
        if kind == 0:
            seg = signal.square(2 * np.pi * f * t) * 0.5
        elif kind == 1:
            seg = np.round(rng.standard_normal(len(t)) * 3) / 3 * 0.6
        else:
            seg = np.zeros(len(t))
        x[i : i + len(seg)] = seg
        i += L
    return fade(x) * level


def riser(d=1.0, level=1.0):
    t = t_axis(d)
    f = 200 * (8 ** (t / d))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3
    n = filt(noise(d), "highpass", 1500) * 0.5
    return fade((tone + n) * (t / d) ** 2, 0.01, 0.05) * level


def projector(d):
    t = t_axis(d)
    pulses = (np.mod(t, 1 / 18) < 0.004).astype(float)
    pulses = signal.lfilter([1], [1, -0.995], pulses) * 0.05
    n = filt(noise(d), "bandpass", [900, 3200]) * pulses
    hum = 0.15 * np.sin(2 * np.pi * 50 * t) + 0.05 * np.sin(2 * np.pi * 100 * t)
    return fade(n + hum * 0.2, 0.4, 0.4)


# ---------------------------------------------------------------- score
music = Bus()  # ducked under the voice
sfx = Bus()
send = Bus()  # reverb send


def groove(bus, a, b, bpm, pattern, swing=0.0):
    """pattern(k, t) is called on every 16th note k starting at time a; it adds sounds itself."""
    step = 60 / bpm / 4
    k = 0
    t = a
    while t < b:
        tt = t + (swing * step if k % 2 else 0)
        pattern(k, tt)
        k += 1
        t = a + k * step


# Intro: projector clatter + a soft minor pad under the definition
music.add(projector(17.4), 0.0, 0.5)
music.add(pad([midi(50), midi(53), midi(57), midi(62)], 9.6, 1.2, 1.5, cutoff=1400), 17.3, 0.22)
sfx.add(boom(0.6), 18.15)
send.add(boom(0.3), 18.15)
sfx.add(snip(0.6), 19.42)
sfx.add(whoosh(0.45, True, 0.35), 20.2)
for i in range(8):
    sfx.add(pop(0.25, 700 + 60 * i), 24.2 + i * 0.2, pan=-0.6 + 0.17 * i)
sfx.add(whoosh(0.4, True, 0.45), 26.42)

# Collage: lo-fi groove, 85 bpm
CHORDS_LOFI = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]


def lofi(k, t):
    bar, s16 = divmod(k, 16)
    chord = CHORDS_LOFI[bar % 4]
    if s16 in (0, 10):
        music.add(kick(0.55), t)
    if s16 in (4, 12):
        music.add(snare(0.25), t)
    if s16 % 2 == 0:
        music.add(hat(0.12), t, pan=0.3)
    if s16 in (0, 6):
        for j, m in enumerate(chord):
            music.add(pluck(midi(m), 1.6, 0.4, 0.12), t + j * 0.012, pan=-0.3 + 0.2 * j)


groove(music, 26.8, 49.2, 85, lofi, swing=0.18)
for t in (28.28, 30.98, 31.3, 31.6, 32.26, 32.4, 32.55, 32.78, 38.66, 39.24, 41.36):
    sfx.add(paper(0.5), t, pan=rng.uniform(-0.5, 0.5))
for i in range(7):
    sfx.add(paper(0.25), 28.6 + i * 0.06, pan=-0.4 + 0.13 * i)
for t in (33.46, 33.56, 33.66, 33.76, 33.86):
    sfx.add(tape(0.3), t, pan=rng.uniform(-0.5, 0.5))
for t in (37.25, 42.3):
    sfx.add(whoosh(0.4, False, 0.35), t)
sfx.add(thud(0.8), 47.9)

# Documentary: dark drone, typewriter, stamps, projector clicks
music.add(pad([midi(26), midi(33), midi(38), midi(45)], 23.0, 2.0, 2.0, cutoff=700), 49.3, 0.5)
music.add(filt(noise(23.0), "bandpass", [200, 900]) * 0.02, 49.3)
for i in range(len("الوثائقي")):
    sfx.add(typekey(0.35), 49.44 + i / 12)
for i in range(len("DOCUMENTARY")):
    sfx.add(typekey(0.3), 49.9 + i / 20)
for i in range(len("القاعدة الذهبية")):
    sfx.add(typekey(0.3), 67.4 + i / 18)
for t in (51.04, 63.64):
    sfx.add(thud(0.9), t)
for t in (56.82, 57.66, 58.58, 59.32, 60.08):
    sfx.add(shutter(0.4), t)
sfx.add(riser(2.2, 0.15), 64.98)
sfx.add(ding(987.8, 0.12), 67.4)
sfx.add(boom(0.7), 71.06)
send.add(boom(0.4), 71.06)

# Motion graphics: bright pluck arpeggio, 110 bpm
ARP = [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]]


def mg(k, t):
    bar, s16 = divmod(k, 16)
    if t > 88.1:  # thin out under the easing explanation
        if s16 % 8 == 0:
            music.add(pluck(midi(ARP[bar % 4][0] + 12), 0.8, 1.0, 0.1), t)
        return
    if s16 % 4 == 0:
        music.add(kick(0.45), t)
    if s16 in (4, 12):
        music.add(clap(0.3), t)
    if s16 % 4 == 2:
        music.add(hat(0.12), t)
    if s16 % 2 == 0:
        notes = ARP[bar % 4]
        music.add(pluck(midi(notes[(s16 // 2) % 4] + 12), 0.45, 1.2, 0.12), t, pan=0.4 if s16 % 4 else -0.4)


groove(music, 72.4, 95.9, 110, mg)
for i, t in enumerate((72.4, 72.48, 72.56, 72.64)):
    sfx.add(pop(0.4, 600 + 120 * i), t, pan=-0.6 + 0.4 * i)
for t in (73.64, 75.02, 75.68, 76.36, 77.38, 77.4, 77.55, 77.7, 78.16, 78.88, 80.2, 80.72, 85.04, 86.62):
    sfx.add(pop(0.3, 800), t, pan=rng.uniform(-0.4, 0.4))
sfx.add(click(0.6), 74.3)
sfx.add(click(0.5), 85.9)
for i in range(10):
    sfx.add(click(0.2), 86.7 + i * 0.11)
sfx.add(whoosh(0.4, True, 0.3), 81.3)
sfx.add(whoosh(0.4, True, 0.3), 88.05)
sfx.add(boom(0.35, 1.0), 89.86)
# the eased ball: whoosh loudness follows its speed (slow → fast → slow)
d = 94.4 - 91.0
tt = t_axis(d) / d
vel = np.where(tt < 0.5, 12 * tt ** 2, 12 * (1 - tt) ** 2)
sfx.add(filt(noise(d), "bandpass", [500, 2500]) * vel / vel.max() * 0.3, 91.0)

# Cinematic: deep pad, drops out for "the real secret is the sound", then swells back
cine = pad([midi(33), midi(45), midi(52), midi(59), midi(60), midi(64)], 14.2, 2.5, 0.6, cutoff=2200)
music.add(cine, 96.05, 0.75)
music.add(pad([midi(33), midi(45), midi(52), midi(57), midi(64), midi(71)], 7.2, 0.4, 2.0, cutoff=3000), 111.76, 0.9)
sfx.add(boom(0.8), 96.12)
send.add(boom(0.5), 96.12)
sfx.add(whoosh(0.35, False, 0.25), 103.86)
sfx.add(thud(0.4), 104.5)
send.add(ding(659.3, 0.3, 3.0), 111.76)

# Fast-paced: 120 bpm, grid aligned with the visual cuts (120.17 + n·0.25)
FAST0 = 118.92
sfx.add(boom(0.6, 1.0), 119.08)
sfx.add(boom(1.0), 119.68)
send.add(boom(0.5), 119.68)


def fast(k, t):
    bar, s16 = divmod(k, 16)
    if t < 120.17 or t > 146.28:
        return
    if s16 % 4 == 0:
        music.add(kick(0.9), t)
    if s16 in (4, 12):
        music.add(snare(0.55), t)
    music.add(hat(0.16 if s16 % 2 else 0.1), t, pan=0.35)
    if s16 % 2 == 0:
        root = [45, 45, 48, 43][bar % 4]
        music.add(bass(midi(root - 12 + (12 if s16 % 8 == 6 else 0)), 0.2, 0.55), t)
    if s16 == 0:
        for m in [57, 60, 64]:
            music.add(pluck(midi(m), 0.4, 1.4, 0.08), t)


groove(music, FAST0, 146.3, 120, fast)
sfx.add(whoosh(0.25, True, 0.5), 123.55)
sfx.add(boom(0.6, 0.8), 123.64)
sfx.add(whoosh(0.5, True, 0.7), 124.6)
sfx.add(boom(0.9), 125.38)
for t in (126.12, 126.68, 126.84):
    sfx.add(thud(0.8), t)
for t in (129.42, 129.55, 129.68):
    sfx.add(snip(0.5), t)
sfx.add(boom(0.8, 1.0), 131.14)
sfx.add(thud(1.0), 132.34)
sfx.add(pop(0.4, 600), 133.38)
for i in range(5):
    sfx.add(click(0.25), 135.02 + i * 0.34)
sfx.add(ding(1760, 0.15, 0.4), 136.38)
sfx.add(pop(0.4, 1000), 137.78)
sfx.add(whoosh(0.35, True, 0.5), 138.3)
for i in range(3):
    sfx.add(ding(1567.98, 0.1, 0.15), 139.42 + i * 0.12)
sfx.add(glitch(1.76, 0.25), 144.54)
sfx.add(boom(0.6, 0.8), 145.36)

# Minimal: silence, a bell and tiny ticks
sfx.add(ding(1318.5, 0.25, 3.0), 146.4)
send.add(ding(1318.5, 0.25, 3.0), 146.4)
for t in (149.2, 149.3, 149.45, 150.35, 150.47, 150.59, 152.9, 155.1, 156.1, 158.0, 158.5, 158.9, 159.4):
    sfx.add(click(0.12), t)
sfx.add(whoosh(0.8, False, 0.08), 151.42)
sfx.add(ding(659.3, 0.18, 3.0), 164.6)
send.add(ding(659.3, 0.2, 3.0), 164.6)

# Commercial: sleek 96 bpm
COM = [[48, 55, 62, 64], [45, 52, 59, 60], [41, 48, 55, 57], [43, 50, 57, 59]]


def ad(k, t):
    bar, s16 = divmod(k, 16)
    if t > 188.0:
        return
    if s16 in (0, 8):
        music.add(kick(0.55), t)
    if s16 in (4, 12):
        music.add(clap(0.25), t)
    if s16 % 2 == 0:
        music.add(hat(0.08), t, pan=0.3)
    if s16 % 2 == 0:
        notes = COM[bar % 4]
        music.add(pluck(midi(notes[(s16 // 2) % 4] + 12), 0.5, 0.8, 0.09), t, pan=0.5 if s16 % 4 else -0.5)
    if s16 == 0:
        music.add(pad([midi(m) for m in COM[bar % 4]], 2.5, 0.3, 0.8, cutoff=1500), t, 0.25)


groove(music, 165.48, 188.05, 96, ad)
sfx.add(whoosh(0.5, True, 0.25), 165.45)
sfx.add(boom(0.5, 1.0), 167.8)
sfx.add(riser(0.6, 0.2), 169.6)
sfx.add(click(0.5), 170.66)
sfx.add(click(0.4), 171.58)
sfx.add(click(0.7), 179.9)
for i in range(3):
    sfx.add(whoosh(0.2, False, 0.2), 181.8 + i * 0.12)
for i in range(4):
    sfx.add(whoosh(0.3, True, 0.18), 186.6 + i * 0.12, pan=-0.6 + 0.4 * i)

# Storytelling: warm pad + a rising phrase on the arc beats, then the cut
music.add(pad([midi(48), midi(52), midi(55), midi(62)], 19.4, 2.0, 1.5, cutoff=1600), 188.05, 0.55)
for t, m in ((195.72, 60), (196.54, 64), (197.26, 67), (198.06, 72), (198.68, 67)):
    sfx.add(pluck(midi(m), 2.0, 0.7, 0.3), t)
    send.add(pluck(midi(m), 2.0, 0.7, 0.2), t)
for i in range(7):
    sfx.add(pop(0.2, 700 + 50 * i), 199.4 + i * 0.22)
sfx.add(snip(0.8), 206.42)
sfx.add(whoosh(0.4, False, 0.35), 206.5)

# Outro
music.add(pad([midi(50), midi(57), midi(62), midi(65), midi(69)], 24.5, 2.0, 3.5, cutoff=1800), 207.5, 0.55)
for i in range(8):
    sfx.add(pop(0.2, 700 + 50 * i), 207.7 + i * 0.08)
sfx.add(whoosh(0.5, False, 0.3), 209.64)
for t in (211.66, 212.24, 213.04, 214.36):
    sfx.add(pop(0.3, 600), t)
for t in (216.6, 217.78, 219.0, 220.68, 221.68, 223.48, 225.0, 226.34):
    sfx.add(whoosh(0.3, True, 0.25), t - 0.1, pan=rng.uniform(-0.4, 0.4))
sfx.add(whoosh(0.9, True, 0.4), 227.3)
sfx.add(boom(0.9, 2.5), 228.6)
send.add(boom(0.6, 2.5), 228.6)
send.add(ding(587.3, 0.3, 4.0), 228.6)

# ---------------------------------------------------------------- mix
voice = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", "public/audio/voice.mp3", "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
voice = np.frombuffer(voice, dtype=np.float32).astype(np.float64)
voice = np.pad(voice, (0, max(0, N - len(voice))))[:N]
voice = voice / np.abs(voice).max() * 0.85

# sidechain: envelope follower on the voice
rect = np.abs(voice)
att, rel = np.exp(-1 / (0.01 * SR)), np.exp(-1 / (0.3 * SR))
env = signal.lfilter([1 - rel], [1, -rel], rect)
env = np.maximum(env, signal.lfilter([1 - att], [1, -att], rect))
env = env / (np.percentile(env, 95) + 1e-9)
duck = 1 - 0.6 * np.clip(env, 0, 1)

# hard silence for the Minimal section's opening (contrast after the chaos)
music.L *= 1 - music.gate(146.3, 165.4, 0.01)
music.R *= 1 - music.gate(146.3, 165.4, 0.01)


def reverb(L, R, d=2.4):
    t = t_axis(d)
    ir = rng.standard_normal(len(t)) * np.exp(-t / (d / 6.5))
    ir2 = rng.standard_normal(len(t)) * np.exp(-t / (d / 6.5))
    ir, ir2 = filt(ir, "lowpass", 5000), filt(ir2, "lowpass", 5000)
    return signal.oaconvolve(L, ir)[:N] * 0.02, signal.oaconvolve(R, ir2)[:N] * 0.02


mL, mR = music.L * duck, music.R * duck
rvL, rvR = reverb(music.L * 0.3 + send.L, music.R * 0.3 + send.R)
bedL = mL + sfx.L + rvL
bedR = mR + sfx.R + rvR

# Per-section balance: keep the bed a fixed number of LU under the voice (K-weighted).
import pyloudnorm as pyln

meter = pyln.Meter(SR)
TARGET = {  # LU under the voice
    (0.0, 17.38): 15, (17.38, 26.8): 13, (26.8, 49.3): 13, (49.3, 72.25): 14, (72.25, 96.05): 12,
    (96.05, 118.95): 10, (118.95, 146.3): 9, (146.3, 165.4): 12, (165.4, 188.05): 11,
    (188.05, 207.5): 13, (207.5, 228.5): 12, (228.5, DUR): 8,
}
gain = np.zeros(N)
for (a, b), lu in TARGET.items():
    i, j = int(a * SR), int(b * SR)
    vl = meter.integrated_loudness(voice[i:j])
    bl = meter.integrated_loudness(np.stack([bedL[i:j], bedR[i:j]], 1))
    if not np.isfinite(vl):
        vl = -20.0
    g = 10 ** (((vl - lu) - bl) / 20) if np.isfinite(bl) else 0.0
    gain[i:j] = g
    print(f"{a:6.1f}-{b:6.1f}  voice {vl:6.1f} LUFS  bed {bl:6.1f} -> gain {20*np.log10(g+1e-12):6.1f} dB")
gain = signal.sosfiltfilt(sos("lowpass", 3), gain)  # smooth section changes (~0.3 s)
L = voice + bedL * gain
R = voice + bedR * gain
peak = max(np.abs(L).max(), np.abs(R).max())
L, R = L / peak * 0.95, R / peak * 0.95
st = np.stack([L, R], 1).astype(np.float32)

raw = "out/soundtrack-raw.f32"
import os

os.makedirs("out", exist_ok=True)
st.tofile(raw)
subprocess.run(
    ["ffmpeg", "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", raw, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", str(SR), "public/audio/soundtrack.wav"],
    check=True,
)
os.remove(raw)
print("wrote public/audio/soundtrack.wav")
