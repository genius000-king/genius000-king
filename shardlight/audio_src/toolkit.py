"""Shardlight synthesis toolkit.

Everything in the game's audio library is produced from the primitives in this
file: oscillators, envelopes, filters, noise colours, FM, impulse/grain clouds,
waveshapers, synthetic-IR convolution reverb, stereo tools, loudness metering,
a look-ahead limiter and several *seamless loop* strategies.

Conventions
  * SR = 48 kHz.  Mono signals are 1-D float arrays, stereo are (n, 2).
  * Every random choice goes through a numpy Generator created by rng_for(),
    seeded from a stable CRC32 of the event name, so builds are deterministic.
  * Loops are built *periodic by construction* (FFT noise, integer-cycle LFOs,
    circular filtering via circ()) and/or wrapped with fold() / loop_xfade().
"""
import io
import json
import os
import zlib

import numpy as np
import soundfile as sf
from scipy import signal as sg
from scipy.ndimage import minimum_filter1d, uniform_filter1d

SR = 48000
TAU = 2 * np.pi


# ----------------------------------------------------------------- basics
def rng_for(name, i=0):
    """Deterministic generator for (name, variant-index)."""
    return np.random.default_rng(zlib.crc32(f"{name}:{i}".encode()) & 0xFFFFFFFF)


def ns(dur):
    return int(round(dur * SR))


def tt(dur):
    return np.arange(ns(dur)) / SR


def db2lin(d):
    return 10.0 ** (np.asarray(d) / 20.0)


def lin2db(x):
    return 20.0 * np.log10(np.maximum(x, 1e-12))


def mtof(m):
    return 440.0 * 2.0 ** ((np.asarray(m, dtype=float) - 69.0) / 12.0)


def snap_freq(f, dur):
    """Snap f to an integer number of cycles over dur (periodic loops)."""
    return max(1.0, round(f * dur)) / dur


def stereo(x):
    x = np.asarray(x)
    return np.stack([x, x], axis=1) if x.ndim == 1 else x


def mono(x):
    x = np.asarray(x)
    return x.mean(axis=1) if x.ndim == 2 else x


def match(a, n):
    """Pad / trim along axis 0 to length n."""
    if len(a) >= n:
        return a[:n]
    pad = [(0, n - len(a))] + [(0, 0)] * (a.ndim - 1)
    return np.pad(a, pad)


def place(buf, snd, start, gain=1.0, wrap=False):
    """Add snd into buf at sample index start (optionally wrapping around)."""
    n = len(buf)
    m = len(snd)
    if m == 0:
        return buf
    if snd.ndim != buf.ndim:
        snd = stereo(snd) if buf.ndim == 2 else mono(snd)
    start = int(start)
    if wrap:
        start %= n
        k = min(m, n - start)
        buf[start:start + k] += gain * snd[:k]
        rest = m - k
        while rest > 0:                       # tail longer than the loop
            kk = min(rest, n)
            buf[:kk] += gain * snd[m - rest:m - rest + kk]
            rest -= kk
    else:
        if start >= n:
            return buf
        if start < 0:
            snd = snd[-start:]
            start = 0
        k = min(len(snd), n - start)
        buf[start:start + k] += gain * snd[:k]
    return buf


def add(y, snd, g=1.0, at=0.0, wrap=False):
    """y += g * snd placed at `at` seconds (length-safe). Returns y."""
    return place(y, snd, ns(at), g, wrap)


# ------------------------------------------------------------ oscillators
def _phase(freq, n):
    if np.isscalar(freq):
        return np.arange(n) * (freq / SR)
    f = np.asarray(freq, dtype=float)
    f = match(f, n) if len(f) != n else f
    return np.cumsum(f) / SR


def sine(freq, n, ph0=0.0):
    return np.sin(TAU * (_phase(freq, n) + ph0))


def saw(freq, n, ph0=0.0):
    """Band-limited (polyBLEP) saw."""
    p = (_phase(freq, n) + ph0) % 1.0
    dt = np.broadcast_to(np.asarray(freq, dtype=float) / SR, (n,)) if np.isscalar(freq) \
        else match(np.asarray(freq, dtype=float), n) / SR
    y = 2 * p - 1
    m1 = p < dt
    t = np.where(m1, p / np.maximum(dt, 1e-9), 0)
    y -= np.where(m1, t + t - t * t - 1, 0)
    m2 = p > 1 - dt
    t = np.where(m2, (p - 1) / np.maximum(dt, 1e-9), 0)
    y -= np.where(m2, t * t + t + t + 1, 0)
    return y


def square(freq, n, pw=0.5, ph0=0.0):
    a = saw(freq, n, ph0)
    b = saw(freq, n, ph0 + (1 - pw))
    return a - b


def tri(freq, n, ph0=0.0):
    p = (_phase(freq, n) + ph0) % 1.0
    return 4 * np.abs(p - 0.5) - 1


def fm(fc, ratio, index, n, fb=0.0):
    """2-operator FM. index may be an array (modulation index envelope)."""
    fc_a = np.broadcast_to(np.asarray(fc, dtype=float), (n,))
    idx = np.broadcast_to(np.asarray(index, dtype=float), (n,))
    mod = np.sin(TAU * _phase(fc_a * ratio, n))
    return np.sin(TAU * _phase(fc_a, n) + idx * mod)


def harmonic_stack(f0, n, amps, ph=None, rng=None, detune_cents=0.0):
    """Sum of harmonics of f0 (scalar or array) with per-harmonic amps."""
    y = np.zeros(n)
    for k, a in enumerate(amps, start=1):
        fk = (f0 * k) if np.isscalar(f0) else np.asarray(f0) * k
        if np.isscalar(fk) and fk >= SR / 2:
            break
        d = 1.0
        if detune_cents and rng is not None:
            d = 2 ** (rng.uniform(-detune_cents, detune_cents) / 1200)
        p0 = 0.0 if ph is None else ph[k - 1]
        y += a * sine(fk * d, n, p0)
    return y


def modal(freqs, amps, taus, n, ph=None, rng=None):
    """Modal synthesis: sum of exponentially damped sinusoids (bells, wood...)."""
    t = np.arange(n) / SR
    y = np.zeros(n)
    for i, (f, a, tau) in enumerate(zip(freqs, amps, taus)):
        if f >= SR / 2 * 0.95:
            continue
        p = (rng.uniform(0, TAU) if rng is not None else 0.0) if ph is None else ph[i]
        y += a * np.exp(-t / tau) * np.sin(TAU * f * t + p)
    return y


def shepard(n, dur, base, octaves=7, waveform="sine", rng=None, width=1.0):
    """Shepard-Risset rising glissando, exactly periodic over `dur` seconds."""
    t = np.arange(n) / SR
    y = np.zeros(n)
    phi0 = 0.0
    for k in range(octaves):
        fk = base * 2.0 ** k
        ph = TAU * fk * dur / np.log(2) * (2.0 ** (t / dur) - 1.0) + phi0
        x = (k + t / dur) / octaves
        w = np.sin(np.pi * x) ** (2 * width)
        if waveform == "saw":
            h = sum(np.sin(j * ph) / j for j in (1, 2, 3, 4))
        else:
            h = np.sin(ph)
        y += w * h
        phi0 += TAU * fk * dur / np.log(2)
    return y


# -------------------------------------------------------------- envelopes
def env_pts(pts, n, power=1.0):
    """Piecewise-linear envelope through (time_s, value) points."""
    pts = sorted(pts)
    ts = np.array([p[0] for p in pts]) * SR
    vs = np.array([p[1] for p in pts], dtype=float)
    e = np.interp(np.arange(n), ts, vs)
    return np.sign(e) * np.abs(e) ** power if power != 1.0 else e


def adsr(n, a, d, s, r, hold=None):
    """ADSR with exponential-ish decay. hold = sustain duration (s)."""
    A, D, R = ns(a), ns(d), ns(r)
    H = max(0, n - A - D - R) if hold is None else ns(hold)
    e = np.concatenate([
        np.linspace(0, 1, max(A, 1), endpoint=False) ** 1.5,
        s + (1 - s) * np.exp(-np.arange(D) / max(D / 4, 1)),
        np.full(H, s),
        s * np.exp(-np.arange(R) / max(R / 5, 1))])
    return match(e, n)


def decay(n, tau, attack=0.0):
    t = np.arange(n) / SR
    e = np.exp(-t / tau)
    if attack > 0:
        e *= 1 - np.exp(-t / (attack / 3))
    return e


def hann_env(n):
    return np.hanning(n) if n > 1 else np.ones(n)


def fade(x, fin=0.002, fout=0.01, shape="cos"):
    x = np.array(x, dtype=float, copy=True)
    n = len(x)
    a, b = min(ns(fin), n // 2), min(ns(fout), n // 2)
    if a > 0:
        c = np.linspace(0, 1, a)
        c = np.sin(c * np.pi / 2) ** 2 if shape == "cos" else c
        x[:a] *= c[:, None] if x.ndim == 2 else c
    if b > 0:
        c = np.linspace(1, 0, b)
        c = np.sin(c * np.pi / 2) ** 2 if shape == "cos" else c
        x[-b:] *= c[:, None] if x.ndim == 2 else c
    return x


def lfo(n, cycles, ph=0.0):
    """Sine LFO with an integer number of cycles over n samples (loop-safe)."""
    return np.sin(TAU * (cycles * np.arange(n) / n + ph))


def periodic_curve(n, rng, nbins=8, std=1.0, lo_bin=1):
    """Smooth random curve, exactly periodic, bins lo_bin..nbins cycles per loop."""
    spec = np.zeros(n // 2 + 1, dtype=complex)
    k = np.arange(lo_bin, nbins + 1)
    spec[k] = rng.standard_normal(len(k)) + 1j * rng.standard_normal(len(k))
    spec[k] /= np.sqrt(k)[:]
    y = np.fft.irfft(spec, n)
    return y / (np.std(y) + 1e-12) * std


# ------------------------------------------------------------------ noise
def white(n, rng):
    return rng.standard_normal(n)


def colored(n, rng, alpha=1.0, periodic=True, fmin=15.0):
    """Noise with power ~ 1/f^alpha (0 white, 1 pink, 2 brown, -1 blue), unit RMS.
    Built in the frequency domain, so it is exactly periodic over n samples."""
    spec = rng.standard_normal(n // 2 + 1) + 1j * rng.standard_normal(n // 2 + 1)
    f = np.arange(n // 2 + 1) + 1e-9
    f[0] = 1.0
    spec *= f ** (-alpha / 2.0)
    spec[0] = 0
    spec[np.arange(n // 2 + 1) * SR / n < fmin] = 0       # no sub-sonic wander
    y = np.fft.irfft(spec, n)
    return y / (np.std(y) + 1e-12)


def pink(n, rng):
    return colored(n, rng, 1.0)


def brown(n, rng):
    return colored(n, rng, 2.0)


# ---------------------------------------------------------------- filters
def rbj(kind, f, q=0.707, gain_db=0.0):
    f = float(np.clip(f, 10.0, SR * 0.49))
    w0 = TAU * f / SR
    al = np.sin(w0) / (2 * q)
    c = np.cos(w0)
    A = 10 ** (gain_db / 40)
    if kind == "lp":
        b = [(1 - c) / 2, 1 - c, (1 - c) / 2]; a = [1 + al, -2 * c, 1 - al]
    elif kind == "hp":
        b = [(1 + c) / 2, -(1 + c), (1 + c) / 2]; a = [1 + al, -2 * c, 1 - al]
    elif kind == "bp":
        b = [al, 0, -al]; a = [1 + al, -2 * c, 1 - al]
    elif kind == "notch":
        b = [1, -2 * c, 1]; a = [1 + al, -2 * c, 1 - al]
    elif kind == "peak":
        b = [1 + al * A, -2 * c, 1 - al * A]; a = [1 + al / A, -2 * c, 1 - al / A]
    elif kind == "ap":
        b = [1 - al, -2 * c, 1 + al]; a = [1 + al, -2 * c, 1 - al]
    elif kind == "lshelf":
        s = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) - (A - 1) * c + s), 2 * A * ((A - 1) - (A + 1) * c),
             A * ((A + 1) - (A - 1) * c - s)]
        a = [(A + 1) + (A - 1) * c + s, -2 * ((A - 1) + (A + 1) * c), (A + 1) + (A - 1) * c - s]
    elif kind == "hshelf":
        s = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) + (A - 1) * c + s), -2 * A * ((A - 1) + (A + 1) * c),
             A * ((A + 1) + (A - 1) * c - s)]
        a = [(A + 1) - (A - 1) * c + s, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - s]
    else:
        raise ValueError(kind)
    b = np.array(b) / a[0]; a = np.array(a) / a[0]
    return np.array([[b[0], b[1], b[2], 1.0, a[1], a[2]]])


def biq(x, kind, f, q=0.707, gain_db=0.0):
    return sg.sosfilt(rbj(kind, f, q, gain_db), x, axis=0)


def lp(x, fc, order=2):
    return sg.sosfilt(sg.butter(order, min(fc, SR * 0.49), "lp", fs=SR, output="sos"), x, axis=0)


def hp(x, fc, order=2):
    return sg.sosfilt(sg.butter(order, max(fc, 5.0), "hp", fs=SR, output="sos"), x, axis=0)


def bp(x, lo, hi, order=2):
    return sg.sosfilt(sg.butter(order, [max(lo, 5.0), min(hi, SR * 0.49)], "bp", fs=SR,
                                output="sos"), x, axis=0)


def sweep(x, fc, q=0.8, kind="lp", block=96):
    """Time-varying resonant biquad. fc: scalar or per-sample array (Hz)."""
    n = len(x)
    fc = np.broadcast_to(np.asarray(fc, dtype=float), (n,))
    y = np.empty(n)
    zi = np.zeros((1, 2))
    for s in range(0, n, block):
        e = min(n, s + block)
        sos = rbj(kind, fc[min(n - 1, (s + e) // 2)], q)
        y[s:e], zi = sg.sosfilt(sos, x[s:e], zi=zi)
    return y


def resonator(x, f, q=30.0):
    """Constant-peak-gain bandpass; ring-mod style resonant 'pings' from impulses."""
    return biq(x, "bp", f, q)


def formants(x, spec, order_gain=1.0):
    """Parallel formant bank: spec = [(freq, q, amp), ...]."""
    y = np.zeros_like(x, dtype=float)
    for f, q, a in spec:
        y += a * biq(x, "bp", f, q)
    return y * order_gain


def allpass_chain(x, rng, n=4, fmin=200, fmax=4000):
    for _ in range(n):
        x = biq(x, "ap", rng.uniform(fmin, fmax), rng.uniform(0.5, 2.0))
    return x


def comb(x, delay_s, fb=0.6):
    d = max(1, ns(delay_s))
    b = np.zeros(d + 1); b[0] = 1.0
    a = np.zeros(d + 1); a[0] = 1.0; a[d] = -fb
    return sg.lfilter(b, a, x)


def circ(fn, x, pad_s=2.0):
    """Apply a (stateful) processing fn circularly so a loop stays seamless."""
    n = len(x)
    pad = min(n, ns(pad_s))
    xp = np.concatenate([x[-pad:], x, x[:pad]], axis=0)
    y = fn(xp)
    return y[pad:pad + n]


def circ_sweep(x, fc, q=0.8, kind="lp", pad_s=2.0, block=96):
    """sweep() applied circularly (loop-safe) with a periodic cutoff curve."""
    n = len(x)
    pad = min(n, ns(pad_s))
    fc = np.broadcast_to(np.asarray(fc, dtype=float), (n,))
    xp = np.concatenate([x[-pad:], x, x[:pad]])
    fp = np.concatenate([fc[-pad:], fc, fc[:pad]])
    return sweep(xp, fp, q, kind, block)[pad:pad + n]


# -------------------------------------------------------- waveshaping etc
def softclip(x, drive=1.0):
    return np.tanh(x * drive) / np.tanh(drive) if drive > 0 else x


def fold_wave(x, amt=2.0):
    return np.sin(x * amt * np.pi / 2)


def asym_sat(x, drive=2.0, bias=0.2):
    y = np.tanh(drive * (x + bias)) - np.tanh(drive * bias)
    return y / (np.max(np.abs(y)) + 1e-9)


def bitcrush(x, bits=6, down=1):
    q = 2.0 ** bits
    y = np.round(x * q) / q
    if down > 1:
        y = np.repeat(y[::down], down)[:len(x)]
    return y


def ringmod(x, f):
    return x * sine(f, len(x))


def pitch_shift_resample(x, ratio):
    """Cheap resample pitch-shift (changes duration)."""
    n = int(len(x) / ratio)
    idx = np.arange(n) * ratio
    i0 = np.floor(idx).astype(int)
    fr = idx - i0
    i0 = np.clip(i0, 0, len(x) - 2)
    if x.ndim == 2:
        return x[i0] * (1 - fr)[:, None] + x[i0 + 1] * fr[:, None]
    return x[i0] * (1 - fr) + x[i0 + 1] * fr


def reverse(x):
    return x[::-1].copy()


def delay_line(x, taps):
    """taps = [(delay_s, gain), ...]; returns longer array."""
    mx = max(ns(d) for d, _ in taps)
    y = np.zeros((len(x) + mx,) + x.shape[1:])
    for d, g in taps:
        y[ns(d):ns(d) + len(x)] += g * x
    return y


# ------------------------------------------------- impulse / grain clouds
def crackle(n, rate, rng, f_lo=1200, f_hi=9000, q=2.0, heavy=1.6, classes=3, n_pre=None):
    """Poisson impulses (rate in Hz: scalar or per-sample array) shaped by random
    resonant bandpass classes -> sparks, fire, static, electric arcs."""
    rate = np.broadcast_to(np.asarray(rate, dtype=float), (n,))
    mask = rng.random(n) < rate / SR
    amp = rng.exponential(1.0, n) ** heavy * rng.choice([-1.0, 1.0], n) * mask
    out = np.zeros(n)
    cls = rng.integers(0, classes, n)
    for c in range(classes):
        fc = np.exp(rng.uniform(np.log(f_lo), np.log(f_hi)))
        out += biq(np.where(cls == c, amp, 0.0), "bp", fc, q * rng.uniform(0.6, 1.6))
    return out


def grains(n, onsets, grain_fn, rng, gain_fn=None, wrap=False, ch=1):
    """Overlap-add grains: grain_fn(rng, i) -> array."""
    buf = np.zeros(n) if ch == 1 else np.zeros((n, 2))
    for i, o in enumerate(onsets):
        g = grain_fn(rng, i)
        gn = 1.0 if gain_fn is None else gain_fn(i)
        place(buf, g, o, gn, wrap=wrap)
    return buf


def poisson_times(dur, rate, rng, jitter_floor=0.0):
    """Event times (s) of a Poisson process; rate may be a callable of t."""
    ts = []
    t = 0.0
    r0 = rate if np.isscalar(rate) else None
    while t < dur:
        r = r0 if r0 is not None else rate(t)
        t += rng.exponential(1.0 / max(r, 1e-6)) + jitter_floor
        if t < dur:
            ts.append(t)
    return np.array(ts)


def paulstretch(x, stretch, win_s, n_out, rng, circular=False):
    """Time-stretch via random-phase FFT overlap-add (Paul's Extreme Stretch).
    n_out output samples; if circular, output wraps so the result loops."""
    w = int(win_s * SR) // 2 * 2
    win = np.hanning(w)
    hop_out = w // 2
    hop_in = hop_out / stretch
    out = np.zeros(n_out)
    nb = int(np.ceil(n_out / hop_out)) + 1
    xl = len(x)
    for b in range(nb):
        s = int(b * hop_in) % xl if circular else min(int(b * hop_in), max(0, xl - w))
        idx = (np.arange(w) + s) % xl
        seg = x[idx] * win
        sp = np.abs(np.fft.rfft(seg)) * np.exp(1j * rng.uniform(0, TAU, w // 2 + 1))
        seg2 = np.fft.irfft(sp, w) * win
        o = b * hop_out
        if circular:
            idx2 = (np.arange(w) + o) % n_out
            np.add.at(out, idx2, seg2)
        else:
            k = min(w, n_out - o)
            if k > 0:
                out[o:o + k] += seg2[:k]
    return out


# --------------------------------------------------------------- stereo
def pan(x, p):
    """Constant-power pan, p in [-1, 1]."""
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1)


def widen(st, width=1.5):
    m = (st[:, 0] + st[:, 1]) * 0.5
    s = (st[:, 0] - st[:, 1]) * 0.5 * width
    return np.stack([m + s, m - s], axis=1)


def haas(x, ms=12.0, side=1):
    d = ns(ms / 1000)
    a = np.concatenate([x, np.zeros(d)])
    b = np.concatenate([np.zeros(d), x])
    return np.stack([a, b] if side > 0 else [b, a], axis=1)


def decorrelate(x, rng, amount=1.0):
    """Mono -> wide stereo using different all-pass chains per channel."""
    l = allpass_chain(x, rng, 4)
    r = allpass_chain(x, rng, 4)
    return np.stack([x * (1 - amount * 0.5) + l * amount * 0.5,
                     x * (1 - amount * 0.5) + r * amount * 0.5], axis=1)


def stereo_noise_pair(n, rng, alpha=1.0):
    return np.stack([colored(n, rng, alpha), colored(n, rng, alpha)], axis=1)


# ----------------------------------------------------------------- reverb
_IR = {}


def make_ir(rt60=1.5, damp=0.5, predelay=0.012, seed=1, stereo_out=True, bright=1.0,
            early=8, lowcut=120.0):
    """Synthetic impulse response: three-band exponentially decaying noise
    (highs decay faster by `damp`) + sparse early reflections."""
    key = (rt60, damp, predelay, seed, stereo_out, bright, early, lowcut)
    if key in _IR:
        return _IR[key]
    r = np.random.default_rng(seed)
    n = ns(rt60 * 1.15 + predelay + 0.05)
    t = np.arange(n) / SR
    chans = []
    for c in range(2 if stereo_out else 1):
        w = r.standard_normal(n)
        lo = lp(w, 500)
        mid = bp(w, 500, 3200)
        hi = hp(w, 3200) * bright
        tau = rt60 / 6.91
        tt_ = np.maximum(t - predelay, 0)
        ir = (lo * np.exp(-tt_ / tau) + mid * np.exp(-tt_ / (tau * (0.55 + 0.45 * damp)))
              + hi * np.exp(-tt_ / (tau * damp)))
        ir *= (t >= predelay) * (1 - np.exp(-(t - predelay).clip(0) / 0.006))
        for _ in range(early):
            d = predelay + r.uniform(0.004, 0.09)
            k = ns(d)
            if k < n:
                ir[k] += r.choice([-1, 1]) * r.uniform(0.6, 1.8) * np.std(ir[ns(predelay):ns(predelay) + 3000] + 1e-9) * 4
        ir = hp(ir, lowcut, 1)
        chans.append(ir)
    ir = np.stack(chans, axis=1)
    ir /= np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True)) + 1e-12
    _IR[key] = ir
    return ir


def reverb(x, ir, wet=0.3, dry=1.0, tail_s=None):
    """Convolution reverb. x mono or stereo; output stereo if ir is stereo, else mono.
    Output includes the tail (len(x)+len(ir)) unless tail_s is given."""
    x2 = x if x.ndim == 2 else x[:, None]
    n_out = len(x) + (len(ir) if tail_s is None else ns(tail_s))
    outs = [match(sg.fftconvolve(x2[:, c % x2.shape[1]], ir[:, c]), n_out)
            for c in range(ir.shape[1])]
    w = np.stack(outs, axis=1)
    d = match(stereo(x) if ir.shape[1] == 2 else x2[:, :1], n_out)
    res = wet * w + dry * d
    return res if ir.shape[1] == 2 else res[:, 0]


def reverb_loop(x, ir, wet=0.3, dry=1.0):
    """Circular reverb of a looping buffer: tail wraps onto the head."""
    y = reverb(x, ir, wet, dry)
    return fold(y, len(x))


# ---------------------------------------------------------------- loops
def fold(x, L):
    """Fold anything beyond sample L back onto the start (circular tail wrap)."""
    out = np.array(x[:L], copy=True)
    if len(out) < L:
        out = match(out, L)
    rest = x[L:]
    while len(rest):
        k = min(len(rest), L)
        out[:k] += rest[:k]
        rest = rest[k:]
    return out


def loop_xfade(x, L, power=True):
    """x has length >= L + X. Crossfade the extra tail X back onto the head so
    that x[L-1] -> x[0] is a natural continuation."""
    X = len(x) - L
    assert X > 0 and X <= L
    out = np.array(x[:L], copy=True)
    u = np.linspace(0, 1, X, endpoint=False)
    if power:
        w_in, w_out = np.sin(u * np.pi / 2), np.cos(u * np.pi / 2)
    else:
        w_in, w_out = u, 1 - u
    if x.ndim == 2:
        w_in, w_out = w_in[:, None], w_out[:, None]
    out[:X] = x[:X] * w_in + x[L:L + X] * w_out
    return out


# ------------------------------------------------------------- loudness
def _kw_sos():
    f0, G, Q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
    K = np.tan(np.pi * f0 / SR); Vh = 10 ** (G / 20); Vb = Vh ** 0.4996667741545416
    a0 = 1 + K / Q + K * K
    s1 = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0,
          1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
    f0, Q = 38.13547087602444, 0.5003270373238773
    K = np.tan(np.pi * f0 / SR); a0 = 1 + K / Q + K * K
    s2 = [1, -2, 1, 1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
    return np.array([s1, s2])


_KW = None


def lufs(x):
    """ITU-R BS.1770 integrated loudness (K-weighted, gated) of mono/stereo x."""
    global _KW
    if _KW is None:
        _KW = _kw_sos()
    x2 = x if x.ndim == 2 else x[:, None]
    z = np.stack([sg.sosfilt(_KW, x2[:, c]) ** 2 for c in range(x2.shape[1])], axis=1)
    cs = np.concatenate([np.zeros((1, z.shape[1])), np.cumsum(z, axis=0)])
    blk, hop = ns(0.4), ns(0.1)
    if len(x2) < blk:
        ms = z.mean(axis=0, keepdims=True)
    else:
        starts = np.arange(0, len(x2) - blk + 1, hop)
        ms = (cs[starts + blk] - cs[starts]) / blk
    lk = -0.691 + 10 * np.log10(np.maximum(ms.sum(axis=1), 1e-14))
    g = ms[lk > -70]
    if len(g) == 0:
        return -70.0
    rel = -0.691 + 10 * np.log10(g.sum(axis=1).mean()) - 10
    g2 = ms[lk > max(rel, -70)]
    if len(g2) == 0:
        return -70.0
    return -0.691 + 10 * np.log10(g2.sum(axis=1).mean())


def peak_db(x):
    return float(lin2db(np.max(np.abs(x)))) if len(x) else -120.0


def rms_db(x):
    return float(lin2db(np.sqrt(np.mean(np.square(x))))) if len(x) else -120.0


def limit(x, ceil_db=-1.5, look_ms=3.0):
    """Look-ahead limiter; output never exceeds ceil_db (before encoding)."""
    c = db2lin(ceil_db)
    a = np.max(np.abs(x), axis=1) if x.ndim == 2 else np.abs(x)
    g = np.minimum(1.0, c / np.maximum(a, 1e-9))
    w = max(1, ns(look_ms / 1000))
    gm = minimum_filter1d(g, 2 * w + 1, mode="nearest")
    gs = uniform_filter1d(gm, 2 * w + 1, mode="nearest")
    return x * (gs[:, None] if x.ndim == 2 else gs)


def finalize(x, peak=-3.0, lufs_target=None, fin=0.002, fout=0.01, ceiling=-1.5,
             look_ms=3.0, dc=True, shape_fade=True):
    """Remove DC, fade edges, set level (peak or LUFS), limit to ceiling."""
    x = np.array(x, dtype=float, copy=True)
    if dc:
        x = x - x.mean(axis=0, keepdims=True) if len(x) > 4800 else x - x.mean()
        if len(x) > 4800:      # 18 Hz sub-sonic cut (circular for loops, so seams stay seamless)
            x = hp(x, 18, 2) if shape_fade else circ(lambda z: hp(z, 18, 2), x)
    if shape_fade:
        x = fade(x, fin, fout)
    if lufs_target is not None:
        l = lufs(x)
        x = x * db2lin(lufs_target - l)
        x = limit(x, min(ceiling, peak) if peak is not None else ceiling, look_ms)
    else:
        pk = np.max(np.abs(x)) + 1e-12
        x = x * (db2lin(peak) / pk)
    return x


def trim_tail(x, thresh_db=-60.0, keep_s=0.02, fout=0.05):
    a = np.max(np.abs(x), axis=1) if x.ndim == 2 else np.abs(x)
    idx = np.where(a > db2lin(thresh_db) * np.max(a))[0]
    if len(idx) == 0:
        return x
    end = min(len(x), idx[-1] + ns(keep_s))
    return fade(x[:end], 0.0, fout)


# -------------------------------------------------------------- output
_REV = bytes(int(f"{i:08b}"[::-1], 2) for i in range(256))


def _ogg_crc(page):
    """Ogg page CRC (poly 0x04C11DB7, non-reflected, init 0) via zlib on bit-reversed bytes."""
    raw = zlib.crc32(page.translate(_REV), 0xFFFFFFFF) ^ 0xFFFFFFFF
    return int(f"{raw:032b}"[::-1], 2)


def fix_ogg_serial(data, serial=0x53484452):
    """libsndfile picks a random Ogg stream serial; pin it (and re-CRC every page) so that
    rebuilding the library gives byte-identical files."""
    b = bytearray(data)
    i = 0
    while i + 27 <= len(b) and b[i:i + 4] == b"OggS":
        nseg = b[i + 26]
        size = 27 + nseg + sum(b[i + 27:i + 27 + nseg])
        b[i + 14:i + 18] = serial.to_bytes(4, "little")
        b[i + 22:i + 26] = b"\0\0\0\0"
        b[i + 22:i + 26] = _ogg_crc(bytes(b[i:i + size])).to_bytes(4, "little")
        i += size
    return bytes(b)


def encode_ogg(x, path, q=0.5, ceiling_db=-1.2):
    """Write OGG/Vorbis; re-encodes with lower gain if the decoded peak overshoots."""
    data = np.clip(np.asarray(x, dtype=np.float32), -1, 1)
    for _ in range(5):
        buf = io.BytesIO()
        ch = 1 if data.ndim == 1 else data.shape[1]
        # chunked writes: one huge sf.write() call segfaults libsndfile's Vorbis encoder
        with sf.SoundFile(buf, "w", samplerate=SR, channels=ch, format="OGG", subtype="VORBIS",
                          compression_level=q) as fh:
            for i in range(0, len(data), SR):
                fh.write(np.ascontiguousarray(data[i:i + SR]))
        dec, _sr = sf.read(io.BytesIO(buf.getvalue()), dtype="float32")
        pk = float(np.max(np.abs(dec)))
        if pk <= db2lin(ceiling_db):
            break
        data = (data * (db2lin(ceiling_db - 0.2) / pk)).astype(np.float32)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out = fix_ogg_serial(buf.getvalue())
    with open(path, "wb") as f:
        f.write(out)
    return len(out)


class Registry:
    """Collects events, writes their OGG files and the manifest."""

    def __init__(self, root):
        self.root = root
        self.events = {}
        self.bytes = 0

    def add(self, event, category, variants, loop=False, volume_db=0.0, pitch_jitter=0.0,
            bus="SFX", peak=-3.0, lufs_target=None, q=0.5, fin=0.002, fout=0.01,
            ceiling=-1.5, look_ms=3.0, level_jitter_db=0.0, is_mono=None, fade_edges=True):
        if isinstance(variants, np.ndarray):
            variants = [variants]
        files = []
        r = rng_for("level:" + event)
        for i, v in enumerate(variants):
            v = np.asarray(v, dtype=float)
            if is_mono is True:
                v = mono(v)
            elif is_mono is False:
                v = stereo(v)
            lj = r.uniform(-level_jitter_db, level_jitter_db) if level_jitter_db else 0.0
            tgt_l = None if lufs_target is None else lufs_target + lj
            v = finalize(v, peak=peak + lj, lufs_target=tgt_l, fin=fin if fade_edges else 0,
                         fout=fout if fade_edges else 0, ceiling=ceiling, look_ms=look_ms,
                         shape_fade=fade_edges)
            name = f"{event}.ogg" if len(variants) == 1 else f"{event}_{i + 1:02d}.ogg"
            rel = f"{category}/{name}"
            self.bytes += encode_ogg(v, os.path.join(self.root, rel), q=q)
            files.append(rel)
        self.events[event] = {"files": files, "category": category, "loop": bool(loop),
                              "volume_db": float(volume_db), "pitch_jitter": float(pitch_jitter),
                              "bus": bus}

    def write_manifest(self, extra=None):
        data = dict(sorted(self.events.items()))
        with open(os.path.join(self.root, "manifest.json"), "w") as f:
            json.dump(data, f, indent=1)
