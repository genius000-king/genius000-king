"""Lumen — companion prism drone. Faceted crystal body, spinning ring halo, one expressive eye light (EMIT)."""
from _h import *
import h_anim

S, C = math.sin, math.cos
CY, VI, WH, DK, PK = "#7DF9E0", "#9D6BFF", "#F2F5FF", "#4B3F8F", "#FF8AD8"


def make():
    sl.reset()
    bones = [("root", (0, 0, 0), (0, 0, 0.1), None),
             ("body", (0, 0, 0.02), (0, 0, 0.55), "root"),
             ("eye", (0, -0.13, 0.3), (0, -0.2, 0.3), "body"),
             ("ring", (0, 0, 0.3), (0, 0, 0.42), "body"),
             ("fin.L", (0.14, 0.02, 0.36), (0.3, 0.03, 0.46), "body"),
             ("fin.R", (-0.14, 0.02, 0.36), (-0.3, 0.03, 0.46), "body"),
             ("tag", (0, -0.15, 0.17), (0, -0.15, 0.07), "body")]
    P = Parts()
    # crystal body: elongated hex bipyramid, flat shaded, two-band colour blocking
    secs = [(0.0, 0, 0, 0, 0), (0.1, 0.105, 0.085, 0, 0), (0.3, 0.19, 0.155, 0, 0), (0.44, 0.13, 0.105, 0, 0), (0.58, 0, 0, 0, 0)]
    body = loft("crystal", secs, 6, VI, n=2.0, smooth=False)
    flat(body)
    xform(body, (0, 0, 0), (0, 0, 30))
    facet_paint(body, lambda c, n: WH if (n.z > 0.45) else (CY if (n.y < -0.35 and c.z > 0.28) else (VI if n.z > -0.1 else "#6A57C8" if n.z > -0.55 else DK)))
    P.add(body, "body")
    # inner facet cut (second smaller crystal, offset, glitchy cyan) peeking out the back
    sh = loft("shard_back", [(0.12, 0, 0, 0, 0), (0.22, 0.09, 0.05, 0, 0.0), (0.46, 0.0, 0.0, 0, 0)], 4, PK, smooth=False)
    flat(sh)
    xform(sh, (0, 0.12, 0.05), (-20, 0, 0))
    P.add(sh, "body")
    # dark bezel for the eye (rounded plate on the front facet)
    bz = ell("bezel", (0, -0.125, 0.3), (0.105, 0.04, 0.085), 20, 12, color=DK)
    P.add(bz, "body")
    # eye: EMIT disc + pupil + highlight
    eye = [ell("eye", (0, -0.17, 0.3), (0.082, 0.02, 0.064), 24, 12, color=CY, mat="EMIT"),
           ell("pupil", (0, -0.19, 0.3), (0.034, 0.012, 0.034), 16, 8, color="#1B3B58", mat="EMIT"),
           ell("hi", (-0.03, -0.2, 0.33), (0.014, 0.006, 0.014), 8, 6, color="#FFFFFF", mat="EMIT")]
    P.add(sl.join(eye, "eye_all"), "eye")
    # brow lids (dark arcs) that the eye bone does not scale (they're on body)
    P.add(tube("lid", spline([(-0.1, -0.15, 0.36), (0.0, -0.17, 0.385), (0.1, -0.15, 0.36)], 5), [0.01] * 11, 6, DK), "body")
    # halo ring: 6 arcs with gaps + beads, EMIT
    parts = []
    for k in range(6):
        a0 = k * 60 + 6
        pts = ring_pts((0, 0, 0), 0.32, 0.32, 8, 0, a0, a0 + 44)
        parts.append(tube("arc", pts, [0.012, 0.016, 0.018, 0.018, 0.018, 0.018, 0.016, 0.014, 0.01], 8, [VI, CY][k % 2], mat="EMIT"))
        a = rad(a0 + 52)
        parts.append(ell("bead", (0.32 * math.cos(a), 0.32 * math.sin(a), 0), (0.02, 0.02, 0.02), 8, 6, color="#FFFFFF" if k % 2 == 0 else PK, mat="EMIT"))
    ringo = sl.join(parts, "ring_all")
    xform(ringo, (0, 0, 0.3), (14, 0, 0))
    P.add(ringo, "ring")
    # floating side fins (little crystal shards) with secondary motion
    for sx, nm in ((1, "fin.L"), (-1, "fin.R")):
        f = loft("fin", [(0.0, 0, 0, 0, 0), (0.08, 0.035, 0.012, 0, 0), (0.2, 0.0, 0.0, 0, 0)], 4, CY, smooth=False)
        flat(f)
        facet_paint(f, lambda c, n: WH if n.x * sx > 0.3 else CY)
        xform(f, (sx * 0.2, 0.02, 0.38), (0, sx * 55, 0))
        P.add(f, nm)
    # name tag on a short chain (LUMEN stripes)
    tg = box("tag", (0, -0.15, 0.1), (0.1, 0.012, 0.045), color="#F2F5FF", radius=0.005)
    P.add(tg, "tag")
    for i in range(5):
        P.add(box("tag_l", (-0.036 + i * 0.018, -0.158, 0.1), (0.008, 0.004, 0.026), color=DK if i % 2 == 0 else VI, radius=0.001), "tag")
    P.add(tube("chain", [(0, -0.12, 0.2), (0, -0.15, 0.125)], [0.004, 0.004], 5, "#C9D0E8"), "tag")
    return P, bones


def anims(rig):
    out = []
    # idle_hover: bob, lazy ring spin, fins flutter, eye blink
    rig.begin("idle_hover", loc=("root",), sc=("eye",))
    for i, f in enumerate(cyc(96, 12)):
        t = i / 12 * 2 * math.pi
        blink = 0.12 if i == 9 else 1.0
        rig.key(f, {"body": (4 * S(t), 3 * C(t), 5 * S(t * 0.5)), "ring": (6 * S(t), 4 * C(t), (i / 12) * 360),
                    "fin.L": (0, 14 * S(t + 1), 10 * S(t * 2)), "fin.R": (0, -14 * S(t + 1.7), -10 * S(t * 2 + 1)), "tag": (10 * S(t - 0.8), 6 * C(t), 0)},
                {"root": (0.0, 0.0, 0.06 * S(t))}, {"eye": (1, 1, blink)})
    rig.end(); out.append("idle_hover")
    # talk_pulse: pulses in scale with rhythmic eye widening and a faster halo
    rig.begin("talk_pulse", loc=("root",), sc=("body", "eye", "ring"))
    for i, f in enumerate(cyc(48, 12)):
        t = i / 12 * 2 * math.pi
        p = 0.5 + 0.5 * S(t * 3 + 0.4)
        rig.key(f, {"body": (-5 * p, 0, 5 * S(t)), "ring": (6 * S(t), 4 * C(t), (i / 12) * 720), "fin.L": (0, 18 * p, 0), "fin.R": (0, -18 * p, 0), "tag": (14 * S(t * 2), 0, 0)},
                {"root": (0, 0, 0.03 + 0.05 * p)}, {"body": (1 + 0.05 * p, 1 + 0.05 * p, 1 - 0.04 * p), "eye": (1 + 0.14 * p, 1, 1 + 0.2 * p), "ring": 1 + 0.06 * p})
    rig.end(); out.append("talk_pulse")
    # glitch: jerky offsets, squashed eye, ring flicks, body skew (non-uniform scale)
    rig.begin("glitch", loc=("root", "body", "eye"), sc=("body", "eye", "ring", "fin.L", "fin.R"))
    rng = random.Random(4)
    for i, f in enumerate(range(0, 25, 2)):
        on = i % 3 != 0
        j = lambda a: (rng.uniform(-a, a) if on else 0)
        rig.key(f, {"body": (j(10), j(10), j(25)), "ring": (j(40), j(40), j(180)), "fin.L": (0, j(40), j(30)), "fin.R": (0, j(40), j(30)), "eye": (0, 0, j(10))},
                {"root": (j(0.06), j(0.04), 0.0), "body": (j(0.05), 0, j(0.04)), "eye": (j(0.03), 0, j(0.02))},
                {"body": (1 + j(0.25), 1 + j(0.2), 1 + j(0.3)), "eye": (1 + j(0.7), 1, 0.2 if i % 4 == 1 else 1 + j(0.4)), "ring": 1 + j(0.3), "fin.L": 1 + j(0.4), "fin.R": 1 + j(0.4)})
    rig.end(const=True); out.append("glitch")
    return out


PARAMS = None


def build(man):
    P, bones = make()
    arm, body = creature_build(P, bones, "lumen", ao=0.08)
    rig = Rig(arm)
    an = anims(rig)
    entry = finish(arm, body, "lumen", rig, "character", ["hub", "verdant", "amber", "tide", "ember", "glass", "hollow", "seam"], an,
                   extra={"npc": "lumen", "floats": True}, pose=("talk_pulse", 5), manifest=man, frame=0.95)
