"""Verdant flora helpers: primitives (lathe, ribbon, blades, petals, canopies), painting, finish pipeline.

All geometry is built in plain bmesh, transformed on mesh data (no bpy.ops), painted with vertex colors
(`Col`), joined and finalized through our own pipeline (z-only origin shift so trunk stays at x=y=0).
"""
import sys, os, math, random, zlib, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "lib"))
import bpy, bmesh
from mathutils import Vector, Matrix, noise
import sl_common as sl

V = Vector
PACK = "verdant_flora"
pi = math.pi

# ----------------------------------------------------------------------------- palette
GRASS_LO = "#7ED957"; GRASS_HI = "#C6F57E"; LEAF = "#4CC38A"; LEAF_DK = "#2C9A7C"; LEAF_DEEP = "#237F78"
BARK = "#9B6A4F"; BARK_DK = "#6F4A44"; BARK_LT = "#C99A78"; SOIL = "#8A5A44"
PINK = "#FF7AA8"; YELLOW = "#FFD166"; CYAN = "#7AE7FF"; LAV = "#A3A9D6"; LAV_LT = "#CDD0F2"; LAV_DK = "#7378B5"
VIOLET = "#B58CFF"; CORAL = "#FF9A7A"; MINT = "#9DF2C8"; CREAM = "#FFF1D6"; MAGENTA = "#F05BB4"
SHADOW = "#6B5BD6"; WARM = "#FFF0C0"; PALE = "#F4EEFF"; BLUE = "#5FA8FF"


def rng_for(asset_id):
    return random.Random(zlib.crc32(asset_id.encode()))


def lerp(a, b, t):
    return a + (b - a) * t


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def mixc(a, b, t):
    return sl.mix(a, b, t)


def vary(c, rng, hue=0.015, sat=0.06, val=0.07):
    return sl.jitter(c, hue, sat, val, rng)


# ----------------------------------------------------------------------------- transforms
def put(o, loc=(0, 0, 0), up=None, spin=0.0, scale=1.0, tilt=None):
    """Transform mesh data: scale -> spin about Z -> (optional) rotate Z onto `up` -> translate."""
    if isinstance(scale, (int, float)):
        scale = (scale, scale, scale)
    M = Matrix.Translation(V(loc))
    if up is not None:
        u = V(up).normalized()
        M = M @ V((0, 0, 1)).rotation_difference(u).to_matrix().to_4x4()
    M = M @ Matrix.Rotation(math.radians(spin), 4, "Z") @ Matrix.Diagonal((scale[0], scale[1], scale[2], 1.0))
    o.data.transform(M)
    o.data.update()
    return o


def dir_from(yaw_deg, pitch_deg):
    """Unit vector: pitch 0 = horizontal, 90 = straight up."""
    y, p = math.radians(yaw_deg), math.radians(pitch_deg)
    return V((math.cos(y) * math.cos(p), math.sin(y) * math.cos(p), math.sin(p)))


# ----------------------------------------------------------------------------- painting
def paint(o, fn, lit=0.0, dark=0.0):
    """fn(co, normal) -> sRGB color. lit/dark add baked warm-top / violet-bottom shading by normal.z."""
    me = o.data
    attr = sl.ensure_colors(o)
    for poly in me.polygons:
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index]
            c = sl.hex_rgb(fn(v.co, v.normal))
            if lit or dark:
                nz = v.normal.z
                if nz > 0 and lit:
                    c = sl.mix(c, WARM, nz * lit)
                elif nz < 0 and dark:
                    c = sl.mix(c, SHADOW, -nz * dark)
            sl._write_corner(attr, li, c)
    return o


def nz(co, off=0.0, sc=1.3, anis=(1, 1, 1)):
    return noise.noise(V((co.x * anis[0], co.y * anis[1], co.z * anis[2])) * sc + V((off, off * 0.7, off * 1.3)))


def zg(c0, c1, z0, z1, amt=0.05, seed=0, curve=1.0):
    """Height-gradient color function with soft value/hue noise."""
    span = max(z1 - z0, 1e-5)

    def f(co, n):
        t = clamp((co.z - z0) / span) ** curve
        c = sl.mix(c0, c1, t)
        if amt:
            a = nz(co, seed * 3.1) * amt
            b = nz(co, seed * 3.1 + 40.0) * amt * 0.6
            c = (clamp(c[0] + a + b), clamp(c[1] + a), clamp(c[2] + a - b))
        return c
    return f


def rg(c0, c1, r0, r1, amt=0.04, seed=0, cx=0.0, cy=0.0, curve=1.0):
    """Radial (xy distance) gradient."""
    span = max(r1 - r0, 1e-5)

    def f(co, n):
        r = math.hypot(co.x - cx, co.y - cy)
        t = clamp((r - r0) / span) ** curve
        c = sl.mix(c0, c1, t)
        if amt:
            a = nz(co, seed * 2.3) * amt
            c = (clamp(c[0] + a), clamp(c[1] + a), clamp(c[2] + a))
        return c
    return f


def dg(c0, c1, d0, d1, amt=0.03, seed=0, origin=(0, 0, 0)):
    """Distance-from-point gradient (petals: inner->tip)."""
    span = max(d1 - d0, 1e-5)
    O = V(origin)

    def f(co, n):
        t = clamp(((co - O).length - d0) / span)
        c = sl.mix(c0, c1, t)
        if amt:
            a = nz(co, seed * 2.9) * amt
            c = (clamp(c[0] + a), clamp(c[1] + a), clamp(c[2] + a))
        return c
    return f


def solid(c, amt=0.0, seed=0):
    def f(co, n):
        if not amt:
            return c
        k = nz(co, seed * 1.9, 2.0) * amt
        r = sl.hex_rgb(c)
        return (clamp(r[0] + k), clamp(r[1] + k), clamp(r[2] + k))
    return f


def bark_fn(c0, c1, z0, z1, seed=0, streak=1.0, bands=None):
    """Bark: vertical streaks (anisotropic noise) + height gradient. bands=(color, period, width, jit)"""
    span = max(z1 - z0, 1e-5)

    def f(co, n):
        t = clamp((co.z - z0) / span)
        c = sl.mix(c0, c1, t)
        k = nz(co, seed * 2.0, 2.6, (2.2, 2.2, 0.35)) * 0.09 * streak
        c = (clamp(c[0] + k), clamp(c[1] + k * 0.9), clamp(c[2] + k * 0.8))
        if bands:
            bc, period, width, jit = bands
            ph = (co.z + nz(co, seed + 7.0, 1.5) * jit) % period
            if ph < width:
                tt = math.sin(ph / width * pi)
                c = sl.mix(c, bc, clamp(tt * 1.6) * 0.95)
        return c
    return f


# ----------------------------------------------------------------------------- primitives
def lathe(name, prof, sides=12, mat="VC", radial=None, cap0=True, cap1=True, smooth=True):
    """Surface of revolution. prof = [(r, z), ...] bottom -> top. radial(ring_i, angle, r, z) -> (rscale, dz)."""
    bm = bmesh.new()
    rings = []
    for i, (r, z) in enumerate(prof):
        if r < 1e-6:
            rings.append([bm.verts.new((0, 0, z))])
            continue
        ring = []
        for k in range(sides):
            a = 2 * pi * k / sides
            rs, dz = (1.0, 0.0)
            if radial:
                rs, dz = radial(i, a, r, z)
            ring.append(bm.verts.new((r * rs * math.cos(a), r * rs * math.sin(a), z + dz)))
        rings.append(ring)
    for i in range(len(prof) - 1):
        A, B = rings[i], rings[i + 1]
        for k in range(sides):
            k2 = (k + 1) % sides
            if len(A) == 1 and len(B) == 1:
                continue
            if len(A) == 1:
                bm.faces.new((A[0], B[k2], B[k]))
            elif len(B) == 1:
                bm.faces.new((A[k], A[k2], B[0]))
            else:
                bm.faces.new((A[k], A[k2], B[k2], B[k]))
    if cap0 and len(rings[0]) > 1:
        bm.faces.new(list(reversed(rings[0])))
    if cap1 and len(rings[-1]) > 1:
        bm.faces.new(rings[-1])
    return sl.bm_to_object(bm, name, mat, smooth)


def ribbon_bm(bm, path, widths, cup=0.0, across=3, side_vec=None, up_hint=(0, 0, 1)):
    pts = [V(p) for p in path]
    n = len(pts)
    rows = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)])
        if t.length < 1e-8:
            t = V((0, 0, 1))
        t.normalize()
        if side_vec is not None:
            s = V(side_vec)
            s = s - t * s.dot(t)
        else:
            s = t.cross(V(up_hint))
        if s.length < 1e-4:
            s = t.cross(V((1, 0, 0)))
        s.normalize()
        nrm = s.cross(t).normalized()
        w = widths[i]
        if w < 1e-5 and (i == n - 1 or i == 0):
            rows.append([bm.verts.new(p)])
            continue
        row = []
        for j in range(across):
            u = -1 + 2 * j / (across - 1)
            row.append(bm.verts.new(p + s * (u * w) + nrm * (cup * w * u * u)))
        rows.append(row)
    faces = []
    for i in range(n - 1):
        A, B = rows[i], rows[i + 1]
        if len(A) == 1 and len(B) == 1:
            continue
        for j in range(across - 1):
            if len(A) == 1:
                faces.append(bm.faces.new((A[0], B[j + 1], B[j])))
            elif len(B) == 1:
                faces.append(bm.faces.new((A[j], A[j + 1], B[0])))
            else:
                faces.append(bm.faces.new((A[j], A[j + 1], B[j + 1], B[j])))
    return faces


def ribbon(name, path, widths, mat="VC_FOLIAGE", cup=0.0, across=3, side_vec=None, up_hint=(0, 0, 1)):
    """Strip along a path with per-point half-width; edges lifted by `cup` (fold/cup). Tip width 0 -> pointed."""
    bm = bmesh.new()
    ribbon_bm(bm, path, widths, cup, across, side_vec, up_hint)
    return sl.bm_to_object(bm, name, mat, True)


class Batch:
    """Many small pieces in ONE mesh with per-face / per-vertex colours (fast: no per-piece objects)."""

    def __init__(self, name, mat="VC_FOLIAGE", smooth=True):
        self.bm = bmesh.new()
        self.lay = self.bm.loops.layers.float_color.new("Col")
        self.name, self.mat, self.smooth = name, mat, smooth

    def _color(self, faces, color):
        for f in faces:
            for l in f.loops:
                c = color(l.vert.co) if callable(color) else color
                c = sl.hex_rgb(c)
                l[self.lay] = (sl.srgb_to_linear(c[0]), sl.srgb_to_linear(c[1]), sl.srgb_to_linear(c[2]), 1.0)

    def ribbon(self, path, widths, color, cup=0.0, across=3, side_vec=None, up_hint=(0, 0, 1)):
        faces = ribbon_bm(self.bm, path, widths, cup, across, side_vec, up_hint)
        self._color(faces, color)
        return faces

    def bm_geom(self, fn, color):
        """fn(bm) -> list of new faces."""
        faces = fn(self.bm)
        self._color(faces, color)

    def obj(self):
        o = sl.bm_to_object(self.bm, self.name, self.mat, self.smooth)
        if not self.smooth:
            sl.shade_flat(o)
        sl.ensure_colors(o)
        return o


def tube(name, pts, r0, r1=None, sides=7, mat="VC_ROUGH", power=1.0, radii=None, cap=True):
    n = len(pts)
    if radii is None:
        r1 = r0 if r1 is None else r1
        radii = [lerp(r0, r1, (i / (n - 1)) ** power) for i in range(n)]
    return sl.tapered_tube(name, pts, radii, sides=sides, material=mat, cap=cap)


def ball(name, r=1.0, sub=2, squash=(1, 1, 1), noise_amt=0.0, nscale=0.8, seed=0, mat="VC"):
    return sl.blob(name, r, seed=seed, squash=squash, noise_amt=noise_amt, noise_scale=nscale, subdiv=sub, material=mat)


def bead(name, r, mat="VC", rings=4, sides=6):
    """Very cheap sphere (berries, pollen, seeds)."""
    prof = []
    for i in range(rings + 1):
        a = pi * i / rings
        prof.append((r * math.sin(a), -r * math.cos(a)))
    return lathe(name, prof, sides, mat)


def cone(name, r, h, sides=5, mat="VC", base=True, r_top=0.0):
    return lathe(name, [(r, 0), (r_top, h)], sides, mat, cap0=base, cap1=r_top > 1e-6)


def arc_pts(h, dx=0.0, dy=0.0, steps=6, ease=1.8, wob=0.0, rng=None):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        p = V((dx * t ** ease, dy * t ** ease, h * t))
        if wob and rng and 0 < i < steps:
            p += V((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * wob
        pts.append(p)
    return pts


def grow(start, d0, length, bend, steps=5, grav=0.0):
    """Polyline from `start` heading `d0` (unit), curved by `bend` (vector added progressively), `grav` lowers z."""
    pts = [V(start)]
    d = V(d0).normalized()
    seg = length / steps
    p = V(start)
    for i in range(steps):
        t = (i + 1) / steps
        dd = (d + V(bend) * t + V((0, 0, -grav)) * t).normalized()
        p = p + dd * seg
        pts.append(p.copy())
    return pts


def blade(name, base, yaw, h, lean=0.4, w=0.03, seg=4, mat="VC_FOLIAGE", cup=0.35, curl=0.0, tipw=0.0):
    """Curved grass blade rising from `base`, bending toward `yaw` (deg)."""
    cy, sy = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    pts, ws = [], []
    for i in range(seg + 1):
        t = i / seg
        x = h * lean * t ** 1.7 + curl * h * t ** 3
        z = h * t * (1 - 0.22 * lean * t)
        pts.append(V(base) + V((cy * x, sy * x, z)))
        ws.append(w * (1 - t) ** 0.8 + (tipw if i == seg else 0))
    return ribbon(name, pts, ws, mat, cup=cup, side_vec=(-sy, cy, 0))


def petal(name, L, W, tilt=30, curl=40, cup=0.5, seg=4, r0=0.0, mat="VC_FOLIAGE", shape=None, base_w=0.3, notch=0.0, across=3):
    """One petal pointing outward along +X (tilt from vertical, curl bends it outward/down along its length).
    Lengthwise width profile: base_w -> bulge -> tip."""
    pts, ws = [], []
    x, z = r0, 0.0
    for i in range(seg + 1):
        t = i / seg
        th = math.radians(tilt + curl * t)
        if i > 0:
            x += L / seg * math.sin(th)
            z += L / seg * math.cos(th)
        pts.append(V((x, 0, z)))
        prof = shape(t) if shape else (base_w + (1 - base_w) * math.sin(min(1.0, t * 1.0) * pi * 0.5)) * (1 - t ** 3.0) ** 0.6
        if i == seg:
            prof = notch
        ws.append(W * prof)
    return ribbon(name, pts, ws, mat, cup=cup, across=across, side_vec=(0, 1, 0))


def petal_ring(n, spin0=0.0, prefix="p", **kw):
    """n copies of petal() rotated around Z."""
    out = []
    for k in range(n):
        p = petal(f"{prefix}{k}", **kw)
        put(p, spin=spin0 + 360.0 * k / n)
        out.append(p)
    return out


def apply_fn(objs, fn, lit=0.0, dark=0.0):
    for o in objs:
        paint(o, fn, lit, dark)
    return objs


def stack(*lists):
    out = []
    for l in lists:
        if isinstance(l, (list, tuple)):
            out.extend(l)
        else:
            out.append(l)
    return out


def canopy(center, r, rng, cols=(LEAF, "#D4F77C"), squash=(1, 1, 0.85), lumps=6, sub=None, z0=None, z1=None,
           curve=1.0, seed=0, noise_amt=0.1, lump_r=0.42, mat="VC_FOLIAGE", amt=0.06, lit=0.16, dark=0.16):
    """Puffy foliage mass: noisy base blob + surface lumps; vertical color gradient painted in world space."""
    c = V(center)
    objs = []
    if sub is None:
        sub = 4 if r >= 1.7 else 3
    base = ball("puff", r, sub, squash, noise_amt, 0.8, seed, mat)
    put(base, c)
    objs.append(base)
    for i in range(lumps):
        th = rng.uniform(0.15, 1.35) if i else 0.6
        ph = rng.uniform(0, 2 * pi)
        d = V((math.sin(th) * math.cos(ph) * squash[0], math.sin(th) * math.sin(ph) * squash[1], math.cos(th) * squash[2]))
        lr = r * lump_r * rng.uniform(0.7, 1.15)
        lb = ball("lump", lr, 2, (1, 1, 0.85), 0.07, 0.8, seed + i + 1, mat)
        put(lb, c + d * r * 0.88)
        objs.append(lb)
    zlo = c.z - r * squash[2] if z0 is None else z0
    zhi = c.z + r * squash[2] * 1.15 if z1 is None else z1
    for o in objs:
        paint(o, zg(cols[0], cols[1], zlo, zhi, amt, seed, curve), lit, dark)
    return objs


def scatter_on_sphere(center, r, n, rng, squash=(1, 1, 1), th_min=0.0, th_max=pi, golden=True):
    """Roughly even points on (squashed) sphere between polar angles; returns [(pos, normal)]."""
    c = V(center)
    out = []
    for i in range(n):
        u = (i + 0.5) / n
        z = lerp(math.cos(th_min), math.cos(th_max), u)
        th = math.acos(z)
        ph = i * 2.399963 + rng.uniform(-0.3, 0.3)
        d = V((math.sin(th) * math.cos(ph), math.sin(th) * math.sin(ph), math.cos(th)))
        p = c + V((d.x * r * squash[0], d.y * r * squash[1], d.z * r * squash[2]))
        nrm = V((d.x / squash[0], d.y / squash[1], d.z / squash[2])).normalized()
        out.append((p, nrm))
    return out


# ----------------------------------------------------------------------------- finish pipeline
BUDGETS = {"tree": (2000, 7000), "bush": (500, 3000), "flower": (100, 1500), "hero_flower": (1000, 30000),
           "ground": (100, 1500), "hanging": (100, 3000), "log": (300, 3000)}

_man = None
_only = None
MANIFEST = sl.Manifest(PACK)
RESULTS = []


PREVIEW_EXPOSURE = float(os.environ.get("PV_EXP", "0.3"))
PREVIEW_LIGHT = os.environ.get("PV_LIGHT", "outdoor.sl")


def render_preview(obj, name, elev=18, azim=-35, frame=1.12):
    elev = float(os.environ.get("PV_ELEV", elev))
    scn = bpy.context.scene
    scn.view_settings.exposure = PREVIEW_EXPOSURE
    try:
        scn.display.shading.studio_light = PREVIEW_LIGHT
    except Exception:
        pass
    sl.preview([obj], name, PACK, elev=elev, azim=azim, frame=frame, bg="#3A3358")
    # preview() sets light STUDIO each time; restore exposure for exports (none) - keep as is


def finish(parts, asset_id, category, collision=None, scatter=None, ao=0.4, extra=None, elev=18, azim=-35,
           frame=1.12, budget=None, center_xy=False, emit_keep=True, worlds=("verdant",)):
    parts = [p for p in parts if p is not None]
    obj = sl.join(parts, asset_id)
    me = obj.data
    # origin: z-min -> 0 (keep trunk at x=y=0 unless center_xy)
    zs = [v.co.z for v in me.vertices]
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    off = V(((min(xs) + max(xs)) / 2 if center_xy else 0.0, (min(ys) + max(ys)) / 2 if center_xy else 0.0, min(zs)))
    for v in me.vertices:
        v.co -= off
    me.update()
    # keep emissive glow bright through AO: remember emit-material face colours
    emit_slots = [i for i, m in enumerate(me.materials) if m and m.name.startswith("EMIT")]
    keep = {}
    if emit_slots and emit_keep:
        attr = me.color_attributes["Col"]
        for p in me.polygons:
            if p.material_index in emit_slots:
                for li in p.loop_indices:
                    keep[li] = tuple(attr.data[li].color)
    if ao:
        sl.bake_ao(obj, strength=ao, samples=32)
    if keep:
        attr = me.color_attributes["Col"]
        for li, c in keep.items():
            attr.data[li].color = c
    me.update()
    sl.export_glb([obj], asset_id, PACK)
    render_preview(obj, asset_id, elev, azim, frame)
    entry = MANIFEST.add(asset_id, obj, category, list(worlds), collision, scatter, extra)
    tris = entry["tris"]
    cat = budget or category
    lo, hi = BUDGETS.get(cat, (0, 10 ** 9))
    flag = "" if lo <= tris <= hi else "  <-- OUT OF BUDGET %s" % str((lo, hi))
    print("ASSET %-44s %-8s tris=%5d h=%.2f r=%.2f%s" % (asset_id, category, tris, entry["height"], entry["radius"], flag))
    RESULTS.append(entry)
    return entry


def sc(zone="meadow", density=1.0, spacing=1.0, slope=30, cluster=0.3, zw=None, scale=(0.85, 1.2), group=None, align=False, **kw):
    d = {"density": density, "slope_max": slope, "min_spacing": spacing, "cluster": cluster, "zone": zone,
         "zone_weights": zw or {zone: 1.0}, "scale_range": list(scale), "yaw_random": True, "align_to_normal": align}
    if group:
        d["variant_group"] = group
    d.update(kw)
    return d


def cyl(r, h):
    return {"type": "cylinder", "radius": round(r, 3), "height": round(h, 3)}


# ----------------------------------------------------------------------------- registry
ASSETS = []


def reg(asset_id):
    def deco(fn):
        ASSETS.append((asset_id, fn))
        return fn
    return deco


def run_all(only=None):
    import re
    for aid, fn in ASSETS:
        if only and not re.search(only, aid):
            continue
        sl.clear_scene_objects()
        for m in list(bpy.data.meshes):
            if m.users == 0:
                bpy.data.meshes.remove(m)
        fn(aid, rng_for(aid))
    sl.clear_scene_objects()
