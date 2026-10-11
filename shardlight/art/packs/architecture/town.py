"""Harrow's Reach — stylized, whimsical town kit (Slime Rancher ranch-house warmth)."""
import math
import bmesh
import bpy
from mathutils import Vector, Matrix, noise
from _kit import *  # noqa
from _kit import _recalc  # noqa

REGISTRY = {}
SHARD_WORLDS = ["verdant", "amber", "tide", "ember", "glass", "hollow", "seam"]
GLOW = "#FFC878"
GLOW_HOT = "#FFE2A8"
TIMBER = "#9A6648"
TIMBER_DK = "#7A4E3A"
STONE = "#B9B4C9"
STONE_DK = "#8E88A6"


def reg(aid):
    def deco(fn):
        REGISTRY[aid] = fn
        return fn
    return deco


def RX(a):
    return Matrix.Rotation(math.radians(a), 4, "X")


def RY(a):
    return Matrix.Rotation(math.radians(a), 4, "Y")


def RZ(a):
    return Matrix.Rotation(math.radians(a), 4, "Z")


def TR(x=0, y=0, z=0):
    return Matrix.Translation((x, y, z))


def fm(side, w, d):
    """Matrix placing local wall coords: (u along wall, -out, z) for a given side of a w x d building."""
    if side == "F":
        return TR(0, -d / 2, 0)
    if side == "B":
        return TR(0, d / 2, 0) @ RZ(180)
    if side == "R":
        return TR(w / 2, 0, 0) @ RZ(90)
    return TR(-w / 2, 0, 0) @ RZ(-90)


def FP(b, pbm, M, u, out, z, extra=None, **kw):
    """Add a part positioned on a wall face: M = fm(...); u along the wall, out = distance off the wall surface."""
    T = M @ TR(u, -out, z)
    if extra is not None:
        T = T @ extra
    return b.add(pbm, matrix=T, **kw)


def window(b, M, u, z, kind="square", s=0.8, shutter="#2FB5A8", lit=True, box=False, glass=None, trim="#F7EFE0"):
    gm = "EMIT" if lit else "GLASS"
    gcol = G("#FFD58A", "#FFEFC2", lo=-1, hi=1) if lit else G("#9FB8FF", "#D8CCFF", lo=-1, hi=1)
    gcol = GLOW if lit else "#B9C8FF"
    if kind == "round":
        r = s * 0.5
        FP(b, prim_ring(r + 0.04, [(-0.09, 0.05), (0.09, 0.05), (0.09, -0.07), (-0.09, -0.07)], segs=16), M, u, 0.0, z, extra=RX(90), color=trim, jit=0.3, nz=0.02)
        FP(b, prim_cyl(r, r, 0.04, 14, 0, 1), M, u, 0.02, z, extra=RX(90), color=gcol, mat=gm, nz=0, jit=0.2)
        FP(b, prim_box(0.05, 0.05, r * 2, 0, 1), M, u, 0.05, z, color=trim, nz=0)
        FP(b, prim_box(r * 2, 0.05, 0.05, 0, 1), M, u, 0.05, z, color=trim, nz=0)
    else:
        w, h = s, s * 1.2
        FP(b, prim_box(w + 0.2, 0.09, h + 0.2, 0.03, 1), M, u, 0.02, z, color=trim, jit=0.3, nz=0.02)
        FP(b, prim_box(w, 0.05, h, 0.0, 1), M, u, 0.06, z, color=gcol, mat=gm, nz=0, jit=0.2)
        FP(b, prim_box(0.05, 0.05, h, 0, 1), M, u, 0.09, z, color=trim, nz=0)
        FP(b, prim_box(w, 0.05, 0.05, 0, 1), M, u, 0.09, z, color=trim, nz=0)
        FP(b, prim_box(w + 0.36, 0.2, 0.07, 0.025, 1), M, u, 0.1, z - h / 2 - 0.1, color=trim, nz=0.02)
        if shutter:
            for sx in (-1, 1):
                FP(b, prim_box(w * 0.5, 0.06, h + 0.1, 0.03, 1), M, u + sx * (w / 2 + 0.1 + w * 0.25), 0.04, z, color=shutter, jit=0.4, nz=0.03)
        if box:
            FP(b, prim_box(w + 0.2, 0.22, 0.2, 0.03, 1), M, u, 0.17, z - h / 2 - 0.26, color=TIMBER, jit=0.4)
            rng = b.rng
            for k in range(5):
                x = u - w / 2 + 0.05 + k * (w / 4.2)
                FP(b, prim_sphere(0.1, 6, 4, sq=(1, 1, 0.9)), M, x, 0.17, z - h / 2 - 0.1, color=C["leaf"], mat="VC_FOLIAGE", jit=0.8, nz=0.0)
                FP(b, prim_sphere(0.07, 6, 4), M, x + rng.uniform(-0.03, 0.03), 0.2, z - h / 2 - 0.02,
                   color=[C["petal_pink"], C["petal_yel"], C["petal_cyan"]][k % 3], mat="VC_FOLIAGE", jit=0.4, nz=0)


def door(b, M, u, w=1.0, h=2.0, col=None, trim="#F7EFE0", arch=True, step=True):
    col = col or "#C9573F"
    FP(b, prim_box(w + 0.3, 0.1, h + 0.1, 0.03, 1, base=True), M, u, 0.0, 0.0, color=trim, jit=0.2, nz=0.02)
    if arch:
        FP(b, prim_cyl((w + 0.3) / 2, (w + 0.3) / 2, 0.1, 14, 0.0, 1), M, u, 0.0, h + 0.05, extra=RX(90), color=trim, jit=0.2, nz=0.02)
        FP(b, prim_box(w, 0.1, h, 0.03, 1, base=True), M, u, 0.05, 0.0, color=col, jit=0.4, nz=0.03)
        FP(b, prim_cyl(w / 2, w / 2, 0.1, 14, 0.0, 1), M, u, 0.05, h, extra=RX(90), color=col, jit=0.4, nz=0.03)
    else:
        FP(b, prim_box(w, 0.1, h, 0.03, 1, base=True), M, u, 0.05, 0.0, color=col, jit=0.4, nz=0.03)
    for dx in (-w * 0.25, w * 0.25):
        FP(b, prim_box(w * 0.38, 0.03, h * 0.35, 0.02, 1, base=True), M, u + dx, 0.11, 0.25, color=lerp_c(col, "#000000", 0.12), nz=0)
    FP(b, prim_sphere(0.06, 8, 5), M, u + w * 0.3, 0.13, h * 0.5, color="#F2C14E", nz=0)
    FP(b, prim_cyl(0.11, 0.11, 0.1, 10, 0.0, 1), M, u, 0.1, h * 0.78, extra=RX(90), color=GLOW, mat="EMIT", nz=0)
    if step:
        FP(b, prim_box(w + 0.7, 0.55, 0.16, 0.05, 1, base=True), M, u, 0.28, 0.0, color=STONE, jit=0.4, top="#CFCBDD")


def gable_roof(b, w, d, z0, h, ove=0.55, thick=0.26, col="#2FB5A8", ridge_col=None, courses=5, axis_rot=0, gable_col=None):
    """Gabled roof, ridge along local X before axis_rot (deg about Z). Eave line at z0, wall footprint w x d."""
    pitch = math.atan2(h, d / 2)
    L = (d / 2) / math.cos(pitch) + ove
    Lx = w + ove * 2
    base = RZ(axis_rot)
    for sgn in (-1, 1):
        # slope direction from ridge outwards/down
        dirv = Vector((0, sgn * math.cos(pitch), -math.sin(pitch)))
        n = courses
        for i in range(n):
            a0 = L * i / n
            a1 = L * (i + 1) / n + 0.04
            ctr = Vector((0, 0, z0 + h)) + dirv * ((a0 + a1) / 2)
            M = base @ Matrix.Translation(ctr) @ RX(-sgn * math.degrees(pitch)) @ TR(0, 0, thick / 2 * 0 + (0.0 + 0.012 * (n - i)))
            # courses stacked lower ones protrude a bit (shingles)
            shade = 1.0 - 0.06 * (i % 2)
            cc = col if i % 2 == 0 else lerp_c(col, "#FFFFFF", 0.0)
            b.add(prim_box(Lx, a1 - a0, thick, 0.06, 1), matrix=M, color=G(lerp_c(col, "#3A2A5A", 0.18 if i % 2 else 0.08), lerp_c(col, "#FFFFFF", 0.12)), jit=0.7, nz=0.03)
    rc = ridge_col or lerp_c(col, "#3A2A5A", 0.25)
    b.add(prim_cyl(thick * 0.75, thick * 0.75, Lx + 0.1, 8, 0.0, 1), matrix=base @ TR(0, 0, z0 + h + thick * 0.2) @ RY(90), color=rc, jit=0.4)
    # gables
    pts = [(-d / 2, 0.0), (d / 2, 0.0), (0.0, h)]
    Mg = Matrix(((0, 0, 1), (1, 0, 0), (0, 1, 0))).to_4x4()
    b.add(prim_poly(pts, w - 0.05, 0.03, 1, False), matrix=base @ TR(0, 0, z0) @ Mg, color=gable_col or "#F4E4C8", jit=0.5)


def chimney(b, loc, h=1.6, w=0.7, col="#D98A74", tilt=(3, -2), smoke=False):
    x, y, z = loc
    rng = b.rng
    for i in range(3):
        ww = w * (1.0 - 0.05 * i)
        b.box((ww, ww, h / 3 + 0.04), loc=(x + 0.04 * i * (1 if tilt[0] > 0 else -1), y + 0.03 * i, z + h / 3 * i), r=0.05, base=True,
              rot=(tilt[1] * 0.4, tilt[0] * 0.4, i * 5), color=G(lerp_c(col, "#3A2A5A", 0.1), lerp_c(col, "#FFFFFF", 0.1)), jit=0.7, nz=0.04)
    b.box((w * 1.25, w * 1.25, 0.18), loc=(x + 0.12, y + 0.08, z + h), r=0.05, base=True, rot=(tilt[1], tilt[0], 8), color=lerp_c(col, "#FFFFFF", 0.25))
    b.box((w * 0.7, w * 0.7, 0.06), loc=(x + 0.12, y + 0.08, z + h + 0.17), r=0.0, base=True, rot=(tilt[1], tilt[0], 8), color="#3A3558", nz=0)
    if smoke:
        for i, (dx, dz, s) in enumerate(((0.2, 0.5, 0.32), (0.45, 1.05, 0.45), (0.85, 1.7, 0.55))):
            b.sphere(s, loc=(x + 0.12 + dx, y + 0.08 + 0.05 * i, z + h + dz), nu=10, nv=7, color=G("#E8E4F5", "#FFFFFF"), nz=0.03)


def stone_base(b, w, d, h=0.4, over=0.15):
    b.box((w + over * 2, d + over * 2, h), loc=(0, 0, 0), r=0.08, base=True, color=G(STONE_DK, STONE), jit=0.8, nz=0.06)


def house_walls(b, w, d, h, z0, col_lo, col_hi, post=TIMBER, r=0.2):
    b.box((w, d, h), loc=(0, 0, z0), r=r, seg=2, base=True, color=G(col_lo, col_hi, lo=z0, hi=z0 + h), jit=0.5, nz=0.04)
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box((0.24, 0.24, h + 0.02), loc=(sx * (w / 2 - 0.02), sy * (d / 2 - 0.02), z0), r=0.05, base=True, color=post, jit=0.5, nz=0.03)


def lantern(b, loc, col=GLOW):
    x, y, z = loc
    b.box((0.2, 0.2, 0.28), loc=(x, y, z), r=0.04, base=True, color=col, mat="EMIT", nz=0)
    b.box((0.26, 0.26, 0.05), loc=(x, y, z + 0.28), r=0.0, base=True, color="#3A3558", nz=0)
    b.box((0.26, 0.26, 0.05), loc=(x, y, z - 0.05), r=0.0, base=True, color="#3A3558", nz=0)


def pot_flowers(b, loc, n=5, rad=0.3, seed=0):
    rng = b.rng
    x, y, z = loc
    b.add(prim_lathe([(0, 0), (0.14, 0), (0.2, 0.28), (0.22, 0.3), (0.17, 0.3), (0, 0.26)], 10, False), loc=(x, y, z), color="#E8845E", jit=0.5)
    for k in range(n):
        a = 2 * math.pi * k / n + seed
        px, py = x + 0.12 * math.cos(a), y + 0.12 * math.sin(a)
        h = rng.uniform(0.35, 0.55)
        b.rod((px, py, z + 0.28), (px + 0.05 * math.cos(a), py + 0.05 * math.sin(a), z + 0.28 + h), 0.015, n=4, color=C["leaf"], mat="VC_FOLIAGE", nz=0)
        b.sphere(0.09, loc=(px + 0.05 * math.cos(a), py + 0.05 * math.sin(a), z + 0.3 + h), nu=6, nv=4,
                 color=[C["petal_pink"], C["petal_yel"], C["petal_cyan"], "#FF7A6B"][k % 4], mat="VC_FOLIAGE", jit=0.4, nz=0)
    b.sphere(0.2, loc=(x, y, z + 0.34), nu=7, nv=5, sq=(1, 1, 0.7), color=C["leaf"], mat="VC_FOLIAGE", jit=0.6, nz=0.0)


def fin(man, aid, b, category, worlds=None, collision="trimesh", ao=0.45, scatter=None, extra=None, views=(), origin="authored", warp=None,
        extras=(), empties=(), preview_kw=None, flat=False):
    if warp is not None:
        b.warp(**warp)
    obj = b.to_object(aid, flat=flat)
    return finish(man, aid, obj, list(extras), list(empties), category=category, worlds=worlds or SHARD_WORLDS, collision=collision,
                  scatter=scatter, ao=ao, origin=origin, extra=extra, views=views, preview_kw=preview_kw)


# ===================================================================================== cottages
@reg("common_town_cottage_a")
def cottage_a(man):
    b = Build("common_town_cottage_a")
    w, d, h = 5.4, 4.4, 2.5
    stone_base(b, w, d)
    house_walls(b, w, d, h, 0.4, "#E8CDA6", "#FFF0D6")
    b.box((w + 0.05, d + 0.05, 0.1), loc=(0, 0, 0.4 + 0.02), r=0.03, base=True, color=TIMBER_DK, nz=0)
    gable_roof(b, w, d, 0.4 + h, 2.0, ove=0.6, col="#2FB5A8", gable_col="#F8E7C6")
    F, B_, R_, L_ = fm("F", w, d), fm("B", w, d), fm("R", w, d), fm("L", w, d)
    door(b, F, -1.0, col="#E4604C")
    window(b, F, 1.25, 1.6, "round", 0.9, trim="#FFF6E6")
    window(b, F, -2.1, 1.6, "square", 0.6, shutter="#E4604C", box=False)
    window(b, R_, 0.0, 1.55, "round", 0.9)
    window(b, L_, 0.5, 1.55, "round", 0.9)
    window(b, B_, 0.0, 1.5, "square", 0.7, shutter="#E4604C")
    lantern(b, (-1.9, -d / 2 - 0.3, 1.9))
    b.box((0.08, 0.3, 0.08), loc=(-1.9, -d / 2 - 0.15, 2.1), r=0.0, base=True, color="#3A3558", nz=0)
    chimney(b, (1.4, 0.7, 0.4 + h + 1.2), h=1.7, col="#D98A74", tilt=(5, -3))
    pot_flowers(b, (-2.0, -d / 2 - 0.55, 0.0), 5, seed=1)
    pot_flowers(b, (0.2, -d / 2 - 0.5, 0.0), 4, seed=2)
    b.box((1.0, 0.5, 0.35), loc=(2.1, -d / 2 - 0.4, 0), r=0.06, base=True, color=TIMBER, jit=0.5)
    return fin(man, "common_town_cottage_a", b, "building", warp=dict(lean=(0.006, 0.004), wob=0.07, wscale=6.0, seed=1),
               extra={"note": "one-story cottage, door faces Blender -Y (Godot +Z), closed door, no interior", "roof": "teal"},
               views=[("side", dict(azim=60, elev=18))])


@reg("common_town_cottage_b")
def cottage_b(man):
    b = Build("common_town_cottage_b")
    w, d, h = 4.4, 4.0, 2.5
    stone_base(b, w, d)
    house_walls(b, w, d, h, 0.4, "#F2B8B6", "#FBD6D0")
    # jettied upper floor
    uw, ud, uh = w + 0.7, d + 0.7, 2.3
    zu = 0.4 + h + 0.25
    b.box((uw + 0.1, ud + 0.1, 0.3), loc=(0, 0, zu - 0.3), r=0.06, base=True, color=TIMBER, jit=0.5)
    for k in range(5):
        b.box((0.3, 0.3, 0.3), loc=(-uw / 2 + 0.45 + k * (uw - 0.9) / 4, -ud / 2 + 0.2, zu - 0.58), r=0.05, base=True, color=TIMBER_DK, jit=0.5) if k in (0, 4) else None
    house_walls(b, uw, ud, uh, zu, "#CDBFF3", "#E7DEFA", post=TIMBER_DK)
    gable_roof(b, uw, ud, zu + uh, 2.3, ove=0.55, col="#FF7A6B", axis_rot=0, gable_col="#E3D8F8")
    F, R_, L_, B_ = fm("F", w, d), fm("R", w, d), fm("L", w, d), fm("B", w, d)
    UF, UR, UL, UB = fm("F", uw, ud), fm("R", uw, ud), fm("L", uw, ud), fm("B", uw, ud)
    door(b, F, 0.6, col="#2FB5A8")
    window(b, F, -1.3, 1.6, "square", 0.7, shutter="#FF7A6B", box=True)
    window(b, UF, -1.25, zu + 1.2, "square", 0.7, shutter="#2FB5A8")
    window(b, UF, 1.25, zu + 1.2, "round", 0.8)
    window(b, UR, 0.0, zu + 1.2, "round", 0.8)
    window(b, UL, 0.0, zu + 1.2, "square", 0.7, shutter="#2FB5A8")
    window(b, R_, 0.0, 1.5, "round", 0.8)
    # small balcony in front of upper door window
    b.box((1.9, 0.9, 0.12), loc=(0.0, -ud / 2 - 0.45, zu + 0.0), r=0.04, base=True, color=TIMBER)
    for sx in (-1, 0, 1):
        b.box((0.1, 0.1, 0.9), loc=(sx * 0.85, -ud / 2 - 0.88, zu + 0.12), r=0.02, base=True, color="#F7EFE0")
    b.add(prim_sweep([Vector((-0.85, -ud / 2 - 0.88, zu + 1.0)), Vector((0.85, -ud / 2 - 0.88, zu + 1.0))], circle_prof(0.05, 6)), color="#F7EFE0")
    # dormer
    b.box((1.1, 0.9, 0.8), loc=(0, -ud / 4, zu + uh + 0.7), r=0.1, base=True, color="#E7DEFA", jit=0.4)
    window(b, fm("F", 1.1, ud / 2 + 0.2), 0, zu + uh + 1.2, "round", 0.5, trim="#FFF6E6") if False else None
    b.add(prim_cyl(0.3, 0.3, 0.06, 12, 0, 1), loc=(0, -ud / 4 - 0.46, zu + uh + 1.15), rot=(90, 0, 0), color=GLOW, mat="EMIT", nz=0)
    b.box((1.4, 1.1, 0.14), loc=(0, -ud / 4, zu + uh + 1.4), r=0.05, base=True, color=lerp_c("#FF7A6B", "#3A2A5A", 0.1), rot=(0, 0, 0))
    chimney(b, (-1.4, 0.8, zu + uh + 1.0), h=1.5, col="#E0897A", tilt=(-6, 3))
    pot_flowers(b, (-1.0, -d / 2 - 0.5, 0.0), 5, seed=3)
    lantern(b, (1.55, -d / 2 - 0.25, 1.9))
    return fin(man, "common_town_cottage_b", b, "building", warp=dict(lean=(-0.005, 0.006), wob=0.08, wscale=6.0, seed=2, fade_h=4),
               extra={"note": "two-story cottage with jettied upper floor and balcony, closed door", "roof": "coral"},
               views=[("side", dict(azim=60, elev=18))])


@reg("common_town_cottage_tower")
def cottage_tower(man):
    b = Build("common_town_cottage_tower")
    R = 2.3
    n = 18
    prof = [(0, 0), (R + 0.3, 0), (R + 0.3, 0.4), (R + 0.1, 0.46), (R, 0.5), (R, 5.4), (R + 0.12, 5.5), (R + 0.12, 5.7), (R - 0.1, 5.75), (0, 5.75)]

    def wc(p, nn):
        if p.z < 0.48:
            return STONE if p.z > 0.01 else STONE_DK
        return FaceG("#B6E3CC", "#D8F5E6", 0.5, 5.4)(p)
    wc.per_face = True
    b.lathe(prof, n=n, color=wc, jit=0.5, nz=0.05)
    # timber band + stone course
    b.add(prim_ring(R + 0.08, [(-0.08, 0.16), (0.1, 0.16), (0.1, -0.16), (-0.08, -0.16)], segs=n * 2), loc=(0, 0, 2.95), color=TIMBER, jit=0.4)
    for k in range(6):
        a = 2 * math.pi * k / 6 + 0.3
        b.box((0.2, 0.2, 2.2), loc=((R + 0.02) * math.cos(a), (R + 0.02) * math.sin(a), 0.5), r=0.05, base=True, rot=(0, 0, math.degrees(a)), color=TIMBER, jit=0.4)
    # conical witch-hat roof (lavender), crooked tip
    rp = [(0, 5.7), (R + 0.75, 5.7), (R + 0.8, 5.95), (R + 0.2, 6.3), (R - 0.4, 7.3), (R - 1.2, 8.6), (0.6, 9.6), (0.2, 10.4), (0, 10.5)]
    bm = prim_lathe(rp, n=n, cap=True)
    for v in bm.verts:
        t = max(0.0, (v.co.z - 6.6) / 3.9)
        v.co.x += 0.42 * t * t
        v.co.y += 0.18 * t * t
    _recalc(bm)
    b.add(bm, color=G("#9573DD", "#C7B1F5", lo=5.7, hi=10.5), jit=0.6, nz=0.04)
    # scalloped bands on the roof
    for z, r in ((6.55, R - 0.18), (8.0, R - 1.3)):
        pass
    b.sphere(0.2, loc=(0.42 + 0.0, 0.18, 10.55), nu=10, nv=7, color=C["orange"], jit=0.3)
    b.rod((0.42, 0.18, 10.6), (0.45, 0.2, 11.4), 0.03, n=5, color="#3A3558", nz=0)
    b.add(prim_poly([(0, 0.0), (0.7, 0.18), (0.0, 0.36)], 0.03, 0.0, 1, True), loc=(0.45, 0.2, 10.95), rot=(90, 0, 0), color=C["coral"], jit=0.2, nz=0)
    # windows around (round) at two levels
    for k, (ang, z) in enumerate(((-90, 1.9), (-30, 4.2), (30, 1.9), (150, 4.2), (210, 1.9), (90, 4.2), (-150, 4.2))):
        a = math.radians(ang)
        M = TR(R * math.cos(a), R * math.sin(a), 0) @ RZ(ang + 90)
        # local front (-y) should face outward: rotate so that -y -> radial
        M = TR(R * math.cos(a), R * math.sin(a), 0) @ RZ(ang + 90)
        T = TR(0, 0, 0)
        window(b, M, 0, z, "round", 0.8 if z < 3 else 0.7, trim="#FFF6E6", lit=(k % 3 != 1))
    door_M = TR(0, -R, 0)
    door(b, door_M, 0, w=1.0, h=1.9, col="#FF7A6B")
    # round porch roof (small cone) over door
    b.add(prim_lathe([(0, 2.5), (1.5, 2.2), (1.55, 2.3), (0, 3.0)], 12, True), loc=(0, -R - 0.4, 0), color=G("#2FB5A8", "#6AD4C6"), jit=0.5)
    for sx in (-1, 1):
        b.rod((sx * 1.2, -R - 0.9, 0.0), (sx * 1.2, -R - 0.9, 2.35), 0.07, n=6, color=TIMBER, nz=0)
    lantern(b, (1.2, -R - 0.95, 1.75))
    chimney(b, (R - 0.15, 0.2, 5.6), h=2.7, col="#E0897A", tilt=(-6, 4))
    b.box((1.2, 0.5, 0.35), loc=(1.7, -R - 0.9, 0), r=0.06, base=True, color=TIMBER, jit=0.5)
    pot_flowers(b, (1.7, -R - 0.9, 0.35), 4, seed=2)
    return fin(man, "common_town_cottage_tower", b, "building", warp=dict(lean=(0.01, -0.006), wob=0.08, wscale=7.0, seed=3, fade_h=6),
               extra={"note": "round tower house, door faces Blender -Y, closed door", "roof": "lavender"},
               views=[("side", dict(azim=120, elev=18))])


def awning(b, x, y, z, w, depth, drop, cols=("#FF7A6B", "#FFF0D6"), n=6, scallop=True):
    """Striped awning attached at wall (y) sloping down toward -Y by `drop`; x centered."""
    sw = w / n
    pitch = math.degrees(math.atan2(drop, depth))
    L = math.hypot(depth, drop)
    for i in range(n):
        cx = x - w / 2 + sw * (i + 0.5)
        col = cols[i % 2]
        b.add(prim_box(sw - 0.01, L, 0.1, 0.03, 1), loc=(cx, y - depth / 2, z - drop / 2), rot=(pitch, 0, 0), color=G(lerp_c(col, "#3A2A5A", 0.1), col), jit=0.5, nz=0.02)
        if scallop:
            b.add(prim_cyl(sw / 2, sw / 2, 0.08, 10, 0.0, 1), loc=(cx, y - depth - 0.02, z - drop - 0.12), rot=(90, 0, 0), color=col, jit=0.4, nz=0.02)
            b.add(prim_box(sw - 0.01, 0.08, 0.26, 0.02, 1), loc=(cx, y - depth - 0.02, z - drop - 0.02), color=col, jit=0.4, nz=0.02)


@reg("common_town_shop")
def shop(man):
    b = Build("common_town_shop")
    w, d, h = 6.0, 4.6, 3.0
    stone_base(b, w, d)
    house_walls(b, w, d, h, 0.4, "#9CCBF2", "#CFE8FF")
    # false front parapet with curved top
    b.box((w + 0.1, 0.4, 0.9), loc=(0, -d / 2 + 0.05, 0.4 + h), r=0.12, base=True, color=G("#B7DAF8", "#E4F2FF", lo=3.4, hi=4.3), jit=0.4)
    b.cyl(1.2, 0.4, loc=(0, -d / 2 + 0.05, 0.4 + h + 0.8), n=16, r=0.05, base=True, rot=(90, 0, 0), color="#E4F2FF", jit=0.3) if False else None
    # roof: gentle butter-yellow gable (ridge along Y so it hides behind parapet)
    gable_roof(b, d - 0.3, w, 0.4 + h, 1.3, ove=0.45, col="#FFD166", axis_rot=90, gable_col="#CFE8FF")
    F, R_, L_, B_ = fm("F", w, d), fm("R", w, d), fm("L", w, d), fm("B", w, d)
    # big display window
    b.box((2.5, 0.16, 1.6), loc=(-1.2, -d / 2 - 0.02, 0.4 + 0.75), r=0.05, base=True, color="#F7EFE0", jit=0.2)
    b.box((2.2, 0.06, 1.3), loc=(-1.2, -d / 2 - 0.1, 0.4 + 0.9), r=0.0, base=True, color=G("#FFD58A", "#FFF0C8", lo=1.2, hi=2.4), mat="EMIT", nz=0)
    for k in (-1, 0, 1):
        b.box((0.06, 0.08, 1.3), loc=(-1.2 + k * 0.73, -d / 2 - 0.13, 0.4 + 0.9), r=0.0, base=True, color="#F7EFE0", nz=0)
    b.box((2.7, 0.35, 0.1), loc=(-1.2, -d / 2 - 0.2, 0.4 + 0.65), r=0.03, base=True, color=TIMBER)
    # wares on the sill: little round jars
    for k, c in enumerate(("#FF7AA8", "#7AE7FF", "#FFD166", "#8CF2C9")):
        b.sphere(0.13, loc=(-1.95 + k * 0.5, -d / 2 - 0.25, 0.4 + 0.8), nu=8, nv=6, color=c, jit=0.3, nz=0)
    door(b, F, 1.9, w=1.0, h=2.0, col="#FF7A6B", step=True)
    awning(b, 0.0, -d / 2 - 0.1, 2.75, 5.4, 1.5, 0.55, cols=("#FF7A6B", "#FFF0D6"), n=8)
    # side window, hanging sign
    window(b, R_, 0.0, 1.7, "square", 0.8, shutter="#FFD166")
    window(b, L_, 0.0, 1.7, "round", 0.9)
    b.rod((w / 2 + 0.05, -d / 2 + 0.3, 3.2), (w / 2 + 0.85, -d / 2 + 0.3, 3.2), 0.04, n=6, color="#3A3558", nz=0)
    b.box((0.06, 0.8, 0.8), loc=(w / 2 + 0.7, -d / 2 + 0.3, 2.3), r=0.04, base=True, color="#CDBFF3", jit=0.3)
    b.add(prim_cyl(0.22, 0.22, 0.04, 12, 0, 1), loc=(w / 2 + 0.74, -d / 2 + 0.3, 2.7), rot=(0, 90, 0), color=C["orange"], jit=0.2, nz=0)
    for sx in (-1, 1):
        b.rod((w / 2 + 0.7, -d / 2 + 0.3 + sx * 0.3, 3.15), (w / 2 + 0.7, -d / 2 + 0.3 + sx * 0.3, 3.2), 0.015, n=4, color="#3A3558", nz=0)
    # crates by the door
    b.box((0.8, 0.7, 0.6), loc=(2.9 + 0.0, -d / 2 - 0.9, 0), r=0.06, base=True, color=TIMBER, jit=0.4, rot=(0, 0, 12))
    for k in range(3):
        b.sphere(0.14, loc=(2.75 + k * 0.17, -d / 2 - 0.9 + 0.05 * k, 0.72), nu=8, nv=6, color=["#FF7A6B", "#FFD166", "#8CD66E"][k], jit=0.3, nz=0)
    return fin(man, "common_town_shop", b, "building", warp=dict(lean=(0.004, -0.004), wob=0.07, wscale=6.0, seed=4),
               extra={"note": "shop with striped awning, display window is EMIT; closed door; hanging sign on +X side", "roof": "butter"},
               views=[("side", dict(azim=60, elev=18))])


@reg("common_town_bakery")
def bakery(man):
    b = Build("common_town_bakery")
    w, d, h = 5.8, 5.0, 2.7
    stone_base(b, w, d)
    house_walls(b, w, d, h, 0.4, "#FFC9A0", "#FFE6CC", post="#C98B6A")
    gable_roof(b, w, d, 0.4 + h, 2.2, ove=0.55, col="#F28CA0", gable_col="#FFE9D2")
    # big brick chimney with smoke
    cx, cy = 1.7, 0.9
    b.box((1.3, 1.2, 4.4), loc=(cx, cy, 0.4), r=0.1, base=True, color=G("#C8604E", "#E58A74", lo=0.4, hi=4.8), jit=0.8, nz=0.06, rot=(0, 0, 3))
    for k in range(6):
        b.box((1.36, 1.26, 0.07), loc=(cx, cy, 1.4 + k * 0.62), r=0.0, base=True, color="#A8483E", nz=0, rot=(0, 0, 3))
    b.box((1.7, 1.6, 0.3), loc=(cx, cy, 4.8), r=0.08, base=True, color="#F3C9B6", rot=(0, 0, 3))
    b.box((1.1, 1.0, 0.08), loc=(cx, cy, 5.08), r=0.0, base=True, color="#3A3558", nz=0, rot=(0, 0, 3))
    for dx, dz, s in ((0.0, 5.5, 0.38), (0.45, 6.2, 0.55), (1.0, 7.0, 0.7), (1.8, 7.7, 0.55)):
        b.sphere(s, loc=(cx + dx, cy + 0.1 * dx, dz), nu=10, nv=7, color=G("#EDE8FA", "#FFFFFF", lo=5, hi=8), nz=0.04)
    F, R_, L_, B_ = fm("F", w, d), fm("R", w, d), fm("L", w, d), fm("B", w, d)
    # big arched warm window + door
    door(b, F, 1.5, w=1.0, h=2.0, col="#8E5BB5")
    b.box((2.2, 0.15, 1.6), loc=(-1.1, -d / 2 - 0.02, 0.4 + 0.8), r=0.05, base=True, color="#FFF6E6")
    b.box((1.9, 0.06, 1.3), loc=(-1.1, -d / 2 - 0.1, 0.4 + 0.95), r=0.0, base=True, color=G("#FFD58A", "#FFF0C8", lo=1.3, hi=2.5), mat="EMIT", nz=0)
    b.add(prim_cyl(0.95, 0.95, 0.06, 16, 0, 1), loc=(-1.1, -d / 2 - 0.1, 0.4 + 2.25), rot=(90, 0, 0), color=GLOW, mat="EMIT", nz=0) if False else None
    b.box((0.06, 0.08, 1.3), loc=(-1.1, -d / 2 - 0.13, 0.4 + 0.95), r=0.0, base=True, color="#FFF6E6", nz=0)
    b.box((2.4, 0.35, 0.1), loc=(-1.1, -d / 2 - 0.2, 0.4 + 0.75), r=0.03, base=True, color=TIMBER)
    for k, x in enumerate((-1.7, -1.2, -0.7, -0.2)):
        b.sphere(0.2, loc=(x, -d / 2 - 0.25, 0.4 + 0.95), nu=8, nv=6, sq=(1.3, 0.9, 0.7), color=["#E0A15E", "#C98B4E", "#E8B974", "#D4964F"][k], jit=0.3, nz=0.02)
    awning(b, 1.5, -d / 2 - 0.1, 2.55, 1.9, 1.0, 0.4, cols=("#8E5BB5", "#FFF0D6"), n=4)
    window(b, R_, -0.8, 1.6, "round", 0.9)
    window(b, L_, 0.0, 1.6, "square", 0.8, shutter="#8E5BB5")
    # hanging loaf sign
    b.rod((-w / 2 + 0.3, -d / 2 - 0.05, 3.1), (-w / 2 + 0.3, -d / 2 - 1.0, 3.1), 0.04, n=6, color="#3A3558", nz=0)
    b.sphere(0.34, loc=(-w / 2 + 0.3, -d / 2 - 0.9, 2.65), nu=12, nv=8, sq=(1.5, 0.8, 0.9), color=G("#C98B4E", "#F0B873"), jit=0.3)
    b.box((0.5, 0.04, 0.05), loc=(-w / 2 + 0.3, -d / 2 - 0.9, 2.7), r=0, color="#FFF0D6", nz=0, rot=(0, 0, 25))
    # oven bulge at the back
    b.add(prim_cyl(1.0, 1.0, 1.8, 14, 0.06, 1), loc=(-1.2, d / 2 + 0.6, 0.4), color=G("#E58A74", "#F3C9B6", lo=0.4, hi=2.2), jit=0.6, nz=0.05) if False else None
    # flour sacks + barrel
    for k, (x, y) in enumerate(((2.9, -d / 2 - 0.65), (3.4, -d / 2 - 0.3))):
        b.sphere(0.34, loc=(x, y, 0.3), nu=10, nv=7, sq=(1, 0.9, 0.95), color="#F7EFE0", jit=0.4, nz=0.03)
        b.sphere(0.12, loc=(x, y, 0.6), nu=6, nv=4, color="#F7EFE0", nz=0)
    return fin(man, "common_town_bakery", b, "building", warp=dict(lean=(0.005, 0.003), wob=0.07, wscale=6.0, seed=5, fade_h=5),
               extra={"note": "bakery with huge chimney (smoke puffs are part of the mesh), closed door", "roof": "rose"},
               views=[("side", dict(azim=60, elev=18))])


@reg("common_town_greenhouse")
def greenhouse(man):
    b = Build("common_town_greenhouse")
    w, d = 6.4, 4.2
    kh = 0.8      # knee wall height
    gh = 1.9      # glass wall height
    # floor + knee wall
    b.box((w + 0.4, d + 0.4, 0.2), loc=(0, 0, 0), r=0.05, base=True, color=G(STONE_DK, STONE), jit=0.6)
    b.box((w, d, 0.06), loc=(0, 0, 0.2), r=0.0, base=True, color=G("#C9A57E", "#E3C49C"), jit=1.0, nz=0.04)   # interior plank floor
    for sx in (-1, 1):
        b.box((0.28, d, kh), loc=(sx * (w / 2 - 0.14), 0, 0.2), r=0.05, base=True, color=G(STONE_DK, STONE), jit=0.7)
    for sy in (-1, 1):
        b.box((w, 0.28, kh), loc=(0, sy * (d / 2 - 0.14), 0.2), r=0.05, base=True, color=G(STONE_DK, STONE), jit=0.7)
    z0 = 0.2 + kh
    FR = "#F7F2FF"
    gcol = G("#BFD8FF", "#E4DAFF", lo=0, hi=5)
    # posts and rails
    nx, ny = 6, 4
    for i in range(nx + 1):
        x = -w / 2 + 0.14 + (w - 0.28) * i / nx
        for sy in (-1, 1):
            b.box((0.1, 0.1, gh + 0.05), loc=(x, sy * (d / 2 - 0.14), z0), r=0.02, base=True, color=FR, nz=0)
    for j in range(ny + 1):
        y = -d / 2 + 0.14 + (d - 0.28) * j / ny
        for sx in (-1, 1):
            b.box((0.1, 0.1, gh + 0.05), loc=(sx * (w / 2 - 0.14), y, z0), r=0.02, base=True, color=FR, nz=0)
    for sy in (-1, 1):
        b.box((w, 0.12, 0.1), loc=(0, sy * (d / 2 - 0.14), z0 + gh), r=0.02, base=True, color=FR, nz=0)
        b.box((w, 0.07, 0.07), loc=(0, sy * (d / 2 - 0.14), z0 + gh * 0.55), r=0.0, base=True, color=FR, nz=0)
    for sx in (-1, 1):
        b.box((0.12, d, 0.1), loc=(sx * (w / 2 - 0.14), 0, z0 + gh), r=0.02, base=True, color=FR, nz=0)
        b.box((0.07, d, 0.07), loc=(sx * (w / 2 - 0.14), 0, z0 + gh * 0.55), r=0.0, base=True, color=FR, nz=0)
    # glass panes (walls)
    for i in range(nx):
        x = -w / 2 + 0.14 + (w - 0.28) * (i + 0.5) / nx
        pw = (w - 0.28) / nx - 0.1
        for sy in (-1, 1):
            if sy == -1 and i in (2, 3):
                continue   # front door opening
            b.box((pw, 0.03, gh - 0.1), loc=(x, sy * (d / 2 - 0.14), z0 + 0.05), r=0.0, base=True, color=gcol, mat="GLASS", nz=0)
    for j in range(ny):
        y = -d / 2 + 0.14 + (d - 0.28) * (j + 0.5) / ny
        pw = (d - 0.28) / ny - 0.1
        for sx in (-1, 1):
            b.box((0.03, pw, gh - 0.1), loc=(sx * (w / 2 - 0.14), y, z0 + 0.05), r=0.0, base=True, color=gcol, mat="GLASS", nz=0)
    # door frame (open) + two door leaves swung open
    xd = (-w / 2 + 0.14 + (w - 0.28) * 2 / nx, -w / 2 + 0.14 + (w - 0.28) * 4 / nx)
    b.box((xd[1] - xd[0], 0.12, 0.12), loc=((xd[0] + xd[1]) / 2, -d / 2 + 0.14, z0 + gh - 0.12), r=0.02, base=True, color=FR, nz=0)
    for k, sx in enumerate((-1, 1)):
        px = (xd[0] if sx == -1 else xd[1])
        ang = 70 * sx
        M = TR(px, -d / 2 + 0.14, z0) @ RZ(ang)
        lw = (xd[1] - xd[0]) / 2 - 0.04
        b.add(prim_box(lw, 0.06, gh - 0.15, 0.02, 1, base=True), matrix=M @ TR(-sx * 0 + (lw / 2) * (-sx * -1) * (1 if sx == 1 else -1) * 0, 0, 0) @ TR((lw / 2) * (1 if sx == -1 else -1), 0, 0), color=FR, nz=0)
        b.add(prim_box(lw - 0.12, 0.03, gh - 0.4, 0.0, 1, base=True), matrix=M @ TR((lw / 2) * (1 if sx == -1 else -1), 0, 0.12), color=gcol, mat="GLASS", nz=0)
    # gabled glass roof
    rh = 1.5
    zr = z0 + gh
    pitch = math.atan2(rh, d / 2)
    Lr = (d / 2) / math.cos(pitch) + 0.1
    for sgn in (-1, 1):
        dirv = Vector((0, sgn * math.cos(pitch), -math.sin(pitch)))
        for i in range(nx):
            x = -w / 2 + 0.14 + (w - 0.28) * (i + 0.5) / nx
            pw = (w - 0.28) / nx - 0.08
            ctr = Vector((x, 0, zr + rh)) + dirv * (Lr / 2)
            b.add(prim_box(pw, Lr - 0.06, 0.03, 0.0, 1), loc=ctr, rot=(-sgn * math.degrees(pitch), 0, 0), color=gcol, mat="GLASS", nz=0)
        for i in range(nx + 1):
            x = -w / 2 + 0.14 + (w - 0.28) * i / nx
            ctr = Vector((x, 0, zr + rh)) + dirv * (Lr / 2)
            b.add(prim_box(0.07, Lr, 0.09, 0.0, 1), loc=ctr, rot=(-sgn * math.degrees(pitch), 0, 0), color=FR, nz=0)
        b.add(prim_box(w + 0.1, 0.12, 0.1, 0.0, 1), loc=Vector((0, 0, zr)) + dirv * Lr * 0 + Vector((0, sgn * (d / 2 - 0.1), 0.0)), color=FR, nz=0)
    b.box((w + 0.1, 0.16, 0.14), loc=(0, 0, zr + rh), r=0.03, base=False, color=C["teal"], jit=0.3)
    pts = [(-d / 2, 0.0), (d / 2, 0.0), (0.0, rh)]
    Mg = Matrix(((0, 0, 1), (1, 0, 0), (0, 1, 0))).to_4x4()
    for sx in (-1, 1):
        b.add(prim_poly(pts, 0.03, 0.0, 1, False), matrix=TR(sx * (w / 2 - 0.14), 0, zr) @ Mg, color=gcol, mat="GLASS", nz=0)
    # interior: benches with potted plants, small tree, hanging planters
    rng = b.rng
    for sy in (1,):
        for sx in (-1, 1):
            bx = sx * 1.9
            b.box((2.0, 0.8, 0.12), loc=(bx, 1.2, 0.2 + 0.78), r=0.03, base=True, color=TIMBER, jit=0.4)
            for lx in (-0.9, 0.9):
                b.box((0.1, 0.7, 0.78), loc=(bx + lx, 1.2, 0.2), r=0.02, base=True, color=TIMBER_DK)
            for k in range(4):
                pot_flowers(b, (bx - 0.75 + k * 0.5, 1.2 + rng.uniform(-0.1, 0.1), 0.2 + 0.9), 4, seed=k + sx)
    b.box((2.4, 0.7, 0.12), loc=(0, -0.2, 0.2 + 0.5), r=0.03, base=True, color=TIMBER, jit=0.4)
    b.box((2.3, 0.6, 0.3), loc=(0, -0.2, 0.2 + 0.6), r=0.04, base=True, color=G("#6B4A3A", "#8A5A44"), jit=0.4)
    for k in range(5):
        b.sphere(0.24, loc=(-0.9 + k * 0.45, -0.2, 0.2 + 1.0), nu=8, nv=6, sq=(1, 1, 0.8), color=[C["leaf"], C["leaf_lt"], "#2E9E6E"][k % 3], mat="VC_FOLIAGE", jit=0.7, nz=0)
        b.sphere(0.1, loc=(-0.9 + k * 0.45, -0.2, 0.2 + 1.2), nu=6, nv=4, color=[C["petal_pink"], C["petal_yel"], C["petal_cyan"]][k % 3], mat="VC_FOLIAGE", nz=0)
    # little tree in a pot, back-center
    b.cyl(0.35, 0.5, loc=(0, 1.55, 0.2), r2=0.28, n=10, r=0.04, base=True, color="#E8845E", jit=0.4)
    b.add(prim_sweep(catmull([(0, 1.55, 0.7), (0.1, 1.5, 1.4), (-0.05, 1.55, 2.0)], 4), circle_prof(0.07, 6), None, False, None, True), color="#9A6648")
    for (dx, dy, dz, s) in ((0, 0, 2.3, 0.7), (0.5, 0.1, 1.9, 0.5), (-0.5, -0.1, 1.8, 0.5), (0.1, 0.4, 2.7, 0.4)):
        b.sphere(s, loc=(dx, 1.55 + dy, dz), nu=10, nv=7, color=G("#3DAA78", "#8CD66E", lo=1.6, hi=3.2), mat="VC_FOLIAGE", jit=0.7, nz=0.0)
    for k in range(3):
        a = k * 2.1
        b.sphere(0.12, loc=(0.7 * math.cos(a), 1.55 + 0.7 * math.sin(a), 2.0 + 0.2 * k), nu=6, nv=4, color=C["petal_pink"], mat="VC_FOLIAGE", nz=0)
    # watering can
    b.add(prim_cyl(0.16, 0.16, 0.26, 10, 0.02, 1), loc=(2.6, -1.4, 0.2), color="#2FB5A8", jit=0.4, base=True) if False else None
    b.cyl(0.16, 0.26, loc=(2.5, -1.2, 0.2), n=10, r=0.02, base=True, color="#2FB5A8", jit=0.4)
    b.rod((2.62, -1.2, 0.35), (2.95, -1.2, 0.6), 0.03, n=5, color="#2FB5A8", nz=0)
    # teal trim base band
    return fin(man, "common_town_greenhouse", b, "building", warp=dict(lean=(0.0, 0.0), wob=0.03, wscale=6.0, seed=6, fade_h=3), ao=0.4,
               extra={"note": "greenhouse: GLASS panes, front double door standing OPEN, simple interior (benches, pots, potted tree)", "interior": True},
               views=[("side", dict(azim=50, elev=22)), ("top", dict(azim=-10, elev=55))])


# ===================================================================================== lighthouse
@reg("common_town_lighthouse")
def lighthouse(man):
    b = Build("common_town_lighthouse")
    rng = b.rng
    # rock plinth
    rock = prim_sphere(5.4, 16, 10, sq=(1, 1, 0.26))
    for v in rock.verts:
        if v.co.z < 0:
            v.co.z = 0
        p = v.co * 0.6 + b.noff
        v.co += Vector((noise.noise(p), noise.noise(p + Vector((3, 1, 2))), 0.4 * noise.noise(p + Vector((7, 5, 1))))) * 0.5
        if v.co.z < 0:
            v.co.z = 0
    _recalc(rock)
    b.add(rock, loc=(0, 0, 0), color=G("#8E88A6", "#BDB8D4", lo=0, hi=1.5), mat="VC_ROUGH", jit=0.8, nz=0.08)
    ZB = 1.1
    R0, R1 = 3.1, 2.0
    H = 18.0
    n = 20
    # tapered tower, color-blocked bands (per-face by center height)
    prof = [(0, ZB)]
    steps = 12
    for i in range(steps + 1):
        z = i * H / steps
        prof.append((R0 + (R1 - R0) * z / H, ZB + z))
    prof.append((0, ZB + H))

    def bands(p, nn):
        z = p.z - ZB
        if nn.z > 0.8:
            return "#DAD6EA"
        k = int(z / 3.0)
        if z < 0.2:
            return STONE
        return "#FF7A6B" if k % 2 == 0 else "#FFF0D6"
    bands.per_face = True
    b.lathe(prof, n=n, color=bands, jit=0.5, nz=0.04)
    # tower stone foot ring
    b.cyl(R0 + 0.35, 0.7, loc=(0, 0, ZB), n=n, r=0.08, base=True, color=G(STONE_DK, STONE), jit=0.6)
    # windows spiraling up
    for k in range(7):
        z = 2.4 + k * 2.15
        ang = 90 + k * 50
        a = math.radians(ang)
        rr = R0 + (R1 - R0) * (z - ZB) / H if False else R0 + (R1 - R0) * ((z) / H)
        M = TR(rr * math.cos(a - math.pi / 2 * 0), rr * math.sin(a), ZB) @ RZ(ang + 90)
        window(b, M, 0, z, "round", 0.55, trim="#FFF6E6", lit=True)
    # door at front with step
    rr0 = R0 + 0.0
    door(b, TR(0, -(R0 - 0.02), ZB), 0, w=1.1, h=2.1, col="#2FB5A8")
    # gallery
    zg = ZB + H
    b.cyl(R1 + 1.15, 0.35, loc=(0, 0, zg - 0.2), n=24, r=0.08, base=True, r2=R1 + 0.9, color=G("#2A8F8C", "#2FB5A8"), jit=0.4)
    b.cyl(R1 + 0.9, 0.2, loc=(0, 0, zg - 0.45), n=24, base=True, color="#8E88A6", jit=0.4)
    for k in range(24):
        a = 2 * math.pi * k / 24
        rr = R1 + 1.05
        b.rod((rr * math.cos(a), rr * math.sin(a), zg + 0.15), (rr * math.cos(a), rr * math.sin(a), zg + 1.15), 0.04, n=5, color="#FFF0D6", nz=0)
    b.add(prim_ring(R1 + 1.05, [(-0.05, 0.05), (0.05, 0.05), (0.05, -0.05), (-0.05, -0.05)], segs=24), loc=(0, 0, zg + 1.15), color="#2FB5A8")
    b.add(prim_ring(R1 + 1.05, [(-0.04, 0.04), (0.04, 0.04), (0.04, -0.04), (-0.04, -0.04)], segs=24), loc=(0, 0, zg + 0.65), color="#FFF0D6")
    # lantern room
    LR = 1.45
    LH = 2.4
    b.cyl(LR + 0.1, 0.3, loc=(0, 0, zg + 0.15), n=14, r=0.05, base=True, color="#FFF0D6")
    b.cyl(LR - 0.05, LH, loc=(0, 0, zg + 0.45), n=14, r=0.0, base=True, color=G("#FFE2A8", "#FFFFFF", lo=zg, hi=zg + 3), mat="EMIT", nz=0)
    for k in range(8):
        a = 2 * math.pi * (k + 0.5) / 8
        b.box((0.12, 0.12, LH + 0.1), loc=((LR + 0.0) * math.cos(a), (LR + 0.0) * math.sin(a), zg + 0.45), r=0.02, base=True, rot=(0, 0, math.degrees(a)), color="#2FB5A8", nz=0)
    b.add(prim_ring(LR + 0.02, [(-0.08, 0.1), (0.1, 0.1), (0.1, -0.1), (-0.08, -0.1)], segs=14), loc=(0, 0, zg + 0.45 + LH), color="#2FB5A8")
    # roof dome
    rp = [(0, zg + 2.85), (LR + 0.55, zg + 2.85), (LR + 0.5, zg + 3.0), (LR - 0.2, zg + 3.9), (0.4, zg + 4.55), (0, zg + 4.7)]
    b.lathe(rp, n=14, color=G("#E2503F", "#FF8070", lo=zg + 2.8, hi=zg + 4.7), jit=0.4)
    b.sphere(0.2, loc=(0, 0, zg + 4.8), nu=10, nv=7, color=C["orange"], jit=0.3)
    b.rod((0, 0, zg + 4.9), (0, 0, zg + 6.1), 0.04, n=5, color="#3A3558", nz=0)
    # attached keeper's cottage at the foot (+X side)
    cx, cy = 3.8, -1.6
    house_ww, house_dd, house_hh = 3.6, 3.0, 1.9
    b.box((house_ww, house_dd, house_hh), loc=(cx, cy, ZB - 0.1), r=0.15, base=True, color=G("#FFC9A0", "#FFE6CC", lo=ZB, hi=ZB + 2), jit=0.5, rot=(0, 0, -8))
    sub = Build("tmp")
    # roof via direct slabs
    pitch = math.atan2(1.3, house_dd / 2)
    for sgn in (-1, 1):
        Lh = (house_dd / 2) / math.cos(pitch) + 0.4
        dirv = Vector((0, sgn * math.cos(pitch), -math.sin(pitch)))
        ctr = Vector((0, 0, 1.3)) + dirv * (Lh / 2)
        M = TR(cx, cy, ZB - 0.1 + house_hh) @ RZ(-8) @ TR(*ctr) @ RX(-sgn * math.degrees(pitch))
        b.add(prim_box(house_ww + 0.8, Lh, 0.22, 0.06, 1), matrix=M, color=G("#2A8F8C", "#5CCFC2"), jit=0.6)
    M = TR(cx, cy, ZB - 0.1) @ RZ(-8)
    b.add(prim_cyl(0.4, 0.4, 0.06, 12, 0, 1), matrix=M @ TR(0.9, -house_dd / 2 - 0.01, 1.2) @ RX(90), color=GLOW, mat="EMIT", nz=0)
    b.add(prim_cyl(0.46, 0.46, 0.05, 12, 0, 1), matrix=M @ TR(0.9, -house_dd / 2 - 0.005, 1.2) @ RX(90), color="#FFF6E6", nz=0)
    b.add(prim_box(0.8, 0.1, 1.5, 0.03, 1, base=True), matrix=M @ TR(-0.8, -house_dd / 2 - 0.02, 0), color="#FF7A6B")
    b.add(prim_cyl(0.4, 0.4, 0.1, 12, 0.0, 1), matrix=M @ TR(-0.8, -house_dd / 2 - 0.02, 1.5) @ RX(90), color="#FF7A6B")
    chimney(b, (cx + 1.2, cy + 0.6, ZB + 1.7), h=1.2, w=0.55, tilt=(4, 2))
    return fin(man, "common_town_lighthouse", b, "landmark", worlds=SHARD_WORLDS, warp=dict(lean=(0.003, 0.0), wob=0.1, wscale=9.0, seed=7, fade_h=10),
               ao=0.4, extra={"note": "~25 m lighthouse on a rock plinth with an attached keeper's cottage; lantern room is EMIT (rotate/light source node suggested at z~22)",
                              "lantern_y": round(ZB + H + 1.6, 2)},
               views=[("side", dict(azim=70, elev=12))], preview_kw=dict(frame=0.95))


# ===================================================================================== windmill
@reg("common_town_windmill")
def windmill(man):
    b = Build("common_town_windmill")
    n = 8
    ZB = 0.0
    prof = [(0, 0), (2.9, 0), (2.9, 0.15), (2.75, 0.2), (2.65, 1.4)]
    H = 8.4
    for i in range(1, 9):
        z = 1.4 + (H - 1.4) * i / 8
        prof.append((2.65 - (2.65 - 1.75) * (z - 1.4) / (H - 1.4), z))
    prof += [(0, H)]

    def wc(p, nn):
        if p.z < 1.35:
            return FaceG(STONE_DK, STONE, 0, 1.4)(p)
        return FaceG("#F2E3C4", "#FFF4DA", 1.4, H)(p)
    wc.per_face = True
    b.lathe(prof, n=n, color=wc, jit=0.5, nz=0.05)
    # timber rings & vertical beams
    for z in (3.6, 5.8):
        rr = 2.65 - (2.65 - 1.75) * (z - 1.4) / (H - 1.4) + 0.04
        b.add(prim_ring(rr / math.cos(math.pi / n), [(-0.05, 0.12), (0.1, 0.12), (0.1, -0.12), (-0.05, -0.12)], segs=n), loc=(0, 0, z), color=TIMBER, jit=0.4, nz=0.02)
    for k in range(n):
        a = 2 * math.pi * (k + 0.5) / n
        rr0, rr1 = 2.65, 1.75
        b.beam(((rr0 + 0.03) * math.cos(a) / math.cos(math.pi / n), (rr0 + 0.03) * math.sin(a) / math.cos(math.pi / n), 1.4),
               ((rr1 + 0.03) * math.cos(a) / math.cos(math.pi / n), (rr1 + 0.03) * math.sin(a) / math.cos(math.pi / n), H), 0.16, 0.12, r=0.03, color=TIMBER, jit=0.4)
    # door, windows
    door(b, TR(0, -2.52, 0), 0, w=1.1, h=2.0, col="#8E5BB5")
    for k, (ang, z) in enumerate(((-150, 3.6), (-30, 4.6), (90, 3.6), (30, 6.4), (150, 6.4))):
        a = math.radians(ang)
        rr = 2.65 - (2.65 - 1.75) * (z - 1.4) / (H - 1.4)
        rr = rr * 0.93
        M = TR(rr * math.cos(a), rr * math.sin(a), 0) @ RZ(ang + 90)
        window(b, M, 0, z, "round", 0.6, trim="#FFF6E6", lit=(k % 2 == 0))
    # cap (turret roof), slightly overhanging
    cp = [(0, H), (1.95, H), (2.05, H + 0.12), (1.85, H + 0.5), (1.5, H + 1.2), (0.9, H + 1.75), (0.35, H + 2.05), (0, H + 2.15)]
    b.lathe(cp, n=16, color=G("#7B5BCF", "#B79BF2", lo=H, hi=H + 2.1), jit=0.5)
    b.sphere(0.2, loc=(0, 0, H + 2.2), nu=10, nv=7, color=C["orange"], jit=0.3)
    # axle housing at front of cap
    b.cyl(0.55, 0.9, loc=(0, -1.6, H + 0.6), n=12, r=0.05, base=False, rot=(90, 0, 0), color=G("#B4BAD6", "#EDEFF7"), jit=0.3)
    b.sphere(0.5, loc=(0, -2.15, H + 0.6), nu=12, nv=8, color=TIMBER_DK)
    # little balcony ring around the tower mid
    b.add(prim_ring(2.45, [(-0.0, 0.05), (0.7, 0.05), (0.7, -0.05), (0.0, -0.05)], segs=n * 2), loc=(0, 0, 2.7), color=TIMBER, jit=0.4) if False else None
    # sacks by door
    for k, (x, y) in enumerate(((1.4, -3.0), (1.9, -2.8), (-1.5, -3.0))):
        b.sphere(0.32, loc=(x, y, 0.3), nu=10, nv=7, sq=(1, 0.9, 0.95), color="#F7EFE0", jit=0.4, nz=0.03)
        b.sphere(0.11, loc=(x, y, 0.58), nu=6, nv=4, color="#F7EFE0", nz=0)
    bld = fin_part_windmill(man, b, H)
    return bld


def build_blades():
    bb = Build("windmill_blades")
    L = 5.6
    # hub
    bb.sphere(0.5, loc=(0, 0, 0), nu=12, nv=8, color=TIMBER_DK)
    bb.add(prim_cyl(0.32, 0.32, 0.5, 12, 0.03, 1), loc=(0, -0.45, 0), rot=(90, 0, 0), color=C["orange"], jit=0.3)
    for k in range(4):
        ang = 90 * k + 18
        M = RY(ang)   # rotate about Y axis (axle) -> blade arms in the XZ plane
        # main spar
        bb.add(prim_box(0.28, 0.24, L, 0.05, 1), matrix=M @ TR(0, 0, 0.55 + L / 2), color=TIMBER_DK, jit=0.4)
        # lattice frame: two rails + rungs
        for sx in (0.3, 1.45):
            bb.add(prim_box(0.12, 0.12, L - 0.9, 0.02, 1), matrix=M @ TR(sx, -0.08, 1.2 + (L - 0.9) / 2), color=TIMBER, jit=0.4)
        for i in range(8):
            z = 1.3 + i * (L - 1.3) / 8
            bb.add(prim_box(1.4, 0.08, 0.08, 0.0, 1), matrix=M @ TR(0.87, -0.08, z), color=TIMBER, nz=0)
        # sail cloth panels (alternating colors) between rails
        for i in range(4):
            z = 1.4 + i * (L - 1.7) / 4
            col = ["#FFF0D6", "#FF7A6B"][(i + k) % 2]
            bb.add(prim_box(1.0, 0.04, (L - 1.7) / 4 - 0.04, 0.02, 1), matrix=M @ TR(0.87, -0.16, z + (L - 1.7) / 8), color=col, jit=0.4, nz=0.03)
        bb.add(prim_box(0.4, 0.3, 0.3, 0.05, 1), matrix=M @ TR(0, 0, 0.6), color=C["steel"])
    return bb.to_object("windmill_blades")


def fin_part_windmill(man, b, H):
    blades = build_blades()
    blades.location = (0, -2.65, H + 0.6)
    obj = b.to_object("common_town_windmill")
    b2 = None
    ex = {"separate_nodes": ["windmill_blades"],
          "blades": {"node": "windmill_blades", "pivot_blender": [0, -2.65, round(H + 0.6, 3)], "pivot_godot": [0.0, round(H + 0.6, 3), 2.65],
                     "spin_axis_godot": [0, 0, 1], "spin_axis_blender": [0, -1, 0],
                     "note": "node origin = axle center; rotate about its local Z (Godot) to spin; radius ~6.1 m"},
          "note": "windmill tower+cap; blades are a separate node so they can spin"}
    return finish(man, "common_town_windmill", obj, [blades], category="landmark", worlds=SHARD_WORLDS, collision="trimesh", ao=0.45,
                  origin="authored", extra=ex, views=[("side", dict(azim=70, elev=10)), ("front", dict(azim=0, elev=8))],
                  preview_kw=dict(frame=0.95))


# ===================================================================================== town props
@reg("common_town_well")
def well(man):
    b = Build("common_town_well")
    prof = [(0.0, 0.0), (1.12, 0.0), (1.12, 0.1), (1.06, 0.95), (1.14, 1.0), (1.14, 1.08), (0.78, 1.08), (0.72, 1.0), (0.72, 0.45)]

    def sc(p, nn):
        k = int((math.atan2(p.y, p.x) % (2 * math.pi)) / (2 * math.pi / 14))
        r = (k * 7919) % 5
        base = [STONE, "#C9C4DA", "#ADA8C0", "#BDB8CF", "#D3CFE2"][r]
        row = int(p.z / 0.27)
        return base if (row + k) % 2 == 0 else lerp_c(base, "#6A6488", 0.12)
    sc.per_face = True
    b.lathe(prof + [(0.0, 0.45)], n=14, cap=False, color=sc, jit=0.5, nz=0.06)
    b.add(prim_cyl(0.72, 0.72, 0.03, 14, 0, 1), loc=(0, 0, 0.62), color=G("#2A9DB8", "#7FD8E8"), mat="WATER", nz=0)
    for sx in (-1, 1):
        b.box((0.16, 0.16, 2.1), loc=(sx * 1.0, 0, 1.0), r=0.04, base=True, color=TIMBER, jit=0.5)
    b.add(prim_cyl(0.1, 0.1, 2.2, 8, 0, 1), loc=(0, 0, 2.0), rot=(0, 90, 0), color=TIMBER_DK, nz=0.02)
    for sx in (-1, 1):
        b.box((0.3, 0.4, 0.5), loc=(sx * 1.0, 0, 1.0 + 1.9), r=0.05, base=False, color=TIMBER_DK, rot=(0, 0, 0)) if False else None
    # mini roof
    pitch = math.atan2(0.8, 0.8)
    for sgn in (-1, 1):
        b.add(prim_box(2.7, 1.25, 0.14, 0.04, 1), loc=(0, sgn * 0.52, 3.0 + 0.4 - 0.4 * 0 + 0.0), rot=(-sgn * 45, 0, 0), color=G("#2A8F8C", "#5CCFC2"), jit=0.5)
    b.cyl(0.12, 2.8, loc=(0, 0, 3.55), n=8, rot=(0, 90, 0), color="#1F7C7A", nz=0)
    for sy in (-1, 1):
        b.add(prim_poly([(-0.6, 0), (0.6, 0), (0.0, 0.8)], 0.06, 0.0, 1, False), loc=(0, 0, 0), matrix=TR(0, 0, 0) @ Matrix(((0, 0, 1), (1, 0, 0), (0, 1, 0))).to_4x4() @ TR(0, 0, 0), color="#F4E4C8", nz=0) if False else None
    # rope + bucket
    b.rod((0.25, 0, 2.0), (0.25, 0, 1.2), 0.025, n=5, color="#C9A57E", nz=0)
    b.cyl(0.18, 0.28, loc=(0.25, 0, 0.95), r2=0.15, n=10, r=0.02, base=True, color=TIMBER, jit=0.4)
    b.add(prim_ring(0.17, [(-0.015, 0.015), (0.015, 0.015), (0.015, -0.015), (-0.015, -0.015)], segs=10, a0=0, a1=180), loc=(0.25, 0, 1.2), rot=(0, 90, 0), color="#3A3558", nz=0)
    b.cyl(0.07, 0.3, loc=(1.0, 0, 1.55), n=8, rot=(0, 90, 0), r=0.0, color=C["orange"], nz=0) if False else None
    return fin(man, "common_town_well", b, "town_prop", collision="auto_cyl", warp=dict(lean=(0.004, 0), wob=0.03, wscale=3, seed=8, fade_h=2),
               extra={"note": "WATER slot used for the surface; origin ground center"})


def stall_counter(b, w, d, h=0.95, col="#E8B07A"):
    b.box((w, d, h), loc=(0, 0, 0), r=0.06, base=True, color=G(lerp_c(col, "#3A2A5A", 0.15), col, lo=0, hi=h), jit=0.5)
    b.box((w + 0.12, d + 0.12, 0.08), loc=(0, 0, h), r=0.03, base=True, color=TIMBER, jit=0.4)


@reg("common_town_market_stall_a")
def stall_a(man):
    b = Build("common_town_market_stall_a")
    w, d = 3.0, 1.6
    stall_counter(b, w, d, 0.95, "#FFD2B0")
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box((0.12, 0.12, 2.6), loc=(sx * (w / 2 + 0.05), sy * (d / 2 + 0.05), 0), r=0.03, base=True, color=TIMBER, jit=0.5)
    # gabled striped awning over stall
    pitch = math.degrees(math.atan2(0.55, d / 2 + 0.3))
    for sgn in (-1, 1):
        for i in range(6):
            x = -w / 2 - 0.2 + (w + 0.4) * (i + 0.5) / 6
            col = ["#FF7A6B", "#FFF0D6"][i % 2]
            ln = math.hypot(d / 2 + 0.3, 0.55)
            b.add(prim_box((w + 0.4) / 6 - 0.01, ln, 0.08, 0.02, 1), loc=(x, sgn * (d / 2 + 0.3) / 2, 2.6 + 0.55 / 2 + 0.06), rot=(-sgn * pitch, 0, 0), color=col, jit=0.5, nz=0.02)
            b.add(prim_cyl(((w + 0.4) / 6) / 2, ((w + 0.4) / 6) / 2, 0.06, 8, 0, 1), loc=(x, sgn * (d / 2 + 0.34), 2.6 - 0.02), rot=(90, 0, 0), color=col, jit=0.4, nz=0.02)
    b.cyl(0.06, w + 0.5, loc=(0, 0, 3.2), n=6, rot=(0, 90, 0), color="#7A4E3A", nz=0)
    # produce crates on the counter
    rng = b.rng
    for k, (x, col, kind) in enumerate(((-1.0, "#E4503F", "apple"), (0.0, "#FFB02E", "orange"), (1.0, "#8CD66E", "pear"))):
        b.box((0.8, 0.55, 0.22), loc=(x, -0.1, 1.03), r=0.04, base=True, color=TIMBER, jit=0.4)
        for i in range(3):
            for j in range(2):
                b.sphere(0.14, loc=(x - 0.25 + i * 0.25, -0.28 + j * 0.3, 1.34), nu=8, nv=6, color=col, jit=0.5, nz=0.02)
    b.add(prim_box(0.6, 0.04, 0.4, 0.02, 1), loc=(0.0, -d / 2 - 0.08, 0.6), color="#F7EFE0", jit=0.3)
    b.box((0.4, 0.05, 0.08), loc=(0.0, -d / 2 - 0.11, 0.62), r=0, color="#FF7A6B", nz=0)
    lantern(b, (w / 2 + 0.05, -d / 2 - 0.1, 2.3))
    # floor crates
    b.box((0.7, 0.6, 0.5), loc=(-w / 2 - 0.65, -0.2, 0), r=0.05, base=True, color=TIMBER, jit=0.4, rot=(0, 0, 8))
    return fin(man, "common_town_market_stall_a", b, "town_prop", collision="auto_box", warp=dict(lean=(0.004, 0.003), wob=0.04, wscale=4, seed=9, fade_h=2),
               scatter=None, extra={"note": "front (counter side) faces Blender -Y"}, views=[("side", dict(azim=50, elev=20))])


@reg("common_town_market_stall_b")
def stall_b(man):
    b = Build("common_town_market_stall_b")
    R = 1.9
    # round table
    b.cyl(0.9, 0.95, loc=(0, 0, 0), n=14, r=0.05, base=True, color=G("#9573DD", "#C7B1F5", lo=0, hi=1), jit=0.5)
    b.cyl(1.0, 0.1, loc=(0, 0, 0.95), n=14, r=0.03, base=True, color=TIMBER, jit=0.4)
    b.cyl(0.08, 3.0, loc=(0, 0, 0), n=8, base=True, color="#7A4E3A", nz=0)
    # scalloped canopy (lathe, alternating panels)
    prof = [(0, 3.65), (0.5, 3.55), (1.4, 3.1), (R + 0.5, 2.55), (R + 0.5, 2.45)]
    def cc(p, nn):
        k = int((math.atan2(p.y, p.x) % (2 * math.pi)) / (2 * math.pi / 8))
        return ["#2FB5A8", "#FFF0D6"][k % 2]
    cc.per_face = True
    b.lathe(prof, n=16, cap=False, color=cc, jit=0.5, nz=0.03)
    for k in range(8):
        a = 2 * math.pi * (k + 0.5) / 8
        b.add(prim_cyl(0.52, 0.52, 0.06, 10, 0, 1), loc=((R + 0.45) * math.cos(a), (R + 0.45) * math.sin(a), 2.5), rot=(90, 0, math.degrees(a) + 90) if False else (90, 0, 0),
              color=["#2FB5A8", "#FFF0D6"][k % 2], jit=0.4, nz=0.02) if False else None
    b.sphere(0.16, loc=(0, 0, 3.7), nu=8, nv=6, color=C["orange"])
    # bunting ring: little flags hanging from rim
    cols = ["#FF7A6B", "#FFD166", "#7AE7FF", "#FF7AA8"]
    for k in range(16):
        a = 2 * math.pi * k / 16
        rr = R + 0.5
        px, py = rr * math.cos(a), rr * math.sin(a)
        b.add(prim_poly([(-0.14, 0), (0.14, 0), (0, -0.3)], 0.02, 0, 1, False), loc=(px, py, 2.45), rot=(90, 0, math.degrees(a) + 90), color=cols[k % 4], jit=0.3, nz=0)
    # wares: flower pots & baskets & fish crate
    for k in range(5):
        a = 2 * math.pi * k / 5 + 0.3
        pot_flowers(b, (0.55 * math.cos(a), 0.55 * math.sin(a), 1.05), 4, seed=k)
    b.add(prim_lathe([(0, 0), (0.3, 0), (0.38, 0.28), (0.32, 0.28), (0, 0.04)], 10, False), loc=(1.6, -1.0, 0), color="#E3C49C", jit=0.4)
    for k in range(4):
        b.sphere(0.12, loc=(1.6 + 0.12 * math.cos(k * 1.6), -1.0 + 0.12 * math.sin(k * 1.6), 0.32), nu=8, nv=6, color=["#FFD166", "#FF7AA8"][k % 2], jit=0.4, nz=0)
    b.add(prim_lathe([(0, 0), (0.3, 0), (0.38, 0.28), (0.32, 0.28), (0, 0.04)], 10, False), loc=(-1.7, -0.8, 0), color="#E3C49C", jit=0.4)
    for k in range(3):
        b.sphere(0.13, loc=(-1.7 + 0.12 * math.cos(k * 2.1), -0.8 + 0.12 * math.sin(k * 2.1), 0.32), nu=8, nv=6, color="#8CD66E", jit=0.4, nz=0)
    # stools
    b.cyl(0.3, 0.45, loc=(-1.5, 1.4, 0), n=10, r=0.03, base=True, color=TIMBER, jit=0.4)
    return fin(man, "common_town_market_stall_b", b, "town_prop", collision="auto_cyl", warp=dict(lean=(0.003, -0.003), wob=0.04, wscale=4, seed=10, fade_h=2),
               extra={"note": "round parasol-style stall with scalloped canopy (lavender/teal) and flower wares"}, views=[("side", dict(azim=50, elev=22))])


@reg("common_town_lamppost")
def lamppost(man):
    b = Build("common_town_lamppost")
    b.add(prim_lathe([(0, 0), (0.3, 0), (0.3, 0.12), (0.2, 0.25), (0.12, 0.5), (0.1, 0.7), (0.07, 0.8), (0.07, 3.3), (0.1, 3.4), (0.1, 3.5), (0, 3.5)], 10, True), color=G("#1F6F6E", "#2FB5A8", lo=0, hi=3.5), jit=0.4)
    b.cyl(0.12, 0.08, loc=(0, 0, 2.9), n=10, base=True, color=C["orange"], jit=0.3)
    # curl bracket
    b.add(prim_sweep(catmull([(0, 0, 3.0), (0.2, 0, 3.4), (0.5, 0, 3.55), (0.75, 0, 3.4)], 5), circle_prof(0.04, 6), None, False, None, True), color="#1F6F6E")
    b.add(prim_sweep(catmull([(0, 0, 3.4), (-0.25, 0, 3.5), (-0.45, 0, 3.35)], 5), circle_prof(0.035, 6), None, False, None, True), color="#1F6F6E")
    # lantern
    lx, lz = 0.75, 3.15
    b.box((0.34, 0.34, 0.12), loc=(lx, 0, lz), r=0.03, base=True, color="#2A8F8C")
    b.sphere(0.2, loc=(lx, 0, lz + 0.33), nu=12, nv=8, color=G("#FFD58A", "#FFF0C8", lo=lz + 0.1, hi=lz + 0.55), mat="EMIT", nz=0)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        b.rod((lx + 0.19 * math.cos(a), 0.19 * math.sin(a), lz + 0.12), (lx + 0.17 * math.cos(a), 0.17 * math.sin(a), lz + 0.5), 0.018, n=4, color="#1F6F6E", nz=0)
    b.add(prim_lathe([(0, lz + 0.52), (0.26, lz + 0.52), (0.2, lz + 0.62), (0.05, lz + 0.78), (0, lz + 0.82)], 8, True), loc=(lx, 0, 0), color="#2A8F8C", jit=0.3)
    b.sphere(0.05, loc=(lx, 0, lz + 0.84), nu=6, nv=4, color=C["orange"])
    return fin(man, "common_town_lamppost", b, "town_prop", collision="auto_cyl", warp=dict(lean=(0.006, 0.0), wob=0.0, seed=11, fade_h=3), ao=0.35,
               extra={"note": "EMIT bulb; arm points +X", "light_offset_godot": [0.75, 3.5, 0.0]})


@reg("common_town_fence_a")
def fence_a(man):
    b = Build("common_town_fence_a")
    rng = b.rng
    L = 3.0
    for x in (-L / 2, L / 2):
        b.box((0.18, 0.18, 1.2), loc=(x, 0, 0), r=0.03, base=True, color="#FFF0D6", jit=0.3)
        b.sphere(0.12, loc=(x, 0, 1.28), nu=8, nv=6, color="#FFF6E6")
    for z in (0.3, 0.8):
        b.box((L, 0.07, 0.1), loc=(0, 0.1, z), r=0.02, base=True, color="#E8D9BE", jit=0.3)
    n = 11
    for i in range(n):
        x = -L / 2 + 0.25 + (L - 0.5) * i / (n - 1)
        h = 1.0 + rng.uniform(-0.05, 0.06)
        b.add(prim_poly([(-0.07, 0), (0.07, 0), (0.07, h - 0.1), (0, h + 0.07), (-0.07, h - 0.1)], 0.05, 0.015, 1, True), loc=(x, -0.02, 0.05),
              matrix=None, rot=(90, 0, rng.uniform(-3, 3)), color=G("#F2E4C8", "#FFF8EA", lo=0, hi=1.2), jit=0.5, nz=0.02)
    return fin(man, "common_town_fence_a", b, "town_prop", collision="auto_box", warp=dict(lean=(0.0, 0.0), wob=0.03, wscale=2.5, seed=12, fade_h=1),
               ao=0.4, extra={"note": "3 m picket segment along X, posts at both ends (share posts when chaining)", "segment_length": 3.0})


@reg("common_town_fence_b")
def fence_b(man):
    b = Build("common_town_fence_b")
    rng = b.rng
    L = 3.0
    for x in (-L / 2, 0.0, L / 2):
        h = 1.15 + rng.uniform(-0.1, 0.1)
        b.box((0.2, 0.2, h), loc=(x, 0, 0.1), r=0.06, base=True, color=G("#7A4E3A", "#A9754F"), jit=0.6, rot=(rng.uniform(-3, 3), rng.uniform(-3, 3), rng.uniform(0, 20)))
        b.box((0.45, 0.4, 0.22), loc=(x, 0, 0), r=0.07, base=True, color=G(STONE_DK, STONE), jit=0.6)
    for z, dz in ((0.45, 0.04), (0.85, -0.03)):
        b.add(prim_sweep([Vector((-L / 2, 0.14, z)), Vector((-L / 4, 0.14, z + dz)), Vector((0, 0.14, z - dz)), Vector((L / 4, 0.14, z + dz)), Vector((L / 2, 0.14, z))],
                         rrect(0.12, 0.09, 0.03, 1)), color="#B9825A", jit=0.5, nz=0.04)
    b.add(prim_sweep([Vector((-L / 2, -0.14, 0.65)), Vector((0, -0.14, 0.62)), Vector((L / 2, -0.14, 0.67))], rrect(0.12, 0.09, 0.03, 1)), color="#9A6648", jit=0.5)
    return fin(man, "common_town_fence_b", b, "town_prop", collision="auto_box", warp=dict(lean=(0.0, 0.0), wob=0.05, wscale=2.5, seed=13, fade_h=1),
               ao=0.4, extra={"note": "3 m rustic post-and-rail segment along X on stone footings", "segment_length": 3.0})


@reg("common_town_gate")
def gate(man):
    b = Build("common_town_gate")
    for x in (-1.0, 1.0):
        b.box((0.22, 0.22, 1.5), loc=(x, 0, 0), r=0.04, base=True, color="#FFF0D6", jit=0.3)
        b.sphere(0.14, loc=(x, 0, 1.58), nu=8, nv=6, color="#FFF6E6")
    # gate leaf with arched top rail
    for i in range(8):
        x = -0.78 + i * 0.22
        h = 0.95 + 0.25 * math.sin(math.pi * (i / 7))
        b.add(prim_poly([(-0.07, 0), (0.07, 0), (0.07, h - 0.1), (0, h + 0.07), (-0.07, h - 0.1)], 0.05, 0.015, 1, True), loc=(x, -0.03, 0.12), rot=(90, 0, 0),
              color=G("#F2E4C8", "#FFF8EA", lo=0, hi=1.4), jit=0.5, nz=0.02)
    b.add(prim_sweep([Vector((-0.85, 0.04, 0.35)), Vector((0.85, 0.04, 0.35))], rrect(0.1, 0.08, 0.02, 1)), color="#E8D9BE")
    pts = [Vector((-0.85 + 1.7 * t / 8, 0.04, 0.85 + 0.25 * math.sin(math.pi * t / 8))) for t in range(9)]
    b.add(prim_sweep(pts, rrect(0.1, 0.08, 0.02, 1)), color="#E8D9BE")
    b.beam((-0.8, 0.07, 0.35), (0.8, 0.07, 1.0), 0.09, 0.05, r=0.0, color="#E8D9BE")
    for z in (0.4, 1.0):
        b.box((0.3, 0.05, 0.08), loc=(-0.88, 0.0, z), r=0.0, base=True, color="#3A3558", nz=0)
    b.sphere(0.05, loc=(0.75, -0.04, 0.8), nu=6, nv=4, color="#F2C14E", nz=0)
    return fin(man, "common_town_gate", b, "town_prop", collision="auto_box", warp=dict(lean=(0.0, 0.0), wob=0.03, wscale=2.5, seed=14, fade_h=1),
               ao=0.4, extra={"note": "garden gate between two posts (2.2 m wide), matches fence_a"})


@reg("common_town_bench")
def bench(man):
    b = Build("common_town_bench")
    L = 1.7
    for i in range(3):
        b.box((L, 0.15, 0.06), loc=(0, -0.18 + i * 0.17, 0.5), r=0.02, base=True, color=G("#C9966B", "#E3B88C"), jit=0.6)
    for i in range(2):
        b.box((L, 0.05, 0.14), loc=(0, 0.3, 0.7 + i * 0.2), r=0.02, base=True, rot=(-12, 0, 0), color=G("#C9966B", "#E3B88C"), jit=0.6)
    for sx in (-1, 1):
        x = sx * (L / 2 - 0.1)
        b.add(prim_sweep(catmull([(x, -0.28, 0.0), (x, -0.25, 0.48), (x, 0.0, 0.5), (x, 0.28, 0.5), (x, 0.34, 1.0)], 4), rrect(0.06, 0.05, 0.015, 1), None, False, None, True), color="#2FB5A8", jit=0.3)
        b.sphere(0.06, loc=(x, 0.34, 1.02), nu=6, nv=4, color=C["orange"])
        b.add(prim_sweep(catmull([(x, -0.26, 0.5), (x, -0.3, 0.6), (x, -0.2, 0.68)], 4), rrect(0.05, 0.04, 0.01, 1), None, False, None, True), color="#2FB5A8")
    return fin(man, "common_town_bench", b, "town_prop", collision="auto_box", warp=dict(lean=(0.0, 0.0), wob=0.02, wscale=2, seed=15, fade_h=1), ao=0.4,
               extra={"note": "seat faces Blender -Y (Godot +Z)"})


@reg("common_town_signpost")
def signpost(man):
    b = Build("common_town_signpost")
    b.box((0.2, 0.2, 2.6), loc=(0, 0, 0.2), r=0.05, base=True, color=G("#7A4E3A", "#A9754F"), jit=0.5)
    b.box((0.6, 0.6, 0.25), loc=(0, 0, 0), r=0.07, base=True, color=G(STONE_DK, STONE), jit=0.6)
    b.sphere(0.14, loc=(0, 0, 2.95), nu=8, nv=6, color=C["orange"])
    for (z, col, dirn, s) in ((2.5, "#2FB5A8", 1, 5), (2.0, "#FF7A6B", -1, -4)):
        pts = [(-0.7, -0.17), (0.6, -0.17), (0.95, 0.0), (0.6, 0.17), (-0.7, 0.17)]
        pts = [(p[0] * dirn, p[1]) for p in pts]
        if dirn < 0:
            pts = pts[::-1]
        b.add(prim_poly(pts, 0.06, 0.02, 1, False), loc=(0, -0.14, z), rot=(90, 0, s), color=G(lerp_c(col, "#3A2A5A", 0.1), lerp_c(col, "#FFFFFF", 0.15)), jit=0.4, nz=0.02)
        b.box((0.9, 0.025, 0.05), loc=(dirn * 0.1, -0.19, z + 0.04), r=0, color="#FFF0D6", nz=0, rot=(0, s, 0))
    b.box((0.5, 0.06, 0.4), loc=(0.0, 0.14, 1.4), r=0.03, base=False, color="#F4E4C8", rot=(0, 0, 0)) if False else None
    lantern(b, (0.26, 0.0, 1.65))
    return fin(man, "common_town_signpost", b, "town_prop", collision="auto_cyl", warp=dict(lean=(0.01, 0.0), wob=0.02, wscale=2, seed=16, fade_h=1), ao=0.4,
               extra={"note": "two arrow planks; small EMIT lantern"})


@reg("common_town_mailbox")
def mailbox(man):
    b = Build("common_town_mailbox")
    b.box((0.14, 0.14, 1.1), loc=(0, 0, 0), r=0.03, base=True, color=G("#7A4E3A", "#A9754F"), jit=0.5)
    b.box((0.5, 0.5, 0.12), loc=(0, 0, 0), r=0.04, base=True, color=G(STONE_DK, STONE), jit=0.5)
    # body: half-cylinder topped box
    b.box((0.36, 0.55, 0.24), loc=(0, -0.05, 1.1), r=0.04, base=True, color="#FF7A6B", jit=0.4)
    b.add(prim_cyl(0.18, 0.18, 0.55, 12, 0.0, 1), loc=(0, -0.05, 1.34), rot=(90, 0, 0), color=G("#FF7A6B", "#FF9A8B", lo=1.2, hi=1.55), jit=0.4)
    b.add(prim_cyl(0.19, 0.19, 0.04, 12, 0.0, 1), loc=(0, -0.33, 1.34), rot=(90, 0, 0), color="#F7EFE0", nz=0)
    b.box((0.2, 0.025, 0.12), loc=(0, -0.335, 1.18), r=0, base=True, color="#3A3558", nz=0)
    b.box((0.04, 0.04, 0.35), loc=(0.2, 0.1, 1.18), r=0.01, base=True, color="#FFC13D", jit=0.2)
    b.box((0.16, 0.04, 0.12), loc=(0.2, 0.1, 1.48), r=0.01, base=True, color="#FFC13D", jit=0.2)
    return fin(man, "common_town_mailbox", b, "town_prop", collision="auto_cyl", warp=dict(lean=(0.012, 0.0), wob=0.0, seed=17, fade_h=1), ao=0.4,
               extra={"note": "opening faces Blender -Y"})


@reg("common_town_bridge")
def bridge(man):
    b = Build("common_town_bridge")
    L, W, A = 10.0, 3.0, 1.5
    n = 36

    def zc(x):
        return 0.32 + A * (1 - (x / (L / 2)) ** 2) ** 1.0 * 1.0

    def slope(x):
        return math.degrees(math.atan2(-2 * A * x / (L / 2) ** 2, 1))
    rng = b.rng
    # planks
    for i in range(n):
        x = -L / 2 + 0.2 + (L - 0.4) * (i + 0.5) / n
        b.box((0.26, W, 0.12), loc=(x, 0, zc(x)), r=0.03, rot=(0, -slope(x) * -1, 0) if False else (0, slope(x), 0), color=G("#C9966B", "#E3B88C"), jit=0.9, nz=0.04)
    # side stringers (arched beams)
    for sy in (-1, 1):
        pts = [Vector((-L / 2 - 0.2 + (L + 0.4) * i / 16, sy * (W / 2 - 0.1), zc(max(-L / 2, min(L / 2, -L / 2 - 0.2 + (L + 0.4) * i / 16))) - 0.3)) for i in range(17)]
        b.add(prim_sweep(pts, rrect(0.18, 0.4, 0.05, 1), up=Vector((0, 1, 0)) if False else None), color=G("#7A4E3A", "#A9754F", lo=0, hi=2), jit=0.5, nz=0.03)
    # railings
    for sy in (-1, 1):
        y = sy * (W / 2 - 0.1)
        for k in range(9):
            x = -L / 2 + 0.3 + (L - 0.6) * k / 8
            b.box((0.12, 0.12, 1.0), loc=(x, y, zc(x)), r=0.03, base=True, color=G("#7A4E3A", "#B9825A"), jit=0.5)
            b.sphere(0.08, loc=(x, y, zc(x) + 1.02), nu=6, nv=4, color="#E8D9BE", nz=0)
        top = [Vector((-L / 2 + 0.3 + (L - 0.6) * i / 12, y, zc(-L / 2 + 0.3 + (L - 0.6) * i / 12) + 0.95)) for i in range(13)]
        mid = [Vector((p.x, p.y, p.z - 0.4)) for p in top]
        b.add(prim_sweep(top, rrect(0.1, 0.08, 0.025, 1)), color="#E8D9BE", jit=0.3)
        b.add(prim_sweep(mid, rrect(0.08, 0.06, 0.02, 1)), color="#B9825A", jit=0.3)
    # abutments + piles
    for sx in (-1, 1):
        b.box((1.0, W + 0.5, 0.5), loc=(sx * (L / 2 + 0.3), 0, 0), r=0.1, base=True, color=G(STONE_DK, STONE), jit=0.7)
        for sy in (-1, 1):
            b.cyl(0.16, 1.2, loc=(sx * (L / 2 - 0.5), sy * (W / 2 - 0.15), 0), n=8, base=True, color=TIMBER_DK, jit=0.4)
    # lanterns on end posts
    for sx in (-1, 1):
        b.box((0.2, 0.2, 1.6), loc=(sx * (L / 2 - 0.1), W / 2 - 0.1, 0.3), r=0.04, base=True, color="#7A4E3A")
        lantern(b, (sx * (L / 2 - 0.1), W / 2 - 0.1, 1.9))
    return fin(man, "common_town_bridge", b, "town_prop", collision="trimesh", warp=dict(lean=(0, 0), wob=0.04, wscale=5, seed=18, fade_h=1), ao=0.4,
               extra={"note": "humpback wooden bridge along X: ends at z~0.3, crest z~1.8; width 3 m, length ~10 m (+1 m abutments each side)", "walkable": True},
               views=[("side", dict(azim=75, elev=10))])


@reg("common_town_dock")
def dock(man):
    b = Build("common_town_dock")
    rng = b.rng
    L, W, Zd = 4.0, 2.4, 1.0
    for i in range(18):
        x = -L / 2 + 0.11 + (L - 0.22) * i / 17
        b.box((0.19, W, 0.1), loc=(x, 0, Zd + rng.uniform(-0.01, 0.015)), r=0.02, base=True, color=G("#B9825A", "#E3B88C"), jit=0.9, nz=0.05,
              rot=(0, 0, rng.uniform(-1.2, 1.2)))
    for sy in (-1, 1):
        b.box((L + 0.2, 0.18, 0.16), loc=(0, sy * (W / 2 - 0.12), Zd - 0.16), r=0.03, base=True, color=TIMBER_DK, jit=0.4)
    for x in (-L / 2 + 0.2, 0, L / 2 - 0.2):
        for sy in (-1, 1):
            b.cyl(0.14, 1.9, loc=(x, sy * (W / 2 - 0.1), 0.0), n=8, r=0.02, base=True, color=G("#5C3A2C", "#8A5A44", lo=0, hi=2), jit=0.5, r2=0.12)
        b.box((0.14, W, 0.14), loc=(x, 0, Zd - 0.3), r=0.03, base=True, color=TIMBER_DK)
    # bollards + rope
    for x, sy in ((L / 2 - 0.35, 1), (-L / 2 + 0.35, -1)):
        b.cyl(0.13, 0.4, loc=(x, sy * (W / 2 - 0.2), Zd + 0.1), n=8, r=0.03, base=True, color="#3A3558")
        b.cyl(0.19, 0.08, loc=(x, sy * (W / 2 - 0.2), Zd + 0.45), n=8, base=True, color="#3A3558")
    b.add(prim_sweep(catmull([(L / 2 - 0.35, W / 2 - 0.2, Zd + 0.3), (L / 2 - 0.8, W / 2 + 0.05, Zd + 0.12), (L / 2 - 1.2, W / 2 + 0.0, Zd + 0.11), (L / 2 - 1.6, W / 2 - 0.4, Zd + 0.11)], 5),
                     circle_prof(0.045, 6), None, False, None, True), color="#D9B98C")
    b.add(prim_ring(0.22, [(-0.07, 0.07), (0.07, 0.07), (0.07, -0.07), (-0.07, -0.07)], segs=12), loc=(-0.2, -0.4, Zd + 0.1), color="#D9B98C", jit=0.4)
    b.add(prim_ring(0.15, [(-0.07, 0.07), (0.07, 0.07), (0.07, -0.07), (-0.07, -0.07)], segs=12), loc=(-0.2, -0.4, Zd + 0.2), color="#D9B98C", jit=0.4)
    # lantern post & crate
    b.box((0.12, 0.12, 1.2), loc=(-L / 2 + 0.2, W / 2 - 0.2, Zd + 0.1), r=0.03, base=True, color=TIMBER_DK)
    lantern(b, (-L / 2 + 0.2, W / 2 - 0.2, Zd + 1.3))
    b.box((0.55, 0.45, 0.4), loc=(1.1, 0.6, Zd + 0.1), r=0.05, base=True, color=TIMBER, jit=0.5, rot=(0, 0, 14))
    return fin(man, "common_town_dock", b, "town_prop", collision="trimesh", warp=dict(lean=(0, 0), wob=0.02, wscale=3, seed=19, fade_h=1), ao=0.4,
               extra={"note": "pier segment 4 m long along X (open end at +X), deck at z=1.0, piles reach z=0 (place with water surface ~z=0.3)", "segment_length": 4.0})


def boat_station(t, k=0.0):
    """Cross-section parameters at t in [-1,1] along the hull (bow at +1)."""
    e = abs(t)
    hw = 0.66 * max(0.03, (1 - e ** 2.3)) ** 0.55 - k
    dp = 0.5 * (1 - 0.25 * e * e) - k * 0.8
    zs = 0.56 + 0.38 * e ** 2.6 + (0.1 * e if t > 0 else 0.0)
    return hw, dp, zs


@reg("common_town_rowboat")
def rowboat(man):
    b = Build("common_town_rowboat")
    L = 1.65
    n = 24
    m = 8
    bm = bmesh.new()
    rings = []
    for i in range(n + 1):
        t = -1 + 2 * i / n
        x = L * t
        hw, dp, zs = boat_station(t)
        hi, di, zi = boat_station(t, 0.07)
        ring = []
        for j in range(m + 1):          # outer, port sheer -> keel -> starboard sheer
            a = math.pi * j / m
            ring.append(bm.verts.new((x, -hw * math.cos(a), zs - dp * math.sin(a))))
        for j in range(m, -1, -1):      # inner back
            a = math.pi * j / m
            ring.append(bm.verts.new((x, -max(hi, 0.01) * math.cos(a), zs - 0.02 - max(di, 0.02) * math.sin(a))))
        rings.append(ring)
    P = len(rings[0])
    for i in range(n):
        for j in range(P):
            bm.faces.new((rings[i][j], rings[i][(j + 1) % P], rings[i + 1][(j + 1) % P], rings[i + 1][j]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    _recalc(bm)

    def hc(p, nn):
        z = p.z
        if abs(nn.z) > 0.6 and nn.z > 0 and z > 0.1:
            return "#C9966B"
        return FaceG("#1F8A86", "#3FC4B5", 0.0, 0.9)(p)
    hc.per_face = True
    b.add(bm, color=hc, jit=0.5, nz=0.04)
    # coral sheer stripe on both sides
    for sy in (-1, 1):
        pts = []
        for i in range(n + 1):
            t = -1 + 2 * i / n
            hw, dp, zs = boat_station(t)
            pts.append(Vector((L * t, sy * (hw - 0.01), zs - 0.02)))
        b.add(prim_sweep(pts, rrect(0.09, 0.1, 0.03, 1), None, False, Vector((0, 0, 1)), True), color="#FF7A6B", jit=0.3, nz=0)
    # inside floor, seats, oarlocks
    b.box((2.1, 0.62, 0.04), loc=(0, 0, 0.11), r=0.01, base=True, color="#C9966B", jit=0.5)
    for x in (-0.6, 0.35):
        hw, dp, zs = boat_station(x / L)
        b.box((0.3, 2 * hw - 0.06, 0.07), loc=(x, 0, 0.36), r=0.02, base=True, color="#E3B88C", jit=0.5)
    hw0, _, zs0 = boat_station(-0.05)
    for sy in (-1, 1):
        b.rod((0.0, sy * (hw0 + 0.04), zs0 - 0.05), (0.0, sy * (hw0 + 0.04), zs0 + 0.18), 0.025, n=5, color="#3A3558", nz=0)
    # oars resting across the seats
    b.rod((-0.5, 1.05, 0.52), (0.5, -1.05, 0.58), 0.035, n=6, color="#E3B88C", nz=0)
    b.add(prim_box(0.14, 0.5, 0.025, 0.01, 1), loc=(0.55, -1.12, 0.58), rot=(0, 0, -25), color="#FF7A6B", nz=0)
    b.add(prim_box(0.14, 0.5, 0.025, 0.01, 1), loc=(-0.55, 1.12, 0.52), rot=(0, 0, -25), color="#FF7A6B", nz=0)
    # coiled bow rope + little lantern at the bow
    b.add(prim_ring(0.18, [(-0.05, 0.05), (0.05, 0.05), (0.05, -0.05), (-0.05, -0.05)], segs=12), loc=(1.15, 0.0, 0.17), color="#D9B98C", jit=0.4)
    b.add(prim_ring(0.12, [(-0.05, 0.05), (0.05, 0.05), (0.05, -0.05), (-0.05, -0.05)], segs=12), loc=(1.15, 0.0, 0.27), color="#D9B98C", jit=0.4)
    lantern(b, (-1.3, 0.0, 0.62))
    return fin(man, "common_town_rowboat", b, "town_prop", collision="convex", origin="bbox_base", ao=0.45,
               extra={"note": "small rowboat ~3.4 m long along X, bow at +X; origin = bbox bottom center (keel at z=0); stern lantern is EMIT"},
               views=[("side", dict(azim=70, elev=20))])


@reg("common_town_planter")
def planter(man):
    b = Build("common_town_planter")
    rng = b.rng
    b.box((1.3, 0.45, 0.45), loc=(0, 0, 0), r=0.05, base=True, color=G("#A9754F", "#C9966B"), jit=0.6)
    for x in (-0.55, 0.55):
        b.box((0.06, 0.48, 0.3), loc=(x, 0, 0.05), r=0.01, base=True, color="#7A4E3A", nz=0)
    b.box((1.2, 0.36, 0.05), loc=(0, 0, 0.44), r=0.01, base=True, color="#6B4A3A", nz=0)
    for k in range(9):
        x = -0.55 + 0.137 * k
        y = rng.uniform(-0.1, 0.1)
        h = rng.uniform(0.12, 0.28)
        b.sphere(0.13, loc=(x, y, 0.5), nu=7, nv=5, sq=(1, 1, 0.9), color=C["leaf"], mat="VC_FOLIAGE", jit=0.7, nz=0)
        b.rod((x, y, 0.5), (x + rng.uniform(-0.04, 0.04), y, 0.5 + h), 0.012, n=4, color=C["leaf"], mat="VC_FOLIAGE", nz=0)
        b.sphere(0.1, loc=(x, y, 0.55 + h), nu=7, nv=5, color=[C["petal_pink"], C["petal_yel"], C["petal_cyan"], "#FF7A6B", "#FFFFFF"][k % 5], mat="VC_FOLIAGE", jit=0.4, nz=0)
    return fin(man, "common_town_planter", b, "town_prop", collision="auto_box", ao=0.4,
               scatter={"density": 0.4, "slope_max": 10, "min_spacing": 3.0, "cluster": 0.5, "zone": "plaza"},
               extra={"note": "flowers/leaves use VC_FOLIAGE (wind sway)"})


@reg("common_town_cart")
def cart(man):
    b = Build("common_town_cart")
    # bed
    b.box((1.7, 1.0, 0.1), loc=(0, 0, 0.55), r=0.03, base=True, color="#C9966B", jit=0.5)
    for sy in (-1, 1):
        for i in range(3):
            b.box((1.7, 0.05, 0.14), loc=(0, sy * 0.5, 0.65 + i * 0.16), r=0.015, base=True, color=["#E3B88C", "#C9966B"][i % 2], jit=0.5)
    for sx in (-1, 1):
        for i in range(3):
            b.box((0.05, 1.0, 0.14), loc=(sx * 0.85, 0, 0.65 + i * 0.16) if sx == -1 else (sx * 0.85, 0, 0.65 + i * 0.16), r=0.015, base=True, color=["#E3B88C", "#C9966B"][i % 2], jit=0.5)
        for sy in (-1, 1):
            b.box((0.09, 0.09, 0.62), loc=(sx * 0.85, sy * 0.5, 0.63), r=0.02, base=True, color=TIMBER_DK)
    # wheels
    for sy in (-1, 1):
        M = TR(0, sy * 0.66, 0.45) @ RX(90)
        b.add(prim_ring(0.42, [(-0.05, 0.05), (0.05, 0.05), (0.05, -0.05), (-0.05, -0.05)], segs=18), matrix=M, color="#B9825A", jit=0.4)
        b.add(prim_cyl(0.1, 0.1, 0.14, 8, 0, 1), matrix=M, color="#3A3558", nz=0)
        for k in range(6):
            a = k * 60
            b.add(prim_box(0.06, 0.05, 0.8, 0.01, 1), matrix=M @ RY(0) @ Matrix.Rotation(math.radians(a), 4, "Y") if False else M @ Matrix.Rotation(math.radians(a), 4, "Y") @ TR(0, 0, 0), color="#C9966B", nz=0) if False else None
        for k in range(3):
            a = k * 60
            b.add(prim_box(0.8, 0.05, 0.06, 0.01, 1), matrix=M @ Matrix.Rotation(math.radians(a), 4, "Z"), color="#C9966B", nz=0)
    b.rod((0, -0.7, 0.45), (0, 0.7, 0.45), 0.04, n=6, color="#3A3558", nz=0)
    # handles
    for sy in (-1, 1):
        b.beam((0.8, sy * 0.4, 0.6), (2.1, sy * 0.4, 0.25), 0.08, 0.08, r=0.02, color=TIMBER)
    b.rod((2.1, -0.4, 0.2), (2.1, 0.4, 0.2), 0.04, n=6, color=TIMBER, nz=0)
    b.beam((1.6, -0.4, 0.3), (1.75, -0.4, 0.0), 0.05, 0.05, r=0.01, color=TIMBER_DK)
    b.beam((1.6, 0.4, 0.3), (1.75, 0.4, 0.0), 0.05, 0.05, r=0.01, color=TIMBER_DK)
    # load: hay + sacks
    rng = b.rng
    for i in range(7):
        b.sphere(0.34, loc=(-0.5 + rng.uniform(0, 1.0), rng.uniform(-0.3, 0.3), 1.0 + rng.uniform(0, 0.3)), nu=9, nv=6, sq=(1.2, 1.0, 0.8),
                 color=G("#E0B84E", "#FFE08A", lo=0.9, hi=1.5), jit=0.7, nz=0.04)
    b.sphere(0.3, loc=(-0.45, 0.35, 1.1), nu=8, nv=6, sq=(1, 0.9, 0.95), color="#F7EFE0", jit=0.4)
    return fin(man, "common_town_cart", b, "town_prop", collision="auto_box", origin="authored", warp=dict(lean=(0, 0), wob=0.02, wscale=3, seed=20, fade_h=1), ao=0.45,
               extra={"note": "hand cart, handles toward +X, tipped on a prop stick"})


@reg("common_town_hay_bale")
def hay_bale(man):
    b = Build("common_town_hay_bale")
    b.add(prim_cyl(0.55, 0.55, 0.9, 16, 0.08, 1), loc=(0, 0, 0.55), rot=(0, 90, 0), color=G("#E0B84E", "#FFE08A", lo=0, hi=1.1), jit=0.8, nz=0.08)
    for x in (-0.25, 0.25):
        b.add(prim_cyl(0.57, 0.57, 0.05, 16, 0.0, 1), loc=(x, 0, 0.55), rot=(0, 90, 0), color="#B9825A", jit=0.4, nz=0)
    return fin(man, "common_town_hay_bale", b, "town_prop", collision="auto_cyl", ao=0.45,
               scatter={"density": 0.3, "slope_max": 12, "min_spacing": 3.0, "cluster": 0.6, "zone": "plaza"})


@reg("common_town_bunting")
def bunting(man):
    b = Build("common_town_bunting")
    L = 4.0
    pts = [Vector((-L / 2 + L * i / 10, 0, 2.6 - 0.45 * math.sin(math.pi * i / 10))) for i in range(11)]
    b.add(prim_sweep(pts, circle_prof(0.02, 5)), color="#3A3558", nz=0)
    cols = ["#FF7A6B", "#FFD166", "#7AE7FF", "#FF7AA8", "#8CD66E"]
    for i in range(1, 10):
        p = pts[i]
        b.add(prim_poly([(-0.16, 0), (0.16, 0), (0, -0.4)], 0.015, 0, 1, False), loc=(p.x, 0, p.z - 0.02), rot=(90, 0, 0), color=cols[i % 5], jit=0.3, nz=0)
    for x in (-L / 2, L / 2):
        b.cyl(0.05, 2.7, loc=(x, 0, 0), n=6, base=True, color=TIMBER_DK, nz=0)
        b.sphere(0.08, loc=(x, 0, 2.72), nu=6, nv=4, color=C["orange"])
    return fin(man, "common_town_bunting", b, "town_prop", collision="none", ao=0.3,
               extra={"note": "two thin poles with a flag string between (4 m along X); poles have no collision"})


@reg("common_town_garden_wall")
def garden_wall(man):
    b = Build("common_town_garden_wall")
    rng = b.rng
    L = 3.0
    row = 0
    for r_ in range(4):
        x = -L / 2 + (0.0 if r_ % 2 == 0 else 0.3)
        while x < L / 2 - 0.2:
            w = rng.uniform(0.45, 0.8)
            w = min(w, L / 2 - x)
            b.box((w - 0.04, 0.4, 0.22), loc=(x + w / 2, 0, r_ * 0.24), r=0.06, base=True, color=G(STONE_DK, "#D3CFE2", lo=0, hi=1.0), jit=1.0, nz=0.06,
                  rot=(0, 0, rng.uniform(-2, 2)))
            x += w
    for k in range(7):
        x = -L / 2 + 0.2 + k * 0.4
        b.sphere(0.12, loc=(x + rng.uniform(-0.05, 0.05), rng.uniform(-0.1, 0.1), 1.0), nu=7, nv=5, sq=(1.4, 1, 0.7), color=G("#4CC38A", "#8CD66E"), mat="VC_FOLIAGE", jit=0.7, nz=0)
    return fin(man, "common_town_garden_wall", b, "town_prop", collision="auto_box", warp=dict(lean=(0, 0), wob=0.03, wscale=2.5, seed=21, fade_h=1),
               ao=0.45, extra={"note": "3 m low stone wall segment along X with moss tufts", "segment_length": 3.0})
