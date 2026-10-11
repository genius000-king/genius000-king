"""Synth instruments shared by music, stings and UI (all built from toolkit/recipes)."""
from recipes import *

VOWELS = {  # F1, F2, F3 (Hz) for a bright "ah/eh/ee/oh/oo" set
    "a": (800, 1200, 2800), "e": (500, 1900, 2600), "i": (300, 2300, 3000),
    "o": (450, 800, 2800), "u": (325, 700, 2500),
}


def kalimba(f, dur=1.6, rng=None, tau=0.9, bright=1.0):
    """Tine pluck: fundamental + inharmonic metallic partials + thumb tick."""
    rng = rng or np.random.default_rng(int(f))
    n = ns(dur)
    y = modal([f, f * 2.01, f * 5.4, f * 8.2 * (1 if bright > 0.5 else 0.5)],
              [1.0, 0.10, 0.30 * bright, 0.09 * bright],
              [tau, tau * 0.5, tau * 0.10, tau * 0.05], n, rng=rng)
    tick = noise_burst(0.02, 2000, 7000, rng, tau=0.004) * 0.12 * bright
    y[:len(tick)] += tick
    return y * (1 - np.exp(-np.arange(n) / SR / 0.0006))


def marimba(f, dur=1.2, rng=None, tau=0.45):
    rng = rng or np.random.default_rng(int(f))
    n = ns(dur)
    y = modal([f, f * 3.98, f * 9.9], [1.0, 0.33, 0.1], [tau, tau * 0.25, tau * 0.1], n, rng=rng)
    y += fm(f, 1.0, 1.5 * np.exp(-np.arange(n) / SR / 0.05), n) * 0.2 * decay(n, tau * 0.6)
    return y * (1 - np.exp(-np.arange(n) / SR / 0.0008))


def fmbell(f, dur=2.5, rng=None, tau=1.4, index=2.0):
    n = ns(dur)
    t = np.arange(n) / SR
    y = fm(f, 3.5, index * np.exp(-t / (tau * 0.3)), n) * np.exp(-t / tau)
    y += 0.25 * fm(f * 2, 1.4, 1.0 * np.exp(-t / 0.2), n) * np.exp(-t / (tau * 0.5))
    return y * (1 - np.exp(-t / 0.0007))


def pad(f, dur, rng, bright=0.5, voices=3, detune=9.0, atk=1.2, rel=1.8, spread=0.8, sub=0.0):
    """Warm detuned-saw pad, stereo. Length dur + rel."""
    n = ns(dur + rel)
    L = np.zeros(n); R = np.zeros(n)
    for v in range(voices):
        cents = (v - (voices - 1) / 2) * detune / max(1, (voices - 1) / 2) + rng.uniform(-1.5, 1.5)
        s = saw(f * 2 ** (cents / 1200), n, rng.uniform(0, 1))
        pn = (v / max(1, voices - 1) * 2 - 1) * spread
        a = (pn + 1) * np.pi / 4
        L += s * np.cos(a); R += s * np.sin(a)
    cutoff = min(900 + 5200 * bright, 14000)
    e = adsr(n, atk, 0.4, 0.85, rel, hold=dur - atk - 0.4 if dur > atk + 0.4 else 0.0)
    out = np.stack([lp(L, cutoff, 2), lp(R, cutoff, 2)], axis=1) * e[:, None] / voices
    if sub:
        out += sine(f / 2, n)[:, None] * e[:, None] * sub
    return out


def airy_lead(f, dur, rng, vib=5.0, vdepth=14, breath_amt=0.10, atk=0.06, rel=0.4):
    n = ns(dur + rel)
    fv = vibrato(f, n, vib, vdepth, delay=0.25)
    y = tri(fv, n) * 0.6 + sine(fv, n) * 0.5 + sine(fv * 2, n) * 0.12
    br = bp(rng.standard_normal(n), f * 2, f * 6, 1) * breath_amt
    e = adsr(n, atk, 0.2, 0.8, rel, hold=max(0.0, dur - atk - 0.2))
    return lp(y + br, 5000) * e


def sub_bass(f, dur, rel=0.3, sat=1.6):
    n = ns(dur + rel)
    y = sine(f, n) + 0.3 * sine(f * 2, n)
    e = adsr(n, 0.01, 0.1, 0.85, rel, hold=max(0.0, dur - 0.11))
    return softclip(y * 0.8, sat) * e


def choir(f, dur, rng, vowel="a", atk=1.5, rel=2.0, voices=4, vib=5.3, bright=1.0):
    """Choral synth: detuned saws + vowel formants + vibrato. Stereo."""
    n = ns(dur + rel)
    F = VOWELS[vowel]
    L = np.zeros(n); R = np.zeros(n)
    for v in range(voices):
        ff = f * 2 ** (rng.uniform(-9, 9) / 1200)
        fv = vibrato(ff, n, vib * rng.uniform(0.9, 1.1), rng.uniform(10, 22), delay=0.2)
        s = saw(fv, n, rng.uniform(0, 1)) + 0.4 * saw(fv * 1.003, n)
        a = (rng.uniform(-0.9, 0.9) + 1) * np.pi / 4
        L += s * np.cos(a); R += s * np.sin(a)
    spec = [(F[0], 7, 1.0), (F[1], 9, 0.7 * bright), (F[2], 11, 0.35 * bright), (3500, 5, 0.12 * bright)]
    e = adsr(n, atk, 0.5, 0.9, rel, hold=max(0.0, dur - atk - 0.5))
    ch = np.stack([formants(L, spec), formants(R, spec)], axis=1)
    return ch * e[:, None] / voices * 0.7


def soft_kick(dur=0.4, f0=110, f1=45):
    n = ns(dur)
    y = thump(f0, f1, dur, tp=0.035, ta=0.15)
    return softclip(y * 1.3, 1.5)


def shaker(dur=0.09, rng=None, bright=1.0):
    rng = rng or np.random.default_rng(3)
    n = ns(dur)
    x = hp(rng.standard_normal(n), 5500 * bright, 2) * env_pts([(0, 0), (0.012, 1), (dur, 0)], n, 2.0)
    return x


def soft_tick(rng, f=3200, dur=0.06):
    return click(rng, f, 0.004, dur)


def snare_soft(dur=0.25, rng=None):
    rng = rng or np.random.default_rng(5)
    n = ns(dur)
    y = noise_burst(dur, 1800, 9000, rng, tau=0.05) * 0.7
    y += thump(210, 150, dur, tp=0.02, ta=0.05) * 0.5
    return y


def put(buf, snd, t_s, gain=1.0, pan_=0.0, wrap=True):
    """Place mono/stereo sound into a stereo buffer at t_s seconds with pan."""
    s = snd
    if s.ndim == 1:
        s = pan(s, pan_)
    place(buf, s, ns(t_s), gain, wrap=wrap)
