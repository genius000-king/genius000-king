"""Ilse — Marrow's wife. Tall, knitted shawl, glasses on a chain, flower basket."""
from humans import *
import h_anim

SKIN = "#F4BC95"
HAIR, HAIR2 = "#D8D4EC", "#B9B2DA"
SHAWL, SHAWL2, SHAWL3 = "#27A59A", "#F6E7C3", "#F2788F"
BLOUSE, SKIRT, APRON = "#F9C9D3", "#7B5FC4", "#FFF4DE"
BOOT, SOLE = "#6B3F5E", "#3D2440"
GOLD = "#F2B134"


def make():
    sl.reset()
    h = Human("ilse", 1.72, ph=0.235, leg=0.46, sw=0.112, hipw=0.058, arm=(0.17, 0.16), hand=1.75, neck=0.05, head_w=1.0, head_d=0.95,
              thick=0.8, belly=0.0, torso_w=0.95, foot=1.4, cheek=0.1, chin=0.28,
              arms={"L": ((0.2, 0.0, -0.98), (0.1, -0.1, -0.98)), "R": ((-0.18, 0.05, -0.98), (0.0, -0.8, -0.55))})
    H = h.H
    h.body(SKIN, BLOUSE, None, sleeve_t=0.78, cuff="#F2788F")
    # skirt (A-line, pleated) + apron
    zt, zb = h.z_u(0.32), h.hz - 0.285 * H
    secs = [(zt + 0.01 * H, h.rx0 * 0.62, h.ry0 * 0.62, 0, 0), (zt, h.rx0 * 0.86, h.ry0 * 0.84, 0, 0), (zt - 0.06 * H, 0.1 * H, 0.09 * H, 0, 0),
            (zb + 0.17 * H, 0.15 * H, 0.14 * H, 0, 0), (zb + 0.06 * H, 0.185 * H, 0.17 * H, 0, 0), (zb, 0.195 * H, 0.18 * H, 0, 0)]
    sk = loft("skirt", secs, 32, SKIRT)
    pleat(sk, 16, 0.06, zb, zt)
    paint_faces_fn(sk, lambda c, n: APRON if (c.y < -0.03 and abs(c.x) < 0.075 * H + (zt - c.z) * 0.14 and c.z < zt - 0.02) else (SKIRT if c.z > zb + 0.03 * H else "#5B43A0"))
    h.add(sk, ["hips", "thigh.L", "thigh.R"], 2)
    # apron waist tie + hem trim + embroidery
    h.add(loft("waist", [(zt - 0.012 * H, h.rx0 * 0.9, h.ry0 * 0.88, 0, 0), (zt + 0.012 * H, h.rx0 * 0.9, h.ry0 * 0.88, 0, 0)], 20, GOLD), ["hips", "spine"])
    for sx in (1, -1):
        h.add(tube("bow", [(sx * 0.02 * H, h.ry0 * 0.86, zt), (sx * 0.07 * H, h.ry0 * 0.9, zt - 0.03 * H), (sx * 0.09 * H, h.ry0 * 0.9, zt - 0.1 * H)],
                   [0.014 * H, 0.016 * H, 0.008 * H], 6, GOLD), ["hips"])
    for i, c in enumerate(("#F2788F", "#FFD166", "#7AE7FF")):
        x = (i - 1) * 0.06 * H
        h.add(ell("emb", (x, -0.18 * H, zb + 0.07 * H), (0.017 * H, 0.008 * H, 0.017 * H), 8, 6, color=c), ["hips", "thigh.L", "thigh.R"])
    # legs: socks + boots
    for side in ("L", "R"):
        lp = h.leg_path(side)
        h.add(limb(f"sock_{side}", lp, 0.55, 0.92, lambda t: 0.04 * H * h.thick + 0.012 * H, 3, 10, "#FBF1DC"), [f"shin.{side}"], 3)
        h.shoe(side, BOOT, SOLE, toe="#7D4B6E", shaft=BOOT, shaft_h=0.09, cuff="#F2788F")
        h.hand(side, SKIN, curl=0.9)
    # shawl: draped over the shoulders, V-dipping front and back, knit bands + rim + fringe
    shawl, rim_pts = h.draped("shawl", SHAWL, u_hi=1.04, u_side=0.8, u_front=0.34, u_back=0.12, infl=0.034, rows=8, cols=32, pw=1.6,
                              bands=[(2, SHAWL2), (3, SHAWL2), (5, SHAWL3)])
    h.add(shawl, ["chest", "spine"])
    h.add(tube("shawl_rim", rim_pts, [0.011 * H] * len(rim_pts), 6, SHAWL3, cap=False), ["chest", "spine"])
    for k in (-2, -1, 0, 1, 2):   # fringe tassels at the front tip
        x = k * 0.012 * H
        yf = -h.torso_prof(0.36, 0.03)[1] + h.torso_prof(0.36, 0.03)[2] - 0.004 * H
        h.add(tube("fringe", [(x, yf, h.z_u(0.37) + 0.008 * H), (x * 1.5, yf - 0.004 * H, h.z_u(0.37) - 0.04 * H)], [0.007 * H, 0.0035 * H], 5, SHAWL2),
              ["chest", "spine"])
    for sx in (1, -1):
        h.add(ell("shawl_cap", h.J["L" if sx > 0 else "R"]["sh"] + V((sx * 0.01, 0, 0.012 * H)), (0.064 * H, 0.06 * H, 0.054 * H), 14, 10, color=SHAWL),
              ["shoulder.L" if sx > 0 else "shoulder.R", "chest"], 3)
    # head
    h.skull(SKIN)
    h.nose(v=-0.17, size=(0.02, 0.02, 0.019), color="#F2A585", out=0.02)
    h.eyes(u=0.33, v=0.08, w=0.15, h=0.2, iris="#3F6E8C", iris_s=0.64)
    h.brow(u=0.33, v=0.34, w=0.24, ang=-0.04, arch=0.05, thick=0.03, color=HAIR2)
    h.mouth("smile", v=-0.46, w=0.16, color="#B5473F", thick=0.022)
    h.cheeks("#F58A86", u=0.55, v=-0.2, w=0.11, h=0.07)
    # hair: swept silver, bun, side curls
    hd = h.head
    hair = hair_cap(hd, HAIR, hairline=0.22, back=-0.5)
    h.add(hair, "head")
    h.add(ell("bun", hd.c + V((0, 0.55 * h.hr[1], 0.78 * h.hr[2])), (0.095 * H * 0.7,) * 3, 14, 10, color=HAIR), "head")
    h.add(ell("bun2", hd.c + V((0, 0.62 * h.hr[1], 0.8 * h.hr[2])), (0.06 * H * 0.7, 0.04 * H, 0.06 * H * 0.7), 10, 8, color=HAIR2), "head")
    h.add(tube("bunwrap", ring_pts(hd.c + V((0, 0.55 * h.hr[1], 0.78 * h.hr[2])), 0.074 * H, 0.074 * H, 16, 0)[:], [0.008 * H] * 17, 5, "#F2788F", cap=False), "head")
    for sx in (1, -1):
        pts = [hd.pt(sx * 0.92, 0.2, 0.0), hd.pt(sx * 0.97, -0.1, 0.02), hd.pt(sx * 0.93, -0.38, 0.0)]
        h.add(tube("curl", spline(pts, 4), [0.026 * H, 0.032 * H, 0.03 * H, 0.02 * H] + [0.02 * H] * 6, 8, HAIR), "head")
    # sweeping fringe over the brow
    h.add(h.head.strip("fringe", arc(0.55, 0.56, -0.7, 0.5, 0.1, 8), [0.1, 0.13, 0.13, 0.12, 0.12, 0.1, 0.09, 0.07], HAIR, 0.02, 0.05), "head")
    # glasses (round gold frames) + chain
    for sx in (1, -1):
        ring = [hd.pt(sx * 0.33 + 0.235 * math.cos(a), 0.08 + 0.28 * math.sin(a), 0.07) for a in [2 * math.pi * i / 20 for i in range(21)]]
        h.add(tube("frame", ring, [0.0085 * H] * 21, 6, GOLD, cap=False), "head")
        h.add(h.head.patch("glint", sx * 0.33 + sx * 0.17, 0.2, 0.035, 0.1, "#FFFFFF", 0.062, 0.003, rot=-sx * 35), "head")
        ear = hd.c + V((sx * h.hr[0] * 0.98, 0.0, 0.0))
        h.add(tube("temple", [tuple(hd.pt(sx * 0.58, 0.1, 0.07)), tuple(hd.pt(sx * 0.9, 0.1, 0.02)), tuple(ear + V((0, 0.02, 0.0)))], [0.007 * H] * 3, 5, GOLD), "head")
        ch = [tuple(ear + V((sx * 0.004, 0.025, -0.01))), (sx * 0.085 * H, 0.0, h.sz + 0.045 * H), (sx * 0.09 * H, -h.ry0 * 0.9, h.sz + 0.03 * H),
              (sx * 0.05 * H, -h.ry0 * 1.22, h.sz - 0.04 * H), (0, -h.ry0 * 1.28, h.sz - 0.07 * H)]
        h.add(tube("chain", spline(ch, 4), [0.0045 * H] * 17, 5, GOLD, cap=False), ["chest", "neck", "head"], 1.5)
    h.add(tube("bridge", [tuple(hd.pt(0.09, 0.14, 0.075)), tuple(hd.pt(0.0, 0.2, 0.09)), tuple(hd.pt(-0.09, 0.14, 0.075))], [0.007 * H] * 3, 5, GOLD), "head")
    # flower basket on right forearm
    j = h.J["R"]
    g = j["wr"] + j["fdir"] * h.hs * 0.55
    bc = g + V((0.0, 0.0, -0.17 * H))
    bk = lathe("basket", [(0.0, 0.0), (0.085 * H, 0.0), (0.11 * H, 0.05 * H), (0.125 * H, 0.1 * H), (0.12 * H, 0.105 * H), (0.0, 0.1 * H)], 20, "#D9A55B")
    paint_fn(bk, lambda co, n: "#B9803F" if int((co.z) / (0.025 * H)) % 2 else "#E3B56C")
    xform(bk, bc - V((0, 0, 0.02 * H)))
    rim = tube("rim", ring_pts(bc + V((0, 0, 0.08 * H)), 0.122 * H, 0.122 * H, 20), [0.012 * H] * 21, 6, "#9C6A33", cap=False)
    hp = [tuple(bc + V((-0.12 * H, 0, 0.075 * H))), tuple(bc + V((-0.09 * H, 0, 0.17 * H))), tuple(g + V((0, 0, 0.04))), tuple(bc + V((0.09 * H, 0, 0.17 * H))), tuple(bc + V((0.12 * H, 0, 0.075 * H)))]
    hnd = tube("handle", spline(hp, 4), [0.011 * H] * 17, 6, "#9C6A33")
    parts = [bk, rim, hnd]
    rng = random.Random(7)
    cols = ["#FF7AA8", "#FFD166", "#7AE7FF", "#FF8A3D", "#C79BFF", "#FFFFFF"]
    for i in range(9):
        a = 2 * math.pi * i / 9 + 0.3
        rr = 0.06 * H * (0.4 + 0.6 * ((i * 7) % 3) / 2)
        top = bc + V((math.cos(a) * rr, math.sin(a) * rr, 0.15 * H + rng.uniform(0, 0.04) * H))
        base = bc + V((math.cos(a) * rr * 0.3, math.sin(a) * rr * 0.3, 0.08 * H))
        parts.append(tube("stem", [tuple(base), tuple(top)], [0.004 * H, 0.004 * H], 5, "#4CC38A"))
        parts.append(ell("fl", top, (0.028 * H, 0.028 * H, 0.016 * H), 10, 6, color=cols[i % 6]))
        parts.append(ell("fl_c", top + V((0, -0.002, 0.01 * H)), (0.012 * H, 0.012 * H, 0.008 * H), 8, 6, color="#F7B52A" if i % 6 != 1 else "#E8643C"))
    h.add(sl.join(parts, "basket_all"), ["hand.R"], 1)
    return h


PARAMS = dict(idle_amp=0.9, talk_amp=1.0, gesture="L", wave_side="L", stride=20, arm_swing=12, bounce=0.02, lean=2, knee=28, head_tilt=-1.5)


def build(man):
    h = make()
    arm, body = h.build()
    rig = Rig(arm)
    anims = h_anim.all_anims(rig, PARAMS)
    finish(arm, body, "ilse", rig, "character", ["verdant", "amber"], anims, extra={"npc": "ilse"}, pose=("wave", 24), manifest=man, frame=0.95,
           face=((0, 0, 1.46), 0.36))
