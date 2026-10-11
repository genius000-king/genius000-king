"""ui/: soft, marimba/kalimba-flavoured interface sounds (stereo)."""
from instruments import *


def _st(y, r, amt=0.35):
    return decorrelate(y, r, amt)


def hover():
    r = rng_for("hover")
    y = np.zeros(ns(0.14))
    add(y, kalimba(1975.5, 0.14, r, tau=0.05, bright=0.4), 0.7)
    add(y, noise_burst(0.02, 3000, 9000, r, tau=0.004), 0.12)
    return _st(y, r, 0.3)


def click_():
    r = rng_for("click")
    y = np.zeros(ns(0.14))
    add(y, marimba(1318.5, 0.14, r, tau=0.04), 0.7)
    add(y, click(r, 3500, 0.003), 0.5)
    add(y, thump(220, 150, 0.06, tp=0.01, ta=0.02), 0.25)
    return _st(y, r, 0.3)


def open_():
    r = rng_for("open")
    y = np.zeros((ns(0.7), 2))
    put(y, kalimba(783.99, 0.6, r, tau=0.3), 0.0, 0.5, -0.2)
    put(y, kalimba(1174.7, 0.6, r, tau=0.3), 0.07, 0.5, 0.2)
    put(y, whoosh(0.3, [(0, 900), (0.25, 3200)], [(0, 0), (0.12, 0.4), (0.3, 0)], r, q=0.8, alpha=0.5), 0, 0.28)
    return reverb_st(y, 0.5, 0.15, 90)[:ns(0.8)]


def close_():
    r = rng_for("close")
    y = np.zeros((ns(0.6), 2))
    put(y, kalimba(1174.7, 0.5, r, tau=0.25), 0.0, 0.45, 0.2)
    put(y, kalimba(783.99, 0.5, r, tau=0.25), 0.07, 0.45, -0.2)
    put(y, whoosh(0.28, [(0, 3000), (0.25, 800)], [(0, 0), (0.06, 0.4), (0.28, 0)], r, q=0.8, alpha=0.5), 0, 0.25)
    return reverb_st(y, 0.4, 0.12, 91)[:ns(0.7)]


def confirm():
    r = rng_for("confirm")
    y = np.zeros((ns(0.9), 2))
    put(y, marimba(783.99, 0.5, r, tau=0.3), 0.0, 0.55, -0.2)
    put(y, marimba(1174.7, 0.7, r, tau=0.4), 0.09, 0.6, 0.2)
    put(y, bell(2349.3, 0.8, r, tau=0.4, amps=(1, .3)), 0.09, 0.15, 0.3)
    put(y, kalimba(2349.3, 0.4, r, tau=0.2), 0.09, 0.2, 0.3)
    return reverb_st(y, 0.7, 0.2, 92)[:ns(1.1)]


def back():
    r = rng_for("back")
    y = np.zeros((ns(0.6), 2))
    put(y, marimba(880.0, 0.4, r, tau=0.2), 0.0, 0.5, 0.2)
    put(y, marimba(587.33, 0.5, r, tau=0.3), 0.08, 0.55, -0.2)
    return reverb_st(y, 0.4, 0.12, 93)[:ns(0.7)]


def journal_page():
    r = rng_for("journal_page")
    n = ns(0.7)
    y = np.zeros(n)
    for o, d, g in [(0.0, 0.18, 1.0), (0.14, 0.2, 0.7), (0.3, 0.25, 0.5)]:
        m = ns(d)
        x = bp(colored(m, r, 0.4), 1800, 8000, 2)
        x *= np.abs(lp(r.standard_normal(m), 90)) / 0.1 * np.sin(np.linspace(0, np.pi, m)) ** 1.5
        add(y, x, g, o)
    add(y, crackle(n, 120, r, 2500, 9000, 1.5) * np.hanning(n), 0.25)
    add(y, thump(160, 90, 0.1, tp=0.02, ta=0.03), 0.18, 0.28)
    return reverb_st(decorrelate(y, r, 0.8), 0.35, 0.12, 94)[:ns(0.8)]


def notify():
    r = rng_for("notify")
    y = np.zeros((ns(1.4), 2))
    put(y, fmbell(1760.0, 1.2, r, tau=0.6, index=1.2), 0.0, 0.5, -0.15)
    put(y, fmbell(2637.0, 1.2, r, tau=0.7, index=1.0), 0.14, 0.45, 0.15)
    put(y, kalimba(1760.0, 0.5, r, tau=0.2), 0, 0.2, -0.15)
    return reverb_st(y, 1.1, 0.25, 95)[:ns(1.6)]


def quest_complete():
    r = rng_for("quest_complete")
    n = ns(3.0)
    y = np.zeros((n, 2))
    for k, m in enumerate([67, 71, 74, 78, 79, 83]):    # G major(lydian) arpeggio
        put(y, fmbell(mtof(m + 12), 2.2, r, tau=1.0, index=1.5), 0.12 * k, 0.4, -0.4 + 0.16 * k)
        put(y, marimba(mtof(m), 1.0, r), 0.12 * k, 0.35, -0.4 + 0.16 * k)
    for m in (43, 55, 59, 62, 66):
        place(y, pad(mtof(m), 1.6, r, bright=0.5, atk=0.25, rel=1.8), ns(0.55), 0.25)
    place(y, decorrelate(sparkle(2.0, r, 40, 3500, 11000, 0.25, decay_tau=0.8), r, 1.0), ns(0.6), 0.28)
    put(y, thump(100, 50, 0.5, tp=0.05, ta=0.15), 0.55, 0.35)
    return trim_tail(reverb_st(y, 1.8, 0.26, 96)[:ns(4.2)], -50)


def typewriter(i):
    r = rng_for("typewriter", i)
    notes = [72, 74, 76, 79, 81, 84]
    f = mtof(notes[i % 6]) * 2 ** r.uniform(-0.01, 0.01)
    y = np.zeros(ns(0.09))
    add(y, marimba(f, 0.09, r, tau=0.02), 0.7)
    add(y, click(r, 4000, 0.002, 0.03), 0.18)
    return pan(y, r.uniform(-0.15, 0.15))


def build(reg):
    kw = dict(bus="UI", is_mono=False)
    reg.add("hover", "ui", [hover()], peak=-20, **kw)
    reg.add("click", "ui", [click_()], peak=-14, **kw)
    reg.add("open", "ui", [open_()], peak=-14, **kw)
    reg.add("close", "ui", [close_()], peak=-15, **kw)
    reg.add("confirm", "ui", [confirm()], peak=-11, **kw)
    reg.add("back", "ui", [back()], peak=-15, **kw)
    reg.add("journal_page", "ui", [journal_page()], peak=-16, **kw)
    reg.add("notify", "ui", [notify()], peak=-12, **kw)
    reg.add("quest_complete", "ui", [quest_complete()], peak=-8, **kw)
    reg.add("typewriter", "ui", [typewriter(i) for i in range(6)], peak=-24, pitch_jitter=0.03, fin=0.0005, fout=0.02, **kw)
