"""Modular cave kit: mouth, straight tunnel, 90deg curve, chamber (4 sockets), dead-end + pedestal niche,
stalactite / stalagmite props, wall crystals.  Palettes: verdant (lavender rock) and hollow (violet + teal glow).

Construction: outer rock solid (swept rings / lathe) minus carve solid (inner ring sweep, flat floor at z=0) via the
Boolean modifier (EXACT).  The carve's faces become the inner faces with normals facing into the free space.
Conventions (Blender space, Z-up): origin on the walkable floor (z=0); the shell extends 0.6 m below it so it can be
buried into terrain.  Standard tunnel section: inner 5.6 m wide x 4.4 m high, outer 10.4 m wide x 6.8 m high (+0.6 skirt).
Sockets are listed in `extra.sockets` in GODOT space (x, z, -y) with outward directions.
"""
import math
import random
import bpy
import bmesh
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
import sl_common as sl
from tf_core import *
from tf_paint import PAL
from tf_crystals import CrystalSet, cluster, COLS

A_IN, H_IN = 2.8, 4.4
A_OUT, H_OUT, Z_SK = 5.2, 6.8, -0.6
HALF = 6.0  # half length of a straight tunnel module (12 m)
UP = Vector((0, 0, 1))


# --------------------------------------------------------------------------- rings / frames
def arch_ring(a, h, z0, n_arc=22, n_floor=6, p=2.6):
    pts = []
    for i in range(n_arc + 1):
        th = math.pi * i / n_arc
        c, s = math.cos(th), math.sin(th)
        x = a * math.copysign(abs(c) ** (2.0 / p), c)
        z = z0 + (h - z0) * (abs(s) ** (2.0 / p))
        pts.append((x, z))
    for i in range(1, n_floor):
        pts.append((-a + 2 * a * i / n_floor, z0))
    return pts


INNER = arch_ring(A_IN, H_IN, 0.0, 22, 6)
OUTER = arch_ring(A_OUT, H_OUT, Z_SK, 22, 6, p=2.4)


def noisy_ring(base, o, t, amp, seed, fade, cz, nscale=0.33, scale=(1.0, 1.0)):
    t = Vector(t).normalized()
    w = UP
    u = w.cross(t)
    out = []
    for (x, y) in base:
        x, y = x * scale[0], y * scale[1]
        dx, dy = x, y - cz
        L = math.hypot(dx, dy) or 1.0
        wp = Vector(o) + u * x + w * y
        n = fbm(wp * nscale, seed, 3)
        d = amp * n * 2.0 * fade * smoothstep(0.1, 1.4, y)
        out.append((x + dx / L * d, y + dy / L * d))
    return out


def straight_frames(y0, y1, step=0.5, x=0.0):
    n = max(2, int(round((y1 - y0) / step)))
    return [(Vector((x, y0 + (y1 - y0) * i / n, 0)), Vector((0, 1, 0))) for i in range(n + 1)]


def arc_frames(R, ext0=0.0, ext1=0.0, step=0.5):
    """Left 90deg turn: enters at (0,-R) heading +Y, leaves at (-R,0) heading -X."""
    C = Vector((-R, -R, 0))
    n = max(8, int(R * math.pi / 2 / step))
    fr = []
    t0 = Vector((0, 1, 0))
    if ext0 > 0:
        fr.append((Vector((0, -R, 0)) - t0 * ext0, t0))
    for i in range(n + 1):
        ph = math.pi / 2 * i / n
        fr.append((C + Vector((R * math.cos(ph), R * math.sin(ph), 0)), Vector((-math.sin(ph), math.cos(ph), 0))))
    if ext1 > 0:
        t1 = Vector((-1, 0, 0))
        fr.append((Vector((-R, 0, 0)) + t1 * ext1, t1))
    return fr


def build_sweep(mb, frames, base_ring, amp, seed, fade_fn, cz, mat, part=1, nscale=0.33, scale_fn=None, caps=(True, True)):
    fr, rings = [], []
    for (o, t) in frames:
        f = fade_fn(o, t)
        sc = scale_fn(o, t) if scale_fn else (1.0, 1.0)
        rings.append(noisy_ring(base_ring, o, t, amp, seed, f, cz, nscale, sc))
        fr.append((o, t, UP))
    mb.sweep(fr, rings, cap0=caps[0], cap1=caps[1], mat=mat, part=part)


def fade_ends_y(half, span=1.8):
    return lambda o, t: smoothstep(half, half - span, abs(o.y))


def fade_dist(d_end, span=1.8, axis="x"):
    return lambda o, t: smoothstep(d_end, d_end - span, abs(o.x if axis == "x" else o.y))


# --------------------------------------------------------------------------- boolean helpers
def to_obj(mb, name, smooth=True):
    mb.triangulate()
    return mb.build(name, smooth=smooth)


def bool_op(target, cutter, op="DIFFERENCE"):
    mod = target.modifiers.new("bool", "BOOLEAN")
    mod.operation = op
    mod.object = cutter
    mod.solver = "EXACT"
    mod.use_self = True
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.select_all(action="DESELECT")
    target.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def carve_pair():
    """Two MBs: outer (material slot 0) and carve (slot 1)."""
    return MB(("VC_ROUGH", "VC_ROUGH")), MB(("VC_ROUGH", "VC_ROUGH"))


def dome_profile(Rh, Hh, z0, n=11, p=2.4, skirt=None):
    prof = []
    if skirt is not None:
        prof.append((skirt, Rh))
    prof.append((z0, Rh))
    for i in range(1, n + 1):
        ph = (math.pi / 2) * (i / (n + 0.6))
        prof.append((z0 + Hh * math.sin(ph) ** (2 / p), Rh * math.cos(ph) ** (2 / p)))
    return prof


# --------------------------------------------------------------------------- piece builders (return cave object + meta)
def outer_rubble(om, seed, y0, y1, n=6, sc=1.0):
    rng = random.Random(seed + 9)
    for i in range(n):
        side = rng.choice((-1, 1))
        y = rng.uniform(y0, y1)
        k = rng.uniform(0.9, 1.7) * sc
        low = rng.random() < 0.55
        x = side * (A_OUT - 0.2 + rng.uniform(-0.3, 0.6)) if low else rng.uniform(-3.0, 3.0)
        z = rng.uniform(0.3, 1.8) if low else H_OUT - 0.6 + rng.uniform(-0.2, 0.5)
        om.rock(size=(k * 1.2, k * 1.1, k * 0.85), seed=seed + 30 + i, subdiv=3, noise_amp=0.14, planes=6, soft=0.08,
                plane_off=(0.62, 0.9), flat_bottom=0.5 if low else None, M=xf((x, y, z), (0, 0, rng.uniform(0, 360))),
                mat=0, part=50 + i)


def piece_tunnel(seed):
    om, cm = carve_pair()
    outer_rubble(om, seed, -3.6, 3.6, 7)
    build_sweep(om, straight_frames(-HALF, HALF), OUTER, 1.4, seed, fade_ends_y(HALF), 2.5, 0, nscale=0.22)
    build_sweep(cm, straight_frames(-HALF - 1, HALF + 1), INNER, 0.42, seed + 1, fade_ends_y(HALF), 1.8, 1, nscale=0.35)
    outer = to_obj(om, "outer")
    carve = to_obj(cm, "carve")
    bool_op(outer, carve)
    socks = [("S_back", (0, -HALF, 0), (0, -1, 0)), ("S_front", (0, HALF, 0), (0, 1, 0))]
    return outer, socks, {"length": 2 * HALF}


def outer_rubble_c(om, seed, R):
    rng = random.Random(seed + 4)
    for i in range(6):
        a = rng.uniform(0.3, math.pi / 2 - 0.3)
        rad = R + rng.choice((-1, 1)) * rng.uniform(A_OUT - 0.4, A_OUT + 0.5)
        k = rng.uniform(0.9, 1.7)
        om.rock(size=(k * 1.2, k * 1.1, k * 0.85), seed=seed + 60 + i, subdiv=3, noise_amp=0.14, planes=6, soft=0.08,
                plane_off=(0.62, 0.9), flat_bottom=0.5, M=xf((-R + rad * math.cos(a), -R + rad * math.sin(a), rng.uniform(0.3, 1.6)),
                                                              (0, 0, rng.uniform(0, 360))), mat=0, part=70 + i)


def piece_curve(seed, R=7.5):
    om, cm = carve_pair()
    L = math.pi / 2 * R

    def fade(o, t):
        # arc-length distance from the ends
        a = math.atan2(o.y + R, o.x + R)
        s = clamp(a / (math.pi / 2)) * L
        return smoothstep(0.0, 1.8, min(s, L - s)) if (o.y >= -R + 1e-3 and o.x <= -1e-3 + 0.0) else 0.0

    # fade: 0 at both ends. frames outside the arc get 0
    def fade2(o, t):
        if o.y < -R + 1e-3 or o.x > -1e-3:
            return 0.0
        return fade(o, t)

    outer_rubble_c(om, seed, R)
    build_sweep(om, arc_frames(R), OUTER, 1.4, seed, fade2, 2.5, 0, nscale=0.22)
    build_sweep(cm, arc_frames(R, 1.0, 1.0), INNER, 0.42, seed + 1, fade2, 1.8, 1, nscale=0.35)
    outer = to_obj(om, "outer")
    carve = to_obj(cm, "carve")
    bool_op(outer, carve)
    socks = [("S_a", (0, -R, 0), (0, -1, 0)), ("S_b", (-R, 0, 0), (-1, 0, 0))]
    return outer, socks, {"turn": "left 90 deg (mirror with scale.x=-1 in Blender / scale.x=-1 in Godot for a right turn)",
                          "radius": R}


def piece_mouth(seed):
    om, cm = carve_pair()
    # standard tunnel stub (flush end at y=+6) merged with a big rocky hillside blob
    outer_rubble(om, seed, 0.5, 3.6, 3)
    rngm = random.Random(seed + 2)
    for i, (sx, yy) in enumerate(((-1, -8.6), (1, -9.0), (-1, -5.6), (1, -6.0))):
        k = rngm.uniform(1.4, 2.1)
        om.rock(size=(k * 1.2, k * 1.1, k * 0.95), seed=seed + 80 + i, subdiv=3, noise_amp=0.14, planes=6, soft=0.08,
                plane_off=(0.62, 0.9), flat_bottom=0.45,
                M=xf((sx * rngm.uniform(4.6, 5.6), yy, rngm.uniform(0.2, 1.2)), (0, 0, rngm.uniform(0, 360))), mat=0, part=90 + i)
    build_sweep(om, straight_frames(0.0, HALF), OUTER, 1.4, seed, lambda o, t: smoothstep(HALF, HALF - 1.8, o.y), 2.5, 0,
                nscale=0.22)
    om.rock(size=(9.8, 7.2, 8.4), seed=seed + 5, subdiv=4, noise_amp=0.14, noise_scale=0.8, planes=6, soft=0.35,
            plane_off=(0.75, 0.95), flat_bottom=0.072, M=xf((0, -3.6, 0)), mat=0, part=2)
    # opening flares slightly toward the front
    flare = lambda o, t: (1.0 + 0.2 * smoothstep(-4.0, -10.5, o.y), 1.0 + 0.12 * smoothstep(-4.0, -10.5, o.y))
    fade = lambda o, t: smoothstep(HALF, HALF - 1.8, o.y) * 1.0
    build_sweep(cm, straight_frames(-12.0, HALF + 1), INNER, 0.5, seed + 1, fade, 1.8, 1, nscale=0.3, scale_fn=flare)
    outer = to_obj(om, "outer")
    carve = to_obj(cm, "carve")
    bool_op(outer, carve)
    socks = [("S_in", (0, HALF, 0), (0, 1, 0))]
    return outer, socks, {"entrance_clear_width": 5.6, "front": "-Y"}


def piece_dead_end(seed):
    om, cm = carve_pair()
    n_end = 9

    def shrink_frames(y_a, length, n):
        out = []
        for i in range(n + 1):
            tau = 0.96 * i / n
            out.append((Vector((0, y_a + length * tau, 0)), Vector((0, 1, 0)), math.sqrt(1 - tau * tau)))
        return out

    def add(mb, y_start, y_cs, length, base, amp, mat, cz, nscale, fade_start):
        fr = straight_frames(y_start, y_cs)
        sf = shrink_frames(y_cs, length, n_end)
        allf = [(o, t, 1.0) for (o, t) in fr] + sf[1:]
        frames, rings = [], []
        for (o, t, s) in allf:
            f = smoothstep(fade_start, fade_start + 1.8, o.y) if False else (smoothstep(y_start + 0.0, y_start + 1.8, o.y) if y_start < -HALF + 0.5 else 1.0)
            f = min(1.0, smoothstep(-HALF, -HALF + 1.8, o.y)) if y_start <= -HALF else 1.0
            rings.append(noisy_ring(base, o, t, amp, seed, f, cz, nscale, (s, s)))
            frames.append((o, t, UP))
        mb.sweep(frames, rings, cap0=True, cap1=True, mat=mat, part=1)

    outer_rubble(om, seed, -3.6, 2.0, 5)
    add(om, -HALF, 3.0, 6.0, OUTER, 1.4, 0, 2.5, 0.22, -HALF)
    add(cm, -HALF - 1, 3.0, 3.2, INNER, 0.4, 1, 1.8, 0.35, -HALF)
    # niche carved into the end wall
    niche = arch_ring(0.95, 2.5, 0.0, 14, 4)
    fr = [(Vector((0, y, 0)), Vector((0, 1, 0)), UP) for y in (4.4, 5.2, 6.0, 6.8, 7.6)]
    cm.sweep(fr, [niche] * 5, cap0=True, cap1=True, mat=1, part=2)
    outer = to_obj(om, "outer")
    carve = to_obj(cm, "carve")
    bool_op(outer, carve)
    socks = [("S_open", (0, -HALF, 0), (0, -1, 0))]
    return outer, socks, {"pedestal": [0.0, 3.2, 0.0], "niche": [0.0, 5.6, 1.2]}


def piece_chamber(seed):
    om, cm = carve_pair()
    # outer: dome + 4 tunnel stubs (flush at 13 m)
    om.column(dome_profile(13.0, 10.6, 0.0, 12, 2.4, skirt=Z_SK), sides=34, seed=seed, jit=0.0, top="flat", ring_noise=0.1,
              rn_scale=0.2, mat=0, part=1)
    cm.column(dome_profile(10.0, 7.6, 0.0, 12, 2.4), sides=34, seed=seed + 1, jit=0.0, top="flat", ring_noise=0.07,
              rn_scale=0.28, mat=1, part=1)
    outer = to_obj(om, "outer")
    carve = to_obj(cm, "carve")
    # stubs
    so, sc = carve_pair()
    for k in range(4):
        ang = k * math.pi / 2
        c, s = math.cos(ang), math.sin(ang)
        d = Vector((c, s, 0))
        # sweep along d from 8 to 13 (outer) / 7 to 14.2 (carve); rotate frames about Z
        def frames(a, b):
            n = max(2, int((b - a) / 0.5))
            return [(d * (a + (b - a) * i / n), d) for i in range(n + 1)]

        fade = lambda o, t, d=d: smoothstep(13.0, 11.2, o.dot(d))
        build_sweep(so, frames(8.0, 13.0), OUTER, 1.4, seed + 10 + k, fade, 2.5, 0, part=2 + k, nscale=0.22)
        build_sweep(sc, frames(7.0, 14.2), INNER, 0.42, seed + 20 + k, fade, 1.8, 1, part=2 + k, nscale=0.35)
    stubs_o = to_obj(so, "stubs_o")
    stubs_c = to_obj(sc, "stubs_c")
    bool_op(outer, stubs_o, "UNION")
    bool_op(outer, carve)
    bool_op(outer, stubs_c)
    socks = [("S_E", (13, 0, 0), (1, 0, 0)), ("S_N", (0, 13, 0), (0, 1, 0)), ("S_W", (-13, 0, 0), (-1, 0, 0)),
             ("S_S", (0, -13, 0), (0, -1, 0))]
    return outer, socks, {"inner_diameter": 20.0}


# --------------------------------------------------------------------------- verification
def check_inward(obj, samples=400, seed=1):
    """Fraction of inner faces whose normal points into free space. Uses the *current* winding."""
    me = obj.data
    verts = [v.co.copy() for v in me.vertices]
    polys = [tuple(p.vertices) for p in me.polygons]
    tree = BVHTree.FromPolygons(verts, polys)
    rng = random.Random(seed)
    inner = [p for p in me.polygons if p.material_index == 1]
    if not inner:
        return None, 0
    ok = tot = 0
    for p in rng.sample(inner, min(samples, len(inner))):
        n = p.normal
        if n.length < 0.5:
            continue
        o = p.center + n * 0.05
        hit = tree.ray_cast(o, n)
        if hit[0] is None:
            continue
        tot += 1
        if hit[1].dot(n) < 0:  # hit face points back at us => we started in free space
            ok += 1
    return (ok / tot if tot else None), tot


# --------------------------------------------------------------------------- painting
def paint_cave(o, world, seed):
    inner_idx = 1
    P = PAL[world]

    def fn(co, n, pn, mi, pid):
        nz = n.z * 0.6 + pn.z * 0.4
        inner = (mi == inner_idx)
        nn = (n * 0.5 + pn * 0.5)
        if nn.length > 1e-6:
            nn.normalize()
        k = fbm(co * 0.5, seed) * 0.1
        if not inner:
            t = clamp(co.z / 8.0)
            c = mix3(P["low"], P["mid"], P["high"], t)
            c = tuple(clamp(x + k, 0, 1) for x in c)
            c = sl.mix(c, P["base"], (1 - smoothstep(0, 0.1, t)) * 0.35)
            w = smoothstep(0.5, 0.8, nz + 0.25 * fbm(co * 0.7, seed + 3))
            gc = sl.mix(P["top"], P["top2"], clamp(0.5 + fbm(co * 0.4, seed) * 1.8))
            c = sl.mix(c, gc, w * 0.9)
            return lit(c, nn, 0.22)
        # ---- inner surfaces
        if world == "verdant":
            if nz > 0.55:  # floor: moss over soil
                c = sl.mix("#72B565", "#9C6A52", clamp(0.35 + fbm(co * 0.8, seed + 2) * 1.8))
                c = sl.mix(c, "#B6E277", clamp(fbm(co * 1.6, seed + 6) * 1.5) * 0.5)
            elif nz < -0.35:  # ceiling
                c = sl.mix("#7A76B8", "#9A97D4", clamp(0.5 + k * 3))
            else:  # walls
                c = sl.mix("#9C99D4", "#C2C7EC", clamp(co.z / 4.4 + k * 2))
                c = sl.mix(c, "#5F9C55", (1 - smoothstep(0.0, 0.9, co.z)) * 0.5)
                st = fbm(Vector((co.x * 1.2, co.y * 1.2, co.z * 0.2)), seed + 4, 2)
                c = tuple(clamp(x + st * 0.08, 0, 1) for x in c)
            return lit(c, nn, 0.2, 0.06)
        else:  # hollow
            if nz > 0.55:
                c = sl.mix("#3A2268", "#5A3A92", clamp(0.5 + k * 3))
                g = fbm(co * 0.45, seed + 8, 2)
                c = sl.mix(c, "#3DFFD8", smoothstep(0.12, 0.3, g) * 0.35)
            elif nz < -0.35:
                c = sl.mix("#2C1850", "#4A2A80", clamp(0.5 + k * 3))
            else:
                c = sl.mix("#5A3A98", "#8660C8", clamp(co.z / 4.4 + k * 2))
                v = abs(fbm(co * 0.55, seed + 5, 2))
                c = sl.mix(c, "#3DFFD8", smoothstep(0.07, 0.015, v) * 0.7)
                c = sl.mix(c, "#FF8AD8", smoothstep(0.30, 0.34, fbm(co * 0.9, seed + 9, 2)) * 0.25)
            return lit(c, nn, 0.12, 0.05, shadow="#24113F")

    paint(o, fn)


def finish_cave_mesh(o):
    """After painting: single material slot; flat sharp edges where angle > 45."""
    for p in o.data.polygons:
        p.material_index = 0
    while len(o.data.materials) > 1:
        o.data.materials.pop(index=1)
    sl.shade_smooth(o, 50)


# --------------------------------------------------------------------------- props on the cave (stalactites, crystals)
def rock_tree(obj):
    me = obj.data
    return BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [tuple(p.vertices) for p in me.polygons])


def add_stalactites(mb, tree, region, n, seed, grow="down", lmin=0.5, lmax=2.0, rmin=0.14, rmax=0.42, start_part=20,
                    keep_clear=0.0):
    """region = fn(rng)->(x,y) candidate xy. Casts rays to find the ceiling (down) or floor (up)."""
    rng = random.Random(seed)
    placed = 0
    tries = 0
    pid = start_part
    while placed < n and tries < n * 30:
        tries += 1
        x, y = region(rng)
        if grow == "down":
            hit = tree.ray_cast(Vector((x, y, 0.4)), Vector((0, 0, 1)))
            if hit[0] is None or hit[1].z > -0.25 or hit[0].z < 2.0:
                continue
            zc = hit[0].z
            L = rng.uniform(lmin, lmax) * (0.6 + 0.4 * clamp(zc / 5.0))
            r = rng.uniform(rmin, rmax)
            base = Vector((x, y, zc + 0.25))
            prof = [(0.0, r * 0.95), (L * 0.3 + 0.25, r), (L * 0.75 + 0.25, r * 0.5), (L + 0.25, r * 0.07)]
            mb.column(prof, sides=7, seed=seed + placed, jit=0.12, top="flat", bottom=True, ring_noise=0.08, rn_scale=1.0,
                      M=xf(base, (180, 0, 0)), part=pid)
        else:
            hit = tree.ray_cast(Vector((x, y, 3.0)), Vector((0, 0, -1)))
            if hit[0] is None or abs(hit[0].z) > 0.25:
                continue
            L = rng.uniform(lmin, lmax)
            r = rng.uniform(rmin, rmax) * 1.15
            base = Vector((x, y, hit[0].z - 0.15))
            prof = [(0.0, r * 1.25), (L * 0.3, r), (L * 0.75, r * 0.55), (L + 0.15, r * 0.08)]
            mb.column(prof, sides=7, seed=seed + placed, jit=0.12, top="flat", bottom=True, ring_noise=0.08, rn_scale=1.0,
                      M=xf(base), part=pid)
        placed += 1
        pid += 1
    return placed


def add_wall_crystals(cs, tree, n, seed, size, zrange=(1.0, 3.2), reach=6.0, center=Vector((0, 0, 0)), cone=None, ycap=None):
    """Crystal sprays growing out of the walls; returns light positions (blender space)."""
    rng = random.Random(seed)
    lights = []
    tries = 0
    while len(lights) < n and tries < n * 40:
        tries += 1
        a = rng.uniform(0, 2 * math.pi)
        d = Vector((math.cos(a), math.sin(a), rng.uniform(-0.1, 0.8))).normalized()
        o = center + Vector((rng.uniform(-1.0, 1.0) * 0.0, 0, rng.uniform(*zrange)))
        if ycap is not None:
            o.y = rng.uniform(*ycap)
        hit = tree.ray_cast(o, d, reach)
        if hit[0] is None:
            continue
        nrm = hit[1]
        if nrm.dot(d) > 0:
            continue
        pos = hit[0] + nrm * 0.05
        # keep away from the floor line
        if pos.z < 0.7:
            continue
        sub = max(3, int(rng.uniform(3, 6)))
        cluster(cs, sub, size * rng.uniform(0.7, 1.2), size * 0.3, seed * 7 + len(lights), lean_max=45, thick=0.2,
                shell="GLASS", core_ratio=0.5, origin=pos, axis=tuple(nrm))
        from tf_crystals import basis_matrix
        k = size * 0.55
        cs.mb.rock(size=(k, k * 0.9, k * 0.45), seed=seed + len(lights), subdiv=3, noise_amp=0.15, planes=4, soft=0.1,
                   flat_bottom=None, M=basis_matrix(pos - nrm * 0.1, nrm, rng.uniform(0, 6)), part=40 + len(lights))
        lights.append(pos + nrm * 0.8)
    return lights


def cave_props_paint(o, cs, cols, world):
    names = [m.name for m in o.data.materials]
    me = o.data
    attr = sl.ensure_colors(o)
    part = me.attributes["part"]
    verts = me.vertices
    P = PAL[world]
    for poly in me.polygons:
        nm = names[poly.material_index]
        pid = part.data[poly.index].value
        if nm not in ("GLASS", "EMIT") and not (20 <= pid < 400):
            continue
        for li in poly.loop_indices:
            v = verts[me.loops[li].vertex_index]
            if nm == "VC_ROUGH":
                t = clamp(abs(v.co.z) / 2.5)
                c = sl.mix(P["mid"], P["high"], t) if world == "verdant" else sl.mix("#4B2A7B", "#8A5FC8", t)
                c = lit(c, v.normal, 0.15)
            else:
                info = cs.info.get(pid)
                if info:
                    org, d, L = info
                    t = clamp(((v.co - org).dot(d)) / max(L, 1e-3))
                else:
                    t = 0.5
                if nm == "GLASS":
                    c = lit(tuple(clamp(x * 1.1 + 0.03) for x in sl.mix(cols["shell_lo"], cols["shell_hi"], t)), v.normal, 0.03, 0.1)
                else:
                    c = sl.mix(cols["core_lo"], cols["core_hi"], t)
            sl._write_corner(attr, li, c)


def socket_entries(socks):
    out = []
    for name, p, d in socks:
        out.append({"name": name, "pos": [round(p[0], 3), round(p[2], 3), round(-p[1], 3)],
                    "dir": [round(d[0], 3), round(d[2], 3), round(-d[1], 3)], "up": [0, 1, 0],
                    "opening": {"width": 5.6, "height": 4.4}, "type": "tunnel_a"})
    return out


# --------------------------------------------------------------------------- catalogue
INSIDE_CAMS = {
    "tunnel": dict(cam=((0, -5.6, 1.7), (0, 4, 2.0)), lens=22),
    "curve": dict(cam=((0.4, -7.0, 1.7), (-4.5, -2.0, 2.0)), lens=22),
    "mouth": dict(cam=((0, 4.6, 1.7), (0, -9, 2.2)), lens=22),
    "chamber": dict(cam=((8.3, -2.0, 1.6), (-4, 3, 3.6)), lens=20),
    "dead_end": dict(cam=((0, -5.6, 1.7), (0, 5, 1.8)), lens=22),
}


def build_cave_piece(world, kind, rec, seed):
    fresh()
    cols = COLS["hollow" if world == "hollow" else "verdant"]
    maker = {"tunnel": piece_tunnel, "curve": piece_curve, "mouth": piece_mouth, "dead_end": piece_dead_end,
             "chamber": piece_chamber}[kind]
    o, socks, meta = maker(seed)
    ok_frac, nsamp = check_inward(o)
    inner_faces = sum(1 for p in o.data.polygons if p.material_index == 1)
    print("   normals inward: %s (%d samples), inner faces %d / %d" % (ok_frac, nsamp, inner_faces, len(o.data.polygons)))
    paint_cave(o, world, seed)
    finish_cave_mesh(o)
    # ---- props: stalactites / stalagmites / wall crystals (separate MB, painted separately, then joined)
    tree = rock_tree(o)
    mb = MB(("VC_ROUGH", "EMIT", "GLASS"))
    cs = CrystalSet(mb)
    lights = []
    if kind == "tunnel":
        add_stalactites(mb, tree, lambda r: (r.uniform(-1.9, 1.9), r.uniform(-5, 5)), 4, seed, lmax=1.5)
        add_stalactites(mb, tree, lambda r: (r.choice((-1, 1)) * r.uniform(1.6, 2.3), r.uniform(-5, 5)), 3, seed + 1,
                        grow="up", lmin=0.4, lmax=1.3, start_part=60)
        lights = add_wall_crystals(cs, tree, 3, seed, 0.9, ycap=(-4.5, 4.5))
    elif kind == "curve":
        c = Vector((-7.5, -7.5, 0))
        def reg(r):
            a = r.uniform(0, math.pi / 2)
            rad = 7.5 + r.uniform(-1.8, 1.8)
            return (c.x + rad * math.cos(a), c.y + rad * math.sin(a))
        add_stalactites(mb, tree, reg, 6, seed)
        add_stalactites(mb, tree, lambda r: reg(r), 3, seed + 1, grow="up", lmin=0.4, lmax=1.1, start_part=60)
    elif kind == "mouth":
        add_stalactites(mb, tree, lambda r: (r.uniform(-1.9, 1.9), r.uniform(-9, 5)), 6, seed, lmax=1.7)
        # hanging roots over the entrance (verdant) are cheap tubes
    elif kind == "dead_end":
        add_stalactites(mb, tree, lambda r: (r.uniform(-1.9, 1.9), r.uniform(-5, 4.5)), 6, seed)
        add_stalactites(mb, tree, lambda r: (r.choice((-1, 1)) * r.uniform(1.4, 2.3), r.uniform(-4, 3)), 3, seed + 1,
                        grow="up", lmin=0.4, lmax=1.2, start_part=60)
        # pedestal + gem
        mb.column([(0, 1.0), (0.12, 1.06), (0.82, 0.88), (0.95, 0.96)], sides=9, seed=seed, jit=0.04, top="flat",
                  M=xf((0, 3.3, 0)), part=300)
        cs.add((0, 3.3, 0.95), (0, 0, 1), 0.9, 0.18, seed + 3, shell="GLASS", core_ratio=0.55, base_part=1100)
        cluster(cs, 4, 0.5, 0.22, seed + 7, lean_max=40, thick=0.2, origin=(0, 3.3, 0.95))
        lights.append(Vector((0, 3.3, 1.9)))
        lights += add_wall_crystals(cs, tree, 2, seed, 0.8, ycap=(-4, 1.0))
    elif kind == "chamber":
        add_stalactites(mb, tree, lambda r: (r.uniform(-7.5, 7.5), r.uniform(-7.5, 7.5)), 13, seed, lmin=0.8, lmax=3.0,
                        rmin=0.2, rmax=0.7)
        add_stalactites(mb, tree, lambda r: (r.uniform(-8.5, 8.5), r.uniform(-8.5, 8.5)), 6, seed + 1, grow="up", lmin=0.6,
                        lmax=2.0, rmin=0.2, rmax=0.6, start_part=100)
        lights = add_wall_crystals(cs, tree, 5, seed, 1.4, center=Vector((0, 0, 0)), zrange=(1.5, 4.0), reach=11)
    # recolor / paint props
    if mb.bm.faces:
        mb.triangulate()
        po = mb.build("props", angle=40)
        for p in po.data.polygons:
            if po.data.materials[p.material_index].name in ("GLASS", "EMIT"):
                p.use_smooth = False
        sl.ensure_colors(po)
        cave_props_paint(po, cs, cols, world)
        # props not tagged EMIT/GLASS also need a default color if not covered
        o = sl.join([o, po], "cave")
    asset = "%s_cave_%s" % (world, kind)
    lo, hi = bbox([o])
    # light list in godot space
    L = [[round(l.x, 2), round(l.z, 2), round(-l.y, 2)] for l in lights]
    extra = {"family": "cave", "kit": True, "sockets": socket_entries(socks), "sockets_frame": "godot_y_up (x, z, -y of Blender)",
             "origin": "floor level (z=0 walkable floor); shell extends 0.6 m below for burying",
             "lights": L, "normals_inward_ratio": ok_frac}
    extra.update(meta)
    cam = INSIDE_CAMS[kind]
    e = finish([o], asset, "cave", [world], {"type": "trimesh"}, None, ao=0.35, ao_dist=2.0, origin="none",
                 preview_kw=dict(elev=24, azim=-35, frame=0.95), ao_samples=8,
                 extra_previews={"_inside": dict(cam=cam["cam"], lens=cam["lens"], cull=True)}, extra=extra)
    rec.add(e)


def build_prop(world, kind, variant, seed, rec):
    """Stalactite (hangs from ceiling, origin at attach point), stalagmite, wall crystal spray."""
    fresh()
    cols = COLS["hollow" if world == "hollow" else "verdant"]
    mb = MB(("VC_ROUGH", "EMIT", "GLASS"))
    cs = CrystalSet(mb)
    rng = random.Random(seed)
    if kind == "stalactite":
        n = 3 if variant == "a" else 5
        mb.rock(size=(0.9, 0.8, 0.35), seed=seed, subdiv=3, noise_amp=0.15, planes=2, soft=0.3, flat_bottom=None,
                M=xf((0, 0, 0.1)), part=20)
        for i in range(n):
            a = rng.uniform(0, 6.28)
            d = 0.0 if i == 0 else rng.uniform(0.3, 0.8)
            L = (2.2 if i == 0 else rng.uniform(0.7, 1.7)) * (1.0 if variant == "a" else 1.4)
            r = (0.42 if i == 0 else rng.uniform(0.18, 0.3)) * (1 if variant == "a" else 0.85)
            prof = [(0.0, r * 1.3), (L * 0.25, r), (L * 0.7, r * 0.5), (L, r * 0.06)]
            mb.column(prof, sides=8, seed=seed + i, jit=0.12, top="flat", ring_noise=0.1, rn_scale=1.0,
                      M=xf((math.cos(a) * d, math.sin(a) * d, 0.1), (180, 0, 0)), part=21 + i)
    elif kind == "stalagmite":
        n = 3 if variant == "a" else 6
        mb.rock(size=(0.8, 0.7, 0.3), seed=seed, subdiv=3, noise_amp=0.15, planes=2, soft=0.3, flat_bottom=0.5,
                M=xf((0, 0, 0.0)), part=20)
        for i in range(n):
            a = rng.uniform(0, 6.28)
            d = 0.0 if i == 0 else rng.uniform(0.3, 0.9)
            L = (2.0 if i == 0 else rng.uniform(0.5, 1.4)) * (1.0 if variant == "a" else 0.7)
            r = (0.4 if i == 0 else rng.uniform(0.15, 0.3))
            prof = [(-0.1, r * 1.4), (L * 0.3, r), (L * 0.75, r * 0.5), (L, r * 0.06)]
            mb.column(prof, sides=8, seed=seed + i, jit=0.12, top="flat", ring_noise=0.1, rn_scale=1.0,
                      M=xf((math.cos(a) * d, math.sin(a) * d, 0.0)), part=21 + i)
    else:  # wall crystal spray: crystals grow along +Y from a wall boss (origin on the wall surface)
        mb.rock(size=(1.0, 0.45, 0.9), seed=seed, subdiv=3, noise_amp=0.15, planes=4, soft=0.2, flat_bottom=None,
                M=xf((0, 0.0, 0.9)), part=20)
        cluster(cs, 7, 1.5 if variant == "a" else 1.1, 0.5, seed, lean_max=48, thick=0.2, origin=(0, 0.1, 0.9),
                axis=(0, 1, 0))
    o = mb.build("prop", angle=40)
    for p in o.data.polygons:
        if o.data.materials[p.material_index].name in ("GLASS", "EMIT"):
            p.use_smooth = False
    sl.ensure_colors(o)
    # paint rock
    from tf_paint import paint_rock
    P = PAL[world]
    paint_rock(o, P, seed, top_thr=2.0, top_str=0.0, dirt=0.0, zr=(-2.2, 0.5) if kind == "stalactite" else None,
               part_jit=0.04)
    if kind == "stalagmite" or kind == "stalactite":
        pass
    if kind == "crystalwall":
        cave_props_paint(o, cs, cols, world)
    id_ = "%s_cave_%s_%s" % (world, kind if kind != "crystalwall" else "crystal_wall", variant)
    if kind == "stalactite":
        origin = "none"
    elif kind == "crystalwall":
        origin = "none"
    else:
        origin = "base"
    collision = {"type": "none"} if kind == "stalactite" else {"type": "convex"}
    sc = scatter(0.8, 90, 4.0, 0.6, "cave") if kind != "crystalwall" else scatter(0.4, 90, 6.0, 0.5, "cave")
    e = finish([o], id_, "cave_prop", [world], collision, sc, ao=0.4, ao_dist=0.6, origin=origin,
               preview_kw=dict(elev=10 if kind == "stalactite" else 16, azim=150 if kind == "crystalwall" else -30, frame=1.1),
               extra={"family": "cave", "prop": kind,
                      "origin": "ceiling attach point (hangs down)" if kind == "stalactite" else (
                          "wall surface contact; crystals grow along local +Y" if kind == "crystalwall" else "base-center")})
    rec.add(e)


def build_caves(rec, only=None):
    def want(i):
        return not only or any(o in i for o in only)

    seeds = {"verdant": 400, "hollow": 500}
    for world in ("verdant", "hollow"):
        for kind in ("tunnel", "curve", "mouth", "dead_end", "chamber"):
            id_ = "%s_cave_%s" % (world, kind)
            if want(id_):
                print("== ", id_)
                build_cave_piece(world, kind, rec, seeds[world] + len(kind))
        for kind in ("stalactite", "stalagmite"):
            for var in ("a", "b"):
                id_ = "%s_cave_%s_%s" % (world, kind, var)
                if want(id_):
                    build_prop(world, kind, var, seeds[world] + 40 + ord(var), rec)
        id_ = "%s_cave_crystal_wall_a" % world
        if want(id_):
            build_prop(world, "crystalwall", "a", seeds[world] + 77, rec)
