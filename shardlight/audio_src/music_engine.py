"""Tiny sequencing engine: Mix (bar/beat timeline with dry/hall/room buses, echo,
humanisation, loop-wrapping), chord voicing helpers, and cached instruments."""
from functools import lru_cache
from instruments import *

CHORDS = {
    "maj": [0, 4, 7], "min": [0, 3, 7], "maj7": [0, 4, 7, 11], "m7": [0, 3, 7, 10], "7": [0, 4, 7, 10],
    "add9": [0, 4, 7, 14], "madd9": [0, 3, 7, 14], "sus2": [0, 2, 7], "sus4": [0, 5, 7], "m9": [0, 3, 7, 10, 14],
    "maj7#11": [0, 4, 7, 11, 18], "maj9": [0, 4, 7, 11, 14], "6": [0, 4, 7, 9], "m6": [0, 3, 7, 9],
    "5": [0, 7, 12], "7sus4": [0, 5, 7, 10], "dim": [0, 3, 6], "m7b5": [0, 3, 6, 10],
}


def voice(root_pc, kind, low=55, high=76, n=None):
    """Close voicing of a chord inside [low, high)."""
    ivs = CHORDS[kind]
    notes = []
    for iv in ivs:
        pc = (root_pc + iv) % 12
        m = low + ((pc - low) % 12)
        if m >= high:
            m -= 12
        notes.append(m)
    notes = sorted(set(notes))
    return notes[:n] if n else notes


def bass_note(pc, octave_low=31):
    """MIDI note for pitch class pc in the bass register (31..42)."""
    return octave_low + ((pc - octave_low) % 12)


@lru_cache(maxsize=None)
def c_kalimba(m, dur=1.4, tau=0.8):
    return kalimba(mtof(m), dur, None, tau)


@lru_cache(maxsize=None)
def c_marimba(m, dur=1.0, tau=0.4):
    return marimba(mtof(m), dur, None, tau)


@lru_cache(maxsize=None)
def c_fmbell(m, dur=3.0, tau=1.4, index=1.6):
    return fmbell(mtof(m), dur, None, tau, index)


@lru_cache(maxsize=None)
def c_glass(m, dur=3.0, tau=1.2):
    return glass(mtof(m), dur, np.random.default_rng(int(m)), tau)


@lru_cache(maxsize=None)
def c_sub(m, dur=1.0, sat=1.6):
    return sub_bass(mtof(m), dur, 0.25, sat)


@lru_cache(maxsize=None)
def c_kick(f0=110, f1=44):
    return soft_kick(0.45, f0, f1)


def timpani(m, dur=2.0, rng=None):
    rng = rng or np.random.default_rng(int(m))
    f = mtof(m)
    n = ns(dur)
    t = np.arange(n) / SR
    fr = f * (1 + 0.35 * np.exp(-t / 0.03))
    y = sine(fr, n) * np.exp(-t / 0.9)
    y += 0.4 * sine(f * 1.5 * (1 + 0.2 * np.exp(-t / 0.03)), n) * np.exp(-t / 0.4)
    y += 0.3 * sine(f * 2.3, n) * np.exp(-t / 0.2)
    add(y, noise_burst(0.08, 200, 2500, rng, tau=0.02), 0.7)
    return y * (1 - np.exp(-t / 0.001))


def master_eq(x, low_db=-3.0, high_db=3.5, loop=True):
    """Gentle low-shelf cut / high-shelf lift so sub energy does not swamp small speakers."""
    def f(z):
        z = biq(z, "lshelf", 120, 0.7, low_db)
        return biq(z, "hshelf", 2800, 0.7, high_db)
    return circ(f, x) if loop else f(x)


class Mix:
    def __init__(self, bpm, bars, bpb=4, loop=True, tail_s=0.0, seed=1):
        self.spb = 60.0 / bpm
        self.bar = bpb * self.spb
        self.bpb = bpb
        self.bars = bars
        self.loop = loop
        self.L = ns(bars * self.bar) + (0 if loop else ns(tail_s))
        self.dry = np.zeros((self.L, 2))
        self.hall = np.zeros((self.L, 2))
        self.room = np.zeros((self.L, 2))
        self.rng = np.random.default_rng(seed)

    def t(self, bar, beat=0.0):
        return bar * self.bar + beat * self.spb

    def play(self, snd, bar, beat=0.0, g=1.0, pan_=0.0, hall=0.3, room=0.0, echo=0.0, human=0.006,
             echo_beats=0.75, lp_echo=True):
        tt = self.t(bar, beat) + (self.rng.uniform(-human, human) if human else 0.0)
        tt = max(tt, 0.0)
        s = pan(snd, pan_) if snd.ndim == 1 else snd
        w = self.loop
        place(self.dry, s, ns(tt), g, wrap=w)
        if hall:
            place(self.hall, s, ns(tt), g * hall, wrap=w)
        if room:
            place(self.room, s, ns(tt), g * room, wrap=w)
        if echo:
            for k in range(1, 4):
                d = tt + k * echo_beats * self.spb
                gg = g * echo ** k
                sk = lp(snd, 4500 / k, 1) if (lp_echo and snd.ndim == 1) else snd
                sk = pan(sk, -pan_ + (0.55 if k % 2 else -0.55)) if sk.ndim == 1 else sk
                place(self.dry, sk, ns(d), gg, wrap=w)
                if hall:
                    place(self.hall, sk, ns(d), gg * hall, wrap=w)

    def render(self, hall_rt=3.2, hall_mix=1.0, room_rt=0.7, room_mix=1.0, seed=7, bright=0.9, damp=0.45,
               low_db=-3.0, high_db=3.5):
        out = self._render(hall_rt, hall_mix, room_rt, room_mix, seed, bright, damp)
        return master_eq(out, low_db, high_db, self.loop)

    def _render(self, hall_rt, hall_mix, room_rt, room_mix, seed, bright, damp):
        ir_h = make_ir(hall_rt, damp, 0.025, seed, True, bright, lowcut=150)
        out = self.dry.copy()
        if self.loop:
            out += hall_mix * reverb_loop(self.hall, ir_h, wet=1.0, dry=0.0)
            if np.any(self.room):
                out += room_mix * reverb_loop(self.room, make_ir(room_rt, 0.5, 0.008, seed + 1, True, 1.0, lowcut=150), 1.0, 0.0)
        else:
            out += hall_mix * reverb(self.hall, ir_h, wet=1.0, dry=0.0)[:self.L]
            if np.any(self.room):
                out += room_mix * reverb(self.room, make_ir(room_rt, 0.5, 0.008, seed + 1, True, 1.0, lowcut=150), 1.0, 0.0)[:self.L]
        return out


def lead_notes(mix, notes, bar0, g=0.4, rng=None, pan_=0.1, echo=0.35, hall=0.45, vib=14, transpose=0, rel=0.5):
    """notes = [(bar_offset, beat, midi, dur_beats), ...] relative to bar0."""
    rng = rng or mix.rng
    for (bo, beat, m, d) in notes:
        snd = airy_lead(mtof(m + transpose), d * mix.spb, rng, vdepth=vib, rel=rel)
        mix.play(snd, bar0 + bo, beat, g * rng.uniform(0.92, 1.05), pan_, hall=hall, echo=echo)
