#!/usr/bin/env python3
"""
Procedural score for the showreel — 128 BPM, D Hijaz (D E♭ F♯ G A B♭ C), 16 bars = 30.000 s.
Everything is synthesised with numpy/scipy; nothing is sampled.
The "Time" chapter is scored from the same τ(t) curve that drives the picture (timeline.json).
"""
import json, sys
import numpy as np
import scipy.signal as sg
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 44100
TLJ = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'timeline.json'))
BEAT, BAR, DUR = TLJ['BEAT'], TLJ['BAR'], TLJ['DUR']
N = int(round(SR * DUR))
TAU = np.array(TLJ['tau']); TAU_DT = TLJ['tau_dt']
rng = np.random.default_rng(20260929)
np.random.seed(20260929)

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

def place(x, t0, gain=1.0, pan=0.0, rm=0.0, hl=0.0, dl=0.0, sc=False):
    """put a mono sound in the mix with sends; sc=True → goes through the sidechain bus"""
    tgt = music_sc if sc else dry
    tgt.add(x, t0, gain, pan)
    if rm: room.add(x, t0, gain * rm, pan)
    if hl: hall.add(x, t0, gain * hl, pan)
    if dl: dly.add(x, t0, gain * dl, pan)

def place_st(xl, xr, t0, gain=1.0, rm=0.0, hl=0.0, sc=False):
    tgt = music_sc if sc else dry
    tgt.add(xl, t0, gain, xr=xr)
    if rm: room.add(xl, t0, gain * rm, xr=xr)
    if hl: hall.add(xl, t0, gain * hl, xr=xr)

# ── sidechain from the kick schedule ──────────────────────────
KICKS = []
def K(t0, vel=1.0, sc=True):
    place(kick(), t0, 0.70 * vel, 0, rm=0.04)
    if sc: KICKS.append(t0)

# ═════════════════════════════════════════════════════════════
#  ARRANGEMENT
# ═════════════════════════════════════════════════════════════
D2, A2, D3, E3, F3s, G3, A3, Bb3, C4, D4 = [hz(x) for x in ['D2', 'A2', 'D3', 'E3', 'F#3', 'G3', 'A3', 'Bb3', 'C4', 'D4']]
HIJ = ['D', 'Eb', 'F#', 'G', 'A', 'Bb', 'C']

# ---------- ch.1  نقطة  (0 – 3.75) ------------------------------------------------
# air + drone
def drone(t0, dur, level=1.0, cutoff=700):
    l, r = pad([hz('D2'), hz('A2'), hz('D3')], dur, cutoff=cutoff, atk=min(2.5, dur * 0.5), rel=min(2.0, dur * 0.4), det=6, level=level)
    place_st(l, r, t0, 0.5, rm=0.25, hl=0.5)
drone(0.2, 3.9, 0.55, 600)
# the heartbeat (matches the dot's pulses)
for tb, v in [(1 * BEAT, 1.0), (1.5 * BEAT, .55), (3 * BEAT, 1.0), (3.5 * BEAT, .55), (5 * BEAT, 1.0), (5.5 * BEAT, .55), (7 * BEAT, .8)]:
    place(heart(), tb, 0.70 * v, 0, rm=0.08)
# the dot appears — a glassy ping
place(bell(hz('A5'), 2.4, 3.5, 2.2, 0.9), 0.40, 0.30, 0, rm=0.5, hl=0.9)
place(bell(hz('D6'), 2.4, 2.0, 1.4, 1.1), 0.41, 0.10, 0.3, hl=0.9)
# caption breath
place(whoosh(0.9, True, 800, 5000), 1.0, 0.05, 0, rm=0.4)
# the line: riser to 2.78, then it collapses
place(noise_riser(0.63, 500, 9000, 2.0), 2.15, 0.30, 0, rm=0.25)
place(tone_sweep(0.63, 260, 2400, 'sin', 2.2), 2.15, 0.16, 0, rm=0.3)
place(boom(1.2, 90, 40, 0.3), 2.78, 0.35, 0, rm=0.3, hl=0.4)
place(whoosh(0.32, False, 6000, 400), 2.80, 0.12, 0, rm=0.3)
# compass drawing: quiet sweeping harmonic + closing chime
place(tone_sweep(0.55, 350, 1400, 'sin', 1.0), 2.95, 0.05, 0.4, rm=0.5)
for k, nm in enumerate(['D5', 'A5', 'D6']):
    place(bell(hz(nm), 2.6, 3.5, 2.0, 1.1), 3.50 + 0.01 * k, 0.22 - 0.05 * k, [-.3, 0, .3][k], rm=0.5, hl=1.0)
place(whoosh(0.75, True, 400, 9000)[::-1][::-1], 3.0, 0.10, 0, hl=0.4)

# ---------- ch.2  هندسة  (3.75 – 7.5) --------------------------------------------
t0 = T(2)
place(boom(2.0, 62, 34, 0.35), t0, 0.55, 0, rm=0.2, hl=0.5)
drone(t0, 3.75, 1.0, 900)
# 8 points, one 16th apart: ascending Hijaz run  D E♭ F♯ G A B♭ C D
pts = ['D4', 'Eb4', 'F#4', 'G4', 'A4', 'Bb4', 'C5', 'D5']
for k, nm in enumerate(pts):
    place(pluck(hz(nm), 1.6, 0.6, 1.0), t0 + k * BEAT / 4, 0.30 + 0.03 * k, -0.4 + 0.11 * k, rm=0.25, hl=0.5, dl=0.35)
# eight edges of the two squares
edges = ['D5', 'F#5', 'A5', 'D6', 'C6', 'Bb5', 'A5', 'F#5']
for k, nm in enumerate(edges):
    place(pluck(hz(nm), 1.3, 0.5, 1.0, pos=0.18), t0 + 2 * BEAT + k * BEAT / 4, 0.26, 0.5 * np.sin(k), rm=0.25, hl=0.5, dl=0.4)
# hats
for k in range(8):
    place(hat(), t0 + 2 * BEAT + k * BEAT / 2 + BEAT / 4, 0.10, 0.3)
# the star completes (bar 3, beat 1): chord + shock
tc = T(3)
for nm, gp in [('D4', .2), ('A4', .18), ('D5', .18), ('F#5', .16), ('A5', .14)]:
    place(bell(hz(nm), 2.8, 3.5, 1.6, 1.2), tc, gp, np.random.uniform(-.4, .4), rm=0.4, hl=0.9)
place(boom(1.6, 80, 38, 0.4), tc, 0.5, 0, rm=0.2, hl=0.4)
place(whoosh(0.6, False, 7000, 300), tc, 0.14, 0, rm=0.3)
# four-on-the-floor arrives with the lattice
for b in range(3):
    K(tc + b * BEAT, 0.85)
for b in range(4):
    for s in (0, 1, 2, 3):
        place(hat(), tc + b * BEAT + s * BEAT / 4, 0.09 if s % 2 else 0.14, 0.3 * (1 if s % 2 else -1))
    place(hat(True), tc + b * BEAT + BEAT / 2, 0.09, 0.4)
# snare roll on the last beat, accelerating
t = tc + 3 * BEAT
for i, s in enumerate(np.cumsum([0] + [BEAT / 4] * 2 + [BEAT / 8] * 4 + [BEAT / 16] * 4)[:10]):
    place(snare(0.16, 200 + 14 * i), t + s, 0.20 + 0.03 * i, 0)
# riser across the lattice reveal
place(noise_riser(BAR - 0.117, 400, 11000, 2.2), tc, 0.30, 0, rm=0.15)
place(tone_sweep(BAR - 0.117, 180, 3200, 'saw', 2.4), tc, 0.06, 0, rm=0.2)
# sub pulse under the build
for b in range(4):
    place(sub_note(hz('D2'), BEAT * 0.9), tc + b * BEAT, 0.34, 0, sc=True)

# ---------- ch.3  عمق  — THE DROP (7.5 – 11.25) ---------------------------------
td = T(4)
place(boom(2.6, 74, 30, 0.9), td, 0.9, 0, rm=0.1, hl=0.5)
place(crash(2.6), td, 0.30, 0, rm=0.3, hl=0.5)
K(td, 1.0)
lead_A = [(0, 'D5', 1), (3, 'F#5', 1), (5, 'Eb5', 1), (6, 'D5', 1), (8, 'C5', 1), (10, 'Bb4', 1), (12, 'A4', 2)]
lead_B = [(0, 'D5', 1), (2, 'F#5', 1), (4, 'A5', 1), (6, 'G5', 1), (7, 'F#5', 1), (8, 'Eb5', 1), (10, 'D5', 1), (12, 'Eb5', 1), (13, 'D5', 1), (14, 'C5', 1), (15, 'D5', 1)]
bass_A = ['D2', 'D2', 'D3', 'D2', 'D2', 'A2', 'D2', 'C3']
bass_B = ['D2', 'D2', 'D3', 'D2', 'Eb2', 'D2', 'A2', 'C3']
def drop_bar(tb, bass_pat, lead_pat, kick_on=True, hats=True, pad_notes=None):
    for b in range(4):
        if kick_on and not (tb == td and b == 0): K(tb + b * BEAT, 1.0)
    for b in (1, 3):
        place(clap(), tb + b * BEAT, 0.42, 0.1, rm=0.18)
        place(snare(0.28, 185), tb + b * BEAT, 0.16, 0)
    if hats:
        for s in range(16):
            place(hat(), tb + s * BEAT / 4, 0.10 if s % 2 else 0.15, 0.35 * (1 if s % 4 < 2 else -1))
        for b in range(4):
            place(hat(True), tb + b * BEAT + BEAT / 2, 0.11, -0.3)
    for i, nm in enumerate(bass_pat):
        place(bass_note(hz(nm), BEAT / 2 * 0.92, 480 + 160 * (i % 2), 0.55), tb + i * BEAT / 2, 0.36, 0, sc=True)
    for step, nm, ln in lead_pat:
        f = hz(nm)
        place(pluck(f, 1.1, 0.5, 1.0), tb + step * BEAT / 4, 0.42, 0.25, rm=0.2, hl=0.35, dl=0.45)
        place(pluck(f * 2, 0.5, 0.25, 0.7), tb + step * BEAT / 4, 0.14, -0.25, rm=0.1)
    if pad_notes:
        l, r = pad(pad_notes, BAR, cutoff=1900, atk=0.25, rel=0.4, det=8, level=1.0)
        place_st(l, r, tb, 0.35, rm=0.2, hl=0.5, sc=True)
drop_bar(td, bass_A, lead_A, pad_notes=[hz('D3'), hz('A3'), hz('D4'), hz('F#4')])
drop_bar(T(5), bass_B, lead_B, pad_notes=[hz('D3'), hz('A3'), hz('D4'), hz('G4')])
# lift into chapter 4 (whip)
place(whoosh(0.55, True, 500, 12000), T(5) + BAR - 0.55, 0.22, 0, rm=0.2)

# ---------- ch.4  حرف  (11.25 – 15.0) -------------------------------------------
tl = T(6)
card_times = [0, 2 * BEAT, 3 * BEAT, 4 * BEAT, 4.5 * BEAT, 5 * BEAT]
stab_notes = [['D4', 'A4', 'D5', 'F#5'], ['Eb4', 'G4', 'Bb4', 'Eb5'], ['G4', 'Bb4', 'D5', 'G5'], ['A4', 'C5', 'E5', 'A5'], ['C4', 'Eb4', 'G4', 'C5'], ['D4', 'A4', 'D5', 'F#5']]
for ci, ct in enumerate(card_times):
    tk = tl + ct
    place(clap(), tk, 0.36, 0.0, rm=0.2)
    place(snare(0.2, 210), tk, 0.14, 0)
    for nm in stab_notes[ci]:
        place(pluck(hz(nm), 0.7, 0.28, 1.0, pos=0.15), tk, 0.20, np.random.uniform(-.5, .5), rm=0.25, hl=0.25, dl=0.25)
    place(boom(0.7, 80, 45, 0.5), tk, 0.45 if ci else 0.7, 0, rm=0.05)
# groove under the cards
for b in range(8):
    if b in (0, 2, 3, 4, 5, 6):   K(tl + b * BEAT, 0.95)
    else:                         K(tl + b * BEAT, 0.85)
for s in range(24):
    place(hat(), tl + s * BEAT / 4, 0.09 if s % 2 else 0.13, 0.3)
for b in (0, 1, 2, 3, 4, 5):
    place(bass_note(hz(['D2', 'D2', 'Eb2', 'D2', 'G2', 'D2'][b]), BEAT * 0.9, 520, 0.6), tl + b * BEAT, 0.36, 0, sc=True)
# ¼-beat strobe: rising snare roll + an ascending scale, one note per flash
ts = tl + 6 * BEAT
run = ['D5', 'Eb5', 'F#5', 'G5', 'A5', 'Bb5', 'C6', 'D6']
for i, nm in enumerate(run):
    place(pluck(hz(nm), 0.35, 0.16, 1.0), ts + i * BEAT / 4, 0.26, -0.5 + i * 0.14, rm=0.2, dl=0.3)
    place(snare(0.12, 210 + 22 * i), ts + i * BEAT / 4, 0.16 + 0.03 * i, 0)
    place(kick(0.16, 150, 60), ts + i * BEAT / 4, 0.55, 0)
place(noise_riser(2 * BEAT, 500, 12000, 1.8), ts, 0.30, 0, rm=0.1)
place(tone_sweep(2 * BEAT, 300, 4000, 'saw', 1.8), ts, 0.05, 0)
KICKS.extend([ts + i * BEAT / 2 for i in range(4)])

# ---------- ch.5  تحوّل  (15.0 – 18.75) ------------------------------------------
tm = T(8)
place(boom(1.6, 70, 34, 0.6), tm, 0.7, 0, rm=0.2, hl=0.4)
place(crash(1.8), tm, 0.18, 0, hl=0.4)
# chords, slow: D → Eb (Hijaz colour) → resolving
def chord_pad(t0, notes, dur, lvl=1.0, cutoff=1800):
    l, r = pad([hz(n) for n in notes], dur, cutoff=cutoff, atk=0.5, rel=0.6, det=9, level=lvl)
    place_st(l, r, t0, 0.42, rm=0.3, hl=0.7, sc=True)
chord_pad(tm, ['D3', 'A3', 'D4', 'F#4'], BAR)
chord_pad(T(9), ['Eb3', 'Bb3', 'Eb4', 'G4'], BAR * 0.5 + 0.1)
chord_pad(T(9) + BAR * 0.5, ['C3', 'G3', 'C4', 'Eb4'], BAR * 0.5 + 0.1)
# half-time groove
for bar in (8, 9):
    tb = T(bar)
    K(tb, 0.95); K(tb + 2.5 * BEAT, 0.8)
    if bar == 8: K(tb + 1.5 * BEAT, 0.6)
    place(clap(), tb + 2 * BEAT, 0.34, 0, rm=0.3)
    place(snare(0.26, 180), tb + 2 * BEAT, 0.14, 0)
    for s in range(16):
        place(hat(), tb + s * BEAT / 4, 0.07 if s % 2 else 0.10, 0.3 * (-1) ** s)
# liquid wobble bass: portamento between notes, filter breathing
seq8 = [('D2', None), ('D2', None), ('A2', 'D2'), ('D2', 'A2'), ('D2', None), ('A2', 'D2'), ('C3', 'A2'), ('D2', 'C3')]
seq9 = [('Eb2', 'D2'), ('Eb2', None), ('Bb2', 'Eb2'), ('Eb2', 'Bb2'), ('D2', 'Eb2'), ('D2', None), ('A2', 'D2'), ('D2', 'A2')]
for bar in (8, 9):
    for i, (nm, gf) in enumerate(seq8 if bar == 8 else seq9):
        f = hz(nm)
        place(bass_note(f, BEAT * 0.93, 380 + 260 * (0.5 + 0.5 * np.sin(i * 1.3 + bar)), 0.5, glide_from=hz(gf) if gf else None),
              T(bar) + i * BEAT, 0.34, 0, sc=True)
# each morph: a rising 'bloop' + a plucked note of the scale
morph_notes = ['D5', 'F#5', 'A4', 'Bb4', 'C5', 'Eb5', 'D5', 'A5']
for b in range(8):
    tb = tm + b * BEAT + 0.30 * BEAT
    d = 0.56 * BEAT
    n = int(d * SR); k = np.linspace(0, 1, n)
    f = 300 * (2.5 ** k) * (1 if b % 2 == 0 else 0.7)
    blorp = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * k) ** 1.5
    place(blorp, tb, 0.12, (-1) ** b * 0.35, rm=0.25)
    place(pluck(hz(morph_notes[b]), 1.0, 0.45, 1.0), tm + b * BEAT + BEAT / 2, 0.24, (-1) ** b * 0.3, rm=0.25, hl=0.4, dl=0.4)
# charge-up: cracks of light → rising whine, pulse accelerating → hard stop at the shatter
tch = 2.55 + tm
place(tone_sweep(18.75 - tch, 180, 3800, 'saw', 2.6), tch, 0.10, 0, rm=0.15)
place(noise_riser(18.75 - tch, 400, 12000, 2.4), tch, 0.28, 0, rm=0.2)
p = tch; gap = BEAT / 2
while p < 18.75 - 0.05:
    place(heart(0.3, 120, 55), p, 0.55, 0); p += gap; gap = max(0.05, gap * 0.86)

# ---------- ch.6  زمن — sound follows τ(t)  (18.75 – 22.5) ------------------------
t6 = T(10); u_end = 2 * BAR
def tau_at(t_):
    return np.interp(np.clip(t_, 0, 3.75) / TAU_DT, np.arange(len(TAU)), TAU)
tsamp = np.arange(int(3.75 * SR)) / SR
tau_s = tau_at(tsamp)
v_s = np.gradient(tau_s, 1 / SR)                     # dτ/dt at audio rate (smooth enough)
v_s = sg.savgol_filter(v_s, 2001, 3)
pf = np.clip(np.abs(v_s) ** 0.4, 0.12, 2.0)          # pitch factor: the tape slows with time

# the shatter
place(boom(3.0, 66, 26, 1.0), t6, 1.0, 0, rm=0.1, hl=0.6)
place(crash(2.8), t6, 0.36, 0, hl=0.7)
K(t6, 1.0)
# glass: ~40 bright partials whose pitch follows the tape-speed factor
tail_n = int(3.7 * SR)
glass = np.zeros(tail_n)
for i in range(46):
    f0 = rng.uniform(1400, 6500); t_on = rng.uniform(0, 0.10); a = rng.uniform(0.3, 1.0); dec = rng.uniform(0.35, 1.4)
    pfl = pf[:tail_n]
    ph = 2 * np.pi * np.cumsum(f0 * pfl) / SR
    env = np.exp(-np.maximum(tt(tail_n) - t_on, 0) / dec) * (tt(tail_n) >= t_on)
    glass += np.sin(ph) * env * a
glass = fade(norm(glass), 0.0005, 0.05)
place(glass, t6, 0.22, 0, rm=0.3, hl=0.8)
# slowing drone chord: pitch glides down as time stalls, back up on rewind (pad voices re-synthesised at variable pitch)
ndr = int(3.75 * SR)
padf = 0.55 + 0.45 * np.clip(np.abs(v_s), 0, 1) ** 0.5
padL = np.zeros(ndr); padR = np.zeros(ndr)
for f, wt in [(hz('D3'), 1.0), (hz('A3'), 0.8), (hz('D4'), 0.7), (hz('F#4'), 0.5)]:
    for c, side in ((-8, 0), (0, 2), (8, 1)):
        ph = 2 * np.pi * np.cumsum(f * 2 ** (c / 1200) * padf) / SR + rng.uniform(0, 6)
        s = (sg.sawtooth(ph) * 0.45 + np.sin(ph) * 0.55) * wt
        if side in (0, 2): padL += s
        if side in (1, 2): padR += s
cut = 250 + 3600 * np.clip(np.abs(v_s), 0, 1) ** 0.7
padL = sweep(padL, cut, 'low', 256); padR = sweep(padR, cut, 'low', 256)
env6 = np.minimum(1, tsamp / 0.6) * np.minimum(1, (3.75 - tsamp) / 0.25)
place_st(padL * env6 / 14, padR * env6 / 14, t6, 0.42, rm=0.3, hl=0.9)
# sub drone
place(sub_note(hz('D2'), 3.2) * np.minimum(1, tt(int(3.2 * SR)) / 0.4), t6 + 0.2, 0.55, 0, rm=0.05)
# stopwatch ticks: one per 1/24 of τ — they slow, stop, then run backwards
k_s = np.floor(tau_s * 24).astype(int)
ev = np.nonzero(np.diff(k_s))[0]
last = -1
for ix in ev:
    tk = ix / SR
    if tk - last < 0.014: continue
    last = tk
    dirn = np.sign(k_s[ix + 1] - k_s[ix])
    amp = 0.30 * np.clip(0.45 + 0.55 * min(1, abs(v_s[ix])), 0.3, 1.0)
    place(tick(2900 if dirn > 0 else 2050), t6 + tk, amp, 0.25 * dirn, rm=0.15)
# rewind: reversed swell + reversed pluck cluster ending exactly on the drop of chapter 7
t7 = T(12)
rw0 = t6 + 2.30
place(whoosh(t7 - 0.117 - rw0, True, 300, 10000), rw0, 0.34, 0, rm=0.2)
place(tone_sweep(t7 - 0.117 - rw0, 140, 2600, 'saw', 2.0), rw0, 0.08, 0, rm=0.2)
rev_notes = ['D5', 'A4', 'F#4', 'D4', 'A3', 'F#3', 'D3']
for i, nm in enumerate(rev_notes):
    d = 1.0
    pk = pluck(hz(nm), d, 0.35, 1.0)[::-1]
    place(pk, t7 - 0.117 - d - (len(rev_notes) - 1 - i) * 0.10 + 0.0, 0.16, 0.4 * (-1) ** i, rm=0.3, hl=0.5)
rk = np.linspace(0, 1, 40)
for j, x in enumerate(rk):
    place(tick(2050), rw0 + 0.35 + (t7 - 0.2 - rw0 - 0.35) * (x ** 1.7), 0.14 + 0.2 * x, 0)

# ---------- ch.7  سرعة  (22.5 – 26.25)  ------------------------------------------
place(boom(2.4, 78, 30, 0.9), t7, 0.9, 0, rm=0.1, hl=0.5)
place(crash(2.6), t7, 0.32, 0, hl=0.6)
def speed_bar(tb, arp_octave, boost):
    for b in range(4):
        K(tb + b * BEAT, 1.0)
        if boost: KICKS.append(tb + b * BEAT + 0.75 * BEAT)
    if boost:
        for b in range(4): place(kick(0.16, 140, 55), tb + b * BEAT + 0.75 * BEAT, 0.38, 0)
    for b in (1, 3):
        place(clap(), tb + b * BEAT, 0.46, 0.1, rm=0.2); place(snare(0.24, 190), tb + b * BEAT, 0.20, 0)
    for s in range(16):
        place(hat(), tb + s * BEAT / 4, 0.11 if s % 2 else 0.17, 0.35 * (-1) ** s)
    for b in range(4): place(hat(True), tb + b * BEAT + BEAT / 2, 0.13, -0.25)
    # driving 16th bass
    pat = ['D2', 'D2', 'D3', 'D2', 'D2', 'Eb2', 'D3', 'D2', 'D2', 'D2', 'F#2', 'D2', 'G2', 'F#2', 'Eb2', 'D2']
    for s, nm in enumerate(pat):
        place(bass_note(hz(nm), BEAT / 4 * 0.85, 700, 0.6), tb + s * BEAT / 4, 0.34, 0, sc=True)
    # rising arpeggio, 16ths, up the Hijaz scale
    scale = ['D', 'Eb', 'F#', 'G', 'A', 'Bb', 'C']
    for s in range(16):
        idx = s % 8 + (s // 8) * 3
        nm = scale[idx % 7] + str(arp_octave + (idx // 7) + (1 if scale[idx % 7] == 'C' else 0))
        place(pluck(hz(nm), 0.32, 0.14, 1.0), tb + s * BEAT / 4, 0.18, 0.5 * np.sin(s), rm=0.15, dl=0.35)
    # supersaw stabs on off-beats
    for b, ch in zip((0.5, 1.5, 2.5, 3.5), [['D4', 'A4', 'F#5'], ['D4', 'A4', 'F#5'], ['Eb4', 'Bb4', 'G5'], ['C4', 'G4', 'Eb5']]):
        for nm in ch: place(supersaw(hz(nm), BEAT * 0.4, 4800, decay=0.22), tb + b * BEAT, 0.09, 0, rm=0.15, sc=True)
speed_bar(t7, 4, False); speed_bar(T(13), 5, True)
place(crash(2.0), T(13), 0.22, 0, hl=0.5)
place(boom(1.2, 76, 34, 0.5), T(13), 0.5, 0, rm=0.1)
# the inhale: everything is sucked into the dot
t8 = T(14)
inh0 = t8 - 0.55
place(noise_riser(0.55, 300, 13000, 2.6), inh0, 0.32, 0, rm=0.1)
place(tone_sweep(0.55, 120, 5200, 'saw', 3.0), inh0, 0.10, 0)

# ---------- ch.8  عالم  (26.25 – 30) ---------------------------------------------
FN = TLJ['finale']
place(boom(2.6, 70, 28, 0.5), t8, 0.6, 0, rm=0.1, hl=0.7)
place(bell(hz('D6'), 3.0, 2.0, 1.2, 1.3), t8 + 0.02, 0.12, 0.2, hl=1.0)
for tb, v in [(FN['heart'][0], 1.0), (FN['heart'][1], .6)]:
    place(heart(), t8 + tb, 0.95 * v, 0, rm=0.1)
drone(t8 + 0.4, 3.35, 0.85, 700)
# three statements: each hit is a low thump + a bright pluck chord tone + particle shimmer
hit_notes = [['D4', 'A4'], ['F#4', 'D5'], ['A4', 'F#5', 'D6']]
for i, tl_ in enumerate(FN['lines']):
    tk = t8 + tl_
    place(boom(1.0, 78, 42, 0.5), tk, 0.62 + 0.10 * i, 0, rm=0.1)
    place(clap(), tk, 0.28, 0, rm=0.3)
    for nm in hit_notes[i]:
        place(pluck(hz(nm), 1.4, 0.55, 1.0), tk, 0.24, np.random.uniform(-.4, .4), rm=0.3, hl=0.6, dl=0.3)
    place(noise_riser(0.5, 1500, 12000, 1.0)[::-1], tk - 0.02, 0.07, 0, rm=0.2)
    K(tk, 0.8, sc=(i > -1))
# implode → silence → the wordmark
ti = t8 + FN['implode']
place(whoosh(0.32, False, 9000, 500), ti - 0.05, 0.22, 0, rm=0.2)
tmk = t8 + FN['mark']
place(boom(2.2, 66, 30, 0.7), tmk, 0.7, 0, rm=0.1, hl=0.7)
final_l, final_r = pad([hz(n) for n in ['D3', 'A3', 'D4', 'F#4', 'A4']], 30.0 - tmk + 0.3, cutoff=2400, atk=0.12, rel=0.5, det=8, level=1.0)
place_st(final_l, final_r, tmk, 0.55, rm=0.3, hl=0.9)
place(sub_note(hz('D2'), 30 - tmk + 0.2) * 0.9, tmk, 0.55, 0)
for nm in ['D5', 'F#5', 'A5', 'D6']:
    place(bell(hz(nm), 3.0, 3.5, 1.4, 1.5), tmk, 0.14, np.random.uniform(-.4, .4), rm=0.3, hl=1.0)
# Hijaz cadence on the tagline: E♭ → D
tg = t8 + FN['tag']
place(pluck(hz('Eb5'), 1.0, 0.5, 1.0), tg, 0.24, -0.2, rm=0.3, hl=0.6, dl=0.4)
place(pluck(hz('D5'), 2.4, 0.9, 1.0), tg + BEAT / 2, 0.28, 0.2, rm=0.3, hl=0.8, dl=0.4)
sb = t8 + FN['sub']
for i, nm in enumerate(['D6', 'A5', 'F#5', 'D5']):
    place(bell(hz(nm), 2.4, 3.5, 1.2, 1.4), sb + i * BEAT / 4, 0.10, -0.3 + 0.2 * i, hl=1.0)

# ═════════════════════════════════════════════════════════════
#  MIX
# ═════════════════════════════════════════════════════════════
# sidechain: duck the musical bus on every kick
sc = np.ones(N)
for kt in KICKS:
    i = int(kt * SR); m = int(0.24 * SR)
    if i >= N: continue
    env = 1 - 0.70 * np.exp(-np.arange(min(m, N - i)) / (0.075 * SR)) * np.minimum(1, np.arange(min(m, N - i)) / (0.004 * SR))
    sc[i:i + len(env)] = np.minimum(sc[i:i + len(env)], env)
dry.L += music_sc.L * sc; dry.R += music_sc.R * sc

# gap before each drop (tiny silence for impact) — kills everything except the reverb tails
gap = np.ones(N)
for tdrop in (T(4), T(12)):
    a, b = int((tdrop - 0.117) * SR), int(tdrop * SR)
    f0 = int(0.006 * SR)
    gap[a - f0:a] = np.linspace(1, 0, f0)
    gap[a:b] = 0.0
    gap[b - 90:b] = np.linspace(0, 1, 90)
dry.L *= gap; dry.R *= gap
for bus in (room, hall, dly):
    bus.L *= (0.25 + 0.75 * gap); bus.R *= (0.25 + 0.75 * gap)

# ping-pong delay (dotted 8th)
def pingpong(bus, fb=0.42, dt=0.75 * BEAT):
    d = int(dt * SR); L = bus.L.copy(); R = bus.R.copy()
    outL = np.zeros(N); outR = np.zeros(N)
    cur = (L + R) * 0.5; side = 0
    for k in range(1, 7):
        s = k * d
        if s >= N: break
        g = fb ** k
        tgt = outL if k % 2 else outR
        tgt[s:] += cur[:N - s] * g
    return lp(outL, 6500, 1), lp(outR, 6500, 1)
dlL, dlR = pingpong(dly)

irR = make_ir(0.85, 0.012, 6500, 3); irH = make_ir(3.2, 0.028, 4200, 9)
def rev(bus, ir):
    return fftconvolve(bus.L, ir[0])[:N], fftconvolve(bus.R, ir[1])[:N]
rrL, rrR = rev(room, irR); hhL, hhR = rev(hall, irH)

L = dry.L + 0.55 * rrL + 0.55 * hhL + 0.5 * dlL
R = dry.R + 0.55 * rrR + 0.55 * hhR + 0.5 * dlR

# dynamics of the piece: hushed opening, big drops, dark middle of the time chapter, quiet resolution
knots = [(0, 0.85), (3.6, 1.0), (7.38, 0.90), (7.5, 1.12), (11.2, 1.12), (11.25, 1.0), (14.9, 1.05), (15.0, 1.0),
         (18.7, 1.0), (18.75, 1.15), (19.6, 0.88), (21.5, 0.88), (22.4, 1.0), (22.5, 1.15), (26.0, 1.15), (26.25, 0.9), (27.0, 0.85), (29.0, 1.0), (30.0, 1.0)]
gt = np.interp(np.arange(N) / SR, [k[0] for k in knots], [k[1] for k in knots])
L *= gt; R *= gt

# master: DC/sub cleanup, glue, limiter, final fade
L = hp(L, 28, 2); R = hp(R, 28, 2)
L = L - 0.30 * lp(L, 105, 2) + 0.28 * hp(L, 3200, 2); R = R - 0.30 * lp(R, 105, 2) + 0.28 * hp(R, 3200, 2)
peak = max(np.max(np.abs(L)), np.max(np.abs(R)))
L, R = L / peak, R / peak
L = soft(L * 1.55, 1.25); R = soft(R * 1.55, 1.25)
peak = max(np.max(np.abs(L)), np.max(np.abs(R)))
L, R = L / peak * 0.85, R / peak * 0.85                       # ≈ −1 dBFS
fo = int(0.45 * SR); L[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2; R[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2
L[:200] *= np.linspace(0, 1, 200); R[:200] *= np.linspace(0, 1, 200)
out = np.stack([L, R], 1)
wavfile.write('audio.wav', SR, (out * 32767).astype(np.int16))
print('audio.wav written', out.shape, 'peak', np.max(np.abs(out)).round(3))
np.save('/tmp/_rms.npy', out)
