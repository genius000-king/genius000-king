"""abilities/: Lift (anti-gravity), Stasis (time-stretched crystal), scan ping, unlock sting."""
from instruments import *


def lift_activate():
    r = rng_for("lift_activate")
    n = ns(1.2)
    y = np.zeros((n, 2))
    air = whoosh(1.0, [(0, 400), (0.5, 1800), (1.0, 3800)], [(0, 0), (0.45, 0.8), (0.9, 0.5), (1.0, 0)], r, q=1.1, alpha=0.6)
    place(y, decorrelate(air, r, 1.0), 0, 0.7)
    sub = sine(env_pts([(0, 55), (0.8, 130)], ns(1.0)), ns(1.0)) * env_pts([(0, 0), (0.5, 0.7), (1.0, 0)], ns(1.0))
    place(y, stereo(sub), 0, 0.7)
    for k, f in enumerate([523.25, 659.25, 784.0, 987.77]):
        put(y, bell(f * 2, 1.2, r, tau=0.5), 0.05 + 0.09 * k, 0.28 - 0.02 * k, pan_=-0.5 + 0.33 * k)
    place(y, decorrelate(sparkle(0.9, r, 50, 3500, 11000, 0.12), r, 1.0), ns(0.1), 0.25)
    place(y, stereo(shepard(ns(1.0), 1.0, 220.0, 5, "sine")), 0, 0.12)
    return reverb_st(y, 1.4, 0.3, 80)[:ns(1.9)]


def lift_loop():
    dur = 3.0
    n = ns(dur)
    out = np.zeros((n, 2))
    for c in range(2):
        rc = np.random.default_rng(300 + c)
        f0 = snap_freq(164.8, dur)
        h = np.zeros(n)
        for mult, a in [(1, 1.0), (1.5, 0.6), (2, 0.5), (3, 0.25), (4.5, 0.1)]:
            for d in (-0.003, 0.003):
                h += a * sine(snap_freq(f0 * mult * (1 + d * (1 if c else -1)), dur), n, rc.uniform(0, 1)) * (1 + 0.2 * lfo(n, int(rc.integers(1, 5)), rc.uniform(0, 1)))
        air = colored(n, rc, 1.0)
        fc = 1100 * 2 ** (0.9 * lfo(n, 2, 0.2 * c) + 0.5 * lfo(n, 5, 0.1 + 0.3 * c))
        air = circ_sweep(air, fc, 2.0, "bp")
        she = shepard(n, dur, 110.0 * (1 + 0.01 * c), 6, "sine")
        sub = sine(snap_freq(55.0, dur), n)
        out[:, c] = h * 0.14 + air * 0.6 + she * 0.18 + sub * 0.18
    r = rng_for("lift_loop")
    for _ in range(18):                        # glassy motes drifting past
        f = np.exp(r.uniform(np.log(1800), np.log(7500)))
        put(out, bell(f, 0.8, r, tau=0.18, amps=(1, .3), ratios=(1, 2.7), tau_scale=(1, .5)), r.uniform(0, dur), r.uniform(0.04, 0.12), pan_=r.uniform(-0.9, 0.9))
    return widen(out, 1.3)


def lift_end():
    r = rng_for("lift_end")
    n = ns(1.0)
    y = np.zeros((n, 2))
    place(y, decorrelate(whoosh(0.8, [(0, 3500), (0.3, 1500), (0.8, 350)], [(0, 0), (0.05, 0.7), (0.5, 0.4), (0.8, 0)], r, q=1.1, alpha=0.6), r, 1.0), 0, 0.6)
    place(y, stereo(sine(env_pts([(0, 130), (0.5, 55)], ns(0.8)), ns(0.8)) * env_pts([(0, 0), (0.1, 0.6), (0.8, 0)], ns(0.8))), 0, 0.6)
    for k, f in enumerate([987.77, 784.0, 659.25, 523.25]):
        put(y, bell(f * 2, 1.0, r, tau=0.4), 0.02 + 0.08 * k, 0.22, pan_=0.5 - 0.33 * k)
    place(y, stereo(thump(110, 60, 0.3, tp=0.04, ta=0.09)), ns(0.35), 0.4)
    return reverb_st(y, 1.0, 0.25, 81)[:ns(1.5)]


def _crystal_chord(r, freqs=(440.0, 659.25, 987.77, 1479.98), dur=1.2, tau=0.9):
    y = np.zeros(ns(dur))
    for k, f in enumerate(freqs):
        add(y, glass(f, dur, r, tau=tau), 0.5 / (1 + 0.2 * k), 0.012 * k)
    return y


def stasis_cast():
    r = rng_for("stasis_cast")
    n = ns(2.4)
    y = np.zeros((n, 2))
    # reversed shimmer swell leading into the freeze
    sw = reverb_st(decorrelate(_crystal_chord(r, (587.33, 880.0, 1318.5, 1760.0), 0.6, 0.6), r, 1), 1.2, 1.0, 82, predelay=0.0)[:ns(0.9)]
    place(y, reverse(sw) * 0.5, 0, 1.0)
    hit = ns(0.45)
    place(y, decorrelate(_crystal_chord(r, (293.66, 440.0, 659.25, 987.77, 1479.98), 1.6, 1.1), r, 0.8), hit, 0.7)
    place(y, stereo(noise_burst(0.3, 5000, 14000, r, tau=0.06)), hit, 0.5)
    place(y, stereo(crackle(ns(0.9), 400 * np.exp(-np.arange(ns(0.9)) / SR / 0.25), r, 3500, 11000, 4.0)), hit, 0.45)
    place(y, stereo(thump(90, 40, 0.6, tp=0.06, ta=0.2)), hit, 0.7)
    place(y, stereo(click(r, 6000, 0.003)), hit, 0.5)
    # descending freeze glissando
    fz = env_pts([(0, 6000), (0.5, 800)], ns(0.5))
    place(y, stereo(fm(fz, 2.0, 1.5, ns(0.5)) * env_pts([(0, 0.4), (0.5, 0)], ns(0.5))), hit, 0.2)
    return reverb_st(y, 2.0, 0.3, 83)[:ns(3.0)]


def stasis_loop():
    dur = 4.0
    n = ns(dur)
    r = rng_for("stasis_loop")
    src = np.zeros(ns(2.0))
    for k, f in enumerate([440.0, 659.25, 880.0, 1318.5, 1760.0, 2637.0]):
        add(src, glass(f, 1.8, r, tau=1.2), 0.5, 0.05 * k)
    add(src, sparkle(1.5, r, 40, 2500, 9000, 0.4), 0.3)
    out = np.stack([paulstretch(src, 10, 0.55, n, np.random.default_rng(900 + c), circular=True) for c in range(2)], axis=1)
    out /= np.std(out) + 1e-9
    # faint cold air + sub, periodic
    air = np.stack([circ(lambda z: bp(z, 4000, 11000), colored(n, np.random.default_rng(50 + c), 0.5)) for c in range(2)], axis=1)
    air *= (0.6 + 0.4 * lfo(n, 2))[:, None]
    sub = stereo(sine(snap_freq(55.0, dur), n)) * (0.6 + 0.4 * lfo(n, 1, 0.3))[:, None]
    return out * 0.7 + air * 0.12 + sub * 0.25


def stasis_end():
    r = rng_for("stasis_end")
    n = ns(1.8)
    y = np.zeros((n, 2))
    src = np.zeros(ns(1.0))
    for k, f in enumerate([440.0, 659.25, 987.77, 1479.98]):
        add(src, glass(f, 0.9, r, tau=0.6), 0.5, 0.02 * k)
    sw = np.stack([paulstretch(src, 4, 0.3, ns(0.7), np.random.default_rng(910 + c)) for c in range(2)], axis=1)
    place(y, reverse(sw) * 0.8, 0, 1.0)
    p0 = ns(0.7)
    place(y, stereo(click(r, 4500, 0.004)), p0, 0.7)
    place(y, stereo(noise_burst(0.2, 3000, 12000, r, tau=0.05)), p0, 0.5)
    place(y, decorrelate(sparkle(0.9, r, 70, 2500, 11000, 0.12, decay_tau=0.3), r, 1.0), p0, 0.45)
    place(y, stereo(thump(100, 50, 0.4, tp=0.04, ta=0.12)), p0, 0.5)
    return reverb_st(y, 1.5, 0.25, 84)[:ns(2.4)]


def scan_ping():
    r = rng_for("scan_ping")
    n = ns(1.7)
    dry = np.zeros(n)
    f = 1318.5
    pn = ns(0.9)
    t = np.arange(pn) / SR
    ping = fm(f, 1.0, 1.4 * np.exp(-t / 0.08), pn) * np.exp(-t / 0.22) + 0.3 * sine(f * 2.01, pn) * np.exp(-t / 0.1)
    ping += 0.4 * bell(f * 0.5, 0.9, r, tau=0.3, amps=(1, .4), ratios=(1, 2.76), tau_scale=(1, .4))
    add(dry, ping * (1 - np.exp(-t / 0.0008)), 0.9)
    add(dry, sweep(r.standard_normal(ns(0.15)), env_pts([(0, 500), (0.14, 3500)], ns(0.15)), 2.0) * np.hanning(ns(0.15)), 0.25)
    y = np.zeros((n, 2))
    place(y, stereo(dry), 0, 1.0)
    for k, (d, g) in enumerate([(0.2, 0.45), (0.42, 0.28), (0.7, 0.16), (1.0, 0.08)]):
        tap = lp(dry[:ns(0.8)], 5000 / (1 + k * 0.7))
        put(y, tap, d, g, pan_=(-0.6 if k % 2 else 0.6), wrap=False)
    return reverb_st(y, 1.5, 0.3, 85, bright=0.8)[:ns(2.2)]


def unlock_sting():
    r = rng_for("ability_unlock")
    dur = 4.6
    n = ns(dur)
    y = np.zeros((n, 2))
    # riser
    place(y, decorrelate(whoosh(1.0, [(0, 300), (0.9, 6000)], [(0, 0), (0.9, 0.9), (1.0, 0)], r, q=1.0, alpha=0.4), r, 1.0), 0, 0.35)
    # lydian arpeggio D4 A4 D5 F#5 A5 C#6 D6 F#6
    notes = [62, 69, 74, 78, 81, 85, 86, 90]
    for k, m in enumerate(notes):
        f = mtof(m)
        put(y, bell(f, 2.5, r, tau=1.0), 0.1 + 0.11 * k, 0.45, pan_=-0.6 + 0.17 * k)
        put(y, kalimba(f, 1.5, r), 0.1 + 0.11 * k, 0.3, pan_=-0.6 + 0.17 * k)
    # held chord with pad + choir swell on the arrival
    t0 = 1.05
    for m in (50, 57, 62, 66, 69, 73):
        place(y, pad(mtof(m), 2.0, r, bright=0.7, voices=3, atk=0.3, rel=2.2, sub=0.0), ns(t0), 0.22)
    for m in (74, 78, 81, 86):
        place(y, choir(mtof(m), 1.8, r, "a", atk=0.4, rel=2.0, voices=3), ns(t0), 0.2)
    place(y, stereo(thump(80, 32, 1.2, tp=0.12, ta=0.4)), ns(t0), 0.9)
    put(y, bell(mtof(86), 3.0, r, tau=1.6), t0, 0.4)
    put(y, bell(mtof(90), 3.0, r, tau=1.6), t0 + 0.05, 0.3)
    place(y, decorrelate(sparkle(2.5, r, 90, 3000, 12000, 0.3, decay_tau=1.2), r, 1.0), ns(t0), 0.4)
    place(y, stereo(noise_burst(0.5, 3000, 12000, r, tau=0.12)), ns(t0), 0.25)
    y = reverb_st(y, 2.2, 0.28, 86)
    return trim_tail(y[:ns(6.0)], -50)


def build(reg):
    reg.add("lift_activate", "abilities", [lift_activate()], peak=-5, bus="SFX", fout=0.1)
    reg.add("lift_loop", "abilities", [lift_loop()], loop=True, lufs_target=-26, peak=-8, bus="SFX", fade_edges=False)
    reg.add("lift_end", "abilities", [lift_end()], peak=-6, bus="SFX", fout=0.1)
    reg.add("stasis_cast", "abilities", [stasis_cast()], peak=-4, bus="SFX", fout=0.15)
    reg.add("stasis_loop", "abilities", [stasis_loop()], loop=True, lufs_target=-27, peak=-8, bus="SFX", fade_edges=False)
    reg.add("stasis_end", "abilities", [stasis_end()], peak=-6, bus="SFX", fout=0.15)
    reg.add("scan_ping", "abilities", [scan_ping()], peak=-6, bus="SFX", fout=0.15)
    reg.add("ability_unlock", "abilities", [unlock_sting()], peak=-2.5, bus="SFX", fout=0.3)
