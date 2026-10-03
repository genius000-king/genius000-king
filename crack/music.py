#!/usr/bin/env python3
"""
«الشق» — an original score, written for this film only.  60 s = 32 bars @ 128 BPM.

The harmony travels with the story:
  white world   D open fifths → D bayati (a quarter-tone E♭½: the line being drawn) → D major / lydian (matter, ideas)
  black space   D minor / phrygian: two forces, a half-step apart — a cold choir (purple, left) against hot brass (red, right)
  return        the forces slide into a single D, the world turns white again: D major, glass, silence.

Sound world: glass harmonics · kalimba · marimba · darbuka / daf / taiko · formant choir · string ensemble · reese bass · brass · gong.
Every cue time comes from cues.json (dumped from the code that draws the picture); bullet time is scored by
warping the whole mix with the picture's own time-warp curve.
"""
import json, sys
import numpy as np
import scipy.signal as sg
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 44100
CU = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'cues.json'))
BEAT, BAR, DUR = CU['BEAT'], CU['BAR'], CU['DUR']
S16 = BEAT / 4
WARP = np.array(CU['warp']); WARP_DT = 0.001
N = int(round(SR * DUR))
rs = np.random.default_rng(20261004)

# ═══ pitch ═══════════════════════════════════════════════════
_N = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def hz(name):
    """'D4' 'F#5' 'Bb3'; a trailing 'q' lowers by a quarter tone (E4q = E half-flat)"""
    q = name.endswith('q'); name = name.rstrip('q')
    n = _N[name[0]]; i = 1
    while name[i] in '#b':
        n += 1 if name[i] == '#' else -1; i += 1
    return 440.0 * 2 ** ((n + 12 * (int(name[i:]) + 1) - 69 - (0.5 if q else 0)) / 12)
def cents(f, c): return f * 2 ** (c / 1200)

# ═══ DSP basics ═════════════════════════════════════════════
def _sos(kind, fc, order=2):
    if kind == 'bp': return butter(order, [max(20, fc[0]) / (SR / 2), min(SR / 2 * .95, fc[1]) / (SR / 2)], 'band', output='sos')
    return butter(order, min(max(fc, 20), SR / 2 * .95) / (SR / 2), kind, output='sos')
def lp(x, fc, o=2): return sosfilt(_sos('low', fc, o), x)
def hp(x, fc, o=2): return sosfilt(_sos('high', fc, o), x)
def bp(x, lo, hi, o=2): return sosfilt(_sos('bp', (lo, hi), o), x)
def sweep_lp(x, fcs, block=256, o=2):
    y = np.empty_like(x); zi = None
    for i in range(0, len(x), block):
        sos = _sos('low', float(fcs[min(i, len(fcs) - 1)]), o)
        if zi is None: zi = np.zeros((sos.shape[0], 2))
        y[i:i + block], zi = sosfilt(sos, x[i:i + block], zi=zi)
    return y
def tt(n): return np.arange(n) / SR
def env_ar(n, a, r):
    e = np.ones(n); na = max(1, int(a * SR)); nr = max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na)[:n]
    if nr < n: e[-nr:] *= np.linspace(1, 0, nr)
    return e
def soft(x, g=1.0): return np.tanh(x * g) / np.tanh(g)
def noise(n): return rs.standard_normal(n)

# ═══ the mix: buses, sends, sidechain, warp ═════════════════
class Bus:
    def __init__(self): self.L = np.zeros(N); self.R = np.zeros(N)
    def add(self, x, i, g, pan):
        if i >= N or i + len(x) <= 0: return
        a = max(0, -i); i0 = max(0, i); m = min(len(x) - a, N - i0)
        if m <= 0: return
        th = (pan + 1) * np.pi / 4
        self.L[i0:i0 + m] += x[a:a + m] * g * np.cos(th); self.R[i0:i0 + m] += x[a:a + m] * g * np.sin(th)
dry, bed, room, hall, echo = Bus(), Bus(), Bus(), Bus(), Bus()      # bed = ducked by the low drums
DUCK = []                                                            # (time, depth)
GAPS = []
def W(t): return float(np.interp(t, np.arange(len(WARP)) * WARP_DT, WARP))
def put(x, t, g=1.0, pan=0.0, rm=0.0, hl=0.0, ec=0.0, duck=False):
    i = int(round(W(t) * SR)); tgt = bed if duck else dry
    tgt.add(x, i, g, pan)
    if rm: room.add(x, i, g * rm, pan)
    if hl: hall.add(x, i, g * hl, pan)
    if ec: echo.add(x, i, g * ec, pan)
def hit_duck(t, depth=0.6): DUCK.append((W(t), depth))

# ═══ voices ═════════════════════════════════════════════════
def glass_tone(f, dur=3.2, bright=1.0, tau=1.1):
    """struck glass / harmonica: inharmonic partials, slow bloom"""
    n = int(dur * SR); t = tt(n); x = np.zeros(n)
    for r, a, d in ((1, 1.0, 1.0), (2.76, .5, .65), (5.40, .27 * bright, .42), (8.93, .13 * bright, .28)):
        x += a * np.sin(2 * np.pi * f * r * t + rs.uniform(0, 6.28)) * np.exp(-t / (tau * d))
    return x * env_ar(n, 0.004, 0.2) * 0.5
def kalimba(f, dur=1.5):
    n = int(dur * SR); t = tt(n); x = np.zeros(n)
    for r, a, d in ((1, 1.0, .9), (5.4, .38, .12), (12.7, .12, .05)):
        x += a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / (dur * d * .5))
    x += 0.35 * lp(noise(n), 5000) * np.exp(-t / 0.004)
    return x * env_ar(n, 0.0008, 0.05) * 0.8
def marimba(f, dur=0.9):
    n = int(dur * SR); t = tt(n); x = np.zeros(n)
    for r, a, d in ((1, 1.0, .5), (3.97, .42, .14), (9.9, .14, .05)):
        x += a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / (dur * d * .8))
    x += 0.25 * bp(noise(n), 900, 3500) * np.exp(-t / 0.006)
    return x * env_ar(n, 0.0006, 0.05) * 0.8
def wood(f, dur=0.22):
    n = int(dur * SR); t = tt(n)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.035) + 0.5 * np.sin(2 * np.pi * f * 2.41 * t) * np.exp(-t / 0.02)
    x += 0.6 * bp(noise(n), 600, 3000) * np.exp(-t / 0.008)
    return soft(x, 1.4) * env_ar(n, 0.0004, 0.03)
def dum(dur=0.38, f0=190, f1=72, g=1.0):
    n = int(dur * SR); t = tt(n); f = f1 + (f0 - f1) * np.exp(-t / 0.03)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.13) + 0.3 * bp(noise(n), 400, 1800) * np.exp(-t / 0.012)
    return soft(x * g, 1.6) * env_ar(n, 0.0005, 0.04)
def tak(dur=0.12, g=1.0):
    n = int(dur * SR); t = tt(n)
    x = bp(noise(n), 1800, 8000) * np.exp(-t / 0.022) + 0.5 * np.sin(2 * np.pi * 1650 * t) * np.exp(-t / 0.014)
    return x * g * env_ar(n, 0.0003, 0.02)
def ka(dur=0.1, g=1.0):
    n = int(dur * SR); t = tt(n)
    return (bp(noise(n), 900, 4200) * np.exp(-t / 0.018) + 0.4 * np.sin(2 * np.pi * 760 * t) * np.exp(-t / 0.012)) * g * env_ar(n, 0.0003, 0.02)
def daf(dur=0.8, g=1.0):
    n = int(dur * SR); t = tt(n)
    body = lp(noise(n), 280, 2) * np.exp(-t / 0.10) * 2.2 + np.sin(2 * np.pi * (96 + 60 * np.exp(-t / 0.04)) * t) * np.exp(-t / 0.20)
    jingle = hp(noise(n), 6500) * np.exp(-t / 0.22) * (0.5 + 0.5 * np.sin(2 * np.pi * 63 * t)) * 0.35
    return soft(body + jingle, 1.3) * g * env_ar(n, 0.0008, 0.1)
def shaker(dur=0.09, g=1.0):
    n = int(dur * SR); t = tt(n); return bp(noise(n), 5200, 11000) * np.sin(np.pi * np.minimum(1, t / dur * 1.4)) * g * env_ar(n, 0.003, 0.02)
def taiko(dur=1.3, f0=125, f1=46, g=1.0):
    n = int(dur * SR); t = tt(n); f = f1 + (f0 - f1) * np.exp(-t / 0.09)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.36) + 0.5 * bp(noise(n), 200, 2200) * np.exp(-t / 0.035)
    return soft(x * g, 1.8) * env_ar(n, 0.0006, 0.1)
def timpani(f, dur=1.8, g=1.0):
    n = int(dur * SR); t = tt(n); fr = f * (1 + 0.28 * np.exp(-t / 0.05))
    x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / 0.7) + 0.25 * np.sin(2 * np.pi * np.cumsum(fr * 1.5) / SR) * np.exp(-t / 0.3) + 0.4 * lp(noise(n), 900) * np.exp(-t / 0.02)
    return soft(x * g, 1.5) * env_ar(n, 0.0007, 0.2)
def snare_mil(dur=0.2, g=1.0):
    n = int(dur * SR); t = tt(n)
    return soft((bp(noise(n), 1500, 9000) * np.exp(-t / 0.05) + 0.5 * np.sin(2 * np.pi * 230 * t) * np.exp(-t / 0.04)) * g, 1.4) * env_ar(n, 0.0004, 0.03)
def sub_hit(f, dur=1.4, glide=1.8, g=1.0):
    n = int(dur * SR); t = tt(n); fr = f * (1 + (glide - 1) * np.exp(-t / 0.07))
    return soft(np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / (dur * 0.38)) * g, 1.3) * env_ar(n, 0.004, 0.2)
def boom(dur=3.0, f0=80, f1=26, g=1.0):
    n = int(dur * SR); t = tt(n); f = f1 + (f0 - f1) * np.exp(-t / 0.4)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (dur * 0.33)) + 0.7 * lp(noise(n), 1800, 2) * np.exp(-t / 0.25)
    return soft(x * g, 1.4) * env_ar(n, 0.001, 0.4)
def gong(f=62, dur=6.0, g=1.0):
    n = int(dur * SR); t = tt(n); x = np.zeros(n)
    for r in (1, 1.51, 2.04, 2.77, 3.64, 4.5, 5.9, 7.3):
        x += (1 / r ** .6) * np.sin(2 * np.pi * f * r * t + rs.uniform(0, 6.28)) * np.exp(-t / (dur * (.5 / (r ** .35))))
    x += 0.5 * hp(noise(n), 2500) * np.exp(-t / 1.1)
    return soft(x * g, 1.2) * env_ar(n, 0.002, 0.5)
def cymbal(dur=3.0, g=1.0):
    n = int(dur * SR); t = tt(n); return hp(noise(n), 3800) * np.exp(-t / (dur * 0.28)) * g * env_ar(n, 0.0006, 0.3)
def air(dur, lo=180, hi=1400, lfo=0.13):
    n = int(dur * SR); t = tt(n)
    x = bp(noise(n), lo, hi) * (0.6 + 0.4 * np.sin(2 * np.pi * lfo * t)); return x * env_ar(n, dur * 0.4, dur * 0.4)
def riser(dur, f0=300, f1=9000, curve=2.0, hp_fc=200):
    n = int(dur * SR); k = np.linspace(0, 1, n); x = sweep_lp(noise(n), f0 * (f1 / f0) ** (k ** 1.3)); return hp(x, hp_fc) * k ** curve * env_ar(n, .01, .004)
def sine_sweep(dur, f0, f1, curve=2.0):
    n = int(dur * SR); k = np.linspace(0, 1, n); f = f0 * (f1 / f0) ** (k ** curve)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * k ** 1.5 * env_ar(n, .005, .003)
def whoosh(dur, up=True, f0=500, f1=8000):
    x = riser(dur, f0, f1, 1.5, 250); return x if up else x[::-1]
def swirl(dur, f0=200, f1=2000, rate=3.0):
    n = int(dur * SR); t = tt(n); return riser(dur, f0, f1, 1.2, 150) * (0.65 + 0.35 * np.sin(2 * np.pi * rate * t))
def crack_snap(dur=0.9):
    n = int(dur * SR); t = tt(n)
    x = bp(noise(n), 3000, 11000) * np.exp(-t / 0.02) * 1.3 + np.sin(2 * np.pi * (75 - 35 * (1 - np.exp(-t / .1))) * t) * np.exp(-t / .28) * .8
    for _ in range(14):
        f = rs.uniform(2500, 9500); d = rs.uniform(0, .5); s = int(d * SR)
        x[s:] += np.sin(2 * np.pi * f * tt(n - s)) * np.exp(-tt(n - s) / rs.uniform(.01, .08)) * rs.uniform(.05, .2)
    return x * env_ar(n, .0003, .1)
def tick(freq=3200, dur=0.05):
    n = int(dur * SR); t = tt(n); return (hp(noise(n), 2200) * np.exp(-t / 0.002) * .7 + np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.005)) * env_ar(n, .0002, .01)
def blip(f0, f1, dur=0.2):
    n = int(dur * SR); t = tt(n); k = t / dur; f = f0 + (f1 - f0) * (1 - np.exp(-k * 5))
    return np.sin(2 * np.pi * np.cumsum(f * (1 + .01 * np.sin(2 * np.pi * 30 * t))) / SR) * np.exp(-t / 0.07) * env_ar(n, .001, .03)
def chirp(f0, f1, dur=0.12):
    n = int(dur * SR); t = tt(n); k = t / dur; f = f0 + (f1 - f0) * k + 110 * np.sin(2 * np.pi * 41 * t)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * k) ** .7 * env_ar(n, .003, .02)

def choir(notes, dur, vowel='ah', level=1.0, vib=5.0, atk=0.8, rel=1.0):
    """formant-filtered detuned saws → a breathy 'ah'/'oo'; returns (L, R)"""
    F = {'ah': ((800, 1150, 2900), (1, .55, .22)), 'oo': ((320, 800, 2250), (1, .35, .12)), 'oh': ((500, 900, 2700), (1, .5, .18))}[vowel]
    n = int(dur * SR); t = tt(n); L = np.zeros(n); R = np.zeros(n)
    for f in notes:
        for c, side in ((-9, 0), (0, 2), (9, 1)):
            fr = f * 2 ** (c / 1200) * (1 + 0.0035 * np.sin(2 * np.pi * (vib + .3 * rs.standard_normal()) * t) * np.minimum(1, t / 1.0))
            s = sg.sawtooth(2 * np.pi * np.cumsum(fr) / SR + rs.uniform(0, 6.28)) + 0.04 * noise(n)
            y = sum(w * bp(s, fc * .86, fc * 1.16, 2) for fc, w in zip(*F))
            if side in (0, 2): L += y
            if side in (1, 2): R += y
    e = env_ar(n, atk, rel) * level / (3 * len(notes)) * 2.4
    return L * e, R * e
def strings(notes, dur, cutoff=2400, level=1.0, atk=0.9, rel=1.0):
    n = int(dur * SR); t = tt(n); L = np.zeros(n); R = np.zeros(n)
    for f in notes:
        for c, side in ((-12, 0), (-4, 2), (5, 2), (13, 1)):
            fr = f * 2 ** (c / 1200) * (1 + 0.003 * np.sin(2 * np.pi * 5.4 * t + rs.uniform(0, 6.28)))
            s = sg.sawtooth(2 * np.pi * np.cumsum(fr) / SR + rs.uniform(0, 6.28))
            if side in (0, 2): L += s
            if side in (1, 2): R += s
    e = env_ar(n, atk, rel) * level / (4 * len(notes)) * 2.0
    return hp(lp(L, cutoff), 110, 1) * e, hp(lp(R, cutoff), 110, 1) * e
def reese(f, dur, level=1.0, sweep=(160, 520), lfo=0.55):
    n = int(dur * SR); t = tt(n)
    x = sg.sawtooth(2 * np.pi * np.cumsum(np.full(n, cents(f, -14))) / SR) + sg.sawtooth(2 * np.pi * np.cumsum(np.full(n, cents(f, 14))) / SR)
    x = sweep_lp(x * .5, sweep[0] + (sweep[1] - sweep[0]) * (0.5 + 0.5 * np.sin(2 * np.pi * lfo * t)), 256, 2)
    x = soft(x + 0.8 * np.sin(2 * np.pi * np.cumsum(np.full(n, f)) / SR), 1.8)
    return x * env_ar(n, 0.03, 0.2) * level
def brass(f, dur, c0=420, c1=2400, atk=0.12, g=1.0):
    n = int(dur * SR); t = tt(n); k = np.linspace(0, 1, n)
    fr = f * (1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.minimum(1, t / .6))
    ph = 2 * np.pi * np.cumsum(fr) / SR
    x = sg.sawtooth(ph) * .6 + sg.sawtooth(ph * 1.004) * .5 + sg.square(ph * .5) * .15
    x = sweep_lp(x, c0 + (c1 - c0) * np.minimum(1, k * 2.4) * (0.6 + 0.4 * np.exp(-t / 0.3)), 256, 2)
    return x * env_ar(n, atk, 0.25) * g
def growl(dur=1.5, f=44):
    n = int(dur * SR); t = tt(n); k = np.linspace(0, 1, n)
    ph = 2 * np.pi * np.cumsum(f * (1 + .25 * np.sin(2 * np.pi * 5.5 * t))) / SR
    x = sg.sawtooth(ph) * (1 + .35 * np.sin(2 * np.pi * (23 + 14 * k) * t)) + .5 * sg.square(ph * .5)
    x = sweep_lp(x, 280 + 1400 * np.sin(np.pi * k) ** 1.5, 256, 3) + .25 * bp(noise(n), 500, 2200) * np.sin(np.pi * k)
    return soft(x * np.sin(np.pi * k) ** .6, 2.0) * env_ar(n, .02, .2)
def flap(dur=0.5):
    n = int(dur * SR); t = tt(n)
    return soft((np.sin(2 * np.pi * (50 + 16 * np.exp(-t / .08)) * t) * np.exp(-t / .13) * .9 + lp(noise(n), 450, 2) * np.sin(np.pi * np.minimum(1, t / .32)) ** 1.5 * np.exp(-t / .2) * 1.3), 1.4) * env_ar(n, .004, .08)
def rumble(dur, fc=130):
    n = int(dur * SR); return lp(noise(n), fc, 2) * np.sin(np.pi * np.linspace(0, 1, n)) ** .8

def scale_note(i, base, steps):
    return base * 2 ** (steps[i % len(steps)] / 12 + (i // len(steps)))
PENT = [0, 2, 4, 7, 9]                      # major pentatonic (D E F# A B)
BAYATI = [0, 1.5, 3, 5, 7, 8, 10]           # D E♭½ F G A B♭ C

# ═══ the arrangement ════════════════════════════════════════
g = CU
TP, TL0, TC, TB, TI, TE = g['T_POINT'], g['T_LINE0'], g['T_CRACK'], g['T_BURST'], g['T_IRIS0'], g['T_END']

# ── ١ · العدم  0 → 7.5 : almost nothing — air, glass, a hairline, a tear ─────────────────────────────
put(air(7.4, 160, 1100, .11), 0.1, 0.10, 0, hl=0.4)
for f_, gg, dt in ((hz('D6'), .15, 0), (hz('A5'), .07, .02), (hz('E6'), .05, .06)):
    put(glass_tone(f_, 3.6, 1.0, 1.4), TP + dt, gg, rs.uniform(-.3, .3), rm=.5, hl=1.0)                         # the point
for k in range(46):                                                                                             # the hairline: crystals forming
    u = k / 46; tk = TL0 + (TC - TL0) * u ** 1.5
    put(glass_tone(scale_note(int(rs.integers(0, 10)), hz('D5'), PENT), .7, .6, .2), tk, .025 + .06 * u, rs.uniform(-.8, .8), hl=.7)
put(sine_sweep(TC - TL0, 500, 3800, 2.0), TL0, .06, 0, rm=.3, hl=.4)
put(crack_snap(), TC, .55, 0, rm=.3, hl=.5)                                                                     # the tear
for f_, dt in ((hz('D5'), 0), (hz('A5'), .01), (hz('E6'), .03), (hz('B6'), .05)): put(glass_tone(f_, 3.0, 1.2, 1.0), TC + dt, .08, rs.uniform(-.5, .5), rm=.4, hl=1.0)
for ev in g['crack']:                                                                                           # the fissure ticks
    put(tick(1700 + 2.0 * ev['len']), ev['t'], .10 if ev['lvl'] == 0 else .06, np.clip(ev['x'] / 900, -.9, .9), rm=.3)
    if rs.random() < .45: put(glass_tone(scale_note(int(rs.integers(2, 9)), hz('D5'), PENT), 1.0, .5, .3), ev['t'], .03, np.clip(ev['x'] / 900, -.9, .9), hl=.8)
put(sub_hit(hz('D1'), 4.5, 1.0, .5), TC + .1, .55, 0)                                                           # the floor of the world
put(sine_sweep(2.6, 36.7, 110, 1.4) * 0.7, 3.0, .22, 0, hl=.3)
put(whoosh(TB - 4.4, True, 200, 6000), 4.4, .10, 0, rm=.2)
put(np.concatenate([glass_tone(hz('D6'), 1.5, 1, .5) * np.linspace(0, 1, int(1.5 * SR)) ** 2]) , TB - 1.45, .10, 0, hl=.9)       # swell into the burst
put(boom(3.4, 82, 26, 1.0), TB, .9, 0, rm=.1, hl=.7)                                                            # the burst
put(lp(noise(int(1.8 * SR)), 9000) * np.exp(-tt(int(1.8 * SR)) / .35), TB, .30, 0, hl=.5)
put(cymbal(3.2, 1.0), TB, .20, 0, rm=.3, hl=.7)
for k in range(34):
    put(glass_tone(scale_note(int(rs.integers(3, 12)), hz('D5'), PENT), .9, .7, .25), TB + .05 + rs.uniform(0, 1.3), rs.uniform(.03, .09), rs.uniform(-.9, .9), hl=.9)
for k in range(30): put(bp(noise(int(.04 * SR)), 1500, 7000) * np.hanning(int(.04 * SR)), TB + .1 + rs.uniform(0, 1.5), rs.uniform(.05, .11), rs.uniform(-.9, .9), rm=.3)   # paper in the air
hit_duck(TB, .6)
L_, R_ = choir([hz(n) for n in ('D3', 'A3', 'E4', 'A4')], TE - TI + .3, 'ah', 1.0, atk=1.1, rel=.5)                 # the sky opens
put(L_, TI, .55, -.4, rm=.3, hl=.9); put(R_, TI, .55, .4, rm=.3, hl=.9)
put(riser(TE - TI - .1, 400, 9000, 2.0), TI, .13, 0, rm=.2)
GAPS.append(TE)

# ── ٢ · الرسم  7.5 → 15 : twelve strokes climb the bayati scale; the cube becomes matter ──────────────
put(boom(2.4, 66, 34, .6), 7.5, .35, 0, rm=.2, hl=.6)
put(air(3.5, 200, 1500), 7.6, .08, 0, hl=.5)
sc12 = [0, 1.5, 3, 5, 7, 8, 10, 12, 13.5, 15, 17, 19]                       # D E♭½ F G A B♭ C D E♭½ F G A — one rising line
for k, tw in enumerate(g['wire']):
    f_ = hz('D4') * 2 ** (sc12[k] / 12)
    put(kalimba(f_, 1.6), tw, .34, -.6 + .11 * k, rm=.3, hl=.6, ec=.3)
    put(tick(3600), tw + g['wireDur'], .05, .5 * np.sin(k), rm=.2)
    if k % 4 == 0: put(glass_tone(f_ / 2, 2.5, .6, 1.0), tw, .10, 0, hl=.9)
tS = g['T_SOLID']
for b in range(7):                                                          # a frame-drum heartbeat grows toward the cube
    put(daf(.9, .5 + .09 * b), tS - 2.1 + b * BEAT * 0.9, .35, 0, rm=.2, hl=.4)
put(riser(1.4, 250, 10000, 2.3), tS - 1.4, .24, 0, rm=.1)
put(sine_sweep(1.4, 90, 1800, 2.2), tS - 1.4, .10, 0, hl=.3)
GAPS.append(tS)
put(boom(3.0, 78, 28, 1.0), tS, .95, 0, rm=.1, hl=.5); hit_duck(tS, .65)                                      # matter
put(timpani(hz('D2'), 2.2, 1.0), tS, .55, 0, rm=.2, hl=.5)
put(cymbal(3.0), tS, .18, 0, rm=.3, hl=.6)
L_, R_ = choir([hz(n) for n in ('D3', 'A3', 'F#4', 'A4', 'E5')], 3.8, 'ah', 1.0, atk=.3, rel=1.4)
put(L_, tS, .62, -.4, rm=.3, hl=1.0); put(R_, tS, .62, .4, rm=.3, hl=1.0)
for f_ in ('D5', 'A5', 'F#6', 'E6'): put(glass_tone(hz(f_), 3.2, 1.2, 1.2), tS, .10, rs.uniform(-.5, .5), rm=.4, hl=1.0)
def maqsum(tb, vel=1.0, bars=1, daf_on=True, shk=True):
    """dum tak . tak dum . tak . — the classic maqsum, in sixteenths"""
    for b in range(bars):
        t0 = tb + b * BAR
        for s_, kind, v in ((0, 'D', 1.0), (4, 'T', .8), (6, 'T', .55), (8, 'D', .9), (10, 'D', .7), (12, 'T', .85), (14, 'k', .5)):
            f_ = {'D': dum, 'T': tak, 'k': ka}[kind]
            put(f_(g=1.0), t0 + s_ * S16, .46 * vel * v, (-.2 if kind == 'D' else .25), rm=.15, hl=.12)
            if kind == 'D': hit_duck(t0 + s_ * S16, .45 * vel * v)
        if daf_on:
            for s_ in (4, 12): put(daf(.8, .9), t0 + s_ * S16, .22 * vel, -.3, rm=.25, hl=.2)
        if shk:
            for s_ in range(16): put(shaker(g=1.0), t0 + s_ * S16, (.07 if s_ % 2 else .11) * vel, .4 * (1 if s_ % 4 < 2 else -1))
def marimba_riff(tb, pattern, g_=.3, base='D4'):
    for st, deg, ln in pattern:
        f_ = hz(base) * 2 ** (deg / 12)
        put(marimba(f_, .8), tb + st * S16, g_, .3 * np.sin(st), rm=.2, hl=.4, ec=.35)
def sub_line(tb, pattern, level=.5):
    for st, nm, ln in pattern:
        n = int(ln * S16 * SR); x = soft(np.sin(2 * np.pi * np.cumsum(np.full(n, hz(nm))) / SR) * env_ar(n, .005, .04), 1.6)
        put(x, tb + st * S16, level, 0, duck=False)
maqsum(tS + BAR * 0, .55, 2, daf_on=False)
sub_line(tS, [(0, 'D1', 3), (8, 'D1', 2), (10, 'A1', 3)], .5); sub_line(tS + BAR, [(0, 'D1', 3), (8, 'E1', 2), (10, 'A1', 3)], .5)
marimba_riff(tS + BAR, [(0, 14, 1), (3, 21, 1), (6, 18, 1), (8, 16, 1), (11, 21, 1), (14, 18, 1)], .22)
marimba_riff(tS + 2 * BAR - BAR, [], .2)
L_, R_ = strings([hz(n) for n in ('D3', 'A3', 'F#4')], 2 * BAR + .2, 1800, 1.0, atk=.5, rel=.5); put(L_, tS + .0, .32, -.3, rm=.3, hl=.6, duck=True); put(R_, tS + .0, .32, .3, rm=.3, hl=.6, duck=True)
# the last bar before the split: a tom-roll of taks into silence
t_ = tS + 2 * BAR; gap_ = S16 * 2; i = 0
while t_ < 15.0 - .13:
    put(tak(g=1.0), t_, .22 + .012 * i, rs.uniform(-.3, .3), rm=.2); put(dum(.3, 150, 90), t_, .20, 0); t_ += gap_; gap_ = max(.04, gap_ * .87); i += 1
put(riser(15.0 - .12 - (tS + BAR), 300, 11000, 2.2), tS + BAR + 0.0, .20, 0, rm=.1)
GAPS.append(15.0)

# ── ٣ · الانقسام  15 → 22.5 : 1 → 8 → 64 → 512, and the ideas leave ──────────────────────────────────
sp = g['splits']
for k, (ts, fq, gg) in enumerate(((sp[0], 'D2', 1.0), (sp[1], 'A2', .8), (sp[2], 'D3', .95))):
    put(timpani(hz(fq), 2.0, 1.0), ts, .6 * gg, 0, rm=.2, hl=.5); put(boom(2.2 if k == 0 else 1.5, 80 + 5 * k, 30, .8), ts, .75 * gg, 0, rm=.1, hl=.5)
    put(cymbal(2.6), ts, .16, 0, rm=.3, hl=.5); hit_duck(ts, .6)
    L_, R_ = choir([hz(n) for n in (('D3', 'A3', 'E4') if k == 0 else ('A3', 'E4', 'B4') if k == 1 else ('D4', 'A4', 'F#5'))], 1.6, 'ah', 1.0, atk=.04, rel=.9)
    put(L_, ts, .5, -.4, rm=.3, hl=1.0); put(R_, ts, .5, .4, rm=.3, hl=1.0)
RIFF = [[(0, 21, 1), (2, 26, 1), (3, 28, 1), (6, 30, 1), (8, 28, 1), (10, 26, 1), (11, 21, 1), (14, 23, 1)],
        [(0, 26, 1), (2, 30, 1), (3, 33, 1), (6, 35, 1), (8, 33, 1), (10, 30, 1), (12, 28, 1), (14, 26, 1)],
        [(0, 33, 1), (2, 30, 1), (4, 28, 1), (6, 26, 1), (8, 28, 1), (9, 30, 1), (11, 33, 1), (14, 35, 1)]]
for bar in range(3):
    tb = 15.0 + bar * BAR
    maqsum(tb + (0 if bar else 0), 1.0 if bar else .95)
    marimba_riff(tb, RIFF[bar], .27, 'D3')
    sub_line(tb, [(0, 'D1', 3), (3, 'D1', 2), (6, 'F#1', 2), (8, 'A1', 3), (12, 'E1', 3)] if bar != 1 else [(0, 'D1', 3), (3, 'D1', 2), (6, 'D1', 2), (8, 'E1', 3), (12, 'A1', 3)], .5)
for ci, nm in enumerate(([('D3', 'A3', 'F#4'), ('E3', 'B3', 'G#4'), ('F#3', 'C#4', 'A4')])):
    L_, R_ = strings([hz(n) for n in nm], BAR, 2100, 1.0, atk=.25, rel=.35); put(L_, 15.0 + ci * BAR, .30, -.35, rm=.3, hl=.7, duck=True); put(R_, 15.0 + ci * BAR, .30, .35, rm=.3, hl=.7, duck=True)
ID = {i['name']: i['t'] for i in g['ideas']}
ts = ID['stairs']                                                           # a spiral: D major 9th climbing
for k, nm in enumerate(('D3', 'A3', 'E4', 'F#4', 'A4', 'E5', 'A5')):
    put(marimba(hz(nm), .8), ts + k * .095, .30, -.7 + .22 * k / 2, rm=.25, hl=.5, ec=.4)
ts = ID['tree']                                                             # a breath of wood flute and rustling leaves
n_ = int(1.2 * SR); fl = (np.sin(2 * np.pi * np.cumsum(np.full(n_, hz('A4'))) / SR) + .5 * bp(noise(n_), 3000, 6000)) * env_ar(n_, .08, .5)
put(fl, ts, .16, .4, rm=.3, hl=.8); put(np.sin(2 * np.pi * np.cumsum(np.full(int(.9 * SR), hz('E5'))) / SR) * env_ar(int(.9 * SR), .06, .4), ts + .22, .14, .4, rm=.3, hl=.8)
for k in range(14): put(bp(noise(int(.05 * SR)), 3500, 9000) * np.hanning(int(.05 * SR)), ts + .1 + k * .09 + rs.uniform(0, .04), .05, rs.uniform(-.5, .8), rm=.3)
put(blip(500, 1300, .26), ID['balloonW'], .30, .55, rm=.3, hl=.4); put(blip(700, 1800, .24), ID['balloonW'] + .13, .20, .55, rm=.3)   # bright bubble
put(blip(200, 520, .32), ID['balloonB'], .34, -.55, rm=.3, hl=.4); put(blip(260, 640, .28), ID['balloonB'] + .15, .22, -.55, rm=.3)   # dark bubble
ta = ID['atom']                                                              # a metal orbit that circles the listener
n_ = int(1.6 * SR); orb = (glass_tone(hz('A5'), 1.6, 1.4, .6) + .6 * glass_tone(hz('E6'), 1.6, 1.4, .5))
th_ = np.linspace(0, 2 * np.pi * 2, n_); pL = np.cos(th_ / 2) ** 2; pR = 1 - pL
i_ = int(round(W(ta) * SR)); L_b = orb * pL; R_b = orb * pR
dry.L[i_:i_ + n_] += L_b[:max(0, min(n_, N - i_))] * .22; dry.R[i_:i_ + n_] += R_b[:max(0, min(n_, N - i_))] * .22; hall.L[i_:i_ + n_] += L_b[:max(0, min(n_, N - i_))] * .14; hall.R[i_:i_ + n_] += R_b[:max(0, min(n_, N - i_))] * .14
put(sine_sweep(1.0, 300, 3500, 1.2), ta, .09, 0, hl=.5)
tb_ = ID['birds']
for k, dt in enumerate((0, .17, .29, .52, .6, .9, 1.05, 1.31, 1.4)):
    put(chirp(rs.uniform(2600, 3600), rs.uniform(3800, 5200), rs.uniform(.07, .15)), tb_ + dt, .10, rs.uniform(-.8, .8), rm=.3, hl=.4)
put(bp(noise(int(1.3 * SR)), 900, 3500) * np.hanning(int(1.3 * SR)), tb_, .05, 0, rm=.3)
t4 = sp[3]
put(riser(22.5 - .12 - t4, 250, 11000, 2.1), t4, .26, 0, rm=.15); put(sine_sweep(22.5 - .12 - t4, 110, 2400, 2.0), t4, .09, 0, hl=.3)
put(boom(1.6, 76, 34, .6), t4, .45, 0, rm=.1, hl=.4); put(timpani(hz('A2'), 1.8, 1.0), t4, .4, 0, rm=.2, hl=.4)
t_ = 22.5 - 1.0; gap_ = S16 * 2; i = 0
while t_ < 22.5 - .13:
    put(tak(g=1.0), t_, .24 + .015 * i, rs.uniform(-.3, .3), rm=.2); put(snare_mil(.14, 1.0), t_ + S16 / 2, .14, 0, rm=.2); t_ += gap_; gap_ = max(.04, gap_ * .84); i += 1
GAPS.append(22.5)

# ── the flip: white → black space ──────────────────────────────────────────────────────────────────
tf = 22.5
for k in range(4): put(bp(noise(int(.03 * SR)), 1500, 9000) * np.hanning(int(.03 * SR)), tf + k / 60.0, .30, (-1) ** k * .6, rm=.1)
put(cymbal(2.0)[::-1], tf - 2.0, .16, 0, rm=.2, hl=.5)
put(boom(4.0, 70, 24, 1.0), tf, 1.0, 0, rm=.1, hl=.8); put(gong(48, 6.0, 1.0), tf, .30, 0, hl=.6); hit_duck(tf, .85)
put(sub_hit(hz('D1'), 3.0, 2.2, 1.0), tf, .6, 0)

# ── ٤ · التنين  22.5 → 30 : D minor — two forces a half-step apart ────────────────────────────────────
T4 = tf
prog4 = [('D2', 'A2', 'D3', 'F3'), ('Bb1', 'F2', 'Bb2', 'D3'), ('G1', 'D2', 'G2', 'Bb2'), ('A1', 'E2', 'A2', 'C#3')]
for bar in range(4):
    tb = T4 + bar * BAR
    L_, R_ = strings([hz(n) for n in prog4[bar][1:]], BAR + .15, 1500, 1.0, atk=.35, rel=.4); put(L_, tb, .36, -.3, rm=.3, hl=.8, duck=True); put(R_, tb, .36, .3, rm=.3, hl=.8, duck=True)
    put(reese(hz(prog4[bar][0]), BAR + .1, .5, (140, 520), .45 + .1 * bar), tb, .40, 0, duck=True)
    put(taiko(1.4, 120, 44, 1.0), tb, .55, 0, rm=.3, hl=.4); hit_duck(tb, .6)
    for s_, kind, v in ((6, 'D', .7), (10, 'D', .8)): put(dum(.5, 160, 62), tb + s_ * S16, .46 * v, 0, rm=.2, hl=.2); hit_duck(tb + s_ * S16, .4)
    for s_, v in ((4, .8), (12, 1.0), (14, .5)): put(tak(g=1.0), tb + s_ * S16, .30 * v, .3, rm=.2, hl=.2)
    put(daf(1.0, 1.0), tb + 8 * S16, .30, -.2, rm=.4, hl=.4)
    for s_ in range(0, 16, 2): put(shaker(g=1.0), tb + s_ * S16, .06, .4 * (1 if (s_ // 2) % 2 else -1))
# purple (left): a cold 'oo' choir; red (right): hot brass — the clash is in the harmony
cold = [(0, 'A4', 4), (4, 'F5', 2), (6, 'E5', 2), (8, 'D5', 4), (12, 'Bb4', 2), (14, 'A4', 2)]
for sb, nm, ln in cold:
    L_, R_ = choir([hz(nm), hz(nm) * .5], ln * BEAT * .98, 'oo', 1.0, atk=.4, rel=.4)
    put(L_, T4 + sb * BEAT, .34, -.7, rm=.3, hl=1.0); put(R_, T4 + sb * BEAT, .20, -.2, rm=.3, hl=1.0)
for bar in range(4):                                                         # the dragon's theme, low and slow, in the right ear
    tb = T4 + bar * BAR
    for st, nm, ln in ((0, 'D2', 6), (6, 'F2', 4), (10, 'Eb2', 3), (13, 'D2', 3)) if bar % 2 == 0 else ((0, 'D2', 5), (5, 'Eb2', 3), (8, 'F2', 4), (12, 'A2', 4)):
        put(brass(hz(nm) * 2, ln * S16 * .95, 380, 2000, .06, 1.0), tb + st * S16, .24, .65, rm=.25, hl=.5, duck=True)
for tg in (T4 + BAR, T4 + 2 * BAR, T4 + 3 * BAR): put(growl(1.5), tg + .2, .40, 0, rm=.25, hl=.5)
Tf = 2 * np.pi / g['dragon']['flapOmega']; tf2 = 23.9
while tf2 < 36.6:
    put(flap(), tf2, .30, -.3 if int((tf2 - 23.9) / Tf) % 2 else .3, rm=.3, hl=.3); tf2 += Tf
for tcut in (24.375, 26.25, 28.125):
    put(whoosh(.45, True, 500, 9000), tcut - .43, .14, 0, rm=.3); put(boom(.7, 90, 46, .4), tcut, .26, 0, rm=.15); put(brass(hz('D3'), .5, 500, 3000, .02, 1.0), tcut, .22, .6, rm=.3, hl=.4)
put(riser(30 - .12 - 28.2, 250, 10000, 2.0), 28.2, .22, 0, rm=.15)
GAPS.append(30.0)

# ── ٥ · القلعة  30 → 37.5 : a fanfare in B♭ → D, stones laid like a marimba climbing ───────────────
T5 = g['castle']['T0']
put(boom(3.2, 74, 26, 1.0), T5, 1.0, 0, rm=.1, hl=.7); put(timpani(hz('D2'), 2.4, 1.0), T5, .6, 0, rm=.2, hl=.5); put(gong(55, 5.0, .9), T5, .2, 0, hl=.6); hit_duck(T5, .8)
put(rumble(4.6, 120), T5, .38, 0, hl=.5)
prog5 = [('D2', ('A2', 'D3', 'F3')), ('Bb1', ('F2', 'Bb2', 'D3')), ('F2', ('C3', 'F3', 'A3')), ('A1', ('E2', 'A2', 'C#3'))]
for bar in range(4):
    tb = T5 + bar * BAR; root, ch = prog5[bar]
    L_, R_ = strings([hz(n) for n in ch], BAR + .15, 2200, 1.0, atk=.3, rel=.4); put(L_, tb, .38, -.3, rm=.3, hl=.8, duck=True); put(R_, tb, .38, .3, rm=.3, hl=.8, duck=True)
    put(reese(hz(root), BAR + .1, .45, (150, 480), .4), tb, .36, 0, duck=True)
    for q in range(4):
        put(taiko(1.0, 110, 46, 1.0), tb + q * BEAT, (.5 if q == 0 else .28), 0, rm=.25, hl=.3)
        if q == 0 or q == 2: hit_duck(tb + q * BEAT, .5)
    for s_ in range(0, 16, 2): put(snare_mil(.14, 1.0), tb + s_ * S16, .10 + .04 * (s_ % 4 == 0), .3 * (1 if (s_ // 2) % 2 else -1), rm=.2)
    L_, R_ = choir([hz(ch[2]) * 2, hz(ch[1]) * 2], BAR, 'ah', 1.0, atk=.5, rel=.5); put(L_, tb, .26, -.5, rm=.3, hl=1.0); put(R_, tb, .26, .5, rm=.3, hl=1.0)
rs_, re_ = g['castle']['riseStart'], g['castle']['riseEnd']
for k in range(64):                                                         # each laid block is a marimba note; the line climbs the maqam
    u = k / 63; tk = T5 + rs_ + (re_ - rs_) * u ** 1.15 + rs.uniform(0, .03)
    deg = [0, 2, 3, 5, 7, 8, 10][k % 7] + 12 * int(u * 2.4) ; put(marimba(hz('D3') * 2 ** (deg / 12), .5), tk, .12 + .10 * u, rs.uniform(-.7, .7), rm=.25, hl=.3)
    if k % 2 == 0: put(wood(rs.uniform(180, 340)), tk, .10 + .06 * u, rs.uniform(-.7, .7), rm=.25)
tf3 = T5 + 2.7                                                              # the keep's roof closes: horns
for nm, dt in (('D4', 0), ('F4', .0), ('A4', 0), ('D5', 0)): put(brass(hz(nm), 1.5, 600, 3400, .06, 1.0), tf3, .17, rs.uniform(-.4, .4), rm=.3, hl=.8)
for k in range(8): put(timpani(hz('D2'), .5, .8), tf3 - .6 + k * .07, .1 + .03 * k, 0, rm=.2)
put(riser(37.5 - .12 - 36.0, 250, 11000, 2.1), 36.0, .22, 0, rm=.15)
t_ = 36.5; gap_ = S16 * 2; i = 0
while t_ < 37.5 - .13:
    put(snare_mil(.14, 1.0), t_, .18 + .015 * i, 0, rm=.2); put(taiko(.5, 120, 60, .8), t_, .12, 0); t_ += gap_; gap_ = max(.04, gap_ * .85); i += 1
GAPS.append(37.5)

# ── ٦ · الفريقان  37.5 → 45 : Dm against E♭m ──────────────────────────────────────────────────────
T6 = g['rival']['T0']
put(boom(4.2, 62, 22, 1.0), T6, 1.0, 0, rm=.1, hl=.8); put(crack_snap(1.4), T6, .40, 0, rm=.3, hl=.5); put(gong(41, 7.0, 1.0), T6, .3, 0, hl=.7); hit_duck(T6, .9)
put(whoosh(2.2, False, 9000, 220), g['rival']['wipe0'], .20, 0, rm=.3, hl=.4)
L_, R_ = choir([hz(n) for n in ('D3', 'F3', 'A3', 'D4')], 7.4, 'oo', 1.0, atk=.9, rel=1.0); put(L_, T6, .50, -.75, rm=.3, hl=1.0); put(R_, T6, .26, -.25, rm=.3, hl=1.0)                          # purple: Dm
for nm in ('Eb3', 'Gb3', 'Bb3', 'Eb4'): put(brass(hz(nm), 7.2, 360, 1500, 1.4, 1.0), T6 + .3, .075, .8, rm=.3, hl=.8)                                                                                      # red: E♭m
put(reese(hz('D1'), 7.4, .7, (90, 260), .3), T6, .40, -.1); put(reese(hz('Eb1'), 7.4, .7, (90, 260), .37), T6, .32, .1)
for bar in range(4):                                                         # war drums: 3 against 4
    tb = T6 + bar * BAR
    for q in range(3):
        if bar == 0 and q == 0: continue
        put(taiko(1.2, 118, 45, 1.0), tb + q * (BAR / 3), .50 if q == 0 else .36, -.1 + .1 * q, rm=.4, hl=.5)
    for q in (1, 3): put(daf(.9, 1.0), tb + q * BEAT, .20, .2, rm=.4, hl=.3)
march0 = g['rival']['march']; t_ = march0; step = BEAT
while t_ < 45.8:                                                             # the march: boots on stone, then a quickening snare
    u = (t_ - march0) / (45.8 - march0)
    put(wood(rs.uniform(110, 150), .3), t_, .16 + .14 * u, rs.uniform(-.5, .5), rm=.3)
    put(bp(noise(int(.07 * SR)), 300, 1800) * np.exp(-tt(int(.07 * SR)) / .02), t_ + .001, .10 + .10 * u, rs.uniform(-.6, .6), rm=.3)
    if u > .35: put(snare_mil(.14, 1.0), t_ + step / 2, .10 + .12 * u, 0, rm=.2)
    t_ += step * (0.5 if u > 0.6 else 1.0)
for nm, dur_ in (('D3', 4.6), ('A2', 4.6)): put(brass(hz(nm), dur_, 340, 2300, 1.5, 1.0), march0, .17, 0, rm=.35, hl=.9)
put(brass(hz('Eb3'), 2.1, 380, 2200, .6, 1.0), 43.125, .20, .6, rm=.35, hl=.8); put(brass(hz('F#3'), 2.1, 380, 2400, .6, 1.0), 43.125, .13, .6, rm=.35, hl=.8)
for tcut in (39.6, 43.8): put(whoosh(.5, True, 500, 9000), tcut - .45, .12, 0, rm=.3); put(boom(.7, 90, 46, .4), tcut, .24, 0, rm=.15)
put(swirl(4.2, 400, 2400, .45), 39.6, .08, 0, rm=.3, hl=.4)
t_ = 43.9; gap_ = BEAT / 2; i = 0
while t_ < 45.0 - .05:
    put(snare_mil(.14, 1.0), t_, .12 + .02 * i, 0, rm=.2); t_ += gap_; gap_ = max(.045, gap_ * .86); i += 1
put(riser(1.1, 300, 8000, 2.0), 43.9, .12, 0, rm=.2)

# ── ٧ · الاصطدام  45 → 52.5 ───────────────────────────────────────────────────────────────────────
c = g['clash']
put(whoosh(.45, True, 500, 9000), 44.55, .12, 0, rm=.3)
for q in range(2): put(daf(1.0, 1.0), 45.0 + q * BEAT, .45, 0, rm=.3, hl=.3)
L_, R_ = strings([hz(n) for n in ('D2', 'A2', 'Eb3')], 2.0, 700, 1.0, atk=.4, rel=.5); put(L_, 45.0, .38, -.3, rm=.3, hl=.9); put(R_, 45.0, .38, .3, rm=.3, hl=.9)
t_ = 45.8; gap_ = BEAT / 2; i = 0                                           # the charge: a tom roll quickening into a blur
while t_ < c['slow0'] + .02:
    put(taiko(.55, 150 - 2 * i, 60, 1.0), t_, .38 + .015 * i, rs.uniform(-.3, .3), rm=.3); t_ += gap_; gap_ = max(.05, gap_ * .9); i += 1
put(sine_sweep(c['slow0'] - 45.8, 80, 1900, 2.0), 45.8, .11, 0, rm=.2); put(riser(c['slow0'] - 45.8, 300, 10000, 2.2), 45.8, .22, 0, rm=.15)
put(sub_hit(hz('D2'), 4.0, 1.0, .9), c['slow0'] + .1, .45, 0)
L_, R_ = choir([hz(n) for n in ('D3', 'A3', 'Eb4', 'A4')], 3.6, 'ah', 1.0, atk=.3, rel=1.0); put(L_, c['slow0'], .46, -.4, rm=.3, hl=1.0); put(R_, c['slow0'], .46, .4, rm=.3, hl=1.0)
tI = c['TCR']
put(boom(4.6, 84, 22, 1.0), tI, 1.0, 0, rm=.1, hl=.8); put(gong(46, 7.5, 1.0), tI, .45, 0, hl=.8); put(cymbal(3.8), tI, .30, 0, rm=.3, hl=.6)
put(crack_snap(2.0), tI, .45, 0, rm=.3, hl=.6); put(taiko(1.5, 130, 42, 1.0), tI, .6, 0, rm=.3, hl=.4); hit_duck(tI, 1.0)
for nm in ('D2', 'A2', 'D3'): put(sub_hit(hz(nm), 3.0, 1.6, 1.0), tI, .30, 0)
L_, R_ = choir([hz(n) for n in ('D3', 'Eb3', 'A3', 'Bb3', 'D4', 'Eb4')], 3.0, 'ah', 1.0, atk=.02, rel=1.4); put(L_, tI, .46, -.5, rm=.3, hl=1.0); put(R_, tI, .46, .5, rm=.3, hl=1.0)
for rk, tr in enumerate(c['ranks']):                                          # the wave of impact through the ranks
    gg = .34 * (1 - .06 * rk)
    put(bp(noise(int(.3 * SR)), 250, 4200) * np.exp(-tt(int(.3 * SR)) / .05), tr, gg, rs.uniform(-.7, .7), rm=.35, hl=.3)
    put(taiko(.7, 150, 55, 1.0), tr, gg * .9, rs.uniform(-.4, .4), rm=.3)
    for _ in range(12): put(wood(rs.uniform(260, 1200), .12), tr + rs.uniform(0, .25), rs.uniform(.04, .10), rs.uniform(-.9, .9), rm=.25)
put(riser(c['fast1'] - c['fast0'] + .3, 200, 9000, 1.8), c['fast0'] - .1, .20, 0, rm=.2); put(whoosh(.5, False, 9000, 200), c['fast1'], .20, 0, rm=.3)
for k in range(150):                                                        # the debris falls like glass and wood
    tk = c['fast1'] + rs.exponential(.85)
    if tk > 52.3: continue
    a_ = np.exp(-(tk - c['fast1']) / 1.6)
    if rs.random() < .55: put(glass_tone(scale_note(int(rs.integers(0, 14)), hz('D5'), PENT), .6, .6, .18), tk, rs.uniform(.02, .06) * a_ * 2, rs.uniform(-.9, .9), hl=.8)
    else: put(wood(rs.uniform(180, 1300), .14), tk, rs.uniform(.05, .12) * a_, rs.uniform(-.9, .9), rm=.3)
put(rumble(3.0, 150), c['fast1'] + .1, .30, 0, hl=.4)
L_, R_ = strings([hz(n) for n in ('D2', 'A2', 'F3', 'C4')], 2.6, 1300, 1.0, atk=1.1, rel=.8); put(L_, 50.2, .38, -.3, rm=.3, hl=1.0); put(R_, 50.2, .38, .3, rm=.3, hl=1.0)

# ── ٨ · العودة  52.5 → 60 : the forces become one D, the world turns white ──────────────────────────
u_ = g['unity']; T8, TCB = u_['T0'], u_['T_CUBE']
tone_L = brass(hz('D3'), 29.0 - 0, 700, 700, 1.2, 1.0) if False else None
n_ = int(2.4 * SR); k_ = np.linspace(0, 1, n_)                               # red slides down into D, purple holds: a single pitch
glide = sg.sawtooth(2 * np.pi * np.cumsum(hz('Eb3') * (hz('D3') / hz('Eb3')) ** (k_ ** 1.6)) / SR) * .5
put(lp(glide, 900, 2) * np.minimum(1, k_ * 20) * np.minimum(1, (1 - k_) * 12), 52.3, .18, .7, rm=.3, hl=.9)
put(swirl(TCB - T8, 150, 2400, 3.4), T8, .46, 0, rm=.3, hl=.5); put(sine_sweep(TCB - T8, 120, 1700, 1.4), T8, .28, 0, rm=.3, hl=.6); put(riser(TCB - T8, 300, 11000, 1.8), T8, .30, 0, rm=.15)
L_, R_ = choir([hz('D3'), hz('D4')], TCB - T8 + .1, 'oo', 1.0, atk=1.6, rel=.1); put(L_, T8, .6, -.4, rm=.3, hl=1.0); put(R_, T8, .6, .4, rm=.3, hl=1.0)
put(sub_hit(hz('D2'), 2.1, 1.0, .9), T8, .38, 0)
for q in range(5): put(daf(1.0, 1.0), T8 + .4 + q * BEAT * (1 - .1 * q), .40 + .08 * q, 0, rm=.2)
GAPS.append(TCB)
put(boom(3.0, 70, 30, .6), TCB, .75, 0, rm=.1, hl=.8); put(cymbal(2.8), TCB, .16, 0, rm=.3, hl=.7)
for nm, gg in (('D5', .13), ('F#5', .12), ('A5', .12), ('E6', .10), ('B6', .08)): put(glass_tone(hz(nm), 3.8, 1.2, 1.6), TCB, gg, rs.uniform(-.5, .5), rm=.4, hl=1.0)
L_, R_ = choir([hz(n) for n in ('D3', 'A3', 'E4', 'F#4', 'A4')], 5.4, 'ah', 1.0, atk=.5, rel=1.6); put(L_, TCB, .6, -.4, rm=.3, hl=1.0); put(R_, TCB, .6, .4, rm=.3, hl=1.0)
put(sub_hit(hz('D2'), 5.0, 1.0, .9), TCB, .36, 0)
motif = [0, 4, 7, 2, 9, 7, 4, 2]                                              # D F# A E B… the opening's glass, now in major
for k in range(10): put(kalimba(hz('D5') * 2 ** (motif[k % 8] / 12 * (1 if True else 1)), 1.8), TCB + .6 + k * BEAT, .22, -.3 + .07 * k, rm=.3, hl=.9, ec=.5)
t1 = u_['T_TXT1']
put(boom(2.2, 62, 30, .4), t1, .4, 0, rm=.2, hl=1.0)
L_, R_ = choir([hz(n) for n in ('D3', 'A3', 'D4', 'F#4', 'A4', 'E5')], 2.0, 'ah', 1.0, atk=.4, rel=.9); put(L_, t1, .46, -.4, rm=.3, hl=1.0); put(R_, t1, .46, .4, rm=.3, hl=1.0)
t2 = u_['T_TXT2']
put(kalimba(hz('C#5'), 2.0), t2, .26, .2, rm=.3, hl=.9, ec=.4); put(kalimba(hz('D5'), 3.0), t2 + BEAT / 2, .30, .2, rm=.3, hl=1.0, ec=.5)            # the leading tone resolves
L_, R_ = choir([hz(n) for n in ('D3', 'A3', 'D4', 'F#4', 'A4', 'D5')], 2.4, 'ah', 1.0, atk=.35, rel=1.3); put(L_, t2 + BEAT / 2, .50, -.4, rm=.3, hl=1.0); put(R_, t2 + BEAT / 2, .50, .4, rm=.3, hl=1.0)
for nm in ('D6', 'A5', 'F#5', 'D5'): put(glass_tone(hz(nm), 3.4, 1.0, 1.4), t2 + BEAT / 2, .10, rs.uniform(-.5, .5), rm=.3, hl=1.0)
for i, nm in enumerate(('D6', 'A5', 'F#5', 'D5', 'A4')): put(glass_tone(hz(nm), 2.8, .8, 1.2), u_['T_WHITE'] + i * S16 * 1.5, .08, -.4 + .2 * i, hl=1.0)

# ═══ mix ═══════════════════════════════════════════════════
duck = np.ones(N)
for ti, depth in DUCK:
    i = int(ti * SR); m = int(.30 * SR)
    if i >= N: continue
    e = 1 - depth * np.exp(-np.arange(min(m, N - i)) / (.09 * SR)) * np.minimum(1, np.arange(min(m, N - i)) / (.005 * SR))
    duck[i:i + len(e)] = np.minimum(duck[i:i + len(e)], e)
dry.L += bed.L * duck; dry.R += bed.R * duck
gap = np.ones(N)
for tg in GAPS:
    td = W(tg); a, b = int((td - .117) * SR), int(td * SR); f0 = int(.006 * SR)
    if a - f0 < 0 or b >= N: continue
    gap[a - f0:a] = np.linspace(1, 0, f0); gap[a:b] = 0; gap[b - 90:b] = np.linspace(0, 1, 90)
dry.L *= gap; dry.R *= gap
for bus in (room, hall, echo): bus.L *= (.25 + .75 * gap); bus.R *= (.25 + .75 * gap)

def make_ir(rt60, pre, damp, seed):
    n = int(SR * (rt60 * 1.15 + pre)); t = tt(n); out = []
    for ch in range(2):
        r = np.random.default_rng(seed + ch * 17); x = r.standard_normal(n)
        y = (lp(x, damp, 1) * np.exp(-6.9 * t / rt60) * np.exp(-t / (rt60 * .35)) + lp(x, 900, 1) * np.exp(-6.9 * t / rt60)) * (t > pre)
        out.append(y / np.sqrt(np.sum(y ** 2) + 1e-9))
    return out
def conv(bus, ir): return fftconvolve(bus.L, ir[0])[:N], fftconvolve(bus.R, ir[1])[:N]
rrL, rrR = conv(room, make_ir(.9, .012, 6800, 3)); hhL, hhR = conv(hall, make_ir(4.2, .03, 4600, 9))
def pingpong(bus, fb=.45, dt=.75 * BEAT):
    d = int(dt * SR); cur = (bus.L + bus.R) * .5; oL = np.zeros(N); oR = np.zeros(N)
    for k in range(1, 7):
        s = k * d
        if s >= N: break
        (oL if k % 2 else oR)[s:] += cur[:N - s] * fb ** k
    return lp(oL, 6000, 1), lp(oR, 6000, 1)
eL, eR = pingpong(echo)
L = dry.L + .55 * rrL + .62 * hhL + .5 * eL; R = dry.R + .55 * rrR + .62 * hhR + .5 * eR

# bullet time: read the whole mix through the picture's own warp curve (tape-slow, pitch falls with it)
idx = np.clip(np.interp(np.arange(N) / SR, np.arange(len(WARP)) * WARP_DT, WARP) * SR, 0, N - 1.001)
i0 = np.floor(idx).astype(int); fr = idx - i0
L = L[i0] * (1 - fr) + L[i0 + 1] * fr; R = R[i0] * (1 - fr) + R[i0 + 1] * fr

knots = [(0, .80), (2.8, .95), (3.0, 1.05), (5.4, 1.0), (5.55, 1.15), (7.4, 1.0), (7.5, .90), (11.2, .95), (11.25, 1.12), (14.9, 1.08), (15.0, 1.15),
         (22.4, 1.15), (22.5, 1.18), (29.9, 1.10), (30.0, 1.12), (37.4, 1.10), (37.5, 1.12), (44.9, 1.0), (45.0, .95), (47.4, 1.0), (47.5, 1.22), (50.5, 1.0),
         (52.4, .95), (54.5, .95), (54.65, 1.10), (58.0, 1.0), (60.0, .9)]
gt = np.interp(np.arange(N) / SR, [k[0] for k in knots], [k[1] for k in knots]); L *= gt; R *= gt

L = hp(L, 28, 2); R = hp(R, 28, 2)
pk = max(np.max(np.abs(L)), np.max(np.abs(R))); L, R = L / pk, R / pk
L = soft(L * 1.5, 1.2); R = soft(R * 1.5, 1.2)
pk = max(np.max(np.abs(L)), np.max(np.abs(R))); L, R = L / pk * .85, R / pk * .85
fo = int(1.4 * SR); L[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2; R[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2
L[:300] *= np.linspace(0, 1, 300); R[:300] *= np.linspace(0, 1, 300)
out = np.stack([L, R], 1)
wavfile.write('audio.wav', SR, (out * 32767).astype(np.int16))
print('audio.wav written', out.shape, 'peak', np.max(np.abs(out)).round(3))
