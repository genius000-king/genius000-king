"""slime/: Blu's liquid body — hop squelches (walk/run), jump bloop, landing splats, plasma gulp, splashes,
goo shot + splat. Bubble model: exponentially rising sine (Minnaert-style) with fast decay."""
from recipes import *


def bubble(f0, dur, rng, rise=1.6, tau=0.025):
    n = ns(dur)
    t = np.arange(n) / SR
    f = f0 * (1 + (rise - 1) * (1 - np.exp(-t / (tau * 1.5))))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * decay(n, tau, 0.0008)


def droplets(dur, rng, count=6, f_lo=700, f_hi=2600, spread=0.18, gain=0.35):
    y = np.zeros(ns(dur))
    for _ in range(count):
        at = rng.uniform(0.0, spread)
        b = bubble(rng.uniform(f_lo, f_hi), 0.08, rng, rise=rng.uniform(1.2, 2.0), tau=rng.uniform(0.008, 0.02))
        place(y, b, int(at * SR), gain * rng.uniform(0.4, 1.0))
    return y


def squelch(dur, rng, hard=0.0, low=1.0):
    """wet compression: low-passed noise with a moving resonance + pitch-dropping blob tone."""
    n = ns(dur)
    t = np.arange(n) / SR
    body = rng.standard_normal(n)
    body = sweep(body, 1800 + 1600 * hard, q=2.5, kind="lp") * decay(n, 0.05 + 0.03 * hard, 0.004)
    f = (210 + 80 * hard) * low * np.exp(-t / 0.05) + 90 * low
    blob = np.sin(2 * np.pi * np.cumsum(f) / SR) * decay(n, 0.06, 0.003)
    y = 0.7 * body + 0.9 * blob
    y += 0.5 * resonator(rng.standard_normal(n) * decay(n, 0.02), 900 * low + 400 * hard, q=8.0)
    return y


def hop(rng, hard):
    dur = 0.35
    y = squelch(dur, rng, hard, low=2 ** rng.uniform(-0.15, 0.15))
    add(y, droplets(dur, rng, count=int(2 + 5 * hard), spread=0.12 + 0.1 * hard, gain=0.25 + 0.2 * hard))
    return fade(y, 0.001, 0.05)


def bloop(rng):
    dur = 0.45
    n = ns(dur)
    t = np.arange(n) / SR
    f = 160 * np.exp(t / 0.12)
    f = np.minimum(f, 900)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_pts([(0, 0), (0.01, 1), (0.25, 0.6), (0.45, 0)], n)
    y = formants(y + 0.1 * rng.standard_normal(n), [(500, 6, 1.0), (1100, 8, 0.5)]) + 0.6 * y
    add(y, squelch(dur, rng, 0.3, low=0.8), 0.6)
    add(y, droplets(dur, rng, 4, spread=0.1, gain=0.2), at=0.03)
    return fade(y, 0.001, 0.06)


def splat(rng, hard):
    dur = 0.8 + 0.4 * hard
    n = ns(dur)
    y = np.zeros(n)
    add(y, bp(rng.standard_normal(n), 250, 3500) * decay(n, 0.05 + 0.06 * hard, 0.002), 1.0)
    add(y, thump(120, 55, dur, tp=0.03, ta=0.08 + 0.05 * hard), 0.6 + 0.5 * hard)
    add(y, squelch(0.4, rng, hard, low=0.7), 0.8)
    add(y, droplets(dur, rng, count=int(6 + 14 * hard), f_lo=500, f_hi=3200, spread=0.35 + 0.3 * hard, gain=0.3), at=0.04)
    return fade(y, 0.001, 0.1)


def gulp(rng):
    dur = 0.7
    n = ns(dur)
    y = np.zeros(n)
    for k, at in enumerate([0.0, 0.22]):
        seg = ns(0.3)
        t = np.arange(seg) / SR
        f = (260 - 60 * k) * np.exp(-t / 0.18)
        g = np.sin(2 * np.pi * np.cumsum(f) / SR) * decay(seg, 0.09, 0.01)
        g = formants(g + 0.15 * rng.standard_normal(seg), [(400, 5, 1.0), (900, 7, 0.6)]) + 0.5 * g
        place(y, g, int(at * SR), 0.9)
    add(y, droplets(dur, rng, 5, f_lo=400, f_hi=1200, spread=0.5, gain=0.3), at=0.05)
    return fade(y, 0.002, 0.08)


def splash(rng):
    dur = 0.9
    n = ns(dur)
    y = hp(rng.standard_normal(n), 1200) * env_pts([(0, 0), (0.005, 1), (0.08, 0.4), (0.9, 0)], n, 2.0) * 0.6
    add(y, droplets(dur, rng, 18, f_lo=900, f_hi=4200, spread=0.6, gain=0.35))
    return fade(y, 0.001, 0.1)


def goo_shot(rng):
    dur = 0.3
    n = ns(dur)
    t = np.arange(n) / SR
    f = 900 * np.exp(-t / 0.05) + 250
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * decay(n, 0.05, 0.001)
    add(y, whoosh(dur, [(0, 2500), (0.3, 900)], [(0, 0), (0.02, 1), (0.3, 0)], rng), 0.4)
    add(y, bubble(rng.uniform(600, 900), 0.1, rng, 2.2, 0.02), 0.6)
    return fade(y, 0.001, 0.04)


def goo_splat(rng):
    return splat(rng, 0.15)[: ns(0.5)]


def dash_liquid(rng):
    dur = 0.55
    y = whoosh(dur, [(0, 600), (0.25, 2200), (0.55, 700)], [(0, 0), (0.06, 1), (0.55, 0)], rng, q=1.4)
    add(y, droplets(dur, rng, 8, spread=0.4, gain=0.25), at=0.05)
    add(y, squelch(0.3, rng, 0.8, 0.9), 0.5)
    return fade(y, 0.002, 0.08)


def build(reg):
    r = rng_for("slime")
    kw = dict(bus="SFX", is_mono=True)
    reg.add("slime_hop", "slime", [hop(rng_for("hop", i), 0.15) for i in range(8)], peak=-12, pitch_jitter=0.06, **kw)
    reg.add("slime_hop_run", "slime", [hop(rng_for("hopr", i), 0.75) for i in range(8)], peak=-9, pitch_jitter=0.06, **kw)
    reg.add("slime_jump", "slime", [bloop(rng_for("bloop", i)) for i in range(4)], peak=-8, pitch_jitter=0.05, **kw)
    reg.add("slime_land_soft", "slime", [splat(rng_for("splat_s", i), 0.2) for i in range(4)], peak=-9, **kw)
    reg.add("slime_land_hard", "slime", [splat(rng_for("splat_h", i), 1.0) for i in range(4)], peak=-4, **kw)
    reg.add("slime_gulp", "slime", [gulp(rng_for("gulp", i)) for i in range(2)], peak=-7, **kw)
    reg.add("slime_splash", "slime", [splash(rng_for("splash", i)) for i in range(3)], peak=-8, **kw)
    reg.add("goo_shot", "slime", [goo_shot(rng_for("goo", i)) for i in range(5)], peak=-8, pitch_jitter=0.08, **kw)
    reg.add("goo_splat", "slime", [goo_splat(rng_for("goos", i)) for i in range(4)], peak=-9, **kw)
    reg.add("slime_dash", "slime", [dash_liquid(rng_for("dash", i)) for i in range(3)], peak=-6, **kw)
