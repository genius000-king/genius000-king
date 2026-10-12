from _h import *
from bushes import mix_h


def sc_g(zone="meadow", density=1.0, spacing=0.8, cluster=0.8, zw=None, group=None, slope=40, scale=(0.8, 1.3)):
    return sc(zone, density, spacing, slope, cluster, zw or {zone: 1.0}, scale, group)


def blade_path(base, yaw, h, lean=0.4, w=0.03, seg=4, curl=0.0):
    cy, sy = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    w = max(w * 2.0, 0.06)
    seg = min(seg, 3)
    pts, ws = [], []
    for i in range(seg + 1):
        t = i / seg
        x = h * lean * t ** 1.7 + curl * h * t ** 3
        z = h * t * (1 - 0.22 * lean * t)
        pts.append(V(base) + V((cy * x, sy * x, z)))
        ws.append(w * (1 - t) ** 0.8)
    ws[-1] = 0.0
    return pts, ws, (-sy, cy, 0)


def grass_tuft(aid, rng, n, hrange, wrange, lean, cols, spread, seed=0, tip=None, plumes=0):
    bt = Batch("blades", "VC_FOLIAGE")
    hmax = hrange[1]
    n = max(8, int(n * 0.4))            # comic: a few chunky blades, not hair
    for i in range(n):
        a = rng.uniform(0, 2 * pi)
        rad = spread * rng.random() ** 0.7
        base = V((math.cos(a) * rad, math.sin(a) * rad, 0))
        h = rng.uniform(*hrange) * (1.0 - 0.35 * rad / max(spread, 1e-3))
        yaw = math.degrees(a) + rng.uniform(-50, 50)
        wv = min(max(rng.uniform(*wrange) * 2.6, 0.06), 0.2 * h)
        pts, ws, sv = blade_path(base, yaw, h, rng.uniform(*lean), wv, 3, rng.uniform(-0.2, 0.35))
        c0 = vary(cols[0], rng, 0.01, 0.05, 0.05)
        c1 = vary(cols[1], rng, 0.015, 0.05, 0.05)
        bt.ribbon(pts, ws, lambda co, c0=c0, c1=c1: sl.mix(c0, c1, math.floor(clamp(co.z / hmax) * 2.99) / 2), 0.4, 3, sv)
    parts = [bt.obj()]
    for k in range(plumes):
        a = rng.uniform(0, 2 * pi)
        rad = spread * rng.random() * 0.8
        base = V((math.cos(a) * rad, math.sin(a) * rad, 0))
        h = rng.uniform(0.9, 1.25) * hmax * 1.2
        d = (math.cos(a) * 0.12, math.sin(a) * 0.12)
        sp = [base + V((d[0] * t * t * h, d[1] * t * t * h, h * t)) for t in (0, 0.4, 0.8, 1.0)]
        st = tube("pst", sp, 0.01, 0.006, 4, "VC_FOLIAGE")
        paint(st, zg("#4FBF6A", "#B8EF7A", 0, h, 0.03), 0.1, 0.1)
        parts.append(st)
        top = sp[-1]
        pl = ribbon("pl", [top - V((0, 0, 0.05)), top + V((0.02, 0, 0.1)), top + V((0.04, 0, 0.26)), top + V((0.03, 0, 0.4))], [0.0, 0.05, 0.045, 0.0], "VC_FOLIAGE", 0.5, 3, (-math.sin(a), math.cos(a), 0))
        paint(pl, zg("#FF9ACB", "#FFE0EE", top.z - 0.05, top.z + 0.4, 0.03), 0.15, 0.1)
        parts.append(pl)
    return parts


def fin_g(parts, aid, scat, collision=None, ao=0.3, elev=26, frame=1.05, cat="ground", extra=None):
    return finish(parts, aid, cat, collision, scat, ao=ao, elev=elev, frame=frame, extra=extra)


reg("verdant_ground_grass_tuft_a")(lambda aid, rng: fin_g(
    grass_tuft(aid, rng, 30, (0.55, 0.95), (0.03, 0.045), (0.35, 0.8), ("#52C85E", "#CDF77E"), 0.22),
    aid, sc_g("meadow", 1.6, 0.7, 0.8, {"meadow": 1.0, "forest": 0.4, "shore": 0.4, "cliff": 0.2}, "verdant_ground_grass_tuft", 45, (0.8, 1.5))))
reg("verdant_ground_grass_tuft_b")(lambda aid, rng: fin_g(
    grass_tuft(aid, rng, 38, (0.22, 0.42), (0.025, 0.04), (0.6, 1.1), ("#62D064", "#DDF98A"), 0.3),
    aid, sc_g("meadow", 2.0, 0.5, 0.9, {"meadow": 1.0, "shore": 0.6, "forest": 0.5, "cliff": 0.4}, "verdant_ground_grass_tuft", 50, (0.8, 1.5))))
reg("verdant_ground_grass_tuft_c")(lambda aid, rng: fin_g(
    grass_tuft(aid, rng, 20, (0.5, 0.85), (0.03, 0.04), (0.3, 0.7), ("#52C85E", "#C6F57E"), 0.2, plumes=8),
    aid, sc_g("meadow", 0.9, 1.0, 0.7, {"meadow": 1.0, "shore": 0.5}, "verdant_ground_grass_tuft", 35, (0.8, 1.4))))


# ---------------------------------------------------------------- clover patch
def z_ref(co):
    return 0.0


def clover(aid, rng):
    parts = []
    bt = Batch("clover", "VC_FOLIAGE")
    n = 22
    for k in range(n):
        a = k * 2.399963
        rad = 0.48 * math.sqrt((k + 0.5) / n)
        cx, cy = math.cos(a) * rad, math.sin(a) * rad * 0.92
        z = rng.uniform(0.03, 0.09)
        yaw = rng.uniform(0, 120)
        r = rng.uniform(0.1, 0.15)
        for m in range(3):
            ang = math.radians(yaw + 120 * m)
            lx, ly = cx + math.cos(ang) * r * 0.95, cy + math.sin(ang) * r * 0.95
            # leaflet: tilted hexagon disc
            def leaf(bm, lx=lx, ly=ly, z=z, r=r, ang=ang):
                vs = [bm.verts.new((lx - math.cos(ang) * r * 0.2, ly - math.sin(ang) * r * 0.2, z + 0.03))]
                ring = []
                N = 12
                for q in range(N):
                    aa = 2 * pi * q / N
                    dent = 1 - 0.55 * max(0.0, math.cos(aa - ang)) ** 18
                    rr = r * 0.9 * dent
                    ring.append(bm.verts.new((lx + math.cos(aa) * rr, ly + math.sin(aa) * rr * 0.92, z + 0.004 - 0.014 * (1 - math.cos(aa - ang)) * 0.5)))
                return [bm.faces.new((vs[0], ring[q], ring[(q + 1) % N])) for q in range(N)]
            col_c = sl.jitter(rng.choice(["#3FB878", "#4FC868", "#35AA7C"]), 0.015, 0.05, 0.05, rng)

            def colf(co, lx=lx, ly=ly, r=r, col_c=col_c):
                d = math.hypot(co.x - lx, co.y - ly) / (r * 0.95)
                v = sl.mix(sl.mix(col_c, "#9BEA8A", clamp(1 - d) * 0.25), "#C9F59A", clamp((0.45 - d) * 3.0) * 0.6 if co.z > z_ref(co) else 0.0)
                return sl.mix(v, PALE, clamp(1.0 - abs(math.hypot(co.x - lx, co.y - ly) / (r * 0.5) - 0.9)) * 0.25 if False else 0.0)
            bt.bm_geom(leaf, colf)
    parts.append(bt.obj())
    # stems under leaves are implied; add flower heads (white/pink pom)
    for k in range(5):
        a = rng.uniform(0, 6.28)
        rad = rng.uniform(0.05, 0.4)
        base = V((math.cos(a) * rad, math.sin(a) * rad, 0.04))
        h = rng.uniform(0.14, 0.24)
        st = tube("st", [base, base + V((0.01, 0, h * 0.5)), base + V((0.02, 0.01, h))], 0.006, 0.005, 4, "VC_FOLIAGE")
        paint(st, solid("#4FB58A"), 0.1, 0.1)
        hb = bead("h", 0.035, "VC_FOLIAGE", 4, 7)
        paint(hb, solid(["#FFD0E4", "#FFF1F6", "#FFB0D0"][k % 3]), 0.2, 0.1)
        put(hb, base + V((0.02, 0.01, h + 0.02)), scale=(1, 1, 1.15))
        parts += [st, hb]
    return parts


reg("verdant_ground_clover_patch")(lambda aid, rng: fin_g(
    clover(aid, rng), aid, sc_g("meadow", 1.3, 0.8, 0.9, {"meadow": 1.0, "shore": 0.5, "forest": 0.4}, None, 35, (0.8, 1.6)), elev=40))


# ---------------------------------------------------------------- reeds & cattails
def reeds(aid, rng):
    parts = grass_tuft(aid, rng, 16, (1.3, 2.1), (0.035, 0.05), (0.15, 0.4), ("#4FB86A", "#B8EF7A"), 0.25)
    # plume reeds
    for k in range(5):
        a = rng.uniform(0, 6.28)
        rad = rng.uniform(0.02, 0.25)
        base = V((math.cos(a) * rad, math.sin(a) * rad, 0))
        h = rng.uniform(1.8, 2.4)
        sp = [base + V((math.cos(a) * 0.06 * t * t * h, math.sin(a) * 0.06 * t * t * h, h * t)) for t in (0, 0.35, 0.7, 1.0)]
        st = tube("rst", sp, 0.014, 0.008, 5, "VC_FOLIAGE")
        paint(st, zg("#4FB86A", "#C8E888", 0, h, 0.03), 0.1, 0.1)
        top = sp[-1]
        for m in range(4):
            yaw = m * 90 + rng.uniform(-20, 20)
            pl = ribbon("pl", [top - V((0, 0, 0.1)), top + V((0.02, 0, 0.12)), top + V((0.05, 0, 0.3)), top + V((0.1, 0, 0.42))], [0.0, 0.05, 0.04, 0.0], "VC_FOLIAGE", 0.4, 3, (math.cos(math.radians(yaw)), math.sin(math.radians(yaw)), 0))
            paint(pl, zg("#C9A878", "#F2DDB0", top.z - 0.1, top.z + 0.42, 0.03), 0.15, 0.1)
            parts.append(pl)
        parts.append(st)
    return parts


def cattails(aid, rng):
    parts = grass_tuft(aid, rng, 14, (1.1, 1.8), (0.04, 0.055), (0.15, 0.45), ("#3FB36A", "#A8E878"), 0.3)
    for k in range(8):
        a = rng.uniform(0, 6.28)
        rad = rng.uniform(0.02, 0.3)
        base = V((math.cos(a) * rad, math.sin(a) * rad, 0))
        h = rng.uniform(1.3, 2.0)
        sp = [base + V((math.cos(a) * 0.05 * t * t * h, math.sin(a) * 0.05 * t * t * h, h * t)) for t in (0, 0.35, 0.7, 1.0)]
        st = tube("cst", sp, 0.014, 0.01, 5, "VC_FOLIAGE")
        paint(st, zg("#4FB86A", "#9CD878", 0, h, 0.03), 0.1, 0.1)
        top = sp[-1]
        hl = rng.uniform(0.22, 0.32)
        head = lathe("head", [(0.0, 0.0), (0.04, 0.02), (0.052, 0.07), (0.055, hl * 0.5), (0.05, hl * 0.9), (0.0, hl)], 9, "VC_FOLIAGE")
        paint(head, zg("#7A4A3A", "#A8654A", 0, hl, 0.04), 0.15, 0.15)
        put(head, top - V((0, 0, 0.06)), up=V((math.cos(a) * 0.05, math.sin(a) * 0.05, 1)))
        spike = tube("sp", [top + V((0, 0, hl - 0.07)), top + V((0.0, 0, hl + 0.1)), top + V((0, 0, hl + 0.25))], 0.014, 0.003, 4, "VC_FOLIAGE")
        paint(spike, solid("#E8C466"), 0.1, 0.1)
        parts += [st, head, spike]
    return parts


reg("verdant_ground_reeds")(lambda aid, rng: fin_g(
    reeds(aid, rng), aid, sc_g("shore", 1.4, 0.9, 0.9, {"shore": 1.0, "meadow": 0.15}, "verdant_ground_reed", 25, (0.8, 1.3)), elev=14, frame=1.0))
reg("verdant_ground_cattails")(lambda aid, rng: fin_g(
    cattails(aid, rng), aid, sc_g("shore", 1.0, 1.0, 0.9, {"shore": 1.0}, "verdant_ground_reed", 25, (0.8, 1.3)), elev=14, frame=1.0))


# ---------------------------------------------------------------- moss pad
def moss(aid, rng):
    parts = []

    def rad(i, a, r, z):
        return 1 + 0.12 * math.sin(3 * a + 0.5) + 0.07 * math.sin(5 * a + 2) + 0.04 * math.sin(9 * a), 0.0
    pad = lathe("moss", [(0.0, 0.22), (0.25, 0.2), (0.5, 0.16), (0.72, 0.1), (0.9, 0.04), (0.98, 0.0)], 28, "VC_ROUGH", rad, cap0=False, cap1=False)
    # bumps by noise displace
    for v in pad.data.vertices:
        v.co.z += noise.noise(v.co * 3.1 + V((3, 1, 2))) * 0.05 * (v.co.z > 0.01)
    paint(pad, lambda co, n: sl.mix(sl.mix("#3FB878", "#9BEA8A", clamp(co.z / 0.25) + nz(co, 2, 4.0) * 0.4), "#D2F77C", clamp(nz(co, 7, 3.5) * 1.5 - 0.5) * 0.7), 0.2, 0.12)
    parts.append(pad)
    # moss lumps
    for k in range(5):
        a = rng.uniform(0, 6.28)
        r_ = rng.uniform(0.1, 0.6)
        o = ball("l", rng.uniform(0.1, 0.17), 2, (1, 1, 0.6), 0.2, 0.8, k, "VC_ROUGH")
        z = 0.2 * (1 - (r_ / 1.0) ** 2) + 0.03
        put(o, V((math.cos(a) * r_, math.sin(a) * r_, z)))
        paint(o, zg("#3FB88A", "#B8F27C", 0.0, 0.35, 0.08, k), 0.2, 0.12)
        parts.append(o)
    # tiny pink star-flowers
    for k in range(4):
        a = rng.uniform(0, 6.28)
        r_ = rng.uniform(0.1, 0.65)
        z = 0.2 * (1 - (r_ / 1.0) ** 2) + 0.07
        fl = []
        head_ring_ = petal_ring(5, rng.uniform(0, 72), "m", L=0.11, W=0.04, tilt=75, curl=10, cup=0.2, seg=2, r0=0.01, mat="VC_FOLIAGE", base_w=0.8)
        for p in head_ring_:
            paint(p, dg(PINK, "#FFD0E2", 0, 0.08, 0.02), 0.15, 0.1)
            put(p, V((math.cos(a) * r_, math.sin(a) * r_, z)))
            parts.append(p)
        b = bead("c", 0.014, "VC_FOLIAGE", 3, 5)
        paint(b, solid(YELLOW))
        put(b, V((math.cos(a) * r_, math.sin(a) * r_, z + 0.015)))
        parts.append(b)
    return parts


reg("verdant_ground_moss_pad")(lambda aid, rng: fin_g(
    moss(aid, rng), aid, sc_g("forest", 1.2, 1.4, 0.8, {"forest": 1.0, "shore": 0.6, "cliff": 0.5}, None, 40, (0.7, 1.6)), elev=35))


# ---------------------------------------------------------------- lily pads
def pad(R, rng, notch=True, tilt=0.0, c=("#2FA58C", "#8FE08A"), seed=0):
    ph = rng.uniform(0, 6.28)

    def rad(i, a, r, z):
        d = math.atan2(math.sin(a - ph), math.cos(a - ph))
        k = 1.0
        zz = 0.0
        if notch and abs(d) < 0.16 and i >= 1:
            k = 0.08 + abs(d) / 0.16 * 0.92 * (1 if i >= 2 else 0.2)
        return k, zz
    o = lathe("pad", [(0.0, 0.005), (R * 0.35, 0.0), (R * 0.75, 0.01), (R * 0.95, 0.035), (R, 0.055)], 24, "VC_FOLIAGE", rad, cap0=False, cap1=False)
    paint(o, rg(c[0], c[1], 0, R, 0.05, seed), 0.2, 0.15)
    return o


def lilypads(aid, rng, flower=False):
    parts = []
    spec = [(0, 0, 0.5), (0.7, 0.35, 0.38), (-0.55, 0.6, 0.34), (-0.2, -0.65, 0.4), (0.55, -0.55, 0.3)] if not flower else [(0.0, 0.0, 0.6), (0.85, 0.3, 0.38), (-0.75, 0.4, 0.34), (0.2, -0.8, 0.42)]
    for k, (x, y, R) in enumerate(spec):
        p = pad(R, rng, True, 0, ("#2FA58C", "#9BEA8A") if k % 2 else ("#3FB88A", "#B8F27C"), k)
        put(p, V((x, y, 0.0)), spin=rng.uniform(0, 360))
        parts.append(p)
    if not flower:
        for k, (x, y) in enumerate([(0.15, 0.15), (-0.6, -0.2)]):
            bud = []
            for q in range(5):
                pt = petal("b", 0.11, 0.045, 14, 20, 0.5, 3, 0.01, "VC_FOLIAGE", base_w=0.5)
                paint(pt, dg("#FFD6E6", PINK, 0, 0.12, 0.02), 0.15, 0.1)
                put(pt, spin=q * 72)
                put(pt, V((x, y, 0.03)))
                bud.append(pt)
            parts += bud
    else:
        # water lily: layered cups
        cols = [(("#FFF6C8", YELLOW), 7, 66, 14, 0.24, 0.12), (("#FFE9A8", "#FFB347"), 5, 42, 16, 0.2, 0.11), (("#FFD36A", "#FF9F45"), 4, 18, 14, 0.15, 0.08)]
        for li, (cc, n, tl, cu, L, W) in enumerate(cols):
            ps = petal_ring(n, li * 18, f"w{li}", L=L, W=W, tilt=tl, curl=cu, cup=0.5, seg=3, r0=0.02, mat="VC_FOLIAGE", base_w=0.35, across=3)
            for p in ps:
                paint(p, dg(cc[0], cc[1], 0, L + 0.03, 0.02), 0.15, 0.1)
                put(p, V((0, 0, 0.04)))
                parts.append(p)
        c = bead("c", 0.03, "VC_FOLIAGE", 3, 6)
        paint(c, solid("#FFB030"))
        put(c, V((0, 0, 0.11)))
        parts.append(c)
    return parts


reg("verdant_ground_lilypads")(lambda aid, rng: fin_g(
    lilypads(aid, rng), aid, sc_g("shore", 1.0, 1.6, 0.9, {"shore": 1.0}, "verdant_ground_lily", 6, (0.8, 1.5)), elev=40,
    extra={"on_water": True}))
reg("verdant_ground_lily_flower")(lambda aid, rng: fin_g(
    lilypads(aid, rng, True), aid, sc_g("shore", 0.5, 2.0, 0.6, {"shore": 1.0}, "verdant_ground_lily", 6, (0.9, 1.5)), elev=35,
    extra={"on_water": True}))


# ---------------------------------------------------------------- tiny mushroom cluster
def tinyshrooms(aid, rng):
    parts = []
    cols = [("#FF5C98", "#FFB0CC"), ("#4FD6F5", "#B8F4FF"), ("#FFC23D", "#FFE9A0"), ("#9A6CFF", "#CBB0FF")]
    n = 7
    for k in range(n):
        a = k * 2.4 + rng.uniform(-0.3, 0.3)
        rad = 0.35 * math.sqrt((k + 0.4) / n)
        h = rng.uniform(0.08, 0.3) * (1.4 if k == 0 else 1.0)
        R = rng.uniform(0.07, 0.14) * (1.3 if k == 0 else 1.0)
        cc = cols[k % 4]
        lean = V((rng.uniform(-0.12, 0.12), rng.uniform(-0.12, 0.12), 1))
        stem_ = lathe("st", [(R * 0.4, 0.0), (R * 0.3, h * 0.5), (R * 0.28, h)], 8, "VC", cap0=True, cap1=False)
        paint(stem_, zg("#E8D8C8", "#FFF4E8", 0, h, 0.02), 0.1, 0.15)
        cap = lathe("cap", [(R * 1.0, -0.01), (R * 1.02, 0.01), (R * 0.85, R * 0.38), (R * 0.5, R * 0.66), (R * 0.15, R * 0.78), (0.0, R * 0.8)], 10, "VC", cap0=False)
        paint(cap, zg(cc[0], cc[1], 0, R * 0.8, 0.02), 0.2, 0.15)
        objs = [stem_, cap]
        for q in range(2):
            sp = bead("sp", R * 0.16, "VC", 3, 5)
            aa = q * 2.1 + k
            put(sp, V((math.cos(aa) * R * 0.5, math.sin(aa) * R * 0.5, R * 0.62)), scale=(1, 1, 0.5))
            paint(sp, solid(CREAM), 0.15, 0.05)
            objs.append(sp)
        for o in objs[1:]:
            put(o, V((0, 0, h)))
        for o in objs:
            put(o, V((math.cos(a) * rad, math.sin(a) * rad, 0)), up=lean)
        parts += objs
    # grass bits
    bt = Batch("g", "VC_FOLIAGE")
    for k in range(7):
        a = rng.uniform(0, 6.28)
        rad = rng.uniform(0.05, 0.4)
        pts, ws, sv = blade_path(V((math.cos(a) * rad, math.sin(a) * rad, 0)), math.degrees(a) + rng.uniform(-40, 40), rng.uniform(0.1, 0.22), 0.5, 0.025)
        bt.ribbon(pts, ws, lambda co: sl.mix("#3FB35A", "#B8F27C", clamp(co.z / 0.2)), 0.3, 3, sv)
    parts.append(bt.obj())
    return parts


reg("verdant_ground_tiny_mushrooms")(lambda aid, rng: fin_g(
    tinyshrooms(aid, rng), aid, sc_g("forest", 1.2, 0.9, 0.9, {"forest": 1.0, "meadow": 0.35, "shore": 0.4}, None, 40, (0.8, 1.5)), elev=32))
