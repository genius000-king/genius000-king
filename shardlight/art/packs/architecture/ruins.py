"""Meridian Institute ruins kit (4 m grid) + institute props + floating debris."""
import math
import bmesh
import bpy
from mathutils import Vector, Matrix, noise
from _kit import *  # noqa
from _kit import _recalc  # noqa

REGISTRY = {}
GRID = 4.0
WALL_H = 4.0
WALL_T = 0.5
FLOOR_T = 0.3

DIRTY_W = G("#B7BCD6", "#F1F2FA")       # white panel, dirtier at the bottom
DIRTY_W2 = G("#A9AECB", "#E3E6F4")
CONCRETE = "#9CA2C4"
REBAR = "#A8624A"


def reg(aid):
    def deco(fn):
        REGISTRY[aid] = fn
        return fn
    return deco


def kit_extra(footprint, pivot, note=""):
    return {"kit": {"grid_m": GRID, "footprint_m": footprint, "pivot": pivot, "floor_top_z": FLOOR_T,
                    "wall_height_m": WALL_H, "facing": "front = Blender -Y (Godot +Z)", "note": note}}


def wall_poly(b, pts, t, **kw):
    """Polygon given in (x, z) wall-plane coords, thickness t centered on y=0."""
    return b.add(prim_poly(pts, t, 0.07, 1, False), rot=(90, 0, 0), **kw)


def two_tone(face_col, edge_col=CONCRETE):
    def fn(p, n):
        if abs(n.y) > 0.7:
            return face_col(p, n) if callable(face_col) else face_col
        return edge_col
    fn.per_face = True
    return fn


def plinth(b, w=4.0, h=0.55, t=0.64, x=0.0):
    b.box((w, t, h), loc=(x, 0, 0), r=0.1, base=True, color=G("#767DA3", "#98A0C2"))


def wall_panels(b, h0=0.55, h1=3.62, front_lines=True, w=4.0):
    ph = h1 - h0
    for sx in (-1, 1):
        b.box((w / 2 - 0.08, 0.46, ph), loc=(sx * (w / 4), 0, h0), r=0.14, base=True,
              color=G("#BDC2DB", "#F3F4FB", lo=h0, hi=h1))
    b.box((0.18, 0.4, ph + 0.1), loc=(0, 0, h0 - 0.05), r=0.04, base=True, color="#6A7099")


def trims(b, w=4.0, cap=True, orange=True, light=True):
    if cap:
        b.box((w, 0.62, 0.38), loc=(0, 0, WALL_H - 0.38), r=0.14, base=True, color=G("#D5D9EC", "#F5F6FC"))
    if orange:
        b.box((w - 0.04, 0.54, 0.12), loc=(0, 0, WALL_H - 0.52), r=0.04, base=True, color=C["orange"], jit=0.4)
        b.box((w - 0.04, 0.52, 0.16), loc=(0, 0, 1.15), r=0.05, base=True, color=C["orange"], jit=0.4)
    if light:
        for sy in (-1, 1):
            b.box((2.6, 0.03, 0.07), loc=(0, sy * 0.235, 2.75), r=0.0, base=True, color="#B691FF", mat="EMIT", nz=0)


# =============================================================================================== walls
@reg("hub_ruin_wall_straight")
def wall_straight(man):
    b = Build("hub_ruin_wall_straight")
    plinth(b)
    wall_panels(b)
    trims(b)
    # a few chips/ scuffs: small dark patches via slightly inset boxes
    b.box((0.5, 0.5, 0.04), loc=(-1.3, 0, 0.55), r=0.0, base=True, color="#7D83A8", nz=0.0)
    obj = b.to_object("hub_ruin_wall_straight")
    return finish(man, "hub_ruin_wall_straight", obj, category="ruin_piece", worlds=["hub"], collision="trimesh",
                  ao=0.45, extra=kit_extra([4.0, 0.64, 4.0], "bottom-center of the wall; wall runs along local X, thickness along Y"),
                  views=[("side", dict(azim=60, elev=15))])


@reg("hub_ruin_wall_broken")
def wall_broken(man):
    b = Build("hub_ruin_wall_broken")
    plinth(b)
    top = [(-1.95, 0.5), (1.95, 0.5), (1.95, 1.45), (1.6, 1.95), (1.3, 1.65), (0.95, 2.45), (0.5, 2.05), (0.15, 2.9),
           (-0.3, 2.6), (-0.7, 3.4), (-1.1, 3.1), (-1.95, 3.62)]
    gcol = two_tone(FaceG("#BDC2DB", "#F3F4FB", 0.5, 3.6))
    wall_poly(b, top, 0.46, color=gcol, jit=0.6)
    # mid orange band, only where wall survives (clipped)
    b.box((1.2, 0.52, 0.16), loc=(-1.35, 0, 1.15), r=0.05, base=True, color=C["orange"], jit=0.4)
    b.box((1.3, 0.52, 0.16), loc=(1.3, 0, 1.15), r=0.05, base=True, color=C["orange"], jit=0.4)
    # top cap only on the intact left end
    b.box((1.0, 0.62, 0.38), loc=(-1.5, 0, 3.52 - 0.0), r=0.14, base=True, color=G("#D5D9EC", "#F5F6FC"), rot=(0, 0, 0))
    b.box((0.8, 0.54, 0.12), loc=(-1.55, 0, 3.3), r=0.04, base=True, color=C["orange"], jit=0.4)
    # exposed steel column bent at the break + rebar
    b.beam((-0.85, 0, 0.5), (-0.8, 0, 3.55), 0.2, 0.36, r=0.04, color="#6A7099")
    b.beam((-0.8, 0, 3.55), (-0.45, 0, 4.05), 0.2, 0.36, r=0.04, color="#6A7099")
    rng = b.rng
    for x, z in ((1.7, 1.7), (1.0, 2.2), (0.3, 2.6), (-0.1, 2.8), (1.4, 1.75)):
        b.rod((x, rng.uniform(-0.12, 0.12), z - 0.25), (x + rng.uniform(-0.15, 0.2), rng.uniform(-0.1, 0.1), z + rng.uniform(0.5, 0.95)),
              0.03, n=5, color=REBAR, nz=0, jit=0.5)
    b.box((0.04, 0.54, 0.7), loc=(1.1, 0, 0.6), r=0.0, base=True, color="#7D83A8", rot=(0, 0, 12), nz=0)  # crack
    # fallen rubble at the foot
    for i, (x, y, s) in enumerate(((1.4, -0.65, 0.3), (0.5, -0.8, 0.22), (-0.2, 0.7, 0.26), (1.7, 0.6, 0.2))):
        b.box((s * 1.4, s, s * 0.8), loc=(x, y, 0), r=0.07, base=True, rot=(rng.uniform(-10, 10), rng.uniform(-10, 10), rng.uniform(0, 180)),
              color=G("#A9AECB", "#E3E6F4"))
    obj = b.to_object("hub_ruin_wall_broken")
    return finish(man, "hub_ruin_wall_broken", obj, category="ruin_piece", worlds=["hub"], collision="trimesh",
                  ao=0.45, extra=kit_extra([4.0, 1.9, 4.0], "same cell as hub_ruin_wall_straight; rubble extends +-0.9 m in Y"),
                  views=[("side", dict(azim=50, elev=15))])


@reg("hub_ruin_wall_window")
def wall_window(man):
    b = Build("hub_ruin_wall_window")
    plinth(b)
    slab = prim_slab_hole(4.0 - 0.0, 3.1, 0.46, 0.0, 1.65, 0.95, nseg=24, r=0.06)
    b.add(slab, loc=(0, 0, 0.55), color=G("#BDC2DB", "#F3F4FB", lo=0.55, hi=3.65), jit=0.8)
    trims(b, light=False)
    cz = 0.55 + 1.65
    # rim ring + glass + mullion
    b.add(prim_ring(0.98, rrect(0.2, 0.6, 0.08, 2), segs=28), loc=(0, 0, cz), rot=(90, 0, 0), color=C["steel"])
    b.add(prim_ring(1.07, [(-0.06, 0.3), (0.06, 0.3), (0.06, 0.2), (-0.06, 0.2)], segs=28), loc=(0, 0, cz), rot=(90, 0, 0), color=C["orange"], jit=0.3)
    b.add(prim_ring(1.07, [(-0.06, -0.2), (0.06, -0.2), (0.06, -0.3), (-0.06, -0.3)], segs=28), loc=(0, 0, cz), rot=(90, 0, 0), color=C["orange"], jit=0.3)
    b.add(prim_cyl(0.92, 0.92, 0.05, 28, 0.0, 1), loc=(0, 0, cz), rot=(90, 0, 0), color=G("#9FB8FF", "#D8CCFF", lo=cz - 0.9, hi=cz + 0.9), mat="GLASS", nz=0)
    b.box((0.1, 0.12, 1.9), loc=(0, 0, cz), r=0.02, color=C["steel"])
    b.box((1.9, 0.12, 0.1), loc=(0, 0, cz), r=0.02, color=C["steel"])
    for sy in (-1, 1):
        b.box((2.6, 0.03, 0.07), loc=(0, sy * 0.235, 3.05), r=0.0, base=True, color="#B691FF", mat="EMIT", nz=0)
    obj = b.to_object("hub_ruin_wall_window")
    return finish(man, "hub_ruin_wall_window", obj, category="ruin_piece", worlds=["hub"], collision="trimesh",
                  ao=0.45, extra=kit_extra([4.0, 0.64, 4.0], "bottom-center; round window (r 0.95) centered at z=2.2, GLASS slot"),
                  views=[("side", dict(azim=45, elev=12))])


@reg("hub_ruin_wall_curved")
def wall_curved(man):
    b = Build("hub_ruin_wall_curved")
    R = 6.0
    half = math.asin(2.0 / R)
    sag = R - math.sqrt(R * R - 4.0)

    # centerline y(x) = -(sqrt(R^2-x^2) - R cos(half)) + ... keep ends at y=0, mid at y=-sag (bulge to front)
    def cl(rad_off, z, n=13):
        out = []
        for i in range(n):
            a = -half + 2 * half * i / (n - 1)
            x = (R + rad_off) * math.sin(a)
            y = -((R + rad_off) * math.cos(a) - R * math.cos(half))
            out.append(Vector((x, y, z)))
        return out
    # plinth (steel)
    b.add(prim_sweep(cl(0, 0.275), rrect(0.64, 0.55, 0.1, 2), up=Vector((0, 0, 1))), color="#8A91B6")
    # body
    gp = G("#BDC2DB", "#F3F4FB", lo=0.55, hi=3.62)
    b.add(prim_sweep(cl(0, 2.08), rrect(0.46, 3.07, 0.13, 3), up=Vector((0, 0, 1))), color=gp, jit=0.6)
    # cap + orange bands
    b.add(prim_sweep(cl(0, 3.81), rrect(0.62, 0.38, 0.14, 2), up=Vector((0, 0, 1))), color=G("#D5D9EC", "#F5F6FC"))
    b.add(prim_sweep(cl(0, 3.54), rrect(0.54, 0.12, 0.04, 1), up=Vector((0, 0, 1))), color=C["orange"], jit=0.4)
    b.add(prim_sweep(cl(0, 1.2), rrect(0.52, 0.16, 0.05, 1), up=Vector((0, 0, 1))), color=C["orange"], jit=0.4)
    # vertical rib every ~1 m
    for i in (3, 6, 9):
        a = -half + 2 * half * i / 12
        x = R * math.sin(a)
        y = -(R * math.cos(a) - R * math.cos(half))
        b.box((0.16, 0.56, 3.0), loc=(x, y, 0.55), rot=(0, 0, -math.degrees(a)), r=0.04, base=True, color="#6A7099")
    b.add(prim_sweep(cl(-0.235, 2.75), sp_rect(2.0), up=Vector((0, 0, 1))), color="#B691FF", mat="EMIT", nz=0)
    obj = b.to_object("hub_ruin_wall_curved")
    return finish(man, "hub_ruin_wall_curved", obj, category="ruin_piece", worlds=["hub"], collision="trimesh",
                  ao=0.45, extra=kit_extra([4.0, 0.7, 4.0], "bottom-center of the chord; arc radius 6 m, ends touch the 4 m cell edge, bulges toward -Y by 0.34 m"))


def sp_rect(w):
    return [(-0.015, 0.035), (0.015, 0.035), (0.015, -0.035), (-0.015, -0.035)]


@reg("hub_ruin_corner")
def corner(b_man):
    man = b_man
    b = Build("hub_ruin_corner")
    # two 4 m arms from the grid vertex along +X and +Y, wall centerline through the pivot
    for rotz, name in ((0, "x"), (90, "y")):
        M = Matrix.Rotation(math.radians(rotz), 4, "Z") @ Matrix.Translation((2.0, 0, 0))
        def addm(pbm, **kw):
            return b.add(pbm, matrix=M @ kw.pop("T", Matrix.Identity(4)), **kw)
        addm(prim_box(3.6, 0.64, 0.55, 0.1, 1, base=False), T=Matrix.Translation((-0.0, 0, 0.275)), color="#8A91B6")
        for sx in (-1, 1):
            addm(prim_box(1.74, 0.46, 3.07, 0.14, 2), T=Matrix.Translation((sx * 0.9, 0, 0.55 + 1.535)), color=G("#BDC2DB", "#F3F4FB", lo=0.55, hi=3.62))
        addm(prim_box(0.18, 0.4, 3.12, 0.04, 1), T=Matrix.Translation((0, 0, 0.55 + 1.5)), color="#6A7099")
        addm(prim_box(3.6, 0.62, 0.38, 0.14, 1), T=Matrix.Translation((0, 0, WALL_H - 0.19)), color=G("#D5D9EC", "#F5F6FC"))
        addm(prim_box(3.56, 0.54, 0.12, 0.04, 1), T=Matrix.Translation((0, 0, WALL_H - 0.46)), color=C["orange"], jit=0.4)
        addm(prim_box(3.56, 0.52, 0.16, 0.05, 1), T=Matrix.Translation((0, 0, 1.23)), color=C["orange"], jit=0.4)
        addm(prim_box(2.4, 0.03, 0.07, 0.0, 1), T=Matrix.Translation((0.2, -0.235, 2.8)), color="#B691FF", mat="EMIT", nz=0)
    # round corner tower post
    b.cyl(0.52, 4.3, loc=(0, 0, 0), n=20, r=0.1, base=True, color=G("#BDC2DB", "#F3F4FB"))
    b.cyl(0.6, 0.55, loc=(0, 0, 0), n=20, r=0.08, base=True, color="#8A91B6")
    b.cyl(0.58, 0.14, loc=(0, 0, 1.15), n=20, r=0.03, base=True, color=C["orange"], jit=0.4)
    b.cyl(0.58, 0.14, loc=(0, 0, 3.55), n=20, r=0.03, base=True, color=C["orange"], jit=0.4)
    b.cyl(0.6, 0.32, loc=(0, 0, 4.05), n=20, r=0.1, base=True, color="#D5D9EC")
    b.sphere(0.34, loc=(0, 0, 4.42), nu=14, nv=8, sq=(1, 1, 0.8), color="#B691FF", mat="EMIT", nz=0)
    obj = b.to_object("hub_ruin_corner")
    return finish(man, "hub_ruin_corner", obj, category="ruin_piece", worlds=["hub"], collision="trimesh", ao=0.45,
                  extra=kit_extra([4.3, 4.3, 4.3], "pivot = grid vertex (wall centerlines cross). Arms run 4 m along +X and +Y; replaces the two wall pieces meeting at that vertex"),
                  views=[("side", dict(azim=-120, elev=15))])


# =============================================================================================== floors
@reg("hub_ruin_floor_tile")
def floor_tile(man):
    b = Build("hub_ruin_floor_tile")
    b.box((4.0, 4.0, 0.22), loc=(0, 0, 0), r=0.06, base=True, color="#6E7499")
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box((1.9, 1.9, 0.12), loc=(sx * 1.0, sy * 1.0, 0.2), r=0.1, base=True, color=G("#D5D9EC", "#EEF0F8"), jit=1.2, top="#F6F7FC")
    # orange corner markers and violet inlay line
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box((0.16, 0.16, 0.03), loc=(sx * 1.85, sy * 1.85, 0.3), r=0.0, base=True, color=C["orange"], jit=0.4)
    b.box((3.0, 0.05, 0.02), loc=(0, 0, 0.32), r=0.0, base=True, color="#B691FF", mat="EMIT", nz=0)
    b.box((0.05, 3.0, 0.02), loc=(0, 0, 0.32), r=0.0, base=True, color="#B691FF", mat="EMIT", nz=0)
    obj = b.to_object("hub_ruin_floor_tile")
    return finish(man, "hub_ruin_floor_tile", obj, category="ruin_piece", worlds=["hub"], collision="box", ao=0.4,
                  extra=kit_extra([4.0, 4.0, 0.32], "bottom-center of the 4x4 cell; top surface at z=0.32"))


@reg("hub_ruin_floor_broken")
def floor_broken(man):
    b = Build("hub_ruin_floor_broken")
    rng = b.rng
    outline = [(-2.0, -2.0), (2.0, -2.0), (2.0, 0.9), (1.5, 1.25), (1.7, 1.9), (0.9, 1.55), (0.45, 2.0), (-0.2, 1.4),
               (-0.9, 1.7), (-1.15, 0.8), (-2.0, 0.65)]
    b.poly(outline, 0.22, r=0.05, color=two_tone(FaceG("#6E7499", "#8E95BA", 0, 0.22), "#7E84AA"), jit=0.5)
    # surviving pads (clipped by simple boxes), tilted slab, cracked
    b.box((1.9, 1.9, 0.12), loc=(-1.0, -1.0, 0.2), r=0.1, base=True, color=G("#D5D9EC", "#EEF0F8"), jit=1.2)
    b.box((1.9, 1.9, 0.12), loc=(1.0, -1.0, 0.2), r=0.1, base=True, color=G("#D5D9EC", "#EEF0F8"), jit=1.2)
    b.box((1.9, 1.0, 0.12), loc=(1.0, 0.3, 0.2), r=0.1, base=True, color=G("#D5D9EC", "#EEF0F8"), jit=1.2)
    b.box((1.2, 0.6, 0.12), loc=(-1.3, 0.2, 0.2), r=0.1, base=True, color=G("#D5D9EC", "#EEF0F8"), jit=1.2)
    b.box((1.3, 1.2, 0.12), loc=(0.55, 1.15, 0.38), rot=(10, -14, 18), r=0.08, base=True, color=G("#D5D9EC", "#EEF0F8"), jit=1.0)
    b.box((0.8, 0.7, 0.1), loc=(-0.5, 0.5, 0.24), rot=(-8, 12, -25), r=0.07, base=True, color=G("#D5D9EC", "#EEF0F8"), jit=1.0)
    b.box((0.05, 2.0, 0.02), loc=(-0.2, -0.9, 0.32), rot=(0, 0, 14), r=0.0, base=True, color="#6E7499", nz=0)
    # exposed pipes / rebar
    for (x, y) in ((0.2, 1.1), (-0.5, 1.15), (1.3, 1.55), (-0.1, 1.5)):
        b.rod((x, y, 0.1), (x + rng.uniform(-0.3, 0.3), y + rng.uniform(0.1, 0.5), 0.1 + rng.uniform(0.3, 0.8)), 0.035, n=5, color=REBAR, nz=0)
    b.add(prim_sweep(catmull([(0.8, 1.7, 0.1), (0.7, 2.1, 0.2), (0.5, 2.5, 0.12), (0.7, 2.9, 0.05)], 4), circle_prof(0.1, 7)), color="#58527F", nz=0.02)
    obj = b.to_object("hub_ruin_floor_broken")
    return finish(man, "hub_ruin_floor_broken", obj, category="ruin_piece", worlds=["hub"], collision="trimesh", ao=0.45,
                  extra=kit_extra([4.0, 4.0, 0.9], "bottom-center of the 4x4 cell; one corner crumbled, pipes protrude past the cell edge (+Y)"))


# =============================================================================================== pillars
def pillar_profile(h, r=0.5):
    return [(0, 0), (r + 0.22, 0), (r + 0.22, 0.08), (r + 0.14, 0.2), (r + 0.14, 0.55), (r + 0.04, 0.62), (r, 0.7),
            (r, h - 0.7), (r + 0.04, h - 0.62), (r + 0.14, h - 0.55), (r + 0.14, h - 0.2), (r + 0.22, h - 0.08), (r + 0.22, h), (0, h)]


@reg("hub_ruin_pillar")
def pillar(man):
    b = Build("hub_ruin_pillar")
    b.lathe(pillar_profile(4.0), n=20, color=G("#B2B7D3", "#F3F4FB"), jit=0.6)
    # base steel + orange bands + vertical violet light strip
    b.cyl(0.78, 0.2, loc=(0, 0, 0), n=20, r=0.05, base=True, color="#8A91B6")
    b.cyl(0.54, 0.16, loc=(0, 0, 1.1), n=20, r=0.03, base=True, color=C["orange"], jit=0.4)
    b.cyl(0.54, 0.16, loc=(0, 0, 3.2), n=20, r=0.03, base=True, color=C["orange"], jit=0.4)
    b.box((0.08, 0.03, 1.5), loc=(0, -0.5, 1.5), r=0.0, base=True, color="#B691FF", mat="EMIT", nz=0)
    for ang in (60, 180, 300):
        b.box((0.16, 0.2, 2.2), loc=(0.5 * math.cos(math.radians(ang - 90)), 0.5 * math.sin(math.radians(ang - 90)), 0.9),
              rot=(0, 0, ang), r=0.04, base=True, color="#6A7099") if False else None
    obj = b.to_object("hub_ruin_pillar")
    return finish(man, "hub_ruin_pillar", obj, category="ruin_piece", worlds=["hub"], collision="auto_cyl", ao=0.45,
                  extra=kit_extra([1.6, 1.6, 4.0], "bottom-center; radius 0.72 at base"))


@reg("hub_ruin_pillar_broken")
def pillar_broken(man):
    b = Build("hub_ruin_pillar_broken")
    rng = b.rng
    # stub with an angled break
    prof = pillar_profile(4.0)[:9]
    bm = prim_lathe(prof + [(0.5, 2.6), (0, 2.6)], n=20, cap=True)
    for v in bm.verts:
        if v.co.z > 2.0:
            v.co.z = 2.0 + 0.9 * (0.5 + 0.5 * math.cos(math.atan2(v.co.y, v.co.x) - 0.6)) + 0.12 * math.sin(math.atan2(v.co.y, v.co.x) * 5)
    _recalc(bm)

    def col(p, n):
        if n.z > 0.5 or (p.z > 1.95 and n.z > -0.2):
            return "#8E94B8"
        return FaceG("#B2B7D3", "#F3F4FB", 0, 2.9)(p)
    col.per_face = True
    b.add(bm, color=col, jit=0.6)
    b.cyl(0.78, 0.2, loc=(0, 0, 0), n=20, r=0.05, base=True, color="#8A91B6")
    b.cyl(0.54, 0.16, loc=(0, 0, 1.1), n=20, r=0.03, base=True, color=C["orange"], jit=0.4)
    for k in range(7):
        a = 2 * math.pi * k / 7
        x, y = 0.3 * math.cos(a), 0.3 * math.sin(a)
        zt = 2.0 + 0.9 * (0.5 + 0.5 * math.cos(math.atan2(y, x) - 0.6)) + 0.12 * math.sin(a * 5)
        b.rod((x, y, zt - 0.4), (x * 1.1 + rng.uniform(-0.1, 0.1), y * 1.1 + rng.uniform(-0.1, 0.1), zt + rng.uniform(0.35, 0.8)), 0.03, n=5, color=REBAR, nz=0)
    # fallen drum chunk lying beside it
    drum = prim_cyl(0.5, 0.5, 1.2, 18, 0.08, 1)
    b.add(drum, loc=(1.55, -0.2, 0.52), rot=(0, 86, 28), color=G("#B2B7D3", "#F3F4FB"), jit=0.6)
    b.cyl(0.54, 0.16, loc=(1.55, -0.2, 0.52), n=18, r=0.03, color=C["orange"], jit=0.4, rot=(0, 86, 28))
    b.box((0.5, 0.4, 0.3), loc=(-0.9, 0.9, 0), r=0.08, base=True, rot=(0, 0, 33), color=G("#A9AECB", "#E3E6F4"))
    obj = b.to_object("hub_ruin_pillar_broken")
    return finish(man, "hub_ruin_pillar_broken", obj, category="ruin_piece", worlds=["hub"], collision="convex", ao=0.45,
                  extra=kit_extra([2.8, 2.0, 2.9], "bottom-center of the pillar stub; a fallen drum lies at +X"))


# =============================================================================================== doorway
@reg("hub_ruin_doorway")
def doorway(man):
    b = Build("hub_ruin_doorway")
    OW, OH = 2.4, 3.0
    pw = (4.0 - OW) / 2
    px = OW / 2 + pw / 2
    for sx in (-1, 1):
        b.box((pw, 0.64, 0.55), loc=(sx * px, 0, 0), r=0.1, base=True, color="#8A91B6")
        b.box((pw - 0.04, 0.46, 3.07), loc=(sx * px, 0, 0.55), r=0.14, base=True, color=G("#BDC2DB", "#F3F4FB", lo=0.55, hi=3.62), jit=0.6)
        b.box((pw - 0.04, 0.52, 0.16), loc=(sx * px, 0, 1.15), r=0.05, base=True, color=C["orange"], jit=0.4)
    # lintel
    b.box((OW + 0.04, 0.46, 1.1), loc=(0, 0, OH), r=0.14, base=True, color=G("#D5D9EC", "#F3F4FB", lo=OH, hi=4.0))
    b.box((4.0, 0.62, 0.38), loc=(0, 0, WALL_H - 0.38), r=0.14, base=True, color=G("#D5D9EC", "#F5F6FC"))
    b.box((3.96, 0.54, 0.12), loc=(0, 0, WALL_H - 0.52), r=0.04, base=True, color=C["orange"], jit=0.4)
    # sliding-door frame (steel) lining the opening
    for sx in (-1, 1):
        b.box((0.16, 0.56, OH), loc=(sx * (OW / 2 - 0.08), 0, 0), r=0.03, base=True, color="#6A7099")
        b.box((0.06, 0.58, OH - 0.2), loc=(sx * (OW / 2 - 0.19), 0, 0.05), r=0.0, base=True, color=C["orange"], jit=0.3)
    b.box((OW, 0.56, 0.18), loc=(0, 0, OH - 0.18), r=0.03, base=True, color="#6A7099")
    # track rail + door housing on the front, status light
    b.box((OW + 1.4, 0.26, 0.22), loc=(0.3, -0.38, OH + 0.12), r=0.06, base=True, color=C["steel"])
    b.box((0.5, 0.05, 0.1), loc=(0, -0.52, OH + 0.5), r=0.0, base=True, color="#B691FF", mat="EMIT", nz=0)
    b.box((0.18, 0.05, 0.1), loc=(0.6, -0.52, OH + 0.5), r=0.0, base=True, color="#FF9A4D", mat="EMIT", nz=0)
    # door panel(s): one half-slid open on the front, one fully retracted in the wall pocket (not visible)
    b.box((1.15, 0.12, OH - 0.25), loc=(0.55, -0.2, 0.05), r=0.05, base=True, color=G("#B4BAD6", "#E3E6F4"))
    b.add(prim_cyl(0.28, 0.28, 0.14, 16, 0.0, 1), loc=(0.55, -0.27, 1.9), rot=(90, 0, 0), color=G("#9FB8FF", "#D8CCFF"), mat="GLASS", nz=0)
    b.add(prim_ring(0.31, [(-0.05, 0.08), (0.05, 0.08), (0.05, -0.08), (-0.05, -0.08)], segs=16), loc=(0.55, -0.27, 1.9), rot=(90, 0, 0), color=C["orange"], jit=0.3)
    for z in (0.35, 2.5):
        b.box((1.15, 0.14, 0.12), loc=(0.55, -0.2, z), r=0.0, base=True, color=C["orange"], jit=0.3)
    b.box((0.1, 0.16, 0.9), loc=(0.02, -0.2, 0.95), r=0.03, base=True, color="#6A7099")
    # threshold
    b.box((OW, 0.9, 0.06), loc=(0, 0, 0), r=0.02, base=True, color=G("#5F6590", "#7A80A6"))
    obj = b.to_object("hub_ruin_doorway")
    return finish(man, "hub_ruin_doorway", obj, category="ruin_piece", worlds=["hub"], collision="trimesh", ao=0.45,
                  extra=kit_extra([4.0, 0.9, 4.0], "bottom-center; opening 2.4 m wide x 3.0 m high (door anchor 2.2 m); sliding door panel half open on the +X side (front)"),
                  views=[("side", dict(azim=45, elev=10))])


# =============================================================================================== stairs
@reg("hub_ruin_stairs")
def stairs(man):
    b = Build("hub_ruin_stairs")
    N = 10
    rise, run = 0.2, 0.4

    def stepcol(p, n):
        return "#EEF0F8" if n.z > 0.6 else "#A7ADCB"
    stepcol.per_face = True
    for i in range(N):
        h = rise * (i + 1)
        b.box((3.5, run + 0.02, h), loc=(0, -2.0 + run * i + run / 2, 0), r=0.04, base=True, color=stepcol, jit=0.7)
        b.box((3.5, 0.06, 0.03), loc=(0, -2.0 + run * i + 0.06, h - 0.005), r=0.0, base=True, color=C["orange"] if i in (0, N - 1) else "#8A91B6", jit=0.3, nz=0)
    # side stringers (sloped slabs)
    for sx in (-1, 1):
        pts = [(-2.0, 0.0), (2.0, 0.0), (2.0, 2.0 + 0.55), (-2.0, 0.2 + 0.55)]
        pts = [(-2.0, 0.0), (2.0, 0.0), (2.0, 2.6), (-2.0, 0.78)]
        M = Matrix(((0, 0, 1), (1, 0, 0), (0, 1, 0))).to_4x4()
        M = Matrix.Translation((sx * 1.87, 0, 0)) @ M
        b.add(prim_poly(pts, 0.26, 0.06, 1, False), matrix=M, color=G("#B7BCD6", "#F1F2FA"), jit=0.6)
        b.add(prim_poly([(-2.0, 0.60), (2.0, 2.4), (2.0, 2.52), (-2.0, 0.72)], 0.29, 0.02, 1, False), matrix=M, color=C["orange"], jit=0.3, nz=0)
    obj = b.to_object("hub_ruin_stairs")
    return finish(man, "hub_ruin_stairs", obj, category="ruin_piece", worlds=["hub"], collision="trimesh", ao=0.45,
                  extra=kit_extra([4.0, 4.0, 2.6], "bottom-center of footprint; climbs toward +Y: 10 steps x 0.2 m rise, 0.4 m run, top at z=2.0"),
                  views=[("side", dict(azim=70, elev=14))])


# =============================================================================================== domes
def dome_ribs(b, R, nrib, lon0, lon1, lats=(22, 48, 72), rib_col="#7B82A8"):
    for k in range(nrib + 1):
        lon = lon0 + (lon1 - lon0) * k / nrib
        pts = []
        for i in range(13):
            la = math.radians(90 * i / 12)
            pts.append(Vector(((R + 0.05) * math.cos(la) * math.cos(math.radians(lon)), (R + 0.05) * math.cos(la) * math.sin(math.radians(lon)),
                               (R + 0.05) * math.sin(la))))
        b.add(prim_sweep(pts, rrect(0.2, 0.15, 0.04, 1), up=None), color=rib_col, nz=0.02)
    for la in lats:
        a = math.radians(la)
        pts = [Vector(((R + 0.05) * math.cos(a) * math.cos(math.radians(lon0 + (lon1 - lon0) * i / 20)),
                       (R + 0.05) * math.cos(a) * math.sin(math.radians(lon0 + (lon1 - lon0) * i / 20)),
                       (R + 0.05) * math.sin(a))) for i in range(21)]
        b.add(prim_sweep(pts, rrect(0.16, 0.2, 0.04, 1), up=Vector((0, 0, 1))), color=rib_col, nz=0.02)


def dome_panels(b, R, lon0, lon1, nl, bands, skylights, missing=(), rng=None, orange_band=0):
    n_lon = nl
    for i in range(n_lon):
        for j in range(len(bands) - 1):
            if (i, j) in missing:
                continue
            la0, la1 = bands[j], bands[j + 1]
            lo0 = lon0 + (lon1 - lon0) * i / n_lon
            lo1 = lon0 + (lon1 - lon0) * (i + 1) / n_lon
            glass = (i, j) in skylights
            if glass:
                col, mat = G("#9FB8FF", "#D8CCFF", lo=0, hi=R), "GLASS"
            elif j == 0:
                col, mat = G("#9CA3C6", "#C6CBE3", lo=0, hi=R), "VC"
            else:
                col, mat = G("#C9CDE4", "#F5F6FC", lo=0, hi=R), "VC"
            b.add(prim_patch(R, 0.28, lo0, lo1, la0, la1, nl=2, nt=2, gap=0.9), color=col, mat=mat, jit=0.9, nz=0.04)


@reg("hub_ruin_dome_half")
def dome_half(man):
    b = Build("hub_ruin_dome_half")
    R = 4.0
    bands = [0, 22, 46, 70, 90]
    sky = {(2, 2), (3, 2), (4, 2), (5, 2), (3, 3), (4, 3)}
    dome_panels(b, R, 0, 180, 8, bands, sky)
    dome_ribs(b, R, 8, 0, 180)
    # base ring (half torus) + orange stripe
    b.add(prim_ring(R + 0.05, rrect(0.7, 0.5, 0.1, 2), segs=40, a0=0, a1=180), loc=(0, 0, 0.25), color="#8A91B6")
    b.add(prim_ring(R + 0.05, rrect(0.74, 0.12, 0.03, 1), segs=40, a0=0, a1=180), loc=(0, 0, 0.45), color=C["orange"], jit=0.3)
    # cut-edge arch frame in the y=0 plane
    b.add(prim_ring(R - 0.1, rrect(0.34, 0.5, 0.08, 2), segs=40, a0=0, a1=180), loc=(0, 0, 0), rot=(90, 0, 0), color="#6A7099")
    b.box((8.5, 0.5, 0.25), loc=(0, 0, 0), r=0.06, base=True, color="#6A7099")
    # light at the crown
    b.sphere(0.28, loc=(0, 0.0, R + 0.1), nu=12, nv=7, sq=(1, 1, 0.8), color="#B691FF", mat="EMIT", nz=0)
    obj = b.to_object("hub_ruin_dome_half")
    return finish(man, "hub_ruin_dome_half", obj, category="ruin_piece", worlds=["hub"], collision="trimesh", ao=0.45,
                  extra=kit_extra([8.5, 4.3, 4.3], "pivot = center of the straight (cut) edge at ground/roof-base level; dome occupies +Y half, radius 4 m; spans 2 grid cells in X, 1 in Y; skylight panels use GLASS"),
                  views=[("side", dict(azim=-110, elev=25))])


@reg("hub_ruin_dome_collapsed")
def dome_collapsed(man):
    b = Build("hub_ruin_dome_collapsed")
    rng = b.rng
    R = 4.0
    bands = [0, 22, 46, 70, 90]
    n = 12
    missing = set()
    for i in range(n):
        for j in range(4):
            # a large bite on the +X/+Y side and the top
            lon_mid = (i + 0.5) * 360 / n
            keep = True
            if j >= 2:
                keep = (i in (0, 1, 8, 9, 10)) and rng.random() < 0.8
            elif j == 1:
                keep = not (30 < lon_mid < 140) and rng.random() < 0.85
            else:
                keep = not (50 < lon_mid < 120) or rng.random() < 0.4
            if not keep:
                missing.add((i, j))
    dome_panels(b, R, 0, 360, n, bands, set(), missing=missing, rng=rng)
    # ribs: full set of bases, but broken partway
    for k in range(n):
        lon = 360.0 * k / n
        top_la = rng.choice([90, 90, 70, 58, 40, 26])
        if 40 < lon < 140:
            top_la = rng.choice([26, 40, 52])
        steps = 12
        pts = []
        for i in range(steps + 1):
            la = math.radians(top_la * i / steps)
            pts.append(Vector(((R + 0.05) * math.cos(la) * math.cos(math.radians(lon)), (R + 0.05) * math.cos(la) * math.sin(math.radians(lon)), (R + 0.05) * math.sin(la))))
        b.add(prim_sweep(pts, rrect(0.2, 0.15, 0.04, 1)), color="#7B82A8", nz=0.02)
        if top_la < 80:
            e = pts[-1]
            b.rod(e, e + Vector((rng.uniform(-0.2, 0.2), rng.uniform(-0.2, 0.2), 0.0)) + (e.normalized() * 0.5), 0.03, n=5, color=REBAR, nz=0)
    # base ring (broken)
    b.add(prim_ring(R + 0.05, rrect(0.7, 0.5, 0.1, 2), segs=48, a0=-30, a1=215), loc=(0, 0, 0.25), color="#8A91B6")
    b.add(prim_ring(R + 0.05, rrect(0.7, 0.5, 0.1, 2), segs=48, a0=245, a1=325), loc=(0, 0, 0.25), color="#8A91B6")
    # fallen panels inside and outside
    for i in range(7):
        a = rng.uniform(0, 2 * math.pi)
        rr = rng.uniform(0.8, 5.2)
        sz = rng.uniform(0.9, 1.5)
        b.box((sz, sz * 0.8, 0.14), loc=(rr * math.cos(a), rr * math.sin(a), 0.15), base=True, r=0.05,
              rot=(rng.uniform(-18, 18), rng.uniform(-18, 18), rng.uniform(0, 360)), color=G("#C9CDE4", "#F5F6FC"), jit=0.8)
    for i in range(3):
        a = rng.uniform(0, 2 * math.pi)
        rr = rng.uniform(1.0, 3.0)
        b.box((1.3, 0.9, 0.1), loc=(rr * math.cos(a), rr * math.sin(a), 0.5), r=0.04, rot=(rng.uniform(25, 45), rng.uniform(-15, 15), rng.uniform(0, 360)),
              color=G("#9FB8FF", "#D8CCFF"), mat="GLASS", nz=0)
    b.sphere(0.25, loc=(2.9, -2.2, 0.28), nu=10, nv=6, color="#B691FF", mat="EMIT", nz=0)
    obj = b.to_object("hub_ruin_dome_collapsed")
    return finish(man, "hub_ruin_dome_collapsed", obj, category="ruin_piece", worlds=["hub"], collision="trimesh", ao=0.45,
                  extra=kit_extra([9.6, 9.6, 4.3], "pivot = dome center on the ground; ~4.8 m radius incl. fallen panels. Full circle (not a half), most panels missing"),
                  views=[("side", dict(azim=40, elev=30))])


# =============================================================================================== catwalk & railing
def railing_parts(b, L=4.0, y=0.0, h=1.05, z0=0.0, n_posts=4, rail_col=None):
    rail_col = rail_col or C["orange"]
    xs = [-L / 2 + L * i / (n_posts - 1) for i in range(n_posts)]
    for x in xs:
        b.cyl(0.05, h, loc=(x, y, z0), n=8, r=0.0, base=True, color=G("#B4BAD6", "#EDEFF7"), nz=0.02)
        b.sphere(0.075, loc=(x, y, z0 + h + 0.01), nu=8, nv=5, color=rail_col, jit=0.3, nz=0)
    b.add(prim_sweep([Vector((-L / 2, y, z0 + h)), Vector((L / 2, y, z0 + h))], circle_prof(0.05, 8)), color=rail_col, jit=0.3, nz=0.0)
    b.add(prim_sweep([Vector((-L / 2, y, z0 + h * 0.55)), Vector((L / 2, y, z0 + h * 0.55))], circle_prof(0.035, 6)), color="#D5D9EC", nz=0)
    b.box((L, 0.03, 0.12), loc=(0, y, z0), r=0.0, base=True, color="#8A91B6", nz=0)


@reg("hub_ruin_catwalk")
def catwalk(man):
    b = Build("hub_ruin_catwalk")
    DZ = 1.2
    b.box((4.0, 1.4, 0.08), loc=(0, 0, DZ - 0.1), r=0.02, base=True, color="#3F3A60")
    for i in range(13):
        b.box((3.9, 0.07, 0.05), loc=(0, -0.6 + i * 0.1, DZ - 0.03), r=0.0, base=True, color=G("#8C93B5", "#B4BAD6") if i % 2 == 0 else "#6A7099", nz=0.02)
    for sy in (-1, 1):
        b.box((4.0, 0.2, 0.3), loc=(0, sy * 0.68, DZ - 0.38), r=0.05, base=True, color=G("#B7BCD6", "#EDEFF7"))
        railing_parts(b, 4.0, sy * 0.68, 1.05, DZ - 0.08, 4)
    for x in (-1.7, 1.7):
        for sy in (-1, 1):
            b.box((0.22, 0.22, DZ - 0.4), loc=(x, sy * 0.58, 0), r=0.04, base=True, color="#6A7099")
        b.box((0.2, 1.3, 0.14), loc=(x, 0, DZ - 0.55), r=0.04, base=True, color=C["steel"])
        b.beam((x, -0.58, 0.1), (x, 0.0, DZ - 0.5), 0.1, 0.1, r=0.02, color=C["steel_dk"])
        b.beam((x, 0.58, 0.1), (x, 0.0, DZ - 0.5), 0.1, 0.1, r=0.02, color=C["steel_dk"])
        b.box((0.28, 0.28, 0.06), loc=(x, 0.58, 0), r=0.02, base=True, color="#6A7099")
        b.box((0.28, 0.28, 0.06), loc=(x, -0.58, 0), r=0.02, base=True, color="#6A7099")
    b.box((0.5, 0.05, 0.1), loc=(1.8, -0.7, DZ + 0.3), r=0.0, base=True, color="#B691FF", mat="EMIT", nz=0)
    obj = b.to_object("hub_ruin_catwalk")
    return finish(man, "hub_ruin_catwalk", obj, category="ruin_piece", worlds=["hub"], collision="trimesh", ao=0.45,
                  extra=kit_extra([4.0, 1.5, 2.3], "bottom-center; deck runs along X, deck top at z=1.2 on 4 short legs; railings on both long sides (1.05 m)"))


@reg("hub_ruin_railing")
def railing(man):
    b = Build("hub_ruin_railing")
    railing_parts(b, 4.0, 0.0, 1.1, 0.0, 5)
    for x in (-2.0, 0.0, 2.0):
        b.box((0.3, 0.3, 0.08), loc=(x, 0, 0), r=0.02, base=True, color="#6A7099")
    b.box((0.4, 0.06, 0.1), loc=(0, -0.04, 0.9), r=0.0, base=True, color="#B691FF", mat="EMIT", nz=0)
    obj = b.to_object("hub_ruin_railing")
    return finish(man, "hub_ruin_railing", obj, category="ruin_piece", worlds=["hub"], collision="box", ao=0.4,
                  extra=kit_extra([4.0, 0.3, 1.2], "bottom-center; 4 m straight railing section along X"))


# =============================================================================================== props
@reg("hub_prop_antenna_dish")
def antenna_dish(man):
    b = Build("hub_prop_antenna_dish")
    b.box((1.5, 1.5, 0.5), loc=(0, 0, 0), r=0.12, base=True, color="#8A91B6")
    b.cyl(0.42, 1.5, loc=(0, 0, 0.45), r2=0.34, n=16, r=0.05, base=True, color=G("#B7BCD6", "#F1F2FA"))
    b.cyl(0.46, 0.16, loc=(0, 0, 1.0), n=16, r=0.03, base=True, color=C["orange"], jit=0.3)
    b.sphere(0.5, loc=(0, 0, 2.05), nu=14, nv=8, color="#B4BAD6")
    # dish (paraboloid shell), tilted
    R = 1.75
    prof = [(0.0, 0.0)]
    for i in range(1, 9):
        r = R * i / 8
        prof.append((r, 0.28 * r * r / R * 1.0 + 0.0))
    outer = prof
    inner = [(r * 0.97, z + 0.07) for (r, z) in reversed(prof[1:])]
    full = [(0.0, -0.03)] + [(r, z) for (r, z) in outer[1:]] + [(R + 0.06, outer[-1][1] + 0.03)] + inner + [(0.0, 0.07)]
    M = Matrix.Translation((0.0, 0.0, 2.3)) @ Matrix.Rotation(math.radians(-48), 4, "Y") @ Matrix.Rotation(math.radians(0), 4, "Z")
    bm = prim_lathe(full, n=28, cap=False)
    def dcol(p, n):
        return "#EEF0F8" if (n.z > 0.2 or True) else "#EEF0F8"
    b.add(bm, matrix=M, color=G("#B7BCD6", "#F5F6FC", axis=2, lo=1.0, hi=4.2), jit=0.5)
    b.add(prim_ring(R + 0.05, [(-0.05, 0.1), (0.07, 0.1), (0.07, -0.02), (-0.05, -0.02)], segs=28), matrix=M @ Matrix.Translation((0, 0, outer[-1][1] + 0.0)), color=C["orange"], jit=0.3)
    # inner dark center + feed horn on tripod
    b.add(prim_cyl(0.3, 0.3, 0.05, 14, 0, 1), matrix=M @ Matrix.Translation((0, 0, 0.1)), color="#5A5485", nz=0)
    focal = Vector((0, 0, 1.15))
    for ang in (0, 120, 240):
        rr = R * 0.85
        p0 = M @ Vector((rr * math.cos(math.radians(ang)), rr * math.sin(math.radians(ang)), 0.28 * rr * rr / R + 0.05))
        p1 = M @ focal
        b.rod(p0, p1, 0.035, n=6, color="#6A7099", nz=0)
    b.add(prim_cyl(0.16, 0.1, 0.38, 12, 0.03, 1), matrix=M @ Matrix.Translation(focal), color=C["orange"], jit=0.3)
    b.add(prim_sphere(0.09, 8, 5), matrix=M @ Matrix.Translation(focal + Vector((0, 0, 0.22))), color="#B691FF", mat="EMIT", nz=0)
    # yoke arms
    for sy in (-1, 1):
        b.beam((0, sy * 0.55, 2.0), (0, sy * 0.62, 2.45), 0.2, 0.2, r=0.05, color="#8A91B6")
    obj = b.to_object("hub_prop_antenna_dish")
    return finish(man, "hub_prop_antenna_dish", obj, category="ruin_prop", worlds=["hub"], collision="box", ao=0.45,
                  extra={"note": "dish faces +X and up; pivot bottom-center of the pedestal"}, ao_extras=None)


@reg("hub_prop_terminal")
def terminal(man):
    b = Build("hub_prop_terminal")
    b.box((1.5, 0.8, 0.9), loc=(0, 0, 0.1), r=0.12, base=True, color=G("#BDC2DB", "#F1F2FA"))
    b.box((1.56, 0.86, 0.1), loc=(0, 0, 0), r=0.04, base=True, color="#6A7099")
    b.box((1.5, 0.62, 0.12), loc=(0, -0.05, 1.0), rot=(14, 0, 0), r=0.05, base=True, color="#8A91B6", top="#B4BAD6")
    # keys
    for i in range(8):
        for j in range(3):
            c = C["orange"] if (i + j) % 7 == 0 else "#E3E6F4"
            b.box((0.12, 0.12, 0.04), loc=(-0.55 + i * 0.16, -0.2 + j * 0.15 * 0.97, 1.1 + j * 0.037 - 0.04), rot=(14, 0, 0), r=0.015, base=True, color=c, jit=0.3, nz=0)
    # monitor on stand
    b.box((0.3, 0.2, 0.9), loc=(0, 0.28, 1.0), r=0.05, base=True, color="#8A91B6")
    b.box((1.25, 0.12, 0.8), loc=(0, 0.2, 1.75), r=0.07, rot=(-8, 0, 0), color=G("#BDC2DB", "#F1F2FA"))
    b.box((1.08, 0.03, 0.62), loc=(0, 0.13, 1.74), rot=(-8, 0, 0), r=0.0, color=G("#6E4BC4", "#B691FF", lo=1.4, hi=2.1), mat="EMIT", nz=0)
    for k, w in enumerate((0.7, 0.45, 0.8, 0.3)):
        b.box((w, 0.035, 0.05), loc=(-0.4 + w / 2, 0.115, 1.93 - k * 0.12), rot=(-8, 0, 0), r=0.0, color="#E6D9FF", mat="EMIT", nz=0)
    b.box((0.1, 0.035, 0.1), loc=(0.42, 0.115, 1.55), rot=(-8, 0, 0), r=0.0, color="#FFB26B", mat="EMIT", nz=0)
    b.box((1.52, 0.04, 0.1), loc=(0, -0.4, 0.5), r=0.0, base=True, color=C["orange"], jit=0.3)
    b.add(prim_sweep(catmull([(0.5, 0.4, 0.4), (0.6, 0.9, 0.05), (0.9, 1.3, 0.08), (1.3, 1.45, 0.05)], 4), circle_prof(0.06, 6)), color="#58527F", nz=0.02)
    obj = b.to_object("hub_prop_terminal")
    return finish(man, "hub_prop_terminal", obj, category="ruin_prop", worlds=["hub"], collision="auto_box", ao=0.45,
                  extra={"note": "user stands at Blender -Y (Godot +Z); screen is EMIT"})


@reg("hub_prop_server_rack")
def server_rack(man):
    b = Build("hub_prop_server_rack")
    b.box((0.95, 0.85, 2.2), loc=(0, 0, 0.1), r=0.1, base=True, color=G("#B7BCD6", "#F1F2FA"))
    b.box((1.0, 0.9, 0.12), loc=(0, 0, 0), r=0.03, base=True, color="#6A7099")
    b.box((1.0, 0.9, 0.1), loc=(0, 0, 2.32), r=0.04, base=True, color="#8A91B6")
    dots = ["#B691FF", "#FFB26B", "#8CF2C9"]
    for i in range(9):
        z = 0.3 + i * 0.2
        b.box((0.78, 0.05, 0.16), loc=(0, -0.44, z), r=0.02, base=True, color=G("#8C93B5", "#C6CBE3", lo=0.3, hi=2.0), jit=0.6)
        b.box((0.4, 0.02, 0.04), loc=(-0.12, -0.475, z + 0.06), r=0.0, base=True, color="#3F3A60", nz=0)
        for k in range(3):
            b.box((0.045, 0.02, 0.045), loc=(0.2 + k * 0.07, -0.475, z + 0.06), r=0.0, base=True, color=dots[(i + k) % 3], mat="EMIT", nz=0)
    b.box((0.04, 0.05, 2.0), loc=(0.45, -0.44, 0.25), r=0.0, base=True, color=C["orange"], jit=0.3)
    b.add(prim_sweep(catmull([(-0.2, 0.0, 2.4), (-0.3, 0.3, 2.9), (-0.1, 0.8, 2.6), (0.0, 1.1, 1.3)], 4), circle_prof(0.07, 6)), color="#58527F", nz=0.02)
    b.add(prim_sweep(catmull([(0.15, 0.0, 2.4), (0.3, 0.4, 2.8), (0.5, 0.7, 2.2), (0.55, 1.2, 0.1)], 4), circle_prof(0.06, 6)), color=C["orange_dk"], nz=0.02)
    obj = b.to_object("hub_prop_server_rack")
    return finish(man, "hub_prop_server_rack", obj, category="ruin_prop", worlds=["hub"], collision="auto_box", ao=0.45,
                  extra={"note": "front (lights) faces Blender -Y (Godot +Z); cables dangle out the back"})


def beaker(b, loc, r, h, liquid, lcol, kind="beaker"):
    if kind == "beaker":
        prof = [(0, 0), (r, 0.0), (r, h), (r * 1.08, h + 0.02), (r * 0.9, h + 0.02), (r * 0.93, 0.03), (0, 0.03)]
        liq = [(0, 0.03), (r * 0.9, 0.03), (r * 0.9, h * liquid), (0, h * liquid)]
    else:  # erlenmeyer
        prof = [(0, 0), (r, 0.0), (r * 0.98, 0.04), (r * 0.25, h * 0.7), (r * 0.22, h), (r * 0.3, h + 0.02), (r * 0.18, h + 0.02), (r * 0.2, h * 0.7), (r * 0.9, 0.05), (0, 0.04)]
        liq = [(0, 0.04), (r * 0.9, 0.05), (r * 0.5, h * 0.4), (0, h * 0.4)]
    b.lathe(prof, loc=loc, n=14, cap=False, color=G("#CFE2FF", "#F0F4FF"), mat="GLASS", nz=0)
    b.lathe(liq, loc=loc, n=14, color=lcol, mat="EMIT", nz=0)


@reg("hub_prop_lab_table")
def lab_table(man):
    b = Build("hub_prop_lab_table")
    b.box((2.0, 0.9, 0.07), loc=(0, 0, 0.88), r=0.025, base=True, color=G("#D5D9EC", "#F1F2FA"), top="#F6F7FC")
    b.box((2.06, 0.96, 0.05), loc=(0, 0, 0.84), r=0.02, base=True, color="#6A7099")
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box((0.08, 0.08, 0.84), loc=(sx * 0.9, sy * 0.38, 0), r=0.02, base=True, color="#8A91B6")
    b.box((1.86, 0.78, 0.04), loc=(0, 0, 0.2), r=0.02, base=True, color="#8A91B6")
    b.box((0.4, 0.3, 0.2), loc=(-0.6, 0.0, 0.24), r=0.04, base=True, color=C["orange"], jit=0.3)   # crate under table
    beaker(b, (-0.7, 0.1, 0.95), 0.13, 0.32, 0.6, "#8CF2C9")
    beaker(b, (-0.38, 0.22, 0.95), 0.09, 0.22, 0.5, "#FF9ACB")
    beaker(b, (-0.1, 0.05, 0.95), 0.16, 0.3, 1.0, "#B691FF", kind="flask")
    # test tube rack
    b.box((0.5, 0.14, 0.04), loc=(0.45, 0.1, 0.95), r=0.01, base=True, color=C["orange"], jit=0.3)
    for i in range(5):
        x = 0.25 + i * 0.1
        b.cyl(0.026, 0.28, loc=(x, 0.1, 0.99), n=8, base=True, color="#E3EAFF", mat="GLASS", nz=0)
        b.cyl(0.02, 0.1 + 0.03 * (i % 3), loc=(x, 0.1, 0.99), n=8, base=True, color=["#B691FF", "#8CF2C9", "#FFB26B", "#FF9ACB", "#7AE7FF"][i], mat="EMIT", nz=0)
    # petri dish + tablet
    b.cyl(0.11, 0.025, loc=(0.0, -0.28, 0.95), n=14, base=True, color="#E3EAFF", mat="GLASS", nz=0)
    b.box((0.38, 0.26, 0.025), loc=(0.55, -0.22, 0.95), r=0.012, base=True, color="#8A91B6", rot=(0, 0, 14))
    b.box((0.32, 0.2, 0.01), loc=(0.55, -0.22, 0.974), r=0.0, base=True, color="#B691FF", mat="EMIT", rot=(0, 0, 14), nz=0)
    obj = b.to_object("hub_prop_lab_table")
    return finish(man, "hub_prop_lab_table", obj, category="ruin_prop", worlds=["hub"], collision="auto_box", ao=0.45,
                  extra={"note": "beakers/flask/tubes: GLASS shells with EMIT liquid"})


@reg("hub_prop_warning_sign")
def warning_sign(man):
    b = Build("hub_prop_warning_sign")
    b.cyl(0.06, 2.2, loc=(0, 0, 0), n=10, r=0.0, base=True, color=G("#767DA3", "#B4BAD6"))
    b.cyl(0.22, 0.1, loc=(0, 0, 0), n=14, r=0.03, base=True, color="#6A7099")
    s = 1.0
    tri_o = [(-0.62, -0.38), (0.62, -0.38), (0.0, 0.72)]
    tri_i = [(-0.5, -0.29), (0.5, -0.29), (0.0, 0.58)]
    M = Matrix.Translation((0, -0.07, 1.65)) @ Matrix.Rotation(math.radians(7), 4, "Y")
    R90 = Matrix.Rotation(math.radians(90), 4, "X")
    b.add(prim_poly(tri_o, 0.05, 0.05, 2, False), matrix=M @ R90, color="#4A4570", nz=0)
    b.add(prim_poly(tri_i, 0.05, 0.03, 1, False), matrix=M @ Matrix.Translation((0, -0.03, 0)) @ R90, color=G("#FFB067", "#FF8A3D"), jit=0.2)
    b.add(prim_box(0.1, 0.03, 0.34, 0.03, 1), matrix=M @ Matrix.Translation((0, -0.07, 0.12)), color="#3A3558", nz=0)
    b.add(prim_cyl(0.06, 0.06, 0.03, 10, 0, 1), matrix=M @ Matrix.Translation((0, -0.07, -0.12)) @ R90, color="#3A3558", nz=0)
    b.box((0.7, 0.04, 0.3), loc=(0.0, -0.08, 1.0), r=0.03, rot=(0, -4, 0), color="#E3E6F4")
    b.box((0.64, 0.045, 0.06), loc=(0.0, -0.1, 1.08), r=0.0, rot=(0, -4, 0), color=C["orange"], jit=0.3)
    b.box((0.3, 0.045, 0.04), loc=(-0.12, -0.1, 0.96), r=0.0, rot=(0, -4, 0), color="#554F7A", nz=0)
    b.box((0.08, 0.045, 0.04), loc=(0.2, -0.1, 0.96), r=0.0, rot=(0, -4, 0), color="#B691FF", mat="EMIT", nz=0)
    obj = b.to_object("hub_prop_warning_sign")
    return finish(man, "hub_prop_warning_sign", obj, category="ruin_prop", worlds=["hub"], collision="auto_cyl", ao=0.4,
                  extra={"note": "sign faces Blender -Y (Godot +Z)"})


@reg("hub_prop_floodlight")
def floodlight(man):
    b = Build("hub_prop_floodlight")
    for ang in (90, 210, 330):
        a = math.radians(ang)
        b.rod((0, 0, 1.55), (0.85 * math.cos(a), 0.85 * math.sin(a), 0.0), 0.04, n=6, rad1=0.03, color="#6A7099", nz=0)
        b.box((0.2, 0.2, 0.05), loc=(0.85 * math.cos(a), 0.85 * math.sin(a), 0), r=0.015, base=True, color="#4A4570", nz=0)
    b.cyl(0.07, 1.0, loc=(0, 0, 1.4), n=10, r=0.0, base=True, color=G("#B4BAD6", "#EDEFF7"))
    b.cyl(0.1, 0.14, loc=(0, 0, 1.4), n=10, r=0.02, base=True, color=C["orange"], jit=0.3)
    for sx in (-1, 1):
        b.box((0.06, 0.06, 0.5), loc=(sx * 0.46, 0.0, 2.2), r=0.015, base=True, color="#6A7099")
    b.box((1.0, 0.34, 0.66), loc=(0, 0, 2.18), r=0.1, rot=(14, 0, 0), color=G("#B7BCD6", "#F5F6FC"))
    b.box((0.86, 0.04, 0.52), loc=(0, -0.185, 2.19), r=0.0, rot=(14, 0, 0), color=G("#FFE2A8", "#FFFFFF"), mat="EMIT", nz=0)
    for k in range(3):
        b.box((0.86, 0.05, 0.03), loc=(0, -0.2, 2.03 + k * 0.17), r=0.0, rot=(14, 0, 0), color="#8A91B6", nz=0)
    b.box((1.02, 0.36, 0.1), loc=(0, 0.0, 2.5), r=0.03, rot=(14, 0, 0), color=C["orange"], jit=0.3)
    b.add(prim_sweep(catmull([(0.0, 0.2, 2.2), (0.15, 0.55, 1.7), (0.4, 0.9, 0.9), (0.9, 1.3, 0.04)], 4), circle_prof(0.045, 6)), color="#58527F", nz=0)
    obj = b.to_object("hub_prop_floodlight")
    return finish(man, "hub_prop_floodlight", obj, category="ruin_prop", worlds=["hub"], collision="auto_cyl", ao=0.45,
                  extra={"note": "lamp faces Blender -Y (Godot +Z); lens is EMIT"})


@reg("hub_prop_cable_bundle")
def cable_bundle(man):
    b = Build("hub_prop_cable_bundle")
    rng = b.rng
    cols = ["#58527F", "#58527F", C["orange_dk"], "#8C93B5", "#6E4BC4"]
    for i, c in enumerate(cols):
        off = (i - 2) * 0.17
        pts = [(-1.6, off + 0.0, 0.12), (-0.9, off + 0.35 * math.sin(i), 0.14), (-0.1, off * 0.6 + 0.5, 0.13 + 0.05 * i % 2),
               (0.8, -0.2 + off * 0.4, 0.14), (1.6, 0.25 + off * 0.5, 0.12)]
        b.add(prim_sweep(catmull(pts, 6), circle_prof(0.1, 8), None, False, None, True), color=c, jit=0.5, nz=0.03)
    for x, y in ((-0.7, 0.18), (0.55, 0.0)):
        b.add(prim_cyl(0.2, 0.2, 0.26, 12, 0.04, 1), loc=(x, y, 0.2), rot=(0, 90, 20), color=C["orange"], jit=0.3)
    b.box((0.5, 0.5, 0.32), loc=(-1.75, 0.0, 0), r=0.07, base=True, color="#6A7099")
    b.box((0.12, 0.12, 0.04), loc=(-1.75, 0.0, 0.32), r=0.0, base=True, color="#B691FF", mat="EMIT", nz=0)
    obj = b.to_object("hub_prop_cable_bundle")
    return finish(man, "hub_prop_cable_bundle", obj, category="ruin_prop", worlds=["hub"], collision="auto_box", ao=0.4,
                  scatter={"density": 0.3, "slope_max": 12, "min_spacing": 5.0, "cluster": 0.3, "zone": "plaza"})


def crate_base(b, sx, sy, sz, loc=(0, 0, 0), rot=(0, 0, 0), body="#B7BCD6", accent=None):
    accent = accent or C["orange"]
    M = Matrix.Translation(loc) @ Euler([math.radians(a) for a in rot], "XYZ").to_matrix().to_4x4()
    b.add(prim_box(sx, sy, sz, 0.1, 1, base=True), matrix=M, color=G(body, "#F1F2FA"))
    for dx in (-1, 1):
        for dy in (-1, 1):
            b.add(prim_box(0.16, 0.16, sz + 0.02, 0.04, 1, base=True), matrix=M @ Matrix.Translation((dx * (sx / 2 - 0.05), dy * (sy / 2 - 0.05), 0)), color=accent, jit=0.3)
    b.add(prim_box(sx + 0.03, sy + 0.03, 0.1, 0.03, 1, base=True), matrix=M @ Matrix.Translation((0, 0, sz * 0.62)), color="#8A91B6")


@reg("hub_prop_crate_a")
def crate_a(man):
    b = Build("hub_prop_crate_a")
    crate_base(b, 1.0, 1.0, 0.9)
    b.box((0.4, 0.04, 0.12), loc=(0, -0.5, 0.35), r=0.0, base=True, color="#3F3A60", nz=0)
    b.box((0.3, 0.04, 0.2), loc=(-0.25, -0.505, 0.55), r=0.0, base=True, color="#F3F4FB", nz=0)
    b.box((0.08, 0.045, 0.2), loc=(-0.2, -0.51, 0.55), r=0.0, base=True, color="#B691FF", mat="EMIT", nz=0)
    obj = b.to_object("hub_prop_crate_a")
    return finish(man, "hub_prop_crate_a", obj, category="ruin_prop", worlds=["hub"], collision="auto_box", ao=0.45,
                  scatter={"density": 0.5, "slope_max": 12, "min_spacing": 3.0, "cluster": 0.6, "zone": "plaza"})


@reg("hub_prop_crate_b")
def crate_b(man):
    b = Build("hub_prop_crate_b")
    crate_base(b, 1.4, 0.7, 0.55, body="#9AA1C3", accent="#6A7099")
    for x in (-0.4, 0.4):
        b.box((0.14, 0.05, 0.14), loc=(x, -0.36, 0.2), r=0.02, base=True, color=C["orange"], jit=0.3)
    b.box((0.5, 0.04, 0.2), loc=(0, 0, 0.55), r=0.02, base=True, color="#E3E6F4", rot=(0, 0, 0))
    b.box((0.4, 0.28, 0.05), loc=(0, 0, 0.55), r=0.02, base=True, color="#8A91B6")
    obj = b.to_object("hub_prop_crate_b")
    return finish(man, "hub_prop_crate_b", obj, category="ruin_prop", worlds=["hub"], collision="auto_box", ao=0.45,
                  scatter={"density": 0.4, "slope_max": 12, "min_spacing": 3.0, "cluster": 0.6, "zone": "plaza"})


@reg("hub_prop_crate_c")
def crate_c(man):
    b = Build("hub_prop_crate_c")
    crate_base(b, 1.1, 1.1, 0.9, body="#B7BCD6")
    crate_base(b, 0.8, 0.8, 0.7, loc=(0.1, 0.05, 0.9), rot=(0, 0, 17), body="#C6CBE3", accent=C["orange_dk"])
    crate_base(b, 0.55, 0.55, 0.45, loc=(1.15, -0.4, 0), rot=(0, 0, -25), body="#9AA1C3", accent="#6A7099")
    b.box((0.7, 0.04, 0.3), loc=(0.1, 0.0, 1.45), r=0.0, base=True, rot=(0, 0, 17 + 90), color=C["orange"], jit=0.3, nz=0)
    obj = b.to_object("hub_prop_crate_c")
    return finish(man, "hub_prop_crate_c", obj, category="ruin_prop", worlds=["hub"], collision="auto_box", ao=0.45,
                  scatter={"density": 0.3, "slope_max": 12, "min_spacing": 4.0, "cluster": 0.5, "zone": "plaza"})


@reg("hub_prop_barrel")
def barrel(man):
    b = Build("hub_prop_barrel")
    prof = [(0, 0), (0.3, 0), (0.37, 0.08), (0.4, 0.25), (0.42, 0.45), (0.4, 0.65), (0.37, 0.82), (0.3, 0.9), (0, 0.9)]
    b.lathe(prof, n=16, color=G("#FF9A55", "#FF7A2D", lo=0, hi=0.9), jit=0.6)
    for z, r in ((0.12, 0.38), (0.45, 0.425), (0.78, 0.38)):
        b.cyl(r + 0.01, 0.07, loc=(0, 0, z - 0.035), n=16, r=0.012, color="#7B82A8", nz=0.02)
    b.cyl(0.29, 0.05, loc=(0, 0, 0.9), n=16, r=0.01, base=True, color="#8A91B6")
    b.cyl(0.07, 0.07, loc=(0.14, 0.08, 0.95), n=8, r=0.01, base=True, color="#4A4570", nz=0)
    b.box((0.3, 0.04, 0.14), loc=(0, -0.41, 0.42), r=0.0, base=True, color="#3A3558", nz=0, rot=(0, 0, 0))
    b.box((0.1, 0.045, 0.1), loc=(-0.08, -0.415, 0.55), r=0.0, base=True, color="#FFE2A8", nz=0)
    obj = b.to_object("hub_prop_barrel")
    return finish(man, "hub_prop_barrel", obj, category="ruin_prop", worlds=["hub"], collision="auto_cyl", ao=0.45,
                  scatter={"density": 0.5, "slope_max": 12, "min_spacing": 2.5, "cluster": 0.6, "zone": "plaza"})


# =============================================================================================== floating debris
def jag_outline(rng, w, h, step=0.55, depth=0.5):
    """Irregular wall-chunk outline (x,z) around a w x h rectangle (CCW)."""
    pts = []
    corners = [(-w / 2, 0), (w / 2, 0), (w / 2, h), (-w / 2, h)]
    for i in range(4):
        x0, z0 = corners[i]
        x1, z1 = corners[(i + 1) % 4]
        L = math.hypot(x1 - x0, z1 - z0)
        k = max(2, int(L / step))
        for j in range(k):
            t = j / k
            x, z = x0 + (x1 - x0) * t, z0 + (z1 - z0) * t
            # push inward by a random amount toward the center
            d = rng.uniform(0.0, depth) * (1.0 if j else 0.8)
            cx, cz = -x, h / 2 - z
            ln = math.hypot(cx, cz) or 1.0
            pts.append((x + cx / ln * d, z + cz / ln * d))
    return pts


def inset(pts, f):
    cx = sum(p[0] for p in pts) / len(pts)
    cz = sum(p[1] for p in pts) / len(pts)
    return [(cx + (p[0] - cx) * f, cz + (p[1] - cz) * f) for p in pts]


def jag_slab(b, w, h, t, rng, hole=None, name_seed=0, face_col=None):
    """Wall chunk with irregular outline (optionally with a round window hole)."""
    if hole:
        bm = prim_slab_hole(w, h, t, hole[0], hole[1], hole[2], nseg=14, r=0.0)
        for v in bm.verts:
            on_edge = abs(abs(v.co.x) - w / 2) < 1e-3 or abs(v.co.z) < 1e-3 or abs(v.co.z - h) < 1e-3
            if on_edge:
                dx, dz = v.co.x, v.co.z - h / 2
                k = rng.uniform(0.0, 0.5)
                ln = math.hypot(dx, dz) or 1
                v.co.x -= dx / ln * k
                v.co.z -= dz / ln * k
        _recalc(bm)
        bevel_sharp(bm, 0.05, 1)
        return bm
    pts = jag_outline(rng, w, h)
    return prim_poly(pts, t, 0.05, 1, False), pts


@reg("hub_ruin_debris_a")
def debris_a(man):
    return debris(man, "a")


@reg("hub_ruin_debris_b")
def debris_b(man):
    return debris(man, "b")


@reg("hub_ruin_debris_c")
def debris_c(man):
    return debris(man, "c")


@reg("hub_ruin_debris_d")
def debris_d(man):
    return debris(man, "d")


def debris(man, key):
    aid = f"hub_ruin_debris_{key}"
    b = Build(aid)
    rng = b.rng
    cfgs = {"a": (3.0, 2.6, None), "b": (2.8, 2.8, (0.0, 1.35, 0.7)), "c": (3.6, 1.8, None), "d": (2.2, 3.2, None)}
    w, h, hole = cfgs[key]

    def col(p, n):
        if abs(n.y) > 0.7:
            return FaceG("#B2B7D3", "#F3F4FB", 0, h)(p)
        return CONCRETE
    col.per_face = True
    if hole:
        bm = jag_slab(b, w, h, 0.5, rng, hole=hole)
        pts = [(-w / 2 * 0.8, 0.3), (w / 2 * 0.8, 0.3), (w / 2 * 0.8, h - 0.3), (-w / 2 * 0.8, h - 0.3)]
        b.add(bm, color=col, jit=0.8, nz=0.05)
    else:
        bm, pts = jag_slab(b, w, h, 0.5, rng)
        b.add(bm, rot=(90, 0, 0), color=col, jit=0.8, nz=0.05)
        # raised panel plates on both faces (inset outline) so the front reads as wall panels
        ins = inset(pts, 0.8)
        for sy in (-1, 1):
            b.add(prim_poly(ins, 0.05, 0.02, 1, False), loc=(0, sy * 0.265, 0), rot=(90, 0, 0), color=G("#D9DCEE", "#F7F8FD", lo=0, hi=h), jit=0.6, nz=0.03)
        # steel seam
        b.box((0.14, 0.56, h * 0.55), loc=(rng.uniform(-0.3, 0.3), 0, h * 0.5), r=0.02, color="#6A7099", nz=0)
    if key in ("a", "c"):
        for sy in (-1, 1):
            b.box((w * 0.5, 0.06, 0.12), loc=(0.0, sy * 0.3, h * 0.38), r=0.02, color=C["orange"], jit=0.4, nz=0)
    if key == "b":
        cz = hole[1]
        b.add(prim_ring(0.72, rrect(0.16, 0.6, 0.06, 2), segs=24), loc=(0, 0, cz), rot=(90, 0, 0), color=C["steel"])
        b.add(prim_cyl(0.66, 0.66, 0.04, 20, 0, 1), loc=(0, 0, cz), rot=(90, 0, 0), color=G("#9FB8FF", "#D8CCFF"), mat="GLASS", nz=0)
    if key == "d":
        b.box((0.4, 0.04, 0.5), loc=(0.0, -0.3, h * 0.6), r=0.02, color="#B691FF", mat="EMIT", nz=0)
        b.box((0.9, 0.5, 0.35), loc=(0, 0, 0.35), r=0.08, color="#6A7099")
    # exposed rebar sprouting from the broken outline
    for i in range(8):
        k = rng.randrange(len(pts))
        px, pz = pts[k]
        dx, dz = (px - 0.0), (pz - h / 2)
        ln = math.hypot(dx, dz) or 1.0
        dx, dz = dx / ln, dz / ln
        Lr = rng.uniform(0.5, 1.0)
        b.rod((px - dx * 0.25, rng.uniform(-0.12, 0.12), pz - dz * 0.25), (px + dx * Lr, rng.uniform(-0.15, 0.15), pz + dz * Lr), 0.04, n=5, color=REBAR, nz=0, jit=0.5)
    b.beam((w * 0.25, 0, h * 0.5), (w * 0.25 + 0.9, 0.1, h * 0.5 + 0.35), 0.18, 0.3, r=0.03, color="#6A7099") if key in ("c", "d") else None
    tilt = {"a": (8, 6, 14), "b": (-10, 12, -8), "c": (6, -14, 22), "d": (14, 4, -18)}[key]
    M = Euler([math.radians(a) for a in tilt], "XYZ").to_matrix().to_4x4()
    for v in b.bm.verts:
        v.co = (M @ v.co.to_4d()).to_3d()
    obj = b.to_object(aid)
    return finish(man, aid, obj, category="debris", worlds=["hub"], collision="convex", ao=0.45, origin="bbox_base",
                  extra={"floating": True, "note": "floating wall chunk with exposed rebar; origin = bbox bottom-center (layout code lifts/rotates it)"})


@reg("hub_ruin_slab_floating")
def slab_floating(man):
    b = Build("hub_ruin_slab_floating")
    rng = b.rng
    outline = []
    n = 11
    for i in range(n):
        a = 2 * math.pi * i / n
        r = 2.0 * (0.8 + 0.3 * rng.random())
        outline.append((r * math.cos(a), r * math.sin(a) * 0.9))
    b.poly(outline, 0.5, r=0.05, base=False, loc=(0, 0, 0), color=two_tone(FaceG("#D5D9EC", "#EEF0F8", -0.25, 0.25), "#8E94B8"), jit=0.7, top="#F6F7FC")
    for i in range(3):
        a = rng.uniform(0, 2 * math.pi)
        b.box((1.1, 1.1, 0.1), loc=(0.8 * math.cos(a), 0.8 * math.sin(a), 0.28), r=0.03, rot=(0, 0, rng.uniform(0, 90)), color=G("#E3E6F4", "#F6F7FC"), jit=0.8)
    # lumpy rock underside
    rock = prim_sphere(1.9, 14, 9, sq=(1.0, 0.95, 1.5))
    for v in rock.verts:
        if v.co.z > -0.1:
            v.co.z = -0.1
        else:
            v.co.x *= 1.0 - 0.45 * min(1, -v.co.z / 2.8)
            v.co.y *= 1.0 - 0.45 * min(1, -v.co.z / 2.8)
        p = v.co * 0.7 + b.noff
        v.co += Vector((noise.noise(p), noise.noise(p + Vector((5, 3, 1))), noise.noise(p + Vector((2, 8, 4))) * 0.5)) * 0.7
    _recalc(rock)
    b.add(rock, loc=(0, 0, -0.2), color=G("#7C7FB8", "#B7BCE0", lo=-3.2, hi=-0.2), mat="VC_ROUGH", jit=0.8, nz=0.1)
    for i in range(5):
        a = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(0.6, 1.4)
        b.rod((r * math.cos(a), r * math.sin(a), -0.6), (r * math.cos(a) + rng.uniform(-0.3, 0.3), r * math.sin(a), -0.6 - rng.uniform(0.6, 1.5)), 0.04, n=5, color=REBAR, nz=0)
    b.box((0.8, 0.8, 0.9), loc=(-0.9, -0.5, 0.25), r=0.1, color=G("#B7BCD6", "#F1F2FA"), rot=(0, 0, 25))
    b.box((0.76, 0.04, 0.2), loc=(-0.9, -0.5, 0.55), r=0.0, color=C["orange"], jit=0.3, rot=(0, 0, 25), nz=0)
    obj = b.to_object("hub_ruin_slab_floating")
    return finish(man, "hub_ruin_slab_floating", obj, category="debris", worlds=["hub"], collision="convex", ao=0.45, origin="bbox_base",
                  extra={"floating": True, "note": "floor slab with lumpy rock underside (VC_ROUGH); origin bbox bottom-center"})
