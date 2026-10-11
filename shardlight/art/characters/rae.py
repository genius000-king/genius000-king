"""Rae Vael — main character (coordinator-built). Blender 4.5, run:
    blender -b --factory-startup --python art/characters/rae.py

Builds the stylized full-body model from the reference sheet (docs/refs/ref_char_front.jpg / ref_char_back.jpg),
a 20-bone skeleton, distance-based skin weights with per-part bone restrictions, painterly vertex colors,
and animations: idle, walk, run, wave, talk, look_around, menu_pose. Exports:
    game/assets/models/characters_main/rae.glb   (full body, animated)
    game/assets/models/characters_main/rae_fp_arms.glb (first-person forearms+hands, animated)
Character faces Blender -Y (Godot +Z). Height 1.62 m (1.70 m with cap).
"""
import os
import sys
import math
import random

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import bpy
import bmesh
from mathutils import Vector, Matrix, Quaternion, Euler, noise
import sl_common as sl

PACK = "characters_main"
OUT_ID = "rae"

# ------------------------------------------------------------------ palette (sRGB, from the reference)
SKIN = "#C98057"
SKIN_LIGHT = "#D9895C"
SKIN_SHADE = "#9A5A48"
BLUSH = "#D9665A"
LIP = "#A8524A"
EYE = "#2A1C2E"
EYE_HI = "#FFF6EE"
BROW = "#5A2A22"
HAIR_ROOT = "#D9262C"
HAIR_MID = "#FF6A2B"
HAIR_TIP = "#FFD447"
CAP = "#7E86E8"
CAP_SHADE = "#5B5FC4"
CAP_BRIM_UNDER = "#4A4BA6"
TEE = "#F6F2EA"
TEE_SHADE = "#C9C2E8"
PANTS = "#7F8CE6"
PANTS_SHADE = "#5D62C8"
PANTS_SEAM = "#6A70D4"
SHOE_SOLE = "#F3E6D3"
SHOE_UPPER = "#EDC9B4"
SHOE_ACCENT = "#C83A3A"
SHOE_LACE = "#FFFDF8"
SHOE_SOLE_STRIPE = "#E07A6A"
BAG = "#8A5A3C"
BAG_DARK = "#6A402B"
STRAP = "#3B2A2A"
BUCKLE = "#D8B46A"

rng = random.Random(1717)

# ------------------------------------------------------------------ skeleton definition
# (name, head, tail, parent)
BONES = [
    ("root", (0, 0, 0), (0, 0, 0.12), None),
    ("hips", (0, 0, 0.90), (0, 0, 1.0), "root"),
    ("spine", (0, 0, 1.0), (0, 0.0, 1.15), "hips"),
    ("chest", (0, 0, 1.15), (0, 0.0, 1.33), "spine"),
    ("neck", (0, 0.005, 1.36), (0, 0.0, 1.44), "chest"),
    ("head", (0, 0.0, 1.44), (0, 0.0, 1.68), "neck"),
]
for side, sx in (("L", 1), ("R", -1)):
    BONES += [
        (f"shoulder.{side}", (0.03 * sx, 0.0, 1.335), (0.165 * sx, 0.01, 1.315), "chest"),
        (f"upper_arm.{side}", (0.175 * sx, 0.01, 1.31), (0.245 * sx, 0.025, 1.06), f"shoulder.{side}"),
        (f"forearm.{side}", (0.245 * sx, 0.025, 1.06), (0.275 * sx, -0.01, 0.835), f"upper_arm.{side}"),
        (f"hand.{side}", (0.275 * sx, -0.01, 0.835), (0.285 * sx, -0.025, 0.735), f"forearm.{side}"),
        (f"thigh.{side}", (0.088 * sx, 0.0, 0.91), (0.098 * sx, -0.01, 0.49), "hips"),
        (f"shin.{side}", (0.098 * sx, -0.01, 0.49), (0.108 * sx, 0.015, 0.095), f"thigh.{side}"),
        (f"foot.{side}", (0.108 * sx, 0.015, 0.095), (0.112 * sx, -0.12, 0.035), f"shin.{side}"),
    ]
BONE_MAP = {b[0]: b for b in BONES}


def seg_dist(p, a, b):
    a, b = Vector(a), Vector(b)
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (a + ab * t - p).length


# ------------------------------------------------------------------ mesh helpers
def ellipsoid(name, center, radii, segs=24, rings=14, material="VC", deform=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    for v in bm.verts:
        p = v.co.copy()
        if deform:
            p = deform(p)
        v.co = Vector((p.x * radii[0], p.y * radii[1], p.z * radii[2])) + Vector(center)
    return sl.bm_to_object(bm, name, material)


def lathe(name, profile, segs=24, material="VC", center=(0, 0, 0), scale_xy=(1, 1), cap_bottom=True, cap_top=True,
          shape=None):
    """Revolve a profile [(r, z), ...] around Z. shape(angle, z) -> (sx, sy, dy) multiplies radius per angle."""
    bm = bmesh.new()
    rings = []
    for (r, z) in profile:
        ring = []
        for k in range(segs):
            a = 2 * math.pi * k / segs
            sx, sy, dy = (1.0, 1.0, 0.0)
            if shape:
                sx, sy, dy = shape(a, z)
            x = math.cos(a) * r * scale_xy[0] * sx
            y = math.sin(a) * r * scale_xy[1] * sy + dy
            ring.append(bm.verts.new(Vector((x, y, z)) + Vector(center)))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(segs):
            a, b = rings[i][k], rings[i][(k + 1) % segs]
            c, d = rings[i + 1][(k + 1) % segs], rings[i + 1][k]
            bm.faces.new((a, b, c, d))
    if cap_bottom and profile[0][0] > 1e-4:
        bm.faces.new(list(reversed(rings[0])))
    if cap_top and profile[-1][0] > 1e-4:
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return sl.bm_to_object(bm, name, material)


def tube(name, pts, radii, sides=12, material="VC"):
    return sl.tapered_tube(name, pts, radii, sides=sides, material=material)


def smooth_obj(obj, levels=1):
    sl.subdivide(obj, levels)


def paint_fn(obj, fn):
    """fn(world_pos, normal) -> sRGB color, per corner."""
    me = obj.data
    attr = sl.ensure_colors(obj)
    for poly in me.polygons:
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index]
            c = sl.hex_rgb(fn(v.co.copy(), v.normal.copy()))
            sl._write_corner(attr, li, c)


def shade(base, shade_col, n, p, light=Vector((0.55, -0.6, 0.6)).normalized(), amount=0.35):
    """Bake a gentle painterly key-light gradient (warm top/front, cool under) into vertex colors."""
    d = n.dot(light) * 0.5 + 0.5
    under = max(0.0, -n.z)
    c = sl.mix(shade_col, base, 0.55 + 0.45 * d)
    return sl.mix(c, shade_col, under * amount)


# ------------------------------------------------------------------ build parts
parts = []          # (obj, allowed bone list)


def add(obj, bones):
    parts.append((obj, bones))
    return obj


def build_head():
    # skull/face: sphere deformed for a stylized youthful head — round cranium, softer narrower jaw, pointed chin
    def head_def(p):
        x, y, z = p.x, p.y, p.z
        if z < 0:
            k = 1.0 - 0.32 * (-z) ** 1.3        # jaw narrowing
            x *= k
            y *= 1.0 - 0.12 * (-z)
            if y < 0:
                y *= 1.0 + 0.08 * (-z)          # chin forward a touch
            z *= 1.18                            # longer lower face
        if y > 0.2:
            y *= 1.06                            # back of skull
        if y < -0.5 and z > -0.2:
            y *= 0.94                            # flatter face plane
        return Vector((x, y, z))
    head = ellipsoid("head", (0, 0.0, 1.535), (0.098, 0.108, 0.118), 32, 20, deform=head_def)
    # nose
    nose = ellipsoid("nose", (0, -0.104, 1.503), (0.0105, 0.012, 0.017), 12, 8)
    # ears
    ears = []
    for sx in (1, -1):
        e = ellipsoid(f"ear{sx}", (0.098 * sx, 0.005, 1.515), (0.016, 0.026, 0.034), 12, 8)
        ears.append(e)
    obj = sl.join([head, nose] + ears, "skin_head")

    def col(p, n):
        c = shade(SKIN, SKIN_SHADE, n, p)
        # blush
        for sx in (1, -1):
            d = (p - Vector((0.055 * sx, -0.088, 1.49))).length
            if d < 0.03:
                c = sl.mix(c, BLUSH, (1 - d / 0.03) * 0.45)
        # lips
        if abs(p.x) < 0.022 and -0.12 < p.y < -0.085 and 1.455 < p.z < 1.47:
            c = sl.mix(c, LIP, 0.6)
        # nose tip warmer
        if p.y < -0.115:
            c = sl.mix(c, SKIN_LIGHT, 0.4)
        return c
    paint_fn(obj, col)
    add(obj, ["head", "neck"])


def build_face_details():
    objs = []
    for sx in (1, -1):
        # almond eye: flattened, tilted dark shape sitting on the face surface
        eye = ellipsoid(f"eye{sx}", (0, 0, 0), (0.019, 0.006, 0.012), 14, 8,
                        deform=lambda p: Vector((p.x, p.y, p.z + 0.35 * p.x * p.x)))
        eye.rotation_euler = (0, math.radians(-10 * sx), math.radians(16 * sx))
        eye.location = (0.041 * sx, -0.101, 1.532)
        sl.apply_transforms_and_location(eye)
        sl.paint_solid(eye, EYE)
        hi = ellipsoid(f"eyehi{sx}", (0.046 * sx, -0.106, 1.537), (0.005, 0.002, 0.004), 8, 6)
        sl.paint_solid(hi, EYE_HI)
        # upper lash line (thick stylized)
        lash = tube(f"lash{sx}", [(0.018 * sx, -0.104, 1.538), (0.04 * sx, -0.108, 1.546), (0.062 * sx, -0.099, 1.543),
                                  (0.07 * sx, -0.094, 1.548)], [0.0035, 0.0045, 0.004, 0.001], sides=6)
        sl.paint_solid(lash, EYE)
        brow = tube(f"brow{sx}", [(0.02 * sx, -0.106, 1.572), (0.045 * sx, -0.108, 1.58), (0.068 * sx, -0.1, 1.575)],
                    [0.003, 0.0042, 0.002], sides=6)
        sl.paint_solid(brow, BROW)
        objs += [eye, hi, lash, brow]
    mouth = tube("mouth", [(-0.016, -0.111, 1.464), (0, -0.114, 1.462), (0.016, -0.111, 1.466)], [0.0015, 0.0022, 0.0012], 6)
    sl.paint_solid(mouth, "#6E2E2E")
    objs.append(mouth)
    obj = sl.join(objs, "face_details")
    sl.shade_smooth(obj)
    add(obj, ["head"])


def build_neck_torso_arms():
    neck = tube("neck", [(0, 0.008, 1.35), (0, 0.004, 1.40), (0, 0.0, 1.455)], [0.046, 0.043, 0.045], 14)
    # midriff (visible skin between crop tee and pants)
    mid = lathe("midriff", [(0.0, 0.94), (0.11, 0.945), (0.112, 0.98), (0.106, 1.04), (0.11, 1.1), (0.12, 1.14), (0.0, 1.15)],
                20, scale_xy=(1.0, 0.72))
    arms = []
    for side, sx in (("L", 1), ("R", -1)):
        ua = BONE_MAP[f"upper_arm.{side}"]
        fa = BONE_MAP[f"forearm.{side}"]
        pts = [ua[1], (Vector(ua[1]) * 0.5 + Vector(ua[2]) * 0.5)[:], ua[2], (Vector(fa[1]) * 0.5 + Vector(fa[2]) * 0.5)[:], fa[2]]
        arm = tube(f"arm{side}", pts, [0.036, 0.037, 0.034, 0.033, 0.027], 14)
        arms.append(arm)
        # hand: stylized loose fist (palm block + finger roll + thumb)
        hb = Vector(BONE_MAP[f"hand.{side}"][1])
        palm = ellipsoid(f"palm{side}", hb + Vector((0.004 * sx, -0.008, -0.045)), (0.024, 0.034, 0.042), 14, 10)
        fingers = tube(f"fingers{side}", [hb + Vector((0.0, -0.035, -0.06)), hb + Vector((0.004 * sx, -0.032, -0.088)),
                                           hb + Vector((0.006 * sx, -0.012, -0.1)), hb + Vector((0.006 * sx, 0.006, -0.086))],
                       [0.02, 0.021, 0.019, 0.016], 12)
        fingers.scale = (1, 1, 1)
        thumb = tube(f"thumb{side}", [hb + Vector((-0.014 * sx, -0.03, -0.03)), hb + Vector((-0.02 * sx, -0.045, -0.055)),
                                       hb + Vector((-0.012 * sx, -0.05, -0.075))], [0.012, 0.011, 0.009], 10)
        arms += [palm, fingers, thumb]
    obj = sl.join([neck, mid] + arms, "skin_body")
    paint_fn(obj, lambda p, n: shade(SKIN, SKIN_SHADE, n, p))
    add(obj, ["neck", "chest", "spine", "hips", "shoulder.L", "upper_arm.L", "forearm.L", "hand.L",
              "shoulder.R", "upper_arm.R", "forearm.R", "hand.R"])


def build_tee():
    # cropped boxy tee: wide shoulders, hem at ~1.10, slight boxy flare
    def shp(a, z):
        # boxier front/back
        return (1.0 + 0.08 * abs(math.cos(a)) ** 4, 1.0, 0.0)
    body = lathe("tee_body", [(0.135, 1.095), (0.142, 1.10), (0.138, 1.16), (0.135, 1.22), (0.15, 1.29), (0.14, 1.335),
                              (0.08, 1.37), (0.055, 1.375)], 28, scale_xy=(1.0, 0.68), cap_bottom=False, cap_top=False, shape=shp)
    # hem thickness ring
    hem = lathe("tee_hem", [(0.142, 1.093), (0.146, 1.10), (0.142, 1.108)], 28, scale_xy=(1.0, 0.7), cap_bottom=False,
                cap_top=False)
    # collar rib
    collar = lathe("tee_collar", [(0.052, 1.36), (0.058, 1.372), (0.052, 1.382)], 20, scale_xy=(1.0, 0.86), cap_bottom=False,
                   cap_top=False)
    sleeves = []
    for side, sx in (("L", 1), ("R", -1)):
        ua = BONE_MAP[f"upper_arm.{side}"]
        a = Vector((0.12 * sx, 0.0, 1.325))
        b = Vector(ua[1]) * 0.5 + Vector(ua[2]) * 0.5
        sl_obj = tube(f"sleeve{side}", [a[:], (a * 0.4 + b * 0.6)[:], b[:]], [0.074, 0.068, 0.062], 16)
        sleeves.append(sl_obj)
    obj = sl.join([body, hem, collar] + sleeves, "tee")
    sl.shade_smooth(obj)

    def col(p, n):
        c = shade(TEE, TEE_SHADE, n, p, amount=0.5)
        # soft printed shard emblem on chest (light pink/yellow), echoes the game logo
        q = Vector((p.x, 0, p.z - 1.24))
        if p.y < -0.06 and q.length < 0.045:
            c = sl.mix(c, "#FFD6E2", 0.5)
            if abs(p.x) < 0.012 + 0.2 * (1.24 + 0.04 - p.z) * 0.2:
                c = sl.mix(c, "#FFB86B", 0.35)
        return c
    paint_fn(obj, col)
    add(obj, ["spine", "chest", "neck", "shoulder.L", "upper_arm.L", "shoulder.R", "upper_arm.R"])


def build_pants():
    legs = []
    for side, sx in (("L", 1), ("R", -1)):
        th = BONE_MAP[f"thigh.{side}"]
        sh = BONE_MAP[f"shin.{side}"]
        top = Vector((0.075 * sx, 0.0, 0.93))
        knee = Vector(th[2])
        ankle = Vector(sh[2]) + Vector((0.0, 0.0, 0.07))
        pts = [top, top * 0.5 + knee * 0.5, knee, knee * 0.5 + ankle * 0.5, ankle]
        # wide baggy cargo: wider at knee and above cuff
        leg = tube(f"leg{side}", [p[:] for p in pts], [0.095, 0.092, 0.088, 0.096, 0.1], 18)
        sl.displace_noise(leg, 0.006, 0.05, seed=3 if sx > 0 else 4)   # cloth folds
        # rolled cuff: thick ring
        cuff = tube(f"cuff{side}", [(ankle + Vector((0, 0, -0.02)))[:], (ankle + Vector((0, 0, 0.06)))[:]], [0.112, 0.11], 18)
        # cargo pocket on the outer thigh with flap
        pk_c = Vector((0.18 * sx, -0.005, 0.66))
        pocket = sl.rounded_box(f"pocket{side}", (0.03, 0.12, 0.15), 0.012)
        pocket.location = pk_c
        sl.apply_transforms_and_location(pocket)
        flap = sl.rounded_box(f"flap{side}", (0.034, 0.125, 0.04), 0.01)
        flap.location = pk_c + Vector((0.002 * sx, 0, 0.07))
        sl.apply_transforms_and_location(flap)
        legs += [leg, cuff, pocket, flap]
    # waist/hip block bridging the legs (with waistband)
    hip = lathe("hip", [(0.0, 0.86), (0.1, 0.862), (0.148, 0.885), (0.156, 0.925), (0.135, 0.965), (0.13, 0.985)], 26,
                scale_xy=(1.0, 0.66), cap_bottom=True, cap_top=False)
    band = lathe("band", [(0.128, 0.955), (0.136, 0.97), (0.131, 0.99)], 26, scale_xy=(1.0, 0.72), cap_bottom=False, cap_top=False)
    obj = sl.join(legs + [hip, band], "pants")
    sl.shade_smooth(obj)

    def col(p, n):
        c = shade(PANTS, PANTS_SHADE, n, p, amount=0.55)
        # seam lines / darker folds by noise
        f = noise.noise(p * 18.0)
        c = sl.mix(c, PANTS_SEAM, max(0.0, f) * 0.35)
        if p.z > 0.95:
            c = sl.mix(c, PANTS_SEAM, 0.4)
        return c
    paint_fn(obj, col)
    add(obj, ["hips", "spine", "thigh.L", "shin.L", "thigh.R", "shin.R"])


def build_shoes():
    shoes = []
    for side, sx in (("L", 1), ("R", -1)):
        ft = BONE_MAP[f"foot.{side}"]
        base = Vector((ft[1][0], 0.0, 0.0))
        # chunky sole: rounded slab, toe spring
        sole = sl.rounded_box(f"sole{side}", (0.124, 0.3, 0.058), 0.024, 3)
        sole.location = base + Vector((0, -0.045, 0.025))
        sl.apply_transforms_and_location(sole)
        for v in sole.data.vertices:
            if v.co.y < base.y - 0.13:
                v.co.z += (base.y - 0.13 - v.co.y) * 0.35   # toe spring
        # upper: rounded volume
        upper = ellipsoid(f"upper{side}", base + Vector((0, -0.05, 0.1)), (0.064, 0.152, 0.082), 22, 12,
                          deform=lambda p: Vector((p.x, p.y, max(p.z, -0.55) + (0.25 * p.y if p.y > 0 else 0))))
        # collar (padded ankle opening)
        collar = tube(f"collar{side}", [(base + Vector((0, 0.04, 0.1)))[:], (base + Vector((0, 0.045, 0.14)))[:]], [0.055, 0.052], 16)
        tongue = sl.rounded_box(f"tongue{side}", (0.05, 0.03, 0.07), 0.012)
        tongue.location = base + Vector((0, -0.02, 0.145))
        tongue.rotation_euler = (math.radians(-25), 0, 0)
        sl.apply_transforms_and_location(tongue)
        laces = []
        for i in range(4):
            y = -0.10 + i * 0.03
            lc = tube(f"lace{side}{i}", [(base + Vector((-0.03, y, 0.128 + i * 0.008)))[:],
                                          (base + Vector((0.03, y, 0.128 + i * 0.008)))[:]], [0.006, 0.006], 6)
            laces.append(lc)
        # side accent swoosh (an original stylised shard mark, not a brand logo)
        accent = tube(f"accent{side}", [(base + Vector((0.056 * sx, -0.10, 0.06)))[:], (base + Vector((0.058 * sx, -0.03, 0.095)))[:],
                                         (base + Vector((0.056 * sx, 0.04, 0.07)))[:]], [0.006, 0.014, 0.004], 6)
        s = sl.join([sole, upper, collar, tongue, accent] + laces, f"shoe{side}")
        sl.shade_smooth(s)

        def col(p, n, bx=base.x):
            if p.z < 0.052:
                stripe = 0.022 < p.z < 0.032
                return SHOE_SOLE_STRIPE if stripe else shade(SHOE_SOLE, "#CDBBA6", n, p)
            if abs(abs(p.x - bx) - 0.057) < 0.006 and 0.055 < p.z < 0.1:
                return SHOE_ACCENT
            if p.z > 0.12 and abs(p.x - bx) < 0.034 and p.y < base.y - 0.0:
                return SHOE_LACE
            if p.y > base.y + 0.03 and p.z > 0.09:
                return shade("#E08A7A", SHOE_ACCENT, n, p)     # heel collar
            return shade(SHOE_UPPER, "#C69C8C", n, p)
        paint_fn(s, col)
        shoes.append((s, [f"foot.{side}"]))
    for s, b in shoes:
        add(s, b)


def build_cap():
    # dome
    dome = lathe("cap_dome", [(0.134, 1.562), (0.134, 1.59), (0.124, 1.635), (0.098, 1.672), (0.055, 1.69), (0.0, 1.695)],
                 32, center=(0, 0.006, 0), scale_xy=(1.0, 1.06), cap_bottom=False)
    band = lathe("cap_band", [(0.136, 1.556), (0.139, 1.566), (0.136, 1.576)], 32, center=(0, 0.006, 0), scale_xy=(1.0, 1.06),
                 cap_bottom=False, cap_top=False)
    # panel seams via slightly darker color painted later; button
    button = ellipsoid("cap_button", (0, 0.004, 1.698), (0.012, 0.012, 0.007), 10, 6)
    # brim: curved flattened shape out the front (-Y), slightly tilted down
    bm = bmesh.new()
    rows, cols = 6, 14
    grid = []
    for i in range(rows + 1):
        t = i / rows
        row = []
        for j in range(cols + 1):
            u = j / cols * 2 - 1
            w = 0.125 * (1.0 - 0.45 * t * t) * math.cos(u * math.pi / 2) ** 0.35
            x = u * w
            y = -0.118 - t * 0.1
            z = 1.568 - t * 0.03 - (u * u) * 0.022
            row.append(bm.verts.new((x, y, z)))
        grid.append(row)
    for i in range(rows):
        for j in range(cols):
            bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
    brim = sl.bm_to_object(bm, "cap_brim")
    m = brim.modifiers.new("solid", "SOLIDIFY")
    m.thickness = 0.012
    sl.apply_modifiers(brim)
    # back strap + opening
    strap = tube("cap_strap", [(-0.06, 0.13, 1.585), (0, 0.14, 1.58), (0.06, 0.13, 1.585)], [0.007, 0.008, 0.007], 8)
    obj = sl.join([dome, band, button, brim, strap], "cap")
    sl.shade_smooth(obj)

    def col(p, n):
        if p.y < -0.12:
            # brim: underside vs top decided by height relative to the brim mid-surface
            t = min(1.0, (-0.118 - p.y) / 0.1)
            u = abs(p.x) / 0.125
            zmid = 1.568 - t * 0.03 - (u * u) * 0.022
            return CAP_BRIM_UNDER if p.z < zmid else shade(CAP, CAP_SHADE, n, p)
        c = shade(CAP, CAP_SHADE, n, p, amount=0.5)
        # panel seams: 6 radial lines on the dome
        a = math.atan2(p.y, p.x)
        if p.z > 1.6 and abs(math.sin(a * 3)) < 0.06:
            c = sl.mix(c, CAP_SHADE, 0.6)
        # light top highlight (painterly)
        if p.z > 1.665 and p.x > -0.02:
            c = sl.mix(c, "#B9BFFF", 0.35)
        return c
    paint_fn(obj, col)
    add(obj, ["head"])


def build_hair():
    """Chunky painterly bob (reference): a sculpted shell from crown to jaw line, opened at the face, with strand
    grooves, a notched/flicked hem, and a few loose clumps + side-swept bangs. Red roots → orange → yellow tips."""
    cx, cy = 0.0, 0.01
    prof = [(0.0, 1.668), (0.05, 1.664), (0.088, 1.648), (0.112, 1.618), (0.124, 1.58), (0.128, 1.54), (0.131, 1.50),
            (0.136, 1.465), (0.146, 1.435), (0.156, 1.415)]
    segs = 48
    bm = bmesh.new()
    rings = []
    for ri, (r, z) in enumerate(prof):
        ring = []
        for k in range(segs):
            a = 2 * math.pi * k / segs
            d = Vector((math.cos(a), math.sin(a), 0))
            rr = r
            # strand grooves (stronger toward the hem)
            g = (ri / (len(prof) - 1)) ** 1.5
            rr += math.sin(a * 16 + math.sin(a * 5) * 1.5) * 0.005 * g
            # longer at the back, slightly shorter at the sides near the face
            zz = z
            if ri == len(prof) - 1:
                notch = 0.022 * (0.5 + 0.5 * math.sin(a * 9 + 0.7)) + 0.012 * (0.5 + 0.5 * math.sin(a * 23))
                zz = z - notch + (0.02 if d.y > 0.2 else 0.0)
                rr += 0.012 * (0.5 + 0.5 * math.sin(a * 9 + 0.7))   # flick outward
            # her left side carries a little more volume (as in the back reference)
            if d.x > 0:
                rr *= 1.0 + 0.04 * d.x * g
            ring.append(bm.verts.new((cx + d.x * rr, cy + d.y * rr * 1.06, zz)))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(segs):
            a = 2 * math.pi * (k + 0.5) / segs
            dy = math.sin(a)
            dx = math.cos(a)
            zmid = (prof[i][1] + prof[i + 1][1]) / 2
            # open the face: front sector below the hairline
            if dy < -0.62 and zmid < 1.585:
                continue
            if dy < -0.45 and abs(dx) < 0.75 and zmid < 1.555:
                continue
            bm.faces.new((rings[i][k], rings[i][(k + 1) % segs], rings[i + 1][(k + 1) % segs], rings[i + 1][k]))
    bm.faces.new(list(reversed(rings[0]))) if prof[0][0] > 0 else None
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    shell = sl.bm_to_object(bm, "hair_shell")
    m = shell.modifiers.new("solid", "SOLIDIFY")
    m.thickness = 0.014
    m.offset = -1
    sl.apply_modifiers(shell)
    objs = [shell]
    # loose clumps on top of the shell for painterly breakup
    for i in range(14):
        a = rng.uniform(-0.2, math.pi + 0.2) + (math.pi if i % 2 else 0)
        d = Vector((math.cos(a), math.sin(a), 0))
        if d.y < -0.5:
            continue
        root = Vector((cx, cy, 1.6)) + d * 0.11
        tip = Vector((cx, cy, 1.42 + rng.uniform(-0.01, 0.02))) + d * (0.16 + rng.uniform(0, 0.015))
        pts = sl.curve_path(root[:], tip[:], (d * 0.03)[:], steps=6)
        w = 0.022 + rng.uniform(0, 0.008)
        cl = tube(f"clump{i}", pts, [w * 0.6, w, w * 1.1, w * 1.1, w, w * 0.8, w * 0.45], sides=8)
        # flatten tangentially (ribbon-like strokes)
        for v in cl.data.vertices:
            rel = Vector((v.co.x - cx, v.co.y - cy, 0))
            if rel.length > 1e-5:
                radial = rel.normalized()
                tang = Vector((-radial.y, radial.x, 0))
                off = rel.dot(tang)
                v.co -= Vector((0, 0, 0))
        objs.append(cl)
    # side-swept bangs under the brim
    for i in range(6):
        u = i / 5.0
        root = Vector((-0.075 + u * 0.13, -0.105, 1.585))
        tip = Vector((-0.06 + u * 0.12 + 0.03, -0.118, 1.545 - 0.012 * math.sin(u * math.pi)))
        pts = sl.curve_path(root[:], tip[:], (0.0, -0.01, 0.004), steps=5)
        objs.append(tube(f"bang{i}", pts, [0.016, 0.019, 0.018, 0.015, 0.01, 0.004], sides=7))
    # locks framing the face in front of the ears
    for sx in (1, -1):
        root = Vector((0.09 * sx, -0.07, 1.585))
        tip = Vector((0.112 * sx, -0.085, 1.43))
        pts = sl.curve_path(root[:], tip[:], (0.022 * sx, -0.012, 0.0), steps=6)
        objs.append(tube(f"lock{sx}", pts, [0.018, 0.024, 0.026, 0.024, 0.02, 0.014, 0.006], sides=8))
    obj = sl.join(objs, "hair")
    sl.shade_smooth(obj)
    zmin, zmax = 1.41, 1.665

    def col(p, n):
        t = (zmax - p.z) / (zmax - zmin)
        t = max(0.0, min(1.0, t))
        side_bias = 0.12 if p.x > 0 else -0.04
        t2 = max(0.0, min(1.0, t * 1.1 + side_bias))
        if t2 < 0.45:
            c = sl.mix(HAIR_ROOT, HAIR_MID, t2 / 0.45)
        else:
            c = sl.mix(HAIR_MID, HAIR_TIP, (t2 - 0.45) / 0.55)
        # strand streaks
        streak = math.sin(math.atan2(p.y - cy, p.x - cx) * 16 + p.z * 30)
        c = sl.mix(c, "#FFE7A0" if t2 > 0.5 else "#FF8A4A", max(0.0, streak) * 0.18)
        if n.z < -0.3:
            c = sl.mix(c, "#9C1E3A", 0.3)
        return c
    paint_fn(obj, col)
    add(obj, ["head"])


def build_bag():
    # crossbody: strap from right shoulder across chest to the pouch at her left hip
    a = Vector((-0.12, -0.055, 1.33))
    b = Vector((0.0, -0.1, 1.17))
    c = Vector((0.13, -0.08, 0.98))
    strap = tube("strap", [a[:], ((a + b) / 2 + Vector((0, -0.012, 0)))[:], b[:], ((b + c) / 2 + Vector((0, -0.01, 0)))[:], c[:]],
                 [0.009, 0.009, 0.009, 0.009, 0.009], 6)
    for v in strap.data.vertices:
        v.co.y -= 0.0
    # strap over the back too (shoulder → back → hip)
    back = tube("strap_back", [a[:], (-0.08, 0.06, 1.3), (0.06, 0.09, 1.12), (0.15, 0.03, 0.98)], [0.009] * 4, 6)
    pouch = sl.rounded_box("pouch", (0.05, 0.12, 0.1), 0.02, 3)
    pouch.location = (0.16, -0.03, 0.93)
    pouch.rotation_euler = (0, 0, math.radians(15))
    sl.apply_transforms_and_location(pouch)
    flap = sl.rounded_box("pouch_flap", (0.054, 0.124, 0.05), 0.015)
    flap.location = (0.163, -0.032, 0.96)
    flap.rotation_euler = (0, 0, math.radians(15))
    sl.apply_transforms_and_location(flap)
    buckle = sl.rounded_box("buckle", (0.012, 0.03, 0.02), 0.004)
    buckle.location = (0.19, -0.04, 0.94)
    sl.apply_transforms_and_location(buckle)
    obj = sl.join([strap, back, pouch, flap, buckle], "bag")
    sl.shade_smooth(obj)

    def col(p, n):
        if p.x > 0.18 and 0.925 < p.z < 0.955 and -0.06 < p.y < -0.02:
            return BUCKLE
        if p.z > 1.0 or (p.x < 0.12):
            return shade(STRAP, "#241818", n, p)
        if p.z > 0.94:
            return shade(BAG_DARK, "#4A2A1C", n, p)
        return shade(BAG, BAG_DARK, n, p)
    paint_fn(obj, col)
    add(obj, ["chest", "spine", "hips"])


# ------------------------------------------------------------------ rig + weights
def build_armature():
    arm_data = bpy.data.armatures.new("rae_rig")
    arm = bpy.data.objects.new("rae_rig", arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    eb = {}
    for name, h, t, parent in BONES:
        b = arm_data.edit_bones.new(name)
        b.head = h
        b.tail = t
        b.roll = 0.0
        if parent:
            b.parent = eb[parent]
            if (Vector(eb[parent].tail) - Vector(h)).length < 1e-3:
                b.use_connect = True
        eb[name] = b
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


def weight_part(obj, allowed, falloff=4.0):
    groups = {name: obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name) for name in allowed}
    for v in obj.data.vertices:
        p = v.co
        ws = []
        for name in allowed:
            _, h, t, _ = BONE_MAP[name]
            d = seg_dist(p, h, t)
            ws.append((1.0 / (d ** falloff + 1e-7), name))
        ws.sort(reverse=True)
        top = ws[:2]
        # sharpen second influence so joints blend only near the joint
        tot = sum(w for w, _ in top)
        for w, name in top:
            groups[name].add([v.index], w / tot, "REPLACE")


# ------------------------------------------------------------------ animation
def key_pose(arm, frame, rots, loc=None):
    """rots: {bone: (x_deg, y_deg, z_deg)} local euler applied as quaternion."""
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
        e = rots.get(pb.name, (0, 0, 0))
        pb.rotation_quaternion = Euler(tuple(math.radians(a) for a in e), "XYZ").to_quaternion()
        pb.keyframe_insert("rotation_quaternion", frame=frame)
        if pb.name == "root":
            pb.location = loc or (0, 0, 0)
            pb.keyframe_insert("location", frame=frame)


def new_action(arm, name):
    act = bpy.data.actions.new(name)
    arm.animation_data_create()
    arm.animation_data.action = act
    return act


def finish_action(arm, act, cyclic=True):
    try:
        fcurves = act.fcurves
    except AttributeError:
        fcurves = []
    for fc in fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
        if cyclic:
            fc.modifiers.new("CYCLES")
    track = arm.animation_data.nla_tracks.new()
    track.name = act.name
    strip = track.strips.new(act.name, int(act.frame_range[0]), act)
    track.mute = True
    arm.animation_data.action = None


# Bone local axes: bones point along +Y (bone direction). For vertical bones (spine) X-rotation bends forward/back.
# Arms hang down: rotating upper_arm around its local X swings it forward/back.

def anim_idle(arm):
    act = new_action(arm, "idle")
    for f in range(0, 61, 10):
        t = f / 60 * 2 * math.pi
        br = math.sin(t)
        key_pose(arm, f, {
            "spine": (1.5 * br, 0, 0), "chest": (1.5 * br, 0, 0.6 * math.sin(t * 0.5)),
            "neck": (-1.0 * br, 0, 0), "head": (-1.5 * br, 2.5 * math.sin(t * 0.5), 1.0 * math.sin(t * 0.5)),
            "shoulder.L": (0, 0, -1.2 * br), "shoulder.R": (0, 0, 1.2 * br),
            "upper_arm.L": (3 * br, 0, 2), "upper_arm.R": (3 * br, 0, -2),
            "forearm.L": (-6 - 2 * br, 0, 0), "forearm.R": (-6 - 2 * br, 0, 0),
            "hips": (0, 0, 1.2 * math.sin(t * 0.5)),
        }, loc=(0.004 * math.sin(t * 0.5), 0, -0.004 * (br * 0.5 + 0.5)))
    finish_action(arm, act)


def gait(arm, name, frames, stride_deg, arm_swing, bounce, lean, knee_bend):
    act = new_action(arm, name)
    steps = 8
    for i in range(steps + 1):
        f = int(round(frames * i / steps))
        ph = i / steps * 2 * math.pi
        s = math.sin(ph)
        c = math.cos(ph)
        legL = stride_deg * s
        legR = -stride_deg * s
        kneeL = knee_bend * max(0.0, math.sin(ph + math.pi / 2)) + 6
        kneeR = knee_bend * max(0.0, math.sin(ph - math.pi / 2)) + 6
        key_pose(arm, f, {
            "hips": (0, 0, 6 * s), "spine": (lean, 0, -3 * s), "chest": (lean * 0.4, 0, -6 * s),
            "neck": (-lean * 0.6, 0, 2 * s), "head": (-lean * 0.4, 0, 3 * s),
            "thigh.L": (-legL, 0, 0), "thigh.R": (-legR, 0, 0),
            "shin.L": (kneeL, 0, 0), "shin.R": (kneeR, 0, 0),
            "foot.L": (-kneeL * 0.35 + legL * 0.3, 0, 0), "foot.R": (-kneeR * 0.35 + legR * 0.3, 0, 0),
            "upper_arm.L": (arm_swing * s, 0, 3), "upper_arm.R": (-arm_swing * s, 0, -3),
            "forearm.L": (-12 - arm_swing * 0.4 * max(0, s), 0, 0), "forearm.R": (-12 - arm_swing * 0.4 * max(0, -s), 0, 0),
        }, loc=(0, 0, bounce * abs(c) - bounce * 0.5))
    finish_action(arm, act)


def anim_wave(arm):
    act = new_action(arm, "wave")
    for i, f in enumerate(range(0, 49, 6)):
        w = math.sin(i * 1.6) * 18
        key_pose(arm, f, {
            "upper_arm.R": (-20, 0, -150), "forearm.R": (-10, w, -25), "hand.R": (0, 0, w * 0.6),
            "chest": (0, -6, 2), "head": (-4, -8, 6), "upper_arm.L": (2, 0, 3), "forearm.L": (-8, 0, 0),
        })
    finish_action(arm, act)


def anim_talk(arm):
    act = new_action(arm, "talk")
    for i, f in enumerate(range(0, 73, 12)):
        g = math.sin(i * 1.3)
        key_pose(arm, f, {
            "head": (-3 + 4 * g, 6 * math.sin(i * 0.9), 3 * g), "neck": (2 * g, 0, 0), "chest": (1.5 * g, 3 * g, 0),
            "upper_arm.L": (-15 - 8 * g, 0, 8), "forearm.L": (-55 - 10 * g, -10, 0), "hand.L": (0, 20 * g, 0),
            "upper_arm.R": (2, 0, -3), "forearm.R": (-8, 0, 0),
        })
    finish_action(arm, act)


def anim_look_around(arm):
    act = new_action(arm, "look_around")
    keys = [(0, 0, 0), (20, 0, 28), (40, -6, 30), (60, 0, -30), (80, 4, -28), (100, 0, 0)]
    for f, px, yw in keys:
        key_pose(arm, f, {"head": (px, yw, 0), "neck": (0, yw * 0.3, 0), "chest": (0, yw * 0.15, 0),
                          "upper_arm.L": (2, 0, 3), "upper_arm.R": (2, 0, -3), "forearm.L": (-8, 0, 0), "forearm.R": (-8, 0, 0)})
    finish_action(arm, act)


def anim_menu_pose(arm):
    # confident three-quarter stance from the reference: weight on one leg, hands relaxed in loose fists
    act = new_action(arm, "menu_pose")
    for f in (0, 40, 80):
        b = math.sin(f / 80 * 2 * math.pi)
        key_pose(arm, f, {
            "hips": (0, 0, 4), "spine": (1 * b, 0, -3), "chest": (1 * b, 4, -2), "head": (-2, -10, 4 + b),
            "thigh.L": (-6, 0, -3), "shin.L": (8, 0, 0), "thigh.R": (4, 0, 5), "shin.R": (4, 0, 0),
            "upper_arm.L": (4, 0, 6), "forearm.L": (-14, 0, 0), "upper_arm.R": (-2, 0, -8), "forearm.R": (-10, 0, 0),
        }, loc=(0.01, 0, 0))
    finish_action(arm, act)


# ------------------------------------------------------------------ main
def main():
    sl.reset()
    build_head()
    build_face_details()
    build_neck_torso_arms()
    build_tee()
    build_pants()
    build_shoes()
    build_cap()
    build_hair()
    build_bag()
    # stylized head proportion: scale head-related parts around the neck pivot
    pivot = Vector((0, 0, 1.44))
    head_parts = [o for o, _ in parts if o.name in ("skin_head", "face_details", "cap", "hair")]
    for o in head_parts:
        for v in o.data.vertices:
            v.co = pivot + (v.co - pivot) * 1.1
    # face close-up
    sl.preview(head_parts, "rae_face", PACK, size=640, bg="#E9E4EE", elev=4, azim=-18, frame=0.62)
    sl.preview(head_parts, "rae_face_front", PACK, size=640, bg="#E9E4EE", elev=2, azim=0, frame=0.62)
    arm = build_armature()
    meshes = []
    for obj, allowed in parts:
        sl.apply_transforms(obj)
        weight_part(obj, allowed)
        meshes.append(obj)
    body = sl.join(meshes, "rae_body")
    # all parts already use material "VC"; make sure only one slot remains
    body.data.materials.clear()
    body.data.materials.append(sl.get_material("VC"))
    for p in body.data.polygons:
        p.material_index = 0
    sl.bake_ao(body, strength=0.35)
    mod = body.modifiers.new("rig", "ARMATURE")
    mod.object = arm
    body.parent = arm
    print("RAE tris:", sl.tri_count(body))
    # previews (rest pose) — front, back, 3/4
    for tag, az in (("front", 0), ("back", 180), ("three_q", -35), ("side", 90)):
        sl.preview([body], f"rae_{tag}", PACK, size=768, bg="#E9E4EE", elev=6, azim=az, frame=1.05)
    # animations
    anim_idle(arm)
    gait(arm, "walk", 32, 24, 18, 0.025, 3, 34)
    gait(arm, "run", 20, 38, 40, 0.05, 10, 60)
    anim_wave(arm)
    anim_talk(arm)
    anim_look_around(arm)
    anim_menu_pose(arm)
    sl.export_glb_with_anims([arm, body], OUT_ID, PACK)
    # pose preview of the menu pose
    arm.animation_data.action = bpy.data.actions["menu_pose"]
    bpy.context.scene.frame_set(20)
    sl.preview([body], "rae_pose_menu", PACK, size=768, bg="#E9E4EE", elev=6, azim=-30, frame=1.05)
    arm.animation_data.action = bpy.data.actions["walk"]
    bpy.context.scene.frame_set(8)
    sl.preview([body], "rae_pose_walk", PACK, size=768, bg="#E9E4EE", elev=6, azim=-80, frame=1.05)
    arm.animation_data.action = None
    m = sl.Manifest(PACK)
    m.add("rae", body, "character", ["all"], {"type": "none"}, None,
          {"animations": ["idle", "walk", "run", "wave", "talk", "look_around", "menu_pose"], "rig": "rae_rig"})
    m.write()
    blend_dir = os.path.join(sl.ROOT, "art", "characters", "blend")
    os.makedirs(blend_dir, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(blend_dir, "rae.blend"))


main()
