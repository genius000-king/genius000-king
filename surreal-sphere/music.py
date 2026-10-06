"""Soundtrack for the surreal-sphere film, synthesised from scratch and locked to timeline.json.

void shimmer -> gravity drone -> rubber stretch -> pinch "pop" + glass chord -> hypnotic arpeggio
-> grip impact -> heartbeat tension -> hands rising -> full drums + stabs on every grip -> climax roll
-> inhale (reverse suck) -> explosion -> ethereal aftermath.
"""
import json
import os
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
TL = json.load(open(os.path.join(HERE, "timeline.json")))
SR = 48000
DUR = TL["duration"]
N = int(DUR * SR)
T = np.arange(N) / SR
rng = np.random.default_rng(7)

BEAT = 60.0 / TL["bpm"]
B0 = TL["beatOffset"]
TE = TL["explode"]
GRIPS = [h[1] for h in TL["hands"]]


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def note(name):
    names = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6,
             "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
    p, o = name[:-1], int(name[-1])
    return mtof(12 * (o + 1) + names[p])


def stereo():
    return np.zeros((N, 2))


def seg(t0, t1):
    a, b = max(0, int(t0 * SR)), min(N, int(t1 * SR))
    return a, b


def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def lp(x, fc, order=2):
    sos = butter(order, min(fc, SR * 0.45), "low", fs=SR, output="sos")
    return sosfilt(sos, x, axis=0)


def hp(x, fc, order=2):
    sos = butter(order, fc, "high", fs=SR, output="sos")
    return sosfilt(sos, x, axis=0)


def bp(x, f0, f1, order=2):
    sos = butter(order, [f0, min(f1, SR * 0.45)], "band", fs=SR, output="sos")
    return sosfilt(sos, x, axis=0)


def sweep_lp(x, cutoff, block=256):
    """Time-varying low-pass (cutoff array per sample), block-wise with carried state."""
    y = np.zeros_like(x)
    zi = None
    for i in range(0, len(x), block):
        fc = float(np.clip(cutoff[min(i + block // 2, len(cutoff) - 1)], 30, SR * 0.45))
        sos = butter(2, fc, "low", fs=SR, output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2) + x.shape[1:])
        y[i:i + block], zi = sosfilt(sos, x[i:i + block], axis=0, zi=zi)
    return y


def saw(phase):
    return 2.0 * (phase % 1.0) - 1.0


def osc_phase(freq):
    """Integrate an instantaneous-frequency array into phase (cycles)."""
    return np.cumsum(freq) / SR


def pan(mono, p):
    p = np.clip(p, -1, 1)
    l = np.cos((p + 1) * np.pi / 4)
    r = np.sin((p + 1) * np.pi / 4)
    return np.stack([mono * l, mono * r], axis=-1)


def place(bus, sig, t0, gain=1.0):
    a = int(t0 * SR)
    if a >= N:
        return
    if a < 0:
        sig = sig[-a:]
        a = 0
    b = min(N, a + len(sig))
    bus[a:b] += sig[: b - a] * gain


def env_adsr(n, a, d, s, r, sustain_time):
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), 1.0)
    e = np.where((t >= a) & (t < a + d), 1 - (1 - s) * (t - a) / max(d, 1e-4), e)
    e = np.where((t >= a + d) & (t < sustain_time), s, e)
    e = np.where(t >= sustain_time, s * np.exp(-(t - sustain_time) / max(r, 1e-4)), e)
    return e


# ------------------------------------------------------------------ instruments
def kick(dur=0.6, f0=125, f1=42, decay=0.32, click=0.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 28)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / decay)
    s += click * rng.standard_normal(n) * np.exp(-t * 300)
    return np.tanh(s * 1.6)


def snare(dur=0.35, tone=185, decay=0.16):
    n = int(dur * SR)
    t = np.arange(n) / SR
    nz = bp(rng.standard_normal(n), 1500, 9000) * np.exp(-t / decay)
    tn = np.sin(2 * np.pi * tone * t) * np.exp(-t / 0.07)
    return nz * 0.9 + tn * 0.5


def hat(dur=0.08, decay=0.03):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7000) * np.exp(-t / decay)


def tom(f0=150, f1=85, dur=0.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 9)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.28)


def fm_bell(freq, dur=1.6, idx=2.2, ratio=3.5, decay=0.7):
    n = int(dur * SR)
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * freq * ratio * t) * idx * np.exp(-t / (decay * 0.5))
    s = np.sin(2 * np.pi * freq * t + mod) * np.exp(-t / decay)
    return s * np.minimum(1, t / 0.003)


def supersaw(freqs, dur, attack=0.01, decay=0.5, cutoff=3200, detune=0.18, voices=7):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for f in freqs:
        for v in range(voices):
            d = (v - (voices - 1) / 2) / ((voices - 1) / 2) * detune
            ff = f * 2 ** (d / 12)
            s += saw(ff * t + rng.random())
    s /= len(freqs) * voices
    e = np.minimum(1, t / attack) * np.exp(-t / decay)
    return lp(s * e, cutoff)


def pad(freqs, dur, attack=1.2, release=1.5, cutoff=1800, detune=0.1):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for f in freqs:
        for d in (-detune, 0, detune):
            s += saw(f * 2 ** (d / 12) * t + rng.random())
    s /= len(freqs) * 3
    e = smooth(t, 0, attack) * (1 - smooth(t, dur - release, dur))
    return lp(s * e, cutoff)


def choir(freqs, dur, attack=1.0, release=2.0):
    """Formant-filtered saws: an 'aah' choir."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for f in freqs:
        vib = 1 + 0.004 * np.sin(2 * np.pi * (5.1 + rng.random()) * t + rng.random() * 6)
        for d in (-0.08, 0.0, 0.08):
            s += saw(np.cumsum(f * 2 ** (d / 12) * vib) / SR + rng.random())
    s /= len(freqs) * 3
    v = bp(s, 600, 900) * 1.0 + bp(s, 1050, 1350) * 0.6 + bp(s, 2400, 2900) * 0.25
    e = smooth(t, 0, attack) * (1 - smooth(t, dur - release, dur))
    return v * e * 2.2


def impact(dur=4.5, big=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 24 + 70 * np.exp(-t * 6)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.9 * big))
    nz = rng.standard_normal(n) * np.exp(-t / (0.35 * big))
    nz = sweep_lp(nz[:, None], 9000 * np.exp(-t * 2.2) + 120)[:, 0]
    body = np.tanh(3.0 * (sub + 0.6 * nz))
    return body


# ------------------------------------------------------------------ buses
dry = stereo()
verb = stereo()      # long hall send
drums = stereo()


def add(sig, t0, gain=1.0, p=0.0, send=0.0, bus=None):
    st = pan(sig, p) if sig.ndim == 1 else sig
    place(bus if bus is not None else dry, st, t0, gain)
    if send > 0:
        place(verb, st, t0, gain * send)


# A. the white void: airy shimmer
a, b = seg(0, 9.0)
tt = T[a:b]
shim = np.zeros(b - a)
for f, ph in ((note("D6"), 0.0), (note("A6"), 1.3), (note("E7"), 2.1), (note("F#7"), 0.7)):
    shim += np.sin(2 * np.pi * f * tt + ph) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.31 * tt + ph))
shim *= smooth(tt, 0, 2.0) * (1 - smooth(tt, 7.0, 9.0)) * 0.035
air = hp(rng.standard_normal(b - a), 3000) * smooth(tt, 0, 2.5) * (1 - smooth(tt, 6.5, 8.5)) * 0.012
dry[a:b] += pan(shim, -0.2) + pan(air, 0.3)
verb[a:b] += pan(shim, 0.2) * 0.8

# B. gravity drone: the floor warps
a, b = seg(TL["dimpleStart"] - 0.3, TL["pinch"] + 0.4)
tt = T[a:b] - T[a]
bend = 2 ** (-0.6 / 12 * smooth(tt, 0, 3.0))
sub = np.sin(2 * np.pi * np.cumsum(note("D1") * bend) / SR)
low = saw(np.cumsum(note("D2") * bend) / SR) + saw(np.cumsum(note("D2") * 1.004 * bend) / SR)
low = sweep_lp(low[:, None], 180 + 900 * smooth(tt, 0, tt[-1]))[:, 0]
dr = (sub * 0.2 + low * 0.07) * (0.35 + 0.65 * smooth(tt, 0, tt[-1])) * smooth(tt, 0, 2.5) * (1 - smooth(tt, tt[-1] - 0.25, tt[-1]))
dry[a:b] += pan(dr, 0)
verb[a:b] += pan(dr, 0) * 0.25

# C. rubber stretch rising into the pinch
a, b = seg(TL["riseStart"], TL["pinch"])
tt = T[a:b] - T[a]
L = tt[-1]
f = 110 * (8 ** (tt / L) ** 1.6)
vib = 1 + 0.02 * (tt / L) * np.sin(2 * np.pi * (5 + 9 * tt / L) * tt)
ph = np.cumsum(f * vib) / SR
st = np.sin(2 * np.pi * ph + 2.5 * (tt / L) * np.sin(2 * np.pi * ph * 2.01))
st = np.tanh(st * (1 + 2 * tt / L)) * smooth(tt, 0, 1.2) * 0.12
dry[a:b] += pan(st, -0.15)
verb[a:b] += pan(st, 0.15) * 0.5
riser = bp(rng.standard_normal(b - a), 300, 9000)
riser = sweep_lp(riser[:, None], 400 + 9000 * (tt / L) ** 2)[:, 0] * (tt / L) ** 2 * 0.09
dry[a:b] += pan(riser, 0.2)
# reversed bell swell (a chord played backwards) into the pinch
rev = sum(fm_bell(note(n_), 1.6, idx=1.5) for n_ in ("D5", "F5", "A5"))[::-1] * 0.08
add(rev, TL["pinch"] - 1.6, p=0, send=0.6)

# D. the pinch: pop + sub drop + glass chord
pop_n = int(0.09 * SR)
pt = np.arange(pop_n) / SR
pop = np.sin(2 * np.pi * np.cumsum(900 * np.exp(-pt * 40) + 80) / SR) * np.exp(-pt * 35)
add(pop * 0.5, TL["pinch"], send=0.4)
add(kick(1.2, 90, 30, 0.6, 0.2) * 0.6, TL["pinch"])
for k, n_ in enumerate(("D5", "F5", "A5", "E6", "A6")):
    add(fm_bell(note(n_), 3.5, idx=1.8, decay=1.6) * 0.06, TL["pinch"] + k * 0.015, p=-0.6 + 0.3 * k, send=0.9)

# E. hypnotic arpeggio while the sphere floats (8.2 -> 12.2), chords follow its colours
chords = [(TL["pinch"], ["D4", "F4", "A4", "E5", "A5", "F5"]), (TL["pinch"] + 2.0, ["Bb3", "D4", "F4", "A4", "E5", "D5"])]
for c0, notes in chords:
    for k in range(16):
        tk = c0 + k * BEAT / 2
        if tk >= TL["dimStart"]:
            break
        f = note(notes[k % len(notes)])
        add(fm_bell(f, 0.9, idx=1.4 + 0.6 * (k % 3), ratio=2.0, decay=0.35) * 0.085, tk, p=np.sin(k * 1.3) * 0.6, send=0.5)
for c0, notes in ((TL["pinch"], ["D3", "A3", "E4"]), (TL["pinch"] + 2.0, ["Bb2", "F3", "D4"])):
    pd = pad([note(n_) for n_ in notes], 2.3, attack=0.6, release=0.7, cutoff=1400)
    add(pd * 0.22, c0, p=0, send=0.4)
# granular glitter as the first hand assembles out of the floor
for k in range(420):
    t0 = rng.uniform(TL["hands"][0][0], TL["hands"][0][1] + 0.6)
    dens = (t0 - TL["hands"][0][0]) / (TL["hands"][0][1] - TL["hands"][0][0])
    if rng.random() > 0.25 + 0.75 * min(dens, 1):
        continue
    f = rng.uniform(1800, 7000)
    n = int(0.05 * SR)
    tg = np.arange(n) / SR
    g = np.sin(2 * np.pi * f * tg) * np.exp(-tg * rng.uniform(60, 140))
    add(g * 0.025, t0, p=rng.uniform(-0.9, 0.9), send=0.4)
# low cello swell under the emerging hand
a, b = seg(TL["hands"][0][0], TL["hands"][0][1] + 0.1)
tt = T[a:b] - T[a]
cel = saw(np.cumsum(note("D2") * (1 + 0.004 * np.sin(2 * np.pi * 5 * tt))) / SR)
cel = lp(cel, 900) * smooth(tt, 0, tt[-1]) ** 2 * 0.2
dry[a:b] += pan(cel, -0.1)
verb[a:b] += pan(cel, 0.1) * 0.3

# F. the grip: impact, the light dies, heartbeat begins
G1 = GRIPS[0]
add(impact(3.5, 0.8) * 0.5, G1, send=0.35)
add(supersaw([note("D2"), note("A2"), note("D3"), note("F3")], 1.6, decay=0.6, cutoff=1800) * 0.45, G1, send=0.5)

# G/H. tension bed from the grip to the climax: dark choir + pulsing bass
prog = [(G1, ["G2", "D3", "Bb3"]), (G1 + 2, ["Eb3", "G3", "Bb3"]), (G1 + 4, ["C3", "G3", "Eb4"]), (G1 + 6, ["D3", "A3", "F4"]),
        (G1 + 8, ["Bb2", "F3", "D4"]), (G1 + 10, ["A2", "E3", "C#4"])]
for c0, notes in prog:
    add(choir([note(n_) for n_ in notes], 2.4, attack=0.5, release=0.6) * 0.18, c0, send=0.6)
a, b = seg(G1, TL["inhale"])
tt = T[a:b] - T[a]
S = smooth(T[a:b], G1, TL["inhale"])
wobr = 1.0 + 7.0 * S
bass = saw(np.cumsum(np.full(b - a, note("D1"))) / SR) + saw(np.cumsum(np.full(b - a, note("D1") * 1.007)) / SR)
cut = 140 + 900 * (0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(wobr) / SR)) * (0.3 + 0.7 * S)
bass = np.tanh(sweep_lp(bass[:, None], cut)[:, 0] * (1.5 + 2.5 * S)) * (0.07 + 0.15 * S)
dry[a:b] += pan(bass, 0)

# heartbeat: lub-dub every bar until the drums take over
t = G1
while t < 17.2:
    add(kick(0.5, 95, 40, 0.25, 0.2) * 0.55, t, bus=drums)
    add(kick(0.5, 85, 38, 0.22, 0.15) * 0.4, t + 0.22, bus=drums)
    t += 2 * BEAT
# toms under the rising background hands
for k, th in enumerate([h[0] for h in TL["hands"][1:4]] + TL["field"]):
    add(tom(150 - 8 * k, 80) * 0.35, th + 0.6, p=np.sin(k * 2.2) * 0.5, send=0.3, bus=drums)
# whooshes as hands rise
for th in [h[0] for h in TL["hands"][1:]] + TL["field"]:
    n = int(1.0 * SR)
    tw = np.arange(n) / SR
    w = sweep_lp(bp(rng.standard_normal(n), 200, 8000)[:, None], 300 + 5000 * tw)[:, 0] * smooth(tw, 0, 0.7) * (1 - smooth(tw, 0.7, 1.0))
    add(w * 0.06, th, p=rng.uniform(-0.8, 0.8), send=0.3)

# full drums from 17.0
t = TL["hero"][1]
k = 0
while t < TL["inhale"] - 0.01:
    S_ = (t - TL["hero"][1]) / (TL["inhale"] - TL["hero"][1])
    gk = 0.55 + 0.45 * S_
    add(kick() * 0.7 * gk, t, bus=drums)
    if k % 2 == 1:
        add(snare() * 0.5 * gk, t, p=0.05, send=0.25, bus=drums)
    sub_div = 4 if S_ > 0.35 else 2
    for h_ in range(sub_div):
        add(hat() * (0.12 if h_ % 2 else 0.18), t + h_ * BEAT / sub_div, p=0.35, bus=drums)
    t += BEAT
    k += 1
# 16th arpeggiator (epic, D minor)
arp = ["D4", "A4", "F4", "A4", "D5", "A4", "F4", "E4"]
t = TL["hero"][1] + 2 * BEAT
k = 0
while t < TL["inhale"] - 0.05:
    S_ = (t - TL["hero"][1]) / (TL["inhale"] - TL["hero"][1])
    f = note(arp[k % len(arp)])
    s_ = supersaw([f], 0.18, attack=0.002, decay=0.09, cutoff=1800 + 5000 * S_, voices=3)
    add(s_ * (0.1 + 0.08 * S_), t, p=np.sin(k * 0.9) * 0.5, send=0.25)
    t += BEAT / 4
    k += 1
# a stab + hit on every grip after the first
for k, g in enumerate(GRIPS[1:]):
    chord = [["D3", "F3", "A3"], ["Bb2", "D3", "F3"], ["C3", "Eb3", "G3"], ["A2", "C#3", "E3"]][k % 4]
    gs = 0.6 + 0.4 * k / max(len(GRIPS) - 2, 1)
    add(supersaw([note(n_) for n_ in chord] + [note(chord[0]) / 2], 0.9, decay=0.35, cutoff=2600) * 0.38 * gs, g, send=0.4)
    add(impact(1.2, 0.35) * 0.28 * gs, g)

# I. climax: snare roll accelerating + Shepard riser
t = TL["climax"]
while t < TL["inhale"]:
    r = (t - TL["climax"]) / (TL["inhale"] - TL["climax"])
    add(snare(0.2, decay=0.06) * (0.18 + 0.35 * r), t, p=np.sin(t * 31) * 0.3, send=0.15, bus=drums)
    t += BEAT / (4 + 12 * r)
a, b = seg(TL["climax"] - 2.0, TL["inhale"])
tt = T[a:b] - T[a]
L = tt[-1]
shep = np.zeros(b - a)
for o in range(7):
    pos = (o + tt / L * 2.0) % 7 / 7.0
    f = 40 * 2 ** (pos * 7)
    amp = np.exp(-((pos - 0.5) ** 2) / 0.04)
    shep += np.sin(2 * np.pi * np.cumsum(f) / SR) * amp
shep *= smooth(tt, 0, L) ** 1.5 * 0.08
dry[a:b] += pan(shep, 0)
verb[a:b] += pan(shep, 0) * 0.4
clu = pad([note(n_) for n_ in ("D3", "Eb3", "A3", "Bb3", "D4", "E4")], TL["inhale"] - TL["climax"] + 0.1, attack=1.6, release=0.1, cutoff=3500, detune=0.2)
add(clu * 0.22, TL["climax"], send=0.3)

# J. inhale: everything is sucked backwards, then silence
n = int((TE - TL["inhale"]) * SR)
tw = np.arange(n) / SR
suck = hp(rng.standard_normal(n), 2000) * (tw / tw[-1]) ** 3 * 0.25
suck *= 1 - smooth(tw, tw[-1] - 0.04, tw[-1])
add(suck, TL["inhale"], p=0, send=0.2)
rv = impact(2.0, 0.6)[::-1] * 0.25
add(rv[-n:], TL["inhale"])

# K. the explosion
add(impact(6.0, 1.6) * 0.95, TE, send=0.5)
add(kick(1.5, 160, 28, 0.8, 1.0) * 0.8, TE)
crash_n = int(4.5 * SR)
ct = np.arange(crash_n) / SR
crash = hp(rng.standard_normal(crash_n), 3500) * np.exp(-ct / 1.2) * 0.25
add(np.stack([crash, np.roll(crash, 240)], -1), TE, send=0.5)
boom_chord = supersaw([note(n_) for n_ in ("D2", "A2", "D3", "F#3", "A3", "D4")], 5.5, attack=0.005, decay=2.2, cutoff=4200, detune=0.25)
add(boom_chord * 0.5, TE, send=0.8)

# L. aftermath: choir in D major, falling particle pings, sub tail
add(choir([note(n_) for n_ in ("D3", "A3", "F#4", "E5")], DUR - TE + 0.5, attack=1.4, release=2.6) * 0.25, TE + 0.4, send=0.9)
for k in range(220):
    t0 = TE + 0.3 + rng.exponential(1.6)
    if t0 > DUR - 0.5:
        continue
    f = note(rng.choice(["D6", "E6", "F#6", "A6", "D7", "E7"]))
    add(fm_bell(f, 1.2, idx=0.8, ratio=2.0, decay=0.4) * 0.03 * np.exp(-(t0 - TE) / 3.0), t0, p=rng.uniform(-0.9, 0.9), send=0.7)

# ------------------------------------------------------------------ reverb + master
def hall_ir(rt60=3.8, length=5.5):
    n = int(length * SR)
    t = np.arange(n) / SR
    decay = np.exp(-6.9 * t / rt60)
    ir = rng.standard_normal((n, 2)) * decay[:, None]
    ir = sweep_lp(ir, 9000 * np.exp(-t * 0.9) + 600)
    ir[: int(0.012 * SR)] = 0
    for d, g in ((0.017, 0.5), (0.029, 0.4), (0.041, 0.3)):
        ir[int(d * SR)] += g
    return ir / np.sqrt((ir ** 2).sum(0, keepdims=True))


ir = hall_ir()
wet = np.stack([fftconvolve(verb[:, c] + dry[:, c] * 0.12, ir[:, c])[:N] for c in range(2)], -1)
mix_ = dry + drums * 0.9 + wet * 0.55 + np.stack([fftconvolve(drums[:, c], ir[:, c] * 0.25)[:N] for c in range(2)], -1) * 0.2
# duck everything for the breath before the blast
duck = 1 - 0.85 * smooth(T, TL["inhale"] + 0.3, TE - 0.02) * (T < TE)
mix_ *= duck[:, None]
mix_ = hp(mix_, 28)
mix_ *= (1 - smooth(T, DUR - 1.4, DUR))[:, None]
peak = np.abs(mix_).max()
mix_ = np.tanh(mix_ / peak * 1.25) / np.tanh(1.25) * 0.891
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "out", "music.wav")
os.makedirs(os.path.dirname(out), exist_ok=True)
wavfile.write(out, SR, (mix_ * 32767).astype(np.int16))
print("wrote", out, f"{DUR}s", "peak", np.abs(mix_).max().round(3))
