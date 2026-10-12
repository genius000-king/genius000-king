"""Static Wisp — glitch jellyfish: layered misaligned bell, trailing tendrils, orbiting pixel fragments, EMIT core."""
from _h import *

S, C = math.sin, math.cos
IND, VIO, MAG, CYA, WHT = "#2B2150", "#7B4DFF", "#FF2E93", "#26E6FF", "#F2F0FF"
NT = 6


def make():
    sl.reset()
    rng = random.Random(21)
    bones = [("root", (0, 0, 0), (0, 0, 0.1), None),
             ("bell", (0, 0, 0.8), (0, 0, 1.05), "root"),
             ("bell_up", (0, 0, 1.05), (0, 0, 1.45), "bell"),
             ("core", (0, 0, 1.0), (0, 0, 1.12), "bell"),
             ("orbit", (0, 0, 1.0), (0, 0, 1.12), "root")]
    tend = []
    for k in range(NT):
        a = rad(30 + 60 * k)
        x, y = math.cos(a) * 0.2, math.sin(a) * 0.2
        zs = [0.82, 0.56, 0.3, 0.04]
        fl = [1.0, 1.25, 1.5, 1.7]
        for n in range(3):
            bones.append((f"t{k}_{n + 1}", (x * fl[n], y * fl[n], zs[n]), (x * fl[n + 1], y * fl[n + 1], zs[n + 1]), "bell" if n == 0 else f"t{k}_{n}"))
        tend.append((x, y, fl, zs))
    P = Parts()
    # layered bell: three slices, each slightly rotated/offset (scan-line glitch), colour-blocked
    def dome(z0, z1, r0, r1, sides=14):
        return loft("slice", [(z0, r0, r0, 0, 0), (z0 + (z1 - z0) * 0.5, (r0 + r1) / 2 * 1.02, (r0 + r1) / 2 * 1.02, 0, 0), (z1, r1, r1, 0, 0)], sides, IND, n=2.0, smooth=False)
    s1 = dome(0.8, 0.98, 0.44, 0.5)       # rim band (scalloped)
    flat(s1)
    pleat(s1, 16, 0.12, 0.8, 0.98)
    paint_faces_fn(s1, lambda c, n: MAG if int(math.atan2(c.y, c.x) / (math.pi / 8) + 20) % 2 else "#C61A74")
    P.add(s1, "bell")
    s2 = dome(1.0, 1.2, 0.5, 0.46)
    flat(s2)
    xform(s2, (0.03, -0.02, 0), (0, 0, 8))
    paint_faces_fn(s2, lambda c, n: VIO if n.z > 0.15 else IND)
    P.add(s2, "bell")
    s3 = lathe("cap", [(0.0, 1.43), (0.12, 1.41), (0.26, 1.35), (0.38, 1.27), (0.45, 1.22), (0.45, 1.2), (0.0, 1.2)], 12, VIO)
    flat(s3)
    xform(s3, (-0.03, 0.0, 0), (0, 0, -9))
    paint_faces_fn(s3, lambda c, n: WHT if (n.z > 0.5 and c.x < -0.02 and c.y < 0.1) else (CYA if n.z > 0.62 else VIO))
    P.add(s3, "bell_up")
    # ghost slabs (RGB split) peeking out behind the bell
    for col, off in ((CYA, (0.05, 0.06, 0.0)), (MAG, (-0.05, 0.07, 0.04))):
        g = dome(1.05 + off[2], 1.2 + off[2], 0.47, 0.44)
        flat(g)
        paint_solid(g, col)
        xform(g, off)
        P.add(g, "bell_up")
    # glowing core (visible through the slit gaps) + dark gap rings
    P.add(ell("core", (0, 0, 1.0), (0.28, 0.28, 0.2), 14, 8, color=CYA, mat="EMIT"), "core")
    P.add(ell("core2", (0, 0, 1.09), (0.22, 0.22, 0.1), 12, 6, color=MAG, mat="EMIT"), "core")
    # pixel eyes (square blocks), angry brow bars
    for sx in (1, -1):
        P.add(box("eye", (sx * 0.15, -0.5, 1.12), (0.12, 0.05, 0.12), rot=(0, 0, 0), color="#FFFFFF", radius=0.004, mat="EMIT"), "bell_up")
        P.add(box("pupil", (sx * 0.15 - sx * 0.02, -0.53, 1.1), (0.055, 0.03, 0.07), color="#1B1038", radius=0.002), "bell_up")
        P.add(box("brow", (sx * 0.16, -0.5, 1.22), (0.17, 0.05, 0.035), rot=(0, sx * -20, 0), color=IND, radius=0.003), "bell_up")
    P.add(box("mouth", (0, -0.5, 0.9), (0.16, 0.04, 0.03), color="#1B1038", radius=0.003), "bell_up")
    # tendrils
    for k, (x, y, fl, zs) in enumerate(tend):
        pts = [(x * 1.0, y * 1.0, 0.86)] + [(x * f, y * f, z) for f, z in zip(fl, zs)]
        sp = spline(pts, 3)
        n = len(sp)
        rr = [0.032 * (1 - i / (n - 1)) ** 0.8 + 0.006 for i in range(n)]
        t = tube(f"tendril{k}", sp, rr, 6, MAG if k % 2 == 0 else CYA)
        P.add(t, [f"t{k}_1", f"t{k}_2", f"t{k}_3"], 2.5)
        for j in range(3):
            p = V(sp[3 + j * 3]) if 3 + j * 3 < n else V(sp[-1])
            P.add(box("tick", tuple(p), (0.05, 0.05, 0.05), rot=(rng.uniform(0, 90), rng.uniform(0, 90), rng.uniform(0, 90)), color=CYA if k % 2 == 0 else MAG, radius=0.004, mat="EMIT"),
                  [f"t{k}_1", f"t{k}_2", f"t{k}_3"], 2.5)
    # orbiting pixel fragments
    for i in range(9):
        a = 2 * math.pi * i / 9 + 0.3
        r = 0.62 + 0.12 * ((i * 5) % 3) / 2
        z = 0.82 + 0.4 * ((i * 7) % 5) / 4
        sz = 0.05 + 0.045 * ((i * 3) % 3) / 2
        P.add(box("frag", (math.cos(a) * r, math.sin(a) * r, z), (sz, sz, sz), rot=(rng.uniform(0, 70), rng.uniform(0, 70), rng.uniform(0, 70)),
                  color=[CYA, MAG, WHT][i % 3], radius=0.003, mat="EMIT"), "orbit")
    return P, bones


def anims(rig):
    out = []
    TB = [f"t{k}_{n}" for k in range(NT) for n in (1, 2, 3)]

    def tend(t, amp=1.0, lag=0.55, ph=0.0, fwd=0.0, spread=0.0):
        r = {}
        for k in range(NT):
            for n in (1, 2, 3):
                p = t + k * 1.05 + ph - lag * n
                a = math.radians(k * 60 + 30)
                # sway tangentially + a little radial; fwd bends everything toward +Y (trailing) or -Y (whip)
                r[f"t{k}_{n}"] = (amp * 10 * S(p) + fwd * (-1 if math.sin(a) > 0 else 1) * 0 - fwd, amp * 6 * C(p * 0.8) + spread * math.cos(a) * 14, amp * 8 * S(p + 1.3))
        return r

    rig.begin("idle", loc=("root",), sc=("bell", "bell_up", "core", "orbit"))
    for i, f in enumerate(cyc(80, 10)):
        t = i / 10 * 2 * math.pi
        r = {"orbit": (0, 0, (i / 10) * 360), "bell": (3 * S(t), 3 * C(t), 3 * S(t)), "bell_up": (2 * S(t + 1), 0, -5 * S(t))}
        r.update(tend(t, 1.0))
        rig.key(f, r, {"root": (0, 0, 0.09 * S(t))}, {"bell": (1 + 0.04 * S(t * 2), 1 + 0.04 * S(t * 2), 1 - 0.05 * S(t * 2)), "core": 1 + 0.12 * S(t * 3), "bell_up": (1, 1, 1 + 0.03 * S(t * 2 + 1)), "orbit": 1})
    rig.end(); out.append("idle")

    rig.begin("attack", loc=("root",), sc=("bell", "bell_up", "core", "orbit"))
    ks = [(0, 0, 0, 0), (8, 0.0, 0.25, 0), (14, -0.9, 0.0, 1), (18, -1.1, -0.05, 1), (30, -0.2, 0.05, 0), (40, 0, 0, 0)]
    for f, y, z, hit in ks:
        w = {0: 0, 8: -1, 14: 1, 18: 1, 30: 0.2, 40: 0}[f]
        t = f * 0.4
        r = {"orbit": (0, 0, f * 30), "bell": (-14 * (w == -1) + 18 * (w == 1), 0, 0), "bell_up": (8 * (w == 1), 0, 20 * (w == 1))}
        r.update(tend(t, 1.0 - 0.5 * abs(w), fwd=(-45 * (w == 1) + 20 * (w == -1))))
        sq = {"bell": (1.12, 1.12, 0.78) if w == -1 else ((0.85, 0.85, 1.3) if w == 1 else (1, 1, 1)), "core": 1.7 if w == 1 else (0.6 if w == -1 else 1.0),
              "bell_up": (1, 1, 1), "orbit": 1.5 if w == 1 else 1.0}
        rig.key(f, r, {"root": (0, y, z)}, sq)
    rig.end(); out.append("attack")

    rig.begin("hit", loc=("root",), sc=("bell", "bell_up", "core", "orbit"))
    for f, y, sq, fl in ((0, 0, 1, 1), (3, 0.28, 0.72, 1.3), (7, 0.16, 1.18, 0.7), (12, 0.04, 0.95, 1.1), (18, 0, 1.0, 1.0)):
        r = {"bell": (-14 * (1 if f == 3 else 0.3 * (f == 7)), 0, 10 * (f == 3)), "bell_up": (0, 0, 24 * (f == 3) - 14 * (f == 7)), "orbit": (0, 0, f * 40)}
        r.update(tend(f * 0.5, 1.4, fwd=30 * (f == 3)))
        rig.key(f, r, {"root": (0, y, 0.04 * (f == 3))}, {"bell": (1 / sq ** 0.5 * 1.0 + (0.18 if f == 3 else 0), 1 / sq ** 0.5 + (0.18 if f == 3 else 0), sq), "bell_up": (1, 1, 1),
                                                     "core": fl, "orbit": 1.0})
    rig.end(); out.append("hit")

    rig.begin("death", loc=("root", "bell_up"), sc=("bell", "bell_up", "core", "orbit"))
    D = [(0, 0, 0, 1.0, 1.0, 1.0), (6, 0.06, 0.0, 1.25, 1.1, 1.0), (14, 0.0, 0.18, 1.4, 1.6, 1.0), (26, 0.0, 0.34, 1.1, 2.6, 0.8), (40, 0.0, -0.3, 0.6, 3.4, 0.35), (54, 0, -0.62, 0.05, 0.05, 0.02)]
    for f, y, dz, bs, os_, cs in D:
        r = {"orbit": (0, 0, f * 25), "bell_up": (0, 0, f * 3.0), "bell": (10 * S(f), 0, 0)}
        r.update(tend(f * 0.3, 1.0 + f / 30, fwd=f * 0.9, spread=f / 18))
        rig.key(f, r, {"root": (0, y, min(0, dz) if dz < 0 else 0), "bell_up": (0.0, 0.0, max(dz, 0) * 0.5)},
                {"bell": (bs, bs, bs * (1.0 if f < 40 else 0.7)), "bell_up": (bs * 1.1, bs * 1.1, bs * 0.9), "core": cs * (1.8 if f in (14, 26) else 1.0), "orbit": os_})
    rig.end(); out.append("death")
    return out


def build(man):
    P, bones = make()
    arm, body = creature_build(P, bones, "enemy_static_wisp", ao=0.08)
    rig = Rig(arm)
    an = anims(rig)
    finish(arm, body, "enemy_static_wisp", rig, "creature", ["verdant", "amber", "tide", "ember", "glass", "hollow", "seam"], an,
           extra={"faction": "static", "floats": True}, pose=("attack", 14), manifest=man, frame=1.0)
