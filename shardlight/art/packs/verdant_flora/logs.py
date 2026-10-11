from _h import *
from trees import trunk_path, trunk_radii, roots
from bushes import leafy_mass
from ground import blade_path


def sc_l(zone="forest", density=0.6, spacing=5.0, cluster=0.3, zw=None, group=None, slope=22, scale=(0.8, 1.25)):
    return sc(zone, density, spacing, slope, cluster, zw or {zone: 1.0}, scale, group, align=True)


def bark_log(o, L, seed, c0="#7C5548", c1="#D2A180"):
    paint(o, bark_fn(c0, c1, -L, L, seed, 1.2), 0.12, 0.12)


def shelf(R, rng, c0, c1, n=3):
    """Bracket fungus stack (half discs); local frame: wall at x=0, sticks out +X."""
    out = []
    for k in range(n):
        r = R * (1 - 0.22 * k)
        pf = [(r * 1.0, 0.0), (r * 0.96, 0.03), (r * 0.7, 0.06), (r * 0.35, 0.07), (0.0, 0.07)]
        o = lathe("sh", pf, 12, "VC", lambda i, a, rr, z: (1.0, 0.0), cap0=True, cap1=False)
        # keep only half: squash into half-disc by clamping verts behind wall
        for v in o.data.vertices:
            if v.co.x < 0:
                v.co.x *= 0.05
        paint(o, zg(c0, c1, 0.0, 0.08, 0.02), 0.2, 0.15)
        put(o, V((0.0, 0.0, 0.0)), scale=(1.0, 1.0, 1.0))
        put(o, V((0, 0, k * 0.12 * R / 0.3)), spin=rng.uniform(-25, 25))
        out.append(o)
    return out


def moss_cap(c, R, rng, n=5, z0=-0.1, z1=0.4, seed=0):
    return leafy_mass(c, R, (1.0, 1.0, 0.45), n, rng, ("#3FB878", "#C6F57E"), z0, z1, seed, (0.35, 0.5), (0.3, 0.9), 2)


# ---------------------------------------------------------------- hollow log
def hollow_log(aid, rng):
    parts = []
    L, Ro, Ri = 5.6, 1.5, 1.13
    ph = rng.uniform(0, 6)

    def rad(i, a, r, z):
        ridge = 1 + 0.045 * math.sin(11 * a + ph) + 0.03 * math.sin(17 * a) + 0.03 * math.sin(3 * a + z * 0.8)
        if abs(r - Ri) < 1e-3 or r < Ri * 1.05:
            return 1.0 + 0.02 * math.sin(7 * a), 0.0
        return ridge, 0.0
    prof = [(Ro, 0.2), (Ro, L * 0.5), (Ro, L - 0.2), (Ro * 0.97, L), (Ri * 1.06, L), (Ri, L - 0.15), (Ri, L * 0.5), (Ri, 0.15), (Ri * 1.06, 0.0), (Ro * 0.97, 0.0), (Ro, 0.2)]
    o = lathe("log", prof, 28, "VC_ROUGH", rad, cap0=False, cap1=False)
    # broken, uneven rim
    for v in o.data.vertices:
        r = math.hypot(v.co.x, v.co.y)
        if v.co.z > L - 0.3:
            v.co.z += noise.noise(V((v.co.x, v.co.y, 3.3)) * 1.5) * 0.18 * (1 if r > 0 else 0)
    # paint: bark outside, pale ring on rims, dark mossy inside
    def f(co, n):
        r = math.hypot(co.x, co.y)
        edge = min(co.z, L - co.z)
        outer = r > (Ri + Ro) / 2
        if outer:
            c = bark_fn("#6F4A44", "#C99A78", 0, L, 3, 1.3)(co, n)
            if edge < 0.12:
                c = sl.mix(c, "#E8C9A0", clamp(1 - edge / 0.12))
            return c
        c = sl.mix("#3E2A4A", "#8A6A62", clamp(1 - abs(math.atan2(co.y, co.x) - pi / 2) / 2.5) * 0.7 + nz(co, 2, 2.5) * 0.3)
        c = sl.mix(c, "#E8C9A0", clamp(1 - edge / 0.1) * 0.8 * clamp((r - Ri) / 0.2 + 0.2))
        return c
    paint(o, f, 0.14, 0.2)
    put(o, V((0, 0, 0)), up=V((1, 0, 0)))   # axis -> +X
    put(o, V((-L / 2, 0, Ro * 0.98)))
    parts.append(o)
    # soft mossy floor inside (walkable surface)
    fl = ball("floor", Ri * 0.92, 3, (L * 0.5 / (Ri * 0.92), 1.0, 0.22), 0.1, 1.0, 3, "VC_ROUGH")
    put(fl, V((0, 0, Ro * 0.98 - Ri * 0.78)))
    paint(fl, zg("#2F8F6E", "#7ED957", Ro * 0.98 - Ri, Ro * 0.98 - Ri * 0.5, 0.08), 0.15, 0.12)
    parts.append(fl)
    # moss on top + mushrooms + ferns at open ends
    parts += leafy_mass(V((-0.4, 0.15, Ro * 1.9 - 0.1)), 1.5, (1.7, 0.5, 0.35), 9, rng, ("#3FB878", "#C6F57E"), Ro * 1.7, Ro * 2.2, 5, (0.3, 0.45), (0.3, 0.9), 2)
    for k, (x, a_, rr) in enumerate([(-1.3, 40, 0.2), (0.9, 75, 0.17), (1.5, 20, 0.14)]):
        ang = math.radians(a_)
        pos = V((x, math.cos(ang) * Ro * 0.97, Ro * 0.98 + math.sin(ang) * Ro * 0.97))
        sh = shelf(rr, rng, "#FF5C98" if k % 2 == 0 else "#4FD6F5", "#FFB0CC" if k % 2 == 0 else "#B8F4FF", 3)
        for s_ in sh:
            put(s_, V((0, 0, 0)), up=None)
            put(s_, pos, up=V((0, math.cos(ang), math.sin(ang))), spin=0)
        parts += sh
    bt = Batch("tuft", "VC_FOLIAGE")
    for end in (-1, 1):
        for k in range(14):
            a = rng.uniform(0, 6.28)
            r = rng.uniform(0.3, 1.5)
            pts, ws, sv = blade_path(V((end * (L / 2 + rng.uniform(-0.2, 0.4)) , math.cos(a) * r * 0.9, 0.05)), 90 + rng.uniform(-60, 60), rng.uniform(0.3, 0.7), 0.5, 0.045)
            bt.ribbon(pts, ws, lambda co: sl.mix("#3FB35A", "#C6F57E", clamp(co.z / 0.6)), 0.3, 3, sv)
    parts.append(bt.obj())
    col = {"type": "box", "size": [round(L, 2), round(Ro * 2, 2), round(Ro * 2, 2)],
           "parts": [{"type": "box", "size": [L, 0.55, 1.4], "offset": [0, -(Ri + 0.2), 0.7]},
                     {"type": "box", "size": [L, 0.55, 1.4], "offset": [0, (Ri + 0.2), 0.7]},
                     {"type": "box", "size": [L, 2.4, 0.55], "offset": [0, 0, Ro * 2 - 0.27]}],
           "note": "walk-through hollow: use the compound `parts` (two flanks + roof); the outer box is only the bounding envelope"}
    return finish(parts, aid, "log", col, sc_l("forest", 0.15, 14.0, 0.0, {"forest": 1.0, "meadow": 0.3, "shore": 0.2}, None, 14, (0.9, 1.2)),
                  ao=0.4, elev=20, frame=1.0, center_xy=True)


reg("verdant_log_hollow")(hollow_log)


# ---------------------------------------------------------------- mossy fallen log
def mossy_log(aid, rng):
    parts = []
    L, R = 4.0, 0.55
    pts = [V((x, 0.1 * math.sin(x * 1.1), 0.0)) for x in [(-L / 2 + L * i / 9) for i in range(10)]]
    radii = [R * (1.0 - 0.18 * (i / 9)) * (1 + 0.05 * math.sin(i * 2.1)) for i in range(10)]
    t = tube("log", pts, 0, 0, 12, "VC_ROUGH", radii=radii)
    paint(t, bark_fn("#6F4A44", "#C99A78", -1, 1, 5, 1.3), 0.14, 0.16)
    parts.append(t)
    # end cap rings (pale cut at the thick end)
    cap = lathe("cut", [(0.0, 0.0), (R * 0.95, 0.0)], 14, "VC_ROUGH", cap0=False, cap1=False)
    paint(cap, lambda co, n: sl.mix("#F0D2A8", "#C9985E", 0.5 + 0.5 * math.sin(math.hypot(co.x, co.y) * 28)), 0.0, 0.1)
    put(cap, V((0, 0, 0)), up=V((-1, 0, 0)))
    put(cap, pts[0] + V((-0.01, 0, 0)))
    parts.append(cap)
    # stubs
    for k, (xf, yaw, pitch) in enumerate([(0.25, 90, 50), (0.55, -80, 40), (0.8, 100, 60)]):
        i = int(xf * 9)
        b, tip = (None, None)
        sp = grow(pts[i] + V((0, 0, R * 0.7)), dir_from(yaw, pitch), 0.6, (0, 0, 0.1), 3)
        st = tube("stub", sp, 0.08, 0.045, 6, "VC_ROUGH")
        paint(st, bark_fn("#6F4A44", "#C99A78", -1, 1, k), 0.12, 0.12)
        parts.append(st)
        # leaf sprig on stub
        for q in range(3):
            lf = blade("lf", sp[-1], q * 120 + yaw, 0.35, 0.8, 0.07, 4, "VC_FOLIAGE", 0.5)
            paint(lf, zg("#3FB878", "#C6F57E", sp[-1].z, sp[-1].z + 0.4, 0.05), 0.14, 0.15)
            parts.append(lf)
    parts += leafy_mass(V((0.2, 0.0, R * 0.85)), 1.6, (1.4, 0.35, 0.3), 8, rng, ("#3FB878", "#C6F57E"), R * 0.5, R * 1.4, 7, (0.28, 0.4), (0.3, 0.9), 2)
    for k, (x, a_, rr) in enumerate([(-0.8, 70, 0.14), (0.4, 30, 0.12), (1.1, 80, 0.1)]):
        ang = math.radians(a_)
        pos = V((x, math.cos(ang) * R * 0.96, math.sin(ang) * R * 0.96))
        for s_ in shelf(rr, rng, "#FFC23D", "#FFE9A0", 3):
            put(s_, pos, up=V((0, math.cos(ang), math.sin(ang))))
            parts.append(s_)
    for rt in roots(R * 1.1, 4, rng, 0.6, 0.25):
        paint(rt, bark_fn("#6F4A44", "#C99A78", 0, 0.5, 3), 0.1, 0.1)
        put(rt, V((0, 0, 0)), up=V((-1, 0, 0.3)))
        put(rt, pts[-1] + V((0.2, 0, 0)))
        parts.append(rt)
    return finish(parts, aid, "log", {"type": "convex"},
                  sc_l("forest", 0.6, 5.0, 0.3, {"forest": 1.0, "meadow": 0.5, "shore": 0.4}, "verdant_log", 22, (0.8, 1.3)), ao=0.4, elev=22, frame=1.05, center_xy=True)


reg("verdant_log_mossy")(mossy_log)


# ---------------------------------------------------------------- stump with mushrooms
def stump_shrooms(aid, rng):
    parts = []
    H, R = 0.85, 0.7
    prof = [(R * 1.1, 0.0), (R * 0.98, 0.12), (R * 0.88, 0.35), (R * 0.92, 0.6), (R * 0.86, H * 0.95), (R * 0.7, H)]
    ph = rng.uniform(0, 6)
    o = lathe("stump", prof, 20, "VC_ROUGH", lambda i, a, r, z: (1 + 0.1 * math.sin(5 * a + ph) * (1.4 if i < 2 else 0.5) + 0.04 * math.sin(11 * a) + (0.45 * max(0, math.sin(5 * a + ph)) ** 2 if i == 0 else 0.22 * max(0, math.sin(5 * a + ph)) ** 2 if i == 1 else 0.06 * max(0, math.sin(5 * a + ph)) ** 2 if i == 2 else 0), 0.12 * max(0, math.sin(5 * a + ph)) * (1 if i >= 5 else 0)), cap0=True, cap1=False)
    paint(o, lambda co, n: sl.mix(bark_fn("#6F4A44", "#C99A78", 0, H, 8, 1.3)(co, n), "#E8C9A0", clamp((co.z - H * 0.93) * 25) * (1 if math.hypot(co.x, co.y) < R * 0.95 else 0)), 0.14, 0.16)
    parts.append(o)
    # hollow dish on the top, filled with moss
    top = leafy_mass(V((0, 0, H - 0.02)), 0.62, (1, 1, 0.45), 6, rng, ("#3FB878", "#C6F57E"), H - 0.1, H + 0.3, 9, (0.3, 0.45), (0.2, 0.8), 2)
    parts += top
    cols = [("#FF5C98", "#FFB0CC"), ("#4FD6F5", "#B8F4FF"), ("#FFC23D", "#FFE9A0")]
    for k, (z, a_, rr) in enumerate([(0.3, 20, 0.28), (0.55, 140, 0.22), (0.25, 250, 0.2), (0.62, 320, 0.16)]):
        ang = math.radians(a_)
        pos = V((math.cos(ang) * R * 0.97, math.sin(ang) * R * 0.97, z))
        for s_ in shelf(rr, rng, cols[k % 3][0], cols[k % 3][1], 3):
            put(s_, pos, up=V((math.cos(ang), math.sin(ang), 0)), spin=0)
            parts.append(s_)
    # small standing mushrooms
    for k in range(3):
        a = k * 2.1 + 0.4
        base = V((math.cos(a) * 1.15, math.sin(a) * 1.15, 0.03))
        h = rng.uniform(0.1, 0.2)
        stm = lathe("st", [(0.025, 0), (0.02, h)], 7, "VC", cap0=True, cap1=False)
        paint(stm, solid(CREAM), 0.1, 0.1)
        cp = lathe("cp", [(0.07, 0.0), (0.06, 0.03), (0.03, 0.055), (0.0, 0.06)], 9, "VC", cap0=False)
        paint(cp, solid(["#FF5C98", "#4FD6F5", "#FFC23D"][k]), 0.2, 0.1)
        put(cp, V((0, 0, h)))
        for o_ in (stm, cp):
            put(o_, base)
            parts.append(o_)
    return finish(parts, aid, "log", cyl(R * 0.95, 0.9), sc_l("forest", 0.5, 5.0, 0.3, {"forest": 1.0, "meadow": 0.3, "shore": 0.3}, "verdant_stump", 20, (0.8, 1.3)),
                  ao=0.4, elev=26, frame=1.05, center_xy=True)


reg("verdant_log_stump_shrooms")(stump_shrooms)


# ---------------------------------------------------------------- cut stump with rings
def stump_rings(aid, rng):
    parts = []
    H, R = 0.6, 0.85
    ph = rng.uniform(0, 6)
    prof = [(R * 1.1, 0.0), (R * 0.98, 0.1), (R * 0.93, 0.3), (R * 0.96, 0.5), (R * 0.95, H - 0.04), (R * 0.9, H)] + [(R * 0.9 * (1 - i / 8.0), H + 0.01 * (1 - i / 8.0)) for i in range(1, 9)]
    o = lathe("stump", prof, 26, "VC_ROUGH", lambda i, a, r, z: (1 + 0.07 * math.sin(4 * a + ph) * (1.5 if i < 2 else 0.6) + 0.03 * math.sin(10 * a) + (0.5 * max(0, math.sin(4 * a + ph)) ** 2 if i == 0 else 0.25 * max(0, math.sin(4 * a + ph)) ** 2 if i == 1 else 0.07 * max(0, math.sin(4 * a + ph)) ** 2 if i == 2 else 0), 0.0), cap0=True, cap1=False)

    def f(co, n):
        r = math.hypot(co.x, co.y)
        if co.z > H - 0.03 and n.z > 0.5:
            ring = 0.5 + 0.5 * math.sin(r * 19 + nz(co, 1, 1.5) * 1.0)
            c = sl.mix("#F6DAAA", "#C58A52", ring * 0.9)
            c = sl.mix(c, "#8A4F3A", clamp((r - R * 0.9) / 0.1))
            return c
        return bark_fn("#6F4A44", "#C99A78", 0, H, 11, 1.4)(co, n)
    paint(o, f, 0.16, 0.18)
    parts.append(o)
    # sapling sprouting from the side + leaf tuft
    sp = grow(V((R * 0.9, 0.2, 0.3)), (0.6, 0.15, 0.8), 0.7, (0, 0, 0.2), 4)
    stt = tube("sprout", sp, 0.03, 0.012, 5, "VC_FOLIAGE")
    paint(stt, zg("#3FA98C", "#8FE08A", 0, 1.0, 0.03), 0.1, 0.1)
    parts.append(stt)
    for q in range(5):
        lf = blade("lf", sp[-1], q * 72, 0.3, 0.9, 0.07, 4, "VC_FOLIAGE", 0.5)
        paint(lf, zg("#3FB878", "#C6F57E", sp[-1].z, sp[-1].z + 0.3, 0.04), 0.14, 0.15)
        parts.append(lf)
    bt = Batch("g", "VC_FOLIAGE")
    for k in range(18):
        a = rng.uniform(0, 6.28)
        r = rng.uniform(0.9, 1.3)
        pts, ws, sv = blade_path(V((math.cos(a) * r, math.sin(a) * r, 0.02)), math.degrees(a) + rng.uniform(-50, 50), rng.uniform(0.15, 0.4), 0.6, 0.03)
        bt.ribbon(pts, ws, lambda co: sl.mix("#4FC860", "#CDF77E", clamp(co.z / 0.4)), 0.3, 3, sv)
    parts.append(bt.obj())
    return finish(parts, aid, "log", cyl(R * 0.95, 0.65), sc_l("forest", 0.5, 4.5, 0.3, {"forest": 1.0, "meadow": 0.6, "shore": 0.3}, "verdant_stump", 20, (0.8, 1.4)),
                  ao=0.4, elev=30, frame=1.05, center_xy=True)


reg("verdant_log_stump_cut")(stump_rings)


# ---------------------------------------------------------------- branch pile
def branch_pile(aid, rng):
    parts = []
    n = 11
    for k in range(n):
        L = rng.uniform(1.4, 2.8)
        r0 = rng.uniform(0.05, 0.14) * (1.3 if k < 3 else 1.0)
        yaw = k * 41 + rng.uniform(-20, 20)
        layer = 0 if k < 4 else 1 if k < 8 else 2
        z0 = 0.1 + layer * 0.17
        d = dir_from(yaw, rng.uniform(6, 18) + layer * 5)
        start = V((rng.uniform(-0.6, 0.6), rng.uniform(-0.5, 0.5), z0)) - d * L * 0.5
        pts = grow(start, d, L, (rng.uniform(-.1, .1), rng.uniform(-.1, .1), 0.05), 5)
        t = tube("br", pts, r0, r0 * 0.4, 6, "VC_ROUGH", power=0.9)
        paint(t, bark_fn("#6F4A44", "#C99A78", -1, 1, k, 1.3), 0.14, 0.16)
        parts.append(t)
        # twig fork
        if k % 2 == 0:
            i = 3
            sp = grow(pts[i], dir_from(yaw + rng.choice((-1, 1)) * 40, 35), 0.7, (0, 0, 0.1), 3)
            tw = tube("tw", sp, r0 * 0.5, 0.012, 5, "VC_ROUGH")
            paint(tw, bark_fn("#6F4A44", "#C99A78", -1, 1, k + 20, 1.0), 0.14, 0.16)
            parts.append(tw)
    parts += leafy_mass(V((0.1, 0.0, 0.42)), 1.1, (1.2, 0.7, 0.3), 6, rng, ("#3FB878", "#C6F57E"), 0.2, 0.7, 4, (0.28, 0.4), (0.2, 0.9), 2)
    for k in range(10):
        a = rng.uniform(0, 6.28)
        lf = blade("lf", V((math.cos(a) * 0.7, math.sin(a) * 0.5, 0.5)), rng.uniform(0, 360), 0.3, 0.9, 0.06, 3, "VC_FOLIAGE", 0.5)
        paint(lf, zg("#3FB878", "#D0F77C", 0.3, 0.9, 0.05), 0.14, 0.15)
        parts.append(lf)
    for k, (x, y, z) in enumerate([(0.5, 0.3, 0.55), (-0.5, -0.1, 0.5)]):
        for s_ in shelf(0.1, rng, "#B58CFF", "#E4D0FF", 2):
            put(s_, V((x, y, z)), up=V((0.3, 0.5, 0.8)))
            parts.append(s_)
    return finish(parts, aid, "log", {"type": "convex"}, sc_l("forest", 0.8, 3.5, 0.4, {"forest": 1.0, "meadow": 0.5, "shore": 0.3}, "verdant_branchpile", 25, (0.8, 1.3)),
                  ao=0.4, elev=30, frame=1.05, center_xy=True)


reg("verdant_log_branch_pile")(branch_pile)
