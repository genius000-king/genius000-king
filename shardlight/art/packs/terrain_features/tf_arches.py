"""Arches & pillars: natural rock arches, sandstone arches, hoodoos, balanced rock, basalt organ pipes."""
import math
import random
from mathutils import Vector, noise
import sl_common as sl
from tf_core import *
from tf_paint import PAL, paint_rock, zrange

SAND = ["#F5B971", "#E8935A", "#C4644F", "#F2A7A0", "#E8935A", "#D9764F", "#F5B971", "#B5533F"]


def strata_disp(obj, band_h, amp, seed):
    """Horizontal sediment ledges: hard layers protrude, soft layers recede (along horizontal normals)."""
    rng = random.Random(seed)
    tab = [rng.uniform(-1, 1) for _ in range(64)]
    me = obj.data
    for v in me.vertices:
        bi = v.co.z / band_h
        k = int(bi)
        f = bi - k
        r = lerp(tab[k % 64], tab[(k + 1) % 64], smoothstep(0.8, 1.0, f))
        n = Vector((v.normal.x, v.normal.y, 0))
        if n.length > 1e-4:
            n = n.normalized() * (1 - abs(v.normal.z))
            v.co += n * r * amp
    me.update()


def arch(span, height, thick, depth, seed, p=2.4, skew=0.1, noise_amp=0.26, foot=1.75, name="arch", n=38, ring_n=14,
         base_blobs=True, blob_k=1.25):
    mb = MB()
    rng = random.Random(seed)
    ax = span / 2 + thick * 0.5
    az = height - thick * 0.45
    pts = []
    for i in range(n + 1):
        ph = math.pi * i / n
        x = ax * math.cos(ph) * (1 + skew * math.sin(ph) * 0.3)
        z = az * math.sin(ph) * (1 + skew * math.cos(ph))
        pts.append(Vector((x, 0, z)))
    frames, rings = [], []
    for i, pt in enumerate(pts):
        if i == 0:
            t = pts[1] - pts[0]
        elif i == n:
            t = pts[-1] - pts[-2]
        else:
            t = (pts[i + 1] - pts[i - 1])
        t = t.normalized()
        ph = i / n
        side = 1 if ph < 0.5 else -1
        fl = lerp(foot, 0.82, smoothstep(0.0, 0.4, min(ph, 1 - ph)))  # thick at the feet, slim at crown
        fl *= 1.0 + 0.12 * (1 if ph > 0.5 else -1) * (1 - smoothstep(0.0, 0.4, min(ph, 1 - ph)))  # asymmetric legs
        a = thick / 2 * fl
        b = depth / 2 * lerp(1.25, 0.8, smoothstep(0.0, 0.4, min(ph, 1 - ph)))
        up = Vector((0, 1, 0))
        w = up
        u = w.cross(t)
        ring = []
        for k in range(ring_n):
            th = 2 * math.pi * k / ring_n
            c, s_ = math.cos(th), math.sin(th)
            x = a * math.copysign(abs(c) ** (2 / p), c)
            y = b * math.copysign(abs(s_) ** (2 / p), s_)
            wp = pts[i] + u * x + w * y
            nz = fbm(wp * 0.45, seed, 3)
            f2 = 1 + noise_amp * nz * 2.2 * (0.35 if i in (0, n) else 1.0)
            ring.append((x * f2, y * f2))
        frames.append((pts[i], t, up))
        rings.append(ring)
    mb.sweep(frames, rings, part=1)
    if base_blobs:
        for sgn in (1, -1):
            k = thick * blob_k
            mb.rock(size=(k * 0.95, depth * 0.62, k * 0.55), seed=seed + 5 * sgn, subdiv=3, noise_amp=0.12, planes=6,
                    soft=0.09, plane_off=(0.65, 0.92), flat_bottom=0.4,
                    M=xf((sgn * ax * 1.02, 0, k * 0.1), (0, 0, rng.uniform(0, 60))), part=2 if sgn > 0 else 3)
        for i in range(5):
            sgn = rng.choice((1, -1))
            kk = rng.uniform(0.35, 0.9)
            mb.rock(size=(kk * 1.3, kk, kk * 0.7), seed=seed + 40 + i, subdiv=2, noise_amp=0.12, planes=5, soft=0.08,
                    flat_bottom=0.4,
                    M=xf((sgn * ax * 1.0 + rng.uniform(-thick * 1.2, thick * 1.2), rng.uniform(-depth * 0.7, depth * 0.7), 0),
                         (0, 0, rng.uniform(0, 360))), part=10 + i)
    return mb


def hoodoo(H, r, seed, tiers=3, cap=1.5, name="hoodoo", sides=14):
    rng = random.Random(seed)
    prof = [(0.0, r * 1.7), (H * 0.05, r * 1.35), (H * 0.12, r * 1.05)]
    z = H * 0.12
    for t in range(tiers):
        span = (H - z) / (tiers - t) * rng.uniform(0.85, 1.05)
        neck = r * rng.uniform(0.62, 0.85) * (1 - 0.12 * t)
        capr = r * rng.uniform(1.0, 1.25) * cap * (0.78 if t < tiers - 1 else 1.0) * (1 - 0.15 * t)
        capr = max(capr, neck * 1.15)
        z1 = z + span if t < tiers - 1 else H
        ch = min(span * 0.4, 0.9 + 0.3 * r)
        prof += [(z + 0.0, neck), (z1 - ch * 1.6, neck * 0.95), (z1 - ch, capr * 0.88), (z1 - ch * 0.4, capr),
                 (z1, capr * 0.85)]
        if t == tiers - 1:
            prof += [(z1 + ch * 0.18, capr * 0.6), (z1 + ch * 0.28, capr * 0.22)]
        else:
            prof += [(z1 + 0.04, capr * 0.5)]
        z = z1 + 0.04
    return prof


def hoodoo_obj(H, r, seed, pal, tiers=3, cap=1.5, strata_cols=None, name="hoodoo", band_h=1.1):
    mb = MB()
    prof = hoodoo(H, r, seed, tiers, cap)
    mb.column(prof, sides=14, seed=seed, jit=0.07, top="flat", ring_noise=0.16, rn_scale=0.6, part=1)
    rng = random.Random(seed)
    for i in range(4):
        a = rng.uniform(0, 6.28)
        d = rng.uniform(1.8, 3.2) * r
        k = rng.uniform(0.35, 0.8) * r
        mb.rock(size=(k * 1.3, k, k * 0.7), seed=seed + 20 + i, subdiv=2, noise_amp=0.12, planes=5, soft=0.08,
                flat_bottom=0.4, M=xf((math.cos(a) * d, math.sin(a) * d, 0), (0, 0, rng.uniform(0, 360))), part=5 + i)
    o = mb.build(name, angle=40)
    strata_disp(o, band_h, 0.22, seed)
    return o


def organ(seed, mode, R=0.95, H=12.0, name="organ"):
    mb = MB(("VC_ROUGH", "EMIT"))
    rng = random.Random(seed)
    dx = math.sqrt(3) * R
    dy = 1.5 * R
    cols = []
    if mode == "fan":  # organ-pipe ramp: tall at left to short at right, 2-3 rows
        nx, ny = 10, 3
        for j in range(ny):
            for i in range(nx):
                x = (i - nx / 2) * dx + (dx / 2 if j % 2 else 0)
                y = (j - ny / 2) * dy
                f = i / (nx - 1)
                h = H * (1.0 - 0.72 * f ** 0.9) * (1 - 0.1 * j) * rng.uniform(0.88, 1.06)
                cols.append((x, y, h))
    else:  # spire cluster: tall in the middle
        for ring, cnt in ((0, 1), (1, 6), (2, 12)):
            for k in range(cnt):
                if ring == 0:
                    x, y = 0, 0
                else:
                    a = 2 * math.pi * k / cnt + ring * 0.3
                    x, y = math.cos(a) * dx * ring, math.sin(a) * dx * ring
                h = H * (1.0 - 0.28 * ring) * rng.uniform(0.7, 1.05) * (1 - 0.1 * fbm(Vector((x, y, 0)) * 0.4, seed))
                if ring == 2 and rng.random() < 0.3:
                    h *= 0.45
                cols.append((x, y, h))
    mb.rock(size=(max(c[0] for c in cols) * 0.8 + R, max(abs(c[1]) for c in cols) * 0.8 + R * 0.9, 0.5), seed=seed,
            subdiv=3, noise_amp=0.2, planes=0, flat_bottom=None, M=xf((0, 0, 0.1)), mat="EMIT", part=900)
    for k, (x, y, h) in enumerate(cols):
        r = R * 0.94
        n = 6
        prof = [(i * h / n, r * (1 + 0.02 * math.sin(i * 1.9 + k))) for i in range(n + 1)]
        mb.column(prof, sides=6, seed=seed + k, jit=0.03, rot0=math.radians(30), top="flat",
                  lean=(rng.uniform(-0.03, 0.03), rng.uniform(-0.03, 0.03)),
                  top_slope=(rng.uniform(-0.45, 0.45), rng.uniform(-0.45, 0.45)), M=xf((x, y, 0)), part=k + 1)
    for i in range(6):
        a = rng.uniform(0, 6.28)
        kk = rng.uniform(0.4, 0.9)
        mb.rock(size=(kk * 1.4, kk, kk * 0.7), seed=seed + 70 + i, subdiv=2, noise_amp=0.12, planes=5, soft=0.07,
                flat_bottom=0.4, M=xf((math.cos(a) * (R * 6 + 1), math.sin(a) * R * 3.4, 0), (0, 0, rng.uniform(0, 360))),
                part=100 + i)
    o = mb.build(name, angle=22)
    return o


def paint_organ(o, seed, H):
    P = PAL["ember"]
    me = o.data
    names = [m.name for m in me.materials]

    def fn(co, n, pn, mi, pid):
        if names[mi] == "EMIT":
            return sl.hex_rgb("#FF5A1F")
        t = clamp(co.z / H)
        c = mix3("#4A3C5C", "#6B5B82", "#9A8CAA", t)
        jj = ((pid * 53) % 13 - 6) * 0.014
        c = tuple(clamp(x * (1 + jj * 3) + jj, 0, 1) for x in c)
        c = sl.mix(c, "#FF5A1F", (1 - smoothstep(0.0, 0.06, t)) * 0.5)
        c = sl.mix(c, P["top2"], smoothstep(0.8, 0.98, n.z * 0.5 + pn.z * 0.5) * 0.65)
        nn = (n * 0.5 + pn * 0.5)
        if nn.length > 1e-6:
            nn.normalize()
        return lit(c, nn, 0.2)

    paint(o, fn)


def balanced(seed, pal_name, scale=1.0):
    mb = MB()
    rng = random.Random(seed)
    H = 4.2 * scale
    prof = [(0, 1.9 * scale), (H * 0.15, 1.35 * scale), (H * 0.45, 0.8 * scale), (H * 0.8, 0.68 * scale),
            (H, 0.9 * scale)]
    mb.column(prof, sides=10, seed=seed, jit=0.1, top="flat", ring_noise=0.14, rn_scale=0.6, part=1, lean=(0.05, 0.02))
    mb.rock(size=(2.6 * scale, 2.1 * scale, 1.7 * scale), seed=seed + 2, subdiv=4, noise_amp=0.1, planes=7, soft=0.1,
            plane_off=(0.66, 0.92), flat_bottom=0.5, M=xf((0.25 * scale, 0.0, H + 1.0 * scale), (3, -5, 20)), part=2)
    for i in range(5):
        a = rng.uniform(0, 6.28)
        d = rng.uniform(2.0, 3.4) * scale
        k = rng.uniform(0.4, 0.9) * scale
        mb.rock(size=(k * 1.3, k, k * 0.7), seed=seed + 30 + i, subdiv=2, noise_amp=0.12, planes=5, soft=0.08,
                flat_bottom=0.4, M=xf((math.cos(a) * d, math.sin(a) * d, 0), (0, 0, rng.uniform(0, 360))), part=5 + i)
    o = mb.build("balanced", angle=40)
    return o


def build_arches(rec, only=None):
    A = PAL
    sa = (1.1, SAND)
    jobs = []

    def job(id_, cat, world, maker, painter, ao=0.5, extra=None):
        jobs.append((id_, cat, world, maker, painter, ao, extra))

    # ---- verdant lavender arches (grass top)
    def v_arch(span, h, thick, depth, seed, p=2.4):
        def mk():
            return arch(span, h, thick, depth, seed, p=p).build("arch", angle=45)
        return mk

    def paint_v(seed, pal="verdant", **kw):
        return lambda o: paint_rock(o, A[pal], seed, top_thr=0.5, top_str=0.9, dirt=0.25, **kw)

    job("verdant_arch_natural_a", "arch", "verdant", v_arch(6.0, 9.5, 3.8, 5.0, 201), paint_v(201),
        extra={"clear_span": 6.0, "walk_under": True})
    job("verdant_arch_natural_b", "arch", "verdant", v_arch(9.0, 14.0, 4.6, 5.8, 202, 2.2), paint_v(202),
        extra={"clear_span": 9.0, "walk_under": True})

    # ---- amber sandstone arches
    def a_arch(span, h, thick, depth, seed, band, p=3.0):
        def mk():
            o = arch(span, h, thick, depth, seed, p=p, noise_amp=0.18, foot=1.8, skew=0.18).build("arch", angle=45)
            strata_disp(o, band, 0.2, seed)
            return o
        return mk

    def paint_a(seed, band):
        return lambda o: paint_rock(o, A["amber"], seed, top_thr=0.6, top_str=0.6, dirt=0.1, strata=(band, SAND))

    job("amber_arch_sandstone_a", "arch", "amber", a_arch(7.0, 10.5, 3.2, 4.2, 211, 1.0), paint_a(211, 1.0),
        extra={"clear_span": 7.0, "walk_under": True})
    job("amber_arch_sandstone_b", "arch", "amber", a_arch(11.0, 15.0, 4.4, 5.4, 212, 1.4, 3.4), paint_a(212, 1.4),
        extra={"clear_span": 11.0, "walk_under": True})
    # ---- glass ice arch
    job("glass_arch_ice_a", "arch", "glass", v_arch(6.5, 8.5, 2.8, 3.6, 221, 2.2),
        lambda o: paint_rock(o, A["glass"], 221, top_thr=0.45, top_str=0.9, dirt=0.15),
        extra={"clear_span": 6.5, "walk_under": True})

    # ---- hoodoos
    def hd(H, r, seed, tiers, cap, band, pal="amber"):
        def mk():
            return hoodoo_obj(H, r, seed, A[pal], tiers, cap, band_h=band)
        return mk

    job("amber_pillar_hoodoo_a", "pillar", "amber", hd(8.0, 0.9, 231, 2, 1.5, 0.9), paint_a(231, 0.9))
    job("amber_pillar_hoodoo_b", "pillar", "amber", hd(12.0, 1.1, 232, 3, 1.35, 1.2), paint_a(232, 1.2))
    job("amber_pillar_hoodoo_c", "pillar", "amber", hd(6.0, 0.7, 233, 1, 1.9, 0.7), paint_a(233, 0.7))
    # ---- balanced rocks
    job("verdant_pillar_balanced_a", "pillar", "verdant", lambda: balanced(241, "verdant", 1.0),
        lambda o: paint_rock(o, A["verdant"], 241, top_thr=0.55, top_str=0.85, dirt=0.3))
    job("amber_pillar_balanced_a", "pillar", "amber", lambda: balanced(242, "amber", 1.35),
        lambda o: paint_rock(o, A["amber"], 242, top_thr=0.6, top_str=0.6, dirt=0.1, strata=(0.8, SAND)))
    # ---- basalt organ pipes
    job("ember_pillar_organ_a", "pillar", "ember", lambda: organ(251, "fan", 0.95, 13.0, "organ"),
        lambda o: paint_organ(o, 251, 13.0), ao=0.5)
    job("ember_pillar_organ_b", "pillar", "ember", lambda: organ(252, "spire", 1.05, 15.0, "organ"),
        lambda o: paint_organ(o, 252, 15.0), ao=0.5)

    for id_, cat, world, maker, painter, ao, extra in jobs:
        if only and not any(o in id_ for o in only):
            continue
        fresh()
        res = maker()
        o = res.build("x", angle=45) if isinstance(res, MB) else res
        painter(o)
        ex = {"family": "arch" if cat == "arch" else "pillar"}
        if extra:
            ex.update(extra)
        e = finish([o], id_, cat, [world], {"type": "trimesh"}, None, ao=ao,
                   preview_kw=dict(elev=14, azim=-30, frame=1.05), extra=ex)
        rec.add(e)
