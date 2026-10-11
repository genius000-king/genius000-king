"""foley/: footsteps for 8 surfaces (walk/run), jump, landings, dash, slide, cloth."""
from recipes import *

SURFACES = ["grass", "stone", "sand", "wood", "metal", "water", "crystal", "snow"]


def _strike(surface, rng, hard, bright, dur=0.30):
    """One foot contact on `surface`. hard in 0..1 (walk..run)."""
    n = ns(dur)
    p = 2 ** rng.uniform(-0.14, 0.14)
    b = bright * (1 + 0.3 * hard)
    t = np.arange(n) / SR
    y = np.zeros(n)
    if surface == "grass":
        rate = (500 + 900 * hard) * np.exp(-t / 0.07) + 40
        place(y, crackle(n, rate, rng, 2500 * b, 9500 * b, 1.4, 1.2), 0, 0.9)
        place(y, hp(colored(n, rng, 1.0), 1800) * decay(n, 0.07 + 0.03 * hard, 0.012), 0, 0.35)
        place(y, bp(rng.standard_normal(n), 300, 1200) * decay(n, 0.05, 0.01), 0, 0.25)
        place(y, thump(105 * p, 70, dur, tp=0.03, ta=0.04), 0, (0.13 + 0.1 * hard))
    elif surface == "stone":
        place(y, modal([2300 * p * b, 3350 * p * b, 5200 * p * b], [1, .6, .35],
                   [0.005, 0.007, 0.004], n, rng=rng), 0, 1.1)
        place(y, click(rng, 4200 * b, 0.003), 0, 0.9)
        place(y, thump(150 * p, 85, dur, tp=0.025, ta=0.05), 0, (0.55 + 0.2 * hard))
        place(y, modal([410 * p, 690 * p], [.4, .25], [0.03, 0.02], n, rng=rng), 0, 0.5)
        place(y, crackle(n, (80 + 260 * hard) * np.exp(-t / 0.05), rng, 3000, 9000, 2.0), 0, 0.5)
    elif surface == "sand":
        env = decay(n, 0.09 + 0.05 * hard, 0.02)
        h = bp(rng.standard_normal(n), 500, 4800 * b) * env
        place(y, h, 0, (0.7 + 0.2 * hard))
        place(y, crackle(n, (250 + 450 * hard) * np.exp(-t / 0.09) + 20, rng, 900, 3800 * b, 1.2, 1.0), 0, 0.5)
        place(y, thump(88 * p, 60, dur, tp=0.03, ta=0.04), 0, 0.1)
    elif surface == "wood":
        f0 = 175 * p
        place(y, modal([f0, f0 * 1.78, f0 * 2.95, f0 * 4.6, f0 * 6.8], [1, .75, .5, .3, .15],
                   [0.11, 0.08, 0.05, 0.03, 0.02], n, rng=rng), 0, (0.8 + 0.3 * hard))
        place(y, noise_burst(0.02, 1200, 5000 * b, rng, tau=0.004), 0, 0.6)
        place(y, thump(110 * p, 62, dur, tp=0.02, ta=0.05), 0, 0.6)
        place(y, lowpass_creak(n, rng, 0.25 * hard + 0.1), 0, 1.0)
    elif surface == "metal":
        f0 = rng.uniform(520, 760) * p
        ratios = [1, 2.32, 4.17, 5.59, 7.11, 9.4]
        place(y, modal([f0 * r * b for r in ratios], [1, .8, .7, .45, .3, .2],
                   [0.22, 0.16, 0.12, 0.09, 0.07, 0.05], n, rng=rng), 0, 0.8)
        place(y, click(rng, 3800 * b, 0.003), 0, 0.7)
        place(y, thump(130 * p, 75, dur, tp=0.02, ta=0.05), 0, 0.8)
        place(y, crackle(n, (60 + 150 * hard) * np.exp(-t / 0.12), rng, 4000, 11000, 6.0), 0, 0.3)
    elif surface == "water":
        fc = env_pts([(0, 500), (0.03, 1400 * b), (0.09, 3000 * b), (0.2, 900)], n)
        sp = sweep(rng.standard_normal(n), fc, 1.4) * decay(n, 0.09 + 0.04 * hard, 0.006)
        place(y, sp, 0, 0.9)
        place(y, hp(rng.standard_normal(n), 4500) * decay(n, 0.05, 0.003), 0, 0.25)
        for _ in range(rng.integers(3, 6 + int(3 * hard))):
            o = int(rng.uniform(0.0, 0.13) * SR)
            f0 = rng.uniform(350, 1100) * p
            m = ns(0.05)
            tt_ = np.arange(m) / SR
            bub = np.sin(TAU * np.cumsum(f0 * (1 + 4 * tt_ / 0.03)) / SR) * np.exp(-tt_ / 0.012)
            place(y, bub, o, rng.uniform(0.15, 0.4))
        place(y, thump(170 * p, 90, dur, tp=0.03, ta=0.05), 0, 0.3)
    elif surface == "crystal":
        base = rng.uniform(2300, 3500) * p * b
        place(y, glass(base, dur, rng, tau=0.12 + 0.06 * hard, brightness=0.8), 0, 0.8)
        place(y, glass(base * 0.5, dur, rng, tau=0.08, brightness=0.3), 0, 0.3)
        place(y, click(rng, 6500 * b, 0.002), 0, 0.4)
        place(y, crackle(n, (180 + 300 * hard) * np.exp(-t / 0.06), rng, 3500, 11000 * b, 3.0), 0, 0.45)
        place(y, thump(130 * p, 75, dur, tp=0.025, ta=0.04), 0, 0.22)
    elif surface == "snow":
        sq = sweep(rng.standard_normal(n), env_pts([(0, 1900), (0.06, 2400 * b), (0.2, 3100 * b)], n), 9.0)
        place(y, sq * env_pts([(0, 0), (0.02, 0.5), (0.1, 0.55), (0.18, 0)], n), 0, 0.6)
        place(y, crackle(n, (500 + 600 * hard) * np.exp(-t / 0.1) + 30, rng, 1000, 5000 * b, 1.3, 1.1), 0, 0.7)
        place(y, lp(rng.standard_normal(n), 3000) * decay(n, 0.07, 0.015), 0, 0.25)
        place(y, thump(80 * p, 55, dur, tp=0.03, ta=0.05), 0, 0.12)
    return y


def lowpass_creak(n, rng, amount):
    if amount < 0.2:
        return np.zeros(n)
    x = sweep(rng.standard_normal(n), env_pts([(0, 400), (0.1, 900), (0.2, 500)], n), 12.0)
    return x * decay(n, 0.1, 0.01) * 0.15 * amount


def step(surface, run, i):
    rng = rng_for(f"step_{surface}_{'run' if run else 'walk'}", i)
    hard = 1.0 if run else 0.0
    hard *= rng.uniform(0.85, 1.0)
    bright = (1.0 if not run else 1.1) * rng.uniform(0.9, 1.1)
    dur = 0.34 if run else 0.3
    n = ns(dur)
    y = np.zeros(n)
    heel = _strike(surface, rng, hard, bright, dur)
    place(y, heel, 0, 1.0)
    # toe-down: lighter, shorter, a hair later
    off = rng.uniform(0.07, 0.09) if run else rng.uniform(0.09, 0.12)
    toe = _strike(surface, rng, hard * 0.3, bright * 1.05, dur - off)
    place(y, toe, ns(off), 0.42 if not run else 0.35)
    if run:                                  # scuff drag before the heel lands
        sc = bp(rng.standard_normal(ns(0.05)), 900, 5000) * np.hanning(ns(0.05))
        pre = np.zeros(ns(0.05) + n)
        place(pre, sc, 0, 0.22)
        place(pre, y, ns(0.05), 1.0)
        y = pre[:n]
    # gentle top-end control (run is brighter)
    y = hp(lp(y, 12500 if run else 9500, 1), 70, 1)
    return fade(y, 0.001, 0.05)


def _jump(i):
    rng = rng_for("jump", i)
    n = ns(0.42)
    p = 2 ** rng.uniform(-0.08, 0.08)
    y = whoosh(0.42, [(0, 500), (0.12, 1400 * p), (0.4, 700)], [(0, 0), (0.03, 0.5), (0.12, 0.35), (0.42, 0)],
               rng, q=0.9, alpha=0.5) * 0.5
    place(y, thump(135 * p, 70, 0.42, tp=0.05, ta=0.07), 0, 0.8)
    place(y, cloth(0.3, rng), 0, 0.7)
    place(y, modal([260 * p, 520 * p], [.3, .15], [0.05, 0.03], n, rng=rng), 0, 0.2)
    return y


def cloth(dur, rng, amt=1.0, f=(500, 3500)):
    """Soft fabric rustle: slow-modulated noise with micro-grains."""
    n = ns(dur)
    x = colored(n, rng, 0.8)
    env = np.abs(lp(rng.standard_normal(n), 14)) ** 1.5
    env = env / (np.max(env) + 1e-9) * np.hanning(n)
    y = bp(x, f[0], f[1], 2) * env
    y = y + crackle(n, 60, rng, f[0], f[1] * 1.5, 1.0, 1.2) * 0.2 * np.hanning(n)
    return y * amt


def _land(i, hard):
    rng = rng_for("land_hard" if hard else "land_soft", i)
    dur = 0.55 if hard else 0.32
    n = ns(dur)
    p = 2 ** rng.uniform(-0.1, 0.1)
    y = thump((115 if hard else 120) * p, 48 if hard else 62, dur, tp=0.04, ta=0.11 if hard else 0.06)
    y *= 1.0 if hard else 0.8
    if hard:
        place(y, thump(60 * p, 32, dur, tp=0.05, ta=0.16), 0, 0.9)
        place(y, noise_burst(0.08, 200, 2500, rng, tau=0.025), 0, 0.8)  # impact crunch
        place(y, crackle(n, 250 * np.exp(-np.arange(n) / SR / 0.08), rng, 2500, 9000, 2.0), 0, 0.5)
        place(y, modal([240 * p, 410 * p, 760 * p], [.35, .2, .1], [0.07, 0.05, 0.03], n, rng=rng), 0, 0.4)
        place(y, cloth(0.3, rng), 0, 0.8)
    else:
        place(y, noise_burst(0.06, 150, 1800, rng, tau=0.02), 0, 0.45)
        place(y, cloth(0.25, rng), 0, 0.6)
    return y


def _dash(i):
    rng = rng_for("dash", i)
    dur = 0.45
    n = ns(dur)
    y = whoosh(dur, [(0, 700), (0.12, 3800), (0.45, 900)], [(0, 0), (0.06, 1.0), (0.16, 0.8), (0.45, 0)],
               rng, q=1.3, alpha=0.3)
    place(y, whoosh(dur, [(0, 250), (0.2, 900), (0.45, 300)], [(0, 0), (0.1, 0.6), (0.45, 0)], rng, q=0.8, alpha=1.0), 0, 0.7)
    t = np.arange(n) / SR
    place(y, sine(env_pts([(0, 80), (0.1, 150), (0.45, 60)], n), n) * env_pts([(0, 0), (0.05, 0.5), (0.45, 0)], n), 0, 0.6)
    place(y, cloth(0.3, rng), 0, 0.5)
    return y


def _slide(rng):
    dur = 0.9
    n = ns(dur)
    x = colored(n, rng, 0.3)
    fc = 1400 + 500 * lp(rng.standard_normal(n), 6) / 0.3 * 0.1 + env_pts([(0, 1000), (0.2, 1800), (0.9, 800)], n)
    y = sweep(x, fc, 1.5)
    y *= env_pts([(0, 0), (0.05, 0.7), (0.7, 0.55), (0.9, 0)], n) * (1 + 0.4 * lowwobble(n, rng, 18)).clip(0.2)
    y += crackle(n, 220, rng, 1500, 7000, 1.5) * 0.35 * env_pts([(0, 0), (0.05, 1), (0.8, 0.7), (0.9, 0)], n)
    return y


def build(reg):
    for s in SURFACES:
        for run in (False, True):
            name = f"step_{s}_{'run' if run else 'walk'}"
            reg.add(name, "foley", [step(s, run, i) for i in range(6)],
                    peak=-14.0 if run else -18.0, level_jitter_db=1.2, pitch_jitter=0.06,
                    volume_db=0.0, bus="SFX", is_mono=True, fin=0.0005, fout=0.04)
    reg.add("jump", "foley", [_jump(i) for i in range(3)], peak=-14, pitch_jitter=0.05, is_mono=True, fout=0.05)
    reg.add("land_soft", "foley", [_land(i, False) for i in range(3)], peak=-15, pitch_jitter=0.05, is_mono=True, fout=0.05)
    reg.add("land_hard", "foley", [_land(i, True) for i in range(3)], peak=-9, pitch_jitter=0.05, is_mono=True, fout=0.08)
    reg.add("dash", "foley", [_dash(i) for i in range(3)], peak=-10, pitch_jitter=0.04, is_mono=True, fout=0.08)
    reg.add("slide", "foley", [_slide(rng_for("slide"))], peak=-14, is_mono=True, fout=0.12, fin=0.01)
    reg.add("cloth_move", "foley", [cloth(0.28, rng_for("cloth_move", i), f=(700 * 2 ** rng_for("cm", i).uniform(-.3, .3), 4000)) for i in range(4)],
            peak=-30, pitch_jitter=0.05, is_mono=True, fin=0.02, fout=0.08)
