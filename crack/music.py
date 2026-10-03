#!/usr/bin/env python3
"""
Score for «الشق» — 128 BPM, D Hijaz (D E♭ F♯ G A B♭ C), 32 bars = 60.000 s.
Everything is synthesised with numpy/scipy; nothing is sampled.
Every cue time comes from cues.json, which is dumped from the SAME code that renders the picture.
The bullet-time moment is scored by warping the whole mix with the picture's own time-warp curve.
"""
import json, sys
import numpy as np
import scipy.signal as sg
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 44100
CU = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'cues.json'))
BEAT, BAR, DUR = CU['BEAT'], CU['BAR'], CU['DUR']
WARP = np.array(CU['warp']); WARP_DT = 0.001
N = int(round(SR * DUR))
rng = np.random.default_rng(20261003)
np.random.seed(20261003)

# ── pitch helpers ─────────────────────────────────────────────
NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def hz(name):
    """'Eb5' 'F#4' 'D3' → Hz"""
    n = NOTE[name[0]]; i = 1
    while name[i] in '#b':
        n += 1 if name[i] == '#' else -1; i += 1
    return 440.0 * 2 ** ((n + 12 * (int(name[i:]) + 1) - 69) / 12)

def T(bar, beat=0.0, step=0.0):
    return bar * BAR + beat * BEAT + step * BEAT / 4

# ── filters ───────────────────────────────────────────────────
def _sos(kind, fc, order=2):
    fc = np.clip(fc, 20, SR / 2 * 0.95)
    if kind == 'bp': return butter(order, [fc[0] / (SR / 2), fc[1] / (SR / 2)], 'band', output='sos')
    return butter(order, fc / (SR / 2), kind, output='sos')
def lp(x, fc, order=2): return sosfilt(_sos('low', fc, order), x)
def hp(x, fc, order=2): return sosfilt(_sos('high', fc, order), x)
def bp(x, lo, hi, order=2): return sosfilt(_sos('bp', (lo, hi), order), x)

def sweep(x, fc_curve, kind='low', block=256, order=2):
    """time-varying filter (block-wise coefficient update, state carried over)"""
    y = np.empty_like(x); zi = None
    for i in range(0, len(x), block):
        fc = float(fc_curve[min(i, len(fc_curve) - 1)])
        sos = _sos(kind, fc, order)
        if zi is None or zi.shape[0] != sos.shape[0]: zi = np.zeros((sos.shape[0], 2))
        y[i:i + block], zi = sosfilt(sos, x[i:i + block], zi=zi)
    return y

def tt(n): return np.arange(n) / SR
def expo(n, tau): return np.exp(-tt(n) / tau)
def fade(x, a=0.002, r=0.01):
    x = x.copy(); na, nr = int(a * SR), int(r * SR)
    if na: x[:na] *= np.linspace(0, 1, na)
    if nr and nr < len(x): x[-nr:] *= np.linspace(1, 0, nr)
    return x
def norm(x, peak=1.0): m = np.max(np.abs(x)) + 1e-12; return x / m * peak
def soft(x, g=1.0): return np.tanh(x * g) / np.tanh(g)

# ── instruments ───────────────────────────────────────────────
def kick(dur=0.42, f0=170, f1=44, click=0.25, drive=2.0):
    n = int(dur * SR); t = tt(n)
    f = f1 + (f0 - f1) * np.exp(-t / 0.026)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.20)
    ck = hp(rng.standard_normal(n) * np.exp(-t / 0.004), 1800) * click
    return fade(soft(body + ck, drive), 0.0005, 0.02)

def heart(dur=0.55, f0=100, f1=46):
    n = int(dur * SR); t = tt(n)
    f = f1 + (f0 - f1) * np.exp(-t / 0.05)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    x = soft(x, 2.2)                       # harmonics so it survives small speakers
    return fade(lp(x, 900), 0.004, 0.05) * 0.7

def snare(dur=0.3, tone=195, bright=1.0):
    n = int(dur * SR); t = tt(n)
    nz = bp(rng.standard_normal(n), 900, 9000) * np.exp(-t / 0.085) * bright
    tn = np.sin(2 * np.pi * (tone + 60 * np.exp(-t / 0.02)) * t) * np.exp(-t / 0.06)
    return fade(soft(nz * 0.9 + tn * 0.6, 1.6), 0.0005, 0.02)

def clap(dur=0.4):
    n = int(dur * SR); t = tt(n); x = np.zeros(n)
    nz = bp(rng.standard_normal(n), 1100, 3800, 2)
    for k, d in enumerate([0, 0.011, 0.023, 0.036]):
        s = int(d * SR); x[s:] += nz[:n - s] * np.exp(-tt(n - s) / (0.006 if k < 3 else 0.11)) * (0.6 if k < 3 else 1.0)
    return fade(x, 0.0005, 0.03)

def hat(open_=False, dur=None):
    dur = dur or (0.30 if open_ else 0.07); n = int(dur * SR); t = tt(n)
    x = hp(rng.standard_normal(n), 7000, 2) * np.exp(-t / (0.09 if open_ else 0.014))
    return fade(lp(x, 15000, 1), 0.0003, 0.01) * 1.35

def sub_note(f, dur, glide_from=None, drive=1.4):
    n = int(dur * SR); t = tt(n)
    fr = np.full(n, f) if glide_from is None else f + (glide_from - f) * np.exp(-t / 0.05)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    x = np.sin(ph) + 0.28 * np.sin(2 * ph)
    return fade(soft(x, drive), 0.004, 0.03)

def bass_note(f, dur, cutoff=520, saw=0.55, glide_from=None):
    n = int(dur * SR); t = tt(n)
    fr = np.full(n, f) if glide_from is None else f + (glide_from - f) * np.exp(-t / 0.06)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    x = saw * sg.sawtooth(ph) + 0.9 * np.sin(ph)
    x = lp(x, cutoff, 2)
    env = np.minimum(1, t / 0.004) * np.exp(-t / (dur * 1.4))
    return fade(soft(x * env, 1.8), 0.001, 0.02)

def pluck(f, dur=1.4, decay=0.55, bright=1.0, pos=0.22, pick=0.16):
    """additive plucked string (qanun / oud-ish): partials with stiffness, faster decay up the series"""
    n = int(dur * SR); t = tt(n)
    H = int(min(30, (SR / 2 * 0.92) / f)); x = np.zeros(n)
    for h in range(1, H + 1):
        fh = f * h * np.sqrt(1 + 0.00009 * h * h)
        a = (1.0 / h ** (1.1 - 0.35 * bright)) * (0.35 + 0.65 * abs(np.sin(np.pi * h * pos)))
        x += a * np.sin(2 * np.pi * fh * t + h * 0.7) * np.exp(-t / (decay / (1 + 0.42 * (h - 1))))
    nz = bp(rng.standard_normal(n), 1800, 7000) * np.exp(-t / 0.005) * pick
    return fade(norm(x) + nz, 0.0008, 0.06)

def bell(f, dur=2.2, ratio=3.5, index=3.0, tau=0.9):
    n = int(dur * SR); t = tt(n)
    idx = index * np.exp(-t / 0.35)
    x = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * ratio * t)) * np.exp(-t / tau)
    x += 0.3 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t / (tau * 0.6))
    return fade(x, 0.0005, 0.08)

def supersaw(f, dur, cutoff=4200, det=(-14, -6, 0, 6, 14), atk=0.004, rel=0.08, decay=None):
    n = int(dur * SR); t = tt(n); x = np.zeros(n)
    for i, c in enumerate(det):
        ph = 2 * np.pi * np.cumsum(np.full(n, f * 2 ** (c / 1200))) / SR + i * 1.3
        x += sg.sawtooth(ph)
    x = lp(x / len(det), cutoff, 2)
    env = np.minimum(1, t / atk) * (np.exp(-t / decay) if decay else 1)
    return fade(x * env, 0.001, rel)

def pad(notes, dur, cutoff=1400, atk=0.8, rel=0.9, det=7, level=1.0):
    """stereo detuned-saw pad → (L, R)"""
    n = int(dur * SR); t = tt(n); L = np.zeros(n); R = np.zeros(n)
    for f in notes:
        for c, side in ((-det, 0), (0, 2), (det, 1)):
            ph = 2 * np.pi * np.cumsum(np.full(n, f * 2 ** (c / 1200))) / SR + rng.uniform(0, 6.28)
            s = sg.sawtooth(ph) * 0.5 + np.sin(ph) * 0.5
            if side in (0, 2): L += s
            if side in (1, 2): R += s
    env = np.minimum(1, t / atk) * np.minimum(1, (dur - t) / rel)
    return hp(lp(L, cutoff, 2), 130, 1) * env * level / (3 * len(notes)) * 2.1, hp(lp(R, cutoff, 2), 130, 1) * env * level / (3 * len(notes)) * 2.1

def noise_riser(dur, f_lo=300, f_hi=9000, curve=2.2, hp_fc=250):
    n = int(dur * SR); k = np.linspace(0, 1, n)
    x = sweep(rng.standard_normal(n), f_lo * (f_hi / f_lo) ** (k ** 1.4), 'low', 256, 2)
    x = hp(x, hp_fc, 2) * (k ** curve)
    return fade(x, 0.01, 0.005)

def tone_sweep(dur, f0, f1, wave='sin', curve=2.0):
    n = int(dur * SR); k = np.linspace(0, 1, n)
    f = f0 * (f1 / f0) ** (k ** curve)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) if wave == 'sin' else sg.sawtooth(ph)
    return fade(x * (k ** 1.6), 0.005, 0.003)

def boom(dur=2.4, f0=68, f1=30, noise=0.6):
    n = int(dur * SR); t = tt(n)
    f = f1 + (f0 - f1) * np.exp(-t / 0.35)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.9)
    nz = lp(rng.standard_normal(n), 2600, 2) * np.exp(-t / 0.28) * noise
    return fade(soft(body * 0.80 + nz * 1.15, 1.4), 0.001, 0.2)

def crash(dur=2.4):
    n = int(dur * SR); t = tt(n)
    x = hp(rng.standard_normal(n), 3500, 2) * np.exp(-t / 0.55)
    return fade(x, 0.0005, 0.2)

def whoosh(dur, up=True, f0=400, f1=7000):
    x = noise_riser(dur, f0, f1, 1.6, 200)
    return x if up else x[::-1]

def tick(freq=2900, dur=0.05):
    n = int(dur * SR); t = tt(n)
    x = hp(rng.standard_normal(n), 2000) * np.exp(-t / 0.0022) * 0.7 + np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.006)
    return fade(x, 0.0002, 0.01)

# ── reverbs & mixing bus ──────────────────────────────────────
def make_ir(rt60, pre=0.018, damp=5200, seed=1):
    n = int(SR * (rt60 * 1.15 + pre)); t = tt(n); out = []
    for ch in range(2):
        r = np.random.default_rng(seed + ch * 17)
        x = r.standard_normal(n)
        hi = lp(x, damp, 1); lo = lp(x, 900, 1)
        env = np.exp(-6.9 * t / rt60)
        y = (hi * env * np.exp(-t / (rt60 * 0.35)) + lo * env) * (t > pre)
        y[:int(pre * SR)] = 0
        out.append(y / np.sqrt(np.sum(y ** 2) + 1e-9))
    return out

class Bus:
    def __init__(self): self.L = np.zeros(N); self.R = np.zeros(N)
    def add(self, x, t0, gain=1.0, pan=0.0, xr=None):
        i = int(round(t0 * SR))
        if i >= N or i + len(x) <= 0: return
        a = max(0, -i); i0 = max(0, i); m = min(len(x) - a, N - i0)
        if m <= 0: return
        if xr is None:
            th = (pan + 1) * np.pi / 4
            self.L[i0:i0 + m] += x[a:a + m] * gain * np.cos(th); self.R[i0:i0 + m] += x[a:a + m] * gain * np.sin(th)
        else:
            self.L[i0:i0 + m] += x[a:a + m] * gain; self.R[i0:i0 + m] += xr[a:a + m] * gain

dry = Bus(); room = Bus(); hall = Bus(); dly = Bus()      # dry mix + reverb / delay sends
music_sc = Bus()                                           # sidechained musical layers (summed later)

def W(t): return float(np.interp(t, np.arange(len(WARP)) * WARP_DT, WARP))

def place(x, t0, gain=1.0, pan=0.0, rm=0.0, hl=0.0, dl=0.0, sc=False):
    t0 = W(t0)
    """put a mono sound in the mix with sends; sc=True → goes through the sidechain bus"""
    tgt = music_sc if sc else dry
    tgt.add(x, t0, gain, pan)
    if rm: room.add(x, t0, gain * rm, pan)
    if hl: hall.add(x, t0, gain * hl, pan)
    if dl: dly.add(x, t0, gain * dl, pan)

def place_st(xl, xr, t0, gain=1.0, rm=0.0, hl=0.0, sc=False):
    t0 = W(t0)
    tgt = music_sc if sc else dry
    tgt.add(xl, t0, gain, xr=xr)
    if rm: room.add(xl, t0, gain * rm, xr=xr)
    if hl: hall.add(xl, t0, gain * hl, xr=xr)

# ── sidechain from the kick schedule ──────────────────────────
KICKS = []
def K(t0, vel=1.0, sc=True):
    place(kick(), t0, 0.70 * vel, 0, rm=0.04)
    if sc: KICKS.append(W(t0))

# ═════════════════════════════════════════════════════════════
#  extra instruments for this film
# ═════════════════════════════════════════════════════════════
def glass(dur=1.2, lo=2800, hi=11000):
    """paper / glass tearing: a noisy snap followed by a scatter of ringing shards"""
    n = int(dur * SR); t = tt(n)
    x = bp(rng.standard_normal(n), lo, hi) * np.exp(-t / 0.05) * 1.1
    for _ in range(26):
        f = rng.uniform(lo, hi); d = rng.uniform(0, dur * 0.55); s = int(d * SR)
        m = n - s
        x[s:] += np.sin(2 * np.pi * f * tt(m)) * np.exp(-tt(m) / rng.uniform(0.01, 0.10)) * rng.uniform(0.05, 0.22)
    return fade(x, 0.0003, 0.1)

def stone(f=220, dur=0.22):
    n = int(dur * SR); t = tt(n)
    th = np.sin(2 * np.pi * f * 0.5 * t) * np.exp(-t / 0.045)
    ck = bp(rng.standard_normal(n), 700, 2800) * np.exp(-t / 0.012)
    return fade(soft(th * 0.8 + ck * 0.9, 1.5), 0.0004, 0.03)

def taiko(dur=1.0, f0=118, f1=48, slap=0.55):
    n = int(dur * SR); t = tt(n)
    f = f1 + (f0 - f1) * np.exp(-t / 0.07)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.30)
    sl = bp(rng.standard_normal(n), 300, 2400) * np.exp(-t / 0.03) * slap
    return fade(soft(body * 1.1 + sl, 1.8), 0.0006, 0.06)

def brass(f, dur, cutoff0=500, cutoff1=2600, atk=0.35, vib=5.0):
    n = int(dur * SR); t = tt(n); k = np.linspace(0, 1, n)
    fr = f * (1 + 0.004 * np.sin(2 * np.pi * vib * t) * np.minimum(1, t / 0.8))
    ph = 2 * np.pi * np.cumsum(fr) / SR
    x = sg.sawtooth(ph) * 0.6 + sg.sawtooth(ph * 1.005) * 0.5 + np.sin(ph) * 0.5
    x = sweep(x, cutoff0 + (cutoff1 - cutoff0) * np.minimum(1, k * 2.2), 'low', 256, 2)
    env = np.minimum(1, t / atk) * np.minimum(1, (dur - t) / 0.5)
    return fade(x * env, 0.002, 0.2)

def growl(dur=1.4, f=46):
    n = int(dur * SR); t = tt(n); k = np.linspace(0, 1, n)
    wob = 1 + 0.35 * np.sin(2 * np.pi * (23 + 14 * k) * t)
    ph = 2 * np.pi * np.cumsum(f * (1 + 0.25 * np.sin(2 * np.pi * 5.5 * t))) / SR
    x = sg.sawtooth(ph) * wob + 0.5 * sg.square(ph * 0.5)
    fc = 280 + 1400 * np.sin(np.pi * k) ** 1.5
    x = sweep(x, fc, 'low', 256, 3) + 0.25 * bp(rng.standard_normal(n), 500, 2200) * np.sin(np.pi * k)
    return fade(soft(x * np.sin(np.pi * k) ** 0.6, 2.0), 0.02, 0.2)

def chirp(f0, f1, dur=0.12):
    n = int(dur * SR); t = tt(n); k = t / dur
    f = f0 + (f1 - f0) * k + 90 * np.sin(2 * np.pi * 38 * t)
    return fade(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * k) ** 0.7, 0.003, 0.02)

def blip(f0, f1, dur=0.16):
    n = int(dur * SR); t = tt(n); k = t / dur
    f = f0 + (f1 - f0) * (1 - np.exp(-k * 6))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.05) + 0.4 * hp(rng.standard_normal(n), 3000) * np.exp(-t / 0.004)
    return fade(x, 0.0004, 0.02)

def flap(dur=0.5):
    n = int(dur * SR); t = tt(n)
    th = np.sin(2 * np.pi * (52 + 18 * np.exp(-t / 0.08)) * t) * np.exp(-t / 0.14)
    ns = lp(rng.standard_normal(n), 420, 2) * np.sin(np.pi * np.minimum(1, t / 0.32)) ** 1.5 * np.exp(-t / 0.2)
    return fade(soft(th * 0.9 + ns * 1.3, 1.4), 0.004, 0.08)

def rumble(dur, fc=140):
    n = int(dur * SR); k = np.linspace(0, 1, n)
    x = lp(rng.standard_normal(n), fc, 2) * (np.sin(np.pi * k) ** 0.8)
    return fade(x, 0.01, 0.1)

def swirl(dur, f0=150, f1=1500, lfo=3.0):
    n = int(dur * SR); t = tt(n); k = np.linspace(0, 1, n)
    x = noise_riser(dur, f0 * 2, f1 * 5, 1.2, 150) * (0.65 + 0.35 * np.sin(2 * np.pi * lfo * t))
    return x

SC = [hz(n) for n in ['D3', 'Eb3', 'F#3', 'G3', 'A3', 'Bb3', 'C4', 'D4', 'Eb4', 'F#4', 'G4', 'A4', 'Bb4', 'C5', 'D5', 'Eb5', 'F#5', 'G5', 'A5', 'D6']]
def chord_pad(notes, t0, dur, level=0.5, cutoff=1500, atk=0.6, rel=0.9, rm=0.3, hl=0.8):
    l, r = pad([hz(n) for n in notes], dur, cutoff=cutoff, atk=min(atk, dur * 0.5), rel=min(rel, dur * 0.45), det=7, level=1.0)
    place_st(l, r, t0, level, rm=rm, hl=hl)

# helpers for grooves --------------------------------------------------------
def hats16(tb, g=0.11, bars=1):
    for b in range(bars):
        for s in range(16):
            place(hat(), tb + b * BAR + s * BEAT / 4, g * (0.75 if s % 2 else 1.0), 0.35 * (1 if s % 4 < 2 else -1))
        for q in range(4): place(hat(True), tb + b * BAR + q * BEAT + BEAT / 2, g * 0.8, -0.3)
def four_floor(tb, bars=1, vel=1.0, skip_first=False):
    for b in range(bars):
        for q in range(4):
            if skip_first and b == 0 and q == 0: continue
            K(tb + b * BAR + q * BEAT, vel)
def backbeat(tb, bars=1, g=0.40):
    for b in range(bars):
        for q in (1, 3):
            place(clap(), tb + b * BAR + q * BEAT, g, 0.1, rm=0.18); place(snare(0.28, 185), tb + b * BAR + q * BEAT, g * 0.4, 0)
def bassline(tb, notes, g=0.36, cutoff=480):
    for i, nm in enumerate(notes):
        place(bass_note(hz(nm), BEAT / 2 * 0.92, cutoff + 160 * (i % 2), 0.55), tb + i * BEAT / 2, g, 0, sc=True)
def snare_roll(t0, dur, n0=8, g0=0.14, g1=0.34):
    t = 0.0; i = 0; gap = BEAT / 2
    while t < dur - 0.02:
        place(snare(0.14, 200 + 10 * i), t0 + t, g0 + (g1 - g0) * t / dur, 0)
        t += gap; gap = max(0.045, gap * 0.86); i += 1
def drum_gap(t, w=0.117):               # a hair of silence before a hit (applied in the mix)
    GAPS.append(t)
GAPS = []

# ═════════════════════════════════════════════════════════════
#  1 · الفراغ  0 – 7.5
# ═════════════════════════════════════════════════════════════
D2_, A2_, D3_ = hz('D2'), hz('A2'), hz('D3')
chord_pad(['D2', 'A2', 'D3'], 0.3, 7.4, 0.42, 520, atk=3.2, rel=1.0, rm=0.2, hl=0.6)
place(bell(hz('A5'), 3.2, 3.5, 2.0, 1.1), CU['T_POINT'], 0.20, 0, rm=0.5, hl=1.0)                # the point
place(bell(hz('D6'), 3.0, 2.0, 1.4, 1.2), CU['T_POINT'] + 0.012, 0.07, 0.3, hl=1.0)
place(noise_riser(CU['T_CRACK'] - CU['T_LINE0'], 300, 10000, 2.4), CU['T_LINE0'], 0.22, 0, rm=0.2)   # the hairline races out
place(tone_sweep(CU['T_CRACK'] - CU['T_LINE0'], 200, 2800, 'sin', 2.4), CU['T_LINE0'], 0.12, 0, rm=0.3)
tc = CU['T_CRACK']
place(glass(1.5), tc, 0.34, 0, rm=0.3, hl=0.5)                                                      # the tear
place(boom(2.8, 66, 30, 0.35), tc, 0.62, 0, rm=0.2, hl=0.6)
for ev in CU['crack']:                                                                              # crackle follows the fissure itself
    f = 1500 + 3.0 * ev['len'] * 8
    place(tick(min(f, 6500)), ev['t'], (0.10 if ev['lvl'] == 0 else 0.07), np.clip(ev['x'] / 900, -0.9, 0.9), rm=0.25)
place(rumble(2.4, 90), tc + 0.2, 0.28, 0, hl=0.4)
tb_ = CU['T_BURST']
place(noise_riser(tb_ - 4.6, 200, 5000, 2.8), 4.6, 0.10, 0, rm=0.2)                                 # tension before the burst
place(boom(3.2, 76, 28, 0.95), tb_, 0.95, 0, rm=0.2, hl=0.7)
place(crash(3.0), tb_, 0.30, 0, rm=0.3, hl=0.6)
place(glass(1.0, 2000, 8000), tb_ + 0.02, 0.25, 0, rm=0.3)
place(whoosh(1.5, False, 7000, 300), tb_ + 0.05, 0.16, 0, rm=0.3)
for _ in range(34):                                                                                   # paper pieces fluttering past
    place(bp(rng.standard_normal(int(0.05 * SR)), 1800, 6500) * np.hanning(int(0.05 * SR)), tb_ + 0.1 + rng.uniform(0, 1.4), rng.uniform(0.04, 0.10), rng.uniform(-0.9, 0.9), rm=0.25)
chord_pad(['D3', 'A3', 'F#3', 'C4'], 5.85, 1.7, 0.45, 2200, atk=1.0, rel=0.3, rm=0.3, hl=0.9)         # the sky opens
place(noise_riser(1.65, 400, 9000, 2.0), 5.85, 0.16, 0, rm=0.2)
drum_gap(7.5)

# ═════════════════════════════════════════════════════════════
#  2 · الداخل  7.5 – 15   (the cube draws itself, then becomes matter)
# ═════════════════════════════════════════════════════════════
t0 = 7.5
place(boom(2.2, 70, 34, 0.5), t0, 0.60, 0, rm=0.2, hl=0.6)
chord_pad(['D2', 'A2', 'D3'], t0, 3.8, 0.5, 700, atk=0.6, rel=0.6, rm=0.2, hl=0.7)
stroke_notes = ['D4', 'F#4', 'A4', 'D5', 'C5', 'Bb4', 'A4', 'G4', 'F#5', 'A5', 'D6', 'F#6' if False else 'A5']
for k, tw in enumerate(CU['wire']):
    nm = stroke_notes[k]
    place(pluck(hz(nm), 1.5, 0.55, 1.0), tw, 0.32, -0.5 + 0.09 * k, rm=0.25, hl=0.55, dl=0.4)
    place(tick(3200), tw + CU['wireDur'], 0.07, 0.5 * np.sin(k), rm=0.2)
for q in range(12):                                                                                 # hats on the 16ths of the drawing
    place(hat(), CU['wire'][0] + q * CU['BEAT'] / 4 + CU['BEAT'] / 8, 0.07, 0.3)
tS = CU['T_SOLID']
place(noise_riser(tS - 10.0, 300, 11000, 2.3), 10.0, 0.30, 0, rm=0.15)                              # charge
place(tone_sweep(tS - 10.0, 160, 3400, 'saw', 2.4), 10.0, 0.06, 0, rm=0.2)
for b in range(3): place(heart(), 10.0 + b * BEAT * 1.0, 0.5, 0, rm=0.1)
place(boom(2.8, 76, 30, 0.9), tS, 0.92, 0, rm=0.1, hl=0.5)                                          # it becomes matter
place(crash(2.6), tS, 0.30, 0, rm=0.3, hl=0.5)
for nm, gp in [('D4', .2), ('A4', .18), ('D5', .18), ('F#5', .16), ('A5', .14)]:
    place(bell(hz(nm), 2.8, 3.5, 1.6, 1.2), tS, gp, rng.uniform(-.4, .4), rm=0.4, hl=0.9)
K(tS, 1.0)
lead_A = [(0, 'D5'), (3, 'F#5'), (5, 'Eb5'), (6, 'D5'), (8, 'C5'), (10, 'Bb4'), (12, 'A4')]
bass_A = ['D2', 'D2', 'D3', 'D2', 'D2', 'A2', 'D2', 'C3']
def lead(tb, pat, g=0.40):
    for step, nm in pat:
        f = hz(nm)
        place(pluck(f, 1.1, 0.5, 1.0), tb + step * BEAT / 4, g, 0.25, rm=0.2, hl=0.35, dl=0.45)
        place(pluck(f * 2, 0.5, 0.25, 0.7), tb + step * BEAT / 4, g * 0.33, -0.25, rm=0.1)
tb = tS
four_floor(tb, 1, 1.0, skip_first=True); backbeat(tb, 1); hats16(tb, 0.10); bassline(tb, bass_A); lead(tb, lead_A)
tb = tS + BAR
four_floor(tb, 1); backbeat(tb, 1); hats16(tb, 0.11); bassline(tb, ['D2', 'D2', 'D3', 'D2', 'Eb2', 'D2', 'A2', 'C3'])
lead(tb, [(0, 'D5'), (2, 'F#5'), (4, 'A5'), (6, 'G5'), (7, 'F#5'), (8, 'Eb5'), (10, 'D5'), (12, 'Eb5'), (13, 'D5'), (14, 'C5'), (15, 'D5')])
tb = tS + 2 * BAR                                                                                    # 15.0 − BAR: build bar
four_floor(tb, 1); hats16(tb, 0.12); bassline(tb, bass_A)
place(noise_riser(BAR - 0.117, 400, 11000, 2.2), tb, 0.30, 0, rm=0.15)
snare_roll(tb + 2 * BEAT, 2 * BEAT - 0.117)
chord_pad(['D3', 'A3', 'F#4'], tS, 3.6, 0.40, 1900, atk=0.3, rel=0.4, rm=0.3, hl=0.7)
drum_gap(15.0)

# ═════════════════════════════════════════════════════════════
#  3 · الانقسام  15 – 22.5   (1 → 8 → 64 → 512, and the ideas leave)
# ═════════════════════════════════════════════════════════════
sp = CU['splits']
place(boom(2.8, 80, 28, 1.0), sp[0], 1.0, 0, rm=0.1, hl=0.5); place(crash(2.8), sp[0], 0.34, 0, rm=0.3, hl=0.5)
K(sp[0], 1.0)
for i, (ts, notes, g) in enumerate([(sp[1], ['A4', 'D5', 'F#5'], 0.5), (sp[2], ['D5', 'A5', 'D6', 'F#6' if False else 'C6'], 0.62)]):
    place(boom(1.6, 78 + 6 * i, 32, 0.6), ts, g, 0, rm=0.1, hl=0.4)
    for nm in notes: place(bell(hz(nm), 2.2, 3.5, 1.6, 1.0), ts, 0.16, rng.uniform(-.5, .5), rm=0.3, hl=0.8)
    place(clap(), ts, 0.3, 0, rm=0.3)
lead_B = [(0, 'D5'), (2, 'F#5'), (4, 'A5'), (6, 'G5'), (7, 'F#5'), (8, 'Eb5'), (10, 'D5'), (12, 'Eb5'), (13, 'D5'), (14, 'C5'), (15, 'D5')]
for bar in range(3):
    tb = 15.0 + bar * BAR
    four_floor(tb, 1, 1.0, skip_first=(bar == 0)); backbeat(tb, 1); hats16(tb, 0.11)
    bassline(tb, bass_A if bar % 2 == 0 else ['D2', 'D2', 'D3', 'D2', 'Eb2', 'D2', 'A2', 'C3'])
    if bar >= 1: lead(tb, lead_B, 0.34)
chord_pad(['D3', 'A3', 'F#4', 'C5'], 15.0, 5.6, 0.34, 2100, atk=0.2, rel=0.5, rm=0.3, hl=0.7)
# the ideas, each with its own voice
ID = {i['name']: i['t'] for i in CU['ideas']}
ts = ID['stairs']
for k, nm in enumerate(['D4', 'F#4', 'A4', 'D5', 'F#5', 'A5', 'D6']):
    place(pluck(hz(nm), 0.9, 0.4, 1.0), ts + k * 0.095, 0.30, -0.6 + 0.2 * k / 3, rm=0.25, hl=0.5, dl=0.4)      # a spiral of notes
place(noise_riser(1.2, 400, 6000, 1.0), ts, 0.07, 0, rm=0.3)
ts = ID['tree']
for nm in ['D4', 'A4', 'D5', 'F#5']: place(bell(hz(nm), 2.6, 3.5, 1.5, 1.1), ts + 0.2, 0.15, rng.uniform(-.4, .4), rm=0.3, hl=0.9)
place(boom(1.2, 70, 40, 0.3), ts, 0.30, 0, rm=0.2)
for k in range(8): place(tick(1800 + 260 * k), ts + 0.1 + k * 0.11, 0.06, 0.5, rm=0.3)                          # leaves
place(blip(900, 2200), ID['balloonW'], 0.30, 0.5, rm=0.3, hl=0.4); place(blip(1000, 2400), ID['balloonW'] + 0.14, 0.18, 0.5, rm=0.3)
place(blip(520, 1300), ID['balloonB'], 0.30, -0.5, rm=0.3, hl=0.4); place(blip(600, 1500), ID['balloonB'] + 0.14, 0.18, -0.5, rm=0.3)
ta = ID['atom']
place(tone_sweep(1.2, 300, 3600, 'sin', 1.3), ta, 0.12, 0.0, rm=0.4, hl=0.6)
for k in range(5): place(bell(hz(['A5', 'D6', 'F#6' if False else 'C6', 'A5', 'D6'][k]), 1.6, 3.0, 2.0, 0.6), ta + 0.12 * k, 0.09, -0.6 + 0.3 * k, rm=0.3, hl=0.8)
tb_ = ID['birds']
for k in range(9): place(chirp(rng.uniform(2200, 3200), rng.uniform(3200, 4800), rng.uniform(0.08, 0.16)), tb_ + k * 0.17 + rng.uniform(0, 0.08), 0.10, rng.uniform(-0.8, 0.8), rm=0.3, hl=0.4)
place(bp(rng.standard_normal(int(1.2 * SR)), 900, 3500) * np.hanning(int(1.2 * SR)), tb_, 0.06, 0, rm=0.3)       # wing flutter
t4 = sp[3]
place(boom(1.8, 76, 34, 0.6), t4, 0.50, 0, rm=0.1, hl=0.5)
for nm in ['D5', 'A5', 'F#6' if False else 'D6']: place(bell(hz(nm), 2.4, 3.5, 1.4, 1.0), t4, 0.14, 0, rm=0.3, hl=0.8)
place(noise_riser(22.5 - 0.117 - t4, 300, 10000, 2.0), t4, 0.26, 0, rm=0.15)
snare_roll(22.5 - 1.0, 1.0 - 0.117)
drum_gap(22.5)

# ═════════════════════════════════════════════════════════════
#  4 · التنين  22.5 – 30
# ═════════════════════════════════════════════════════════════
T4 = CU['dragon']['T0']
place(boom(3.4, 70, 26, 1.0), T4, 1.0, 0, rm=0.1, hl=0.6)
place(crash(3.0), T4, 0.26, 0, rm=0.3, hl=0.6)
place(swirl(2.2, 180, 1800, 2.6), T4, 0.22, 0, rm=0.3, hl=0.4)                                         # the vortex
place(whoosh(1.2, True, 300, 6000), T4 + 0.6, 0.14, 0.3, rm=0.3)
chord_pad(['D2', 'A2', 'D3', 'F#3'], T4, 7.4, 0.40, 900, atk=0.5, rel=0.8, rm=0.3, hl=0.8)
brass_mel = [(0, 'D3', 2), (2, 'F#3', 1), (3, 'Eb3', 1), (4, 'D3', 2), (6, 'C3', 1), (7, 'D3', 1), (8, 'Bb2', 2), (10, 'A2', 1), (11, 'C3', 1), (12, 'D3', 4)]
for bar in range(4):
    tb = T4 + bar * BAR
    for q in (0, 2):
        if not (bar == 0 and q == 0): K(tb + q * BEAT, 1.0)
    place(snare(0.34, 175), tb + 2 * BEAT, 0.34, 0, rm=0.35); place(clap(), tb + 2 * BEAT, 0.30, 0, rm=0.4, hl=0.3)
    for s in range(8): place(hat(), tb + s * BEAT / 2 + BEAT / 4, 0.10, 0.3 * (1 if s % 2 else -1))
    bassline(tb, ['D2', 'D2', 'D2', 'F#2', 'D2', 'D2', 'Eb2', 'D2'] if bar % 2 == 0 else ['D2', 'D2', 'A2', 'D2', 'C3', 'D2', 'A2', 'C3'], 0.38, 420)
    for st, nm, ln in brass_mel[(bar * 3):(bar * 3) + 3]: pass
for st, nm, ln in brass_mel:
    place(brass(hz(nm), ln * BEAT * 0.98, 520, 2200, 0.15), T4 + 0.0 + st * BEAT * 2 / 2, 0.20, 0.0, rm=0.3, hl=0.6, sc=True)   # slow hijaz horn line
# the head appears, the jaw opens: growls; the wings beat every 2π/5.2 s
for tg in (23.7, 26.3, 28.4): place(growl(1.5), tg, 0.42, 0, rm=0.25, hl=0.5)
Tf = 2 * np.pi / CU['dragon']['flapOmega']
tf = 23.9
while tf < 36.6:
    place(flap(), tf, 0.30, -0.3 if int((tf - 23.9) / Tf) % 2 else 0.3, rm=0.3, hl=0.3); tf += Tf
place(noise_riser(30 - 0.117 - 28.1, 300, 10000, 2.0), 28.1, 0.24, 0, rm=0.15)
snare_roll(29.0, 1.0 - 0.117)
drum_gap(30.0)

# ═════════════════════════════════════════════════════════════
#  5 · القلعة  30 – 37.5
# ═════════════════════════════════════════════════════════════
T5 = CU['castle']['T0']
place(boom(3.0, 72, 28, 1.0), T5, 1.0, 0, rm=0.1, hl=0.6); K(T5, 1.0)
place(rumble(4.6, 110), T5, 0.40, 0, hl=0.5)
rs, re_ = CU['castle']['riseStart'], CU['castle']['riseEnd']
rr = np.random.default_rng(31)
for k in range(70):                                                                                   # blocks laid, bottom to top
    u = k / 69; tk = T5 + rs + (re_ - rs) * u ** 1.15 + rr.uniform(0, 0.03)
    place(stone(hz('D3') * 2 ** (u * 2.2) * rr.choice([1, 1.0595, 1.26, 1.335]) * 0.5), tk, 0.14 + 0.10 * u, rr.uniform(-.7, .7), rm=0.25)
    if k % 3 == 0:
        place(pluck(SC[min(len(SC) - 1, int(u * 15) + 2)], 0.8, 0.35, 1.0), tk, 0.14, rr.uniform(-.5, .5), rm=0.25, hl=0.5, dl=0.4)
four_floor(T5 + 0.0, 1, 0.9, skip_first=True)
for bar in range(1, 4):
    tb = T5 + bar * BAR
    four_floor(tb, 1, 0.95); backbeat(tb, 1, 0.34); hats16(tb, 0.10)
    bassline(tb, ['D2', 'D2', 'D3', 'D2', 'D2', 'A2', 'D2', 'C3'] if bar % 2 else ['D2', 'D2', 'D3', 'D2', 'Eb2', 'D2', 'A2', 'C3'], 0.36, 500)
    lead(tb, lead_B if bar % 2 else lead_A, 0.30)
chord_pad(['D3', 'A3', 'F#4', 'D5'], T5, BAR, 0.34, 2100, atk=0.3, rel=0.3)
chord_pad(['Eb3', 'Bb3', 'G4', 'Eb5'], T5 + BAR, BAR, 0.34, 2100, atk=0.3, rel=0.3)
chord_pad(['C3', 'G3', 'Eb4', 'C5'], T5 + 2 * BAR, BAR, 0.34, 2100, atk=0.3, rel=0.3)
chord_pad(['D3', 'A3', 'D4', 'F#4'], T5 + 3 * BAR, BAR, 0.34, 2100, atk=0.3, rel=0.3)
for nm in ['D5', 'A5', 'D6']: place(bell(hz(nm), 3.0, 3.5, 1.4, 1.2), T5 + 2.7, 0.14, 0, rm=0.3, hl=1.0)     # the keep's roof closes
place(noise_riser(37.5 - 0.117 - 36.0, 300, 11000, 2.2), 36.0, 0.26, 0, rm=0.15)
snare_roll(36.6, 0.9 - 0.117, g0=0.18, g1=0.36)
drum_gap(37.5)

# ═════════════════════════════════════════════════════════════
#  6 · الفريقان  37.5 – 45
# ═════════════════════════════════════════════════════════════
T6 = CU['rival']['T0']
place(boom(4.0, 60, 24, 1.0), T6, 1.0, 0, rm=0.1, hl=0.8)
place(glass(1.8, 1800, 9000), T6, 0.30, 0, rm=0.3, hl=0.5)
place(crash(3.2)[::-1], T6 - 2.0, 0.0, 0, rm=0.0)
place(whoosh(2.2, False, 9000, 200), CU['rival']['wipe0'], 0.24, 0.0, rm=0.3, hl=0.4)                 # the world divides
place(swirl(2.1, 800, 300, 1.2), CU['rival']['wipe0'], 0.10, 0.4, rm=0.3)
chord_pad(['D2', 'A2', 'Eb3', 'D3'], T6, 7.5, 0.46, 650, atk=1.0, rel=1.0, rm=0.3, hl=0.9)           # dark drone with a minor-second sting
place(sub_note(hz('D1') if False else 36.7, 7.2) * 0.9, T6, 0.50, 0)
for bar in range(4):
    tb = T6 + bar * BAR
    taiko_pat = [(0, 1.0), (1.5, 0.55), (3, 0.8)] if bar < 2 else [(0, 1.0), (1, 0.6), (2, 0.8), (3, 0.6), (3.5, 0.5)]
    for bt, v in taiko_pat:
        if bar == 0 and bt == 0: continue
        place(taiko(), tb + bt * BEAT, 0.62 * v, 0, rm=0.35, hl=0.5)
march0 = CU['rival']['march']
t = march0
step = BEAT
while t < 45.8:                                                                                     # the march: stomps, then faster
    u = (t - march0) / (45.8 - march0)
    place(stone(95 + 20 * np.sin(t * 7)), t, 0.16 + 0.16 * u, rng.uniform(-0.5, 0.5), rm=0.3)
    place(bp(rng.standard_normal(int(0.07 * SR)), 300, 1800) * np.exp(-tt(int(0.07 * SR)) / 0.02), t + 0.001, 0.12 + 0.1 * u, rng.uniform(-0.6, 0.6), rm=0.3)
    t += step * (0.5 if u > 0.55 else 1.0)
place(brass(hz('D3'), 4.7, 380, 2300, 1.4), march0, 0.22, 0, rm=0.35, hl=0.9)
place(brass(hz('A2'), 4.7, 380, 1800, 1.4), march0, 0.15, 0, rm=0.35, hl=0.9)
place(brass(hz('Eb3'), 2.1, 380, 2000, 0.8), 43.125, 0.20, 0, rm=0.35, hl=0.9)
place(brass(hz('F#3'), 2.1, 380, 2200, 0.8), 43.125, 0.14, 0, rm=0.35, hl=0.9)
snare_roll(43.9, 45.0 - 43.9 - 0.05, g0=0.10, g1=0.30)
place(noise_riser(1.1, 300, 8000, 2.0), 43.9, 0.12, 0, rm=0.2)

# ═════════════════════════════════════════════════════════════
#  7 · الاصطدام  45 – 52.5
# ═════════════════════════════════════════════════════════════
c = CU['clash']
for q in range(2): place(heart(), 45.0 + q * BEAT, 0.8, 0, rm=0.2)
chord_pad(['D2', 'A2', 'Eb3'], 45.0, 2.0, 0.40, 700, atk=0.4, rel=0.5, rm=0.3, hl=0.8)
# the charge: tom roll accelerating to a blur, plus a rising saw
t = 45.8; gap_ = BEAT / 2; i = 0
while t < c['slow0'] + 0.02:
    place(taiko(0.5, 140 - 2 * i, 60, 0.4), t, 0.40 + 0.015 * i, rng.uniform(-.3, .3), rm=0.3); t += gap_; gap_ = max(0.05, gap_ * 0.90); i += 1
place(tone_sweep(c['slow0'] - 45.8, 80, 1900, 'saw', 2.0), 45.8, 0.12, 0, rm=0.2)
place(noise_riser(c['slow0'] - 45.8, 300, 10000, 2.2), 45.8, 0.22, 0, rm=0.15)
# bullet time: a low swell sits under the whole slow zone (the warp will drag it down further)
place(sub_note(hz('D2'), 4.0) * 0.9, c['slow0'] + 0.1, 0.45, 0)
chord_pad(['D2', 'A2', 'D3', 'Eb3'], c['slow0'], 3.6, 0.46, 900, atk=0.3, rel=1.0, rm=0.3, hl=1.0)
# THE IMPACT
tI = c['TCR']
place(boom(4.4, 82, 24, 1.0), tI, 1.0, 0, rm=0.1, hl=0.8)
place(crash(3.6), tI, 0.34, 0, rm=0.3, hl=0.6)
place(glass(2.0, 1500, 9000), tI, 0.34, 0, rm=0.3, hl=0.6)
place(clap(), tI, 0.4, 0, rm=0.4, hl=0.5)
K(tI, 1.0, sc=True)
for nm in ['D2', 'A2', 'D3']: place(sub_note(hz(nm), 3.0, glide_from=hz(nm) * 1.6), tI, 0.30, 0)
# the wave of impact running back through the ranks
for rk, tr in enumerate(c['ranks']):
    g = 0.34 * (1 - 0.06 * rk)
    place(bp(rng.standard_normal(int(0.3 * SR)), 250, 4200) * np.exp(-tt(int(0.3 * SR)) / 0.05), tr, g, rng.uniform(-.7, .7), rm=0.35, hl=0.3)
    place(taiko(0.6, 150, 55, 0.7), tr, g * 0.9, rng.uniform(-.4, .4), rm=0.3)
    for _ in range(14): place(stone(rng.uniform(300, 1800), 0.12), tr + rng.uniform(0, 0.25), rng.uniform(0.04, 0.10), rng.uniform(-.9, .9), rm=0.25)
place(noise_riser(c['fast1'] - c['fast0'] + 0.3, 200, 9000, 1.8), c['fast0'] - 0.1, 0.20, 0, rm=0.2)      # time comes back
place(whoosh(0.5, False, 9000, 200), c['fast1'], 0.20, 0, rm=0.3)
# the debris rain: a decaying scatter of clatter
for k in range(190):
    tk = 49.8 + 2.6 * (1 - np.exp(-rng.exponential(0.9) / 1.2)) if False else 49.8 + rng.exponential(0.85)
    if tk > 52.3: continue
    place(stone(rng.uniform(180, 1400), 0.14), tk, rng.uniform(0.05, 0.14) * np.exp(-(tk - 49.8) / 1.6), rng.uniform(-.9, .9), rm=0.3)
place(rumble(3.0, 160), 49.9, 0.30, 0, hl=0.4)
chord_pad(['D2', 'A2', 'F#3', 'C4'], 50.2, 2.6, 0.40, 1200, atk=1.2, rel=0.8, rm=0.3, hl=1.0)

# ═════════════════════════════════════════════════════════════
#  8 · العودة  52.5 – 60
# ═════════════════════════════════════════════════════════════
u = CU['unity']
place(swirl(u['T_CUBE'] - u['T0'], 150, 2400, 3.4), u['T0'], 0.24, 0, rm=0.3, hl=0.5)
place(tone_sweep(u['T_CUBE'] - u['T0'], 120, 1600, 'sin', 1.8), u['T0'], 0.14, 0, rm=0.3, hl=0.6)
place(noise_riser(u['T_CUBE'] - u['T0'], 300, 11000, 2.4), u['T0'], 0.20, 0, rm=0.15)
chord_pad(['D3', 'A3', 'F#4'], u['T0'] + 0.4, 2.1, 0.40, 1500, atk=1.6, rel=0.2, rm=0.3, hl=1.0)
drum_gap(u['T_CUBE'])
tcb = u['T_CUBE']
place(boom(3.0, 70, 30, 0.6), tcb, 0.80, 0, rm=0.1, hl=0.8); place(crash(2.8), tcb, 0.20, 0, rm=0.3, hl=0.7)
for nm, gp in [('D4', .20), ('A4', .18), ('D5', .18), ('F#5', .16), ('A5', .14), ('D6', .10)]:
    place(bell(hz(nm), 3.2, 3.5, 1.6, 1.4), tcb, gp, rng.uniform(-.5, .5), rm=0.4, hl=1.0)
K(tcb, 0.8)
chord_pad(['D2', 'A2', 'D3', 'F#3', 'A3'], tcb, 5.4, 0.50, 1600, atk=0.5, rel=1.5, rm=0.3, hl=1.0)
place(sub_note(hz('D2'), 5.0) * 0.9, tcb, 0.40, 0)
motif = ['D5', 'Eb5', 'F#5', 'A5', 'F#5', 'Eb5', 'D5', 'C5']
for k in range(10):
    tk = tcb + 0.6 + k * BEAT
    place(pluck(hz(motif[k % 8]), 1.8, 0.8, 1.0), tk, 0.22, -0.3 + 0.07 * k, rm=0.3, hl=0.9, dl=0.5)
t1 = u['T_TXT1']
place(boom(2.2, 62, 30, 0.4), t1, 0.45, 0, rm=0.2, hl=1.0)
place(swirl(1.2, 300, 2500, 2.0), t1 - 0.3, 0.10, 0, rm=0.3)
chord_pad(['D3', 'A3', 'D4', 'F#4', 'A4', 'C5'], t1, 2.2, 0.46, 2400, atk=0.5, rel=0.9, rm=0.3, hl=1.0)
t2 = u['T_TXT2']
place(whoosh(0.7, True, 400, 7000), t2 - 0.6, 0.12, 0, rm=0.3)
for nm in ['Eb5', 'D5']: place(pluck(hz(nm), 2.4, 0.9, 1.0), t2 + (0 if nm == 'Eb5' else BEAT / 2), 0.26, 0.2, rm=0.3, hl=0.9, dl=0.4)      # hijaz cadence E♭ → D
chord_pad(['Eb3', 'Bb3', 'G4'], t2, 0.5, 0.30, 2000, atk=0.1, rel=0.2)
chord_pad(['D3', 'A3', 'D4', 'F#4', 'A4', 'D5'], t2 + BEAT / 2, 2.2, 0.55, 2600, atk=0.35, rel=1.2, rm=0.3, hl=1.0)
for nm in ['D6', 'A5', 'F#5', 'D5']: place(bell(hz(nm), 3.4, 3.5, 1.2, 1.6), t2 + BEAT / 2, 0.11, rng.uniform(-.5, .5), rm=0.3, hl=1.0)
for i, nm in enumerate(['D6', 'A5', 'F#5', 'D5', 'A4']): place(bell(hz(nm), 2.8, 3.5, 1.0, 1.4), u['T_WHITE'] + i * BEAT / 4, 0.08, -0.4 + 0.2 * i, hl=1.0)

# ═════════════════════════════════════════════════════════════
#  the two forces + the camera's cuts   (added with the black-space revision)
# ═════════════════════════════════════════════════════════════
def tone_drone(f, dur, pan, level, cutoff=900, det=5):
    n = int(dur * SR); t = tt(n)
    x = np.zeros(n)
    for c in (-det, 0, det):
        ph = 2 * np.pi * np.cumsum(np.full(n, f * 2 ** (c / 1200))) / SR
        x += sg.sawtooth(ph) * 0.6 + np.sin(ph) * 0.5
    x = lp(x / 3, cutoff, 2) * np.minimum(1, t / 1.2) * np.minimum(1, (dur - t) / 1.0)
    return x

# 22.5 — the world flips: a four-frame stutter, a shove of sub, a reversed shimmer into the cut
tf = 22.5
for k in range(4):
    place(bp(rng.standard_normal(int(0.03 * SR)), 1500, 9000) * np.hanning(int(0.03 * SR)), tf + k / 60.0, 0.30, (-1) ** k * 0.6, rm=0.1)
place(crash(2.0)[::-1], tf - 2.0, 0.20, 0, rm=0.2, hl=0.5)
place(sub_note(hz('D2'), 2.4, glide_from=hz('D2') * 2.0), tf, 0.60, 0)
# purple (left) and red (right): a minor second apart for the whole dark world, then they converge on D
place(tone_drone(hz('D3'), 29.0, -0.7, 1.0, 800), 22.5, 0.17, -0.7, rm=0.3, hl=0.9)
place(tone_drone(hz('Eb3'), 29.0, 0.7, 1.0, 800), 22.5, 0.17, 0.7, rm=0.3, hl=0.9)
n_ = int(2.4 * SR); k_ = np.linspace(0, 1, n_)
glide = sg.sawtooth(2 * np.pi * np.cumsum(hz('Eb3') * (hz('D3') / hz('Eb3')) ** (k_ ** 1.6)) / SR) * 0.5
place(lp(glide, 900, 2) * np.minimum(1, k_ * 20) * np.minimum(1, (1 - k_) * 12), 52.3, 0.20, 0.7, rm=0.3, hl=0.9)   # red slides down into D
# every camera cut / move gets a breath: a short whoosh into the beat and a soft knock on it
for tcut in (24.375, 26.25, 28.125, 39.6, 43.8, 45.0):
    place(whoosh(0.42, True, 600, 9000), tcut - 0.40, 0.13, 0, rm=0.3)
    place(boom(0.7, 90, 46, 0.35), tcut, 0.28, 0, rm=0.15)
# the orbit around the armies: a slow filtered sweep that turns with the camera
place(swirl(4.2, 400, 2400, 0.45), 39.6, 0.10, 0.0, rm=0.3, hl=0.4)
# the cube's own orbit (7.5 → 15): a rising pad that follows the camera
place(swirl(7.0, 250, 1800, 0.3), 7.8, 0.06, 0.0, rm=0.3, hl=0.4)

# ═════════════════════════════════════════════════════════════
#  MIX
# ═════════════════════════════════════════════════════════════
sc = np.ones(N)
for kt in KICKS:
    i = int(kt * SR); m = int(0.24 * SR)
    if i >= N: continue
    env = 1 - 0.70 * np.exp(-np.arange(min(m, N - i)) / (0.075 * SR)) * np.minimum(1, np.arange(min(m, N - i)) / (0.004 * SR))
    sc[i:i + len(env)] = np.minimum(sc[i:i + len(env)], env)
dry.L += music_sc.L * sc; dry.R += music_sc.R * sc

gap = np.ones(N)
for tdrop in GAPS:
    td = W(tdrop)
    a, b = int((td - 0.117) * SR), int(td * SR)
    f0 = int(0.006 * SR)
    if a - f0 < 0 or b >= N: continue
    gap[a - f0:a] = np.linspace(1, 0, f0); gap[a:b] = 0.0; gap[b - 90:b] = np.linspace(0, 1, 90)
dry.L *= gap; dry.R *= gap
for bus in (room, hall, dly):
    bus.L *= (0.25 + 0.75 * gap); bus.R *= (0.25 + 0.75 * gap)

def pingpong(bus, fb=0.42, dt=0.75 * BEAT):
    d = int(dt * SR); L = bus.L.copy(); R = bus.R.copy()
    outL = np.zeros(N); outR = np.zeros(N)
    cur = (L + R) * 0.5
    for k in range(1, 7):
        s = k * d
        if s >= N: break
        g = fb ** k
        tgt = outL if k % 2 else outR
        tgt[s:] += cur[:N - s] * g
    return lp(outL, 6500, 1), lp(outR, 6500, 1)
dlL, dlR = pingpong(dly)
irR = make_ir(0.85, 0.012, 6500, 3); irH = make_ir(3.4, 0.028, 4200, 9)
def rev(bus, ir): return fftconvolve(bus.L, ir[0])[:N], fftconvolve(bus.R, ir[1])[:N]
rrL, rrR = rev(room, irR); hhL, hhR = rev(hall, irH)
L = dry.L + 0.55 * rrL + 0.55 * hhL + 0.5 * dlL
R = dry.R + 0.55 * rrR + 0.55 * hhR + 0.5 * dlR

# BULLET TIME: the whole mix is read through the picture's own time-warp (tape-slow, pitch drops with it)
idx = np.interp(np.arange(N) / SR, np.arange(len(WARP)) * WARP_DT, WARP) * SR
idx = np.clip(idx, 0, N - 1.001)
i0 = np.floor(idx).astype(int); fr = idx - i0
L = L[i0] * (1 - fr) + L[i0 + 1] * fr; R = R[i0] * (1 - fr) + R[i0 + 1] * fr

# dynamics of the piece
knots = [(0, 0.80), (2.8, 0.95), (3.0, 1.05), (5.4, 1.0), (5.55, 1.15), (7.4, 1.0), (7.5, 0.90), (11.2, 0.95), (11.25, 1.12), (14.9, 1.08), (15.0, 1.15),
         (22.4, 1.15), (22.5, 1.15), (29.9, 1.10), (30.0, 1.12), (37.4, 1.10), (37.5, 1.10), (44.9, 1.0), (45.0, 0.95), (47.4, 1.0), (47.5, 1.22), (50.5, 1.0), (52.4, 0.95), (54.5, 0.95), (54.65, 1.10), (58.0, 1.0), (60.0, 0.9)]
gt = np.interp(np.arange(N) / SR, [k[0] for k in knots], [k[1] for k in knots])
L *= gt; R *= gt

L = hp(L, 28, 2); R = hp(R, 28, 2)
L = L - 0.30 * lp(L, 105, 2) + 0.28 * hp(L, 3200, 2); R = R - 0.30 * lp(R, 105, 2) + 0.28 * hp(R, 3200, 2)
peak = max(np.max(np.abs(L)), np.max(np.abs(R)))
L, R = L / peak, R / peak
L = soft(L * 1.55, 1.25); R = soft(R * 1.55, 1.25)
peak = max(np.max(np.abs(L)), np.max(np.abs(R)))
L, R = L / peak * 0.85, R / peak * 0.85
fo = int(1.4 * SR); L[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2; R[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2
L[:300] *= np.linspace(0, 1, 300); R[:300] *= np.linspace(0, 1, 300)
out = np.stack([L, R], 1)
wavfile.write('audio.wav', SR, (out * 32767).astype(np.int16))
print('audio.wav written', out.shape, 'peak', np.max(np.abs(out)).round(3))
