"""Old Marrow — gardener. Round belly, big white handlebar mustache, straw hat, overalls, gloves, shears on belt."""
from humans import *
import h_anim

SKIN, SHADE = "#EDA777", "#D88A66"
WHITE, DENIM, DENIM2 = "#F6F2E8", "#3F73C0", "#2F5799"
SHIRT = "#E9694F"
GLOVE, GLOVE2 = "#9BCB3C", "#6FA32B"
BOOT, SOLE = "#8A5230", "#4A2E24"
STRAW, STRAW2, BAND = "#F5C95A", "#D9A53D", "#D6455D"
BRASS = "#F2B134"


def make():
    sl.reset()
    h = Human("marrow", 1.5, ph=0.30, leg=0.38, sw=0.15, hipw=0.07, arm=(0.17, 0.15), hand=1.9, neck=0.03,
              head_w=1.12, head_d=1.0, thick=1.3, belly=0.7, torso_w=1.0, foot=1.35, cheek=0.16, chin=0.1,
              arms={"L": ((0.42, 0, -0.9), (0.18, -0.25, -0.95)), "R": ((-0.42, 0, -0.9), (-0.18, -0.25, -0.95))})
    H = h.H
    h.body(SKIN, SHIRT, DENIM, sleeve_t=0.6, cuff="#F7E3B5", pants_len=0.9)
    # overall bib + straps
    bib = h.torso_loft("overall", DENIM, u0=0.0, u1=0.8, infl=0.016, n=9)
    h.add(bib, ["hips", "spine", "chest"])
    h.add(h.torso_loft("overall_rim", DENIM2, u0=0.78, u1=0.82, infl=0.022, n=1, poles=False), ["spine", "chest"])
    for sx in (1, -1):
        zb = h.z_u(0.8)
        top = V((sx * h.sw * 0.55, -h.ry0 * 0.5, zb + 0.02))
        sh = V((sx * h.sw * 0.78, 0.0, h.shz + 0.045 * H))
        bk = V((sx * h.sw * 0.55, h.ry0 * 0.8, zb))
        h.add(tube("strap", [tuple(top), tuple((top + sh) / 2 + V((0, -0.01, 0.02))), tuple(sh), tuple((sh + bk) / 2 + V((0, 0.02, 0.02))), tuple(bk)],
                   [0.021 * H] * 5, 8, DENIM2), ["chest", "spine"])
        h.add(ell("button", top + V((0, -0.012, -0.005)), (0.016 * H,) * 3, 10, 8, color=BRASS), "chest")
    # chest pocket + patch
    pk = box("pocket", (0, -h.ry0 * 1.09, h.z_u(0.5)), (0.17 * H, 0.014 * H, 0.12 * H), color=DENIM2, radius=0.006)
    h.add(pk, ["spine", "chest"])
    h.add(box("pocket_stitch", (0, -h.ry0 * 1.12, h.z_u(0.5) + 0.04 * H), (0.17 * H, 0.004 * H, 0.012 * H), color="#F6D98A", radius=0.001), ["spine", "chest"])
    h.add(box("seedpack", (0.015 * H, -h.ry0 * 1.14, h.z_u(0.5) + 0.07 * H), (0.05 * H, 0.004 * H, 0.07 * H), rot=(0, 0, 8), color="#E85D75", radius=0.002), ["spine", "chest"])
    # knee patch (left)
    kn = h.J["Lleg"]["kn"]
    h.add(ell("patch", (kn.x, kn.y - 0.12 * H * 0.98, kn.z + 0.02), (0.036 * H, 0.012 * H, 0.04 * H), 10, 8, color="#F0B35A"), ["thigh.L", "shin.L"])
    h.add(ell("patch_st", (kn.x, kn.y - 0.12 * H * 0.99, kn.z + 0.02), (0.044 * H, 0.010 * H, 0.048 * H), 10, 8, color="#B5823F"), ["thigh.L", "shin.L"])
    # rolled cuffs + boots
    for side, sx in (("L", 1), ("R", -1)):
        lp = h.leg_path(side)
        h.add(limb(f"rcuff_{side}", lp, 0.82, 0.92, lambda t: 0.052 * H * h.thick + 0.012 * H * h.thick + 0.012 * H, 1, 12, DENIM2),
              [f"shin.{side}"], 3)
        h.shoe(side, BOOT, SOLE, toe="#9C6038", shaft=BOOT, shaft_h=0.17, cuff="#6B3E26")
        h.hand(side, GLOVE, cuff=GLOVE2, cuff_len=0.8, curl=0.5, spread=1.5)
    # elbow wrinkles + collar
    for side in ("L", "R"):
        ap = h.arm_path(side)
        for t, k in ((0.47, 1.0), (0.53, 0.8)):
            h.add(limb(f"wr_{side}", ap, t, t + 0.02, lambda tt: 0.043 * H + 0.0125 * H, 1, 10, "#B84C3A"), [f"upper_arm.{side}", f"forearm.{side}"], 3)
    h.add(loft("collar", [(h.sz - 0.015 * H, 0.085 * H, 0.075 * H, 0, 0.0), (h.sz + 0.02 * H, 0.07 * H, 0.062 * H, 0, 0.0)], 18, "#F7E3B5"), ["chest", "neck"])
    # head
    h.skull(SKIN, ears=True)
    h.nose(v=-0.14, size=(0.05, 0.045, 0.045), color="#F08F6A", out=0.05)
    h.eyes(u=0.35, v=0.12, w=0.21, h=0.28, iris="#5A3A28", iris_s=0.62)
    h.brow(u=0.36, v=0.45, w=0.3, ang=-0.05, arch=0.06, thick=0.05, color=WHITE, hmax=0.05)
    h.cheeks("#F08A78", u=0.62, v=-0.12, w=0.13, h=0.08)
    # big handlebar mustache: two sweeping tubes + tuft
    hd = h.head
    for sx in (1, -1):
        pts = [hd.pt(sx * 0.02, -0.3, 0.07), hd.pt(sx * 0.2, -0.33, 0.09), hd.pt(sx * 0.42, -0.31, 0.09), hd.pt(sx * 0.6, -0.27, 0.11),
               hd.pt(sx * 0.7, -0.14, 0.13)]
        pts[-1] = pts[-1] + V((sx * 0.02, -0.04, 0.05))
        pts[-2] = pts[-2] + V((sx * 0.0, -0.02, -0.0))
        sp = spline(pts, 4)
        n = len(sp)
        rr = [0.012 * H + 0.04 * H * math.sin(math.pi * min(1, (i / (n - 1)) ** 0.8 * 1.0)) ** 0.9 + 0.005 * H for i in range(n)]
        h.add(tube("mustache", sp, rr, 10, WHITE), "head")
        h.add(ell("mtuft", hd.pt(sx * 0.18, -0.38, 0.07), (0.04 * H, 0.03 * H, 0.03 * H), 8, 6, color=WHITE), "head")
        # sideburn tufts
        h.add(ell("tuft", hd.c + V((sx * h.hr[0] * 0.86, -0.02, 0.0)), (0.03 * H, 0.04 * H, 0.07 * H), 8, 6, color=WHITE), "head")
    # soul patch / lip hint
    h.add(h.head.strip("mouth", arc(-0.1, -0.5, 0.1, -0.5, -0.04, 7), 0.016, "#6A2E2E", 0.01, 0.012), "head")
    # straw hat
    hc = h.HC
    top = hc.z + h.hr[2] * 0.62
    brim = lathe("hat_brim", [(0.0, 0.0), (0.1 * H, -0.002), (0.19 * H, 0.004), (0.255 * H, 0.016), (0.265 * H, 0.03), (0.25 * H, 0.034),
                              (0.19 * H, 0.022), (0.1 * H, 0.012), (0.0, 0.012)], 28, STRAW)
    xform(brim, (0, -0.0, top - 0.0), (-4, 0, 0))
    crown = lathe("hat_crown", [(0.0, 0.0), (0.108 * H, 0.0), (0.112 * H, 0.05), (0.104 * H, 0.12), (0.085 * H, 0.17), (0.045 * H, 0.19), (0.0, 0.195)],
                  28, STRAW)
    xform(crown, (0, 0.0, top + 0.0))
    band = lathe("hat_band", [(0.109 * H, 0.012), (0.115 * H, 0.015), (0.119 * H, 0.04), (0.116 * H, 0.06), (0.11 * H, 0.062), (0.107 * H, 0.04)], 28, BAND)
    xform(band, (0, 0, top))
    # weave rings on crown + brim
    rings = []
    for i, (z, r) in enumerate([(0.05, 0.112), (0.12, 0.103), (0.17, 0.082)]):
        rings.append(lathe(f"hat_ring{i}", [(r * H - 0.002, z - 0.004), (r * H + 0.006, z), (r * H - 0.002, z + 0.004)], 28, STRAW2))
    for r in (0.15, 0.2, 0.245):
        rr = lathe("brim_ring", [(r * H, 0.0), (r * H + 0.005, 0.014 + r * 0.04), (r * H + 0.01, 0.0)], 28, STRAW2)
        xform(rr, (0, 0, top + 0.012 * (r > 0.2)), (-4, 0, 0))
        rings.append(rr)
    for o in rings[:3]:
        xform(o, (0, 0, top))
    for o in [brim, crown, band] + rings:
        h.add(o, "head")
    # a flower tucked in the band
    for k, c in enumerate(("#FF7AA8", "#FFD166")):
        h.add(ell("petal", (0.07 * H + 0.012 * k * H, -0.112 * H, top + 0.05 * H + 0.012 * H * k), (0.026 * H,) * 3, 8, 6, color=c), "head")
    # belt + shears
    wz = h.z_u(0.2)
    rx, ry, cy = h.torso_prof(0.2, 0.03)
    belt = loft("belt", [(wz - 0.018 * H, rx, ry, 0, cy), (wz + 0.018 * H, rx, ry, 0, cy)], 20, "#7A4A2A")
    h.add(belt, ["hips", "spine"])
    h.add(box("buckle", (0, cy - ry - 0.003, wz), (0.05 * H, 0.012 * H, 0.04 * H), color=BRASS, radius=0.005), ["hips", "spine"])
    sx0 = h.rx0 * 0.78
    sz = wz - 0.06 * H
    sy = cy - ry * 0.9
    ang = 8
    hol = box("holster", (sx0, sy, sz - 0.03 * H), (0.06 * H, 0.03 * H, 0.11 * H), color="#9A5A32", radius=0.012)
    h.add(hol, ["hips"])
    for k, (dx, c) in enumerate(((-1, "#E0434B"), (1, "#C22F3C"))):
        ring = [(sx0 + dx * 0.016 * H + 0.014 * H * math.cos(a_) * 0.9, sy - 0.004 * H, sz + 0.075 * H + 0.03 * H * math.sin(a_)) for a_ in
                [2 * math.pi * i / 10 for i in range(11)]]
        h.add(tube("shear_ring", ring, [0.007 * H] * 11, 6, c, cap=False), ["hips"])
    h.add(box("bladeA", (sx0 - 0.007 * H, sy, sz + 0.0), (0.02 * H, 0.008 * H, 0.1 * H), color="#C9D6EA", radius=0.003), ["hips"])
    h.add(box("bladeB", (sx0 + 0.007 * H, sy - 0.003 * H, sz + 0.0), (0.02 * H, 0.008 * H, 0.1 * H), color="#9FB0CC", radius=0.003), ["hips"])
    return h


PARAMS = dict(idle_amp=1.0, talk_amp=1.1, gesture="R", wave_side="R", stride=20, arm_swing=14, bounce=0.03, lean=4, knee=30, head_tilt=1)


def build(man):
    h = make()
    arm, body = h.build()
    rig = Rig(arm)
    anims = h_anim.all_anims(rig, PARAMS)
    finish(arm, body, "marrow", rig, "character", ["verdant", "amber"], anims, extra={"npc": "marrow"}, pose=("wave", 24), manifest=man, frame=0.95, face=((0, 0, 1.24), 0.42))
