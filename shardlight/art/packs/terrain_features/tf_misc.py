"""Misc terrain props: stepping stones, sand dune ripple rocks, steam vent mound, geodes, ice spikes."""
import math
import random
from mathutils import Vector, Matrix
import sl_common as sl
from tf_core import *
from tf_paint import PAL, paint_rock
from tf_crystals import CrystalSet, cluster, COLS, paint_crystals, basis_matrix


# --------------------------------------------------------------------------- stepping stones
def stepping_stones(world, n, seed, size=0.7):
    mb = MB()
    rng = random.Random(seed)
    x = 0.0
    for i in range(n):
        r = size * rng.uniform(0.8, 1.2)
        h = rng.uniform(0.3, 0.42) * (size / 0.7)
        y = 0.9 * math.sin(i * 0.85 + seed) + rng.uniform(-0.15, 0.15)
        mb.rock(size=(r * 1.1, r, h), seed=seed + i, subdiv=3, noise_amp=0.07, planes=2, plane_off=(0.88, 1.0), soft=0.4,
                flat_bottom=0.55, flat_top=0.62, squarish=0.25,
                M=xf((x, y, h * 0.6), (rng.uniform(-3, 3), rng.uniform(-3, 3), rng.uniform(0, 360))), part=i + 1)
        x += r * 1.0 + size * rng.uniform(0.75, 1.0) + 0.35
    o = mb.build("stones", angle=50)
    paint_rock(o, PAL[world], seed, top_thr=0.6, top_str=0.8 if world == "verdant" else 0.5, part_jit=0.09,
               dirt=0.25 if world != "glass" else 0.05, noise=0.05)
    return o


# --------------------------------------------------------------------------- dunes
def dune(seed, sx, sy, H, rocks, theta=0.5):
    mb = MB()
    rng = random.Random(seed)
    k = 2 * math.pi / 0.95

    def fn(x, y):
        u = (x / (sx / 2)) ** 2 + (y / (sy / 2)) ** 2
        env = max(0.0, 1 - u) ** 0.9
        h = H * env
        ph = (x * math.cos(theta) + y * math.sin(theta)) * k + 1.8 * fbm(Vector((x, y, 0)) * 0.35, seed)
        h += 0.1 * math.sin(ph) * clamp(env * 3)
        return h + 0.0

    mb.heightfield(int(sx * 4.5), int(sy * 4.5), sx, sy, fn, bottom=False, part=1)
    import bmesh
    dead = [f for f in mb.bm.faces if max(v.co.z for v in f.verts) < 0.006]
    bmesh.ops.delete(mb.bm, geom=dead, context="FACES")
    bmesh.ops.delete(mb.bm, geom=[v for v in mb.bm.verts if not v.link_faces], context="VERTS")
    for i, (px, py, kk) in enumerate(rocks):
        mb.rock(size=(kk * 1.3, kk, kk * 0.85), seed=seed + 20 + i, subdiv=3, noise_amp=0.12, planes=6, soft=0.08,
                plane_off=(0.62, 0.9), flat_bottom=None,
                M=xf((px, py, fn(px, py) + kk * 0.1), (rng.uniform(-10, 10), rng.uniform(-10, 10), rng.uniform(0, 360))),
                part=5 + i)
    o = mb.build("dune", angle=60)
    P = PAL["amber"]

    def paint_fn(co, n, pn, mi, pid):
        if pid >= 5:
            t = clamp(co.z / (H + 0.8))
            c = mix3("#B25643", "#C4644F", "#EBA062", t)
            c = sl.mix(c, "#F5B971", smoothstep(0.55, 0.9, n.z) * 0.6)
            return lit(c, n, 0.2)
        ph = (co.x * math.cos(theta) + co.y * math.sin(theta)) * k + 1.8 * fbm(Vector((co.x, co.y, 0)) * 0.35, seed)
        crest = 0.5 + 0.5 * math.sin(ph)
        c = sl.mix("#E8935A", "#FFDDA6", crest * 0.8 + clamp(co.z / max(H, 0.1)) * 0.2)
        c = sl.mix(c, "#F2A7A0", smoothstep(0.35, 0.0, n.z) * 0.4)
        edge = 1 - smoothstep(0.0, 0.2, co.z)
        c = sl.mix(c, "#E8935A", edge * 0.4)
        return lit(c, n, 0.2, 0.1, shadow="#7A4A8C")

    paint(o, paint_fn)
    return o


# --------------------------------------------------------------------------- steam vent
def steam_vent(seed, scale=1.0, chunks=8):
    mb = MB(("VC_ROUGH", "EMIT"))
    rng = random.Random(seed)
    S = scale
    prof = [(0.0, 3.4 * S), (0.4 * S, 3.0 * S), (0.95 * S, 2.3 * S), (1.45 * S, 1.55 * S), (1.8 * S, 1.1 * S),
            (1.98 * S, 0.88 * S), (1.86 * S, 0.66 * S), (1.45 * S, 0.54 * S), (1.1 * S, 0.46 * S), (0.98 * S, 0.22 * S)]
    mb.column(prof, sides=18, seed=seed, jit=0.06, top="point", apex=-0.04 * S, ring_noise=0.13, rn_scale=0.5, part=1)
    mb.column([(1.04 * S, 0.42 * S), (1.07 * S, 0.4 * S)], sides=14, seed=seed, top="flat", bottom=False, mat="EMIT", part=900)
    for i in range(chunks):
        a = rng.uniform(0, 6.28)
        d = rng.uniform(1.0, 1.35) * 3.2 * S
        k = rng.uniform(0.25, 0.7) * S
        mb.rock(size=(k * 1.3, k, k * 0.8), seed=seed + 20 + i, subdiv=2, noise_amp=0.12, planes=5, soft=0.07,
                flat_bottom=0.4, M=xf((math.cos(a) * d, math.sin(a) * d, 0.0), (0, 0, rng.uniform(0, 360))), part=5 + i)
    o = mb.build("vent", angle=35)
    P = PAL["ember"]
    names = [m.name for m in o.data.materials]
    H = 2.0 * S

    def fn(co, n, pn, mi, pid):
        if names[mi] == "EMIT":
            return sl.hex_rgb("#FF7A2A")
        t = clamp(co.z / H)
        c = mix3("#2B2238", "#4A3C5C", "#6E6077", t)
        r = math.hypot(co.x, co.y)
        # glowing cracks and warm rim around the vent mouth
        crack = abs(fbm(co * 0.9, seed + 3, 2))
        c = sl.mix(c, "#FF5A1F", smoothstep(0.06, 0.015, crack) * 0.8 * smoothstep(0.1, 0.5, t))
        c = sl.mix(c, "#FF8A3D", smoothstep(0.9 * S + 0.5, 0.55 * S, r) * smoothstep(0.5, 0.95, t) * 0.8)
        c = sl.mix(c, "#968AA0", smoothstep(0.8, 0.98, n.z) * 0.35 * (1 - smoothstep(0.5, 0.0, r / (3 * S))))
        return lit(c, n, 0.2, 0.05, shadow="#3A1E4D")

    paint(o, fn)
    return o


# --------------------------------------------------------------------------- geode
def geode(world, ckey, seed, bands, tilt=40):
    mb = MB(("VC_ROUGH", "EMIT", "GLASS"))
    rng = random.Random(seed)
    outer = [(0.0, 0.6), (0.22, 1.05), (0.7, 1.42), (1.15, 1.52), (1.5, 1.38), (1.66, 1.2)]
    cav = [(1.7, 1.06), (1.52, 1.0), (1.2, 0.92), (0.9, 0.76), (0.68, 0.5), (0.6, 0.2)]
    prof = outer + cav
    mb.column(prof, sides=20, seed=seed, jit=0.05, top="point", apex=-0.04, ring_noise=0.1, rn_scale=0.8, part=1)
    # base chunks
    for i in range(3):
        a = rng.uniform(0, 6.28)
        k = rng.uniform(0.25, 0.45)
        mb.rock(size=(k * 1.3, k, k * 0.7), seed=seed + 40 + i, subdiv=2, noise_amp=0.12, planes=5, soft=0.07,
                flat_bottom=0.4, M=xf((math.cos(a) * 1.6, math.sin(a) * 1.6, 0.0), (0, 0, rng.uniform(0, 360))), part=5 + i)
    cs = CrystalSet(mb)
    ctr = Vector((0, 0, 1.25))
    for i in range(34):
        seg = rng.randrange(len(cav) - 1)
        f = rng.random()
        z = lerp(cav[seg][0], cav[seg + 1][0], f)
        r = lerp(cav[seg][1], cav[seg + 1][1], f)
        a = rng.uniform(0, 6.28)
        pos = Vector((math.cos(a) * r, math.sin(a) * r, z))
        dirv = (ctr - pos).normalized() * 0.65 + Vector((0, 0, 1)) * 0.5
        L = rng.uniform(0.28, 0.7) * (1.2 if r < 0.6 else 1.0)
        cs.add(pos - dirv.normalized() * 0.08, dirv, L, rng.uniform(0.06, 0.1), seed * 10 + i, shell="GLASS", core_ratio=0.5)
    o = mb.build("geode", angle=35)
    for poly in o.data.polygons:
        if o.data.materials[poly.material_index].name in ("GLASS", "EMIT"):
            poly.use_smooth = False
    cols = COLS[ckey]
    paint_crystals(o, cs, cols, world, seed, mound_args=dict(dirt=0.0, top_str=0.0))
    # recolor rock: dark cortex outside, agate bands inside
    me = o.data
    attr = sl.ensure_colors(o)
    names = [m.name for m in me.materials]
    for poly in me.polygons:
        if names[poly.material_index] != "VC_ROUGH":
            continue
        pid = me.attributes["part"].data[poly.index].value
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index]
            co = v.co
            if pid != 1:
                c = sl.mix("#4B3A5A", "#6E5E80", clamp(fbm(co * 1.1, seed) * 2 + 0.5))
            else:
                d = math.hypot(math.hypot(co.x, co.y), (co.z - 1.25) * 0.8)
                inner = (co.z > 1.0 and math.hypot(co.x, co.y) < 1.12 and v.normal.z > -0.2 and (v.normal.dot(Vector((-co.x, -co.y, 1.25 - co.z)).normalized()) > 0.0)) or co.z > 1.66
                if inner:
                    b = 0.5 + 0.5 * math.sin(d * 11 + 0.8 * fbm(co * 1.5, seed))
                    c = mix3(bands[0], bands[1], bands[2], b)
                else:
                    c = sl.mix("#4B3A5A", "#7B6A8C", clamp(co.z / 1.7 + 0.2 * fbm(co * 1.3, seed + 4)))
                    # pale cortex lip around the cut
                    c = sl.mix(c, bands[2], smoothstep(1.35, 1.66, co.z) * 0.55)
            sl._write_corner(attr, li, lit(c, v.normal, 0.2))
    # tilt so the cut face looks up-forward
    o.data.transform(rot_matrix(tilt, 0, 0))
    o.data.update()
    return o


# --------------------------------------------------------------------------- ice spikes
def ice_spikes(seed, n, hmax, spread, small=False):
    mb = MB(("VC_ROUGH", "GLASS"))
    rng = random.Random(seed)
    # snowy mound
    rk = spread * 1.2
    mb.rock(size=(rk, rk * 0.9, rk * 0.22), seed=seed, subdiv=3, noise_amp=0.12, planes=4, soft=0.2, flat_bottom=0.5,
            M=xf((0, 0, rk * 0.08)), part=500)
    info = {}
    for i in range(n):
        a = rng.uniform(0, 6.28) + i * 2.1
        rr = 0 if i == 0 else spread * rng.uniform(0.2, 1.0)
        h = hmax * (1.0 if i == 0 else rng.uniform(0.22, 0.75))
        r = h * rng.uniform(0.07, 0.11) + 0.05
        lean = 0 if i == 0 else rng.uniform(5, 26) * (rr / spread)
        la = math.radians(lean)
        d = Vector((math.sin(la) * math.cos(a), math.sin(la) * math.sin(a), math.cos(la)))
        base = Vector((math.cos(a) * rr, math.sin(a) * rr, rk * 0.1))
        M = basis_matrix(base, d, rng.uniform(0, 6))
        prof = [(-0.2, r * 1.1), (0.0, r), (h * 0.55, r * 0.7), (h * 0.85, r * 0.36)]
        mb.column(prof, sides=5 if i % 2 else 6, seed=seed + i, jit=0.1, top="point", apex=h * 0.2, M=M, mat="GLASS",
                  part=1000 + i)
        info[1000 + i] = (base, d, h)
    o = mb.build("spikes", angle=30)
    for poly in o.data.polygons:
        if o.data.materials[poly.material_index].name == "GLASS":
            poly.use_smooth = False
    P = PAL["glass"]
    paint_rock(o, P, seed, top_thr=0.4, top_str=0.9, dirt=0.0)
    me = o.data
    attr = sl.ensure_colors(o)
    part = me.attributes["part"]
    for poly in me.polygons:
        if me.materials[poly.material_index].name != "GLASS":
            continue
        pid = part.data[poly.index].value
        org, d, h = info[pid]
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index]
            t = clamp((v.co - org).dot(d) / h)
            c = sl.mix("#7FC8FF", "#EAF6FF", t ** 0.8)
            c = sl.mix(c, "#6CFFC8", smoothstep(0.7, 1.0, t) * 0.35)
            if (pid % 3) == 0:
                c = sl.mix(c, "#C9B6FF", 0.35 * t)
            sl._write_corner(attr, li, lit(c, v.normal, 0.04, 0.1))
    return o


def build_misc(rec, only=None):
    jobs = []

    def job(id_, world, cat, maker, collision, sc, ao=0.4, extra=None, preview=None, aod=None, origin="base"):
        jobs.append((id_, world, cat, maker, collision, sc, ao, extra or {}, preview or {}, aod, origin))

    job("verdant_misc_stepping_stones_a", "verdant", "misc", lambda: stepping_stones("verdant", 7, 801, 0.7),
        {"type": "trimesh"}, scatter(0.1, 12, 18, 0.0, "shore"), extra={"family": "misc", "note": "each stone top is walkable; set of discrete stones, trimesh not convex"},
        preview=dict(elev=40, azim=-20, frame=1.0))
    job("amber_misc_stepping_stones_a", "amber", "misc", lambda: stepping_stones("amber", 6, 802, 0.85),
        {"type": "trimesh"}, scatter(0.1, 12, 18, 0.0, "shore"), extra={"family": "misc"}, preview=dict(elev=40, azim=-20, frame=1.0))
    job("glass_misc_stepping_stones_a", "glass", "misc", lambda: stepping_stones("glass", 6, 803, 0.75),
        {"type": "trimesh"}, scatter(0.1, 12, 18, 0.0, "shore"), extra={"family": "misc"}, preview=dict(elev=40, azim=-20, frame=1.0))
    job("amber_misc_dune_rocks_a", "amber", "misc", lambda: dune(811, 7.0, 4.6, 0.9, [(-1.6, 0.4, 0.55), (1.4, -0.6, 0.38), (0.2, 0.9, 0.3)]),
        {"type": "convex"}, scatter(0.5, 18, 8, 0.6, "any"), extra={"family": "misc"}, aod=0.8)
    job("amber_misc_dune_rocks_b", "amber", "misc", lambda: dune(812, 10.0, 5.0, 1.2, [(-2.4, 0.2, 0.95), (2.6, 0.5, 0.45)], 1.1),
        {"type": "convex"}, scatter(0.3, 18, 10, 0.5, "any"), extra={"family": "misc"}, aod=1.0)
    job("ember_misc_steam_vent_a", "ember", "misc", lambda: steam_vent(821, 1.0, 9),
        {"type": "convex"}, scatter(0.2, 25, 14, 0.3, "any"),
        extra={"family": "misc", "vfx_socket": {"name": "steam", "pos": [0, 1.9, 0], "dir": [0, 1, 0]}})
    job("ember_misc_steam_vent_b", "ember", "misc", lambda: steam_vent(822, 0.55, 5),
        {"type": "convex"}, scatter(0.4, 25, 8, 0.4, "any"),
        extra={"family": "misc", "vfx_socket": {"name": "steam", "pos": [0, 1.05, 0], "dir": [0, 1, 0]}})
    job("amber_misc_geode_a", "amber", "misc", lambda: geode("amber", "amber", 831, ("#2A9D8F", "#F2A7A0", "#F7FAFF")),
        {"type": "trimesh"}, scatter(0.1, 30, 14, 0.2, "any"), extra={"family": "misc", "cut_open": True}, aod=0.8)
    job("glass_misc_geode_a", "glass", "misc", lambda: geode("glass", "glass", 832, ("#8E7BD8", "#C9B6FF", "#F7FAFF")),
        {"type": "trimesh"}, scatter(0.1, 30, 14, 0.2, "any"), extra={"family": "misc", "cut_open": True}, aod=0.8)
    job("hollow_misc_geode_a", "hollow", "misc", lambda: geode("hollow", "hollow_pink", 833, ("#4B2A7B", "#FF8AD8", "#FFD6F2")),
        {"type": "trimesh"}, scatter(0.1, 30, 14, 0.2, "cave"), extra={"family": "misc", "cut_open": True}, aod=0.8)
    job("glass_misc_ice_spikes_a", "glass", "misc", lambda: ice_spikes(841, 9, 4.6, 1.5),
        {"type": "convex"}, scatter(0.4, 30, 8, 0.7, "any"), extra={"family": "misc"})
    job("glass_misc_ice_spikes_b", "glass", "misc", lambda: ice_spikes(842, 14, 8.0, 2.8),
        {"type": "convex"}, scatter(0.15, 30, 14, 0.6, "any"), extra={"family": "misc"})
    job("glass_misc_ice_spikes_c", "glass", "misc", lambda: ice_spikes(843, 6, 1.6, 0.6, True),
        {"type": "convex"}, scatter(1.0, 30, 3, 0.8, "any"), extra={"family": "misc"}, aod=0.4)

    for id_, world, cat, maker, coll, sc, ao, extra, prev, aod, origin in jobs:
        if only and not any(o in id_ for o in only):
            continue
        fresh()
        o = maker()
        pk = dict(elev=20, azim=-35, frame=1.1)
        pk.update(prev)
        e = finish([o], id_, cat, [world], coll, sc, ao=ao, ao_dist=aod, preview_kw=pk, extra=extra, origin=origin)
        rec.add(e)
