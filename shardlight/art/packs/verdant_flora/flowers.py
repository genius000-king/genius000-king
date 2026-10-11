from _h import *
from trees import trunk_path, trunk_radii

STEM_C = ("#2FA58C", "#8FE08A")


def knob(name, r, squash=(1, 1, 1), mat="VC_FOLIAGE", sides=8, rings=4):
    o = bead(name, r, mat, rings, sides)
    if squash != (1, 1, 1):
        put(o, scale=squash)
    return o



def stem(h, rng, lean=(0.04, 0.0), r0=0.012, r1=0.009, sides=5, seg=6, hair=False, ease=1.8, c=STEM_C):
    pts = arc_pts(h, lean[0] * h, lean[1] * h, seg, ease)
    o = tube("stem", pts, r0, r1, sides, "VC_FOLIAGE")
    paint(o, zg(c[0], c[1], 0, h, 0.04), 0.1, 0.15)
    return o, pts


def leaves(n, L, W, rng, c=("#2FA58C", "#9BEA8A"), lean=0.7, curl=0.0, z=0.0, spread=0.0, cup=0.4):
    out = []
    for k in range(n):
        yaw = 360.0 * k / n + rng.uniform(-20, 20)
        o = blade("lf", V((math.cos(math.radians(yaw)), math.sin(math.radians(yaw)), 0)) * spread + V((0, 0, z)), yaw,
                  L * rng.uniform(0.75, 1.15), lean, W, 5, "VC_FOLIAGE", cup, curl)
        paint(o, zg(c[0], c[1], z, z + L * 0.9, 0.04), 0.14, 0.15)
        out.append(o)
    return out


def clump(make, n, spread, rng, scale=(0.8, 1.15), tilt=0.1):
    parts = []
    for i in range(n):
        s = rng.uniform(*scale)
        ps = make(rng, i)
        a = rng.uniform(0, 2 * pi)
        rad = spread * (rng.random() ** 0.6) if i else 0.0
        loc = V((math.cos(a) * rad, math.sin(a) * rad, 0))
        up = V((rng.uniform(-tilt, tilt), rng.uniform(-tilt, tilt), 1))
        sp = rng.uniform(0, 360)
        for p in ps:
            put(p, loc, up=up, spin=sp, scale=s)
        parts += ps
    return parts


def sc_flower(zone="meadow", density=1.0, spacing=0.7, cluster=0.7, zw=None, group=None, slope=32, scale=(0.8, 1.3)):
    return sc(zone, density, spacing, slope, cluster, zw or {zone: 1.0, "any": 0.2}, scale, group)


def head_ring(parts, n, c0, c1, L, W, tilt, curl, cup, r0=0.0, seg=4, spin0=0.0, base_w=0.3, shape=None, notch=0.0, prefix="p", mat="VC_FOLIAGE", lit=0.12):
    ps = petal_ring(n, spin0, prefix, L=L, W=W, tilt=tilt, curl=curl, cup=cup, seg=seg, r0=r0, mat=mat, base_w=base_w, shape=shape, notch=notch, across=5 if cup >= 0.5 else 3)
    for p in ps:
        paint(p, dg(c0, c1, r0 * 0.5, L + r0, 0.03), lit, 0.08)
    parts += ps
    return ps




def cup_bloom(R, H, lobes, tbl, c0, c1, rng, sides=18, tip_amp=0.22, pinch=0.12, seam=0.16, seed=0):
    """Smooth lathe cup (tulip/poppy). tbl = [(r_rel, t), ...] bottom->top; lobed rim; painted petal seams."""
    prof = [(R * r, H * t) for r, t in tbl]
    n = len(prof)
    ph = rng.uniform(0, 6)

    def radial(i, a, r, z):
        if i >= n - 1:
            k = max(0.0, math.cos(lobes * 0.5 * (a + ph))) ** 0.8
            return 1.0 - pinch * (1 - k), H * tip_amp * k
        if i == n - 2:
            k = max(0.0, math.cos(lobes * 0.5 * (a + ph))) ** 1.2
            return 1.0, H * tip_amp * 0.25 * k
        return 1.0, 0.0
    o = lathe("cup", prof, sides, "VC_FOLIAGE", radial, cap0=True, cap1=False)

    def fn(co, nrm):
        t = clamp(co.z / (H * (1 + tip_amp)))
        c = sl.mix(c0, c1, t ** 0.85)
        a = math.atan2(co.y, co.x)
        s = abs(math.cos(lobes * 0.5 * (a + ph)))
        s = clamp((0.25 - (1 - s)) * 4.0) if False else (1 - s)
        c = sl.mix(c, SHADOW, clamp((s - 0.88) * 8.0) * seam * (0.4 + 0.6 * t))
        return c
    paint(o, fn, 0.14, 0.12)
    return [o]


TULIP_TBL = [(0.28, 0.0), (0.62, 0.12), (0.92, 0.38), (1.0, 0.62), (0.88, 0.86), (0.7, 1.0)]
POPPY_TBL = [(0.22, 0.0), (0.7, 0.2), (1.05, 0.5), (1.3, 0.8), (1.45, 1.0)]


# ---------------------------------------------------------------------------- tulips
def tulip(aid, rng, cols, h, narrow, n=4):
    def one(rng, i):
        hh = h * rng.uniform(0.8, 1.15)
        st, pts = stem(hh, rng, (rng.uniform(-0.12, 0.12), rng.uniform(-0.1, 0.1)), 0.013, 0.01)
        parts = [st]
        parts += leaves(2, hh * 0.75, 0.045, rng, lean=0.9, curl=0.25)
        top = pts[-1]
        hp = cup_bloom(0.055 * (1.0 - narrow * 0.15), 0.15 + 0.03 * narrow, 6, TULIP_TBL if not narrow else [(0.2, 0.0), (0.55, 0.15), (0.85, 0.45), (0.95, 0.7), (0.85, 0.9), (0.6, 1.0)], cols[0], cols[1], rng, tip_amp=0.2 + 0.2 * narrow, pinch=0.1 + 0.2 * narrow)
        for p in hp:
            put(p, top, up=(pts[-1] - pts[-2]).normalized() + V((0, 0, 0.5)))
        parts += hp
        return parts
    return clump(one, n, 0.18, rng)


for nm, cols, h, nar in [("tulip_pink", (CREAM, PINK), 0.5, 0.0), ("tulip_gold", ("#FFE070", "#FF9F45"), 0.65, 0.5)]:
    reg(f"verdant_flower_{nm}")(lambda aid, rng, cols=cols, h=h, nar=nar: finish(
        tulip(aid, rng, cols, h, nar), aid, "flower", None,
        sc_flower("meadow", 1.2, 0.5, 0.8, {"meadow": 1.0, "shore": 0.3}, "verdant_flower_tulip"), ao=0.3, elev=24, frame=1.05))


# ---------------------------------------------------------------------------- bellflower
def bell(r, h, c0, c1, rng, sides=10):
    prof = [(r * 1.2, -h), (r * 0.92, -h * 0.75), (r * 0.62, -h * 0.42), (r * 0.34, -h * 0.12), (0.0, 0.0)]
    ph = rng.uniform(0, 6)
    o = lathe("bell", prof, sides, "VC_FOLIAGE", lambda i, a, rr, z: ((1 + 0.08 * math.sin(5 * a)), 0.0) if i == 0 else (1.0, 0.0), cap0=False, cap1=False)
    paint(o, zg(c1, c0, -h, 0, 0.03), 0.1, 0.25)
    cl = bead("clap", r * 0.22, "VC_FOLIAGE", 3, 5)
    put(cl, V((0, 0, -h * 0.82)))
    paint(cl, solid(CREAM), 0.1, 0.1)
    return [o, cl]


def bellflower(aid, rng):
    def one(rng, i):
        h = 0.95 * rng.uniform(0.85, 1.1)
        pts = []
        for k in range(9):
            t = k / 8
            pts.append(V((0.32 * math.sin(t * 1.9) * h, 0.0, h * (math.sin(t * 1.5) / math.sin(1.5)) * 0.92)))
        st = tube("stem", pts, 0.012, 0.008, 5, "VC_FOLIAGE")
        paint(st, zg(*STEM_C, 0, h, 0.04), 0.1, 0.15)
        parts = [st] + leaves(3, 0.4, 0.035, rng, lean=0.8)
        cols = [("#7B6CFF", "#C3D2FF"), ("#52C8F5", "#C9F4FF")][i % 2]
        for k in range(4):
            idx = 3 + k // 2 + (k % 2) * 0
            p0 = pts[min(8, 4 + k)]
            side = 1 if k % 2 else -1
            ped = [p0, p0 + V((0.05 * side, 0.02 * (k - 2), -0.005)), p0 + V((0.09 * side, 0.03 * (k - 2), -0.04))]
            pt = tube("ped", ped, 0.005, 0.004, 4, "VC_FOLIAGE")
            paint(pt, solid("#5FC08A"), 0.1, 0.1)
            parts.append(pt)
            bl = bell(0.05, 0.1, cols[0], cols[1], rng)
            for o in bl:
                put(o, ped[-1], up=V((0.15 * side, 0.1, 1)), spin=rng.uniform(0, 360), scale=1.0 - k * 0.07)
            parts += bl
        return parts
    return clump(one, 2, 0.2, rng, (0.9, 1.1), 0.05)


reg("verdant_flower_bellflower")(lambda aid, rng: finish(
    bellflower(aid, rng), aid, "flower", None, sc_flower("meadow", 0.9, 0.7, 0.6, {"meadow": 0.8, "forest": 0.7}, "verdant_flower_bell"), ao=0.3, elev=20, frame=1.05))


# ---------------------------------------------------------------------------- daisy cluster
def daisy_head(pet_c, center_c, R=0.1, n=16):
    parts = []
    head_ring(parts, n, pet_c[0], pet_c[1], R, 0.022, 78, 10, 0.2, 0.025, 2, 0, 0.9, shape=lambda t: 0.9 - 0.4 * t, notch=0.0)
    c = knob("c", 0.035, (1, 1, 0.55), "VC_FOLIAGE")
    paint(c, zg(center_c[0], center_c[1], -0.02, 0.03, 0.04), 0.1, 0.1)
    put(c, V((0, 0, 0.01)))
    parts.append(c)
    return parts


def daisy(aid, rng, pet_c, center_c, nh=4):
    def one(rng, i):
        h = rng.uniform(0.3, 0.55)
        st, pts = stem(h, rng, (rng.uniform(-0.2, 0.2), rng.uniform(-0.2, 0.2)), 0.008, 0.006)
        parts = [st]
        hd = daisy_head(pet_c, center_c, rng.uniform(0.07, 0.1))
        d = (pts[-1] - pts[-2]).normalized()
        for o in hd:
            put(o, pts[-1], up=d + V((0, 0, 0.35)))
        parts += hd
        return parts
    parts = clump(one, nh, 0.2, rng, (0.8, 1.2), 0.1)
    parts += leaves(5, 0.2, 0.03, rng, lean=0.9)
    return parts


reg("verdant_flower_daisy_cream")(lambda aid, rng: finish(
    daisy(aid, rng, (CREAM, "#FFC0D8"), ("#FFD166", "#FF9F45"), 4), aid, "flower", None,
    sc_flower("meadow", 1.4, 0.45, 0.9, {"meadow": 1.0, "shore": 0.4}, "verdant_flower_daisy"), ao=0.3, elev=28, frame=1.05))
reg("verdant_flower_daisy_pink")(lambda aid, rng: finish(
    daisy(aid, rng, ("#FFD0E0", PINK), ("#7AE7FF", "#3FB7D8"), 4), aid, "flower", None,
    sc_flower("meadow", 1.1, 0.45, 0.9, {"meadow": 1.0, "forest": 0.3}, "verdant_flower_daisy"), ao=0.3, elev=28, frame=1.05))


# ---------------------------------------------------------------------------- lupine
def lupine(aid, rng):
    def one(rng, i):
        h = rng.uniform(1.0, 1.25)
        st, pts = stem(h, rng, (rng.uniform(-0.05, 0.05), 0.03), 0.015, 0.008, 6)
        parts = [st]
        parts += leaves(7, 0.38, 0.032, rng, lean=0.55, cup=0.5, spread=0.03)
        z0 = h * 0.45
        nw = 20
        cols = ["#8A5CFF", "#C06CFF", PINK, "#FFA3C8", "#FFD6E6"]
        for k in range(nw):
            t = k / (nw - 1)
            z = lerp(z0, h, t ** 0.9)
            p = pts[min(len(pts) - 1, int(z / h * (len(pts) - 1)))]
            q = pts[min(len(pts) - 1, int(z / h * (len(pts) - 1)) + 1)]
            base = V((lerp(p.x, q.x, 0.5), lerp(p.y, q.y, 0.5), z))
            rad = 0.045 * (1 - t * 0.7)
            for m in range(3):
                a = k * 1.7 + m * 2 * pi / 3
                d = V((math.cos(a), math.sin(a), 0.55)).normalized()
                fl = cone("fl", 0.03 * (1 - t * 0.5), 0.075 * (1 - t * 0.4), 5, "VC_FOLIAGE", False, 0.0)
                put(fl, base + V((math.cos(a), math.sin(a), 0)) * rad, up=d)
                c = cols[min(len(cols) - 1, int(t * len(cols)))]
                paint(fl, zg(mix_hex(c, "#FFFFFF" if False else PALE, 0.25), c, 0, 0.06, 0.0), 0.12, 0.2)
                parts.append(fl)
        return parts
    return clump(one, 2, 0.2, rng, (0.9, 1.1), 0.05)


def mix_hex(a, b, t):
    c = sl.mix(a, b, t)
    return "#%02x%02x%02x" % tuple(int(clamp(x) * 255) for x in c)


reg("verdant_flower_lupine")(lambda aid, rng: finish(
    lupine(aid, rng), aid, "flower", None, sc_flower("meadow", 0.8, 0.9, 0.7, {"meadow": 1.0, "forest": 0.3, "cliff": 0.3}, "verdant_flower_lupine"),
    ao=0.3, elev=15, frame=1.0))


# ---------------------------------------------------------------------------- night bloom (EMIT)
def nightbloom(aid, rng):
    parts = []

    def one(rng, i):
        h = rng.uniform(0.55, 0.85)
        st, pts = stem(h, rng, (rng.uniform(-0.15, 0.15), rng.uniform(-0.1, 0.1)), 0.014, 0.01, 6, 6, c=("#1F7F78", "#6FD6A0"))
        ps = [st] + leaves(3, 0.35, 0.04, rng, c=("#1F7F78", "#5FCB9A"), lean=0.8)
        top = pts[-1]
        hd = []
        head_ring(hd, 8, "#6E5BD6", "#B7A4FF", 0.2, 0.062, 26, 22, 0.7, 0.01, 3, 0, 0.45, prefix="o")
        head_ring(hd, 6, "#4A3FA8", "#8F7BFF", 0.14, 0.05, 12, 14, 0.7, 0.01, 3, 30, 0.45, prefix="i")
        glow = knob("glow", 0.06, (1, 1, 1.2), "EMIT")
        paint(glow, zg("#8FF0FF", "#D6FFFF", -0.05, 0.06, 0.0))
        put(glow, V((0, 0, 0.13)))
        hd.append(glow)
        for k in range(6):
            a = k * 60
            sp = [V((0, 0, 0.06)), V((math.cos(math.radians(a)) * 0.035, math.sin(math.radians(a)) * 0.035, 0.15)),
                  V((math.cos(math.radians(a)) * 0.07, math.sin(math.radians(a)) * 0.07, 0.24))]
            tb = tube("fil", sp, 0.004, 0.002, 4, "VC_FOLIAGE")
            paint(tb, solid("#B7A4FF"), 0.1, 0.1)
            tp = bead("tip", 0.03, "EMIT", 3, 6)
            put(tp, sp[-1])
            paint(tp, solid("#FFD166" if k % 2 else "#FF9ACB"))
            hd += [tb, tp]
        for o in hd:
            put(o, top, up=(pts[-1] - pts[-2]).normalized() + V((0, 0, 0.5)))
        return ps + hd
    return clump(one, 2, 0.2, rng, (0.9, 1.1), 0.06)


reg("verdant_flower_nightbloom")(lambda aid, rng: finish(
    nightbloom(aid, rng), aid, "flower", None, sc_flower("forest", 0.7, 0.9, 0.7, {"forest": 1.0, "meadow": 0.35, "cliff": 0.4}, "verdant_flower_nightbloom"),
    ao=0.25, elev=22, frame=1.05))


# ---------------------------------------------------------------------------- star flower
def starflower(aid, rng):
    def star(R):
        ps = []
        head_ring(ps, 5, "#FFB43D", "#FFE066", R, R * 0.5, 82, 6, 0.15, 0.015, 2, 0, 1.0, shape=lambda t: 1 - t * 0.95, notch=0.0, prefix="s")
        head_ring(ps, 5, "#FF6A5A", "#FFB43D", R * 0.55, R * 0.3, 70, 4, 0.2, 0.01, 2, 36, 1.0, shape=lambda t: 1 - t * 0.95, prefix="t")
        c = knob("c", R * 0.16, (1, 1, 0.8), "VC_FOLIAGE")
        paint(c, solid("#FF7A8A"), 0.1, 0.1)
        put(c, V((0, 0, 0.02)))
        ps.append(c)
        return ps

    def one(rng, i):
        h = rng.uniform(0.3, 0.5)
        st, pts = stem(h, rng, (rng.uniform(-0.2, 0.2), rng.uniform(-0.2, 0.2)), 0.009, 0.007)
        parts = [st] + leaves(4, 0.2, 0.03, rng, lean=0.9)
        hd = star(0.13 * rng.uniform(0.85, 1.1))
        for o in hd:
            put(o, pts[-1], up=V((0.0, 0.0, 1)) + (pts[-1] - pts[-2]))
        parts += hd
        # side bloom
        if i % 2 == 0:
            sp = arc_pts(h * 0.4, 0.14, 0.06, 4, 1.4)
            sp = [p + pts[3] for p in sp]
            sb = tube("sb", sp, 0.007, 0.005, 4, "VC_FOLIAGE")
            paint(sb, zg(*STEM_C, 0, h, 0.04), 0.1, 0.1)
            parts.append(sb)
            for o in star(0.09):
                put(o, sp[-1], up=V((0.4, 0.2, 1)))
                parts.append(o)
        return parts
    return clump(one, 3, 0.22, rng, (0.9, 1.15), 0.1)


reg("verdant_flower_star")(lambda aid, rng: finish(
    starflower(aid, rng), aid, "flower", None, sc_flower("meadow", 1.0, 0.5, 0.8, {"meadow": 1.0, "cliff": 0.3}, "verdant_flower_star"), ao=0.3, elev=30, frame=1.05))


# ---------------------------------------------------------------------------- lotus
def lotus(aid, rng):
    parts = []
    # big round leaves (cupped discs) on short stalks
    for k, (x, y, r, z) in enumerate([(-0.38, 0.12, 0.34, 0.03), (0.34, -0.2, 0.3, 0.02)]):
        pr = [(0.0, -0.02), (r * 0.5, 0.0), (r * 0.9, 0.05), (r, 0.09), (r * 0.96, 0.095)]
        pad = lathe("pad", pr, 16, "VC_FOLIAGE", cap0=True, cap1=False)
        paint(pad, rg("#2FA58C", "#8FE08A", 0, r, 0.05, k), 0.2, 0.2)
        put(pad, V((x, y, z)), spin=k * 40)
        parts.append(pad)
    # stalk
    st, pts = stem(0.55, rng, (0.05, 0.02), 0.022, 0.016, 6, 6, c=("#3FA98C", "#9BEA8A"))
    parts.append(st)
    top = pts[-1]
    hd = []
    cols = [(("#FFD6E6", "#FF6FA0"), 9, 78, 8, 0.2, 0.2), (("#FFE6EE", "#FF8AB4"), 8, 55, 14, 0.19, 0.17), (("#FFF1E6", "#FFA0C0"), 6, 30, 16, 0.16, 0.14)]
    for li, (cc, n, tl, cu, L, W) in enumerate(cols):
        head_ring(hd, n, cc[0], cc[1], L, W * 0.5, tl, cu, 0.5, 0.02, 4, li * 20, 0.35, prefix=f"l{li}", shape=lambda t: (0.5 + 0.5 * math.sin(t * pi * 0.9)) * (1 - t ** 4))
    pod = lathe("pod", [(0.0, 0.0), (0.04, 0.0), (0.055, 0.04), (0.05, 0.06), (0.0, 0.06)], 8, "VC_FOLIAGE", cap0=False)
    paint(pod, zg("#C6F57E", "#FFE08A", 0, 0.06, 0.02), 0.1, 0.1)
    put(pod, V((0, 0, 0.02)))
    hd.append(pod)
    for o in hd:
        put(o, top, scale=1.0)
    parts += hd
    return parts


reg("verdant_flower_lotus")(lambda aid, rng: finish(
    lotus(aid, rng), aid, "flower", None, sc_flower("shore", 0.6, 1.4, 0.5, {"shore": 1.0}, "verdant_flower_lotus", 8), ao=0.3, elev=28, frame=1.05))


# ---------------------------------------------------------------------------- poppy
def poppy(aid, rng):
    def one(rng, i):
        h = rng.uniform(0.45, 0.7)
        pts = arc_pts(h, rng.uniform(-0.12, 0.12) * h, rng.uniform(-0.12, 0.12) * h, 7, 1.7)
        st = tube("stem", pts, 0.01, 0.008, 5, "VC_FOLIAGE")
        paint(st, zg("#3FA98C", "#A0E08A", 0, h, 0.04), 0.1, 0.1)
        parts = [st] + leaves(4, 0.28, 0.035, rng, lean=0.9, curl=0.3)
        top = pts[-1]
        hd = cup_bloom(0.12, 0.1, 4, POPPY_TBL, "#E0305A", "#FF9A6A", rng, 16, 0.3, 0.0, 0.25)
        c = knob("c", 0.03, (1, 1, 1.0), "VC_FOLIAGE")
        paint(c, solid("#3D2E5A"), 0.1, 0.1)
        put(c, V((0, 0, 0.03)))
        hd.append(c)
        for k in range(5):
            a = k * 72
            b = bead("st", 0.009, "VC_FOLIAGE", 3, 4)
            put(b, V((math.cos(math.radians(a)) * 0.045, math.sin(math.radians(a)) * 0.045, 0.045)))
            paint(b, solid("#FFD166"))
            hd.append(b)
        up = V((rng.uniform(-.2, .2), rng.uniform(-.2, .2), 1))
        for o in hd:
            put(o, top, up=up)
        parts += hd
        if i == 0:   # nodding bud
            bp = [V((0.12, 0, 0.15)), V((0.15, 0, 0.35)), V((0.12, 0.0, 0.5)), V((0.06, 0, 0.55))]
            bs = tube("bs", [p + V((0.12, 0.1, 0)) for p in bp], 0.006, 0.005, 4, "VC_FOLIAGE")
            paint(bs, solid("#4FB58A"), 0.1, 0.1)
            bb = knob("bud", 0.045, (1, 1, 1.4), "VC_FOLIAGE")
            paint(bb, solid("#E85A6A", 0.03), 0.1, 0.2)
            put(bb, bp[-1] + V((0.12, 0.1, -0.05)), up=V((0.2, 0, -1)))
            parts += [bs, bb]
        return parts
    return clump(one, 3, 0.2, rng, (0.9, 1.15), 0.08)


reg("verdant_flower_poppy")(lambda aid, rng: finish(
    poppy(aid, rng), aid, "flower", None, sc_flower("meadow", 1.0, 0.55, 0.85, {"meadow": 1.0}, "verdant_flower_poppy"), ao=0.3, elev=26, frame=1.05))


# ---------------------------------------------------------------------------- pompom (allium)
def pompom(aid, rng):
    def one(rng, i):
        h = rng.uniform(0.7, 1.05)
        st, pts = stem(h, rng, (rng.uniform(-0.08, 0.08), rng.uniform(-0.08, 0.08)), 0.013, 0.01, 6)
        parts = [st] + leaves(3, 0.45, 0.04, rng, lean=0.6, curl=0.2)
        R = 0.14 * rng.uniform(0.9, 1.15)
        cols = [("#B58CFF", "#FF9ACB"), ("#7AB8FF", "#C9A8FF"), ("#FF8AB4", "#FFD6E6")][i % 3]
        core = bead("core", R * 0.8, "VC_FOLIAGE", 4, 8)
        paint(core, solid(cols[0]), 0.1, 0.2)
        hd = [core]
        for d in fib_dirs_local(70):
            fl = cone("f", R * 0.22, R * 0.4, 4, "VC_FOLIAGE", False, 0.0)
            put(fl, d * R * 0.65, up=d)
            paint(fl, zg(cols[0], cols[1], 0.0, R * 0.38, 0.0) if False else solid(mix_hex(cols[0], cols[1], 0.5 + 0.5 * d.z)), 0.12, 0.2)
            hd.append(fl)
        for o in hd:
            put(o, pts[-1] + V((0, 0, R * 0.6)))
        return parts + hd
    return clump(one, 2, 0.18, rng, (0.9, 1.1), 0.05)


def fib_dirs_local(n):
    out = []
    for i in range(n):
        z = 1 - 2 * (i + 0.5) / n
        r = math.sqrt(max(0, 1 - z * z))
        ph = i * 2.399963
        out.append(V((r * math.cos(ph), r * math.sin(ph), z)))
    return out


reg("verdant_flower_pompom")(lambda aid, rng: finish(
    pompom(aid, rng), aid, "flower", None, sc_flower("meadow", 0.8, 0.8, 0.6, {"meadow": 1.0, "forest": 0.4}, "verdant_flower_pompom"), ao=0.3, elev=20, frame=1.0))


# ---------------------------------------------------------------------------- cosmos
def cosmos(aid, rng):
    def one(rng, i):
        h = rng.uniform(0.7, 1.1)
        st, pts = stem(h, rng, (rng.uniform(-0.1, 0.1), rng.uniform(-0.1, 0.1)), 0.009, 0.006)
        parts = [st]
        # feathery leaves: thin ribbons
        parts += leaves(5, 0.4, 0.012, rng, lean=0.5, curl=0.2, cup=0.1)
        for k, (t, off) in enumerate([(1.0, (0, 0)), (0.62, (0.12, 0.05)), (0.5, (-0.1, -0.08))]):
            idx = int(t * (len(pts) - 1))
            base = pts[idx] + (V((0, 0, 0)) if k == 0 else V((off[0] * 0.05, off[1] * 0.05, 0)))
            if k:
                sp = [base, base + V((off[0] * 0.5, off[1] * 0.5, 0.06)), base + V((off[0], off[1], 0.12))]
                sb = tube("sb", sp, 0.005, 0.004, 4, "VC_FOLIAGE")
                paint(sb, solid("#4FB58A"), 0.1, 0.1)
                parts.append(sb)
                base = sp[-1]
            hd = []
            cc = [("#FFD0E8", "#FF4FA8"), ("#FFE0F0", "#FF7AC0"), ("#FFFFFF" if False else PALE, "#E85CC0")][k]
            head_ring(hd, 8, cc[0], cc[1], 0.13, 0.05, 76, 8, 0.2, 0.02, 2, 0, 0.45, notch=0.04, prefix="c")
            c = knob("c", 0.03, (1, 1, 0.6), "VC_FOLIAGE")
            paint(c, solid("#FFC23D"), 0.1, 0.1)
            put(c, V((0, 0, 0.01)))
            hd.append(c)
            for o in hd:
                put(o, base, up=V((rng.uniform(-.25, .25), rng.uniform(-.25, .25), 1)), scale=1.0 - k * 0.12)
            parts += hd
        return parts
    return clump(one, 2, 0.2, rng, (0.9, 1.1), 0.06)


reg("verdant_flower_cosmos")(lambda aid, rng: finish(
    cosmos(aid, rng), aid, "flower", None, sc_flower("meadow", 1.0, 0.7, 0.7, {"meadow": 1.0, "shore": 0.5}, "verdant_flower_cosmos"), ao=0.3, elev=25, frame=1.0))


# ---------------------------------------------------------------------------- trumpet (morning glory)
def funnel(R, H, c_throat, c_rim, rng, sides=10, ribs=5):
    prof = [(R * 0.12, 0.0), (R * 0.16, H * 0.2), (R * 0.32, H * 0.5), (R * 0.65, H * 0.8), (R * 1.0, H)]
    ph = rng.uniform(0, 6)
    o = lathe("fun", prof, sides * 2, "VC_FOLIAGE", lambda i, a, r, z: ((1 + 0.06 * math.cos(ribs * a)) if i >= 3 else 1.0, 0.03 * H * math.cos(ribs * a) * (i >= 4)), cap0=False, cap1=False)

    def f(co, n):
        ang = math.atan2(co.y, co.x)
        t = clamp(co.z / H)
        c = sl.mix(c_throat, c_rim, t ** 0.8)
        rib = max(0.0, math.cos(ribs * ang)) ** 6
        return sl.mix(c, PALE, rib * 0.45 * t)
    paint(o, f, 0.1, 0.2)
    return [o]


def trumpet(aid, rng):
    parts = []
    # climbing, twisting vine with heart leaves + three trumpet blooms
    pts = []
    for k in range(14):
        t = k / 13
        pts.append(V((0.12 * math.sin(t * 9), 0.12 * math.cos(t * 9), 0.9 * t)))
    vn = tube("vine", pts, 0.012, 0.008, 5, "VC_FOLIAGE")
    paint(vn, zg("#2FA58C", "#8FE08A", 0, 0.9, 0.04), 0.1, 0.1)
    parts.append(vn)
    for k in range(7):
        p = pts[2 + k * 2 if 2 + k * 2 < 14 else 13]
        a = k * 2.3
        lp = [p, p + V((math.cos(a) * 0.07, math.sin(a) * 0.07, 0.02)), p + V((math.cos(a) * 0.14, math.sin(a) * 0.14, 0.0)), p + V((math.cos(a) * 0.2, math.sin(a) * 0.2, -0.03))]
        lf = ribbon("lf", lp, [0.02, 0.07, 0.065, 0.0], "VC_FOLIAGE", 0.4, 3, (-math.sin(a), math.cos(a), 0))
        paint(lf, solid("#3FB88A", 0.05), 0.14, 0.2)
        parts.append(lf)
    # pole
    pole = tube("pole", [V((0, 0, 0)), V((0, 0, 0.55)), V((0.0, 0, 1.0))], 0.016, 0.012, 5, "VC_ROUGH")
    paint(pole, bark_fn(BARK_DK, BARK_LT, 0, 1.0, 1), 0.1, 0.1)
    parts.append(pole)
    cols = [("#FFF6D0", "#4F8CFF"), ("#FFE9F2", "#C45CFF"), ("#FFF6D0", "#FF5CA0")]
    for k, (t, a) in enumerate([(0.95, 20), (0.62, 160), (0.4, 280)]):
        idx = int(t * 13)
        p = pts[idx]
        fl = funnel(0.12 * (1 - k * 0.1), 0.2, cols[k][0], cols[k][1], rng)
        for o in fl:
            put(o, p + V((0, 0, 0.0)), up=dir_from(a, 30 + k * 10), spin=a)
        parts += fl
    return parts


reg("verdant_flower_trumpet")(lambda aid, rng: finish(
    trumpet(aid, rng), aid, "flower", None, sc_flower("meadow", 0.7, 1.0, 0.6, {"meadow": 0.8, "shore": 0.6, "forest": 0.4}, "verdant_flower_trumpet"), ao=0.3, elev=22, frame=1.05))


# ---------------------------------------------------------------------------- fountain bloom (burst)
def fountain(aid, rng):
    parts = []
    parts += leaves(8, 0.9, 0.06, rng, lean=1.1, curl=0.35, cup=0.4)
    for s in range(2):
        h = 0.6 + 0.12 * s
        st, pts = stem(h, rng, (0.08 * (s - 0.5), 0.05 * (1 - s)), 0.014, 0.01)
        parts.append(st)
        top = pts[-1]
        n = 18
        for k in range(n):
            yaw = 360 * k / n + rng.uniform(-8, 8) + s * 15
            L = rng.uniform(0.45, 0.62)
            sp = []
            for i in range(4):
                t = i / 3
                x = L * 1.1 * t
                z = L * (1.1 * t - 0.95 * t * t) * 1.6
                sp.append(V((math.cos(math.radians(yaw)) * x, math.sin(math.radians(yaw)) * x, z)))
            fl = ribbon("fil", sp, [0.012, 0.022, 0.018, 0.0], "VC_FOLIAGE", 0.5, 3, (-math.sin(math.radians(yaw)), math.cos(math.radians(yaw)), 0))
            c = ["#3FC8F0", "#7AE7FF", "#B58CFF"][k % 3]
            paint(fl, zg(c, PINK, 0, L, 0.0), 0.1, 0.05)
            put(fl, top)
            tp = bead("tp", 0.048, "VC_FOLIAGE", 3, 6)
            paint(tp, solid([YELLOW, PINK, "#FF9ACB"][k % 3]), 0.15, 0.05)
            put(tp, top + sp[-1])
            parts += [fl, tp]
    return parts


reg("verdant_flower_fountain")(lambda aid, rng: finish(
    fountain(aid, rng), aid, "flower", None, sc_flower("meadow", 0.7, 0.9, 0.5, {"meadow": 1.0, "cliff": 0.3}, "verdant_flower_fountain"), ao=0.3, elev=24, frame=1.05))


# ---------------------------------------------------------------------------- wildflower patch
def mini_flower(c0, c1, r, rng):
    parts = []
    head_ring(parts, 5, c0, c1, r, r * 0.5, 70, 14, 0.2, r * 0.1, 2, rng.uniform(0, 72), 0.7, prefix="m")
    b = bead("c", r * 0.28, "VC_FOLIAGE", 3, 5)
    paint(b, solid(YELLOW), 0.1, 0.1)
    put(b, V((0, 0, r * 0.1)))
    parts.append(b)
    return parts


def wildpatch(aid, rng):
    parts = []
    mound = knob("mound", 0.5, (1.1, 1.0, 0.22), "VC_FOLIAGE")
    paint(mound, zg("#3FB88A", "#9BEA8A", 0, 0.08, 0.06), 0.15, 0.1)
    put(mound, V((0, 0, 0.01)))
    parts.append(mound)
    cols = [(CREAM, PINK), ("#FFF0B0", YELLOW), ("#D8F6FF", CYAN), ("#EBDDFF", VIOLET)]
    for k in range(15):
        a = k * 2.399 + rng.uniform(-0.3, 0.3)
        rad = 0.46 * math.sqrt((k + 0.5) / 15)
        h = rng.uniform(0.12, 0.34)
        base = V((math.cos(a) * rad, math.sin(a) * rad * 0.9, 0.04))
        sp = [base, base + V((rng.uniform(-.03, .03), rng.uniform(-.03, .03), h * 0.5)), base + V((rng.uniform(-.05, .05), rng.uniform(-.05, .05), h))]
        sm = tube("s", sp, 0.005, 0.004, 4, "VC_FOLIAGE")
        paint(sm, solid("#4FB58A"), 0.1, 0.1)
        parts.append(sm)
        cc = cols[k % len(cols)]
        for o in mini_flower(cc[0], cc[1], rng.uniform(0.05, 0.075), rng):
            put(o, sp[-1], up=V((rng.uniform(-.3, .3), rng.uniform(-.3, .3), 1)))
            parts.append(o)
    for k in range(16):
        a = k * 2.399 + 0.4
        rad = rng.uniform(0.18, 0.5)
        o = blade("g", V((math.cos(a) * rad, math.sin(a) * rad * 0.9, 0.03)), math.degrees(a) + rng.uniform(-50, 50), rng.uniform(0.12, 0.3), 0.6, 0.025, 4, "VC_FOLIAGE", 0.4)
        paint(o, zg("#3FB88A", "#B8F27C", 0, 0.3, 0.05), 0.14, 0.15)
        parts.append(o)
    return parts


reg("verdant_flower_wildpatch")(lambda aid, rng: finish(
    wildpatch(aid, rng), aid, "flower", None, sc_flower("meadow", 1.6, 1.2, 0.8, {"meadow": 1.0, "shore": 0.5, "forest": 0.3}, "verdant_flower_wildpatch", 30, (0.8, 1.5)), ao=0.3, elev=35, frame=1.05))


# ---------------------------------------------------------------------------- HERO A: sunbloom
def hero_a(aid, rng):
    parts = []
    H = 3.1
    pts = trunk_path(H, (0.5, 0.2), 0.12, 0.6, 9, 1.5)
    radii = [lerp(0.2, 0.12, i / 9) * (1 + 0.8 * max(0, 1 - i / 1.6) ** 2) for i in range(10)]
    st = tube("stem", pts, 0, 0, 10, "VC_FOLIAGE", radii=radii)
    paint(st, zg("#2F9E84", "#8FE08A", 0, H, 0.04), 0.1, 0.15)
    parts.append(st)
    # big leaves
    for k in range(5):
        yaw = 72 * k + 12
        z0 = 0.25 + 0.55 * k
        p0 = pts[min(9, int(z0 / H * 9))]
        pp = []
        ws = []
        L = 1.9 - 0.15 * k
        for i in range(8):
            t = i / 7
            x = L * t
            z = z0 + 0.5 * math.sin(t * 1.8) * L * 0.3 - 0.5 * t * t * L * 0.35
            pp.append(V((math.cos(math.radians(yaw)) * x + p0.x, math.sin(math.radians(yaw)) * x + p0.y, z)))
            ws.append(0.5 * math.sin(clamp(t * 1.1) * pi * 0.9) ** 0.8 * (0.6 if i == 0 else 1.0) * (1 - t ** 4) if i < 7 else 0.0)
        lf = ribbon("lf", pp, ws, "VC_FOLIAGE", 0.45, 5, (-math.sin(math.radians(yaw)), math.cos(math.radians(yaw)), 0))
        paint(lf, zg("#2FA58C", "#9BEA8A", 0, 4, 0.05), 0.14, 0.2)
        parts.append(lf)
    top = pts[-1]
    up = V((-0.55, -0.85, 0.75))
    hd = []
    layers = [(18, 1.15, 0.2, 80, 14, "#FFB04D", PINK), (16, 1.0, 0.19, 64, 18, "#FFC24D", "#FF8AB4"), (13, 0.8, 0.18, 46, 20, "#FFD166", "#FFB0CC")]
    for li, (n, L, W, tl, cu, c0, c1) in enumerate(layers):
        head_ring(hd, n, c0, c1, L, W, tl, cu, 0.4, 0.45, 5, li * 11, 0.6, prefix=f"l{li}", shape=lambda t: (0.55 + 0.45 * math.sin(t * pi * 0.8)) * (1 - t ** 4) ** 0.6)
    disc = lathe("disc", [(0.0, 0.0), (0.55, 0.02), (0.58, 0.1), (0.5, 0.2), (0.28, 0.27), (0.0, 0.3)], 24, "VC_FOLIAGE", cap0=False, cap1=False)
    paint(disc, rg("#B8742F", "#7A4A2A", 0, 0.6, 0.04), 0.1, 0.2)
    hd.append(disc)
    # golden-spiral seeds
    for k in range(120):
        r = 0.55 * math.sqrt((k + 0.5) / 120)
        a = k * 2.399963
        z = 0.3 * (1 - (r / 0.58) ** 2) + 0.03
        b = bead("sd", 0.034, "VC_FOLIAGE", 3, 5)
        put(b, V((math.cos(a) * r, math.sin(a) * r, z * 0.95 + 0.035)), scale=(1, 1, 0.8))
        paint(b, solid(mix_hex("#FFD166", "#FF8A3D", (k % 5) / 8)), 0.18, 0.1)
        hd.append(b)
    # sepals behind the head
    sp = []
    for k in range(12):
        s = ribbon("sep", [V((0.3, 0, -0.05)), V((0.62, 0, -0.15)), V((0.85, 0, -0.38))], [0.06, 0.12, 0.0], "VC_FOLIAGE", 0.3, 3, (0, 1, 0))
        put(s, spin=30 * k)
        paint(s, solid("#3FB88A", 0.05), 0.1, 0.2)
        hd.append(s)
    for o in hd:
        put(o, top, up=up)
    parts += hd
    # drifting petals + pollen motes (low gravity)
    for k in range(7):
        a = k * 51 + 10
        d = V((math.cos(math.radians(a)), math.sin(math.radians(a)), 0)) * rng.uniform(1.5, 2.2)
        p = petal("fp", 0.5, 0.11, 70, 25, 0.5, 4, 0.0, "VC_FOLIAGE", base_w=0.4)
        paint(p, dg(PINK, "#FFB0CC", 0, 0.5, 0.03), 0.1, 0.2)
        put(p, top + d + V((0, 0, rng.uniform(-0.8, 0.8))), up=V((rng.uniform(-1, 1), rng.uniform(-1, 1), 1.0)), spin=rng.uniform(0, 360))
        parts.append(p)
    for k in range(10):
        a = rng.uniform(0, 360)
        d = dir_from(a, rng.uniform(-10, 50)) * rng.uniform(1.0, 2.2)
        b = bead("pm", 0.06, "EMIT", 3, 6)
        paint(b, solid("#FFD166"))
        put(b, top + d)
        parts.append(b)
    return parts


reg("verdant_flower_hero_sunbloom")(lambda aid, rng: finish(
    hero_a(aid, rng), aid, "flower", cyl(0.2, 3.1), None, ao=0.35, elev=14, frame=0.95, budget="hero_flower",
    extra={"landmark": True, "note": "hand-placed hero landmark; collision cylinder at stalk"}))


# ---------------------------------------------------------------------------- HERO B: heartbloom (glowing lily)
def hero_b(aid, rng):
    parts = []
    H = 3.6
    pts = trunk_path(H, (-0.9, 0.5), 0.15, 2.2, 10, 1.7)
    radii = [lerp(0.22, 0.12, i / 10) * (1 + 0.9 * max(0, 1 - i / 1.8) ** 2) for i in range(11)]
    st = tube("stem", pts, 0, 0, 10, "VC_FOLIAGE", radii=radii)
    paint(st, zg("#2F9E84", "#9DEAA0", 0, H, 0.04), 0.1, 0.15)
    parts.append(st)
    # sword leaves
    for k in range(6):
        yaw = 60 * k + 5
        L = rng.uniform(2.2, 3.2)
        pp, ws = [], []
        for i in range(9):
            t = i / 8
            x = L * t * 0.8
            z = 0.1 + L * (1.2 * t - 0.95 * t * t) * 0.9
            pp.append(V((math.cos(math.radians(yaw)) * x, math.sin(math.radians(yaw)) * x, z)))
            ws.append(0.16 * math.sin(clamp(t * 1.15) * pi * 0.85) ** 0.6 * (1 - t ** 5) if i < 8 else 0.0)
        lf = ribbon("sw", pp, ws, "VC_FOLIAGE", 0.5, 5, (-math.sin(math.radians(yaw)), math.cos(math.radians(yaw)), 0))
        paint(lf, zg("#2FA58C", "#A8F29A", 0, 3, 0.05), 0.14, 0.2)
        parts.append(lf)
    top = pts[-1]
    up = V((-0.1, -0.4, 1.0))
    hd = []
    head_ring(hd, 6, "#B58CFF", "#FF8AC6", 2.1, 0.72, 20, 38, 0.6, 0.12, 6, 0, 0.3, prefix="o", shape=lambda t: (0.45 + 0.55 * math.sin(t * pi * 0.75)) * (1 - t ** 4) ** 0.5)
    head_ring(hd, 6, "#7AE7FF", "#C9A8FF", 1.7, 0.62, 10, 26, 0.7, 0.1, 6, 30, 0.3, prefix="i", shape=lambda t: (0.45 + 0.55 * math.sin(t * pi * 0.75)) * (1 - t ** 4) ** 0.5)
    # glowing pistil + stamens (EMIT)
    pistil = tube("pistil", [V((0, 0, 0)), V((0.02, 0, 0.7)), V((0.0, 0.03, 1.4)), V((-0.03, 0, 1.9))], 0.07, 0.03, 8, "VC_FOLIAGE")
    paint(pistil, solid("#CFF6FF"), 0.1, 0.1)
    hd.append(pistil)
    gl = knob("pg", 0.2, (1, 1, 1.25), "EMIT")
    paint(gl, zg("#6FE8FF", "#B8FFF2", -0.25, 0.25, 0.0))
    put(gl, V((-0.03, 0, 2.0)))
    hd.append(gl)
    for k in range(8):
        a = 45 * k
        d = V((math.cos(math.radians(a)), math.sin(math.radians(a)), 0))
        sp = [d * 0.08 + V((0, 0, 0.1)), d * 0.3 + V((0, 0, 0.9)), d * 0.62 + V((0, 0, 1.6))]
        tb = tube("fil", sp, 0.022, 0.012, 5, "VC_FOLIAGE")
        paint(tb, solid("#E9DEFF"), 0.1, 0.1)
        tp = knob("an", 0.075, (1, 1, 1.3), "EMIT")
        paint(tp, solid("#FFE07A" if k % 2 else "#FFB0E8"))
        put(tp, sp[-1], up=V((d.x, d.y, 1.0)))
        hd += [tb, tp]
    for o in hd:
        put(o, top, up=up)
    parts += hd
    # pollen motes spiraling above
    for k in range(22):
        a = k * 0.7
        z = 0.8 + k * 0.07
        r = 0.9 + 0.5 * math.sin(k * 0.9)
        b = bead("pm", rng.uniform(0.04, 0.09), "EMIT", 3, 6)
        paint(b, solid([YELLOW, "#9DF2FF", "#FFB0E0"][k % 3]))
        put(b, top + V((math.cos(a) * r - 0.5, math.sin(a) * r, z + 0.5)))
        parts.append(b)
    # side bud on its own stalk
    bp = trunk_path(2.6, (1.3, -0.9), 0.1, 0.5, 6, 1.3)
    bs = tube("bs", bp, 0.07, 0.04, 7, "VC_FOLIAGE")
    paint(bs, zg("#2F9E84", "#9DEAA0", 0, 2.6, 0.04), 0.1, 0.15)
    parts.append(bs)
    bud = []
    head_ring(bud, 5, "#8FA8FF", "#FF9ACB", 0.7, 0.28, 6, 14, 0.7, 0.04, 5, 0, 0.5, prefix="b", shape=lambda t: (0.5 + 0.5 * math.sin(t * pi * 0.75)) * (1 - t ** 3) ** 0.5)
    for o in bud:
        put(o, bp[-1], up=(bp[-1] - bp[-2]).normalized() + V((0.1, 0, 0.3)))
    parts += bud
    return parts


reg("verdant_flower_hero_heartbloom")(lambda aid, rng: finish(
    hero_b(aid, rng), aid, "flower", cyl(0.22, 3.6), None, ao=0.3, elev=14, frame=0.95, budget="hero_flower",
    extra={"landmark": True, "note": "hand-placed hero landmark; collision cylinder at stalk"}))
