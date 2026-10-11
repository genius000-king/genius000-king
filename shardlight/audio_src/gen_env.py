"""env/: emitter loops (water, waterfall, crystal, Loom, portal) + one-shots."""
from instruments import *


def water_loop():
    dur = 5.0
    n = ns(dur)
    r = rng_for("water_loop")
    body = circ(lambda z: bp(z, 250, 2800, 2), colored(n, r, 1.0))
    body *= 0.7 + 0.3 * (periodic_curve(n, r, 10, 0.5) + 1) / 2
    hiss = circ(lambda z: hp(z, 3500, 2), colored(n, r, 0.2)) * (0.6 + 0.4 * lfo(n, 4, 0.3)) * 0.35
    bub = np.zeros(n)
    for _ in range(110):                     # tiny rising bubbles / droplets
        f0 = r.uniform(400, 2200)
        m = ns(0.06)
        tt_ = np.arange(m) / SR
        b = np.sin(TAU * np.cumsum(f0 * (1 + 3.5 * tt_ / 0.035)) / SR) * np.exp(-tt_ / 0.015)
        place(bub, b, int(r.uniform(0, n)), r.uniform(0.05, 0.28), wrap=True)
    low = circ(lambda z: lp(z, 160, 2), colored(n, r, 2.0)) * 0.3
    return body * 0.7 + hiss + bub * 0.5 + low


def waterfall_loop():
    dur = 6.0
    n = ns(dur)
    r = rng_for("waterfall_loop")
    roar = circ(lambda z: lp(z, 7500, 2) * 0.8 + hp(z, 800, 1) * 0.2, colored(n, r, 0.6))
    roar *= 0.8 + 0.2 * lfo(n, 5, 0.2) * 0.5 + 0.1 * lfo(n, 11)
    rumble = circ(lambda z: lp(z, 180, 2), colored(n, r, 2.0)) * 1.2
    mist = circ(lambda z: hp(z, 5000, 2), colored(n, r, 0.0)) * (0.7 + 0.3 * lfo(n, 7, 0.5)) * 0.35
    splash = crackle(n, 60, r, 800, 5000, 0.8, 1.0) * 0.5
    return roar * 0.8 + rumble * 0.6 + mist + splash


def crystal_hum_loop():
    dur = 4.0
    n = ns(dur)
    r = rng_for("crystal_hum_loop")
    f0 = snap_freq(220.0, dur)
    y = np.zeros(n)
    for ratio, a in [(1, 1.0), (1.5, 0.5), (2, 0.55), (3, 0.3), (4.01, 0.18), (5.4, 0.1), (7.9, 0.05)]:
        for d in (-0.0035, 0.0035):
            y += a * sine(snap_freq(f0 * ratio * (1 + d), dur), n, r.uniform(0, 1)) * (1 + 0.25 * lfo(n, int(r.integers(1, 6)), r.uniform(0, 1)))
    y += 0.35 * sine(snap_freq(110.0, dur), n)
    for _ in range(14):
        f = np.exp(r.uniform(np.log(2500), np.log(9000)))
        place(y, bell(f, 1.0, r, tau=0.3, amps=(1, .3), ratios=(1, 2.7), tau_scale=(1, .5)), int(r.uniform(0, n)), r.uniform(0.05, 0.15), wrap=True)
    return y


def loom_hum_loop():
    dur = 5.0
    n = ns(dur)
    r = rng_for("loom_hum_loop")
    f0 = snap_freq(55.0, dur)
    y = np.zeros(n)
    for k in range(1, 15):
        y += (1.0 / k ** 0.9) * sine(snap_freq(f0 * k * (1 + r.uniform(-0.002, 0.002)), dur), n, r.uniform(0, 1))
    y *= 0.7 + 0.3 * lfo(n, 2, 0.1)                        # slow throb
    whirr = circ(lambda z: bp(z, 500, 1800, 2), colored(n, r, 0.5)) * (0.5 + 0.5 * lfo(n, 20)) * 0.25   # rotating
    ticks = np.zeros(n)
    for k in range(8):                                     # mechanical ticks, evenly spaced => periodic
        tk = modal([900, 1500, 2400], [1, .6, .3], [0.015, 0.01, 0.008], ns(0.1), rng=r)
        add(tk, click(r, 3000, 0.004), 1.0)
        place(ticks, tk, int(k * n / 8), 0.35, wrap=True)
    sub = sine(snap_freq(27.5, dur), n) * 0.8
    air = circ(lambda z: lp(z, 900, 2), colored(n, r, 1.5)) * 0.4
    return y * 0.45 + whirr + ticks * 0.3 + sub * 0.4 + air


def portal_loop():
    dur = 4.0
    n = ns(dur)
    r = rng_for("portal_loop")
    she = shepard(n, dur, 82.0, 7, "sine")
    she2 = shepard(n, dur, 123.0, 6, "saw")
    she2 = circ(lambda z: lp(z, 3500), she2)
    swirl = colored(n, r, 1.0)
    fc = 1200 * 2 ** (1.0 * lfo(n, 4) + 0.5 * lfo(n, 9, 0.3))
    swirl = circ_sweep(swirl, fc, 3.0, "bp")
    y = she * 0.3 + she2 * 0.25 + swirl * 0.5
    y += 0.35 * harmonic_stack(snap_freq(110.0, dur), n, [1, .5, .35, .2]) * (0.7 + 0.3 * lfo(n, 3))
    y += crackle(n, 40, r, 2500, 11000, 3.0) * 0.25
    y += sine(snap_freq(41.0, dur), n) * 0.4
    return y


def portal_enter():
    r = rng_for("portal_enter")
    n = ns(2.4)
    y = np.zeros((n, 2))
    pull = whoosh(1.1, [(0, 300), (0.9, 5000), (1.1, 9000)], [(0, 0), (0.8, 1.0), (1.1, 0.6)], r, q=1.4, alpha=0.5)
    place(y, decorrelate(pull, r, 1.0), 0, 0.7)
    place(y, stereo(shepard(ns(1.1), 1.1, 150.0, 5, "saw") * np.linspace(0, 1, ns(1.1)) * 0.25), 0, 1.0)
    t0 = ns(1.0)
    place(y, stereo(thump(90, 30, 1.2, tp=0.1, ta=0.3)), t0, 1.0)
    place(y, decorrelate(noise_burst(0.7, 200, 6000, r, tau=0.15), r, 1.0), t0, 0.5)
    put(y, bell(mtof(86), 2.0, r, tau=0.9), 1.0, 0.25, -0.3)
    put(y, bell(mtof(81), 2.0, r, tau=0.9), 1.05, 0.2, 0.3)
    place(y, decorrelate(sparkle(1.3, r, 60, 3000, 12000, 0.2, decay_tau=0.6), r, 1.0), t0, 0.3)
    st = reverb_st(y, 1.6, 0.28, 110)
    return trim_tail(mono(st)[:ns(3.2)], -50)


def windmill_creak():
    r = rng_for("windmill_creak")
    dur = 3.2
    n = ns(dur)
    # stick-slip: sawtooth at slowly varying low pitch, chopped by a slip pattern, through wood resonances
    f = 70 + 35 * np.abs(lp(r.standard_normal(n), 3)) / 0.08 + env_pts([(0, 0), (1.5, 40), (3.2, 0)], n)
    src = saw(f, n)
    slip = np.clip(0.6 + 0.8 * lp(r.standard_normal(n), 9) / 0.2, 0, 1) ** 1.5
    src = src * slip + 0.3 * colored(n, r, 0.5) * slip
    y = formants(src, [(520, 10, 1.0), (1100, 12, 0.7), (1900, 10, 0.4), (330, 8, 0.6)])
    y *= env_pts([(0, 0), (0.3, 0.5), (1.4, 1.0), (2.4, 0.7), (3.2, 0)], n)
    # blade whump passing the tower every ~0.8 s
    for k in range(4):
        place(y, lp(thump(70, 45, 0.3, tp=0.05, ta=0.1), 120), ns(0.35 + 0.8 * k), 0.5)
    y += circ(lambda z: bp(z, 150, 500), colored(n, r, 1.5)) * 0.12
    return reverb_mono(y, 0.5, 0.15, 111)[:n]


def build(reg):
    kw = dict(bus="SFX", is_mono=True, loop=True, fade_edges=False)
    reg.add("water_loop", "env", [water_loop()], lufs_target=-27, peak=-8, **kw)
    reg.add("waterfall_loop", "env", [waterfall_loop()], lufs_target=-25, peak=-8, **kw)
    reg.add("crystal_hum_loop", "env", [crystal_hum_loop()], lufs_target=-29, peak=-9, **kw)
    reg.add("loom_hum_loop", "env", [loom_hum_loop()], lufs_target=-25, peak=-8, **kw)
    reg.add("portal_loop", "env", [portal_loop()], lufs_target=-25, peak=-8, **kw)
    reg.add("portal_enter", "env", [portal_enter()], peak=-3, bus="SFX", is_mono=True, fout=0.25)
    reg.add("windmill_creak", "env", [windmill_creak()], peak=-14, bus="SFX", is_mono=True, fout=0.2, fin=0.05)
