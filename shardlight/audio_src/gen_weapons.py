"""weapons/: plasma lance (gather -> release), shard scatter, pulse, switch/raise/dry."""
from recipes import *


# ---------------------------------------------------------------- charge
def charge_loop():
    dur = 2.5
    n = ns(dur)
    r = rng_for("plasma_charge_loop")
    t = np.arange(n) / SR
    f0 = snap_freq(98.0, dur)
    out = np.zeros((n, 2))
    for c in range(2):
        rc = np.random.default_rng(1000 + c)
        # rich harmonic hum with per-channel micro-detune (integer cycles => periodic)
        hum = np.zeros(n)
        for k in range(1, 13):
            fk = snap_freq(f0 * k * (1 + rc.uniform(-0.004, 0.004)), dur)
            am = 1 + 0.25 * lfo(n, int(rc.integers(2, 9)), rc.uniform(0, 1))
            hum += (1.0 / k ** 0.75) * am * sine(fk, n, rc.uniform(0, 1))
        # "gathering" whine: shepard rising glissando (periodic by construction)
        she = shepard(n, dur, 55.0 * (1.0 + 0.02 * c), octaves=7, waveform="saw")
        she = circ(lambda z: lp(z, 4200, 2), she)
        # sub
        sub = sine(snap_freq(49.0, dur), n) * 0.7
        # swirling air: periodic pink noise through a periodically swept resonant bandpass
        air = colored(n, rc, 1.0)
        fc = 900 * 2 ** (1.2 * lfo(n, 3, 0.1 * c) + 0.6 * lfo(n, 5, 0.3 + 0.2 * c))
        air = circ_sweep(air, fc, 2.5, "bp")
        air *= 0.6 + 0.4 * lfo(n, 3, 0.25 + 0.5 * c)
        # crackling arcs
        rate = 55 + 40 * lfo(n, 7, 0.3 * c) + 25 * lfo(n, 13, 0.7)
        arcs = circ(lambda z: z, crackle(n, rate, rc, 1800, 11000, 3.0, 1.8))
        # bigger arcs: buzzy zaps placed with wrap
        zaps = np.zeros(n)
        for _ in range(7):
            o = int(rc.uniform(0, n))
            m = ns(rc.uniform(0.02, 0.07))
            tz = np.arange(m) / SR
            z = bp(rc.standard_normal(m), 1500, 9000) * (1 + sine(rc.choice([95., 140., 190.]), m)) * np.exp(-tz / 0.02)
            place(zaps, z, o, rc.uniform(0.25, 0.7), wrap=True)
        mix = hum * 0.5 + she * 0.55 + sub * 0.45 + air * 0.5 + arcs * 0.28 + zaps * 0.35
        out[:, c] = mix
    out = widen(out, 1.3)
    return out


def charge_start(i=0):
    r = rng_for("plasma_charge_start", i)
    dur = 0.8
    n = ns(dur)
    y = np.zeros(n)
    add(y, thump(95, 38, dur, tp=0.06, ta=0.18), 0.7)
    add(y, whoosh(dur, [(0, 250), (0.25, 1200), (0.7, 3600)], [(0, 0), (0.1, 0.5), (0.5, 0.9), (0.8, 0.15)], r, q=1.6, alpha=0.5), 0.8)
    ft = env_pts([(0, 140), (0.5, 420), (0.8, 600)], n)
    add(y, fm(ft, 2.0, env_pts([(0, 0.5), (0.5, 3.0), (0.8, 4.0)], n), n) * env_pts([(0, 0), (0.25, 0.4), (0.7, 0.55), (0.8, 0)], n), 0.5)
    add(y, click(r, 5200, 0.004), 0.6, 0.015)
    add(y, crackle(n, env_pts([(0, 50), (0.2, 600), (0.8, 250)], n), r, 2000, 10000, 3.0) * env_pts([(0, 0), (0.15, 0.7), (0.8, 0.5)], n), 0.5)
    y = softclip(y * 0.9, 1.2)
    st = decorrelate(y, r, 0.9)
    return reverb_st(st, 0.8, 0.25, 11)[:ns(1.0)]


def charge_full():
    r = rng_for("plasma_charge_full")
    dur = 1.6
    n = ns(dur)
    y = np.zeros(n)
    add(y, bell(1568, dur, r, tau=0.55, amps=(1, .55, .35, .18, .08)), 0.8)
    add(y, bell(2349, dur, r, tau=0.45, amps=(1, .5, .3, .1, .05)), 0.45, 0.05)
    add(y, glass(3136, 1.0, r, tau=0.25), 0.3, 0.09)
    add(y, sparkle(1.2, r, density=50, f_lo=3000, f_hi=11000, tau=0.18, decay_tau=0.5), 0.35, 0.03)
    add(y, whoosh(0.35, [(0, 600), (0.12, 4500), (0.35, 9000)], [(0, 0), (0.1, 0.8), (0.35, 0)], r, q=1.0), 0.45)
    add(y, thump(130, 75, 0.25, tp=0.03, ta=0.08), 0.35)
    st = decorrelate(y, r, 0.7)
    return reverb_st(st, 1.2, 0.3, 12, predelay=0.02, bright=1.2)[:ns(2.0)]


# ------------------------------------------------------------------ fire
def fire(i):
    r = rng_for("plasma_fire", i)
    p = 2 ** r.uniform(-0.12, 0.12)
    dur = 2.4
    n = ns(dur)
    body = np.zeros(n)
    # whoomp: pink noise body swept down + pressure swell
    wn = colored(n, r, 1.0)
    wm = sweep(wn, env_pts([(0, 2600 * p), (0.08, 1100), (0.5, 160), (2.4, 120)], n), 0.9)
    add(body, wm * env_pts([(0, 0), (0.004, 1), (0.25, 0.7), (0.7, 0.2), (2.4, 0)], n), 0.8)
    add(body, bp(wn, 120, 600) * env_pts([(0, 0), (0.025, 1), (0.3, 0.5), (0.9, 0)], n), 0.9)
    # sub punch + body knock (saturated for mass)
    add(body, thump(78 * p, 34, dur, tp=0.15, ta=0.5), 0.9)
    add(body, thump(170 * p, 65, 0.5, tp=0.04, ta=0.14), 0.9)
    body = softclip(body, 1.7)
    y = body * 0.8
    # bright zap (added after saturation so it stays crisp)
    zn = ns(0.4)
    fz = 380 + (7200 * p - 380) * np.exp(-np.arange(zn) / SR / 0.045)
    zap = fm(fz, 2.01 + 0.1 * r.uniform(-1, 1), 7 * np.exp(-np.arange(zn) / SR / 0.07) + 0.5, zn)
    add(y, zap * decay(zn, 0.09, 0.0008), 0.8)
    add(y, noise_burst(0.15, 3000, 14000, r, tau=0.03), 0.8)
    add(y, click(r, 7500, 0.002), 0.7)
    add(y, bell(2900 * p, 0.8, r, tau=0.3, amps=(1, .6, .3, .1, .05)), 0.18, 0.02)
    # electric crackle burst around the release
    cn = ns(1.5)
    add(y, crackle(cn, 800 * np.exp(-np.arange(cn) / SR / 0.35) + 30, r, 1500, 12000, 2.5, 1.6), 0.9, 0.01)
    # smoky tail
    tn = ns(2.3)
    tail = sweep(colored(tn, r, 1.2), env_pts([(0, 1800), (1.0, 500), (2.2, 250)], tn), 0.8)
    add(y, tail * env_pts([(0, 0), (0.08, 0.4), (0.5, 0.35), (2.2, 0)], tn), 0.6)
    add(y, hp(colored(tn, r, 0.5), 3000) * decay(tn, 0.45), 0.15)
    st = np.stack([y, y], axis=1)
    tailst = decorrelate(hp(y, 200), r, 1.0)
    st = 0.5 * st + 0.5 * tailst
    st = reverb_st(st, 1.6, 0.28, 20 + i)
    return trim_tail(st[:ns(2.9)], -55)


def projectile_loop():
    dur = 1.6
    n = ns(dur)
    r = rng_for("plasma_projectile_loop")
    t = np.arange(n) / SR
    f0 = snap_freq(190.0, dur)
    mod_f = snap_freq(37.0, dur)
    whir = fm(f0 * (1 + 0.04 * lfo(n, 3)), 2.0, 2.5 + 1.5 * lfo(n, 2), n)
    whir *= 0.65 + 0.35 * sine(mod_f, n)                 # AM whirr
    hum2 = harmonic_stack(snap_freq(95.0, dur), n, [1, .6, .5, .3, .25, .2, .12])
    hiss = colored(n, r, 0.0)
    hiss = circ(lambda z: bp(z, 2500, 9500, 2), hiss) * (0.6 + 0.4 * lfo(n, 4, 0.3))
    air = circ(lambda z: biq(z, "bp", 1400, 2.0), colored(n, r, 1.0))
    sizzle = crackle(n, 90 + 40 * lfo(n, 5), r, 2500, 11000, 3.0, 1.6)
    return whir * 0.5 + hum2 * 0.3 + hiss * 0.45 + air * 0.25 + sizzle * 0.3


def impact(i):
    r = rng_for("plasma_impact", i)
    p = 2 ** r.uniform(-0.1, 0.1)
    dur = 3.2
    n = ns(dur)
    y = np.zeros(n)
    add(y, thump(85 * p, 27, 1.6, tp=0.12, ta=0.42), 1.25)
    add(y, softclip(thump(180 * p, 60, 0.5, tp=0.03, ta=0.1), 2), 0.6)
    bn = colored(ns(1.2), r, 1.0)
    boom = sweep(bn, env_pts([(0, 2800), (0.05, 1100), (0.5, 160), (1.2, 90)], len(bn)), 0.9)
    add(y, boom * env_pts([(0, 0), (0.003, 1), (0.2, 0.7), (0.6, 0.25), (1.2, 0)], len(bn)), 1.0)
    add(y, noise_burst(0.1, 500, 7000, r, tau=0.015), 0.7)           # shock transient
    cn = ns(1.9)
    add(y, crackle(cn, 900 * np.exp(-np.arange(cn) / SR / 0.45) + 30, r, 1200, 10000, 2.2, 1.7), 0.7, 0.02)
    # debris rain: pings of stone/metal + noise ticks, thinning out with time
    for _ in range(int(r.integers(26, 40))):
        o = r.uniform(0.06, 1.9) ** 1.0
        g = np.exp(-o / 1.0) * r.uniform(0.15, 0.55)
        if r.random() < 0.45:
            f = np.exp(r.uniform(np.log(500), np.log(3500))) * p
            gr = modal([f, f * 2.3, f * 3.9], [1, .4, .2], [0.012, 0.01, 0.006], ns(0.08), rng=r)
        else:
            gr = noise_burst(0.05, r.uniform(600, 2500), r.uniform(3000, 9000), r, tau=r.uniform(0.006, 0.02))
        add(y, gr, g, o)
    # smoky tail
    tn = ns(3.0)
    smoke = sweep(colored(tn, r, 1.4), env_pts([(0, 1100), (1.2, 420), (3.0, 220)], tn), 0.7)
    add(y, smoke * env_pts([(0, 0), (0.15, 0.4), (1.0, 0.35), (3.0, 0)], tn), 0.9)
    add(y, hp(colored(tn, r, 0.3), 2500) * decay(tn, 0.6, 0.05), 0.1)
    y = softclip(y, 1.4)
    y = reverb_mono(y, 1.6, 0.35, 30 + i)
    return trim_tail(y[:ns(3.5)], -55)


def vent(i):
    r = rng_for("plasma_vent", i)
    dur = 1.5 + 0.2 * i
    n = ns(dur)
    y = np.zeros(n)
    hiss = steam_hiss(dur, r, 3200, tau=0.5 + 0.1 * i, atk=0.03)
    add(y, hiss, 0.9)
    add(y, sweep(r.standard_normal(n), env_pts([(0, 3000), (0.3, 2400), (dur, 1500)], n), 8.0) * decay(n, 0.5, 0.04), 0.18)
    add(y, bp(colored(n, r, 0.8), 400, 1400) * decay(n, 0.25, 0.02), 0.25)
    for k in range(int(r.integers(3, 6))):                      # cooling-metal ticks
        f = r.uniform(1700, 3300)
        add(y, modal([f, f * 2.4, f * 4.1], [1, .5, .25], [0.05, 0.03, 0.02], ns(0.2), rng=r), r.uniform(0.15, 0.4), r.uniform(0.15, dur - 0.3))
    add(y, thump(100, 55, 0.2, tp=0.03, ta=0.06), 0.2)
    st = decorrelate(y, r, 1.0)
    return reverb_st(st, 0.6, 0.15, 40 + i)[:n + ns(0.3)]


# ---------------------------------------------------------------- shards
def shard_fire(i):
    r = rng_for("shard_fire", i)
    p = 2 ** r.uniform(-0.15, 0.2)
    dur = 0.6
    n = ns(dur)
    y = np.zeros(n)
    zn = ns(0.25)
    fz = 600 * p + (3600 * p - 600 * p) * np.exp(-np.arange(zn) / SR / 0.04)
    pew = fm(fz, 3.01, 4 * np.exp(-np.arange(zn) / SR / 0.05) + 0.3, zn) * decay(zn, 0.07, 0.0005)
    add(y, pew, 0.7)
    add(y, click(r, 6500, 0.002), 0.7)
    add(y, noise_burst(0.04, 5000, 13000, r, tau=0.007), 0.55)
    add(y, glass(2400 * p, 0.45, r, tau=0.2), 0.5, 0.004)
    add(y, glass(3600 * p, 0.35, r, tau=0.15), 0.3, 0.022)
    add(y, thump(210 * p, 105, 0.12, tp=0.02, ta=0.04), 0.45)
    add(y, sparkle(0.4, r, density=30, f_lo=3500, f_hi=12000, tau=0.1, decay_tau=0.15), 0.22, 0.03)
    st = decorrelate(y, r, 0.6)
    return reverb_st(st, 0.8, 0.22, 50 + i, bright=1.2)[:ns(0.8)]


def shard_impact(i):
    r = rng_for("shard_impact", i)
    p = 2 ** r.uniform(-0.12, 0.12)
    dur = 0.8
    n = ns(dur)
    y = np.zeros(n)
    add(y, noise_burst(0.06, 2500, 11000, r, tau=0.01), 0.9)
    add(y, click(r, 5500, 0.003), 0.6)
    add(y, thump(320 * p, 140, 0.12, tp=0.02, ta=0.04), 0.5)
    for k in range(int(r.integers(5, 10))):
        f = np.exp(r.uniform(np.log(1800), np.log(8500))) * p
        add(y, glass(f, 0.3, r, tau=r.uniform(0.04, 0.2)), r.uniform(0.2, 0.6) * np.exp(-k * 0.12), r.uniform(0.0, 0.3) * (k > 0))
    add(y, crackle(ns(0.5), 300 * np.exp(-np.arange(ns(0.5)) / SR / 0.12), r, 3000, 11000, 3.0), 0.4, 0.02)
    return reverb_mono(y, 0.5, 0.2, 60 + i)[:ns(0.9)]


def pulse_fire():
    r = rng_for("pulse_fire")
    dur = 1.8
    n = ns(dur)
    y = np.zeros(n)
    add(y, thump(62, 24, dur, tp=0.25, ta=0.6), 1.3)
    add(y, softclip(thump(140, 52, 0.7, tp=0.08, ta=0.2), 2.0), 0.8)
    wn = colored(n, r, 1.0)
    add(y, sweep(wn, env_pts([(0, 1800), (0.15, 700), (0.8, 150), (dur, 90)], n), 0.8) * env_pts([(0, 0), (0.01, 1), (0.3, 0.6), (1.2, 0.1), (dur, 0)], n), 1.0)
    add(y, bp(wn, 80, 400) * env_pts([(0, 0), (0.04, 1), (0.5, 0.4), (dur, 0)], n), 0.6)
    # expanding shock ring
    ring = sweep(r.standard_normal(n), env_pts([(0, 4500), (0.5, 900), (dur, 300)], n), 3.0) * env_pts([(0, 0), (0.02, 0.5), (0.7, 0.2), (dur, 0)], n)
    add(y, ring, 0.35)
    add(y, modal([110, 220, 331], [1, .4, .2], [0.8, 0.5, 0.3], ns(1.6), rng=r), 0.25)
    y = softclip(y, 1.6)
    st = decorrelate(y, r, 1.0)
    st = reverb_st(st, 1.4, 0.3, 70)
    return trim_tail(st[:ns(2.4)], -55)


def switch():
    r = rng_for("weapon_switch")
    n = ns(0.45)
    y = np.zeros(n)
    add(y, click(r, 2600, 0.006), 0.9)
    add(y, modal([1800, 2900, 4300, 6100], [1, .7, .5, .3], [0.03, 0.025, 0.02, 0.015], ns(0.2), rng=r), 0.4)
    add(y, thump(180, 90, 0.1, tp=0.02, ta=0.04), 0.5)
    fz = env_pts([(0, 420), (0.14, 980)], ns(0.2))
    add(y, bp(saw(fz, ns(0.2)), 500, 3500) * np.hanning(ns(0.2)), 0.35, 0.05)
    add(y, glass(2093, 0.3, r, tau=0.12), 0.18, 0.2)
    add(y, click(r, 3200, 0.004), 0.5, 0.2)
    return decorrelate(y, r, 0.4)


def raise_():
    r = rng_for("weapon_raise")
    n = ns(0.7)
    y = np.zeros(n)
    add(y, whoosh(0.5, [(0, 300), (0.3, 1500), (0.5, 800)], [(0, 0), (0.18, 0.6), (0.5, 0)], r, q=0.9, alpha=0.5), 0.7)
    add(y, click(r, 2200, 0.007), 0.8, 0.3)
    add(y, thump(150, 70, 0.14, tp=0.03, ta=0.06), 0.6, 0.3)
    hm = env_pts([(0, 140), (0.5, 330)], ns(0.6))
    add(y, harmonic_stack(hm, ns(0.6), [1, .5, .3, .2]) * env_pts([(0, 0), (0.3, 0.3), (0.6, 0)], ns(0.6)), 0.4, 0.05)
    add(y, modal([2600, 4000], [1, .5], [0.04, 0.03], ns(0.2), rng=r), 0.3, 0.3)
    return decorrelate(y, r, 0.5)


def dry():
    r = rng_for("dry_click")
    n = ns(0.18)
    y = np.zeros(n)
    add(y, click(r, 2200, 0.004), 0.9)
    add(y, modal([900, 1700, 2600], [1, .6, .4], [0.02, 0.015, 0.01], n, rng=r), 0.5)
    add(y, thump(160, 90, 0.08, tp=0.015, ta=0.03), 0.4, 0.002)
    add(y, click(r, 1600, 0.004), 0.35, 0.045)
    return decorrelate(y, r, 0.3)


def build(reg):
    L = 0
    reg.add("plasma_charge_start", "weapons", [charge_start()], peak=-5, fout=0.08, bus="SFX")
    reg.add("plasma_charge_loop", "weapons", [charge_loop()], loop=True, lufs_target=-21, peak=-6, bus="SFX", fin=0, fout=0, fade_edges=False)
    reg.add("plasma_charge_full", "weapons", [charge_full()], peak=-6, bus="SFX", fout=0.1)
    reg.add("plasma_fire", "weapons", [fire(i) for i in range(3)], peak=-1.5, pitch_jitter=0.04, bus="SFX", fout=0.12)
    reg.add("plasma_projectile_loop", "weapons", [projectile_loop()], loop=True, lufs_target=-24, peak=-8, bus="SFX", is_mono=True, fin=0, fout=0, fade_edges=False)
    reg.add("plasma_impact", "weapons", [impact(i) for i in range(3)], peak=-2.0, pitch_jitter=0.05, bus="SFX", is_mono=True, fout=0.15)
    reg.add("plasma_vent", "weapons", [vent(i) for i in range(2)], peak=-9, pitch_jitter=0.03, bus="SFX", fout=0.1)
    reg.add("shard_fire", "weapons", [shard_fire(i) for i in range(5)], peak=-4, pitch_jitter=0.06, bus="SFX", fout=0.06)
    reg.add("shard_impact", "weapons", [shard_impact(i) for i in range(4)], peak=-6, pitch_jitter=0.06, bus="SFX", is_mono=True, fout=0.06)
    reg.add("pulse_fire", "weapons", [pulse_fire()], peak=-2, bus="SFX", fout=0.12)
    reg.add("weapon_switch", "weapons", [switch()], peak=-10, bus="SFX")
    reg.add("weapon_raise", "weapons", [raise_()], peak=-10, bus="SFX", fout=0.04)
    reg.add("dry_click", "weapons", [dry()], peak=-12, bus="SFX")
