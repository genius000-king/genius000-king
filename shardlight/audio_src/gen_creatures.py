"""creatures/: Static wisp (glitchy), Puff critter (cute)."""
from instruments import *


def stutter_gate(n, rng, lo=0.006, hi=0.05, p_on=0.6, periodic=True):
    """Random on/off gate with block lengths summing exactly to n."""
    g = np.zeros(n)
    i = 0
    on = True
    while i < n:
        m = min(n - i, ns(rng.uniform(lo, hi)))
        if i + m > n - ns(lo):
            m = n - i
        g[i:i + m] = 1.0 if (rng.random() < p_on) else 0.0
        i += m
    return g


def wisp_idle():
    dur = 2.0
    n = ns(dur)
    r = rng_for("wisp_idle_loop")
    noise = circ(lambda z: bp(z, 900, 7000, 2), colored(n, r, 0.0))
    gate = stutter_gate(n, r, 0.004, 0.06, 0.55)
    gate = circ(lambda z: lp(z, 600, 1), gate)
    stat = noise * gate
    buzz = saw(snap_freq(97.0, dur), n) * (0.5 + 0.5 * sine(snap_freq(23.0, dur), n))
    buzz = bitcrush(circ(lambda z: lp(z, 2200, 2), buzz), 5, 3)
    ring = ringmod(circ(lambda z: bp(z, 1200, 2400, 1), colored(n, r, 0.5)), snap_freq(180.0, dur)) * (0.4 + 0.6 * lfo(n, 3))
    clicks = crackle(n, 22, r, 1500, 9000, 4.0, 2.0)
    return stat * 0.55 + buzz * 0.3 + ring * 0.25 + clicks * 0.4


def wisp_attack():
    r = rng_for("wisp_attack")
    dur = 0.85
    n = ns(dur)
    f = env_pts([(0, 280), (0.6, 2200), (0.8, 2600), (0.85, 600)], n)
    y = fm(f, 1.5, env_pts([(0, 2), (0.5, 6), (0.85, 3)], n), n) * 0.7
    y += saw(f * 0.5, n) * 0.3
    gate = stutter_gate(n, r, 0.008, 0.04, 0.75)
    y = bitcrush(y * (0.35 + 0.65 * gate), 6, 2)
    y += colored(n, r, 0.0) * env_pts([(0, 0), (0.7, 0.4), (0.85, 0.7)], n) * gate * 0.3
    y += crackle(n, 80, r, 2000, 10000, 3.0) * 0.4
    y = y * env_pts([(0, 0), (0.05, 0.8), (0.7, 1.0), (0.82, 0.9), (0.85, 0)], n)
    return softclip(y, 1.4)


def wisp_hit(i):
    r = rng_for("wisp_hit", i)
    p = 2 ** r.uniform(-0.2, 0.2)
    dur = 0.4
    n = ns(dur)
    y = np.zeros(n)
    zn = ns(0.3)
    fz = 350 * p + (1800 * p - 350 * p) * np.exp(-np.arange(zn) / SR / 0.06)
    add(y, fm(fz, 1.5, 4 * np.exp(-np.arange(zn) / SR / 0.08) + 0.5, zn) * decay(zn, 0.08, 0.001), 0.7)
    add(y, noise_burst(0.2, 800, 8000, r, tau=0.05), 0.6)
    add(y, click(r, 3000, 0.003), 0.5)
    # glitch repeat of the first 45 ms, three times, crushed
    seg = y[:ns(0.045)].copy()
    for k in range(3):
        add(y, bitcrush(seg, 5, 2), 0.35 / (k + 1), 0.08 + 0.05 * k)
    return y


def wisp_death():
    r = rng_for("wisp_death")
    dur = 1.5
    n = ns(dur)
    f = env_pts([(0, 1100), (0.5, 380), (1.2, 55)], n)
    y = saw(f, n) * 0.5 + fm(f * 2, 1.0, 3.0, n) * 0.3
    # stutter slows down and gets sparser as the wisp dissolves
    gate = np.zeros(n)
    i = 0
    while i < n:
        u = i / n
        m = ns(0.01 + 0.08 * u ** 1.5)
        if r.random() < (0.85 - 0.6 * u):
            gate[i:i + m] = 1
        i += m + ns(0.004 + 0.06 * u)
    y = bitcrush(y * gate, 5, 2)
    st = colored(n, r, 0.0) * env_pts([(0, 0.2), (0.3, 0.8), (1.5, 0)], n) * (0.3 + 0.7 * gate)
    y = y * env_pts([(0, 0.9), (1.2, 0.5), (1.5, 0)], n) + 0.35 * bp(st, 600, 6000, 2)
    add(y, crackle(n, 120 * np.exp(-np.arange(n) / SR / 0.5), r, 1500, 9000, 3.0), 0.6)
    add(y, thump(120, 40, 0.5, tp=0.06, ta=0.15), 0.5, 0.0)
    add(y, sparkle(0.9, r, 30, 3500, 10000, 0.08, decay_tau=0.4), 0.18, 0.5)
    return softclip(y, 1.3)


def puff_chirp(i):
    r = rng_for("puff_chirp", i)
    dur = r.uniform(0.2, 0.32)
    n = ns(dur)
    t = np.arange(n) / SR
    u = t / dur
    base = r.uniform(900, 1500)
    kind = i % 6
    if kind == 0:      # rising chirp
        f = base * (0.8 + 0.7 * u ** 0.7)
    elif kind == 1:    # up-down
        f = base * (0.9 + 0.5 * np.sin(np.pi * u))
    elif kind == 2:    # trill
        f = base * (1.1 + 0.12 * np.sin(TAU * 26 * t))
    elif kind == 3:    # double chirp
        f = base * (0.9 + 0.5 * (u * 2 % 1))
    elif kind == 4:    # falling
        f = base * (1.5 - 0.7 * u)
    else:              # wobble up
        f = base * (0.9 + 0.5 * u + 0.08 * np.sin(TAU * 15 * t))
    y = sine(f, n) * 0.8 + 0.25 * fm(f, 2.0, 0.8, n) + 0.12 * sine(f * 2, n)
    y = formants(y, [(f.mean() * 1.2, 4, 1.0), (3200, 3, 0.4)]) * 0.5 + y * 0.6
    e = env_pts([(0, 0), (0.012, 1), (dur * 0.5, 0.8), (dur, 0)], n, 1.2)
    if kind == 3:
        e = e * (0.55 + 0.45 * np.abs(np.sin(np.pi * (u * 2))))
    return lp(y * e, 7000, 2)


def puff_bounce(i):
    r = rng_for("puff_bounce", i)
    p = 2 ** r.uniform(-0.15, 0.15)
    dur = 0.35
    n = ns(dur)
    t = np.arange(n) / SR
    f = 150 * p * (1 + 1.1 * np.exp(-t / 0.05)) * (1 + 0.12 * np.exp(-t / 0.12) * np.sin(TAU * 17 * t))
    f = f * (1 + 0.35 * np.exp(-((t - 0.07) / 0.03) ** 2))     # boing wobble up then down
    y = sine(f, n) * decay(n, 0.12, 0.003)
    y += 0.3 * sine(f * 2, n) * decay(n, 0.07)
    place(y, noise_burst(0.04, 400, 1400, r, tau=0.012), 0, 0.35)
    place(y, thump(110 * p, 60, 0.15, tp=0.02, ta=0.05), 0, 0.5)
    return lp(y, 5000)


def build(reg):
    reg.add("wisp_idle_loop", "creatures", [wisp_idle()], loop=True, lufs_target=-26, peak=-8, bus="SFX", is_mono=True, fade_edges=False)
    reg.add("wisp_attack", "creatures", [wisp_attack()], peak=-8, bus="SFX", is_mono=True, fout=0.03)
    reg.add("wisp_hit", "creatures", [wisp_hit(i) for i in range(3)], peak=-9, pitch_jitter=0.08, bus="SFX", is_mono=True, fout=0.05)
    reg.add("wisp_death", "creatures", [wisp_death()], peak=-7, bus="SFX", is_mono=True, fout=0.1)
    reg.add("puff_chirp", "creatures", [puff_chirp(i) for i in range(6)], peak=-12, pitch_jitter=0.08, bus="SFX", is_mono=True, fout=0.03)
    reg.add("puff_bounce", "creatures", [puff_bounce(i) for i in range(3)], peak=-12, pitch_jitter=0.08, bus="SFX", is_mono=True, fout=0.04)
