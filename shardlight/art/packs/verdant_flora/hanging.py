from _h import *
from trees import pod, tether, POD_COLS, roots
from ground import blade_path, sc_g


def sc_h(zone="any", density=0.5, spacing=6.0, cluster=0.3, zw=None, group=None, alt=(2.5, 12.0), **kw):
    d = sc(zone, density, spacing, 90, cluster, zw or {zone: 1.0}, (0.8, 1.3), group, **kw)
    d["altitude_range"] = list(alt)
    return d


def hang_extra(**kw):
    e = {"hangs": True, "origin_note": "origin at lowest point; geometry rises to attachment point at `height`"}
    e.update(kw)
    return e


def heart_leaf(p, yaw, L, rng, c=("#2FA58C", "#9BEA8A")):
    cy, sy = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    pts = [p, p + V((cy * L * 0.4, sy * L * 0.4, -L * 0.1)), p + V((cy * L * 0.75, sy * L * 0.75, -L * 0.28)), p + V((cy * L, sy * L, -L * 0.5))]
    lf = ribbon("lf", pts, [0.0, L * 0.34, L * 0.3, 0.0], "VC_FOLIAGE", 0.4, 3, (-sy, cy, 0))
    paint(lf, zg(c[0], c[1], p.z - L, p.z, 0.05), 0.15, 0.2)
    return lf


def vine_strand(x, y, top, L, rng, sway=0.12, r0=0.022, ph=0.0, curl_up=0.0):
    n = 11
    pts = []
    for i in range(n + 1):
        t = i / n
        pts.append(V((x + sway * math.sin(t * 5 + ph) * t, y + sway * 0.7 * math.cos(t * 4 + ph) * t, top - L * t + curl_up * max(0, t - 0.8) ** 2 * 6)))
    tb = tube("vine", pts, max(r0 * 1.8, 0.05), 0.03, 5, "VC_FOLIAGE", power=0.7)
    paint(tb, solid("#46B886"), 0, 0)
    return tb, pts


def vines_a(aid, rng):
    parts = []
    top = 3.4
    # root crown at the top
    for k in range(5):
        b = ball("crown", rng.uniform(0.2, 0.3), 2, (1.4, 0.9, 0.7), 0.25, 0.8, k, "VC_ROUGH")
        put(b, V((-0.8 + k * 0.4, rng.uniform(-0.08, 0.08), top + 0.02)))
        paint(b, zg("#6F4A44", "#B07A5A", top - 0.2, top + 0.2, 0.06), 0.1, 0.12)
        parts.append(b)
    for s in range(5):
        x = -0.85 + s * 0.42 + rng.uniform(-0.05, 0.05)
        L = rng.uniform(1.8, 3.2)
        tb, pts = vine_strand(x, rng.uniform(-0.06, 0.06), top, L, rng, 0.14, 0.03, rng.uniform(0, 6), 0.3)
        parts.append(tb)
        nl = int(L / 0.42)
        for k in range(nl):
            p = pts[min(len(pts) - 1, 1 + int(k / max(nl, 1) * (len(pts) - 2)))]
            parts.append(heart_leaf(p, (k % 2) * 180 + rng.uniform(-30, 30), rng.uniform(0.34, 0.5), rng))
    return finish(parts, aid, "hanging", None, sc_h("forest", 0.6, 5.0, 0.4, {"forest": 1.0, "cliff": 0.8, "meadow": 0.2}, "verdant_hang_vines", (2.5, 14)),
                  ao=0.3, elev=8, frame=1.0, extra=hang_extra(), budget="hanging")


def vines_b(aid, rng):
    parts = []
    top = 4.8
    n = 18
    pts = []
    for i in range(n + 1):
        t = i / n
        a = t * 4.5 * pi
        pts.append(V((0.25 * math.sin(a) * (0.4 + t), 0.25 * math.cos(a) * (0.4 + t), top - 4.5 * t)))
    tb = tube("vine", pts, 0.08, 0.04, 6, "VC_FOLIAGE", power=0.8)
    paint(tb, solid("#3FB88C"), 0, 0)
    parts.append(tb)
    for k in range(9):
        idx = 3 + k * 1 if k < 9 else 17
        p = pts[min(idx, n)]
        a = k * 2.4
        ped = [p, p + V((math.cos(a) * 0.1, math.sin(a) * 0.1, -0.04)), p + V((math.cos(a) * 0.17, math.sin(a) * 0.17, -0.14))]
        pt = tube("ped", ped, 0.008, 0.005, 4, "VC_FOLIAGE")
        paint(pt, solid("#5FC08A"), 0.1, 0.1)
        parts.append(pt)
        # glowing bell (EMIT)
        h = 0.3 - 0.01 * k
        r = 0.13 - 0.004 * k
        prof = [(r * 1.15, -h), (r * 0.9, -h * 0.72), (r * 0.62, -h * 0.4), (r * 0.3, -h * 0.1), (0.0, 0.0)]
        bell = lathe("bell", prof, 10, "EMIT", lambda i, a_, rr, z: ((1 + 0.1 * math.sin(5 * a_)), 0.0) if i == 0 else (1.0, 0.0), cap0=False, cap1=False)
        paint(bell, zg("#C8FFF6", "#5FE0F0", -h, 0, 0.0))
        put(bell, ped[-1], up=V((math.cos(a) * 0.15, math.sin(a) * 0.15, 1)))
        tipb = bead("cl", r * 0.2, "EMIT", 3, 5)
        paint(tipb, solid("#FFE9A0"))
        put(tipb, ped[-1] + V((0, 0, -h * 0.85)))
        parts += [bell, tipb]
        if k % 2 == 0:
            parts.append(heart_leaf(p + V((0, 0, -0.1)), a * 57 + 90, 0.24, rng))
    # curly tendrils
    for k in range(4):
        p = pts[4 + k * 3]
        tp = []
        for i in range(10):
            t = i / 9
            ang = t * 4.5
            tp.append(p + V((math.cos(k * 1.7) * 0.25 * t + 0.07 * math.sin(ang), math.sin(k * 1.7) * 0.25 * t + 0.07 * (1 - math.cos(ang)), -0.15 * t - 0.05 * t * t)))
        tt = tube("tendril", tp, 0.007, 0.003, 4, "VC_FOLIAGE")
        paint(tt, solid("#7EDB9A"), 0.1, 0.1)
        parts.append(tt)
    return finish(parts, aid, "hanging", None, sc_h("forest", 0.4, 7.0, 0.3, {"forest": 1.0, "cliff": 0.7}, "verdant_hang_vines", (3.0, 14)),
                  ao=0.25, elev=8, frame=1.0, extra=hang_extra(), budget="hanging")


def vines_c(aid, rng):
    parts = []
    top = 2.8
    for k in range(5):
        b = ball("crown", rng.uniform(0.18, 0.26), 2, (1.4, 0.9, 0.7), 0.25, 0.8, k, "VC_ROUGH")
        put(b, V((-0.7 + k * 0.35, rng.uniform(-0.06, 0.06), top + 0.02)))
        paint(b, zg("#6F4A44", "#B07A5A", top - 0.2, top + 0.2, 0.06), 0.1, 0.12)
        parts.append(b)
    for s in range(3):
        x = -0.6 + s * 0.6
        L = rng.uniform(1.8, 2.5)
        tb, pts = vine_strand(x, 0, top, L, rng, 0.1, 0.02, rng.uniform(0, 6), 0.0)
        parts.append(tb)
        for k in range(14):
            t = k / 13
            p = pts[min(len(pts) - 1, 1 + int(t * (len(pts) - 2)))]
            for side in (-1, 1):
                r = 0.1 * (1 - t * 0.5)
                b = bead("fl", r, "VC_FOLIAGE", 2, 5)
                cc = [("#C79CFF", "#E6D2FF"), ("#FF9ACB", "#FFD0E6"), ("#9A8CFF", "#D0C8FF")][(s + k // 8) % 3]
                paint(b, solid(mix_h2(cc[0], cc[1], (k % 3) / 3)), 0.2, 0.1)
                put(b, p + V((side * 0.07 * (1 - t * 0.5) + rng.uniform(-.015, .015), rng.uniform(-.04, .04), -0.01 * k)), scale=(1, 1, 1.3))
                parts.append(b)
        for k in range(3):
            parts.append(heart_leaf(pts[1 + k], k * 180 + 30, 0.22, rng))
    return finish(parts, aid, "hanging", None, sc_h("forest", 0.5, 6.0, 0.4, {"forest": 0.8, "meadow": 0.5, "cliff": 0.6}, "verdant_hang_vines", (2.0, 12)),
                  ao=0.25, elev=8, frame=1.0, extra=hang_extra(), budget="hanging")


def mix_h2(a, b, t):
    c = sl.mix(a, b, t)
    return "#%02x%02x%02x" % tuple(int(clamp(x) * 255) for x in c)


reg("verdant_hang_vines_a")(vines_a)
reg("verdant_hang_vines_glowbell")(vines_b)
reg("verdant_hang_vines_wisteria")(vines_c)


# ---------------------------------------------------------------- floating seed pods
def seedpods(aid, rng):
    parts = []
    knot = ball("knot", 0.22, 3, (1.2, 1.0, 0.8), 0.25, 0.8, 3, "VC_FOLIAGE")
    put(knot, V((0, 0, 0.0)))
    paint(knot, zg("#2FA58C", "#8FE08A", -0.2, 0.2, 0.05), 0.15, 0.15)
    parts.append(knot)
    specs = [(0.0, 0.0, 1.4, 0.55), (0.55, 0.25, 1.1, 0.4), (-0.5, 0.3, 0.9, 0.34), (0.15, -0.55, 1.7, 0.3), (-0.15, 0.45, 2.1, 0.26)]
    for i, (dx, dy, rise, r) in enumerate(specs):
        top = V((dx, dy, rise))
        parts.append(tether(V((0, 0, 0.1)), top, rng, rng.uniform(0.2, 0.45)))
        c1, c2 = POD_COLS[(i + 1) % len(POD_COLS)]
        pp = pod(r, c1, c2, rng.uniform(0.95, 1.15), 6, rng, 14)
        for o in pp:
            put(o, top + V((0, 0, -r * 0.1)), spin=rng.uniform(0, 360))
        parts += pp
    for k in range(4):
        a = k * 90 + 20
        pts = grow(V((0, 0, -0.1)), dir_from(a, -40), 0.7, (0, 0, -0.3), 4)
        t = tube("rt", pts, 0.07, 0.035, 5, "VC_FOLIAGE", power=0.8)
        paint(t, solid("#B08A6A"), 0, 0)
        parts.append(t)
    return finish(parts, aid, "hanging", None, sc_h("meadow", 0.5, 7.0, 0.5, {"meadow": 1.0, "forest": 0.5, "cliff": 0.6}, "verdant_float_pods", (1.5, 10), vertical_bob=True),
                  ao=0.3, elev=15, frame=1.0, extra={"floating": True})


reg("verdant_float_seedpods")(seedpods)


# ---------------------------------------------------------------- drifting petals
def petalswirl(aid, rng):
    parts = []
    cols = [(PINK, "#FFB0CC"), (YELLOW, "#FFF0B0"), (CYAN, "#C9F6FF"), ("#FF8AB4", "#FFD0E2"), (VIOLET, "#E0D0FF")]
    for k in range(15):
        t = k / 14
        a = t * 5.2 + rng.uniform(-0.3, 0.3)
        r = 0.5 + 0.7 * math.sin(t * 3.0) ** 2 + rng.uniform(0, 0.3)
        z = 0.1 + t * 1.5 + rng.uniform(-0.15, 0.15)
        L = rng.uniform(0.8, 1.1)
        p = petal("fp", L, L * 0.5, rng.uniform(40, 75), rng.uniform(5, 45), 0.55, 3, 0.0, "VC_FOLIAGE", base_w=0.35, across=3)
        cc = cols[k % len(cols)]
        paint(p, (lambda co, n, cc=cc, L=L: cc[0] if co.length < L * 0.5 else cc[1]), 0, 0)
        put(p, V((math.cos(a) * r, math.sin(a) * r, z)), up=V((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.3, 1))), spin=rng.uniform(0, 360))
        parts.append(p)
    for k in range(4):
        a = rng.uniform(0, 6.28)
        lf = blade("lf", V((math.cos(a) * 0.8, math.sin(a) * 0.8, rng.uniform(0.3, 1.3))), rng.uniform(0, 360), 0.22, 0.9, 0.05, 3, "VC_FOLIAGE", 0.5)
        paint(lf, zg("#2FA58C", "#9BEA8A", 0, 1.6, 0.04), 0.14, 0.15)
        parts.append(lf)
    return finish(parts, aid, "hanging", None, sc_h("meadow", 0.8, 5.0, 0.5, {"meadow": 1.0, "forest": 0.5, "shore": 0.5}, None, (0.5, 5.0)),
                  ao=0.2, elev=22, frame=1.0, extra={"floating": True, "note": "loose petals; each is a separate drifting shape in one mesh"})


reg("verdant_float_petals")(petalswirl)


# ---------------------------------------------------------------- dangling roots piece
def dangling_roots(aid, rng):
    parts = []
    ch = ball("chunk", 0.95, 4, (1.15, 1.0, 0.5), 0.3, 0.55, 8, "VC_ROUGH")
    put(ch, V((0, 0, 2.2)))

    def f(co, n):
        t = clamp((co.z - 1.8) / 0.9)
        c = sl.mix(SOIL, LAV, clamp(t * 1.3 - 0.1))
        return c
    paint(ch, f, 0.14, 0.2)
    sl.tint_top(ch, "#7ED957", 0.55, 0.85)
    parts.append(ch)
    for k in range(9):
        a = k * 2.4 + rng.uniform(-0.3, 0.3)
        r0 = 0.75 * math.sqrt((k + 0.3) / 9)
        L = rng.uniform(1.0, 2.1)
        s = V((math.cos(a) * r0, math.sin(a) * r0 * 0.85, 2.0 - 0.25 * (1 - r0 / 0.8)))
        pts = []
        for i in range(8):
            t = i / 7
            pts.append(s + V((math.cos(a) * 0.12 * t + 0.1 * math.sin(t * 5 + k) * t, math.sin(a) * 0.12 * t + 0.1 * math.cos(t * 4 + k) * t, -L * t + 0.2 * max(0, t - 0.82) ** 2 * 8)))
        t_ = tube("rt", pts, 0.11 * (1.2 - r0), 0.04, 5, "VC_ROUGH", power=0.85)
        paint(t_, solid("#B07A5A" if k % 2 else "#C99A78"), 0, 0)
        parts.append(t_)
        if k % 3 == 0:
            for m in range(2):
                bd = bead("rb", 0.035, "VC_ROUGH", 3, 5)
                paint(bd, solid("#C99A78"), 0.1, 0.1)
                put(bd, pts[3 + m] + V((0.03, 0.02, 0)))
                parts.append(bd)
    # sprouts on top
    bt = Batch("sprout", "VC_FOLIAGE")
    for k in range(6):
        a = rng.uniform(0, 6.28)
        r = rng.uniform(0.0, 0.7)
        pts, ws, sv = blade_path(V((math.cos(a) * r, math.sin(a) * r, 2.55 - 0.3 * (r / 0.8) ** 2)), math.degrees(a) + rng.uniform(-40, 40), rng.uniform(0.3, 0.55), 0.5, 0.1)
        bt.ribbon(pts, ws, lambda co: sl.mix("#4FC860", "#C6F57E", clamp((co.z - 2.3) / 0.6)), 0.3, 3, sv)
    parts.append(bt.obj())
    return finish(parts, aid, "hanging", None, sc_h("cliff", 0.5, 5.0, 0.4, {"cliff": 1.0, "meadow": 0.3}, None, (3.0, 20)),
                  ao=0.35, elev=10, frame=1.0, extra=hang_extra(), budget="hanging")


reg("verdant_hang_roots_chunk")(dangling_roots)


# ---------------------------------------------------------------- floating lily island
def lily_island(aid, rng):
    parts = []
    ph = rng.uniform(0, 6)
    prof = [(0.0, -1.35), (0.18, -1.15), (0.5, -0.82), (0.86, -0.48), (1.15, -0.2), (1.28, 0.0), (1.24, 0.07)]

    def rad(i, a, r, z):
        return 1 + 0.12 * math.sin(3 * a + ph) + 0.07 * math.sin(7 * a + 1) * (i / 6), 0.04 * math.sin(5 * a + i) * (i / 6)
    body = lathe("body", prof, 22, "VC_ROUGH", rad, cap0=False, cap1=False)
    for v in body.data.vertices:
        v.co += V((noise.noise(v.co * 2.0 + V((1, 2, 3))) * 0.08, noise.noise(v.co * 2.0 + V((4, 5, 6))) * 0.08, noise.noise(v.co * 2.0 + V((7, 8, 9))) * 0.1))

    def f(co, n):
        t = clamp((co.z + 1.35) / 1.4)
        c = sl.mix(SOIL, LAV, clamp(t * 1.5 - 0.1))
        c = sl.mix(c, "#C3C8EE", clamp(nz(co, 3, 3.0) * 1.2) * 0.25)
        return c
    paint(body, f, 0.12, 0.22)
    parts.append(body)
    cap = lathe("cap", [(1.24, 0.07), (1.18, 0.12), (0.8, 0.17), (0.4, 0.2), (0.0, 0.21)], 22, "VC_FOLIAGE", lambda i, a, r, z: (1 + 0.12 * math.sin(3 * a + ph) + 0.07 * math.sin(7 * a + 1) * (1 if i < 1 else 0.6), 0.0), cap0=False, cap1=False)
    paint(cap, lambda co, n: sl.mix("#4FC860", "#C6F57E", clamp(1.0 - math.hypot(co.x, co.y) / 1.2) * 0.8 + nz(co, 1, 3) * 0.2), 0.14, 0.1)
    parts.append(cap)
    # grass fringe + tuft
    bt = Batch("g", "VC_FOLIAGE")
    for k in range(14):
        a = rng.uniform(0, 6.28)
        r = rng.uniform(0.0, 1.1)
        pts, ws, sv = blade_path(V((math.cos(a) * r, math.sin(a) * r, 0.18)), math.degrees(a) + rng.uniform(-60, 60), rng.uniform(0.18, 0.5), 0.5, 0.035)
        bt.ribbon(pts, ws, lambda co: sl.mix("#4FC860", "#CDF77E", clamp((co.z - 0.15) / 0.5)), 0.3, 3, sv)
    parts.append(bt.obj())
    # small pond lily pad + flower
    for k, (x, y, R) in enumerate([(0.45, -0.2, 0.3), (-0.4, 0.35, 0.22)]):
        p = pad_small(R, rng)
        put(p, V((x, y, 0.19)))
        parts.append(p)
    for q in range(6):
        pt = petal("b", 0.2, 0.07, 25 + q % 2 * 20, 22, 0.5, 3, 0.01, "VC_FOLIAGE", base_w=0.4, across=3)
        paint(pt, dg("#FFD6E6", PINK, 0, 0.22, 0.02), 0.15, 0.1)
        put(pt, spin=q * 60)
        put(pt, V((0.45, -0.2, 0.22)))
        parts.append(pt)
    # glowing motes beneath/around
    for k in range(7):
        a = rng.uniform(0, 6.28)
        b = bead("m", rng.uniform(0.035, 0.06), "EMIT", 3, 6)
        paint(b, solid(["#9DF2FF", "#FFE9A0", "#B0FFD9"][k % 3]))
        put(b, V((math.cos(a) * rng.uniform(0.5, 1.3), math.sin(a) * rng.uniform(0.5, 1.3), rng.uniform(-1.4, 0.9))))
        parts.append(b)
    # dangling roots
    for k in range(5):
        a = rng.uniform(0, 6.28)
        r0 = rng.uniform(0.1, 0.6)
        L = rng.uniform(0.6, 1.5)
        s = V((math.cos(a) * r0, math.sin(a) * r0, -1.0 + r0 * 0.3))
        pts = [s + V((0.1 * math.sin(t * 4 + k) * t, 0.1 * math.cos(t * 3 + k) * t, -L * t)) for t in (0, 0.2, 0.4, 0.6, 0.8, 1.0)]
        t_ = tube("rt", pts, 0.09, 0.04, 5, "VC_ROUGH", power=0.85)
        paint(t_, solid("#B07A5A" if k % 2 else "#C99A78"), 0, 0)
        parts.append(t_)
    return finish(parts, aid, "hanging", None, sc_h("any", 0.35, 12.0, 0.2, {"meadow": 1.0, "shore": 0.6, "forest": 0.5, "cliff": 0.6}, None, (3.0, 25)),
                  ao=0.35, elev=14, frame=1.0, extra={"floating": True, "landmark_small": True}, budget="hanging")


def pad_small(R, rng):
    o = lathe("pad", [(0.0, 0.0), (R * 0.5, 0.005), (R * 0.9, 0.02), (R, 0.04)], 14, "VC_FOLIAGE", cap0=False, cap1=False)
    paint(o, rg("#2FA58C", "#9BEA8A", 0, R, 0.05), 0.2, 0.15)
    return o


reg("verdant_float_lily_island")(lily_island)


# ---------------------------------------------------------------- spore puff (EMIT)
def spore_puff(aid, rng):
    parts = []
    cols = ["#7AE7FF", "#9DF2C8", "#B8A8FF", "#FFE9A0"]
    for k in range(11):
        a = k * 2.4
        r = 0.2 + 0.45 * math.sqrt(k / 10)
        z = 0.5 + 0.7 * math.sin(k * 1.3) + k * 0.05
        R = rng.uniform(0.12, 0.26) * (1.5 if k == 0 else 1.0)
        c = cols[k % 4] if k else cols[0]
        core = bead("s", R, "EMIT", 6, 12)
        paint(core, zg(mix_h2(c, "#FFFFFF" if False else PALE, 0.45), c, -R, R, 0.0))
        pos = V((math.cos(a) * r * (0.0 if k == 0 else 1), math.sin(a) * r * (0.0 if k == 0 else 1), z))
        put(core, pos)
        parts.append(core)
        # soft halo shell: larger dim sphere
    # wispy tendrils trailing downward
    for k in range(6):
        a = k * 60 + 10
        pts = []
        for i in range(8):
            t = i / 7
            pts.append(V((math.cos(math.radians(a)) * (0.15 + 0.12 * t) + 0.08 * math.sin(t * 6 + k), math.sin(math.radians(a)) * (0.15 + 0.12 * t) + 0.08 * math.cos(t * 5 + k), 0.5 - 0.5 * t)))
        rb = ribbon("tn", pts, [0.05, 0.05, 0.045, 0.04, 0.03, 0.02, 0.01, 0.0], "EMIT", 0.3, 3, (math.cos(math.radians(a) + 1.5), math.sin(math.radians(a) + 1.5), 0))
        paint(rb, zg("#7AE7FF", "#2F6FA8", 0.0, 0.5, 0.0))
        parts.append(rb)
    for k in range(18):
        a = rng.uniform(0, 6.28)
        d = rng.uniform(0.3, 0.95)
        b = bead("m", rng.uniform(0.012, 0.03), "EMIT", 3, 5)
        paint(b, solid(["#C8FFF6", "#FFF3B0"][k % 2]))
        put(b, V((math.cos(a) * d, math.sin(a) * d, rng.uniform(-0.1, 1.7))))
        parts.append(b)
    return finish(parts, aid, "hanging", None, sc_h("forest", 0.6, 4.0, 0.6, {"forest": 1.0, "cliff": 0.6, "meadow": 0.3}, None, (0.4, 3.0)),
                  ao=0.0, elev=15, frame=1.0, extra={"floating": True, "emissive": True, "light_hint": {"color": "#7AE7FF", "energy": 0.8, "range": 4.0}}, budget="hanging")


reg("verdant_float_spore_puff")(spore_puff)
