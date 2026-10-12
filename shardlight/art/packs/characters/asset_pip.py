"""Pip — boy, 7. Oversized aviator goggles, kite on back, band-aids, missing tooth."""
from humans import *
import h_anim

SKIN = "#F2B48A"
HAIR = "#7A4527"
SHIRT, STRIPE = "#FFD166", "#FF8A3D"
SHORTS = "#3E6FD0"
SNEAK, SNEAK2 = "#E8454F", "#FFF7E6"
BRASS, LEATHER = "#F2B134", "#6B3E2E"


def make():
    sl.reset()
    h = Human("pip", 1.15, ph=0.37, leg=0.34, sw=0.15, hipw=0.075, arm=(0.17, 0.16), hand=1.9, neck=0.02, head_w=1.1, head_d=1.0,
              thick=1.25, belly=0.2, torso_w=1.0, foot=1.8, cheek=0.22, chin=0.12,
              arms={"L": ((0.5, 0.0, -0.86), (0.4, -0.15, -0.9)), "R": ((-0.5, 0.0, -0.86), (-0.35, -0.2, -0.92))})
    H = h.H
    h.body(SKIN, SHIRT, SHORTS, sleeve_t=0.38, pants_len=0.5)
    for obj, _, _ in h.parts.items:
        if obj.name == "torso":
            stp = (h.z_u(1.0) - h.z_u(0.0)) / 10
            paint_faces_fn(obj, lambda c, n: STRIPE if int((c.z - h.z_u(0.0)) / stp + 50) % 2 == 0 else SHIRT)
        if obj.name.startswith("pants"):
            pass
    # shorts: cuff hem + pocket
    for side in ("L", "R"):
        lp = h.leg_path(side)
        h.add(limb(f"hem_{side}", lp, 0.46, 0.5, lambda t: 0.064 * H * h.thick + 0.012 * H * h.thick + 0.012 * H * 1.2, 1, 12, "#2F52A8"),
              [f"thigh.{side}", f"shin.{side}"], 3)
        # socks + chunky sneakers
        h.add(limb(f"sock_{side}", lp, 0.62, 0.95, lambda t: 0.038 * H * h.thick + 0.009 * H, 3, 10, "#FFF7E6"), [f"shin.{side}"], 3)
        h.shoe(side, SNEAK, "#FFF7E6", toe=SNEAK2, shaft=SNEAK, shaft_h=0.05, cuff="#C73540")
        h.hand(side, SKIN, curl=0.8, spread=1.3)
    # band-aids on knee + elbow
    for nm, cen, rot in (("knee", h.J["Rleg"]["kn"] + V((0.0, -0.056 * H, 0.0)), 0), ("elb", h.J["L"]["el"] + V((0.036 * H, 0.0, 0.0)), 0)):
        pass
    kn = h.J["Rleg"]["kn"]
    ba = box("ba_knee", (kn.x, kn.y - 0.058 * H, kn.z - 0.01), (0.07 * H, 0.01 * H, 0.03 * H), rot=(0, 0, 18), color="#F7D2A8", radius=0.004)
    h.add(ba, ["thigh.R", "shin.R"])
    h.add(box("ba_knee_pad", (kn.x, kn.y - 0.064 * H, kn.z - 0.01), (0.026 * H, 0.008 * H, 0.026 * H), rot=(0, 0, 18), color="#E3A06E", radius=0.003), ["thigh.R", "shin.R"])
    el = h.J["L"]["el"]
    h.add(box("ba_elb", (el.x + 0.036 * H, el.y - 0.01, el.z), (0.012 * H, 0.04 * H, 0.07 * H), rot=(0, 0, 0), color="#F7D2A8", radius=0.004), ["upper_arm.L", "forearm.L"])
    # head
    h.skull(SKIN)
    hd = h.head
    h.nose(v=-0.17, size=(0.02, 0.02, 0.02), color="#F0A082", out=0.02)
    h.eyes(u=0.36, v=0.0, w=0.2, h=0.27, iris="#4A2C1B", iris_s=0.68)
    h.brow(u=0.37, v=0.36, w=0.26, ang=-0.12, arch=0.06, thick=0.036, color=HAIR)
    # open grin with missing tooth
    h.add(hd.patch("mouth", 0.0, -0.46, 0.27, 0.15, "#7A2638", 0.01, 0.01, shape=lambda a, x, y: (x, y if y < 0 else y * 0.5)), "head")
    h.add(hd.patch("tongue", 0.04, -0.52, 0.12, 0.05, "#FF7A93", 0.022, 0.006), "head")
    for i, x in enumerate((-0.15, -0.05, 0.1, 0.18)):
        if i == 1:
            continue
        h.add(hd.patch("tooth", x, -0.4, 0.045, 0.045, "#FFFFFF", 0.022, 0.006), "head")
    h.add(hd.strip("smile", arc(-0.3, -0.44, 0.3, -0.44, -0.08, 8), 0.012, "#7A2638", 0.01, 0.01), "head")
    h.cheeks("#F58A86", u=0.6, v=-0.2, w=0.12, h=0.075)
    for sx in (1, -1):
        for (fu, fv) in ((0.5, -0.1), (0.62, -0.06), (0.56, 0.0)):
            h.add(hd.patch("frk", sx * fu, fv, 0.02, 0.02, "#C77B55", 0.02, 0.004), "head")
    h.add(hd.patch("ba_face", -0.52, -0.3, 0.17, 0.065, "#F7D2A8", 0.014, 0.01, rot=-24), "head")
    h.add(hd.patch("ba_face_pad", -0.52, -0.3, 0.06, 0.055, "#E3A06E", 0.026, 0.006, rot=-24), "head")
    # messy hair: cap + spikes
    h.add(hair_cap(hd, HAIR, hairline=0.45, back=-0.35, scale=1.05), "head")
    rng = random.Random(3)
    for i, (u, v, ang, ln) in enumerate(((0.0, 0.95, 0, 0.2), (0.35, 0.95, 40, 0.18), (-0.4, 0.92, -50, 0.19), (0.85, 0.5, 75, 0.16), (-0.85, 0.5, -80, 0.15),
                                         (0.0, 0.8, 5, 0.13), (-0.2, 1.0, -25, 0.16))):
        c = hd.pt(u, v, 0.0)
        o = loft("spike", [(0.0, 0.05 * H, 0.04 * H, 0, 0), (0.07 * H, 0.042 * H, 0.034 * H, 0, 0), (ln * H * 0.55, 0.0, 0.0, 0, 0)], 8, HAIR)
        n = (c - hd.c)
        n = V((n.x / h.hr[0] ** 2, n.y / h.hr[1] ** 2, n.z / h.hr[2] ** 2)).normalized()
        n = (n + V((math.sin(rad(ang)) * 0.45, 0.0, 0.0))).normalized()
        align_to(o, (0, 0, 1), n)
        xform(o, c - n * 0.01)
        h.add(o, "head")
    # aviator goggles pushed up on the forehead
    gz = 0.68
    for sx in (1, -1):
        gu = sx * 0.5
        ring = [(0.078 * H * math.cos(a), 0.0, 0.078 * H * math.sin(a)) for a in [2 * math.pi * i / 20 for i in range(21)]]
        fr = tube("gframe", ring, [0.014 * H] * 21, 8, BRASS, cap=False)
        ln_ = ell("glens", (0, -0.006 * H, 0), (0.07 * H, 0.012 * H, 0.07 * H), 20, 8, color="#8EE7FF")
        gl = ell("gglint", (-sx * 0.03 * H, -0.02 * H, 0.04 * H), (0.026 * H, 0.004 * H, 0.014 * H), 8, 6, color="#FFFFFF", rot=(0, 30 * sx, 0))
        gl2 = ell("gglint2", (sx * 0.05 * H, -0.02 * H, -0.04 * H), (0.01 * H, 0.004 * H, 0.01 * H), 8, 6, color="#FFFFFF")
        ob = sl.join([fr, ln_, gl, gl2], "goggle")
        h.on_head(ob, gu, gz, 0.1)
        h.add(ob, "head")
    h.add(tube("gbridge", [tuple(hd.pt(0.14, gz, 0.1)), tuple(hd.pt(0.0, gz + 0.03, 0.12)), tuple(hd.pt(-0.14, gz, 0.1))], [0.015 * H] * 3, 6, BRASS), "head")
    sr = math.sqrt(1 - gz * gz)
    h.add(tube("gstrap", ring_pts(hd.c, h.hr[0] * sr * 1.075, h.hr[1] * sr * 1.075, 28, h.hr[2] * gz), [0.016 * H] * 29, 6, LEATHER, cap=False), "head")
    # kite on the back (diamond, four colour panels, spars, tail) + straps
    kc = V((0.0, h.ry0 * 1.0 + 0.07 * H, h.z_u(0.5)))
    kw, kh = 0.34 * H, 0.62 * H
    top, bot, lft, rgt, ctr = (0, 0, kh * 0.62), (0, 0, -kh * 0.38), (-kw, 0, kh * 0.1), (kw, 0, kh * 0.1), (0, 0, kh * 0.1)
    parts = []
    for nm, tri, c in (("k1", (ctr, top, rgt), "#FF5E7E"), ("k2", (ctr, rgt, bot), "#FFD166"), ("k3", (ctr, bot, lft), "#4FD6C8"), ("k4", (ctr, lft, top), "#9D6BFF")):
        p = bm_poly(nm, list(tri), [(0, 1, 2)], c)
        solid(p, 0.012 * H)
        parts.append(p)
    parts.append(tube("spar1", [(0, -0.012 * H, kh * 0.62), (0, -0.012 * H, -kh * 0.38)], [0.008 * H] * 2, 6, "#C9A66B"))
    parts.append(tube("spar2", [(-kw, -0.012 * H, kh * 0.1), (kw, -0.012 * H, kh * 0.1)], [0.008 * H] * 2, 6, "#C9A66B"))
    edge = [top, rgt, bot, lft, top]
    parts.append(tube("kedge", [(x, -0.008 * H, z) for x, _, z in edge], [0.007 * H] * 5, 6, "#FFF7E6", cap=False))
    tail = spline([(0, 0, -kh * 0.38), (0.04 * H, 0, -kh * 0.52), (-0.04 * H, 0, -kh * 0.66), (0.03 * H, 0, -kh * 0.8)], 5)
    parts.append(tube("ktail", tail, [0.006 * H] * len(tail), 5, "#FFF7E6"))
    for i, (z, c) in enumerate(((-0.5, "#FF5E7E"), (-0.62, "#4FD6C8"), (-0.76, "#FFD166"))):
        for sx in (1, -1):
            parts.append(bm_poly("kbow", [(0, 0, 0), (sx * 0.05 * H, 0, 0.03 * H), (sx * 0.05 * H, 0, -0.03 * H)], [(0, 1, 2)], c))
            solid(parts[-1], 0.008 * H)
            xform(parts[-1], ((0.04 * H if i % 2 == 0 else -0.04 * H) * 0.5 * (1 if i != 1 else -1), 0, kh * z))
    kite = sl.join(parts, "kite")
    xform(kite, kc, (-12, 0, 6))
    h.add(kite, ["chest", "spine"], 1)
    for sx in (1, -1):
        sp = [(sx * 0.05 * H, h.ry0 * 0.8, h.sz + 0.04 * H), (sx * 0.1 * H, 0.0, h.sz + 0.065 * H), (sx * 0.085 * H, -h.ry0 * 0.85, h.z_u(0.78)),
              (sx * 0.06 * H, -h.ry0 * 1.0, h.z_u(0.45))]
        h.add(tube("kstrap", spline(sp, 4), [0.012 * H] * 13, 6, LEATHER), ["chest", "spine"])
    h.add(ell("kbuckle", (0, -h.ry0 * 1.05, h.z_u(0.6)), (0.03 * H, 0.01 * H, 0.022 * H), 10, 6, color=BRASS), ["chest"])
    return h


PARAMS = dict(idle_amp=1.6, talk_amp=1.4, gesture="R", wave_side="R", stride=26, arm_swing=26, bounce=0.045, lean=5, knee=44, head_tilt=2)


def build(man):
    h = make()
    arm, body = h.build()
    rig = Rig(arm)
    anims = h_anim.all_anims(rig, PARAMS)
    finish(arm, body, "pip", rig, "character", ["verdant", "tide"], anims, extra={"npc": "pip"}, pose=("wave", 24), manifest=man, frame=0.95,
           face=((0, 0, 0.92), 0.34))
