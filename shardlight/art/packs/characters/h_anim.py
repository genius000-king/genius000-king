"""Shared humanoid animation set: idle, talk, wave, walk. Per-character personality via params dict."""
from _h import *

S = math.sin
C = math.cos


def idle(rig, p):
    rig.begin("idle")
    amp = p.get("idle_amp", 1.0)
    for i, f in enumerate(cyc(72, 8)):
        t = i / 8 * 2 * math.pi
        br = S(t)
        sh = S(t * 0.5)
        r = {
            "hips": (0, 0, 2.0 * sh * amp), "spine": (1.4 * br * amp, 0, -1.2 * sh * amp),
            "chest": (1.6 * br * amp, 0, -0.8 * sh * amp), "neck": (-1.0 * br * amp, 0, 0.0),
            "head": (-1.2 * br * amp + p.get("head_tilt", 0), 0, 2.5 * sh * amp),
            "shoulder.L": (0, 0, -1.8 * br * amp), "shoulder.R": (0, 0, 1.8 * br * amp),
            "upper_arm.L": (-2 * br * amp, p.get("arm_rest_y", 0) * -1, 0),
            "upper_arm.R": (-2 * br * amp, p.get("arm_rest_y", 0), 0),
            "forearm.L": (-3 * br * amp, 0, 0), "forearm.R": (-3 * br * amp, 0, 0),
            "thigh.L": (-1.0 * sh * amp, 0, 0), "thigh.R": (1.0 * sh * amp, 0, 0),
        }
        r.update(p.get("idle_extra", lambda t: {})(t))
        r.update(sec(rig, p, t, 0.6))
        rig.key(f, r, {"root": (0.006 * sh * amp, 0, -0.004 * (br * 0.5 + 0.5) * amp)})
    rig.end()


def sec(rig, p, t, k=1.0, lag=0.5):
    """secondary motion for optional extra bones (scarf tails, ties...)."""
    out = {}
    for name in p.get("sec_bones", []):
        n = int(name.split("_")[-1]) if name[-1].isdigit() else 0
        out[name] = (k * 9 * S(t - lag * (n + 1)), 0, k * 6 * C(t * 0.7 - lag * (n + 1)))
    return out


def talk(rig, p):
    rig.begin("talk")
    g = p.get("talk_amp", 1.0)
    ug = p.get("gesture", "L")   # gesturing arm
    for i, f in enumerate(cyc(72, 6)):
        t = i / 6 * 2 * math.pi
        a, b = S(t), S(t * 2 + 0.7)
        up, fo = ("L", "R") if ug == "L" else ("R", "L")
        sx = 1 if up == "L" else -1
        r = {
            "head": (-2 + 4.5 * b * g, 5 * a * g, 3 * S(t + 1) * g), "neck": (2.0 * b * g, 2 * a * g, 0),
            "chest": (1.2 * b * g, 0, 4 * a * g), "spine": (1.0 * b * g, 0, 2 * a * g), "hips": (0, 0, -2.5 * a * g),
            f"upper_arm.{up}": (-20 - 14 * b * g, -sx * (12 + 6 * a * g), 0),
            f"forearm.{up}": (-70 - 22 * b * g, 0, 10 * a * g * sx),
            f"hand.{up}": (0, 0, 18 * a * g),
            f"upper_arm.{fo}": (-3, 0, 0), f"forearm.{fo}": (-10 - 6 * a * g, 0, 0),
            "shoulder.L": (0, 0, -1.5 * b), "shoulder.R": (0, 0, 1.5 * b),
        }
        r.update(sec(rig, p, t, 0.8))
        rig.key(f, r, {"root": (0, 0, 0.006 * b * g)})
    rig.end()


def wave(rig, p):
    rig.begin("wave")
    side = p.get("wave_side", "R")
    sg = 1 if side == "R" else -1      # +Y rotation lifts the R (-X) arm, -Y lifts the L arm
    other = "L" if side == "R" else "R"
    keys = [0, 6, 12, 18, 24, 30, 36, 42, 48]
    for i, f in enumerate(keys):
        e = min(1.0, i / 2.0, (len(keys) - 1 - i) / 2.0)
        e = e * e * (3 - 2 * e)
        w = S(i * math.pi * 0.9)          # wave oscillation
        r = {
            f"upper_arm.{side}": (-12 * e, sg * 105 * e, 0),
            f"forearm.{side}": (0, sg * (62 + 22 * w) * e, 0),
            f"hand.{side}": (0, sg * 14 * w * e, 0),
            "chest": (0, 0, 3 * sg * e), "head": (-3 * e, -sg * 6 * e, 4 * sg * e),
            f"shoulder.{side}": (0, 0, sg * 5 * e),
            f"upper_arm.{other}": (-4, 0, 0),
        }
        r.update(p.get("wave_extra", lambda e: {})(e))
        rig.key(f, r, {"root": (0, 0, 0.005 * e * abs(w))})
    rig.end()


def walk(rig, p):
    rig.begin("walk")
    st, asw, bob, lean, kn = p.get("stride", 24), p.get("arm_swing", 18), p.get("bounce", 0.025), p.get("lean", 3), p.get("knee", 36)
    steps = 8
    for i in range(steps + 1):
        f = round(32 * i / steps)
        ph = i / steps * 2 * math.pi
        s_, c_ = S(ph), C(ph)
        thL, thR = -st * s_, st * s_
        kL = 6 + kn * max(0.0, c_)
        kR = 6 + kn * max(0.0, -c_)
        r = {
            "hips": (0, 0, 7 * s_), "spine": (lean, 0, -3 * s_), "chest": (lean * 0.4, 0, -5 * s_),
            "neck": (-lean * 0.5, 0, 2 * s_), "head": (-lean * 0.3, 0, 2 * s_),
            "thigh.L": (thL, 0, 0), "thigh.R": (thR, 0, 0), "shin.L": (kL, 0, 0), "shin.R": (kR, 0, 0),
            "foot.L": (-(thL + kL) * 0.85, 0, 0), "foot.R": (-(thR + kR) * 0.85, 0, 0),
            "upper_arm.L": (asw * s_, 0, 0), "upper_arm.R": (-asw * s_, 0, 0),
            "forearm.L": (-12 - asw * 0.5 * max(0, -s_) , 0, 0), "forearm.R": (-12 - asw * 0.5 * max(0, s_), 0, 0),
        }
        r.update(p.get("walk_extra", lambda ph: {})(ph))
        r.update(sec(rig, p, ph, 1.6))
        rig.key(f, r, {"root": (0.008 * s_, 0, bob * C(2 * ph) * 0.5 - bob * 0.25)})
    rig.end()


def all_anims(rig, p):
    idle(rig, p)
    talk(rig, p)
    wave(rig, p)
    walk(rig, p)
    return ["idle", "talk", "wave", "walk"]
