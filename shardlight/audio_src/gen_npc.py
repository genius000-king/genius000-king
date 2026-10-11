"""npc/: short vowel-ish formant blips for dialogue text (soft, Animal-Crossing-like)."""
from instruments import *

VOWEL_KEYS = ["a", "e", "i", "o", "u"]


def blip(kind, i):
    r = rng_for(f"talk_blip_{kind}", i)
    dur = r.uniform(0.085, 0.13)
    n = ns(dur + 0.03)
    base = {"low": 138.0, "mid": 247.0, "high": 415.0, "robot": 233.0}[kind]
    size = {"low": 0.86, "mid": 1.0, "high": 1.18, "robot": 1.0}[kind]
    f0 = base * 2 ** r.uniform(-0.18, 0.2)
    t = np.arange(n) / SR
    contour = r.choice([-1, 1]) * r.uniform(0.04, 0.12)
    f = f0 * (1 + contour * np.clip(t / dur, 0, 1)) * (1 + 0.012 * np.sin(TAU * 7 * t))
    if kind == "robot":
        steps = np.floor(np.clip(t / dur, 0, 1) * 3) / 3
        f = f0 * (1 + r.choice([-1, 1]) * 0.25 * steps)
        src = square(f, n, 0.35) * 0.7 + saw(f * 1.5, n) * 0.25
        src = ringmod(src, 90.0 + 30 * i % 60) * 0.6 + src * 0.4
    else:
        src = saw(f, n) + 0.3 * saw(f * 0.5, n) * (kind == "low")
    v1 = VOWEL_KEYS[int(r.integers(0, 5))]
    v2 = VOWEL_KEYS[int(r.integers(0, 5))]
    F1, F2 = np.array(VOWELS[v1]) * size, np.array(VOWELS[v2]) * size
    # vowel glide: two parallel formant banks crossfaded over the blip
    spec1 = [(F1[0], 6, 1.0), (F1[1], 8, 0.6), (F1[2], 10, 0.25)]
    spec2 = [(F2[0], 6, 1.0), (F2[1], 8, 0.6), (F2[2], 10, 0.25)]
    x = np.linspace(0, 1, n)
    y = formants(src, spec1) * (1 - x) + formants(src, spec2) * x
    y += 0.05 * bp(r.standard_normal(n), 2500, 6000, 1)             # breath
    if kind == "robot":
        y = bitcrush(y / (np.max(np.abs(y)) + 1e-9), 6, 2)
        y = bp(y, 300, 4200, 2)
        y += 0.15 * sine(env_pts([(0, 1500), (0.03, 2400)], n), n) * decay(n, 0.02)
    e = env_pts([(0, 0), (0.012, 1), (dur * 0.55, 0.85), (dur, 0.0)], n, 1.3)
    y = lp(y * e, 4800 if kind != "robot" else 5500, 2)
    return y


def build(reg):
    for kind in ("low", "mid", "high", "robot"):
        reg.add(f"talk_blip_{kind}", "npc", [blip(kind, i) for i in range(8)], peak=-18, pitch_jitter=0.05,
                bus="Voice", is_mono=True, level_jitter_db=1.0, fin=0.001, fout=0.012)
