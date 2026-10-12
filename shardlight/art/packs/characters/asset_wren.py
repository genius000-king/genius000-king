"""Wren — beekeeper. Broad veiled hat pushed back, honey-jar satchel, kind but haunted."""
from humans import *
import h_anim

SKIN = "#A86B45"
HAIR = "#2B1B26"
SUIT, SUIT2 = "#FBE2A3", "#EAC878"
GLOVE, BOOT, SOLE = "#F0A92E", "#2E7A78", "#1D4A4D"
HAT, HAT2, VEIL = "#F7DC94", "#E5B96B", "#F6F7DC"
LEATHER, HONEY, JAR = "#9C5A32", "#FFB627", "#FFE2A0"


def hexring(name, r, color, z=0.0, th=0.01):
    return loft(name, [(z, r, r, 0, 0), (z + th, r, r, 0, 0)], 6, color)


def make():
    sl.reset()
    h = Human("wren", 1.7, ph=0.235, leg=0.47, sw=0.118, hipw=0.062, arm=(0.17, 0.16), hand=1.7, neck=0.05, head_w=1.0, head_d=0.96,
              thick=0.95, belly=0.05, torso_w=1.0, foot=1.4, cheek=0.08, chin=0.3,
              arms={"L": ((0.3, 0.0, -0.95), (-0.4, -0.6, -0.7)), "R": ((-0.3, 0.05, -0.95), (-0.12, -0.3, -0.95))})
    H = h.H
    h.body(SKIN, SUIT, SUIT, sleeve_t=0.97, cuff="#E4D6AD", pants_len=1.0)
    # suit details: collar, chest honeycomb patch, knee patches, belt
    h.add(loft("collar", [(h.sz - 0.02 * H, 0.085 * H, 0.078 * H, 0, 0), (h.sz + 0.035 * H, 0.072 * H, 0.066 * H, 0, 0)], 18, SUIT2), ["chest", "neck"])
    for k, (x, z, r) in enumerate(((-0.045 * H, h.z_u(0.62), 0.032 * H), (0.0, h.z_u(0.62) - 0.03 * H, 0.032 * H), (-0.045 * H, h.z_u(0.62) - 0.06 * H, 0.032 * H))):
        hx = hexring("hex", r, [HONEY, "#FFD166", "#E8943A"][k], 0, 0.012)
        xform(hx, (x, -h.ry0 * 1.06, z), (90, 0, 0))
        h.add(hx, ["spine", "chest"])
    for side in ("L", "R"):
        kn = h.J[side + "leg"]["kn"]
        hx = hexring("kp", 0.05 * H, SUIT2, 0, 0.01)
        xform(hx, (kn.x, kn.y - 0.056 * H * 1.0, kn.z + 0.02), (90, 0, 0))
        h.add(hx, [f"thigh.{side}", f"shin.{side}"])
        h.shoe(side, BOOT, SOLE, toe="#3E9692", shaft=BOOT, shaft_h=0.19, cuff=SUIT2)
        h.hand(side, GLOVE, cuff="#C9822D", cuff_len=1.4, curl=0.8, spread=1.2)
    rx, ry, cy = h.torso_prof(0.2, 0.02)
    wz = h.z_u(0.2)
    h.add(loft("belt", [(wz - 0.016 * H, rx, ry, 0, cy), (wz + 0.016 * H, rx, ry, 0, cy)], 20, LEATHER), ["hips", "spine"])
    vest = h.torso_loft("vest", "#4DA9A2", u0=0.12, u1=0.84, infl=0.02, n=9)
    paint_faces_fn(vest, lambda c, n: "#3A8E88" if abs(c.x) < 0.012 * H and c.y < 0 else "#4DA9A2")
    h.add(vest, ["hips", "spine", "chest"])
    h.add(box("vest_pocket", (-0.06 * H, -h.ry0 * 1.1, h.z_u(0.3)), (0.075 * H, 0.012 * H, 0.06 * H), color="#3A8E88", radius=0.005), ["spine", "hips"])
    for k in range(4):
        h.add(ell("vbtn", (0.0, -h.torso_prof(0.2 + k * 0.17, 0.02)[1] + h.torso_prof(0.2 + k * 0.17, 0.02)[2] - 0.004 * H, h.z_u(0.2 + k * 0.17)), (0.011 * H,) * 3, 8, 6, color=HONEY), ["spine", "chest"])
    # head
    h.skull(SKIN)
    hd = h.head
    h.nose(v=-0.17, size=(0.024, 0.024, 0.022), color="#8A5336", out=0.02)
    h.eyes(u=0.33, v=0.06, w=0.17, h=0.23, iris="#3A2A1E", iris_s=0.7, lid=0.25, lid_color=SKIN)
    h.brow(u=0.34, v=0.4, w=0.26, ang=-0.16, arch=0.04, thick=0.03, color=HAIR)
    h.mouth("calm", v=-0.46, w=0.15, color="#5A2A2A", thick=0.02)
    for sx in (1, -1):
        for (fu, fv) in ((0.4, -0.12), (0.5, -0.08), (0.46, -0.18), (0.58, -0.13)):
            h.add(hd.patch("frk", sx * fu, fv, 0.017, 0.017, "#6E4128", 0.02, 0.004), "head")
        h.add(hd.patch("cheek", sx * 0.55, -0.24, 0.1, 0.06, "#C8664F", 0.003, 0.012), "head")
    # curly hair puffs
    rng = random.Random(11)
    h.add(hair_cap(hd, HAIR, hairline=0.5, back=-0.5, scale=1.04), "head")
    for i in range(14):
        a = rad(-100 + i * 15.5)
        for (zz, rr) in ((0.42, 1.0), (0.1, 1.04), (-0.15, 0.98)):
            if abs(i - 6.5) < 1.5 and zz > 0.3:
                continue
            if i % 2 and zz < 0.0:
                continue
            ang = a + (0.2 if zz < 0.2 else 0)
            c = hd.c + V((math.sin(ang) * h.hr[0] * 0.93 * rr, math.cos(ang) * h.hr[1] * 0.93 * rr, zz * h.hr[2]))
            if math.cos(ang) < 0.0:
                continue
            h.add(ell("curl", c, (0.052 * H,) * 3, 10, 8, color=HAIR), "head")
    # wide-brim hat, pushed back, with bee pin and band
    top = hd.c.z + h.hr[2] * 0.5
    ctr = V((0, 0.045 * H, top))
    brim = lathe("hat_brim", [(0.0, 0.0), (0.1 * H, -0.003), (0.19 * H, 0.0), (0.245 * H, 0.025), (0.258 * H, 0.05), (0.246 * H, 0.057), (0.19 * H, 0.03), (0.1 * H, 0.012), (0.0, 0.012)], 32, HAT)
    crown = lathe("hat_crown", [(0.0, 0.0), (0.1 * H, 0.0), (0.105 * H, 0.06), (0.095 * H, 0.14), (0.07 * H, 0.17), (0.0, 0.18)], 28, HAT)
    band = lathe("hat_band", [(0.1 * H, 0.012), (0.108 * H, 0.016), (0.111 * H, 0.045), (0.108 * H, 0.064), (0.102 * H, 0.068), (0.099 * H, 0.04)], 28, "#4C7F3F")
    under = lathe("hat_under", [(0.285 * H, 0.0), (0.3 * H, 0.05), (0.29 * H, 0.056), (0.26 * H, 0.02)], 32, HAT2)
    ob = sl.join([brim, crown, band], "hat")
    parts = [ob]
    # veil: pushed back, bunched behind the head
    bm = bmesh.new()
    rowsN, colsN = 6, 26
    grid = []
    for k in range(colsN + 1):
        a = rad(125 + 110 * k / colsN)  # 90..270deg around, back half (+Y)
        col_ = []
        for r in range(rowsN + 1):
            t = r / rowsN
            rad_ = (0.25 - 0.12 * t) * H
            f = 1.0 + 0.045 * math.sin(k * 1.9) * t
            zz = -0.0 - t * 0.42 * H
            col_.append(bm.verts.new((-math.cos(a - math.pi / 2) * 0 + math.sin(a) * -rad_ * f * 1.0, -math.cos(a) * rad_ * f * 0.9, zz)))
        grid.append(col_)
    for k in range(colsN):
        for r in range(rowsN):
            bm.faces.new((grid[k][r], grid[k + 1][r], grid[k + 1][r + 1], grid[k][r + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    veil = mk(bm, "veil", "VC", True, VEIL)
    solid(veil, 0.008 * H)
    paint_faces_fn(veil, lambda c, n: "#DDE3BF" if int(-c.z / (0.085 * H)) % 2 else VEIL)
    xform(veil, (0, 0, 0.03 * H))
    parts.append(veil)
    ob = sl.join(parts, "hat_all")
    xform(ob, V((0, 0, 0)))
    # tilt back + place
    rotate_about(ob, (0, 0, 0), (-16, 0, 0))
    xform(ob, ctr)
    h.add(ob, "head")
    # veil continues (weighted to chest too so it doesn't clip shoulders): keep rigid to head; band bee pin
    bee = [ell("bee_b", (0, 0, 0), (0.026 * H, 0.04 * H, 0.026 * H), 10, 8, color=HONEY),
           ell("bee_s1", (0, -0.014 * H, 0.0), (0.027 * H, 0.008 * H, 0.027 * H), 10, 6, color="#2B1B26"),
           ell("bee_w1", (-0.028 * H, 0.0, 0.026 * H), (0.026 * H, 0.012 * H, 0.016 * H), 8, 6, color="#FFFFFF", rot=(0, 25, 0)),
           ell("bee_w2", (0.028 * H, 0.0, 0.026 * H), (0.026 * H, 0.012 * H, 0.016 * H), 8, 6, color="#FFFFFF", rot=(0, -25, 0))]
    bo = sl.join(bee, "bee")
    xform(bo, (0.1 * H, -0.125 * H, 0.04 * H), (0, 0, 20))
    rotate_about(bo, (0, 0, 0), (-16, 0, 0))
    xform(bo, ctr)
    h.add(bo, "head")
    # honey satchel at left hip + crossbody strap + jars
    bc = V((h.rx0 * 1.28, 0.02 * H, h.hz - 0.03 * H))
    bag = box("bag", tuple(bc), (0.12 * H, 0.2 * H, 0.15 * H), color=LEATHER, radius=0.02)
    flap = box("flap", tuple(bc + V((0.0, 0.0, 0.065 * H))), (0.125 * H, 0.205 * H, 0.04 * H), color="#B26B3C", radius=0.012)
    clasp = ell("clasp", tuple(bc + V((0.065 * H, 0.0, 0.05 * H))), (0.012 * H, 0.02 * H, 0.02 * H), 8, 6, color=HONEY)
    h.add(bag, ["hips"], 1)
    h.add(flap, ["hips"], 1)
    h.add(clasp, ["hips"], 1)
    for k, dy in enumerate((-0.058 * H, 0.0, 0.058 * H)):
        jr = lathe("jar", [(0.0, 0.0), (0.04 * H, 0.0), (0.045 * H, 0.012 * H), (0.045 * H, 0.085 * H), (0.036 * H, 0.1 * H), (0.036 * H, 0.112 * H), (0.0, 0.112 * H)], 14, JAR)
        paint_fn(jr, lambda co, n: HONEY if co.z < 0.088 * H else JAR)
        lid = lathe("lid", [(0.0, 0.1 * H), (0.04 * H, 0.1 * H), (0.04 * H, 0.125 * H), (0.0, 0.125 * H)], 14, "#C97D35")
        xform(jr, (0, 0, 0)); xform(lid, (0, 0, 0))
        j2 = sl.join([jr, lid], "jar_all")
        xform(j2, bc + V((0.0, dy, 0.085 * H + (0.012 * H if k == 1 else 0))))
        h.add(j2, ["hips"], 1)
    sp = [tuple(bc + V((-0.06 * H, 0.06 * H, 0.08 * H))), (h.rx0 * 1.0, 0.0, h.z_u(0.35)), (h.rx0 * 0.8, -h.ry0 * 1.0, h.z_u(0.5)), (0.0, -h.ry0 * 1.08, h.z_u(0.72)),
          (-h.rx0 * 0.8, 0.0, h.sz + 0.02 * H), (-h.rx0 * 0.5, h.ry0 * 1.0, h.z_u(0.7)), (0.0, h.ry0 * 1.05, h.z_u(0.45)), (h.rx0 * 0.95, h.ry0 * 0.5, h.z_u(0.28)),
          tuple(bc + V((-0.06 * H, -0.06 * H, 0.08 * H)))]
    # (strap: front diagonal + back diagonal)
    fr = [tuple(bc + V((0.0, -0.08 * H, 0.07 * H))), (h.rx0 * 1.0, -h.ry0 * 0.7, h.z_u(0.3)), (h.rx0 * 0.2, -h.ry0 * 1.1, h.z_u(0.6)), (-h.rx0 * 0.7, -h.ry0 * 0.6, h.z_u(0.95)),
          (-h.rx0 * 0.78, 0.0, h.sz + 0.02 * H), (-h.rx0 * 0.6, h.ry0 * 0.8, h.z_u(0.85)), (0.0, h.ry0 * 1.1, h.z_u(0.55)), (h.rx0 * 0.95, h.ry0 * 0.7, h.z_u(0.3)),
          tuple(bc + V((0.0, 0.08 * H, 0.07 * H)))]
    h.add(tube("strap", spline(fr, 4), [0.016 * H] * (len(fr) - 1) * 4 + [0.016 * H], 8, LEATHER), ["chest", "spine", "hips"], 2)
    return h


PARAMS = dict(idle_amp=0.85, talk_amp=0.9, gesture="R", wave_side="R", stride=21, arm_swing=14, bounce=0.022, lean=2, knee=30, head_tilt=3)


def build(man):
    h = make()
    arm, body = h.build()
    rig = Rig(arm)
    anims = h_anim.all_anims(rig, PARAMS)
    finish(arm, body, "wren", rig, "character", ["verdant"], anims, extra={"npc": "wren"}, pose=("wave", 24), manifest=man, frame=0.95,
           face=((0, 0, 1.45), 0.4))
