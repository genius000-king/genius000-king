"""pickup/: memory echo, Keystone (choral swell), item."""
from instruments import *


def echo_pickup():
    r = rng_for("echo_pickup")
    dur = 3.4
    n = ns(dur)
    y = np.zeros((n, 2))
    # reversed shimmer swell
    src = np.zeros(ns(1.0))
    for k, m in enumerate([73, 78, 80, 85, 88]):        # D lydian-ish cluster
        add(src, glass(mtof(m), 0.9, r, tau=0.7), 0.5, 0.03 * k)
    sw = np.stack([paulstretch(src, 6, 0.3, ns(1.1), np.random.default_rng(700 + c)) for c in range(2)], axis=1)
    place(y, reverse(sw) * 0.7, 0, 1.0)
    t0 = 1.0
    # rising granular glissando of little sine grains
    gl = np.zeros(ns(1.4))
    for k in range(70):
        u = k / 70
        f = 600 * (9.0 ** u) * r.uniform(0.97, 1.03)
        add(gl, bell(f, 0.3, r, tau=0.06 + 0.1 * (1 - u), amps=(1, .25), ratios=(1, 2.7), tau_scale=(1, .5)), 0.25, u * 1.2)
    place(y, decorrelate(gl, r, 1.0), ns(0.2), 0.35)
    # the "memory" bell notes
    for k, m in enumerate([74, 78, 81, 83, 86]):
        put(y, fmbell(mtof(m), 2.4, r, tau=1.2, index=1.2), t0 + 0.14 * k, 0.4, -0.6 + 0.3 * k)
    place(y, decorrelate(sparkle(2.2, r, 60, 3000, 12000, 0.3, decay_tau=1.0), r, 1.0), ns(t0), 0.3)
    # soft heartbeat pulse under it
    for k, tb in enumerate([t0, t0 + 0.32]):
        put(y, thump(78, 45, 0.4, tp=0.05, ta=0.12), tb, 0.5 if k == 0 else 0.3, 0.0)
    place(y, stereo(circ(lambda z: bp(z, 300, 900), colored(ns(1.5), r, 1.0)) * env_pts([(0, 0), (0.6, 0.2), (1.5, 0)], ns(1.5))), ns(t0 - 0.2), 0.12)
    return trim_tail(reverb_st(y, 3.0, 0.4, 100, predelay=0.03, bright=1.1)[:ns(5.0)], -50)


def keystone_pickup():
    r = rng_for("keystone_pickup")
    dur = 6.2
    n = ns(dur)
    y = np.zeros((n, 2))
    t_peak = 3.3
    # choir chord D2 A2 D3 F#3 A3 E4 (Dadd9/lydian) swelling to the peak
    chord = [(38, "o"), (45, "o"), (50, "a"), (54, "a"), (57, "a"), (64, "a"), (66, "u"), (69, "a")]
    for k, (m, v) in enumerate(chord):
        c = choir(mtof(m), t_peak + 1.0, r, v, atk=2.6, rel=2.2, voices=4, bright=1.0 if m > 55 else 0.6)
        place(y, c, 0, 0.22)
    # upward bright stack joins late
    for m in (74, 78, 81, 86):
        place(y, choir(mtof(m), 1.4, r, "a", atk=1.2, rel=2.0, voices=3, bright=1.2), ns(2.0), 0.14)
    # rising shepard + riser noise
    place(y, stereo(shepard(ns(3.3), 3.3, 110.0, 6, "saw") * env_pts([(0, 0), (3.3, 0.5)], ns(3.3)) * 0.1), 0, 1.0)
    place(y, decorrelate(whoosh(3.3, [(0, 300), (3.2, 7000)], [(0, 0), (3.0, 0.9), (3.3, 0)], r, q=0.9, alpha=0.6), r, 1.0), 0, 0.3)
    # the release at the peak: sub + impact + bells
    place(y, stereo(thump(70, 28, 2.0, tp=0.15, ta=0.55)), ns(t_peak), 1.0)
    place(y, stereo(softclip(thump(150, 55, 0.5, tp=0.04, ta=0.14), 2)), ns(t_peak), 0.5)
    place(y, decorrelate(noise_burst(0.8, 600, 10000, r, tau=0.18), r, 1.0), ns(t_peak), 0.4)
    for k, m in enumerate([62, 66, 69, 74, 78, 81, 86, 90]):
        put(y, fmbell(mtof(m), 3.5, r, tau=1.6, index=1.4), t_peak + 0.07 * k, 0.4 / (1 + 0.04 * k), -0.7 + 0.2 * k)
    place(y, decorrelate(sparkle(3.0, r, 100, 3000, 13000, 0.3, decay_tau=1.3), r, 1.0), ns(t_peak), 0.4)
    # bittersweet colour: a quiet minor-iv (G minor, Bb) shimmer in the tail
    put(y, glass(mtof(70), 2.5, r, tau=1.5), t_peak + 1.2, 0.2, 0.3)
    put(y, glass(mtof(77), 2.5, r, tau=1.5), t_peak + 1.4, 0.15, -0.3)
    return trim_tail(reverb_st(y, 3.0, 0.3, 101)[:ns(9.0)], -50)


def item_pickup():
    r = rng_for("item_pickup")
    y = np.zeros((ns(0.8), 2))
    put(y, marimba(mtof(84), 0.6, r, tau=0.3), 0.0, 0.6, -0.15)
    put(y, marimba(mtof(88), 0.6, r, tau=0.3), 0.07, 0.6, 0.15)
    put(y, bell(mtof(91), 0.8, r, tau=0.35, amps=(1, .3)), 0.07, 0.25, 0.0)
    place(y, decorrelate(sparkle(0.5, r, 40, 4000, 11000, 0.1, decay_tau=0.2), r, 1.0), ns(0.05), 0.25)
    place(y, stereo(whoosh(0.15, [(0, 800), (0.12, 3500)], [(0, 0), (0.07, 0.4), (0.15, 0)], r, q=0.8, alpha=0.5)), 0, 0.25)
    return reverb_st(y, 0.8, 0.2, 102)[:ns(1.2)]


def build(reg):
    reg.add("echo_pickup", "pickup", [echo_pickup()], peak=-7, bus="SFX", is_mono=False, fout=0.2)
    reg.add("keystone_pickup", "pickup", [keystone_pickup()], peak=-2.5, bus="SFX", is_mono=False, fout=0.3)
    reg.add("item_pickup", "pickup", [item_pickup()], peak=-9, bus="SFX", is_mono=False, fout=0.1)
