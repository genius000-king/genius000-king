"""Pack-local modeling kit for the `architecture` pack (Blender 4.5, bmesh based).

Everything is accumulated into ONE bmesh per object (`Build`), with per-part vertex colors and material slots,
so assets are fast to build and deterministic.  Colors are authored in sRGB, written as linear FLOAT_COLOR corner
attribute `Col` (same contract as art/lib/sl_common.py).
"""
from __future__ import annotations

import math
import os
import sys
import json
import random
import zlib

import bpy
import bmesh
from mathutils import Vector, Matrix, Euler, noise

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "lib"))
import sl_common as sl  # noqa: E402

PACK = "architecture"
Z = Vector((0, 0, 1))
V = Vector

# ----------------------------------------------------------------------------- palette
C = dict(
    white="#EDEFF7", white2="#DDE1F2", steel="#8C93B5", steel_dk="#6A7099", steel_lt="#B4BAD6",
    orange="#FF8A3D", orange_dk="#D9672A", violet="#9D6BFF", violet_dk="#6E4BC4", violet_lt="#C9B2FF",
    grass="#6FBF73", dirt="#8A5A44", rock="#A3A9D6", rock_dk="#7C7FB8", ink="#3A3558", ink_lt="#554F7A",
    # town
    cream="#FFF0D6", butter="#FFE29A", peach="#FFD2B0", pink="#F8C4C4", mint="#BDE8D3", sky="#BCDDFF",
    lavender="#CDBFF3", coral="#FF7A6B", coral_dk="#E65A5A", teal="#2FB5A8", teal_dk="#1F8A86",
    yellow="#FFD166", lav_roof="#A98BE8", rose="#F28CA0",
    wood="#B07A58", wood_dk="#8A5A44", wood_lt="#D9A77C", stone="#B9B4C9", stone_dk="#8E88A6",
    glow="#FFC878", glow_hot="#FFE2A8", leaf="#4CC38A", leaf_lt="#7ED957", petal_pink="#FF7AA8",
    petal_yel="#FFD166", petal_cyan="#7AE7FF",
)


def lerp_c(a, b, t):
    return sl.mix(a, b, t)


def lin(rgb):
    return tuple(sl.srgb_to_linear(x) for x in rgb)


def seed_of(name):
    return zlib.crc32(name.encode()) & 0xFFFFFF


def PF(fn):
    """Mark a color callable as per-face (evaluated once at the face center)."""
    fn.per_face = True
    return fn


class G:
    """Gradient color spec along a world axis. lo/hi default to the part's own bbox."""

    def __init__(self, bottom, top, axis=2, curve=1.0, lo=None, hi=None):
        self.b, self.t, self.axis, self.curve, self.lo, self.hi = bottom, top, axis, curve, lo, hi


class FaceG:
    """Gradient evaluator that can be used inside callables (world z gradient)."""

    def __init__(self, bot, top, lo, hi):
        self.b, self.t, self.lo, self.hi = bot, top, lo, hi

    def __call__(self, p, n=None):
        t = max(0.0, min(1.0, (p.z - self.lo) / (self.hi - self.lo)))
        return sl.mix(self.b, self.t, t)



# ----------------------------------------------------------------------------- bmesh primitives
def _recalc(bm):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])


def bevel_sharp(bm, r, seg=2, ang=28.0):
    if r <= 0:
        return bm
    bm.normal_update()
    edges = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > math.radians(ang)]
    if edges:
        bmesh.ops.bevel(bm, geom=edges, offset=r, offset_type="OFFSET", segments=seg, profile=0.5,
                        affect="EDGES", clamp_overlap=True)
    return bm


def shift(bm, v):
    bmesh.ops.translate(bm, verts=bm.verts[:], vec=Vector(v))


def prim_box(sx, sy, sz, r=0.06, seg=1, top=(1.0, 1.0), base=False, bot=(1.0, 1.0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= sx
        v.co.y *= sy
        v.co.z *= sz
        if v.co.z > 0:
            v.co.x *= top[0]
            v.co.y *= top[1]
        else:
            v.co.x *= bot[0]
            v.co.y *= bot[1]
    r = min(r, 0.45 * min(sx, sy, sz))
    bevel_sharp(bm, r, seg)
    if base:
        shift(bm, (0, 0, sz / 2))
    return bm


def prim_cyl(r1, r2=None, h=1.0, n=16, r=0.0, seg=2, base=False, caps=True):
    r2 = r1 if r2 is None else r2
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=caps, segments=n, radius1=r1, radius2=r2, depth=h)
    if r > 0:
        bevel_sharp(bm, min(r, 0.45 * min(h, max(r1, r2))), seg, 30)
    if base:
        shift(bm, (0, 0, h / 2))
    return bm


def prim_sphere(r=1.0, nu=14, nv=9, sq=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=nu, v_segments=nv, radius=r)
    for v in bm.verts:
        v.co.x *= sq[0]
        v.co.y *= sq[1]
        v.co.z *= sq[2]
    return bm


def prim_lathe(profile, n=16, cap=True):
    """Surface of revolution about Z. profile = [(r, z), ...] bottom->top. Closed solid if ends reach r=0 or cap."""
    bm = bmesh.new()
    rings = []
    for (r, z) in profile:
        if r < 1e-5:
            rings.append([bm.verts.new((0, 0, z))])
        else:
            rings.append([bm.verts.new((r * math.cos(2 * math.pi * k / n), r * math.sin(2 * math.pi * k / n), z))
                          for k in range(n)])
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        for k in range(n):
            k2 = (k + 1) % n
            if len(a) == 1 and len(b) == 1:
                continue
            if len(a) == 1:
                bm.faces.new((a[0], b[k], b[k2]))
            elif len(b) == 1:
                bm.faces.new((a[k], a[k2], b[0]))
            else:
                bm.faces.new((a[k], a[k2], b[k2], b[k]))
    if cap:
        if len(rings[0]) > 1:
            bm.faces.new(list(reversed(rings[0])))
        if len(rings[-1]) > 1:
            bm.faces.new(rings[-1])
    _recalc(bm)
    return bm


def prim_poly(pts, h, r=0.04, seg=2, base=False, ang=28.0):
    """Extrude 2D polygon (x,y) along z 0..h. Works for concave outlines."""
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, 0)) for x, y in pts]
    hi = [bm.verts.new((x, y, h)) for x, y in pts]
    n = len(pts)
    bm.faces.new(list(reversed(lo)))
    bm.faces.new(hi)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    _recalc(bm)
    if r > 0:
        bevel_sharp(bm, r, seg, ang)
    if not base:
        shift(bm, (0, 0, -h / 2))
    return bm


def rrect(w, h, r=0.1, n=3):
    """Rounded-rect profile polygon, centered, CCW."""
    r = min(r, w / 2 - 1e-4, h / 2 - 1e-4)
    pts = []
    for (cx, cy, a0) in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180),
                         (w / 2 - r, -h / 2 + r, 270)):
        for k in range(n + 1):
            a = math.radians(a0 + 90.0 * k / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def circle_prof(r, n=8):
    return [(r * math.cos(2 * math.pi * k / n), r * math.sin(2 * math.pi * k / n)) for k in range(n)]


def catmull(pts, per=6, closed=False):
    P = [Vector(p) for p in pts]
    out = []
    n = len(P)
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p0 = P[(i - 1) % n] if (closed or i > 0) else P[0]
        p1 = P[i]
        p2 = P[(i + 1) % n]
        p3 = P[(i + 2) % n] if (closed or i + 2 < n) else P[-1]
        for s in range(per):
            t = s / per
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                              (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    if not closed:
        out.append(P[-1])
    return out


def arc_pts(R, a0, a1, n, center=(0, 0, 0)):
    """Points on circle in XY plane around z, angle in degrees from +X."""
    return [Vector((center[0] + R * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
                    center[1] + R * math.sin(math.radians(a0 + (a1 - a0) * i / n)), center[2])) for i in range(n + 1)]


def prim_sweep(path, profile, scales=None, closed=False, up=None, cap=True, end_jitter=None):
    """Sweep a 2D profile along a polyline. Profile u -> frame axis a, v -> frame axis c (c = `up` if given)."""
    path = [Vector(p) for p in path]
    n = len(path)
    if closed and path[0] == path[-1]:
        path = path[:-1]
        n -= 1
    tans = []
    for i in range(n):
        if closed:
            t = path[(i + 1) % n] - path[(i - 1) % n]
        elif i == 0:
            t = path[1] - path[0]
        elif i == n - 1:
            t = path[-1] - path[-2]
        else:
            t = (path[i + 1] - path[i]).normalized() + (path[i] - path[i - 1]).normalized()
        tans.append(t.normalized())
    bm = bmesh.new()
    rings = []
    if up is None and closed:
        up = Z
    prev_c = None
    for i in range(n):
        t = tans[i]
        if up is not None:
            u = Vector(up)
            c = (u - t * u.dot(t))
            if c.length < 1e-5:
                c = Vector((1, 0, 0)) - t * t.x
            c.normalize()
        else:
            if prev_c is None:
                ref = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
                c = (ref - t * ref.dot(t)).normalized()
            else:
                c = (prev_c - t * prev_c.dot(t)).normalized()
            prev_c = c
        a = c.cross(t).normalized()
        s = 1.0 if scales is None else scales[i]
        ring = []
        for (pu, pv) in profile:
            su = s[0] if isinstance(s, (tuple, list)) else s
            sv = s[1] if isinstance(s, (tuple, list)) else s
            p = path[i] + a * pu * su + c * pv * sv
            if end_jitter and not closed and (i == 0 or i == n - 1):
                j = end_jitter[(0 if i == 0 else 1)]
                p = p + t * j(pu, pv) * (-1 if i == 0 else 1)
            ring.append(bm.verts.new(p))
        rings.append(ring)
    m = len(profile)
    top_i = n if closed else n - 1
    for i in range(top_i):
        A, B = rings[i], rings[(i + 1) % n]
        for k in range(m):
            k2 = (k + 1) % m
            bm.faces.new((A[k], A[k2], B[k2], B[k]))
    if cap and not closed:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    _recalc(bm)
    return bm


def prim_ring(R, profile, segs=64, a0=0.0, a1=360.0, scales=None, end_jitter=None):
    """Ring/arc around Z axis in the XY plane. profile u = radial offset from R, v = z."""
    full = abs((a1 - a0) - 360.0) < 1e-6
    n = segs if full else max(2, int(segs * abs(a1 - a0) / 360.0))
    pts = [Vector((R * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
                   R * math.sin(math.radians(a0 + (a1 - a0) * i / n)), 0)) for i in range(n + (0 if full else 1))]
    return prim_sweep(pts, profile, scales=scales, closed=full, up=Z, cap=not full, end_jitter=end_jitter)


def prim_slab_hole(w, h, t, hx, hz, hr, nseg=20, r=0.05):
    """Wall slab (XZ face, thickness t along Y centered) with a round hole. Origin: bottom center."""
    bm = bmesh.new()
    xmin, xmax, zmin, zmax = -w / 2, w / 2, 0.0, h
    ang = [2 * math.pi * k / nseg for k in range(nseg)]
    for cx, cz in ((xmax, zmax), (xmin, zmax), (xmin, zmin), (xmax, zmin)):
        a = math.atan2(cz - hz, cx - hx) % (2 * math.pi)
        ang.append(a)
    ang = sorted(set(round(a, 6) for a in ang))
    inner_f, inner_b, outer_f, outer_b = [], [], [], []
    for a in ang:
        dx, dz = math.cos(a), math.sin(a)
        s = 1e9
        if dx > 1e-9:
            s = min(s, (xmax - hx) / dx)
        elif dx < -1e-9:
            s = min(s, (xmin - hx) / dx)
        if dz > 1e-9:
            s = min(s, (zmax - hz) / dz)
        elif dz < -1e-9:
            s = min(s, (zmin - hz) / dz)
        ip = (hx + hr * dx, hz + hr * dz)
        op = (hx + s * dx, hz + s * dz)
        inner_f.append(bm.verts.new((ip[0], -t / 2, ip[1])))
        inner_b.append(bm.verts.new((ip[0], t / 2, ip[1])))
        outer_f.append(bm.verts.new((op[0], -t / 2, op[1])))
        outer_b.append(bm.verts.new((op[0], t / 2, op[1])))
    n = len(ang)
    for i in range(n):
        j = (i + 1) % n
        try:
            bm.faces.new((inner_f[i], inner_f[j], outer_f[j], outer_f[i]))
            bm.faces.new((inner_b[j], inner_b[i], outer_b[i], outer_b[j]))
            bm.faces.new((outer_f[i], outer_f[j], outer_b[j], outer_b[i]))
            bm.faces.new((inner_f[j], inner_f[i], inner_b[i], inner_b[j]))
        except ValueError:
            pass
    _recalc(bm)
    bevel_sharp(bm, r, 2)
    return bm


def prim_patch(R, t, lon0, lon1, lat0, lat1, nl=3, nt=2, gap=0.0):
    """Thick spherical panel (dome shell piece). Angles deg; lon around Z, lat from equator (0) to pole (90)."""
    bm = bmesh.new()

    def pos(rad, lon, lat):
        lo, la = math.radians(lon), math.radians(lat)
        return Vector((rad * math.cos(la) * math.cos(lo), rad * math.cos(la) * math.sin(lo), rad * math.sin(la)))

    lon0, lon1 = lon0 + gap, lon1 - gap
    lat0, lat1 = lat0 + gap * 0.6, lat1 - gap * 0.6
    grid = {}
    for rad_name, rad in (("o", R), ("i", R - t)):
        for a in range(nl + 1):
            for b in range(nt + 1):
                grid[(rad_name, a, b)] = bm.verts.new(pos(rad, lon0 + (lon1 - lon0) * a / nl,
                                                          lat0 + (lat1 - lat0) * b / nt))
    for a in range(nl):
        for b in range(nt):
            bm.faces.new((grid[("o", a, b)], grid[("o", a + 1, b)], grid[("o", a + 1, b + 1)], grid[("o", a, b + 1)]))
            bm.faces.new((grid[("i", a, b)], grid[("i", a, b + 1)], grid[("i", a + 1, b + 1)], grid[("i", a + 1, b)]))
    for a in range(nl):
        bm.faces.new((grid[("o", a, 0)], grid[("i", a, 0)], grid[("i", a + 1, 0)], grid[("o", a + 1, 0)]))
        bm.faces.new((grid[("o", a, nt)], grid[("o", a + 1, nt)], grid[("i", a + 1, nt)], grid[("i", a, nt)]))
    for b in range(nt):
        bm.faces.new((grid[("o", 0, b)], grid[("o", 0, b + 1)], grid[("i", 0, b + 1)], grid[("i", 0, b)]))
        bm.faces.new((grid[("o", nl, b)], grid[("i", nl, b)], grid[("i", nl, b + 1)], grid[("o", nl, b + 1)]))
    _recalc(bm)
    return bm


def prim_wedge_roof(length, width, height, thick=0.28, overhang=0.35, r=0.07):
    """Gabled roof made of two thick slabs + ridge. Ridge along X, base at z=0 (eave line), centered."""
    pass  # (composed in Build.gable_roof)


# ----------------------------------------------------------------------------- Build
class Build:
    def __init__(self, name, seed=None):
        self.name = name
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.float_color.new("Col")
        self.mats = []
        self.rng = random.Random(seed_of(name) if seed is None else seed)
        self.noff = Vector((self.rng.uniform(0, 50), self.rng.uniform(0, 50), self.rng.uniform(0, 50)))
        self.flat_all = False

    # -- materials
    def slot(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    # -- core adder
    def add(self, pbm, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), color="#ffffff", mat="VC", top=None,
            jit=1.0, nz=0.05, flat=False, matrix=None, rot_order="XYZ"):
        if not isinstance(scale, (tuple, list, Vector)):
            scale = (scale, scale, scale)
        if matrix is None:
            M = (Matrix.Translation(Vector(loc)) @ Euler([math.radians(a) for a in rot], rot_order).to_matrix().to_4x4()
                 @ Matrix.Diagonal((scale[0], scale[1], scale[2], 1.0)))
        else:
            M = matrix
        N = M.to_3x3().inverted_safe().transposed()
        mirrored = M.to_3x3().determinant() < 0
        pbm.normal_update()
        bm = self.bm
        si = self.slot(mat)
        vmap = {v: bm.verts.new(M @ v.co) for v in pbm.verts}
        # gradient bounds
        spec = color
        if isinstance(spec, G):
            ax = spec.axis
            vals = [vmap[v].co[ax] for v in pbm.verts]
            lo = min(vals) if spec.lo is None else spec.lo
            hi = max(vals) if spec.hi is None else spec.hi
            span = max(hi - lo, 1e-5)
        per_face = getattr(spec, "per_face", False)
        base_rgb = None
        if isinstance(spec, str) or isinstance(spec, (tuple, list)) and not callable(spec):
            base_rgb = sl.jitter(spec, 0.012 * jit, 0.03 * jit, 0.035 * jit, self.rng) if jit else sl.hex_rgb(spec)
        gj = None
        if isinstance(spec, G):
            gj = (self.rng.uniform(-0.02, 0.02) * jit, self.rng.uniform(-0.03, 0.03) * jit)
        faces = []
        for f in pbm.faces:
            vs = [vmap[v] for v in f.verts]
            if mirrored:
                vs = vs[::-1]
            try:
                nf = bm.faces.new(vs)
            except ValueError:
                continue
            nf.material_index = si
            nf.smooth = not (flat or self.flat_all)
            n = (N @ f.normal).normalized()
            if mirrored:
                n = -n
            fc_rgb = None
            if per_face:
                cen = sum((lp.vert.co for lp in nf.loops), Vector()) / len(nf.loops)
                fc_rgb = sl.hex_rgb(spec(cen, n))
            for loop in nf.loops:
                p = loop.vert.co
                if fc_rgb is not None:
                    c = fc_rgb
                elif base_rgb is not None:
                    c = base_rgb
                elif isinstance(spec, G):
                    t = max(0.0, min(1.0, ((p[spec.axis] - lo) / span))) ** spec.curve
                    c = sl.mix(spec.b, spec.t, t)
                    c = tuple(max(0, min(1, ch + gj[0] * 0.5 + gj[1] * 0.3)) for ch in c)
                else:
                    c = sl.hex_rgb(spec(p, n))
                if top is not None and n.z > 0.6:
                    tt = min(1.0, (n.z - 0.6) / 0.35)
                    tc = sl.hex_rgb(top)
                    c = tuple(c[i] + (tc[i] - c[i]) * tt for i in range(3))
                if nz:
                    nv = noise.noise(p * 0.8 + self.noff) * nz
                    c = tuple(max(0.0, min(1.0, ch * (1.0 + nv * 1.4))) for ch in c)
                lc = lin(c)
                loop[self.col] = (lc[0], lc[1], lc[2], 1.0)
            faces.append(nf)
        return faces

    # -- primitive shortcuts (all accept add() kwargs)
    def box(self, size, loc=(0, 0, 0), r=0.06, seg=1, base=False, tapr=(1, 1), bot=(1, 1), **kw):
        return self.add(prim_box(size[0], size[1], size[2], r, seg, tapr, base, bot), loc=loc, **kw)

    def cyl(self, r1, h, loc=(0, 0, 0), r2=None, n=16, r=0.0, base=False, caps=True, **kw):
        return self.add(prim_cyl(r1, r2, h, n, r, 2, base, caps), loc=loc, **kw)

    def sphere(self, rad, loc=(0, 0, 0), nu=14, nv=9, sq=(1, 1, 1), **kw):
        return self.add(prim_sphere(rad, nu, nv, sq), loc=loc, **kw)

    def lathe(self, profile, loc=(0, 0, 0), n=16, cap=True, **kw):
        return self.add(prim_lathe(profile, n, cap), loc=loc, **kw)

    def poly(self, pts, h, loc=(0, 0, 0), r=0.04, base=True, **kw):
        return self.add(prim_poly(pts, h, r, 2, base), loc=loc, **kw)

    def sweep(self, path, profile, scales=None, closed=False, up=None, cap=True, **kw):
        return self.add(prim_sweep(path, profile, scales, closed, up, cap), **kw)

    def rod(self, p0, p1, rad, n=8, rad1=None, **kw):
        p0, p1 = Vector(p0), Vector(p1)
        d = p1 - p0
        L = d.length
        bm = prim_cyl(rad1 if rad1 is not None else rad, rad, L, n, 0.0, 2, False, True)
        q = Vector((0, 0, 1)).rotation_difference(d.normalized())
        M = Matrix.Translation((p0 + p1) / 2) @ q.to_matrix().to_4x4()
        return self.add(bm, matrix=M, **kw)

    def beam(self, p0, p1, w, h, r=0.04, **kw):
        p0, p1 = Vector(p0), Vector(p1)
        d = p1 - p0
        L = d.length
        yv = d.normalized()
        xv = yv.cross(Z)
        if xv.length < 1e-4:
            xv = Vector((1, 0, 0))
        xv.normalize()
        zv = xv.cross(yv)
        R = Matrix((xv, yv, zv)).transposed()
        M = Matrix.Translation((p0 + p1) / 2) @ R.to_4x4()
        return self.add(prim_box(w, L, h, r, 2), matrix=M, **kw)

    def tube(self, pts, rad, n=8, per=5, scales=None, smooth=True, **kw):
        path = catmull(pts, per) if smooth else [Vector(p) for p in pts]
        sc = scales
        if scales is not None and smooth:
            m = len(path)
            sc = [scales[min(len(scales) - 1, int(i * (len(scales) - 1) / max(1, m - 1) + 0.5))] for i in range(m)]
        return self.add(prim_sweep(path, circle_prof(rad, n), sc, False, None, True), **kw)

    # -- global deformation
    def warp(self, lean=(0.0, 0.0), wob=0.0, wscale=5.0, seed=0, fade_h=2.5):
        off = Vector((seed * 3.7, seed * 1.3, seed * 2.1))
        for v in self.bm.verts:
            z = max(0.0, v.co.z)
            f = min(1.0, z / fade_h)
            f = f * f * (3 - 2 * f)
            dx = lean[0] * z
            dy = lean[1] * z
            if wob:
                p = Vector((v.co.x, v.co.y, v.co.z)) / wscale + off
                dx += wob * noise.noise(p) * f
                dy += wob * noise.noise(p + Vector((13.1, 7.7, 3.3))) * f
            v.co.x += dx
            v.co.y += dy

    def mark(self, label):
        t = self.triangle_count()
        if os.environ.get("SL_MARK"):
            print(f"  [mark] {self.name}: {label}: +{t - getattr(self, '_mk', 0)} (total {t})")
        self._mk = t

    def triangle_count(self):
        return sum(len(f.verts) - 2 for f in self.bm.faces)

    def to_object(self, name, smooth_angle=42.0, flat=False):
        bm = self.bm
        bm.normal_update()
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        obj = sl.new_object(name, me)
        for m in self.mats:
            me.materials.append(sl.get_material(m))
        if not self.mats:
            me.materials.append(sl.get_material("VC"))
        if flat:
            sl.shade_flat(obj)
        else:
            # bmesh face.smooth flags carried over; sharpen edges by angle
            try:
                me.set_sharp_from_angle(angle=math.radians(smooth_angle))
            except Exception:
                pass
        if "Col" in me.color_attributes:
            me.color_attributes.active_color = me.color_attributes["Col"]
            try:
                me.color_attributes.render_color_index = me.color_attributes.active_color_index
            except Exception:
                pass
        return obj


# ----------------------------------------------------------------------------- finishing
def mesh_bbox(objs):
    pts = []
    for o in objs:
        if o.type != "MESH":
            continue
        for v in o.data.vertices:
            pts.append(o.matrix_world @ v.co if o.location.length < 1e-9 else (v.co + o.location))
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def bake_ao_keep_emit(obj, strength):
    """sl.bake_ao but restores original colors on faces using EMIT material (glow must stay bright)."""
    me = obj.data
    col = me.color_attributes["Col"]
    emit_idx = {i for i, m in enumerate(me.materials) if m and m.name.startswith("EMIT")}
    saved = {}
    if emit_idx:
        for p in me.polygons:
            if p.material_index in emit_idx:
                for li in p.loop_indices:
                    saved[li] = tuple(col.data[li].color)
    d = sl.dims(obj)
    sl.bake_ao(obj, strength=strength, distance=max(0.35, min(1.6, max(d) * 0.1)))
    if saved:
        col = me.color_attributes["Col"]
        for li, c in saved.items():
            col.data[li].color = c


def finish(man, asset_id, main, extras=(), empties=(), *, category, worlds, collision=None, scatter=None, ao=0.45,
           origin="authored", extra=None, views=(), preview_kw=None, ao_extras=None):
    """Export + preview + manifest. origin: 'authored' keeps coordinates; 'bbox_base' recenters xy and drops to z=0."""
    main.name = asset_id
    allm = [main] + list(extras)
    if origin == "bbox_base":
        lo, hi = mesh_bbox(allm)
        off = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
        for v in main.data.vertices:
            v.co -= off
        for o in extras:
            o.location = o.location - off
        for e in empties:
            e.location = e.location - off
    lo, hi = mesh_bbox(allm)
    if origin == "authored" and abs(lo.z) > 0.02 and not (extra or {}).get("floating"):
        print(f"  [warn] {asset_id}: min z = {lo.z:.3f} (authored origin)")
    for o in allm:
        o.data.update()
        if ao:
            a = ao if ao_extras is None or o is main else ao_extras
            if a:
                bake_ao_keep_emit(o, a)
    sl.export_glb(allm + list(empties), asset_id, PACK)
    pk = dict(preview_kw or {})
    sl.preview(allm, asset_id, PACK, **pk)
    for suffix, kw in views:
        k = dict(pk)
        k.update(kw)
        sl.preview(allm, "_" + asset_id + "_" + suffix, PACK, **k)
    w, d, h = hi.x - lo.x, hi.y - lo.y, hi.z - lo.z
    tris = sum(sl.tri_count(o) for o in allm)
    ex = {"height": round(h, 3), "radius": round(max(w, d) / 2, 3), "tris": tris}
    if isinstance(collision, str) and collision == "auto_box":
        collision = {"type": "box", "size": [round(w, 3), round(h, 3), round(d, 3)]}
    elif isinstance(collision, str) and collision == "auto_cyl":
        collision = {"type": "cylinder", "radius": round(max(w, d) / 2, 3), "height": round(h, 3)}
    elif isinstance(collision, str):
        collision = {"type": collision}
    ex["bbox_blender"] = {"min": [round(x, 3) for x in lo], "max": [round(x, 3) for x in hi]}
    if extra:
        ex.update(extra)
    man.add(asset_id, main, category, worlds, collision, scatter, ex)
    return tris


def load_manifest(man):
    p = os.path.join(sl.GAME_MODELS, man.pack, "manifest.json")
    if os.path.exists(p):
        try:
            with open(p) as f:
                man.assets = json.load(f).get("assets", [])
        except Exception:
            pass


def sheet(pack, files, out_name, cols=8, cell=256):
    """Contact sheet from an explicit list of png names (without dir)."""
    out_dir = os.path.join(sl.PREVIEWS, pack)
    files = [f for f in files if os.path.exists(os.path.join(out_dir, f))]
    if not files:
        return None
    cols = min(cols, len(files))
    rows = math.ceil(len(files) / cols)
    W, H = cols * cell, rows * cell
    bgc = [sl.srgb_to_linear(c) for c in sl.hex_rgb("#2A2440")] + [1.0]
    px = bgc * (W * H)
    for idx, fn in enumerate(files):
        img = bpy.data.images.load(os.path.join(out_dir, fn))
        img.scale(cell, cell)
        src = list(img.pixels)
        cx, cy = idx % cols, rows - 1 - idx // cols
        for y in range(cell):
            a = y * cell * 4
            b = ((cy * cell + y) * W + cx * cell) * 4
            px[b:b + cell * 4] = src[a:a + cell * 4]
        bpy.data.images.remove(img)
    out = bpy.data.images.new(out_name, W, H, alpha=True)
    out.pixels = px
    out.filepath_raw = os.path.join(out_dir, out_name + ".png")
    out.file_format = "PNG"
    out.save()
    return out.filepath_raw
