"""Modular cliff pieces: verdant lavender+grass, amber strata, ember basalt columns, glass ice."""
import math
import random
import bmesh
from mathutils import Vector, noise
import sl_common as sl
from tf_core import *
from tf_paint import PAL, paint_rock


# --------------------------------------------------------------------------- box grid solid
def _grid(bm, nu, nv, fn):
    g = []
    for j in range(nv + 1):
        row = []
        for i in range(nu + 1):
            row.append(bm.verts.new(fn(i / nu, j / nv)))
        g.append(row)
    for j in range(nv):
        for i in range(nu):
            bm.faces.new((g[j][i], g[j][i + 1], g[j + 1][i + 1], g[j + 1][i]))


def box_solid(W, D, H, nx, ny, nz):
    """Closed box (x:-W/2..W/2, y:-D/2..D/2, z:0..H) with independent grid resolution per axis."""
    bm = bmesh.new()
    _grid(bm, nx, nz, lambda s, t: Vector(((s - 0.5) * W, -D / 2, t * H)))
    _grid(bm, nx, nz, lambda s, t: Vector(((s - 0.5) * W, D / 2, t * H)))
    _grid(bm, nx, ny, lambda s, t: Vector(((s - 0.5) * W, (t - 0.5) * D, H)))
    _grid(bm, nx, ny, lambda s, t: Vector(((s - 0.5) * W, (t - 0.5) * D, 0)))
    _grid(bm, ny, nz, lambda s, t: Vector((-W / 2, (s - 0.5) * D, t * H)))
    _grid(bm, ny, nz, lambda s, t: Vector((W / 2, (s - 0.5) * D, t * H)))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def displaced_wall(mb, W, D, H, fn_front, fn_top, nx, ny, nz, round_r=0.0, part=1, mat="VC_ROUGH", back_noise=0.0,
                   seed=0):
    bm = box_solid(W, D, H, nx, ny, nz)
    eps = 1e-3
    for v in bm.verts:
        x, y, z = v.co
        is_front = y < -D / 2 + eps
        is_top = z > H - eps
        is_back = y > D / 2 - eps
        nxv, nyv, nzv = x, y, z
        if is_front:
            nyv = y - fn_front(x, z)
        if is_top:
            nzv = z + fn_top(x, y)
        if is_back and back_noise:
            nyv = y + back_noise * fbm(Vector((x, 0, z)) * 0.3, seed)
        v.co = Vector((nxv, nyv, nzv))
    # fold the sampled mesh into the shared builder
    me_faces = []
    vmap = {}
    for v in bm.verts:
        vmap[v] = mb.bm.verts.new(v.co)
    for f in bm.faces:
        nf = mb.bm.faces.new([vmap[v] for v in f.verts])
        me_faces.append(nf)
    bm.free()
    mb._tag(me_faces, mat, part)
    return me_faces



def rubble(mb, W, D, H, seed, n_base=7, n_face=6, n_top=0, sc=1.0, face_lo=0.2, face_hi=0.85, mat="VC_ROUGH"):
    """Chunky faceted rocks overlapping the face/foot so the wall never reads as a box."""
    rng = random.Random(seed + 500)
    pid = 100
    for i in range(n_base):
        x = rng.uniform(-W / 2 + 2.2, W / 2 - 2.2)
        k = rng.uniform(0.9, 2.0) * sc
        mb.rock(size=(k * 1.3, k * 1.0, k * 0.8), seed=seed + 600 + i, subdiv=3, noise_amp=0.12, planes=6, soft=0.08,
                plane_off=(0.62, 0.9), flat_bottom=0.35,
                M=xf((x, -D / 2 - k * 0.25 + rng.uniform(-0.5, 0.3), k * 0.2), (0, 0, rng.uniform(0, 360))),
                mat=mat, part=pid)
        pid += 1
    for i in range(n_face):
        x = rng.uniform(-W / 2 + 2.6, W / 2 - 2.6)
        z = rng.uniform(face_lo, face_hi) * H
        k = rng.uniform(1.0, 2.0) * sc * (H / 12) ** 0.4
        mb.rock(size=(k * 1.2, k * 0.8, k * 0.75), seed=seed + 700 + i, subdiv=3, noise_amp=0.12, planes=6, soft=0.08,
                plane_off=(0.62, 0.9), flat_bottom=None,
                M=xf((x, -D / 2 + 0.1, z), (rng.uniform(-10, 10), 0, rng.uniform(-25, 25))), mat=mat, part=pid)
        pid += 1
    for i in range(n_top):
        x = rng.uniform(-W / 2 + 2.6, W / 2 - 2.6)
        k = rng.uniform(0.8, 1.6) * sc
        mb.rock(size=(k * 1.3, k, k * 0.7), seed=seed + 800 + i, subdiv=3, noise_amp=0.12, planes=6, soft=0.08,
                flat_bottom=0.3, M=xf((x, rng.uniform(-D / 2 + 1.0, D / 2 - 1.5), H + k * 0.1), (0, 0, rng.uniform(0, 360))),
                mat=mat, part=pid)
        pid += 1



def top_shape(x, y, W, D, H, seed, amp=0.07, back=0.12):
    e = end_fade(x, W)
    u = (y + D / 2) / D
    sh = (1 - clamp((y + D / 2) / 2.2)) ** 2
    return e * (amp * H * fbm(Vector((x * 0.15, y * 0.2, 0)), seed + 4, 2) * 2 + back * H * u - 0.55 * sh * 2.0)


def end_fade(x, W, span=2.0):
    return smoothstep(W / 2, W / 2 - span, abs(x))


# --------------------------------------------------------------------------- style: verdant / amber / glass
def verdant_cliff(W, D, H, seed, overhang=1.0, striate=0.5, slope=0.15):
    mb = MB()
    rng = random.Random(seed)
    ledges = [(rng.uniform(0.25, 0.8), rng.uniform(0.3, 0.9)) for _ in range(3)]

    def ff(x, z):
        t = z / H
        e = end_fade(x, W)
        v = 1.0 * fbm(Vector((x, 0, z)) * 0.17, seed, 3) * H * 0.26
        v += 1.7 * (noise.cell(Vector((x * 0.16, z * 0.11, seed * 2.3))) - 0.5) * 2.0
        r = abs(fbm(Vector((x * 0.9, 3, z * 0.12)), seed + 2, 2))
        v += striate * (0.35 - r) * 1.6
        v += overhang * 1.5 * smoothstep(0.72, 0.97, t)
        v += 2.6 * (1 - t) ** 2.2
        v -= slope * (H - z) * 0.35
        for (lt, la) in ledges:  # ledges: small shelves
            v += la * 0.7 * smoothstep(0.04, 0.0, abs(t - lt))
        return v * e

    def ft(x, y):
        return top_shape(x, y, W, D, H, seed)

    displaced_wall(mb, W, D, H, ff, ft, int(W / 0.8), int(D / 0.9), int(H / 0.8), back_noise=0.5, seed=seed)
    rubble(mb, W, D, H, seed, n_base=int(W / 2.0), n_face=int(H / 6), n_top=int(W / 6), sc=1.2)
    o = mb.build("cliff", angle=45)
    paint_cliff(o, "verdant", W, H, seed)
    return o


def amber_cliff(W, D, H, seed, band_h=1.8, caprock=1.2, gully=0.9):
    mb = MB()
    rng = random.Random(seed)
    nb = int(H / band_h) + 2
    rec = [rng.uniform(0.0, 1.0) for _ in range(nb)]  # per-band recession

    def ff(x, z):
        t = z / H
        e = end_fade(x, W)
        bi = z / band_h
        k = int(bi)
        f = bi - k
        a = rec[min(k, nb - 1)]
        b = rec[min(k + 1, nb - 1)]
        rr = lerp(a, b, smoothstep(0.82, 1.0, f))
        v = -rr * 0.9 + 0.6
        gx = fbm(Vector((x * 0.35, 1, z * 0.05)), seed + 3, 2)
        v += gully * (gx * 1.6)
        v += caprock * smoothstep(0.88, 0.98, t) * 1.4
        v += 2.2 * (1 - t) ** 2.2
        v += 0.4 * fbm(Vector((x, 0, z)) * 0.5, seed + 9, 2)
        return v * e

    def ft(x, y):
        return top_shape(x, y, W, D, H, seed, 0.04, 0.08)

    displaced_wall(mb, W, D, H, ff, ft, int(W / 0.8), int(D / 0.9), int(H / 0.55), back_noise=0.3, seed=seed)
    rubble(mb, W, D, H, seed, n_base=int(W / 2.0), n_face=int(H / 7), n_top=0, sc=1.1)
    o = mb.build("cliff", angle=50)
    paint_cliff(o, "amber", W, H, seed, band_h=band_h)
    return o


def glass_cliff(W, D, H, seed, plate=1.6):
    mb = MB(("VC_ROUGH", "GLASS"))
    rng = random.Random(seed)

    def ff(x, z):
        e = end_fade(x, W)
        t = z / H
        c = noise.cell(Vector((x * 0.22, z * 0.17, seed * 1.7)))
        v = plate * (c - 0.5) * 2.0
        v += 0.9 * fbm(Vector((x, 0, z)) * 0.3, seed, 2) * 1.5
        v += 1.0 * smoothstep(0.7, 0.98, t) + 2.0 * (1 - t) ** 2.2
        return v * e

    def ft(x, y):
        return top_shape(x, y, W, D, H, seed, 0.06, 0.1)

    displaced_wall(mb, W, D, H, ff, ft, int(W / 0.85), int(D / 1.0), int(H / 0.8), back_noise=0.4, seed=seed)
    rubble(mb, W, D, H, seed, n_base=int(W / 2.2), n_face=int(H / 6), n_top=int(W / 6), sc=1.1)
    # translucent ice shards sticking out of the face + icicles hanging off the lip
    for i in range(int(W / 2.2)):
        x = rng.uniform(-W / 2 + 2.5, W / 2 - 2.5)
        z = rng.uniform(H * 0.25, H * 0.8)
        L = rng.uniform(1.6, 3.2) * (H / 12) ** 0.5
        r = rng.uniform(0.35, 0.6)
        prof = [(0, r), (L * 0.7, r * 0.95), (L, r * 0.5)]
        mb.column(prof, sides=5, seed=seed + i, jit=0.08, top="point", apex=L * 0.22,
                  M=xf((x, -D / 2 - 0.2, z), (rng.uniform(72, 104), 0, rng.uniform(-14, 14))), mat="GLASS",
                  part=10 + i)
    for i in range(int(W / 1.6)):
        x = rng.uniform(-W / 2 + 2.0, W / 2 - 2.0)
        L = rng.uniform(1.2, 3.8)
        r = rng.uniform(0.18, 0.32)
        zt = H * 0.96 + 0.3
        mb.column([(0, r * 0.2), (L * 0.6, r * 0.8), (L, r)], sides=5, seed=seed + 30 + i, jit=0.1, top="flat",
                  bottom=False, M=xf((x, -D / 2 - 1.2, zt), (180, 0, 0)), mat="GLASS", part=40 + i)
    o = mb.build("cliff", angle=30)
    paint_cliff(o, "glass", W, H, seed)
    return o


# --------------------------------------------------------------------------- ember basalt columns
def basalt_wall(W, D, H, seed, R=0.95, gap=0.06, broken=0.12, front_ratio=0.5, glow=True):
    mb = MB(("VC_ROUGH", "EMIT"))
    rng = random.Random(seed)
    dx = math.sqrt(3) * R
    dy = 1.5 * R
    rows = max(2, int(D / dy) + 1)
    r = R * (1 - gap)
    if glow:
        mb.rock(size=(W * 0.47, D * 0.45, 0.5), seed=seed, subdiv=3, noise_amp=0.2, planes=0, soft=0.2,
                flat_bottom=None, M=xf((0, 0, 0.25)), mat="EMIT", part=900)
    k = 0
    for j in range(rows):
        y = -D / 2 + R + j * dy
        f = j / max(rows - 1, 1)
        off = dx / 2 if j % 2 else 0
        x = -W / 2 + dx / 2 + off
        while x < W / 2 - dx * 0.3:
            ef = end_fade(x, W, 2.5)
            h = H * lerp(front_ratio, 1.0, f ** 0.8) * (1 + 0.14 * fbm(Vector((x, y, 0)) * 0.45, seed))
            h *= rng.uniform(0.82, 1.08)
            if rng.random() < broken:
                h *= rng.uniform(0.35, 0.65)
            h = lerp(H * lerp(front_ratio, 1.0, f ** 0.8) * 0.9, h, ef)
            h = max(h, 1.2)
            n = 5
            prof = [(i * h / n, r * (1.0 + 0.02 * math.sin(i * 1.7 + k))) for i in range(n + 1)]
            mb.column(prof, sides=6, seed=seed + k, jit=0.035, rot0=math.radians(30), top="flat",
                      lean=(rng.uniform(-0.025, 0.025) * ef, rng.uniform(-0.025, 0.025) * ef),
                      top_slope=(rng.uniform(-0.2, 0.2), rng.uniform(-0.2, 0.2)), M=xf((x, y, 0)), part=k + 1)
            k += 1
            x += dx
    o = mb.build("cliff", angle=20)
    paint_cliff(o, "ember", W, H, seed)
    return o


# --------------------------------------------------------------------------- painting
def paint_cliff(o, style, W, H, seed, band_h=1.8):
    P = PAL[style]
    rngb = random.Random(seed + 77)
    if style == "amber":
        sand = ["#F5B971", "#E8935A", "#C4644F", "#F2A7A0", "#E8935A", "#D9764F", "#F5B971", "#B5533F"]
        bcols = [sand[rngb.randrange(len(sand))] for _ in range(40)]
    me = o.data
    mat_names = [m.name for m in me.materials]

    def fn(co, n, pn, mi, pid):
        t = clamp(co.z / H)
        nz = n.z * 0.6 + pn.z * 0.4
        if style == "ember" and mat_names[mi] == "EMIT":
            return sl.hex_rgb("#FF5A1F")
        if style == "glass" and mat_names[mi] == "GLASS":
            g = sl.mix("#BDEBFF", "#C9B6FF", clamp(0.5 + fbm(co * 0.3, seed) * 1.6))
            g = sl.mix(g, "#6CFFC8", smoothstep(0.55, 0.95, t) * 0.35)
            return lit(g, n, 0.1, 0.05)
        c = mix3(P["low"], P["mid"], P["high"], t)
        if style == "ember":
            c = sl.mix(c, "#6B5B82", 0.6)
            jj = ((pid * 53) % 13 - 6) * 0.012
            c = tuple(clamp(x * (1 + jj * 3) + jj, 0, 1) for x in c)
        k = fbm(Vector((co.x * 0.4, co.y * 0.4, co.z * 0.15)), seed) * 0.12
        c = tuple(clamp(x + k, 0, 1) for x in c)
        if style == "amber":
            bi = co.z / band_h
            k0 = int(bi)
            f = bi - k0
            bc = sl.mix(bcols[k0 % 40], bcols[(k0 + 1) % 40], smoothstep(0.85, 1.0, f))
            c = sl.mix(c, bc, 0.9 if abs(nz) < 0.7 else 0.5)
            c = sl.mix(c, "#F5B971", smoothstep(0.6, 0.95, nz) * 0.8)
        elif style == "verdant":
            c = sl.mix(c, P["base"], (1 - smoothstep(0, 0.12, t)) * 0.45)
            vstreak = fbm(Vector((co.x * 1.4, 0, co.z * 0.1)), seed + 5, 2) * 0.12
            c = tuple(clamp(x + vstreak, 0, 1) for x in c)
            gw = smoothstep(0.45, 0.8, nz + 0.25 * fbm(co * 0.8, seed + 1))
            lip = smoothstep(0.93, 0.99, t) * 0.55 * (0.5 + fbm(co * 1.3, seed + 8))
            gcol = sl.mix(P["top"], P["top2"], clamp(0.5 + fbm(co * 0.5, seed) * 1.8))
            c = sl.mix(c, gcol, max(gw, lip) * 0.92)
        elif style == "glass":
            c = sl.mix(c, "#E6F4FF", clamp(t * 0.35))
            c = sl.mix(c, P["accent"], clamp(0.5 + fbm(co * 0.15, seed + 2) * 1.5) * 0.25)
            c = sl.mix(c, "#F7FAFF", smoothstep(0.55, 0.9, nz) * 0.9)
        elif style == "ember":
            c = sl.mix(c, "#FF5A1F", (1 - smoothstep(0.0, 0.07, t)) * 0.55)
            c = sl.mix(c, P["top2"], smoothstep(0.8, 0.98, nz) * 0.7)
            c = sl.mix(c, P["low"], clamp(0.5 - abs(0.5 - fbm(co * 0.8, seed) * 2)) * 0.2)
        if pid >= 100 and pid < 900:
            j = ((pid * 37) % 11 - 5) * 0.012
            c = tuple(clamp(x * (1 + j * 3) + j, 0, 1) for x in c)
        nn = (n * 0.5 + pn * 0.5)
        if nn.length > 1e-6:
            nn.normalize()
        return lit(c, nn, 0.22)

    paint(o, fn)


# --------------------------------------------------------------------------- catalogue
def build_cliffs(rec, only=None):
    items = [
        # id, builder, world, dims-for-extra
        ("verdant_cliff_wall_a", lambda: verdant_cliff(14, 6, 11, 101), "verdant", (14, 6)),
        ("verdant_cliff_wall_b", lambda: verdant_cliff(16, 7, 19, 102, overhang=1.6, striate=0.8), "verdant", (16, 7)),
        ("verdant_cliff_wall_c", lambda: verdant_cliff(12, 6, 6.5, 103, overhang=0.6, striate=0.3, slope=0.3), "verdant", (12, 6)),
        ("amber_cliff_strata_a", lambda: amber_cliff(14, 6, 10, 111), "amber", (14, 6)),
        ("amber_cliff_strata_b", lambda: amber_cliff(16, 7, 18, 112, band_h=2.3, caprock=1.8), "amber", (16, 7)),
        ("amber_cliff_strata_c", lambda: amber_cliff(12, 6, 7, 113, band_h=1.2, gully=1.4), "amber", (12, 6)),
        ("ember_cliff_basalt_a", lambda: basalt_wall(13, 6, 9, 121), "ember", (13, 6)),
        ("ember_cliff_basalt_b", lambda: basalt_wall(15, 6.5, 17, 122, R=1.1, front_ratio=0.62), "ember", (15, 6.5)),
        ("ember_cliff_basalt_c", lambda: basalt_wall(12, 5, 12, 123, R=0.85, broken=0.25), "ember", (12, 5)),
        ("glass_cliff_ice_a", lambda: glass_cliff(14, 6, 10, 131), "glass", (14, 6)),
        ("glass_cliff_ice_b", lambda: glass_cliff(16, 7, 18, 132, plate=2.0), "glass", (16, 7)),
        ("glass_cliff_ice_c", lambda: glass_cliff(12, 6, 7, 133, plate=1.2), "glass", (12, 6)),
    ]
    for id_, fn, world, (w, d) in items:
        if only and not any(o in id_ for o in only):
            continue
        fresh()
        o = fn()
        e = finish([o], id_, "cliff", [world], {"type": "trimesh"}, None, ao=0.5,
                   preview_kw=dict(elev=22, azim=-30, frame=1.0),
                   extra={"family": "cliff", "modular": {"axis": "x", "width": w, "depth": d, "front": "-Y",
                                                         "note": "ends are flush/flat (displacement faded to 0), "
                                                                 "place side by side with 1-2 m overlap; pieces of equal "
                                                                 "height mate seamlessly; back face (+Y) is buried in terrain"}})
        rec.add(e)
