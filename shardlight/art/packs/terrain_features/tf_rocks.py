"""Boulders & rocks: river stone, faceted chunk, menhir, pebble cairn, flat slab x worlds."""
import math
import random
from mathutils import Vector, Matrix
import sl_common as sl
from tf_core import *
from tf_paint import PAL, paint_rock


def taper_profile(H, r, n=12, flare=1.25, tip=0.5, bulge=0.0):
    out = []
    for i in range(n + 1):
        t = i / n
        rr = r * (flare - (flare - 1.0) * smoothstep(0, 0.2, t))
        rr *= lerp(1.0, tip, t ** 1.15)
        rr *= 1.0 + bulge * math.sin(t * math.pi)
        out.append((H * t, rr))
    return out


# --------------------------------------------------------------------------- families (return object)
def river_stone(size, seed, pal, name="rock", trio=False):
    mb = MB()
    mb.rock(size=size, seed=seed, subdiv=4, noise_amp=0.07, noise_scale=1.1, planes=2, plane_off=(0.85, 1.0),
            soft=0.5, flat_bottom=0.6, squarish=0.25, part=1)
    if trio:
        rng = random.Random(seed)
        for i, (k, ang) in enumerate(((0.55, 0.9), (0.38, -1.7))):
            s2 = tuple(x * k for x in size)
            ox, oy = math.cos(ang) * size[0] * 1.15, math.sin(ang) * size[1] * 1.15
            mb.rock(size=s2, seed=seed + 5 + i, subdiv=2, noise_amp=0.08, planes=1, soft=0.5, flat_bottom=0.6,
                    squarish=0.25, M=xf((ox, oy, -size[2] * 0.15 * (i + 1)), (0, 0, rng.uniform(0, 90))), part=2 + i)
    o = mb.build(name, angle=50)
    paint_rock(o, pal, seed, top_thr=0.55, top_str=0.8, part_jit=0.05, noise=0.04)
    return o


def faceted_chunk(size, seed, pal, name="rock", vein=None):
    mb = MB()
    mb.rock(size=size, seed=seed, subdiv=4, noise_amp=0.10, noise_scale=1.4, planes=8, plane_off=(0.62, 0.9),
            soft=0.07, flat_bottom=0.55, squarish=0.1, part=1)
    # a couple of little satellite chunks
    rng = random.Random(seed + 1)
    for i in range(2):
        a = rng.uniform(0, 6.28)
        k = rng.uniform(0.25, 0.4)
        mb.rock(size=tuple(x * k for x in size), seed=seed + 9 + i, subdiv=2, noise_amp=0.1, planes=5,
                plane_off=(0.6, 0.85), soft=0.06, flat_bottom=0.5,
                M=xf((math.cos(a) * size[0] * 1.0, math.sin(a) * size[1] * 1.0, -size[2] * 0.2), (0, 0, rng.uniform(0, 360))),
                part=2 + i)
    o = mb.build(name, angle=28)
    paint_rock(o, pal, seed, top_thr=0.5, top_str=0.85, part_jit=0.06, vein=vein)
    return o


def menhir(H, r, seed, pal, name="rock", sides=8, lean=(0.04, 0.02), stripes=None, vein=None, strata=None,
           tip=0.55):
    mb = MB()
    prof = taper_profile(H, r, 14, flare=1.22, tip=tip, bulge=0.04)
    mb.column(prof, sides=sides, seed=seed, jit=0.12, top="flat", lean=lean, ring_noise=0.14, rn_scale=0.7,
              top_slope=(0.25, 0.12), part=1)
    # base mound so it sits in the ground
    mb.rock(size=(r * 1.9, r * 1.7, r * 0.55), seed=seed + 3, subdiv=2, noise_amp=0.12, planes=3, soft=0.2,
            flat_bottom=0.4, M=xf((0, 0, r * 0.1)), part=2)
    # rock chips around
    rng = random.Random(seed)
    for i in range(3):
        a = rng.uniform(0, 6.28)
        d = rng.uniform(1.6, 2.4) * r
        k = rng.uniform(0.25, 0.4) * r
        mb.rock(size=(k * 1.3, k, k * 0.7), seed=seed + 20 + i, subdiv=2, noise_amp=0.1, planes=4, soft=0.08,
                flat_bottom=0.4, M=xf((math.cos(a) * d, math.sin(a) * d, 0), (0, 0, rng.uniform(0, 360))),
                part=3 + i)
    if stripes:
        # glowing rune bands (EMIT) hugging the shaft
        for i, zf in enumerate(stripes["z"]):
            z = H * zf
            rr = None
            for (zz, r_) in prof:
                if zz >= z:
                    rr = r_
                    break
            rr = (rr or r * 0.4) * 1.05
            mb.column([(z, rr), (z + stripes["h"], rr)], sides=sides, seed=seed, jit=0.0, top="flat", bottom=True,
                      lean=lean, mat="EMIT", part=20 + i, rot0=0.0)
    o = mb.build(name, angle=35)
    paint_rock(o, pal, seed, top_thr=0.6, top_str=0.65, part_jit=0.04, vein=vein, strata=strata, dirt=0.25)
    if stripes:
        col = stripes["color"]
        # recolor emit faces
        me = o.data
        attr = sl.ensure_colors(o)
        for poly in me.polygons:
            if me.materials[poly.material_index].name == "EMIT":
                for li in poly.loop_indices:
                    sl._write_corner(attr, li, sl.hex_rgb(col))
    return o


def cairn(n, base_size, seed, pal, name="rock"):
    mb = MB()
    rng = random.Random(seed)
    z = 0.0
    x = y = 0.0
    sx, sy, sz = base_size
    for i in range(n):
        k = 1.0 - i * (0.55 / max(n - 1, 1))
        s = (sx * k * rng.uniform(0.9, 1.1), sy * k * rng.uniform(0.9, 1.1), sz * k * rng.uniform(0.8, 1.0))
        x += rng.uniform(-0.12, 0.12) * s[0]
        y += rng.uniform(-0.12, 0.12) * s[1]
        mb.rock(size=s, seed=seed + i * 3, subdiv=3 if i < 2 else 2, noise_amp=0.07, planes=2, plane_off=(0.85, 1.0),
                soft=0.5, flat_bottom=0.7, flat_top=0.72, squarish=0.3,
                M=xf((x, y, z + s[2] * 0.7), (rng.uniform(-6, 6), rng.uniform(-6, 6), rng.uniform(0, 360))),
                part=i + 1)
        z += s[2] * 1.55
    o = mb.build(name, angle=50)
    paint_rock(o, pal, seed, top_thr=0.55, top_str=0.6, part_jit=0.1, noise=0.04, dirt=0.1)
    return o


def slab(size, seed, pal, name="rock", second=True, tilt=(0, 3, 0), vein=None):
    mb = MB()
    mb.rock(size=size, seed=seed, subdiv=3, noise_amp=0.07, noise_scale=1.2, planes=3, plane_off=(0.82, 0.98),
            soft=0.12, flat_bottom=0.8, flat_top=0.8, squarish=0.9, M=xf((0, 0, size[2] * 0.6), tilt), part=1)
    rng = random.Random(seed)
    if second:
        mb.rock(size=(size[0] * 0.72, size[1] * 0.8, size[2] * 0.9), seed=seed + 4, subdiv=3, noise_amp=0.07,
                planes=3, plane_off=(0.82, 0.98), soft=0.12, flat_bottom=0.8, flat_top=0.8, squarish=0.9,
                M=xf((size[0] * 0.35, size[1] * 0.15, -size[2] * 0.1), (0, 0, 28)), part=2)
        mb.rock(size=(size[2] * 1.5, size[2] * 1.2, size[2] * 1.1), seed=seed + 8, subdiv=2, noise_amp=0.12,
                planes=5, soft=0.07, flat_bottom=0.5, M=xf((-size[0] * 0.75, -size[1] * 0.55, size[2] * 0.2)), part=3)
    o = mb.build(name, angle=35)
    paint_rock(o, pal, seed, top_thr=0.6, top_str=0.65, part_jit=0.04, vein=vein, strata=strata, dirt=0.25)
    if stripes:
        col = stripes["color"]
        # recolor emit faces
        me = o.data
        attr = sl.ensure_colors(o)
        for poly in me.polygons:
            if me.materials[poly.material_index].name == "EMIT":
                for li in poly.loop_indices:
                    sl._write_corner(attr, li, sl.hex_rgb(col))
    return o


def cairn(n, base_size, seed, pal, name="rock"):
    mb = MB()
    rng = random.Random(seed)
    z = 0.0
    x = y = 0.0
    sx, sy, sz = base_size
    for i in range(n):
        k = 1.0 - i * (0.55 / max(n - 1, 1))
        s = (sx * k * rng.uniform(0.9, 1.1), sy * k * rng.uniform(0.9, 1.1), sz * k * rng.uniform(0.8, 1.0))
        x += rng.uniform(-0.12, 0.12) * s[0]
        y += rng.uniform(-0.12, 0.12) * s[1]
        mb.rock(size=s, seed=seed + i * 3, subdiv=3 if i < 2 else 2, noise_amp=0.07, planes=2, plane_off=(0.85, 1.0),
                soft=0.5, flat_bottom=0.7, flat_top=0.72, squarish=0.3,
                M=xf((x, y, z + s[2] * 0.7), (rng.uniform(-6, 6), rng.uniform(-6, 6), rng.uniform(0, 360))),
                part=i + 1)
        z += s[2] * 1.55
    o = mb.build(name, angle=50)
    paint_rock(o, pal, seed, top_thr=0.55, top_str=0.6, part_jit=0.1, noise=0.04, dirt=0.1)
    return o


def slab(size, seed, pal, name="rock", second=True, tilt=(0, 3, 0), vein=None):
    mb = MB()
    mb.rock(size=size, seed=seed, subdiv=3, noise_amp=0.07, noise_scale=1.2, planes=3, plane_off=(0.82, 0.98),
            soft=0.12, flat_bottom=0.8, flat_top=0.8, squarish=0.9, M=xf((0, 0, size[2] * 0.6), tilt), part=1)
    rng = random.Random(seed)
    if second:
        k = 0.5
        mb.rock(size=(size[0] * k, size[1] * k, size[2] * 1.1), seed=seed + 4, subdiv=2, noise_amp=0.08, planes=3,
                plane_off=(0.8, 0.98), soft=0.1, flat_bottom=0.8, squarish=0.8,
                M=xf((size[0] * 0.95, size[1] * 0.5, size[2] * 0.5), (0, -10, 40)), part=2)
        mb.rock(size=(size[2] * 1.6, size[2] * 1.3, size[2] * 0.9), seed=seed + 8, subdiv=2, noise_amp=0.12,
                planes=5, soft=0.07, flat_bottom=0.5, M=xf((-size[0] * 0.8, -size[1] * 0.75, size[2] * 0.35)), part=3)
    o = mb.build(name, angle=35)
    paint_rock(o, pal, seed, top_thr=0.6, top_str=0.9, part_jit=0.06, vein=vein)
    return o


# --------------------------------------------------------------------------- catalogue
def S(density, spacing, zone, slope=40, cluster=0.5):
    return scatter(density, slope, spacing, cluster, zone)


def build_boulders(rec, only=None):
    A = PAL
    items = []

    def add(id_, fn, world, cat, size_m, sc):
        items.append((id_, fn, world, cat, size_m, sc))

    # ---- river stones
    add("verdant_rock_river_a", lambda: river_stone((0.55, 0.45, 0.34), 11, A["verdant"]), "verdant", "rock", "small", S(1.4, 2.0, "meadow"))
    add("verdant_rock_river_b", lambda: river_stone((2.3, 1.9, 1.45), 12, A["verdant"], trio=True), "verdant", "rock", "large", S(0.12, 14, "shore", 25, 0.2))
    add("amber_rock_river_a", lambda: river_stone((0.8, 0.55, 0.42), 21, A["amber"], trio=True), "amber", "rock", "small", S(0.8, 3, "shore"))
    add("glass_rock_river_a", lambda: river_stone((1.1, 0.85, 0.62), 31, A["glass"]), "glass", "rock", "medium", S(0.5, 4, "any"))
    add("hub_rock_river_a", lambda: river_stone((0.8, 0.65, 0.5), 41, A["hub"], trio=True), "hub", "rock", "small", S(0.8, 3, "any"))
    # ---- faceted chunks
    add("verdant_rock_chunk_a", lambda: faceted_chunk((0.9, 0.75, 0.62), 51, A["verdant"]), "verdant", "rock", "medium", S(1.0, 3, "any"))
    add("verdant_rock_chunk_b", lambda: faceted_chunk((3.0, 2.4, 2.1), 52, A["verdant"]), "verdant", "rock", "large", S(0.1, 16, "cliff", 45, 0.2))
    add("amber_rock_chunk_a", lambda: faceted_chunk((1.1, 0.8, 0.7), 53, A["amber"]), "amber", "rock", "medium", S(1.0, 3, "any"))
    add("amber_rock_chunk_b", lambda: faceted_chunk((2.8, 2.2, 2.4), 54, A["amber"], vein=("#E8935A", 0.5, 0.09)), "amber", "rock", "large", S(0.1, 16, "cliff", 45, 0.2))
    add("ember_rock_chunk_a", lambda: faceted_chunk((0.95, 0.8, 0.7), 55, A["ember"], vein=("#FF5A1F", 0.9, 0.07)), "ember", "rock", "medium", S(1.2, 3, "any"))
    add("ember_rock_chunk_b", lambda: faceted_chunk((3.2, 2.6, 2.5), 56, A["ember"], vein=("#FF7A2A", 0.55, 0.08)), "ember", "rock", "large", S(0.1, 16, "cliff", 45, 0.2))
    add("glass_rock_chunk_a", lambda: faceted_chunk((1.0, 0.8, 0.8), 57, A["glass"]), "glass", "rock", "medium", S(0.8, 3, "any"))
    add("hub_rock_chunk_a", lambda: faceted_chunk((1.2, 0.95, 0.8), 58, A["hub"], vein=("#9D6BFF", 0.8, 0.06)), "hub", "rock", "medium", S(0.8, 3, "any"))
    # ---- menhirs
    add("verdant_rock_menhir_a", lambda: menhir(4.2, 0.62, 61, A["verdant"]), "verdant", "rock", "tall", S(0.06, 20, "meadow", 20, 0.1))
    add("amber_rock_menhir_a", lambda: menhir(5.4, 0.75, 62, A["amber"], sides=9, strata=(0.9, ["#F5B971", "#E8935A", "#C4644F", "#F2A7A0", "#E8935A"]), tip=0.7), "amber", "rock", "tall", S(0.06, 20, "any", 20, 0.1))
    add("ember_rock_menhir_a", lambda: menhir(4.8, 0.6, 63, A["ember"], sides=6, vein=("#FF5A1F", 0.6, 0.07), lean=(0.07, -0.03), tip=0.45), "ember", "rock", "tall", S(0.06, 20, "any", 20, 0.1))
    add("glass_rock_menhir_a", lambda: menhir(3.9, 0.55, 64, A["glass"], sides=7, tip=0.4), "glass", "rock", "tall", S(0.06, 20, "any", 20, 0.1))
    add("hub_rock_menhir_a", lambda: menhir(3.6, 0.55, 65, A["hub"], sides=8, stripes=dict(z=[0.35, 0.5, 0.65], h=0.09, color="#9D6BFF")), "hub", "rock", "tall", S(0.05, 20, "any", 20, 0.1))
    # ---- cairns
    add("verdant_rock_cairn_a", lambda: cairn(5, (0.5, 0.45, 0.2), 71, A["verdant"]), "verdant", "rock", "small", S(0.3, 12, "meadow", 20, 0.1))
    add("amber_rock_cairn_a", lambda: cairn(6, (0.7, 0.6, 0.25), 72, A["amber"]), "amber", "rock", "medium", S(0.25, 14, "any", 20, 0.1))
    add("glass_rock_cairn_a", lambda: cairn(4, (0.6, 0.55, 0.26), 73, A["glass"]), "glass", "rock", "small", S(0.25, 14, "any", 20, 0.1))
    add("hub_rock_cairn_a", lambda: cairn(5, (0.55, 0.5, 0.22), 74, A["hub"]), "hub", "rock", "small", S(0.25, 14, "any", 20, 0.1))
    # ---- slabs
    add("verdant_rock_slab_a", lambda: slab((1.7, 1.2, 0.26), 81, A["verdant"]), "verdant", "rock", "medium", S(0.5, 5, "meadow", 20))
    add("amber_rock_slab_a", lambda: slab((2.4, 1.6, 0.3), 82, A["amber"], tilt=(2, -4, 12)), "amber", "rock", "large", S(0.4, 6, "any", 20))
    add("ember_rock_slab_a", lambda: slab((2.0, 1.4, 0.3), 83, A["ember"], vein=("#FF5A1F", 0.8, 0.06)), "ember", "rock", "medium", S(0.5, 5, "any", 20))
    add("glass_rock_slab_a", lambda: slab((1.9, 1.4, 0.28), 84, A["glass"]), "glass", "rock", "medium", S(0.4, 5, "any", 20))
    add("hub_rock_slab_a", lambda: slab((1.8, 1.3, 0.26), 85, A["hub"]), "hub", "rock", "medium", S(0.4, 5, "plaza", 20))

    for id_, fn, world, cat, sizem, sc in items:
        if only and not any(o in id_ for o in only):
            continue
        fresh()
        o = fn()
        e = finish([o], id_, cat, [world], {"type": "convex"}, sc, ao=0.45,
                   extra={"family": "boulder", "size_class": sizem})
        rec.add(e)
