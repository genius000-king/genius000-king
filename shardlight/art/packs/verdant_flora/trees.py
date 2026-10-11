from _h import *


def trunk_path(h, lean=(0, 0), sway=0.0, ph=0.0, steps=9, ease=1.6, twist=0.0, turns=0.0):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        x = lean[0] * t ** ease + sway * math.sin(t * pi * 1.5 + ph)
        y = lean[1] * t ** ease + sway * 0.6 * math.cos(t * pi * 1.3 + ph)
        if twist:
            a = turns * 2 * pi * t
            x += twist * (math.cos(a) - 1) * (1 - 0.4 * t)
            y += twist * math.sin(a) * (1 - 0.4 * t)
        pts.append(V((x, y, h * t)))
    return pts


def trunk_radii(n, r0, r1, flare=0.55, flare_len=0.18):
    out = []
    for i in range(n):
        t = i / (n - 1)
        r = lerp(r0, r1, t ** 0.9)
        r *= 1 + flare * max(0.0, 1 - t / flare_len) ** 2
        out.append(r)
    return out


def paint_bark(o, h, seed, c0="#7C5548", c1="#D2A180", **kw):
    paint(o, bark_fn(c0, c1, 0, h, seed, **kw), 0.10, 0.12)
    return o


def roots(base_r, n, rng, length=0.9, h=0.3, seed=0):
    """Buttress roots: start thick on the trunk wall, sweep outward and settle on the ground (never below z=0)."""
    out = []
    for k in range(n):
        a = 360.0 * k / n + rng.uniform(-18, 18)
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        L = length * 1.3 * rng.uniform(0.75, 1.2)
        pts = []
        steps = 6
        for i in range(steps + 1):
            t = i / steps
            rr = base_r * 0.45 + L * t
            z = max(0.015, h * (1 - t) ** 2.2 + 0.03 * math.sin(t * 5 + k))
            pts.append(V((ca * rr, sa * rr, z)))
        rad = [max(0.015, base_r * 0.5 * (1 - t_) ** 1.7 + 0.02) for t_ in [i / steps for i in range(steps + 1)]]
        t = tube("root", pts, 0, 0, 6, "VC_ROUGH", radii=rad)
        out.append(t)
    return out


def branch(p0, d, L, r0, r1, bend=(0, 0, 0.3), seed=0, sides=6, steps=4, grav=0.0, mat="VC_ROUGH"):
    pts = grow(p0, d, L, bend, steps, grav)
    return tube("br", pts, r0, r1, sides, mat, power=0.8), pts[-1]


# ============================================================================ PUFFCAP
def puffcap(aid, rng, variant):
    # three distinct structures
    if variant == "a":      # tall single trunk, 3 stacked tiers diminishing upward
        H = 9.4
        pts = trunk_path(H, (0.9, 0.4), 0.25, 0.5, 9)
        tiers = [((0.6, 0.25, 4.2), 2.7, (1, 1, 0.7)), ((0.85, 0.35, 6.4), 2.05, (1, 1, 0.75)), ((0.95, 0.4, 8.3), 1.35, (1, 1, 0.85))]
        cols = ("#2FA58C", "#D8F77E")
        r0 = 0.55
        arms = [(3.4, 40, 1.4), (4.6, 200, 1.4), (5.4, 320, 1.1)]
    elif variant == "b":    # twin leaning trunks, 4 offset canopy clouds
        H = 7.6
        pts = trunk_path(H, (-1.5, 0.6), 0.3, 1.8, 9)
        tiers = [((-1.3, 0.6, 7.6), 2.5, (1.15, 1, 0.75)), ((1.2, -0.4, 5.6), 2.1, (1, 1, 0.75)),
                 ((-2.8, 1.1, 5.2), 1.55, (1, 1, 0.8)), ((0.2, 1.8, 6.5), 1.45, (1, 1, 0.8))]
        cols = ("#38B8A0", "#C6F57E")
        r0 = 0.62
        arms = [(3.1, 45, 1.9), (3.6, 160, 1.4), (4.4, 300, 1.4)]
    else:                   # squat, buttress roots, huge bottom cloud + small top bubble
        H = 6.2
        pts = trunk_path(H, (0.2, -0.9), 0.35, 2.6, 9)
        tiers = [((0.0, -0.3, 4.2), 3.4, (1.15, 1.1, 0.62)), ((0.2, -0.8, 6.6), 1.6, (1, 1, 0.9)), ((-1.8, 1.0, 5.2), 1.2, (1, 1, 0.9))]
        cols = ("#4CC38A", "#E0F980")
        r0 = 0.78
        arms = [(2.4, 100, 1.5), (3.2, 250, 1.3)]
    parts = []
    radii = trunk_radii(len(pts), r0, r0 * 0.38, flare=0.6)
    t = tube("trunk", pts, 0, 0, 10, "VC_ROUGH", radii=radii)
    paint_bark(t, H, 1)
    parts.append(t)
    for zz, yaw, L in arms:
        i = min(len(pts) - 1, int(zz / H * (len(pts) - 1)))
        d = dir_from(yaw, 38)
        b, tip = branch(pts[i], d, L, r0 * 0.22, 0.07, (0, 0, 0.35), 0, 6, 4)
        paint_bark(b, H, 2)
        parts.append(b)
    for rt in roots(r0 * 1.2, 5 if variant != "c" else 7, rng, 0.8 if variant != "c" else 1.3, 0.4):
        paint(rt, bark_fn("#7C5548", BARK_LT, 0, 0.5, 3), 0.1, 0.1)
        parts.append(rt)
    for i, (c, r, sq) in enumerate(tiers):
        parts += canopy(c, r, rng, cols, sq, lumps=6, z0=c[2] - r * 0.7, z1=c[2] + r * 0.9, seed=i * 5 + 1)
    # candy blossoms dotted on the canopies for color accents
    cnt = {"a": 22, "b": 26, "c": 18}[variant]
    pc = [PINK, YELLOW, CYAN]
    for k in range(cnt):
        c, r, sq = tiers[rng.randrange(len(tiers))]
        (p, n), = scatter_on_sphere(c, r * 0.97, 1, random.Random(rng.random()), sq, 0.3 + rng.random() * 0.8, 1.2)
        b = bead("blossom", rng.uniform(0.2, 0.3), "VC_FOLIAGE", 3, 6)
        put(b, p + n * 0.05)
        paint(b, solid(pc[k % 3]), 0.1)
        parts.append(b)
    cr = r0 * 0.5
    return finish(parts, aid, "tree", cyl(cr, 4.0),
                  sc("meadow", 1.0, 6.5, 25, 0.35, {"meadow": 1.0, "forest": 0.5, "shore": 0.2}, (0.8, 1.25), "verdant_tree_puffcap"),
                  ao=0.45, frame=1.0)


for v in "abc":
    reg(f"verdant_tree_puffcap_{v}")(lambda aid, rng, v=v: puffcap(aid, rng, v))


# ============================================================================ SPIRAL WILLOW
def willow(aid, rng, variant):
    cfg = {
        "a": dict(H=8.0, strands=3, turns=1.5, twist=0.30, lean=(0.8, 0.3), arms=5, arm_L=3.2, slen=(3.0, 4.6), n=11, r0=0.62,
                  cols=("#2FC070", "#E2F97A"), blobs=3, ns=150, fount=36),
        "b": dict(H=10.5, strands=2, turns=3.2, twist=0.24, lean=(-1.2, 0.7), arms=4, arm_L=2.6, slen=(2.2, 3.6), n=9, r0=0.5,
                  cols=("#2FC8A8", "#D2FBE8"), blobs=3, ns=110, fount=28),
        "c": dict(H=5.2, strands=4, turns=0.9, twist=0.46, lean=(0.3, -0.5), arms=7, arm_L=3.6, slen=(2.6, 4.0), n=7, r0=0.78,
                  cols=("#4CD08A", "#FFF08A"), blobs=4, ns=170, fount=42),
    }[variant]
    H = cfg["H"]
    parts = []
    axis = trunk_path(H, cfg["lean"], 0.15, rng.uniform(0, 6), 12, 1.5)
    S = cfg["strands"]
    top_pts = []
    for s in range(S):
        ph = 2 * pi * s / S
        pts = []
        for i, a in enumerate(axis):
            t = i / (len(axis) - 1)
            ang = ph + cfg["turns"] * 2 * pi * t
            rr = cfg["twist"] * (1.0 - 0.5 * t) * (1.0 + 0.9 * max(0, 0.15 - t) / 0.15)
            pts.append(a + V((math.cos(ang) * rr, math.sin(ang) * rr, 0)))
        rad = [lerp(cfg["r0"] / (S ** 0.5) * 1.15, cfg["r0"] / (S ** 0.5) * 0.45, (i / 12) ** 0.8) * (1 + 0.5 * max(0, 1 - i / 2.5) ** 2) for i in range(len(pts))]
        tb = tube("strand", pts, 0, 0, 8, "VC_ROUGH", radii=rad)
        paint(tb, bark_fn("#7C5548", "#D2A180", 0, H, s * 3, 1.0), 0.1, 0.12)
        parts.append(tb)
        top_pts.append(pts)
    # crown arms
    arm_tips = []
    arm_data = []
    for k in range(cfg["arms"]):
        yaw = 360.0 * k / cfg["arms"] + rng.uniform(-20, 20)
        base = top_pts[k % S][-1]
        b, tip = None, None
        pts = grow(base, dir_from(yaw, 52), cfg["arm_L"] * rng.uniform(0.85, 1.1), (0, 0, 0), 6, grav=2.3)
        b = tube("arm", pts, 0.17, 0.04, 6, "VC_ROUGH", power=0.7)
        paint(b, bark_fn("#7C5548", "#D2A180", 0, H, k, 1.0), 0.1, 0.12)
        parts.append(b)
        arm_data.append((yaw, pts))
    # foliage strands (ribbons) - one batch, vertical color gradient
    zb, zt = 0.4, H + 1.2
    cbot, ctop = cfg["cols"]

    def fcol(co):
        t = clamp((co.z - zb) / (zt - zb))
        c = sl.mix(ctop, cbot, clamp(t * 1.4))
        return c
    bt = Batch("strands", "VC_FOLIAGE")
    for si in range(cfg["ns"]):
        yaw, pts = arm_data[si % len(arm_data)]
        j = 1 + int(len(pts) * 0.99 * rng.random() ** 0.7)
        j = min(j, len(pts) - 1)
        p = pts[j]
        outv = V((math.cos(math.radians(yaw)), math.sin(math.radians(yaw)), 0))
        sidev = V((-outv.y, outv.x, 0))
        p = p + sidev * rng.uniform(-0.5, 0.5)
        L = rng.uniform(*cfg["slen"]) * (0.7 + 0.3 * j / len(pts))
        L = min(L, p.z - 0.1 + rng.uniform(0.0, 0.4))
        ph = rng.uniform(0, 6.28)
        path, ws = [], []
        seg = 4
        for i in range(seg + 1):
            t_ = i / seg
            ox = 0.25 * L * math.sin(t_ * pi * 0.75) + 0.16 * L * t_ ** 4
            sway = 0.1 * math.sin(t_ * 5 + ph)
            path.append(p + outv * ox + sidev * sway + V((0, 0, -L * t_)))
            ws.append(0.34 * (1 - t_ ** 1.5) ** 0.8 * (0.85 + 0.15 * math.sin(t_ * 9 + ph)))
        bt.ribbon(path, ws, fcol, cup=0.5, across=3, side_vec=(-outv.y, outv.x, 0))
    # crown fountain: arching leaf ribbons from the trunk top
    topc = top_pts[0][-1]
    for k in range(cfg["fount"]):
        yaw = rng.uniform(0, 360)
        pitch = rng.uniform(50, 85)
        L = rng.uniform(2.2, 3.6)
        pts = grow(topc + V((rng.uniform(-.3, .3), rng.uniform(-.3, .3), 0)), dir_from(yaw, pitch), L, (0, 0, 0), 6, grav=2.6)
        ws = [0.38 * math.sin(min(1, (i + 0.6) / 6 * 1.2) * pi * 0.9) ** 0.8 * (1 - (i / 6) ** 3) for i in range(7)]
        ws[0] = 0.08
        ws[-1] = 0.0
        sv = (-math.sin(math.radians(yaw)), math.cos(math.radians(yaw)), 0)
        bt.ribbon(pts, ws, fcol, cup=0.5, across=3, side_vec=sv)
    st = bt.obj()
    parts.append(st)
    for rt in roots(cfg["r0"] * 1.2, 5, rng, 0.9, 0.35):
        paint(rt, bark_fn("#7C5548", BARK_LT, 0, 0.5, 3), 0.1, 0.1)
        parts.append(rt)
    return finish(parts, aid, "tree", cyl(cfg["r0"] * 0.55, 4.0),
                  sc("meadow", 0.7, 7.5, 22, 0.3, {"meadow": 0.6, "forest": 0.8, "shore": 0.9}, (0.8, 1.2), "verdant_tree_spiralwillow"),
                  ao=0.25, frame=1.0)


for v in "abc":
    reg(f"verdant_tree_spiralwillow_{v}")(lambda aid, rng, v=v: willow(aid, rng, v))


# ============================================================================ BALLOON TREE
def pod(r, c1, c2, squash=1.0, stripes=4, rng=None, sides=None):
    if sides is None:
        sides = 18 if r > 0.8 else 12
    prof = []
    n = 11 if r > 0.8 else 8
    for i in range(n + 1):
        a = pi * i / n
        rad = r * math.sin(a) * (1 + 0.10 * math.sin(a))
        z = r * (1 - math.cos(a)) * 1.1 * squash
        if i == 0:
            rad = 0.02 * r
        prof.append((rad, z))
    o = lathe("pod", prof, sides, "VC_FOLIAGE")
    ph = rng.uniform(0, 6.28) if rng else 0
    zt = r * 2.2 * squash

    def f(co, n):
        ang = math.atan2(co.y, co.x)
        k = 0.5 + 0.5 * math.sin(stripes * ang + ph)
        k = clamp((k - 0.25) * 1.6)
        t = clamp(co.z / zt)
        c = sl.mix(c1, c2, k)
        c = sl.mix(c, PALE, clamp((t - 0.8) * 1.2) * 0.15)
        # glossy highlight patch (upper-left)
        d = (V((co.x, co.y, co.z - r * 1.1 * squash)).normalized() - V((-0.55, -0.45, 0.7)).normalized()).length
        c = sl.mix(c, PALE, clamp(1 - d * 4.0) * 0.7)
        return c
    paint(o, f, 0.06, 0.2)
    parts = [o]
    for k in range(5):
        sp = ribbon("sepal", [V((0, 0, r * 0.1)), V((r * 0.25, 0, r * 0.28)), V((r * 0.38, 0, r * 0.6))], [0.0, r * 0.1, 0.0], "VC_FOLIAGE", 0.4, 3, (0, 1, 0))
        put(sp, spin=72 * k)
        paint(sp, solid(LEAF), 0.1, 0.1)
        parts.append(sp)
    return parts


def tether(p0, p1, rng, sway=0.4):
    d = p1 - p0
    side = V((-d.y, d.x, 0)).normalized() if (abs(d.x) + abs(d.y)) > 1e-3 else V((1, 0, 0))
    pts = []
    for i in range(8):
        t = i / 7
        pts.append(p0 + d * t + side * sway * math.sin(t * pi * 1.4) * (1 - 0.4 * t))
    o = tube("tether", pts, 0.04, 0.025, 4, "VC_FOLIAGE")
    paint(o, zg("#2FA58C", "#A8F29A", p0.z, p1.z, 0.04), 0.1, 0.1)
    return o


def leaf_tuft(p, rng, n=4, L=0.7, col=(LEAF, GRASS_HI)):
    out = []
    for k in range(n):
        yaw = rng.uniform(0, 360)
        b = blade("lf", p, yaw, L * rng.uniform(0.7, 1.2), 0.9, 0.09, 4, "VC_FOLIAGE", 0.5)
        paint(b, zg(col[0], col[1], p.z, p.z + L, 0.04), 0.1, 0.1)
        out.append(b)
    return out


POD_COLS = [("#FF5C98", "#FF9CC0"), ("#FFC23D", "#FFE08A"), ("#4FD6F5", "#A8F0FF"), ("#52DFA0", "#B0FFD9"), ("#9A6CFF", "#CBB0FF"), ("#FF8A5E", "#FFC0A0")]


def balloon(aid, rng, variant):
    parts = []
    if variant == "a":
        H = 5.6
        pts = trunk_path(H, (0.7, -0.4), 0.22, 1.0, 9)
        r0 = 0.34
        tips = []
        brs = [(2.5, 20, 1.9), (3.3, 110, 1.7), (3.9, 200, 1.8), (4.6, 290, 1.5), (5.4, 60, 1.2)]
        pod_specs = []
        for i, (zz, yaw, L) in enumerate(brs):
            idx = min(len(pts) - 1, int(zz / H * (len(pts) - 1)))
            b, tip = branch(pts[idx], dir_from(yaw, 40), L, 0.11, 0.04, (0, 0, 0.3), 0, 5, 4)
            paint_bark(b, H, i)
            parts.append(b)
            tips.append(tip)
            pod_specs.append((tip, rng.uniform(1.1, 2.4), rng.uniform(0.62, 0.95)))
        tips.append(pts[-1])
        pod_specs.append((pts[-1], 2.8, 1.05))
    elif variant == "b":
        H = 4.2
        pts = trunk_path(H, (0.0, 0.0), 0.15, 0.4, 7)
        r0 = 0.4
        pod_specs = []
        for side in (-1, 1):
            p2 = grow(pts[4], dir_from(90 + side * 70, 55), 3.4, (0, 0, 0.5), 5)
            b = tube("fork", p2, 0.22, 0.07, 6, "VC_ROUGH", power=0.8)
            paint_bark(b, H, 5)
            parts.append(b)
            pod_specs_base = p2
            for j, pp in enumerate((p2[3], p2[5])):
                for q in range(3 if j else 2):
                    pod_specs.append((pp + V((rng.uniform(-.4, .4), rng.uniform(-.4, .4), 0)), rng.uniform(1.2, 2.0), rng.uniform(0.42, 0.62)))
        b, tip = branch(pts[-1], (0, 0, 1), 1.6, 0.1, 0.04, (0.2, 0.1, 0), 0, 5, 3)
        paint_bark(b, H, 6)
        parts.append(b)
        for q in range(3):
            pod_specs.append((tip, rng.uniform(1.6, 2.6), rng.uniform(0.5, 0.75)))
    else:
        H = 7.4
        pts = trunk_path(H, (-0.4, 0.9), 0.18, 2.0, 11, 1.4)
        r0 = 0.3
        pod_specs = [(pts[-1], 3.3, 1.75)]
        for k in range(5):
            yaw = 72 * k + 20
            idx = 6 + (k % 3)
            b, tip = branch(pts[idx], dir_from(yaw, 35), 1.7, 0.09, 0.035, (0, 0, 0.2), 0, 5, 3)
            paint_bark(b, H, k)
            parts.append(b)
            pod_specs.append((tip, rng.uniform(1.2, 2.0), rng.uniform(0.36, 0.55)))
    radii = trunk_radii(len(pts), r0, r0 * 0.4, 0.5, 0.15)
    tr = tube("trunk", pts, 0, 0, 8, "VC_ROUGH", radii=radii)
    paint_bark(tr, H, 1)
    parts.append(tr)
    for rt in roots(r0 * 1.3, 4, rng, 0.7, 0.3):
        paint(rt, bark_fn("#7C5548", BARK_LT, 0, 0.5, 3), 0.1, 0.1)
        parts.append(rt)
    for i, (anchor, rise, r) in enumerate(pod_specs):
        c1, c2 = POD_COLS[(i + (0 if variant == "a" else 2 if variant == "b" else 1)) % len(POD_COLS)]
        top = anchor + V((rng.uniform(-0.5, 0.5), rng.uniform(-0.5, 0.5), rise))
        if variant == "c" and i == 0:
            c1, c2 = PINK, "#FFA3C6"
        parts.append(tether(anchor, top, rng, rng.uniform(0.15, 0.5)))
        pp = pod(r, c1, c2, rng.uniform(0.9, 1.15), rng.choice([3, 4, 5]), rng)
        for o in pp:
            put(o, top + V((0, 0, -r * 0.1)), spin=rng.uniform(0, 360))
        parts += pp
        parts += leaf_tuft(anchor + V((0, 0, 0.05)), rng, 3, 0.55)
    return finish(parts, aid, "tree", cyl(r0 * 0.6, 4.0),
                  sc("meadow", 0.8, 6.0, 24, 0.3, {"meadow": 1.0, "forest": 0.3, "cliff": 0.4}, (0.8, 1.25), "verdant_tree_balloon"),
                  ao=0.4, frame=1.0)


for v in "abc":
    reg(f"verdant_tree_balloon_{v}")(lambda aid, rng, v=v: balloon(aid, rng, v))


# ============================================================================ GLASSLEAF BIRCH
def shard(bt, p, d, L, W, side, col, cup=0.35):
    d = V(d).normalized()
    path = [p, p + d * (L * 0.5), p + d * L]
    bt.ribbon(path, [0.0, W, 0.0], col, cup=cup, across=3, side_vec=side)


def shard_burst(bt, bte, center, rad, n, rng, cols, size=(0.3, 0.55), bias=(0, 0, 0.0), emit_p=0.08, flatten=1.0, sparse=True):
    c = V(center)
    for i in range(n):
        off = V((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1) * flatten))
        if off.length < 1e-3:
            continue
        off = off.normalized() * rad * rng.random() ** 0.6
        d = (off.normalized() + V(bias) + V((rng.uniform(-.5, .5), rng.uniform(-.5, .5), rng.uniform(-.5, .5)))).normalized()
        L = rng.uniform(*size)
        side = d.cross(V((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))).normalized()
        if rng.random() < emit_p and bte is not None:
            shard(bte, c + off, d, L * 0.9, L * 0.28, side, CYAN)
        else:
            col = sl.jitter(rng.choice(cols), 0.01, 0.05, 0.05, rng)
            shard(bt, c + off, d, L, L * 0.34, side, col)


def birch(aid, rng, variant):
    parts = []
    bt = Batch("shards", "VC_FOLIAGE", smooth=False)
    bte = Batch("glow", "EMIT", smooth=False)
    lc = ["#9DF2C8", "#7FE3C4", "#C9F7A4", "#B8EFF2", "#E4FBB4", "#6ED8B4"]
    if variant == "a":
        stems = [dict(H=8.6, lean=(0.8, 0.2), base=(0, 0), r=0.26), dict(H=7.2, lean=(-1.2, 0.8), base=(0.5, 0.25), r=0.2),
                 dict(H=6.0, lean=(0.7, -1.4), base=(-0.3, 0.4), r=0.17)]
        cols = lc
    elif variant == "b":
        stems = [dict(H=7.2, lean=(0.3, -0.4), base=(0, 0), r=0.34)]
        cols = ["#B8EFF2", "#9DF2C8", "#E8F9C4", "#A8DDFB", "#C9F7A4"]
    else:
        stems = [dict(H=9.0, lean=(2.3, 0.4), base=(0, 0), r=0.27), dict(H=6.8, lean=(-1.4, -0.6), base=(0.4, 0.2), r=0.22)]
        cols = ["#E4FBB4", "#C9F7A4", "#9DF2C8", "#FFE9A8", "#B8EFF2"]
    for si, sd in enumerate(stems):
        H = sd["H"]
        pts = trunk_path(H, sd["lean"], 0.22, rng.uniform(0, 6), 10, 1.5)
        pts = [p + V((sd["base"][0], sd["base"][1], 0)) for p in pts]
        radii = trunk_radii(len(pts), sd["r"], sd["r"] * 0.42, 0.35, 0.14)
        tb = tube("birch", pts, 0, 0, 9, "VC_ROUGH", radii=radii)
        paint(tb, bark_fn("#D9D2EE", "#F2EEF8", 0, H, si, 0.5, ("#3E3270", 0.6, 0.17, 0.16)), 0.08, 0.12)
        parts.append(tb)
        # branches + leaf bursts
        nb = {"a": 5, "b": 7, "c": 5}[variant]
        for k in range(nb):
            t0 = 0.38 + 0.6 * k / nb
            idx = min(len(pts) - 1, int(t0 * (len(pts) - 1)))
            yaw = k * 137.5 + si * 40
            pitch = 50 if variant != "b" else 12
            L = (2.0 - 1.2 * t0) * (1.6 if variant == "b" else 1.0)
            b, tip = branch(pts[idx], dir_from(yaw, pitch), L, sd["r"] * 0.3, 0.04, (0, 0, 0.22 if variant != "b" else 0.05), 0, 5, 4, mat="VC_ROUGH")
            paint(b, bark_fn("#D9D2EE", "#F2EEF8", 0, H, si + k, 0.5, ("#3E3270", 0.45, 0.12, 0.1)), 0.08, 0.1)
            parts.append(b)
            if variant == "b":
                shard_burst(bt, bte, tip + V((0, 0, 0.1)), 1.5, 70, rng, cols, (0.5, 0.8), (0, 0, 0.0), 0.07, 0.28)
            elif variant == "c":
                shard_burst(bt, bte, tip, 1.1, 40, rng, cols, (0.45, 0.75), (0, 0, 0.2), 0.08)
                # drooping shard chains
                for q in range(4):
                    ph = rng.uniform(0, 6.28)
                    base = tip + V((math.cos(ph) * 0.4, math.sin(ph) * 0.4, -0.1))
                    for m in range(7):
                        pp = base + V((0.04 * math.sin(m), 0.04 * math.cos(m), -0.34 * m))
                        shard(bt, pp, V((0.1 * math.sin(m), 0.1, -1)), 0.55, 0.17, V((math.cos(ph), math.sin(ph), 0)),
                              sl.jitter(rng.choice(cols), 0.01, 0.05, 0.05, rng))
            else:
                shard_burst(bt, bte, tip, 1.25, 46, rng, cols, (0.45, 0.78), (0, 0, 0.1), 0.08)
        top = pts[-1]
        shard_burst(bt, bte, top + V((0, 0, 0.5)), 1.2 if variant != "b" else 1.0, 44, rng, cols, (0.45, 0.78), (0, 0, 0.3), 0.1)
    for rt in roots(stems[0]["r"] * 1.4, 4, rng, 0.6, 0.3):
        paint(rt, bark_fn("#BDB3DD", "#E8E0F5", 0, 0.5, 3, 0.3), 0.1, 0.1)
        parts.append(rt)
    parts += [bt.obj(), bte.obj()]
    return finish(parts, aid, "tree", cyl(stems[0]["r"] * 0.6, 4.0),
                  sc("forest", 0.8, 5.0, 25, 0.5, {"forest": 1.0, "meadow": 0.4, "cliff": 0.5}, (0.8, 1.25), "verdant_tree_glassbirch"),
                  ao=0.35, frame=1.0)


for v in "abc":
    reg(f"verdant_tree_glassbirch_{v}")(lambda aid, rng, v=v: birch(aid, rng, v))


# ============================================================================ GIANT DANDELION
def fib_dirs(n, rng):
    out = []
    for i in range(n):
        z = 1 - 2 * (i + 0.5) / n
        r = math.sqrt(max(0, 1 - z * z))
        ph = i * 2.399963
        out.append(V((r * math.cos(ph), r * math.sin(ph), z)))
    return out


def dandelion_head(center, R, n, rng, skip=None, bt=None):
    """Sphere of seed tufts into Batch bt."""
    for d in fib_dirs(n, rng):
        if skip and skip(d):
            continue
        L = R * rng.uniform(0.82, 1.0)
        a = center + d * (R * 0.18)
        b = center + d * L
        side = d.cross(V((0.3, 0.8, 0.5))).normalized()
        bt.ribbon([a, b], [0.014, 0.014], lambda co: "#FFF8E6", 0, 2, side)
        # pappus tuft: two crossed diamonds around the tip
        for sv in (side, d.cross(side).normalized()):
            tipc = lambda co, b=b: sl.mix("#FFF4D8", "#F2E8FF", 0.5)
            bt.ribbon([b - d * R * 0.13, b, b + d * R * 0.12], [0.0, R * 0.075, 0.0], tipc, 0.3, 3, sv)


def dandelion(aid, rng, variant):
    parts = []
    bt = Batch("seeds", "VC_FOLIAGE")
    if variant == "a":
        H, lean, R = 5.4, (0.7, 0.3), 1.15
    elif variant == "b":
        H, lean, R = 4.6, (-0.9, 0.6), 1.0
    else:
        H, lean, R = 6.2, (1.6, -0.5), 0.8
    pts = trunk_path(H, lean, 0.18, rng.uniform(0, 6), 9, 1.6)
    radii = [lerp(0.09, 0.055, (i / 9)) * (1 + 0.8 * max(0, 1 - i / 1.6) ** 2) for i in range(10)]
    st = tube("stem", pts, 0, 0, 7, "VC_FOLIAGE", radii=radii)
    paint(st, zg("#3FA98C", "#9BEA8A", 0, H, 0.04), 0.1, 0.15)
    parts.append(st)
    # toothed basal leaves
    nl = 7
    for k in range(nl):
        yaw = 360 * k / nl + rng.uniform(-15, 15)
        L = rng.uniform(1.6, 2.4)
        path, ws = [], []
        seg = 9
        for i in range(seg + 1):
            t_ = i / seg
            x = L * (t_ * 0.9)
            z = 0.1 + 0.9 * math.sin(t_ * 2.0) * L * 0.35 - 0.5 * L * 0.3 * t_ ** 2.5
            path.append(V((math.cos(math.radians(yaw)) * x, math.sin(math.radians(yaw)) * x, z)))
            env = math.sin(min(1.0, t_ * 1.1) * pi * 0.85) ** 0.7
            tooth = 1.0 if i % 2 else 0.55
            ws.append((0.02 if i == 0 else 0.2 * env * tooth) if i < seg else 0.0)
        lf = ribbon("leaf", path, ws, "VC_FOLIAGE", 0.45, 3, (-math.sin(math.radians(yaw)), math.cos(math.radians(yaw)), 0))
        paint(lf, zg("#2FA58C", "#A5EF7C", 0, 1.5, 0.05), 0.12, 0.15)
        parts.append(lf)
    top = pts[-1]
    if variant in ("a", "b"):
        core = ball("core", R * 0.2, 3, (1, 1, 1), 0.06, 1.0, 1, "VC_FOLIAGE")
        put(core, top)
        paint(core, solid("#BFD07A", 0.05), 0.1, 0.1)
        parts.append(core)
        if variant == "a":
            dandelion_head(top, R, 190, rng, None, bt)
        else:
            axis = V((0.6, -0.5, 0.35)).normalized()
            dandelion_head(top, R, 220, rng, lambda d: d.dot(axis) > 0.45, bt)
            # exposed receptacle dimples
            for d in fib_dirs(40, rng):
                if d.dot(axis) > 0.5:
                    bd = bead("dimple", 0.045, "VC_FOLIAGE", 3, 5)
                    put(bd, top + d * R * 0.2)
                    paint(bd, solid("#8A9A52"), 0.1, 0.1)
                    parts.append(bd)
            # drifting seeds on an upward trail
            for k in range(7):
                p = top + axis * (1.4 + k * 0.75) + V((0.35 * math.sin(k * 1.3), 0.35 * math.cos(k * 1.7), 0.35 * k))
                dd = V((0.25 * math.sin(k), 0.25 * math.cos(k), 1.0)).normalized()
                bt.ribbon([p - dd * 0.35, p], [0.012, 0.012], lambda co: CREAM, 0, 2, (1, 0, 0))
                for sv in (V((1, 0, 0)), V((0, 1, 0))):
                    bt.ribbon([p - dd * 0.02 * 0, p + dd * 0.22, p + dd * 0.44], [0.0, 0.17, 0.0], lambda co: CREAM, 0.3, 3, sv)
                sb = bead("seed", 0.05, "VC_FOLIAGE", 3, 5)
                put(sb, p - dd * 0.37)
                paint(sb, solid("#9A8A52"), 0.1, 0.1)
                parts.append(sb)
    else:
        # open golden flower head + small closed puff bud on a side stalk + one drifting seed
        yc = YELLOW
        core = ball("core", 0.2, 3, (1, 1, 0.6), 0.04, 1.0, 1, "VC_FOLIAGE")
        put(core, top)
        paint(core, solid("#FFB03D"), 0.1, 0.1)
        parts.append(core)
        for layer, (n, tl, Lp, cl) in enumerate([(30, 70, 1.1, (YELLOW, "#FFB347")), (24, 52, 0.9, ("#FFE08A", "#FFC23D"))]):
            ps = petal_ring(n, spin0=layer * 7, prefix="r", L=Lp, W=0.09, tilt=tl, curl=26, cup=0.35, seg=3, r0=0.12 + layer * 0.02,
                            mat="VC_FOLIAGE", base_w=0.8)
            for p in ps:
                paint(p, dg(cl[0], cl[1], 0.0, Lp + 0.1, 0.03, 1), 0.1, 0.1)
                put(p, top + V((0, 0, layer * 0.04)), up=V((0.45, -0.1, 1)))
            parts += ps
        # bud stalk
        bp = trunk_path(3.0, (-1.1, -0.5), 0.1, 1.0, 6, 1.5)
        bst = tube("bud_stem", bp, 0.05, 0.035, 6, "VC_FOLIAGE")
        paint(bst, zg("#3FA98C", "#9BEA8A", 0, 3.0, 0.04), 0.1, 0.15)
        put(bst, V((0.0, 0, 0.0)))
        parts.append(bst)
        dandelion_head(bp[-1], 0.55, 90, rng, None, bt)
    parts.append(bt.obj())
    return finish(parts, aid, "tree", cyl(0.14, 1.5),
                  sc("meadow", 0.55, 8.0, 18, 0.25, {"meadow": 1.0, "shore": 0.4}, (0.8, 1.3), "verdant_tree_dandelion"),
                  ao=0.1, frame=1.0, extra={"note": "giant dandelion - thin stem, collision is a slim cylinder"})


for v in "abc":
    reg(f"verdant_tree_dandelion_{v}")(lambda aid, rng, v=v: dandelion(aid, rng, v))


# ============================================================================ UMBRELLA MUSHROOM TREE
def mushroom_cap(R, Hc, c_rim, c_top, spots, spot_col, gill_cols, rng, nspots=12, seed=0, sides=36, lip=0.08):
    """Cap at origin (rim plane z=0, dome up). Returns objs (dome, gills, spots)."""
    prof = []
    prof.append((R * 0.96, -Hc * lip))
    prof.append((R * 1.0, Hc * 0.04))
    n = 8
    for i in range(1, n + 1):
        a = i / n * pi / 2
        prof.append((R * math.cos(a) * 0.995, Hc * math.sin(a)))
    ph = rng.uniform(0, 6)

    def radial(i, a, r, z):
        if i <= 1:
            return 1.0 + 0.05 * math.sin(7 * a + ph), 0.12 * Hc * math.sin(7 * a + ph + 1)
        return 1.0, 0.0
    dome = lathe("cap", prof, sides, "VC", radial, cap0=False, cap1=False)
    paint(dome, zg(c_rim, c_top, -Hc * 0.1, Hc, 0.05, seed, 0.9), 0.2, 0.1)
    # gills: inner -> outer so normals face down; radial corrugation in z
    gp = [(R * 0.22, Hc * 0.42), (R * 0.4, Hc * 0.3), (R * 0.62, Hc * 0.16), (R * 0.82, Hc * 0.05), (R * 0.97, -Hc * lip)]
    ng = 44
    gills = lathe("gills", gp, ng, "VC", lambda i, a, r, z: (1.0, 0.045 * Hc * math.sin(ng * 0.5 * a) * (0.3 + i * 0.25)), cap0=False, cap1=False)
    paint(gills, lambda co, n: sl.mix(gill_cols[0], gill_cols[1], 0.5 + 0.5 * math.sin(ng * 0.5 * math.atan2(co.y, co.x) + 0.0)
                                      * (0.6 + 0.4 * (math.hypot(co.x, co.y) / R))), 0.0, 0.1)
    out = [dome, gills]
    if spots:
        for p, nrm in scatter_on_sphere((0, 0, 0), 1.0, nspots, rng, (R * 0.96, R * 0.96, Hc * 1.0), 0.18, 1.15):
            r_ = rng.uniform(0.07, 0.14) * R * (1 if p.z > Hc * 0.4 else 1.0)
            b = bead("spot", r_, "VC", 4, 8)
            put(b, V((0, 0, 0)), scale=(1, 1, 0.3))
            put(b, p + nrm * 0.0, up=nrm, spin=rng.uniform(0, 360))
            paint(b, solid(spot_col, 0.03), 0.15, 0.05)
            out.append(b)
    return out


def umbrella(aid, rng, variant):
    parts = []
    stem_c = ("#E3B4C6", "#FFF0E6")
    if variant == "a":
        H, R, Hc, r0 = 5.6, 4.3, 2.7, 0.78
        pts = trunk_path(H, (0.5, 0.2), 0.12, 1.0, 8, 1.6)
        radii = [r0 * (1 + 0.9 * max(0, 1 - i / 2.2) ** 2) * lerp(1.0, 0.66, i / 8) for i in range(9)]
        st = tube("stem", pts, 0, 0, 12, "VC_ROUGH", radii=radii)
        paint(st, bark_fn(stem_c[0], stem_c[1], 0, H, 1, 0.8), 0.12, 0.15)
        parts.append(st)
        top = pts[-1]
        caps = mushroom_cap(R, Hc, "#D8408E", "#FF8EC0", True, CREAM, ("#FFD9E6", "#E9A3C4"), rng, 14, 1)
        for o in caps:
            put(o, top + V((0, 0, -0.1)), up=V((0.04, 0.02, 1)))
        parts += caps
        # skirt ring on stem
        ring = lathe("ring", [(r0 * 0.62, 0), (r0 * 1.05, -0.28), (r0 * 1.25, -0.5), (r0 * 1.2, -0.56)], 16, "VC", cap0=False, cap1=False)
        paint(ring, zg("#FFE4EE", "#E9B5CE", -0.6, 0, 0.03), 0.1, 0.1)
        put(ring, pts[5] + V((0, 0, 0)))
        parts.append(ring)
        crad = r0 * 0.55
        for k in range(5):
            a = 72 * k + 15
            bx, by = math.cos(math.radians(a)) * rng.uniform(1.1, 1.9), math.sin(math.radians(a)) * rng.uniform(1.1, 1.9)
            hh = rng.uniform(0.5, 1.0)
            sp = [V((bx, by, 0)), V((bx + 0.04, by, hh * 0.5)), V((bx + 0.08, by + 0.03, hh))]
            sm = tube("mini", sp, 0.09, 0.06, 7, "VC_ROUGH")
            paint(sm, bark_fn(stem_c[0], stem_c[1], 0, 1.0, k), 0.1, 0.1)
            parts.append(sm)
            cps = mushroom_cap(rng.uniform(0.4, 0.75), 0.3, "#D8408E", "#FF8EC0", True, CREAM, ("#FFD9E6", "#E9A3C4"), rng, 4, k, 18)
            for o in cps:
                put(o, sp[-1] + V((0, 0, -0.02)), up=V((0.1, 0, 1)))
            parts += cps
    elif variant == "b":
        H, r0 = 4.4, 0.7
        pts = trunk_path(H, (0.3, -0.2), 0.1, 2.0, 8, 1.6)
        radii = [r0 * (1 + 0.8 * max(0, 1 - i / 2.0) ** 2) * lerp(1.0, 0.62, i / 8) for i in range(9)]
        st = tube("stem", pts, 0, 0, 12, "VC_ROUGH", radii=radii)
        paint(st, bark_fn("#8FB6D8", "#E4F1FA", 0, H, 2, 0.8), 0.12, 0.15)
        parts.append(st)
        specs = [(pts[-1], 3.0, 1.9, V((0.1, 0, 1)), ("#5F7BE8", "#9FC3FF")), (None, 2.1, 1.3, V((0.55, 0.3, 1)), ("#8F5FE8", "#C7A8FF")),
                 (None, 1.7, 1.0, V((-0.6, -0.4, 1)), ("#3FB7D8", "#9CF0FF"))]
        # side stems
        for s_i, (yaw, zz, L) in enumerate([(15, 2.0, 5.0), (200, 1.3, 5.6)]):
            sp = grow(pts[int(zz / H * 8)] + V((0, 0, 0)), dir_from(yaw, 38), L, (0, 0, 0.55), 6)
            sr = tube("stem2", sp, r0 * 0.5, r0 * 0.28, 9, "VC_ROUGH", power=0.8)
            paint(sr, bark_fn("#8FB6D8", "#E4F1FA", 0, 8, 3 + s_i, 0.8), 0.12, 0.15)
            parts.append(sr)
            specs[1 + s_i] = (sp[-1], specs[1 + s_i][1], specs[1 + s_i][2], dir_from(yaw, 72), specs[1 + s_i][4])
        for i, (pos, R, Hc, up, cc) in enumerate(specs):
            caps = mushroom_cap(R, Hc, cc[0], cc[1], True, "#F2FBFF", ("#D6EEFF", "#A8CBEA"), rng, 9, i + 3)
            for o in caps:
                put(o, pos + V((0, 0, -0.1)), up=up)
            parts += caps
        crad = r0 * 0.55
    else:
        H, r0 = 8.4, 0.46
        pts = trunk_path(H, (1.2, -0.5), 0.25, 3.0, 11, 1.4)
        radii = [r0 * (1 + 1.0 * max(0, 1 - i / 2.5) ** 2) * lerp(1.0, 0.7, i / 11) for i in range(12)]
        st = tube("stem", pts, 0, 0, 10, "VC_ROUGH", radii=radii)
        paint(st, bark_fn("#E0B48A", "#FFE6C8", 0, H, 4, 0.8), 0.12, 0.15)
        parts.append(st)
        caps = mushroom_cap(3.5, 2.2, "#FF7A3D", "#FFC15E", True, "#FFF1D6", ("#FFE9C4", "#E8B87A"), rng, 12, 6)
        for o in caps:
            put(o, pts[-1] + V((0, 0, -0.1)), up=V((-0.28, 0.1, 1)))
        parts += caps
        for k in range(4):
            a = 90 * k + 30
            bx, by = math.cos(math.radians(a)) * rng.uniform(1.0, 1.7), math.sin(math.radians(a)) * rng.uniform(1.0, 1.7)
            hh = rng.uniform(0.7, 1.4)
            sp = [V((bx, by, 0)), V((bx + 0.05, by, hh * 0.5)), V((bx + 0.1, by + 0.05, hh))]
            sm = tube("mini", sp, 0.1, 0.07, 7, "VC_ROUGH")
            paint(sm, bark_fn("#E0B48A", "#FFE6C8", 0, 1.4, k), 0.1, 0.1)
            parts.append(sm)
            cps = mushroom_cap(rng.uniform(0.45, 0.8), 0.32, "#FF7A3D", "#FFC15E", True, CREAM, ("#FFE9C4", "#E8B87A"), rng, 4, k, 18)
            for o in cps:
                put(o, sp[-1] + V((0, 0, -0.02)), up=V((0.1, 0, 1)))
            parts += cps
        crad = r0 * 0.55
    return finish(parts, aid, "tree", cyl(crad, 3.5),
                  sc("forest", 0.7, 9.0, 20, 0.35, {"forest": 1.0, "meadow": 0.25, "cliff": 0.3}, (0.8, 1.2), "verdant_tree_umbrellashroom"),
                  ao=0.4, frame=1.0)


for v in "abc":
    reg(f"verdant_tree_umbrellashroom_{v}")(lambda aid, rng, v=v: umbrella(aid, rng, v))
