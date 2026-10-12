"""Shared stylized humanoid: skeleton + body parts + face helpers + shared animation set."""
from _h import *


def head_deform(cheek=0.10, chin=0.20, jaw_fwd=0.0):
    """Egg-ish head: narrower toward the chin, fuller cheeks."""
    def f(p):
        q = p.copy()
        if q.z < 0:
            k = -q.z
            q.x *= 1.0 - chin * k ** 1.6 + cheek * math.sin(min(1, k * 2.2) * math.pi) * 0.6
            q.y *= 1.0 + 0.04 * k
        return q
    return f


class Human:
    def __init__(s, aid, H, ph=0.25, leg=0.45, sw=0.12, hipw=0.062, arm=(0.175, 0.16), hand=1.0, neck=0.045,
                 head_w=1.04, head_d=0.95, thick=1.0, belly=0.0, torso_w=1.0, foot=1.0, arms=None, extra_bones=(),
                 cheek=0.10, chin=0.20):
        s.aid, s.H, s.ph, s.thick, s.belly, s.torso_w, s.foot_k = aid, H, ph, thick, belly, torso_w, foot
        s.hh = ph * H / 2
        s.HC = V((0, 0, H - s.hh))
        s.hr = (s.hh * head_w, s.hh * head_d, s.hh)
        s.deform = head_deform(cheek, chin)
        s.head = Head(s.HC, s.hr, s.deform)
        s.nz = H - 1.7 * s.hh
        s.sz = s.nz - neck * H
        s.shz = s.sz - 0.035 * H
        s.hz = leg * H
        s.az = 0.075 * H
        s.kz = (s.hz + s.az) / 2 + 0.01 * H
        s.sw, s.hipw = sw * H, hipw * H
        s.hs = 0.058 * H * hand
        s.La, s.Lf = arm[0] * H, arm[1] * H
        s.fl, s.fw = 0.17 * H * foot, 0.072 * H * foot
        s.parts = Parts()
        s.rx0 = s.sw * 0.92 * torso_w
        s.ry0 = s.rx0 * 0.76
        arms = arms or {}
        # arm joints
        s.J = {}
        for side, sx in (("L", 1), ("R", -1)):
            up_dir, fo_dir = arms.get(side, (None, None))
            up_dir = V(up_dir) if up_dir else V((sx * math.sin(rad(11)), 0.0, -math.cos(rad(11))))
            fo_dir = V(fo_dir) if fo_dir else V((sx * 0.06, -0.20, -0.98))
            up_dir.normalize(); fo_dir.normalize()
            sh = V((sx * s.sw, 0, s.shz))
            el = sh + up_dir * s.La
            wr = el + fo_dir * s.Lf
            s.J[side] = dict(sh=sh, el=el, wr=wr, fdir=fo_dir, hand_end=wr + fo_dir * s.hs * 1.15)
            s.J[side + "leg"] = dict(hip=V((sx * s.hipw, 0, s.hz)), kn=V((sx * s.hipw * 1.04, -0.004 * H, s.kz)),
                                     an=V((sx * s.hipw * 1.08, 0.006 * H, s.az)),
                                     toe=V((sx * s.hipw * 1.08, -s.fl * 0.72, 0.02 * H)))
        B = [("root", (0, 0, 0), (0, 0, 0.1 * H), None),
             ("hips", (0, 0, s.hz - 0.01), (0, 0, s.hz + 0.2 * (s.sz - s.hz)), "root"),
             ("spine", (0, 0, s.hz + 0.2 * (s.sz - s.hz)), (0, 0, s.hz + 0.55 * (s.sz - s.hz)), "hips"),
             ("chest", (0, 0, s.hz + 0.55 * (s.sz - s.hz)), (0, 0, s.sz), "spine"),
             ("neck", (0, 0, s.sz), (0, 0, s.nz), "chest"),
             ("head", (0, 0, s.nz), (0, 0, H), "neck")]
        for side, sx in (("L", 1), ("R", -1)):
            j, l = s.J[side], s.J[side + "leg"]
            B += [(f"shoulder.{side}", (sx * 0.02 * H, 0, s.sz - 0.01 * H), tuple(j["sh"]), "chest"),
                  (f"upper_arm.{side}", tuple(j["sh"]), tuple(j["el"]), f"shoulder.{side}"),
                  (f"forearm.{side}", tuple(j["el"]), tuple(j["wr"]), f"upper_arm.{side}"),
                  (f"hand.{side}", tuple(j["wr"]), tuple(j["hand_end"]), f"forearm.{side}"),
                  (f"thigh.{side}", tuple(l["hip"]), tuple(l["kn"]), "hips"),
                  (f"shin.{side}", tuple(l["kn"]), tuple(l["an"]), f"thigh.{side}"),
                  (f"foot.{side}", tuple(l["an"]), tuple(l["toe"]), f"shin.{side}")]
        s.bones = B + list(extra_bones)
        s.bd = {b[0]: b for b in s.bones}

    # ---------------------------------------------------------------- helpers
    def add(s, obj, bones, falloff=3.0):
        return s.parts.add(obj, bones, falloff)

    def leg_path(s, side):
        l = s.J[side + "leg"]
        return Path([l["hip"], l["kn"], l["an"]])

    def arm_path(s, side):
        j = s.J[side]
        return Path([j["sh"], j["el"], j["wr"]])

    def torso_prof(s, u, infl=0.0):
        """-> (rx, ry, cy) at normalised height u (0 hips .. 1 shoulders)."""
        rxm = prof([(0, 0.92), (0.2, 0.84), (0.5, 0.92), (0.82, 1.0), (1.0, 0.66)], u)
        rym = prof([(0, 0.98), (0.2, 0.92), (0.5, 0.98), (0.82, 0.96), (1.0, 0.8)], u)
        bump = math.exp(-((u - 0.28) / 0.26) ** 2)
        rx = s.rx0 * rxm * (1 + s.belly * 0.55 * bump) + infl
        ry = s.ry0 * rym * (1 + s.belly * 1.15 * bump) + infl
        cy = -s.ry0 * s.belly * 0.62 * bump
        return rx, ry, cy

    def z_u(s, u):
        z0 = s.hz - 0.05 * s.H
        return z0 + u * (s.sz + 0.01 * s.H - z0)

    def u_z(s, z):
        z0 = s.hz - 0.05 * s.H
        return (z - z0) / (s.sz + 0.01 * s.H - z0)

    def torso_loft(s, name, color, u0=0.0, u1=1.0, infl=0.0, n=10, sides=20, poles=True, nn=2.2):
        secs = []
        for i in range(n + 1):
            u = u0 + (u1 - u0) * i / n
            rx, ry, cy = s.torso_prof(u, infl)
            secs.append((s.z_u(u), rx, ry, 0, cy))
        if poles:
            z, rx, ry, cx, cy = secs[0]
            secs.insert(0, (z - 0.012 * s.H, rx * 0.6, ry * 0.6, 0, cy))
            z, rx, ry, cx, cy = secs[-1]
            secs.append((z + 0.01 * s.H, rx * 0.5, ry * 0.5, 0, cy))
        return loft(name, secs, sides, color, n=nn)

    def draped(s, name, color, u_hi=1.0, u_side=0.78, u_front=0.4, u_back=0.2, infl=0.03, rows=6, cols=32, pw=1.2, bands=None,
               rim=None, rim_r=0.012):
        """Garment draped over the torso that follows its surface: lower edge dips to a V at front/back (shawl, cape, bib).
        bands: list of (row_index, color) for knit stripes. Returns (obj, rim_points)."""
        bm = bmesh.new()
        grid = []
        for k in range(cols):
            a = 2 * math.pi * k / cols
            sa = math.sin(a)
            lo = u_side + (u_front - u_side) * max(0.0, -sa) ** pw + (u_back - u_side) * max(0.0, sa) ** pw
            col_ = []
            for r in range(rows + 1):
                u = u_hi + (lo - u_hi) * r / rows
                rx, ry, cy = s.torso_prof(min(u, 1.0), infl * (1.0 + 0.4 * (r / rows) ** 2))
                if u > 1.0:
                    rx, ry, cy = s.torso_prof(1.0, infl)
                    f = 0.78 + 0.22 * (1 - (u - 1.0) * 6)
                    rx *= f; ry *= f
                col_.append(bm.verts.new((rx * math.cos(a), cy + ry * sa, s.z_u(u))))
            grid.append(col_)
        for k in range(cols):
            g0, g1 = grid[k], grid[(k + 1) % cols]
            for r in range(rows):
                bm.faces.new((g0[r], g1[r], g1[r + 1], g0[r + 1]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        pts = [tuple(grid[k][rows].co) for k in range(cols)]
        pts.append(pts[0])
        o = mk(bm, name, "VC", True, color)
        if bands:
            cm = {r: c for r, c in bands}
            sl.paint_faces(o, lambda p, c, n: cm.get(p.index % rows))
        return o, pts

    # ---------------------------------------------------------------- body
    def body(s, skin, shirt, pants=None, shirt_to_arm=1.0, pants_len=1.0, sleeve_t=0.5, cuff=None, shoe=None,
             skin_shade=None):
        H = s.H
        s.add(s.torso_loft("torso", shirt), ["hips", "spine", "chest"])
        s.add(tube("neck", [(0, 0, s.sz - 0.02 * H), (0, 0, s.nz + 0.01 * H)], [0.06 * H, 0.052 * H], 12, skin),
              ["chest", "neck", "head"])
        s.add(s.torso_loft("pelvis", pants or shirt, u0=0.0, u1=0.34, infl=0.012, n=4), ["hips", "spine"])
        for side, sx in (("L", 1), ("R", -1)):
            # legs
            lp = s.leg_path(side)
            rf = lambda t: prof([(0, 0.064 * H * s.thick), (0.5, 0.05 * H * s.thick), (1.0, 0.037 * H * s.thick)], t)
            s.add(limb(f"leg_{side}", lp, 0.02, 1.0, rf, 8, 12, skin), ["hips", f"thigh.{side}", f"shin.{side}"], 3)
            if pants and pants_len > 0:
                s.add(limb(f"pants_{side}", lp, 0.0, pants_len, lambda t: rf(t) + 0.012 * H * s.thick, 8, 12, pants),
                      ["hips", f"thigh.{side}", f"shin.{side}"], 3)
            # arms
            ap = s.arm_path(side)
            ra = lambda t: prof([(0, 0.05 * H), (0.5, 0.043 * H), (1.0, 0.036 * H)], t)
            s.add(limb(f"arm_{side}", ap, 0.0, 1.0, ra, 8, 10, skin), [f"upper_arm.{side}", f"forearm.{side}"], 3)
            s.add(ell(f"shcap_{side}", s.J[side]["sh"], (0.056 * H,) * 3, 12, 8, color=shirt if sleeve_t > 0 else skin),
                  [f"shoulder.{side}", f"upper_arm.{side}", "chest"], 3)
            if sleeve_t > 0:
                s.add(limb(f"sleeve_{side}", ap, 0.0, sleeve_t, lambda t: ra(t) + 0.011 * H, 6, 10, shirt),
                      [f"upper_arm.{side}", f"forearm.{side}"], 3)
                if cuff:
                    s.add(limb(f"cuff_{side}", ap, sleeve_t - 0.04, sleeve_t, lambda t: ra(t) + 0.02 * H, 1, 10, cuff),
                          [f"upper_arm.{side}", f"forearm.{side}"], 3)

    def hand(s, side, color, cuff=None, cuff_len=0.5, fingers=True, glove_extra=0.0, spread=1.0, curl=1.0):
        """Chunky cartoon hand (relaxed, slightly curled), thumb forward. Built pointing -Z then aligned to the forearm."""
        sx = 1 if side == "L" else -1
        hs = s.hs
        parts = []
        parts.append(ell(f"palm_{side}", (0, 0, -0.38 * hs), (0.5 * hs, 0.3 * hs, 0.44 * hs), 14, 10, color=color))
        for i, (x, ln) in enumerate(((-0.33, 0.85), (-0.11, 1.0), (0.11, 0.97), (0.33, 0.8))):
            fx = x * hs * (1 + 0.15 * spread)
            pts = [(x * hs, 0.0, -0.55 * hs), (fx, -0.07 * hs * curl, -0.88 * hs * ln), (fx * 1.12, -0.2 * hs * curl, -1.1 * hs * ln)]
            parts.append(tube(f"fing_{side}{i}", pts, [0.15 * hs, 0.14 * hs, 0.105 * hs], 8, color))
        parts.append(tube(f"thumb_{side}", [(0.0, -0.18 * hs, -0.12 * hs), (-sx * 0.0, -0.46 * hs, -0.38 * hs), (0.0, -0.52 * hs, -0.66 * hs)],
                          [0.2 * hs, 0.17 * hs, 0.115 * hs], 8, color))
        if cuff:
            z0, z1 = 0.28 * hs, 0.28 * hs - 0.62 * hs * cuff_len
            parts.append(loft(f"hcuff_{side}", [(z0, 0.4 * hs, 0.36 * hs, 0, 0), (z0 - 0.1 * hs, 0.62 * hs, 0.56 * hs, 0, 0),
                                                   (z1, 0.62 * hs, 0.56 * hs, 0, 0), (z1 - 0.06 * hs, 0.5 * hs, 0.44 * hs, 0, 0)], 14, cuff, smooth=True))
        j = s.J[side]
        o = sl.join(parts, f"hand_{side}")
        align_to(o, (0, 0, -1), j["fdir"])
        xform(o, j["wr"] + j["fdir"] * 0.0)
        s.add(o, [f"forearm.{side}", f"hand.{side}"], 5)
        return o

    def shoe(s, side, upper, sole, toe=None, shaft=None, shaft_h=0.1, cuff=None, lace=None):
        H, fl, fw = s.H, s.fl, s.fw
        sx = 1 if side == "L" else -1
        a = s.J[side + "leg"]["an"]
        sole_o = ell(f"sole_{side}", (a.x, a.y - 0.2 * fl, 0.021 * H), (fw * 0.58, fl * 0.56, 0.026 * H), 14, 8, color=sole)
        up = ell(f"upper_{side}", (a.x, a.y - 0.18 * fl, 0.065 * H), (fw * 0.5, fl * 0.5, 0.05 * H), 14, 10, color=upper)
        parts = [sole_o, up]
        if toe:
            parts.append(ell(f"toe_{side}", (a.x, a.y - 0.52 * fl, 0.055 * H), (fw * 0.5, fl * 0.24, 0.042 * H), 12, 8, color=toe))
        sh = tube(f"shaft_{side}", [(a.x, a.y, a.z - 0.01 * H), (a.x, a.y + 0.002, a.z + shaft_h * H)],
                  [0.048 * H * s.thick, 0.054 * H * s.thick], 12, shaft or upper)
        parts.append(sh)
        if cuff:
            parts.append(tube(f"scuff_{side}", [(a.x, a.y, a.z + (shaft_h - 0.03) * H), (a.x, a.y, a.z + (shaft_h + 0.012) * H)],
                              [0.062 * H * s.thick, 0.062 * H * s.thick], 12, cuff))
        o = sl.join(parts, f"shoe_{side}")
        s.add(o, [f"shin.{side}", f"foot.{side}"], 4)
        return o

    # ---------------------------------------------------------------- head
    def skull(s, skin, ears=True, ear_color=None):
        o = ell("head", s.HC, s.hr, 28, 18, color=skin, deform=s.deform)
        s.add(o, "head")
        if ears:
            for sx in (1, -1):
                e = ell("ear", s.HC + V((sx * s.hr[0] * 0.99, 0.01, -0.02)), (0.022 * s.H, 0.028 * s.H, 0.04 * s.H), 10, 8,
                        color=ear_color or skin)
                s.add(e, "head")

    def eyes(s, u=0.36, v=0.04, w=0.14, h=0.18, white="#FFFFFF", iris="#3B2A2A", iris_s=0.66, hi=True, lid=None,
             lid_color=None, look=(0.0, 0.0), pupil="#1B1220", sclera=True, iris_h=0.0):
        for sx in (1, -1):
            uu = sx * u
            if sclera:
                s.add(s.head.patch(f"sclera", uu, v, w, h, white, 0.004, 0.02), "head")
            lu, lv = uu + sx * look[0] * w, v + look[1] * h
            if iris:
                s.add(s.head.patch("iris", lu, lv, w * iris_s, h * iris_s * 1.05, iris, 0.014, 0.012), "head")
                s.add(s.head.patch("pupil", lu, lv, w * iris_s * 0.5, h * iris_s * 0.55, pupil, 0.022, 0.01), "head")
            if hi:
                s.add(s.head.patch("hi", lu - sx * w * 0.2, lv + h * 0.3, w * 0.2, h * 0.17, "#FFFFFF", 0.03, 0.006), "head")
                s.add(s.head.patch("hi2", lu + sx * w * 0.25, lv - h * 0.28, w * 0.08, h * 0.07, "#FFFFFF", 0.03, 0.006), "head")
            if lid:
                # upper lid: skin-colored cap covering the top `lid` fraction of the eye
                s.add(s.head.patch("lid", uu, v + h * (1 - lid), w * 1.1, h * (0.5 + 0.0) , lid_color, 0.034, 0.006,
                                   rot=-sx * 6), "head")

    def brow(s, u=0.36, v=0.30, w=0.2, ang=0.0, arch=0.03, thick=0.035, color="#3B2A2A", hmax=0.03):
        for sx in (1, -1):
            u0, u1 = sx * (u - w / 2), sx * (u + w / 2)
            # ang>0 = inner end lower (angry) ; <0 = inner end raised (worried)
            v0, v1 = v - ang * 0.5, v + ang * 0.5
            pts = arc(u0, v0, u1, v1, arch, 6)
            s.add(s.head.strip("brow", pts, [thick * 0.8, thick, thick, thick * 0.9, thick * 0.7, thick * 0.4][:6], color, 0.012, hmax), "head")

    def mouth(s, kind="smile", v=-0.42, w=0.2, color="#5A2A2A", thick=0.014, teeth=None, tongue=None):
        if kind == "smile":
            pts = arc(-w, v + 0.03, w, v + 0.03, -0.07, 9)
        elif kind == "grin":
            pts = arc(-w, v + 0.05, w, v + 0.05, -0.1, 9)
        elif kind == "calm":
            pts = arc(-w * 0.8, v + 0.01, w * 0.8, v + 0.01, -0.025, 9)
        else:
            pts = arc(-w, v, w, v, 0.0, 9)
        s.add(s.head.strip("mouth", pts, thick, color, 0.012, 0.012), "head")
        return pts

    def nose(s, v=-0.14, size=(0.04, 0.04, 0.04), color="#E58F6E", out=0.1):
        c = s.head.pt(0, v, out)
        s.add(ell("nose", c, tuple(x * s.H for x in size), 12, 8, color=color), "head")

    def cheeks(s, color="#F08A78", u=0.58, v=-0.22, w=0.11, h=0.07):
        for sx in (1, -1):
            s.add(s.head.patch("cheek", sx * u, v, w, h, color, 0.003, 0.012), "head")

    def bandaid(s, u, v, rot=20, w=0.16, h=0.06, color="#F2C9A0"):
        o = s.head.patch("bandaid", u, v, w, h, color, 0.012, 0.012, rot=rot, shape=lambda a, x, y: (x * 1.0, y) )
        s.add(o, "head")
        # pad + dots
        s.add(s.head.patch("bandpad", u, v, w * 0.36, h * 0.9, "#E8A878", 0.02, 0.008, rot=rot), "head")

    def on_head(s, obj, u, v, h=0.0, roll=0.0):
        """Place an object built around the origin (front = -Y) on the head surface, aligned to the surface normal."""
        c = s.head.pt(u, v, h)
        n = (c - s.head.c)
        n = V((n.x / s.hr[0] ** 2, n.y / s.hr[1] ** 2, n.z / s.hr[2] ** 2)).normalized()
        if abs(roll) > 1e-6:
            xform(obj, (0, 0, 0), (0, roll, 0))
        align_to(obj, (0, -1, 0), n)
        xform(obj, c)
        return obj

    # ---------------------------------------------------------------- finish
    def build(s, name=None, ao=0.12):
        arm = build_armature(s.aid + "_rig", s.bones)
        body = skin_body(s.parts, s.bd, arm, name or s.aid, ao)
        return arm, body
