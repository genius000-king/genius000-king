"""ambience/: eight 48 s seamless stereo biome beds + bird calls + wind gusts."""
from instruments import *

DUR = 48.0
N = ns(DUR)


# ------------------------------------------------------------------ birds
def bird_note(f_contour, dur, rng, harm=(1.0, 0.22, 0.07), fm_rate=0.0, fm_depth=0.0, atk=0.012):
    n = ns(dur)
    t = np.arange(n) / SR
    f = f_contour(t / dur) if callable(f_contour) else f_contour
    if fm_depth:
        f = f * (1 + fm_depth * np.sin(TAU * fm_rate * t))
    ph = np.cumsum(f) / SR
    y = sum(a * np.sin(TAU * (k + 1) * ph) for k, a in enumerate(harm))
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.8
    e *= np.minimum(1, t / atk)
    return y * e


def bird_call(rng, style):
    """Eight synthetic songbird calls (pitch contours + vibrato + harmonics)."""
    base = rng.uniform(0.9, 1.15)
    parts = []   # (start_s, array)
    t = 0.0
    if style == 0:        # descending whistle "tee-oo"
        parts.append((0, bird_note(lambda u: base * (4200 - 1500 * u ** 0.7), 0.22, rng)))
        parts.append((0.26, bird_note(lambda u: base * (3300 - 1100 * u), 0.30, rng, fm_rate=14, fm_depth=0.01)))
    elif style == 1:      # fast rising trill
        for k in range(int(rng.integers(7, 11))):
            parts.append((k * 0.075, bird_note(lambda u, k=k: base * (3000 + 90 * k + 700 * u), 0.05, rng, atk=0.004)))
    elif style == 2:      # warble (random-walk pitch + fast FM)
        walk = np.cumsum(rng.standard_normal(14)) * 180
        for k in range(14):
            parts.append((k * 0.085, bird_note(lambda u, k=k: base * (3200 + walk[k] + 500 * np.sin(np.pi * u)), 0.08, rng, fm_rate=40, fm_depth=0.02)))
    elif style == 3:      # long rising whistle with vibrato
        parts.append((0, bird_note(lambda u: base * (2200 + 1800 * u ** 1.5), 0.9, rng, fm_rate=9, fm_depth=0.012)))
    elif style == 4:      # sharp cheeps x3
        for k in range(3):
            parts.append((k * 0.22, bird_note(lambda u: base * (3600 + 1400 * np.sin(np.pi * u) ** 1.5), 0.09, rng, atk=0.005)))
    elif style == 5:      # melodic phrase (pentatonic, varied durations)
        degs = rng.choice([0, 2, 4, 7, 9, 12, 14], size=int(rng.integers(5, 8)))
        tt_ = 0.0
        for d in degs:
            dd = rng.choice([0.09, 0.14, 0.2])
            f = 2400 * 2 ** (d / 12) * base
            parts.append((tt_, bird_note(lambda u, f=f: f * (1 + 0.04 * (u - 0.3)), dd, rng, fm_rate=11, fm_depth=0.006)))
            tt_ += dd + rng.uniform(0.02, 0.06)
    elif style == 6:      # tweet-tweet-tweeeet
        parts.append((0, bird_note(lambda u: base * (3400 + 900 * u), 0.1, rng)))
        parts.append((0.16, bird_note(lambda u: base * (3600 + 900 * u), 0.1, rng)))
        parts.append((0.34, bird_note(lambda u: base * (3300 + 1700 * u ** 2), 0.4, rng, fm_rate=7, fm_depth=0.01)))
    else:                 # low soft coo (3 notes)
        for k in range(3):
            parts.append((k * 0.34, bird_note(lambda u: base * (750 - 180 * u + 80 * np.sin(np.pi * u)), 0.28, rng, harm=(1, .5, .2), fm_rate=6, fm_depth=0.02, atk=0.04)))
    total = max(s + len(a) / SR for s, a in parts) + 0.05
    y = np.zeros(ns(total))
    for s, a in parts:
        add(y, a, 0.8, s)
    return y


def bird_oneshot(i):
    r = rng_for("bird", i)
    y = bird_call(r, i % 8)
    if i < 4 and r.random() < 0.5 and i % 8 not in (3, 7):     # some repeat the phrase
        y2 = np.zeros(len(y) + ns(0.5))
        add(y2, y, 1.0)
        add(y2, y * 0.8, 1.0, len(y) / SR + 0.12)
        y = y2
    y = hp(y, 350, 1)
    return reverb_mono(y, 0.9, 0.25, 120 + i)


def wind_gust(i):
    r = rng_for("wind_gust", i)
    dur = 4.5 + 0.8 * i
    n = ns(dur)
    out = np.zeros((n, 2))
    for c in range(2):
        rc = np.random.default_rng(int(r.integers(1, 1 << 30)))
        x = colored(n, rc, 1.0)
        fc = env_pts([(0, 350), (dur * 0.4, 1100 + 400 * i), (dur, 300)], n) * 2 ** (0.25 * np.sin(TAU * (1.3 + 0.4 * c) * np.arange(n) / SR + c))
        y = sweep(x, fc, 1.6, "bp")
        y *= env_pts([(0, 0), (dur * 0.4, 1.0), (dur * 0.55, 0.9), (dur, 0)], n, 1.6) * (1 + 0.25 * lowwobble(n, rc, 4)).clip(0.3)
        out[:, c] = y
    return out


# ----------------------------------------------------------- shared helpers
def curve(rng, bins, std=1.0, lo=1):
    return periodic_curve(N, rng, bins, std, lo)


def bed(seed, alpha, fc0, depth_oct, q, kind="bp", amp_depth=0.5, fc_bins=6, amp_bins=8, base=1.0, lp_out=None):
    """Stereo periodic noise bed with gusting level and wandering filter centre."""
    out = np.zeros((N, 2))
    r0 = np.random.default_rng(seed)
    common_a = curve(r0, amp_bins)
    common_f = curve(r0, fc_bins)
    for c in range(2):
        rc = np.random.default_rng(seed * 7 + c + 1)
        x = colored(N, rc, alpha)
        a = 0.75 * common_a + 0.25 * curve(rc, amp_bins)
        f = 0.75 * common_f + 0.25 * curve(rc, fc_bins)
        y = circ_sweep(x, fc0 * 2 ** (depth_oct * f), q, kind)
        if lp_out:
            y = circ(lambda z: lp(z, lp_out, 2), y)
        out[:, c] = y * np.exp(amp_depth * a) / np.exp(amp_depth ** 2 / 2) * base
    return out


def events(rng, count, fn, gain=(0.5, 1.0), pan_range=0.9, min_t=0.0, rate_curve=None):
    """Place `count` events (fn(rng)->mono/stereo array) randomly with wrap."""
    buf = np.zeros((N, 2))
    for _ in range(count):
        tpos = rng.uniform(0, DUR)
        snd = fn(rng)
        if snd.ndim == 1:
            snd = pan(snd, rng.uniform(-pan_range, pan_range))
        place(buf, snd, ns(tpos), rng.uniform(*gain), wrap=True)
    return buf


def wet(buf, rt60=2.0, mix=0.5, dry=0.6, seed=1, bright=1.0, damp=0.5):
    return reverb_loop(buf, make_ir(rt60, damp, 0.02, seed, True, bright), wet=mix, dry=dry)


def cricket(rng):
    f = rng.uniform(4300, 5600)
    pulses = int(rng.integers(3, 5))
    gap = rng.uniform(0.028, 0.036)
    y = np.zeros(ns(pulses * gap + 0.05))
    for k in range(pulses):
        m = ns(0.016)
        p = (sine(f, m) + 0.3 * sine(f * 2, m)) * np.hanning(m)
        add(y, p, 1.0 - 0.1 * k, k * gap)
    return y


def chime(rng, scale=(62, 64, 66, 69, 71), octaves=(12, 24), dur=3.5, tau=1.8):
    m = rng.choice(scale) + rng.choice(octaves)
    return fmbell(mtof(m), dur, rng, tau=tau, index=rng.uniform(0.8, 1.6))


def drone(freqs, gains, seed, wob=0.003, bins=4, harm=(1, .4, .2, .1), lp_hz=None):
    """Slow-beating sine-stack drone (stereo, periodic)."""
    out = np.zeros((N, 2))
    r = np.random.default_rng(seed)
    for c in range(2):
        for f, g in zip(freqs, gains):
            for d in (-wob, wob):
                ff = snap_freq(f * (1 + d * (1 if c else -1)), DUR)
                am = 1 + 0.3 * lfo(N, int(r.integers(1, bins + 1)), r.uniform(0, 1))
                out[:, c] += g * am * harmonic_stack(ff, N, harm, ph=r.uniform(0, 1, len(harm)))
    if lp_hz:
        out = circ(lambda z: lp(z, lp_hz, 2), out)
    return out


def far(x, lp_hz=3500):
    return lp(x, lp_hz, 2)


# --------------------------------------------------------------- biomes
def amb_verdant():
    r = rng_for("amb_verdant")
    wind = bed(11, 1.0, 900, 0.45, 0.9, "bp", 0.55, 6, 7, 1.0)
    swish = bed(12, 0.3, 4200, 0.3, 0.7, "bp", 0.7, 9, 14, 0.35)             # grass blades
    low = bed(13, 2.0, 180, 0.3, 0.7, "lp", 0.4, 4, 5, 0.4)
    birds = events(r, 17, lambda rr: far(bird_call(rr, int(rr.integers(0, 8))), 6500), gain=(0.12, 0.3))
    birds = wet(birds, 2.2, 0.55, 0.6, 5)
    ins = np.zeros((N, 2))
    for v in range(3):
        rv = np.random.default_rng(40 + v)
        gate = curve(rv, 6) > 0.1
        cr = np.zeros((N, 2))
        tpos = 0.0
        pn = rv.uniform(-0.8, 0.8)
        while tpos < DUR:
            tpos += rv.uniform(0.55, 0.85)
            if gate[min(N - 1, ns(tpos))]:
                place(cr, pan(cricket(rv), pn), ns(tpos), 1.0, wrap=True)
        ins += cr * 0.6
    ch = events(r, 8, lambda rr: chime(rr), gain=(0.1, 0.22))
    ch = wet(ch, 3.0, 0.7, 0.5, 6)
    return wind * 0.28 + swish * 0.2 + low * 0.1 + birds * 1.9 + ins * 0.2 + ch * 1.3


def amb_hub():
    r = rng_for("amb_hub")
    dr = drone([36.7, 55.0, 73.4, 110.0], [1.0, 0.6, 0.45, 0.2], 21, wob=0.0025, harm=(1, .5, .25, .12), lp_hz=700)
    # resonant formant breathing on top of the drone
    reson = bed(22, 0.7, 150, 0.25, 12.0, "bp", 0.3, 3, 4, 1.0)
    wind = bed(23, 1.5, 450, 0.5, 0.7, "lp", 0.6, 4, 5, 0.7)
    crk = np.zeros((N, 2))
    for c in range(2):
        rc = np.random.default_rng(900 + c)
        rate = 3 + 18 * np.clip(curve(rc, 10, 1), 0, None)
        cc = crackle(N, rate, rc, 1500, 7000, 3.0, 1.8)
        crk[:, c] = circ(lambda z: lp(z, 5000), cc)
    crk = wet(crk, 5.0, 0.8, 0.25, 7, bright=0.7, damp=0.4)
    shim = events(r, 9, lambda rr: bell(mtof(rr.choice([74, 78, 81, 86])), 4.0, rr, tau=1.8, amps=(1, .3, .1), ratios=(1, 2.7, 5.4), tau_scale=(1, .5, .2)), gain=(0.03, 0.08))
    shim = wet(shim, 4.0, 0.9, 0.3, 8)
    ping = events(r, 4, lambda rr: far(modal([1200, 1810, 2790], [1, .5, .3], [0.12, 0.09, 0.06], ns(0.6), rng=rr), 3000), gain=(0.05, 0.12))
    ping = wet(ping, 4.5, 0.9, 0.3, 9, bright=0.6)
    return dr * 0.55 + reson * 0.25 + wind * 0.5 + crk * 0.5 + shim + ping


def amb_cave():
    r = rng_for("amb_cave")
    air = bed(31, 2.0, 130, 0.3, 0.7, "lp", 0.4, 3, 4, 1.0)
    breath = bed(32, 1.0, 420, 0.5, 2.5, "bp", 0.7, 5, 6, 0.35)
    hum = bed(33, 0.6, 205, 0.1, 25.0, "bp", 0.4, 2, 3, 1.0)

    def drip(rr):
        f = rr.uniform(700, 2000)
        m = ns(0.25)
        t = np.arange(m) / SR
        y = np.sin(TAU * np.cumsum(f * (1 + 0.6 * np.exp(-t / 0.012))) / SR) * np.exp(-t / 0.05)
        y += 0.3 * np.sin(TAU * f * 2.7 * t) * np.exp(-t / 0.02)
        return y * (1 - np.exp(-t / 0.0006))
    drips = events(r, 18, drip, gain=(0.15, 0.6), pan_range=0.8)
    drips = wet(drips, 4.2, 0.95, 0.35, 11, bright=0.8)
    rumble = np.zeros((N, 2))
    rum = circ(lambda z: lp(z, 70, 2), colored(N, r, 2.0))
    rumble += stereo(rum * np.exp(1.2 * np.maximum(curve(r, 3), 0)) * 0.6)
    return air * 0.55 + breath * 0.35 + hum * 0.05 + drips * 1.0 + rumble * 0.4


def amb_amber():
    r = rng_for("amb_amber")
    wind = bed(41, 0.8, 1700, 0.5, 0.8, "bp", 0.75, 5, 6, 1.0)
    wind2 = bed(42, 1.5, 600, 0.3, 0.7, "bp", 0.6, 4, 5, 0.6)
    sand = bed(43, 0.0, 6500, 0.2, 0.6, "hp", 0.6, 6, 22, 0.5)
    patter = np.zeros((N, 2))
    for c in range(2):
        rc = np.random.default_rng(950 + c)
        rate = 5 + 140 * np.clip(curve(rc, 12), 0, None) ** 1.2
        patter[:, c] = crackle(N, rate, rc, 2500, 9000, 1.0, 1.0)
    warm = drone([55.0, 82.4, 110.0], [1.0, 0.5, 0.4], 44, wob=0.002, harm=(1, .3, .15), lp_hz=500)

    def creak(rr):
        m = ns(1.2)
        f = 180 + 60 * np.abs(lp(rr.standard_normal(m), 3)) / 0.08
        y = formants(saw(f, m), [(600, 12, 1), (1300, 12, 0.6)]) * np.hanning(m) * (0.5 + 0.5 * np.abs(lp(rr.standard_normal(m), 12)) / 0.1)
        return lp(y, 2500)
    crk = events(r, 2, creak, gain=(0.04, 0.08))
    crk = wet(crk, 2.0, 0.5, 0.7, 12)
    return wind * 0.55 + wind2 * 0.3 + sand * 0.35 + patter * 0.18 + warm * 0.3 + crk


def _wave(rr, dur):
    n = ns(dur)
    x = colored(n, rr, 1.0)
    fc = env_pts([(0, 180), (dur * 0.45, 2800), (dur * 0.6, 2200), (dur, 220)], n)
    y = sweep(x, fc, 0.9, "lp") * env_pts([(0, 0), (dur * 0.42, 1.0), (dur * 0.6, 0.7), (dur, 0)], n, 1.5)
    foam = hp(colored(n, rr, 0.2), 3000) * env_pts([(0, 0), (dur * 0.5, 0.45), (dur * 0.8, 0.15), (dur, 0)], n, 1.5)
    return y + foam


def amb_tide():
    r = rng_for("amb_tide")
    out = np.zeros((N, 2))
    t = 2.0
    k = 0
    while t < DUR - 1:
        dur = r.uniform(6.5, 9.0)
        w = _wave(r, dur)
        place(out, pan(w, r.uniform(-0.5, 0.5)), ns(t), r.uniform(0.7, 1.0), wrap=True)
        place(out, pan(w[::-1] * 0.0, 0), ns(t), 0)
        t += dur * r.uniform(0.55, 0.8)
    # re-space last wave so spacing wraps evenly enough (loop is periodic via wrap anyway)
    lap = bed(51, 0.5, 2500, 0.3, 0.8, "bp", 0.7, 8, 20, 0.2)
    low = drone([49.0, 73.4], [1.0, 0.5], 52, wob=0.003, harm=(1, .3), lp_hz=300) * (1 + 0.3 * lfo(N, 6))[:, None]
    bubb = np.zeros((N, 2))
    for c in range(2):
        rc = np.random.default_rng(970 + c)
        bubb[:, c] = crackle(N, 25 + 15 * curve(rc, 8).clip(-1, 2), rc, 900, 3500, 4.0, 1.0)
    glass_ = events(r, 7, lambda rr: bell(mtof(rr.choice([69, 73, 76, 81])), 4.0, rr, tau=1.8, amps=(1, .4, .15), ratios=(1, 2.0, 4.0), tau_scale=(1, .6, .3)), gain=(0.04, 0.1))
    glass_ = wet(glass_, 3.5, 0.8, 0.4, 13, damp=0.6)
    return out * 0.9 + lap * 0.4 + low * 0.3 + bubb * 0.1 + glass_


def amb_ember():
    r = rng_for("amb_ember")
    fire = np.zeros((N, 2))
    for c in range(2):
        rc = np.random.default_rng(980 + c)
        rate = 90 + 90 * curve(rc, 10).clip(-1, 1.5)
        cc = crackle(N, np.maximum(rate, 20), rc, 700, 6500, 1.2, 1.4)
        pops = crackle(N, 6, rc, 160, 700, 1.5, 1.6)
        fire[:, c] = circ(lambda z: lp(z, 6500), cc) * 0.7 + pops * 1.2
    rumble = bed(61, 2.0, 120, 0.3, 0.7, "lp", 0.5, 4, 5, 1.0)
    heat = bed(62, 1.0, 1100, 0.4, 0.8, "bp", 0.5, 5, 6, 0.4)
    # choir-ish glow, long notes that wrap
    ch = np.zeros((N, 2))
    for k, (m, v) in enumerate([(38, "o"), (45, "o"), (50, "u"), (53, "o")]):
        place(ch, choir(mtof(m), 14.0, r, v, atk=7.0, rel=7.0, voices=3, bright=0.5), ns(k * 11.0 + 1.0), 0.17, wrap=True)
    gong = events(r, 3, lambda rr: bell(rr.choice([73.4, 110.0, 98.0]), 7.0, rr, tau=3.0, amps=(1, .5, .3, .2), ratios=(1, 2.1, 3.3, 5.0), tau_scale=(1, .6, .4, .3)), gain=(0.1, 0.2))
    gong = wet(gong, 4.0, 0.8, 0.4, 14, damp=0.4)
    emb = events(r, 25, lambda rr: bell(rr.uniform(2500, 7000), 0.4, rr, tau=0.08, amps=(1, .3), ratios=(1, 2.7), tau_scale=(1, .5)), gain=(0.02, 0.07))
    return fire * 0.3 + rumble * 0.55 + heat * 0.25 + ch * 1.0 + gong * 0.8 + emb * 0.6


def amb_glass():
    r = rng_for("amb_glass")
    wind = bed(71, 0.2, 5500, 0.35, 5.0, "bp", 0.6, 5, 6, 0.4)
    whistle = bed(72, 0.5, 2200, 0.4, 14.0, "bp", 0.9, 4, 5, 0.4)
    low = bed(73, 2.0, 140, 0.2, 0.7, "lp", 0.3, 3, 4, 0.35)
    src = np.zeros(ns(3.0))
    for k, m in enumerate([81, 85, 88, 93, 97]):
        add(src, glass(mtof(m), 2.8, r, tau=1.8), 0.4, 0.2 * k)
    pad_ = np.stack([paulstretch(src, 10, 0.6, N, np.random.default_rng(1100 + c), circular=True) for c in range(2)], axis=1)
    pad_ /= np.std(pad_) + 1e-9

    def cascade(rr):
        base_m = rr.choice([88, 90, 93, 97])
        y = np.zeros(ns(2.5))
        for k in range(int(rr.integers(4, 9))):
            add(y, glass(mtof(base_m + rr.choice([-5, -3, 0, 2, 4, 7])), 1.8, rr, tau=rr.uniform(0.4, 1.0)), rr.uniform(0.3, 0.8), rr.uniform(0, 1.0))
        return y
    chimes = events(r, 7, cascade, gain=(0.06, 0.14))
    chimes = wet(chimes, 3.2, 0.7, 0.45, 15, bright=1.2)
    sing = drone([1568.0, 2349.0], [0.04, 0.025], 74, wob=0.002, harm=(1, .2))
    return wind * 0.35 + whistle * 0.12 + low * 0.35 + pad_ * 0.45 + chimes * 1.0 + sing * 0.3


def amb_hollow():
    r = rng_for("amb_hollow")
    breath = bed(81, 1.0, 330, 0.5, 1.8, "bp", 0.9, 4, 5, 1.0)
    breath *= (0.55 + 0.45 * lfo(N, 8))[:, None]                 # slow 'breathing' of the flora
    whisper = bed(82, 0.3, 2200, 0.35, 3.0, "bp", 0.8, 8, 12, 0.18)
    dr = drone([55.0, 58.3, 82.4], [1.0, 0.7, 0.4], 83, wob=0.004, harm=(1, .5, .2), lp_hz=500)
    dr *= (0.7 + 0.3 * lfo(N, 4, 0.2))[:, None]

    def knock(rr):
        f0 = rr.uniform(150, 360)
        return modal([f0, f0 * 1.8, f0 * 2.9, f0 * 4.5], [1, .6, .35, .2], [0.14, 0.1, 0.06, 0.03], ns(0.5), rng=rr)
    knocks = events(r, 9, knock, gain=(0.1, 0.35), pan_range=0.8)
    knocks = wet(knocks, 2.4, 0.7, 0.4, 16, damp=0.4)

    def spore(rr):
        f = rr.uniform(500, 1500)
        m = ns(0.3)
        t = np.arange(m) / SR
        return np.sin(TAU * np.cumsum(f * (1 - 0.3 * t / 0.3)) / SR) * np.exp(-t / 0.07) * (1 - np.exp(-t / 0.005))
    sp = events(r, 14, spore, gain=(0.03, 0.12))
    sp = wet(sp, 3.0, 0.8, 0.3, 17)
    return breath * 0.45 + whisper * 0.5 + dr * 0.4 + knocks * 1.0 + sp * 0.8


BIOMES = {"amb_verdant": amb_verdant, "amb_hub": amb_hub, "amb_cave": amb_cave, "amb_amber": amb_amber,
          "amb_tide": amb_tide, "amb_ember": amb_ember, "amb_glass": amb_glass, "amb_hollow": amb_hollow}
TASKS = list(BIOMES) + ["oneshots"]


def build(reg, only=None):
    for name, fn in BIOMES.items():
        if only and name != only:
            continue
        reg.add(name, "ambience", [fn()], loop=True, lufs_target=-24, peak=-4, bus="Ambience", is_mono=False,
                q=0.4, fade_edges=False, ceiling=-2.0, look_ms=10)
    if not only or only == "oneshots":
        reg.add("bird", "ambience", [bird_oneshot(i) for i in range(8)], peak=-14, pitch_jitter=0.1, bus="Ambience", is_mono=True, fout=0.05)
        reg.add("wind_gust", "ambience", [wind_gust(i) for i in range(3)], peak=-12, pitch_jitter=0.05, bus="Ambience", is_mono=False, fout=0.3, fin=0.1)
