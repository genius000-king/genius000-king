"""Reusable sound-design building blocks built on toolkit.py."""
import numpy as np
from toolkit import *


def thump(f0, f1, dur, rng=None, tp=0.04, ta=0.08, atk=0.002):
    """Pitch-dropping sine body (footfall, kick, sub punch)."""
    n = ns(dur)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / tp)
    return sine(f, n) * np.exp(-t / ta) * (1 - np.exp(-t / (atk / 3)))


def noise_burst(dur, lo, hi, rng, tau=0.03, atk=0.002, order=2, alpha=0.0):
    n = ns(dur)
    x = colored(n, rng, alpha) if alpha else rng.standard_normal(n)
    x = bp(x, lo, hi, order)
    return x * decay(n, tau, atk)


def click(rng, f=3000, tau=0.004, dur=0.03, q=3.0):
    n = ns(dur)
    x = np.zeros(n); x[0] = 1.0
    x += rng.standard_normal(n) * decay(n, tau * 0.6) * 0.5
    return biq(x, "bp", f, q) * decay(n, tau) * 3


def whoosh(dur, pts_f, pts_a, rng, q=1.2, alpha=0.0, kind="bp"):
    """Noise through a swept resonant filter; pts_* are (time, value) breakpoints."""
    n = ns(dur)
    x = colored(n, rng, alpha) if alpha else rng.standard_normal(n)
    fc = env_pts(pts_f, n)
    y = sweep(x, fc, q, kind)
    return y * env_pts(pts_a, n)


def bell(f, dur, rng, tau=0.8, amps=(1, .6, .4, .22, .12), ratios=(1, 2.0, 2.76, 5.4, 8.93),
         tau_scale=(1, .7, .5, .3, .2), atk=0.0015):
    n = ns(dur)
    fr = [f * r for r in ratios]
    y = modal(fr, amps, [tau * s for s in tau_scale], n, rng=rng)
    return y * (1 - np.exp(-np.arange(n) / SR / (atk / 3)))


def glass(f, dur, rng, tau=0.4, brightness=1.0):
    ratios = (1, 2.32, 4.25, 6.63, 9.38, 12.6)
    amps = (1, .8 * brightness, .6 * brightness, .4 * brightness, .25 * brightness, .12 * brightness)
    tsc = (1, .8, .55, .4, .25, .15)
    return bell(f, dur, rng, tau, amps, ratios, tsc, atk=0.0008)


def sparkle(dur, rng, density=40, f_lo=2500, f_hi=9000, tau=0.15, decay_tau=None, scale=(1, 2, 3)):
    """Cloud of tiny glassy sine grains - shimmer / sparkle."""
    n = ns(dur)
    out = np.zeros(n)
    k = int(density * dur)
    for _ in range(k):
        o = int(rng.uniform(0, 1) ** 1.5 * n * 0.9)
        f = np.exp(rng.uniform(np.log(f_lo), np.log(f_hi)))
        g = bell(f, 0.25, rng, tau=rng.uniform(0.02, tau), amps=(1, .3), ratios=(1, 2.7), tau_scale=(1, .5))
        gain = rng.uniform(0.2, 1.0)
        if decay_tau:
            gain *= np.exp(-o / SR / decay_tau)
        place(out, g, o, gain)
    return out


def fm_pluck(f, dur, ratio=3.5, index=3.0, itau=0.12, atau=0.6, atk=0.002, rng=None):
    n = ns(dur)
    t = np.arange(n) / SR
    idx = index * np.exp(-t / itau)
    y = fm(f, ratio, idx, n) * np.exp(-t / atau)
    return y * (1 - np.exp(-t / (atk / 3)))


def vibrato(f, n, rate=5.0, depth_cents=15, delay=0.0):
    t = np.arange(n) / SR
    d = np.clip((t - delay) / 0.4, 0, 1)
    return f * 2 ** (depth_cents * d * np.sin(TAU * rate * t) / 1200)


def breath(dur, rng, f=3000, q=0.8, tau=None):
    n = ns(dur)
    return biq(rng.standard_normal(n), "bp", f, q)


def steam_hiss(dur, rng, f_lo=3500, tau=0.5, atk=0.01, bright=1.0):
    n = ns(dur)
    x = rng.standard_normal(n)
    x = hp(x, f_lo) * 0.7 + bp(x, 1500, 6000) * 0.5
    t = np.arange(n) / SR
    mod = 1 + 0.35 * lowwobble(n, rng)
    return x * decay(n, tau, atk) * mod


def lowwobble(n, rng, cutoff=30.0):
    x = lp(rng.standard_normal(n), cutoff)
    return x / (np.std(x) + 1e-9)


def reverb_mono(x, rt60=0.8, wet=0.3, seed=1, damp=0.5):
    """Reverb summed to mono for 3D one-shots."""
    return reverb(x, make_ir(rt60, damp, 0.006, seed, stereo_out=False), wet=wet)


def reverb_st(x, rt60=1.5, wet=0.3, seed=1, damp=0.5, predelay=0.012, bright=1.0):
    return reverb(x, make_ir(rt60, damp, predelay, seed, True, bright), wet=wet)
