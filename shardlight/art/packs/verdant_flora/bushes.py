from _h import *
from trees import trunk_path, branch


def sc_bush(zone="meadow", density=1.0, spacing=2.0, cluster=0.5, zw=None, group=None, slope=30, scale=(0.8, 1.3)):
    return sc(zone, density, spacing, slope, cluster, zw or {zone: 1.0}, scale, group)


def mound(centers, rng, cols, sub=3, z0=0.0, z1=1.3, lumps=3, seed=0):
    parts = []
    for i, (c, r, sq) in enumerate(centers):
        parts += canopy(c, r, rng, cols, sq, lumps=lumps, sub=sub, z0=z0, z1=z1, seed=seed + i, lump_r=0.4, noise_amt=0.12)
    return parts


def leafy_mass(center, R, squash, n, rng, cols, z0, z1, seed=0, lump=(0.34, 0.5), shell=(0.35, 0.95), sub=2, hemi=True):
    """Lumpy foliage mass: n overlapping low-poly lumps in a (squashed) hemisphere/ellipsoid."""
    c = V(center)
    parts = []
    for i in range(n):
        th = math.acos(rng.uniform(0.0 if hemi else -0.6, 1.0))
        ph = rng.uniform(0, 2 * pi)
        sr = rng.uniform(*shell)
        off = V((math.sin(th) * math.cos(ph) * squash[0], math.sin(th) * math.sin(ph) * squash[1], math.cos(th) * squash[2])) * R * sr
        lr = R * rng.uniform(*lump)
        o = ball("lump", lr, sub, (1, 1, 0.82), 0.12, 0.8, seed + i, "VC_FOLIAGE")
        put(o, c + off)
        paint(o, zg(cols[0], cols[1], z0, z1, 0.07, seed + i), 0.16, 0.16)
        parts.append(o)
    return parts



def berries(pts_normals, rng, cols, r=(0.05, 0.07), mat="VC_FOLIAGE"):
    out = []
    for i, (p, n) in enumerate(pts_normals):
        b = bead("berry", rng.uniform(*r), mat, 4, 6)
        c = cols[i % len(cols)]
        paint(b, zg(mix_h(c, PALE, 0.35), c, p.z - 0.07, p.z + 0.07, 0.0), 0.2, 0.15)
        put(b, p + n * 0.02)
        out.append(b)
    return out


def mix_h(a, b, t):
    c = sl.mix(a, b, t)
    return "#%02x%02x%02x" % tuple(int(clamp(x) * 255) for x in c)


def small_leaves(pn, rng, n_each=1, L=0.2, cols=(LEAF, GRASS_HI)):
    out = []
    for p, nrm in pn:
        for k in range(n_each):
            yaw = rng.uniform(0, 360)
            side = V((-math.sin(math.radians(yaw)), math.cos(math.radians(yaw)), 0))
            d = (nrm + V((0, 0, 0.3))).normalized()
            lf = ribbon("lf", [p, p + d * L * 0.5 + side * 0.01, p + d * L], [0.0, L * 0.28, 0.0], "VC_FOLIAGE", 0.5, 3, side)
            paint(lf, zg(cols[0], cols[1], p.z, p.z + L, 0.05), 0.14, 0.15)
            out.append(lf)
    return out


# ---------------------------------------------------------------- berry bushes
def berry_a(aid, rng):
    cols = ("#35B27C", "#C6F57E")
    parts = []
    pn = []
    for c, R, sq, n in [((0, 0, 0.1), 1.05, (1.1, 1.0, 0.95), 13), ((0.9, 0.3, 0.05), 0.7, (1, 1, 0.9), 7), ((-0.85, 0.35, 0.05), 0.72, (1, 1, 0.9), 7)]:
        parts += leafy_mass(c, R, sq, n, rng, cols, 0.0, 1.5, int(R * 10))
        pn += scatter_on_sphere((c[0], c[1], c[2]), R * 0.92, 10, rng, sq, 0.35, 1.5)
    parts += berries(pn, rng, ["#FF4F8E", "#FF7AA8", "#E8366E", "#FFD166"], (0.075, 0.1))
    parts += small_leaves(pn[::3], rng, 1, 0.22)
    return finish(parts, aid, "bush", {"type": "cylinder", "radius": 0.7, "height": 1.0},
                  sc_bush("meadow", 1.0, 2.2, 0.5, {"meadow": 1.0, "forest": 0.6, "shore": 0.3}, "verdant_bush_berry"), ao=0.35, elev=24, frame=1.05)


def berry_b(aid, rng):
    parts = []
    for k in range(5):
        yaw = 72 * k + rng.uniform(-10, 10)
        pts = grow(V((rng.uniform(-.15, .15), rng.uniform(-.15, .15), 0)), dir_from(yaw, 72), rng.uniform(1.5, 1.9), (0, 0, -0.15), 5, grav=0.9)
        t = tube("cane", pts, 0.035, 0.012, 4, "VC_ROUGH", power=0.8)
        paint(t, bark_fn("#7C5548", "#C99A78", 0, 1.8, k), 0.1, 0.1)
        parts.append(t)
        for j in (3, 5):
            p = pts[j]
            parts += leafy_mass(p, 0.42, (1, 1, 0.8), 3, rng, ("#35B27C", "#C6F57E"), 0.4, 1.9, k * 7 + j, (0.5, 0.7), (0.2, 0.8), 2, False)
            # hanging berry cluster
            for q in range(2):
                b = bead("b", 0.06, "VC_FOLIAGE", 4, 6)
                cc = ["#4FD6F5", "#FFD166", "#7AE7FF"][(k + q) % 3]
                paint(b, solid(cc), 0.2, 0.15)
                put(b, p + V((rng.uniform(-.1, .1), rng.uniform(-.1, .1), -0.28 - 0.07 * q)))
                parts.append(b)
    return finish(parts, aid, "bush", {"type": "cylinder", "radius": 0.5, "height": 1.0},
                  sc_bush("forest", 0.8, 2.4, 0.5, {"forest": 1.0, "meadow": 0.5, "cliff": 0.3}, "verdant_bush_berry"), ao=0.35, elev=18, frame=1.0)


reg("verdant_bush_berry_a")(berry_a)
reg("verdant_bush_berry_b")(berry_b)


# ---------------------------------------------------------------- topiary
def topiary(aid, rng):
    parts = []
    tr = tube("trunk", [V((0, 0, 0)), V((0.02, 0, 0.3)), V((0, 0.02, 0.55))], 0.07, 0.05, 8, "VC_ROUGH", power=0.8)
    paint(tr, bark_fn("#7C5548", "#C99A78", 0, 0.6, 1), 0.1, 0.1)
    parts.append(tr)
    # stacked rounded tiers in one lathe
    prof = []
    tiers = [(0.55, 0.62, 0.62), (0.8, 1.35, 0.5), (0.95, 1.95, 0.34)]  # (center_z-like) approx radii
    # build profile by union of spheres
    zs = [i * 0.06 for i in range(0, 38)]
    zs = [z for z in zs if z <= 2.25]
    for z in zs:
        r = 0.0
        for cz, cr in [(0.62, 0.62), (1.28, 0.5), (1.85, 0.34)]:
            dz = z - cz
            if abs(dz) < cr:
                r = max(r, math.sqrt(cr * cr - dz * dz))
        prof.append((r + 0.0, z + 0.45))
    prof = [(max(r, 0.0), z) for r, z in prof if r > 0.02]
    prof[0] = (0.12, prof[0][1])
    prof.append((0.0, prof[-1][1] + 0.04))
    body = lathe("body", prof, 32, "VC_FOLIAGE", lambda i, a, r, z: (1 + 0.06 * math.sin(8 * a + z * 5.0), 0.0))
    _zg = zg("#35B27C", "#C6F57E", 0.45, 2.7, 0.05)
    paint(body, lambda co, n: sl.mix(_zg(co, n), "#1F8F6E", clamp(0.5 - 0.5 * math.sin(8 * math.atan2(co.y, co.x) + co.z * 5.0 - 1.0 + 1.57)) * 0.35), 0.18, 0.15)
    parts.append(body)
    # pink blossoms in a spiral
    for k in range(18):
        t = k / 17
        z = 0.7 + t * 1.8
        r = 0.0
        for cz, cr in [(1.07, 0.62), (1.73, 0.5), (2.3, 0.34)]:
            dz = z - cz
            if abs(dz) < cr:
                r = max(r, math.sqrt(cr * cr - dz * dz))
        a = k * 1.1
        n = V((math.cos(a), math.sin(a), 0.1)).normalized()
        b = bead("bl", 0.065, "VC_FOLIAGE", 3, 6)
        paint(b, solid([PINK, YELLOW, CYAN][k % 3]), 0.2, 0.1)
        put(b, V((math.cos(a) * r * 1.0, math.sin(a) * r * 1.0, z)), scale=(1, 1, 0.8))
        parts.append(b)
    return finish(parts, aid, "bush", {"type": "cylinder", "radius": 0.6, "height": 2.4},
                  sc_bush("meadow", 0.4, 4.0, 0.2, {"meadow": 1.0}, None, 15, (0.8, 1.2)), ao=0.35, elev=15, frame=1.05)


reg("verdant_bush_topiary")(topiary)


# ---------------------------------------------------------------- fern clump
def fern(aid, rng):
    parts = []
    n = 20
    for k in range(n):
        yaw = 360.0 * k / n + rng.uniform(-10, 10)
        ring = 0 if k < 12 else 1
        L = rng.uniform(0.9, 1.25) * (1.0 if ring == 0 else 0.7)
        lean = 1.1 if ring == 0 else 0.6
        seg = 13
        pts, ws = [], []
        cy, sy = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
        for i in range(seg + 1):
            t = i / seg
            x = L * lean * t ** 1.3 * 0.9
            z = 0.08 + L * (1.25 * t - 0.95 * t * t) * (0.9 if ring == 0 else 1.3)
            pts.append(V((cy * x, sy * x, z)))
            env = math.sin(clamp(t * 1.05) * pi) ** 0.6
            ws.append(0.012 if i == 0 else (0.0 if i == seg else 0.17 * env * (1.0 if i % 2 else 0.55)))
        fr = ribbon("fr", pts, ws, "VC_FOLIAGE", 0.45, 3, (-sy, cy, 0))
        paint(fr, zg("#2FA58C", "#BFF27A", 0.0, 1.0, 0.06, k), 0.2, 0.18)
        parts.append(fr)
    # fiddleheads (curled croziers)
    for k in range(3):
        a = rng.uniform(0, 6.28)
        pts = []
        for i in range(8):
            t = i / 7
            ang = t * 3.4
            pts.append(V((math.cos(a) * 0.06 + 0.07 * (1 - math.cos(ang)) * math.cos(a), math.sin(a) * 0.06 + 0.07 * (1 - math.cos(ang)) * math.sin(a), 0.1 + 0.4 * t + 0.06 * math.sin(ang * 1.0))))
        t_ = tube("fh", pts, 0.012, 0.01, 5, "VC_FOLIAGE")
        paint(t_, zg("#9BEA8A", "#E6FA9A", 0.1, 0.55, 0.0), 0.1, 0.1)
        parts.append(t_)
    return finish(parts, aid, "bush", None, sc_bush("forest", 1.3, 1.4, 0.8, {"forest": 1.0, "shore": 0.6, "meadow": 0.3}, None, 35, (0.8, 1.4)), ao=0.35, elev=28, frame=1.05)


reg("verdant_bush_fern")(fern)


# ---------------------------------------------------------------- flowering hedge
def hedge(aid, rng):
    centers = [((-1.0, 0, 0.1), 0.85, (1.3, 0.95, 0.95), 7), ((0.0, 0.05, 0.12), 0.9, (1.5, 0.95, 0.95), 8), ((1.0, -0.03, 0.1), 0.85, (1.3, 0.95, 0.95), 7)]
    parts = []
    pn = []
    for c, R, sq, n in centers:
        parts += leafy_mass(c, R, sq, n, rng, ("#35B27C", "#C6F57E"), 0.0, 1.4, int(c[0] * 10 + 20), (0.4, 0.58), (0.4, 0.95))
        pn += scatter_on_sphere(c, R * 0.95, 14, rng, sq, 0.25, 1.5)
    cols = [(PINK, "#FFB0CC"), ("#FFE070", "#FFF3B0"), ("#FF8AB4", "#FFD0E2")]
    for i, (p, n) in enumerate(pn):
        cc = cols[i % 3] if i % 7 else cols[0]
        # little 4-petal cross flower
        side = n.cross(V((0, 0, 1)))
        if side.length < 0.1:
            side = V((1, 0, 0))
        side.normalize()
        s2 = n.cross(side).normalized()
        R = rng.uniform(0.1, 0.15)
        bt = Batch("fl", "VC_FOLIAGE")
        for sv in (side, s2):
            bt.ribbon([p - sv * R, p + n * 0.01, p + sv * R], [0.0, R * 0.55, 0.0], lambda co, cc=cc: cc[0], 0.0, 3, n.cross(sv))
        ob = bt.obj()
        parts.append(ob)
        ct = bead("ct", R * 0.3, "VC_FOLIAGE", 3, 5)
        paint(ct, solid("#FFD166" if i % 3 else "#FFFFFF" if False else CREAM))
        put(ct, p + n * 0.025)
        parts.append(ct)
    return finish(parts, aid, "bush", {"type": "box", "size": [3.1, 1.3, 1.1]},
                  sc_bush("meadow", 0.5, 4.0, 0.3, {"meadow": 0.7, "shore": 0.4, "forest": 0.3}, None, 18, (0.8, 1.2)), ao=0.35, elev=22, frame=1.05)


reg("verdant_bush_flower_hedge")(hedge)


# ---------------------------------------------------------------- spiky succulent
def succulent(aid, rng):
    parts = []

    def rosette(center, scale, n, rng, tilt0=70):
        out = []
        for k in range(n):
            t = k / n
            yaw = k * 137.5
            tilt = lerp(78, 8, t ** 0.8)
            L = scale * lerp(0.95, 0.4, t)
            d = dir_from(yaw, 90 - tilt)
            pts = grow(center, d, L, (0, 0, 0.0), 5, grav=0.0)
            # curve outward-then-up: add bend away from axis
            outv = V((math.cos(math.radians(yaw)), math.sin(math.radians(yaw)), 0))
            pts = [p + outv * (0.1 * L * (i / 5) ** 2) for i, p in enumerate(pts)]
            rad = [scale * 0.13 * lerp(1.0, 0.9, i / 5) * (1 - (i / 5) ** 1.6) + 0.002 for i in range(6)]
            rad[0] = scale * 0.11
            tb = tube("sp", pts, 0, 0, 5, "VC_FOLIAGE", radii=rad)
            tl = (1 - t)
            paint(tb, zg("#2FB8A0", "#7AE7C8", center.z, center.z + scale * 0.9, 0.04), 0.2, 0.15)
            # tip color: pink via distance from center
            c0 = V(center)
            paint(tb, lambda co, n, c0=c0, scale=scale, tl=tl: sl.mix(sl.mix("#2FB8A0", "#7AE7C8", clamp((co.z - c0.z) / (scale * 0.8))),
                                                                       PINK, clamp(((co - c0).length / (scale * 0.95) - 0.78) * 5.0)), 0.18, 0.16)
            out.append(tb)
        return out
    parts += rosette(V((0, 0, 0.0)), 0.95, 20, rng)
    for c, s in [(V((0.85, 0.35, 0.0)), 0.42), (V((-0.75, 0.5, 0.0)), 0.36), (V((0.2, -0.85, 0.0)), 0.4)]:
        parts += rosette(c, s, 9, rng)
    return finish(parts, aid, "bush", {"type": "cylinder", "radius": 0.6, "height": 0.9},
                  sc_bush("cliff", 1.0, 1.6, 0.6, {"cliff": 1.0, "meadow": 0.4, "shore": 0.5}, None, 45, (0.7, 1.4)), ao=0.4, elev=30, frame=1.05)


reg("verdant_bush_succulent")(succulent)


# ---------------------------------------------------------------- puffball shrub
def puffball(aid, rng):
    parts = []
    stems = []
    for k in range(4):
        yaw = 90 * k + rng.uniform(-20, 20)
        pts = grow(V((0, 0, 0)), dir_from(yaw, rng.uniform(62, 78)), rng.uniform(1.0, 1.4), (0, 0, 0.0), 4, grav=0.4)
        t = tube("st", pts, 0.04, 0.015, 4, "VC_ROUGH", power=0.8)
        paint(t, bark_fn("#7C5548", "#C99A78", 0, 1.3, k), 0.1, 0.1)
        parts.append(t)
        stems.append(pts)
    cols = [(PINK, "#FFD0E2"), (YELLOW, "#FFF3B0"), (MINT, "#E4FFF2"), (CYAN, "#D2F8FF"), (VIOLET, "#E4D6FF")]
    specs = []
    for k, pts in enumerate(stems):
        specs.append((pts[-1], rng.uniform(0.3, 0.38), k))
        if k == 1:
            specs.append((pts[2] + V((rng.uniform(-.2, .2), rng.uniform(-.2, .2), 0.05)), rng.uniform(0.2, 0.26), k + 2))
    specs.append((V((0, 0, 0.55)), 0.4, 4))
    for i, (c, R, ci) in enumerate(specs):
        cc = cols[(ci + i) % len(cols)]
        core = ball("core", R, 3, (1, 1, 1), 0.22, 0.5, 20 + i, "VC_FOLIAGE")
        _c0, _c1 = cc
        paint(core, lambda co, n, c=c, R=R, _c0=_c0, _c1=_c1: sl.mix(sl.mix(_c0, SHADOW, 0.18), _c1, clamp(0.5 + (co.z - c.z) / (2 * R)) * 0.9 + nz(co, 5, 7.0) * 0.25), 0.15, 0.12)
        put(core, c)
        parts.append(core)
    return finish(parts, aid, "bush", {"type": "cylinder", "radius": 0.55, "height": 1.0},
                  sc_bush("meadow", 0.8, 2.2, 0.5, {"meadow": 1.0, "forest": 0.4, "cliff": 0.4}, None, 28, (0.8, 1.3)), ao=0.35, elev=20, frame=1.0)


def fib_dirs_s(n):
    out = []
    for i in range(n):
        z = 1 - 2 * (i + 0.5) / n
        r = math.sqrt(max(0, 1 - z * z))
        ph = i * 2.399963
        out.append(V((r * math.cos(ph), r * math.sin(ph), z)))
    return out


reg("verdant_bush_puffball")(puffball)


# ---------------------------------------------------------------- broadleaf (taro-like)
def broadleaf(aid, rng):
    parts = []
    n = 9
    for k in range(n):
        yaw = 360.0 * k / n + rng.uniform(-14, 14)
        ring = k % 3
        stalk_h = 0.55 + 0.25 * ring + rng.uniform(-0.05, 0.1)
        lean = 0.28 + 0.1 * (2 - ring)
        cy, sy = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
        sp = [V((cy * lean * 0.3 * t * t * stalk_h + 0, sy * lean * 0.3 * t * t * stalk_h, stalk_h * t)) for t in (0, 0.33, 0.66, 1.0)]
        sp = [V((cy * (0.1 + lean * s * s), sy * (0.1 + lean * s * s), stalk_h * s)) for s in (0, 0.33, 0.66, 1.0)]
        stl = tube("st", sp, 0.03, 0.02, 5, "VC_FOLIAGE")
        paint(stl, zg("#2FA58C", "#8FE08A", 0, 1.0, 0.04), 0.1, 0.1)
        parts.append(stl)
        # leaf (heart-ish ellipse), built local (+X forward) then oriented
        L, W = 0.75 + 0.1 * ring, 0.34
        pts, ws = [], []
        for i in range(8):
            t = i / 7
            pts.append(V((L * t, 0, 0.2 * L * math.sin(t * 1.6) - 0.28 * L * t * t)))
            shape = math.sin(clamp(t * 1.12 - 0.02) * pi) ** 0.75
            heart = 1.0 + 0.35 * max(0, 0.25 - t) / 0.25
            ws.append(W * shape * heart if 0 < i < 7 else (0.03 if i == 0 else 0.0))
        lf = ribbon("lf", pts, ws, "VC_FOLIAGE", 0.4, 7, (0, 1, 0))

        def mid(co, n_, W=W):
            m = clamp(1 - abs(co.y) / (W * 0.12))
            c = sl.mix("#2FA58C", "#9BEA8A", clamp(co.x / L * 0.8))
            return sl.mix(c, "#D6F59A", m * 0.7)
        paint(lf, mid, 0.18, 0.18)
        put(lf, sp[-1], spin=yaw + rng.uniform(-8, 8), up=None)
        parts.append(lf)
    return finish(parts, aid, "bush", None, sc_bush("forest", 1.0, 1.6, 0.7, {"forest": 1.0, "shore": 0.8, "meadow": 0.2}, None, 30, (0.8, 1.4)), ao=0.35, elev=28, frame=1.05)


reg("verdant_bush_broadleaf")(broadleaf)
