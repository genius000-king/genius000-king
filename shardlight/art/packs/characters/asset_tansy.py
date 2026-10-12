"""Tansy — girl, 9. Pigtails, flowing scarf (secondary-motion bones), kite string reel, pinafore."""
from humans import *
import h_anim

SKIN = "#EAA67C"
HAIR = "#C95F2E"
BLOUSE, DRESS, DRESS2 = "#FFEDB8", "#7F8CFF", "#5B66E0"
SCARF, SCARF2 = "#FF6F61", "#FFD166"
TIGHT, TIGHT2 = "#C9B6FF", "#FFFFFF"
BOOT, BOOT2 = "#FFC83D", "#E39B1F"


def make():
    sl.reset()
    H0 = 1.3
    rx0 = 0.12 * H0 * 0.92 * 0.97
    ry0 = rx0 * 0.76
    szz = H0 - 1.7 * (0.33 * H0 / 2) - 0.03 * H0
    bones = [("scarf_1", (0, ry0 * 1.1, szz - 0.02), (0, ry0 * 1.2, szz - 0.2), "chest"),
             ("scarf_2", (0, ry0 * 1.2, szz - 0.2), (0, ry0 * 1.3, szz - 0.38), "scarf_1"),
             ("scarf_3", (0, ry0 * 1.3, szz - 0.38), (0, ry0 * 1.4, szz - 0.56), "scarf_2")]
    h = Human("tansy", H0, ph=0.33, leg=0.38, sw=0.12, hipw=0.07, arm=(0.17, 0.16), hand=1.9, neck=0.03, head_w=1.08, head_d=1.0,
              thick=1.0, belly=0.1, torso_w=0.97, foot=1.7, cheek=0.2, chin=0.18, extra_bones=bones,
              arms={"L": ((0.35, 0.0, -0.93), (0.25, -0.15, -0.95)), "R": ((-0.25, 0.1, -0.96), (-0.05, -0.85, -0.5))})
    H = h.H
    h.body(SKIN, BLOUSE, None, sleeve_t=0.6, cuff="#FFF4E0")
    # pinafore: bodice + flared skirt + straps + polka dots
    bod = h.torso_loft("bodice", DRESS, u0=0.12, u1=0.66, infl=0.016, n=6)
    h.add(bod, ["hips", "spine", "chest"])
    zt, zb = h.z_u(0.2), h.hz - 0.14 * H
    secs = [(zt + 0.012 * H, h.rx0 * 0.9, h.ry0 * 0.9, 0, 0), (zt - 0.04 * H, h.rx0 * 1.06, h.ry0 * 1.04, 0, 0), (zb + 0.08 * H, 0.17 * H, 0.155 * H, 0, 0),
            (zb + 0.015 * H, 0.2 * H, 0.185 * H, 0, 0), (zb, 0.2 * H, 0.185 * H, 0, 0)]
    sk = loft("skirt", secs, 28, DRESS)
    pleat(sk, 12, 0.05, zb, zt)
    paint_faces_fn(sk, lambda c, n: DRESS2 if c.z < zb + 0.03 * H else DRESS)
    h.add(sk, ["hips", "thigh.L", "thigh.R"], 2)
    rng = random.Random(5)
    for i in range(13):
        a = rad(-170 + i * 28)
        zz = zb + 0.05 * H + (i % 3) * 0.045 * H
        rr = 0.19 * H - (0.035 * H * (zz - zb) / (0.15 * H)) * 0.0
        k = (zz - zb) / (zt - zb)
        r = (0.2 - 0.07 * k) * H
        h.add(ell("dot", (math.cos(a) * r * 1.0, math.sin(a) * r * 0.92, zz), (0.016 * H, 0.016 * H, 0.016 * H), 8, 6, color="#FFFFFF"), ["hips", "thigh.L", "thigh.R"])
    for sx in (1, -1):
        sp = [(sx * 0.055 * H, -h.ry0 * 0.85, h.z_u(0.64)), (sx * 0.075 * H, -0.0, h.sz + 0.03 * H), (sx * 0.055 * H, h.ry0 * 0.85, h.z_u(0.64))]
        h.add(tube("strap", spline(sp, 5), [0.02 * H] * 11, 8, DRESS2), ["chest", "spine"])
        h.add(ell("btn", (sx * 0.055 * H, -h.ry0 * 0.98, h.z_u(0.58)), (0.016 * H,) * 3, 10, 6, color=SCARF2), ["chest"])
    # striped tights + yellow rain boots
    for obj, _, _ in h.parts.items:
        if obj.name.startswith("leg_"):
            paint_faces_fn(obj, lambda c, n: TIGHT if int(c.z / (0.04 * H) + 50) % 2 else TIGHT2)
    for side in ("L", "R"):
        h.shoe(side, BOOT, BOOT2, toe=BOOT, shaft=BOOT, shaft_h=0.12, cuff="#FFE08A")
        h.hand(side, SKIN, curl=0.9, spread=1.2)
    # scarf: neck wrap, knot, two tails with bones
    wrap = loft("scarf_wrap", [(h.sz - 0.04 * H, 0.1 * H, 0.09 * H, 0, 0), (h.sz + 0.045 * H, 0.085 * H, 0.078 * H, 0, 0)], 20, SCARF)
    paint_faces_fn(wrap, lambda c, n: SCARF)
    h.add(wrap, ["chest", "neck"])
    h.add(loft("scarf_stripe", [(h.sz - 0.005 * H, 0.103 * H, 0.093 * H, 0, 0), (h.sz + 0.01 * H, 0.103 * H, 0.093 * H, 0, 0)], 20, SCARF2), ["chest", "neck"])
    h.add(ell("knot", (0.04 * H, -0.09 * H, h.sz - 0.01 * H), (0.03 * H, 0.026 * H, 0.03 * H), 12, 8, color=SCARF), ["chest", "neck"])
    for k, (x, ln, wd) in enumerate(((0.035 * H, 0.52 * H, 0.05 * H), (-0.045 * H, 0.34 * H, 0.045 * H))):
        n_ = 6
        secs = [(0, wd * 0.9, 0.012 * H, x, h.ry0 * 1.12)]
        for i in range(1, n_ + 1):
            t = i / n_
            secs.append((-ln * t, wd * (0.9 + 0.2 * t), 0.012 * H, x + 0.02 * H * t * (1 if k == 0 else -1), h.ry0 * (1.12 + 0.3 * t)))
        tail = loft(f"scarf_tail{k}", secs, 8, SCARF, n=2.0)
        xform(tail, (0, 0, h.sz - 0.01 * H))
        stp = ln / n_
        paint_faces_fn(tail, lambda c, n, z0=h.sz: SCARF2 if int((z0 - c.z) / (0.045 * H)) % 3 == 1 else SCARF)
        # fringe
        fr = [tube("fr", [(x + (j - 2) * 0.02 * H, h.ry0 * 1.12 + 0.3 * h.ry0, h.sz - ln - 0.0), (x + (j - 2) * 0.022 * H, h.ry0 * 1.12 + 0.32 * h.ry0, h.sz - ln - 0.035 * H)],
                   [0.006 * H, 0.003 * H], 5, SCARF2) for j in range(5)]
        h.add(sl.join([tail] + fr, f"scarf_tailj{k}"), ["scarf_1", "scarf_2", "scarf_3"][:3 if k == 0 else 2], 2.2)
    # head
    h.skull(SKIN)
    hd = h.head
    h.nose(v=-0.17, size=(0.02, 0.02, 0.019), color="#EE9A78", out=0.02)
    h.eyes(u=0.36, v=0.02, w=0.2, h=0.27, iris="#2F8A5B", iris_s=0.7)
    h.brow(u=0.37, v=0.38, w=0.26, ang=-0.1, arch=0.07, thick=0.034, color="#9A4521")
    h.mouth("smile", v=-0.45, w=0.2, color="#A63A3A", thick=0.026)
    h.add(hd.patch("tongue", 0.02, -0.57, 0.09, 0.04, "#FF7A93", 0.016, 0.006), "head")
    h.cheeks("#F58A86", u=0.6, v=-0.2, w=0.12, h=0.075)
    for sx in (1, -1):
        for (fu, fv) in ((0.46, -0.1), (0.56, -0.06), (0.52, -0.16)):
            h.add(hd.patch("frk", sx * fu, fv, 0.017, 0.017, "#B9684B", 0.02, 0.004), "head")
    h.add(hair_cap(hd, HAIR, hairline=0.5, back=-0.4, scale=1.05), "head")
    # bangs
    h.add(hd.strip("bangs", arc(0.78, 0.6, -0.78, 0.6, 0.12, 9), [0.15, 0.2, 0.22, 0.2, 0.2, 0.2, 0.22, 0.2, 0.15], HAIR, 0.02, 0.05), "head")
    # pigtails
    for sx in (1, -1):
        root = hd.pt(sx * 0.95, 0.28, 0.0)
        pts = [tuple(root), tuple(root + V((sx * 0.07 * H, 0.04 * H, -0.02 * H))), tuple(root + V((sx * 0.12 * H, 0.04 * H, -0.12 * H))),
               tuple(root + V((sx * 0.11 * H, 0.0, -0.24 * H))), tuple(root + V((sx * 0.14 * H, -0.03 * H, -0.31 * H)))]
        sp = spline(pts, 5)
        n = len(sp)
        rr = [(0.03 + 0.045 * math.sin(math.pi * (i / (n - 1)) ** 0.75)) * H + 0.004 for i in range(n)]
        rr[-1] = 0.006 * H
        h.add(tube("pigtail", sp, rr, 10, HAIR), "head")
        tie = ring_pts(V(sp[2]), 0.04 * H, 0.04 * H, 12)
        h.add(ell("tie", V(pts[1]) + V((0, -0.006 * H, 0)), (0.034 * H, 0.03 * H, 0.034 * H), 10, 6, color=SCARF2), "head")
        h.add(ell("bow_l", V(pts[1]) + V((sx * 0.03 * H, -0.01 * H, 0.03 * H)), (0.035 * H, 0.012 * H, 0.02 * H), 8, 6, color="#FF5E7E", rot=(0, sx * 30, 0)), "head")
        h.add(ell("bow_r", V(pts[1]) + V((sx * 0.03 * H, -0.01 * H, -0.03 * H)), (0.035 * H, 0.012 * H, 0.02 * H), 8, 6, color="#FF5E7E", rot=(0, -sx * 30, 0)), "head")
    # kite-string reel in right hand
    j = h.J["R"]
    g = j["wr"] + j["fdir"] * h.hs * 0.55
    sp_ = lathe("reel", [(0.0, -0.06 * H), (0.06 * H, -0.06 * H), (0.06 * H, -0.045 * H), (0.034 * H, -0.04 * H), (0.034 * H, 0.04 * H), (0.06 * H, 0.045 * H), (0.06 * H, 0.06 * H), (0.0, 0.06 * H)], 16, "#C98B4B")
    xform(sp_, (0, 0, 0), (0, 90, 0))
    parts = [sp_]
    for i in range(7):
        parts.append(tube("wind", ring_pts((0, 0, 0), 0.0, 0.0, 2), [0.005 * H, 0.005 * H, 0.005 * H], 4, "#FFFFFF") if False else
                     tube("wind", [(-0.035 * H + i * 0.0117 * H, 0.0, 0.0)] + [(-0.035 * H + i * 0.0117 * H, 0.0, 0.0)] * 0 + [(-0.035 * H + i * 0.0117 * H + 0.001, 0.0, 0.0)], [0.001] * 2, 4, "#FFFFFF"))
    parts = [sp_]
    for i in range(6):
        xx = -0.03 * H + i * 0.012 * H
        ring = [(xx, 0.037 * H * math.cos(a), 0.037 * H * math.sin(a)) for a in [2 * math.pi * k / 12 for k in range(13)]]
        parts.append(tube("wind", ring, [0.006 * H] * 13, 5, "#FFFFFF", cap=False))
    free = spline([(0.0, 0.0, -0.037 * H), (0.0, -0.03 * H, -0.1 * H), (0.0, -0.01 * H, -0.2 * H), (0.0, -0.04 * H, -0.3 * H), (0.01 * H, -0.03 * H, -0.36 * H)], 5)
    parts.append(tube("string", free, [0.004 * H] * len(free), 5, "#FFFFFF"))
    for sx in (1, -1):
        parts.append(ell("ribbon", (0.01 * H, -0.03 * H, -0.37 * H), (0.04 * H, 0.012 * H, 0.014 * H), 8, 6, color="#FF5E7E", rot=(0, sx * 35, 0)))
    reel = sl.join(parts, "reel_all")
    xform(reel, g)
    h.add(reel, ["hand.R"], 1)
    return h


PARAMS = dict(idle_amp=1.4, talk_amp=1.3, gesture="L", wave_side="L", stride=25, arm_swing=22, bounce=0.04, lean=4, knee=40, head_tilt=-2,
              sec_bones=["scarf_1", "scarf_2", "scarf_3"])


def build(man):
    h = make()
    arm, body = h.build()
    rig = Rig(arm)
    anims = h_anim.all_anims(rig, PARAMS)
    finish(arm, body, "tansy", rig, "character", ["verdant", "tide"], anims, extra={"npc": "tansy"}, pose=("walk", 6), manifest=man, frame=0.95,
           face=((0, 0, 1.05), 0.36))
