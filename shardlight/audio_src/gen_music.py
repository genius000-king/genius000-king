"""music/: six cues synthesised from pads, plucked FM/modal kalimba+marimba, soft bells,
airy lead, sub and soft percussion.  Loops wrap their tails (circular), so they are seamless."""
from music_engine import *


def _pad_layer(mix, root, kind, bar, nbars, low, high, g, bright, rng, atk=1.2, rel=1.8, n=None, detune=9.0, hall=0.4, sub=0.0):
    for m in voice(root, kind, low, high, n):
        p = pad(mtof(m), nbars * mix.bar, rng, bright=bright, atk=atk, rel=rel, detune=detune, sub=sub)
        mix.play(p, bar, 0, g, 0, hall=hall, human=0.0)


# ------------------------------------------------------------------- verdant
def mus_verdant():
    rng = rng_for("mus_verdant")
    mix = Mix(92, 40, seed=11)
    roots = [7, 2, 4, 0, 7, 9, 11, 2]
    basepc = [7, 6, 4, 0, 7, 9, 11, 2]
    kinds = ["maj7", "maj", "m7", "maj7", "maj7", "maj", "m7", "maj"]
    A = [(0, 0, 71, 1), (0, 1, 74, 1), (0, 2, 79, 2), (1, 0, 78, 1.5), (1, 1.5, 76, .5), (1, 2, 74, 2),
         (2, 0, 76, 1), (2, 1, 79, 1), (2, 2, 83, 1), (2, 3, 81, 1), (3, 0, 79, 2), (3, 2, 76, 1), (3, 3, 74, 1)]
    B = [(0, 0, 74, 1), (0, 1, 79, 1), (0, 2, 83, 1.5), (0, 3.5, 81, .5), (1, 0, 81, 1.5), (1, 1.5, 76, .5), (1, 2, 73, 2),
         (2, 0, 74, 1), (2, 1, 78, 1), (2, 2, 81, 1), (2, 3, 78, 1), (3, 0, 76, 1), (3, 1, 74, 1), (3, 2, 78, 2)]
    for s in range(5):
        for k in range(8):
            bar = 8 * s + k
            root, kind = roots[k], kinds[k]
            # pad
            _pad_layer(mix, root, kind, bar, 1.0, 57, 76, 0.2 if s < 4 else 0.17, 0.4, rng, atk=0.5, rel=1.4, n=4, hall=0.45)
            # bass
            bpc = basepc[k]
            bm = bass_note(bpc, 31)
            pat = [(0, 0, 1.4, 1.0)] if s == 0 else [(0, 0, 1.4, 1.0), (1.5, 12, 0.4, 0.5), (2.5, 7, 0.5, 0.55), (3.5, 0, 0.4, 0.5)]
            if s == 4:
                pat = [(0, 0, 3.0, 0.8)]
            for beat, iv, d, gg in pat:
                mix.play(c_sub(bm + iv, d), bar, beat, 0.3 * gg, 0, hall=0.05)
            # kalimba arpeggio
            pool = voice(root, kind, 64, 86)
            if s == 0:
                seq = [(b, pool[i % len(pool)]) for b, i in zip([0, 1, 2, 3], [0, 2, 1, 3])]
            else:
                idx = [0, 1, 2, 3, 2, 1, 2, 3]
                seq = [(j * 0.5, pool[idx[j] % len(pool)]) for j in range(8)]
            for j, (beat, m) in enumerate(seq):
                acc = 1.0 if (beat % 1 == 0) else 0.7
                mix.play(c_kalimba(m, 1.2, 0.7), bar, beat, 0.36 * acc * (0.8 if s == 4 else 1.0), pan_=-0.45 + 0.9 * ((j % 4) / 3), hall=0.35, echo=0.28)
            if s in (1, 2, 3):                                  # soft groove
                mix.play(c_kick(), bar, 0, 0.35, hall=0.0)
                mix.play(c_kick(), bar, 2.5, 0.25, hall=0.0)
                for j in range(8):
                    mix.play(shaker(0.08, rng, 1.0), bar, j * 0.5 + 0.0, 0.1 if j % 2 else 0.05, pan_=0.3 if j % 2 else -0.3, hall=0.1)
                if s >= 2:
                    for beat in (1, 3):
                        rim = c_marimba(76, 0.15, 0.04) * 0.5
                        add(rim, click(rng, 2400, 0.004), 0.3)
                        mix.play(rim, bar, beat, 0.3, hall=0.2)
            if s in (2, 3) and k % 2 == 0:
                mix.play(c_fmbell(pool[-1] + 12, 3.0, 1.4), bar, 0, 0.17, pan_=0.4, hall=0.7)
            if s in (2, 3):                                     # marimba off-beat counter
                for j, beat in enumerate((0.5, 1.5, 2.5)):
                    mix.play(c_marimba(pool[(j + 1) % len(pool)] + 12, 0.8, 0.3), bar, beat, 0.2, pan_=0.5 - 0.5 * j, hall=0.3, echo=0.2)
    # lead
    for s in (1, 2, 3):
        lead_notes(mix, A, 8 * s, 0.42, rng, 0.15, 0.35, 0.5)
        lead_notes(mix, B, 8 * s + 4, 0.42, rng, 0.15, 0.35, 0.5)
    lead_notes(mix, A, 8 * 2, 0.22, rng, -0.3, 0.45, 0.6, transpose=12)           # octave shadow in the bridge
    lead_notes(mix, B, 8 * 3 + 4, 0.2, rng, -0.3, 0.45, 0.6, transpose=-12)
    lead_notes(mix, A, 32, 0.32, rng, 0.0, 0.5, 0.65)                                # outro: phrase A only, more echo
    out = mix.render(hall_rt=3.0, hall_mix=1.0, room_rt=0.7, seed=15, low_db=-4, high_db=4)
    return out


# ---------------------------------------------------------------------- menu
def mus_menu():
    rng = rng_for("mus_menu")
    mix = Mix(76, 32, seed=21)
    roots = [11, 7, 2, 9, 11, 7, 4, 9]
    kinds = ["m7", "maj7", "maj7", "maj", "m7", "maj7#11", "m7", "sus4"]
    M = [(0, 0, 78, 3), (0, 3, 76, 1), (1, 0, 74, 2), (1, 2, 71, 1), (1, 3, 74, 1), (2, 0, 78, 2), (2, 2, 81, 2),
         (3, 0, 81, 1), (3, 1, 76, 1), (3, 2, 73, 2), (4, 0, 74, 1), (4, 1, 78, 1), (4, 2, 81, 2),
         (5, 0, 79, 2), (5, 2, 78, 1), (5, 3, 74, 1), (6, 0, 76, 2), (6, 2, 79, 1), (6, 3, 78, 1), (7, 0, 76, 2), (7, 2, 74, 2)]
    for s in range(4):
        for k in range(8):
            bar = 8 * s + k
            root, kind = roots[k], kinds[k]
            _pad_layer(mix, root, kind, bar, 1.0, 50, 74, 0.27 if s != 3 else 0.22, 0.3, rng, atk=1.4, rel=2.2, n=4, hall=0.5)
            mix.play(c_sub(bass_note(root, 33), 3.6, 1.3), bar, 0, 0.27, hall=0.05, human=0)
            pool = voice(root, kind, 72, 92)
            if s == 0:                                              # sparse bells
                for beat in ([0] if k % 2 == 0 else [0, 2.5]):
                    mix.play(c_fmbell(pool[int(rng.integers(0, len(pool)))], 3.5, 1.8, 1.4), bar, beat, 0.24, pan_=rng.uniform(-0.6, 0.6), hall=0.7, echo=0.3, echo_beats=1.5)
            else:
                lowpool = voice(root, kind, 60, 84)
                seq = [0, 2, 1, 3] if s == 1 else [0, 1, 2, 3, 2, 1, 2, 3]
                step = 1.0 if s == 1 else 0.5
                for j, i in enumerate(seq):
                    mix.play(c_kalimba(lowpool[i % len(lowpool)], 1.6, 0.9), bar, j * step, 0.3, pan_=-0.4 + 0.8 * (j % 4) / 3, hall=0.45, echo=0.3, echo_beats=1.5)
                if k % 2 == 0:
                    mix.play(c_fmbell(pool[-1], 3.5, 1.8, 1.2), bar, 0, 0.14, pan_=0.5, hall=0.8)
            if s == 2:                                              # wonder: soft choir halo + heartbeat
                for m in voice(root, kind, 55, 74, 3):
                    mix.play(choir(mtof(m), mix.bar, rng, "a" if m > 60 else "o", atk=1.8, rel=2.5, voices=3, bright=0.5), bar, 0, 0.13, hall=0.6, human=0)
                mix.play(thump(80, 45, 0.5, tp=0.05, ta=0.14), bar, 0, 0.3, hall=0.1, human=0)
                mix.play(thump(80, 45, 0.5, tp=0.05, ta=0.14), bar, 1.5, 0.18, hall=0.1, human=0)
    lead_notes(mix, M, 8, 0.4, rng, 0.1, 0.4, 0.6, vib=16, rel=0.8)
    lead_notes(mix, M, 16, 0.42, rng, 0.0, 0.4, 0.6, vib=18, rel=0.8)
    lead_notes(mix, [(b, bt, m, d) for (b, bt, m, d) in M if b >= 4], 24, 0.32, rng, 0.1, 0.5, 0.7, vib=16, rel=1.0)
    return mix.render(hall_rt=3.8, hall_mix=1.0, seed=25, low_db=-4, high_db=3.5)


# ----------------------------------------------------------------------- hub
def mus_hub():
    rng = rng_for("mus_hub")
    mix = Mix(70, 28, seed=31)
    cyc = [(9, "add9"), (9, "add9"), (7, "add9"), (2, "sus2")]
    scale_hi = [81, 83, 85, 88, 90, 93]
    scale_lo = [57, 59, 61, 64, 66, 69, 71]
    # slow-evolving stretched texture (circular, so it loops seamlessly)
    src = np.zeros(ns(3.0))
    for k, m in enumerate([69, 76, 81, 85, 88]):
        add(src, c_glass(m, 2.8, 1.8), 0.4, 0.15 * k)
    tex = np.stack([paulstretch(src, 12, 1.4, mix.L, np.random.default_rng(3100 + c), circular=True) for c in range(2)], axis=1)
    tex /= np.std(tex) + 1e-9
    tex *= (0.55 + 0.45 * lfo(mix.L, 3, 0.1))[:, None]
    mix.dry += tex * 0.22
    mix.hall += tex * 0.10
    swell = None
    for cy in range(7):
        for k in range(4):
            bar = cy * 4 + k
            root, kind = cyc[k]
            _pad_layer(mix, root, kind, bar, 1.0, 45, 70, 0.30, 0.2 + 0.05 * (cy % 3), rng, atk=2.4, rel=3.0, n=4, detune=7.0, hall=0.55)
            mix.play(c_sub(bass_note(root, 33), 3.8, 1.2), bar, 0, 0.3, hall=0.05, human=0)
            mix.play(c_sub(bass_note(root, 33) + 7, 3.8, 1.2), bar, 0, 0.1, hall=0.05, human=0)
            if 1 <= cy <= 5:                                         # slow heartbeat
                mix.play(thump(72, 40, 0.5, tp=0.05, ta=0.14), bar, 0, 0.22, hall=0.1, human=0)
                mix.play(thump(66, 38, 0.45, tp=0.05, ta=0.12), bar, 0.75, 0.15, hall=0.1, human=0)
        # sparse bells
        for _ in range(3 + (cy % 2)):
            b = cy * 4 + int(rng.integers(0, 4))
            beat = float(rng.choice([0, 1.5, 2, 3.5]))
            m = int(rng.choice(scale_hi if rng.random() < 0.7 else scale_lo))
            mix.play(c_glass(m, 3.5, 1.6) if m > 70 else c_fmbell(m, 3.5, 1.6, 1.0), b, beat, 0.2, pan_=rng.uniform(-0.8, 0.8), hall=0.9, echo=0.4, echo_beats=1.5)
        if cy in (2, 3, 4):                                          # kalimba motif A-C#-E
            for j, m in enumerate([69, 73, 76]):
                mix.play(c_kalimba(m + 12, 1.8, 1.1), cy * 4 + 2, j * 1.5 + 0.5, 0.2, pan_=-0.3 + 0.3 * j, hall=0.7, echo=0.45, echo_beats=1.5)
        if cy in (3, 4):                                             # mysterious choir
            for m in (45, 52, 57):
                mix.play(choir(mtof(m), 3.2 * mix.bar, rng, "u", atk=3.0, rel=4.0, voices=3, bright=0.3), cy * 4, 0, 0.1, hall=0.7, human=0)
        # reversed swell leading into each cycle
        cl = np.zeros(ns(1.2))
        for m in (81, 85, 88):
            add(cl, c_glass(m, 1.2, 0.8), 0.5)
        rv = reverse(reverb_st(cl, 2.0, 1.0, 40 + cy, predelay=0.0)[:ns(2.6)])
        place(mix.dry, stereo(rv) if rv.ndim == 1 else rv, ns(mix.t(cy * 4) - 2.6), 0.12, wrap=True)
    return mix.render(hall_rt=4.5, hall_mix=1.0, seed=35, bright=0.7, damp=0.4, low_db=-4, high_db=2.5)


# ------------------------------------------------------------------- tension
@lru_cache(maxsize=None)
def c_bass_fm(m, dur=0.25):
    n = ns(dur)
    f = mtof(m)
    t = np.arange(n) / SR
    y = sweep(saw(f, n), 250 + 1100 * np.exp(-t / 0.06), 1.2, "lp")
    y = y * 0.7 + 0.8 * sine(f, n)
    return softclip(y * np.exp(-t / (dur * 0.7)), 1.6) * (1 - np.exp(-t / 0.002))


def mus_tension():
    rng = rng_for("mus_tension")
    mix = Mix(90, 40, seed=41)
    roots = [2, 10, 7, 9]
    kinds = ["madd9", "maj7", "m7", "sus4"]
    beat_n = ns(mix.spb)
    ph = (np.arange(mix.L) % beat_n) / SR
    pump_env = 1 - 0.7 * np.exp(-ph / 0.16) * (1 - np.exp(-ph / 0.004))
    padbus = np.zeros((mix.L, 2))
    for s in range(5):
        for k in range(8):
            bar = 8 * s + k
            c = k % 4
            root, kind = roots[c], kinds[c]
            for m in voice(root, kind, 50, 72, 4):
                p = pad(mtof(m), mix.bar, rng, bright=0.28 + (0.1 if s in (2, 3) else 0), atk=0.2, rel=0.6, detune=15.0, voices=3)
                place(padbus, p, ns(mix.t(bar)), 0.28 if s != 4 else 0.34, wrap=True)
            bm = bass_note(root, 38)
            pat = [1.0, 0.5, 0.7, 0.5, 0.9, 0.5, 0.75, 0.6]
            if s == 4:
                pat = [1.0, 0, 0, 0, 0.8, 0, 0, 0]
            for j, a in enumerate(pat):
                if a > 0:
                    mix.play(c_bass_fm(bm + (12 if j in (3, 7) and s != 4 else 0), 0.24), bar, j * 0.5, 0.34 * a, hall=0.05, human=0.002)
            if s != 4:
                for beat in (0, 1, 2, 3):
                    mix.play(c_kick(100, 40), bar, beat, 0.38 if beat % 2 == 0 else 0.28, hall=0.0, human=0.002)
            if s >= 1:
                for j in range(4):
                    mix.play(shaker(0.07, rng, 1.2), bar, j + 0.5, 0.16, pan_=0.3, hall=0.08, human=0.002)
                for j in range(16):                                    # "Static" glitch ticks
                    if rng.random() < 0.22:
                        t_ = bitcrush(click(rng, rng.uniform(3000, 8000), 0.002, 0.03), 4, 2)
                        mix.play(t_, bar, j * 0.25, 0.12, pan_=rng.uniform(-0.8, 0.8), hall=0.25, human=0)
                if c in (1, 3):
                    mix.play(c_glass(81, 2.0, 0.9), bar, 3.5, 0.15, pan_=-0.3, hall=0.6)
                    mix.play(c_glass(82, 2.0, 0.9), bar, 3.5, 0.13, pan_=0.3, hall=0.6)
            if s >= 2:
                for beat in (1, 3):
                    mix.play(snare_soft(0.22, rng), bar, beat, 0.32, hall=0.2, room=0.3)
                if k in (6, 7):
                    for j, (beat, m) in enumerate([(3.0, 50), (3.5, 53)] if k == 7 else [(3.5, 50)]):
                        mix.play(timpani(m, 1.2, rng), bar, beat, 0.4, hall=0.3)
    mix.dry += padbus * pump_env[:, None]
    mix.hall += padbus * 0.35
    L = [[(0, 0, 74, 1), (0, 1.5, 77, .5), (0, 2, 81, 1), (0, 3, 77, 1)],
         [(1, 0, 77, 1.5), (1, 1.5, 74, .5), (1, 2, 70, 2)],
         [(2, 0, 74, 1), (2, 1, 79, 1), (2, 2, 77, 1), (2, 3, 74, 1)],
         [(3, 0, 76, 1.5), (3, 1.5, 74, .5), (3, 2, 69, 2)]]
    motif = [n for part in L for n in part]
    for s in (2, 3):
        lead_notes(mix, motif, 8 * s, 0.34, rng, 0.0, 0.3, 0.5, vib=9, rel=0.3)
        lead_notes(mix, motif, 8 * s + 4, 0.34, rng, 0.0, 0.3, 0.5, vib=9, rel=0.3, transpose=3 if s == 3 else 0)
    lead_notes(mix, motif[:4] + motif[7:11], 32, 0.26, rng, -0.1, 0.45, 0.6, vib=9, rel=0.4, transpose=-12)
    return mix.render(hall_rt=2.4, hall_mix=0.9, room_rt=0.6, seed=45, bright=0.8, damp=0.35, low_db=-3, high_db=3)


# -------------------------------------------------------------------- reveal
def mus_reveal():
    rng = rng_for("mus_reveal")
    mix = Mix(80, 4, loop=False, tail_s=2.0, seed=51)
    bar = mix.bar
    # bar 0: unease - sub swell, dissonant cluster, reversed bell
    n0 = ns(2 * bar)
    swell = sine(env_pts([(0, 33), (2 * bar, 36)], n0), n0) * env_pts([(0, 0), (2 * bar, 0.9)], n0, 2.0)
    mix.dry += pan(np.pad(swell, (0, mix.L - n0)), 0) * 0.5
    for m in (51, 57, 62, 63):
        mix.play(pad(mtof(m), 2 * bar, rng, bright=0.2, atk=2.4, rel=0.3), 0, 0, 0.28, hall=0.5, human=0)
    cl = np.zeros(ns(1.2))
    for m in (81, 85, 88):
        add(cl, c_glass(m, 1.2, 0.8), 0.5)
    rv = reverse(reverb_st(cl, 2.2, 1.0, 51, predelay=0.0)[:ns(2.4)])
    place(mix.dry, rv, ns(2 * bar - 2.45), 0.5)
    for beat in (0, 1, 2, 2.6, 3.2):
        mix.play(thump(70, 40, 0.5, tp=0.05, ta=0.13), 0, beat, 0.30 + 0.05 * beat, hall=0.1, human=0)
    mix.play(c_glass(88, 3.0, 1.4), 0, 3, 0.12, pan_=0.3, hall=0.9, echo=0.5, echo_beats=1.0)
    # bar 1: the question - rising bell motif over a lifting cluster
    for m in (52, 58, 63, 66):
        mix.play(pad(mtof(m), bar, rng, bright=0.35, atk=0.8, rel=0.2), 1, 0, 0.26, hall=0.5, human=0)
    for j, m in enumerate([78, 81, 85, 88]):
        mix.play(c_fmbell(m, 3.0, 1.4, 1.5), 1, 0.5 + 0.75 * j, 0.3, pan_=-0.5 + 0.33 * j, hall=0.8, echo=0.35, echo_beats=1.0)
    ri = whoosh(1.0 * bar - 0.02, [(0, 400), (bar - 0.02, 8000)], [(0, 0), (bar - 0.1, 0.9), (bar - 0.02, 0.0)], rng, q=1.0, alpha=0.5)
    mix.play(decorrelate(ri, rng, 1.0), 1.0, 0, 0.30, hall=0.3, human=0)
    for beat in (0, 1, 2, 2.5, 3, 3.33, 3.66):
        mix.play(thump(74, 42, 0.5, tp=0.05, ta=0.13), 1, beat, 0.38, hall=0.1, human=0)
    # bar 2: the reveal - Dmaj9#11 blooms
    t2 = 2
    for m, v in [(38, "o"), (45, "o"), (50, "a"), (57, "a"), (66, "a"), (73, "a"), (80, "a")]:
        mix.play(choir(mtof(m), 1.5 * bar, rng, v, atk=0.5, rel=2.5, voices=4, bright=1.1), t2, 0, 0.2, hall=0.5, human=0)
    for m in (50, 57, 62, 66, 69, 73):
        mix.play(pad(mtof(m), 1.5 * bar, rng, bright=0.65, atk=0.3, rel=2.5), t2, 0, 0.18, hall=0.55, human=0)
    mix.play(stereo(thump(68, 27, 2.0, tp=0.14, ta=0.5)), t2, 0, 0.9, hall=0.1, human=0)
    mix.play(stereo(timpani(38, 2.4, rng)), t2, 0, 0.55, hall=0.3, human=0)
    mix.play(decorrelate(noise_burst(0.8, 1000, 11000, rng, tau=0.2), rng, 1.0), t2, 0, 0.25, hall=0.5, human=0)
    for j, m in enumerate([74, 78, 81, 85, 88, 92, 93]):
        mix.play(c_fmbell(m, 3.5, 1.8, 1.4), t2, 0.1 + 0.18 * j, 0.32, pan_=-0.7 + 0.23 * j, hall=0.8, echo=0.3, echo_beats=0.75)
        mix.play(c_kalimba(m - 12, 1.5, 1.0), t2, 0.1 + 0.18 * j, 0.22, pan_=-0.7 + 0.23 * j, hall=0.4)
    mix.play(decorrelate(sparkle(2.5, rng, 90, 3000, 12000, 0.3, decay_tau=1.2), rng, 1.0), t2, 0, 0.3, hall=0.4, human=0)
    # bar 3: resolution - descending bell phrase, ring-out
    for j, (beat, m, d) in enumerate([(0.5, 85, 1), (1.5, 81, 1), (2.5, 78, 3)]):
        mix.play(c_fmbell(m, 3.5, 1.8, 1.0), 3, beat, 0.3, pan_=0.3 - 0.3 * j, hall=0.8, echo=0.35, echo_beats=1.0)
    mix.play(airy_lead(mtof(78), 2.4, rng, vdepth=16, rel=1.5), 3, 1.0, 0.25, 0.0, hall=0.7)
    out = mix.render(hall_rt=3.5, hall_mix=1.0, seed=55, low_db=-3, high_db=2)
    return trim_tail(out, -55)


# ------------------------------------------------------------------ keystone
def mus_keystone():
    rng = rng_for("mus_keystone")
    mix = Mix(80, 4, loop=False, tail_s=2.5, seed=61)
    bar = mix.bar
    ch = [(2, "add9", 0), (9, "maj", 1), (7, "maj", 2), (2, "add9", 3)]
    for root, kind, b in ch:
        dur = bar if b < 3 else 1.6 * bar
        for m in voice(root, kind, 50, 72, 4):
            mix.play(pad(mtof(m), dur, rng, bright=0.5 + 0.08 * b, atk=0.35, rel=1.4 if b < 3 else 2.8), b, 0, 0.2, hall=0.5, human=0)
        for m, v in [(bass_note(root, 38), "o")] + [(mm, "a") for mm in voice(root, kind, 57, 76, 3)]:
            mix.play(choir(mtof(m), dur, rng, v, atk=0.7 if b == 0 else 0.3, rel=1.6 if b < 3 else 3.0, voices=4, bright=0.9), b, 0, 0.17 + 0.03 * b, hall=0.55, human=0)
        mix.play(c_sub(bass_note(root, 31), dur * 0.9, 1.3), b, 0, 0.5, hall=0.05, human=0)
    # bittersweet: second half of bar 2 turns to G minor (borrowed iv)
    for m in voice(7, "min", 55, 74, 3):
        mix.play(pad(mtof(m), 2 * mix.spb, rng, bright=0.45, atk=0.1, rel=1.0), 2, 2, 0.2, hall=0.5, human=0)
    mel = [(0, 0, 74, 1.5), (0, 1.5, 78, .5), (0, 2, 81, 2),
           (1, 0, 81, 1.5), (1, 1.5, 85, .5), (1, 2, 88, 2),
           (2, 0, 86, 1.5), (2, 1.5, 83, .5), (2, 2, 82, 1), (2, 3, 81, 1),
           (3, 0, 81, 1), (3, 1, 86, 3)]
    for bo, beat, m, d in mel:
        mix.play(c_fmbell(m, 3.0, 1.4, 1.5), bo, beat, 0.34, pan_=0.2, hall=0.7, echo=0.25, echo_beats=0.75)
        mix.play(airy_lead(mtof(m), d * mix.spb, rng, vdepth=15, rel=0.9), bo, beat, 0.28, 0.0, hall=0.6)
        mix.play(c_marimba(m - 12, 1.0, 0.4), bo, beat, 0.2, pan_=-0.3, hall=0.3)
    for bo in range(3):                                           # heroic timpani on each downbeat
        mix.play(timpani(50 if bo != 2 else 55, 1.8, rng), bo, 0, 0.5, hall=0.35, human=0)
        mix.play(timpani(50 if bo != 2 else 55, 1.8, rng), bo, 1.5, 0.25, hall=0.35, human=0)
    ri = whoosh(bar * 3 - 0.05, [(0, 300), (bar * 3 - 0.06, 9000)], [(0, 0), (bar * 3 - 0.3, 0.8), (bar * 3 - 0.06, 0.2)], rng, q=1.0, alpha=0.5)
    mix.play(decorrelate(ri, rng, 1.0), 0, 0, 0.2, hall=0.3, human=0)
    mix.play(stereo(thump(66, 27, 2.2, tp=0.14, ta=0.55)), 3, 0, 1.0, hall=0.1, human=0)
    mix.play(stereo(timpani(38, 2.5, rng)), 3, 0, 0.7, hall=0.3, human=0)
    mix.play(decorrelate(noise_burst(1.0, 800, 12000, rng, tau=0.25), rng, 1.0), 3, 0, 0.28, hall=0.5, human=0)
    mix.play(decorrelate(sparkle(2.6, rng, 90, 3000, 12000, 0.3, decay_tau=1.3), rng, 1.0), 3, 0, 0.3, hall=0.4, human=0)
    for j, m in enumerate([74, 78, 81, 86, 90]):
        mix.play(c_glass(m + 0, 3.0, 1.4), 3, 0.05 + 0.1 * j, 0.2, pan_=-0.5 + 0.25 * j, hall=0.8)
    out = mix.render(hall_rt=3.2, hall_mix=1.0, seed=65, low_db=-3, high_db=2)
    return trim_tail(out, -55)


TRACKS = {"mus_menu": (mus_menu, True), "mus_hub": (mus_hub, True), "mus_verdant": (mus_verdant, True),
          "mus_tension": (mus_tension, True), "mus_reveal": (mus_reveal, False), "mus_keystone": (mus_keystone, False)}
TASKS = list(TRACKS)


def build(reg, only=None):
    for name, (fn, loop) in TRACKS.items():
        if only and name != only:
            continue
        reg.add(name, "music", [fn()], loop=loop, lufs_target=-18 if loop else -17, peak=-2.5, q=0.5,
                fade_edges=not loop, fout=0.4, bus="Music", is_mono=False, ceiling=-1.8, look_ms=12)
