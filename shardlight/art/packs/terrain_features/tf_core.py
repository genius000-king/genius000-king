"""terrain_features core helpers: mesh builder (MB), noise, painting, finalize/export/preview, partial manifests.

Local to this pack (art/lib/sl_common.py is untouched).  Runs inside Blender 4.5.
"""
from __future__ import annotations

import json
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "lib"))

import bpy
import bmesh
from mathutils import Vector, Matrix, noise
import sl_common as sl

PACK = "terrain_features"
PARTIAL_DIR = os.path.join(HERE, "_partial")
PREVIEW_DIR = os.path.join(sl.PREVIEWS, PACK)
MODEL_DIR = os.path.join(sl.GAME_MODELS, PACK)
BG = "#4B4672"
SHADOW = "#6B5BD6"


# ----------------------------------------------------------------------------- small math
def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def lerp(a, b, t):
    return a + (b - a) * t


def smoothstep(a, b, x):
    if b == a:
        return 1.0 if x >= a else 0.0
    t = clamp((x - a) / (b - a))
    return t * t * (3 - 2 * t)


def smin(a, b, k):
    if k <= 1e-6:
        return min(a, b)
    h = max(k - abs(a - b), 0.0) / k
    return min(a, b) - h * h * k * 0.25


def fbm(p, seed=0.0, octaves=3):
    off = Vector((seed * 17.13 + 3.1, seed * 5.71 + 7.7, seed * 9.37 + 1.3))
    amp, f, s, tot = 1.0, 1.0, 0.0, 0.0
    for _ in range(octaves):
        s += amp * noise.noise(p * f + off)
        tot += amp
        amp *= 0.5
        f *= 2.03
    return s / tot


def rot_matrix(rx=0.0, ry=0.0, rz=0.0):
    """Euler XYZ in degrees -> 4x4 matrix."""
    return (Matrix.Rotation(math.radians(rz), 4, "Z") @ Matrix.Rotation(math.radians(ry), 4, "Y")
            @ Matrix.Rotation(math.radians(rx), 4, "X"))


def xf(loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    if not isinstance(scale, (tuple, list)):
        scale = (scale, scale, scale)
    S = Matrix.Diagonal((scale[0], scale[1], scale[2], 1.0))
    return Matrix.Translation(Vector(loc)) @ rot_matrix(*rot) @ S


def hexmix(a, b, t):
    return sl.mix(a, b, t)


def mix3(lo, mid, hi, t):
    if t < 0.5:
        return sl.mix(lo, mid, t * 2)
    return sl.mix(mid, hi, (t - 0.5) * 2)


def mulc(c, k):
    c = sl.hex_rgb(c)
    return tuple(clamp(x * k, 0.0, 1.0) for x in c)


def jit_c(c, rng, hue=0.015, sat=0.05, val=0.05):
    return sl.jitter(c, hue, sat, val, rng)


# ----------------------------------------------------------------------------- mesh builder
class MB:
    """Accumulates geometry from many primitive builders into one bmesh with per-face material + part id."""

    def __init__(self, mats=("VC_ROUGH",)):
        self.bm = bmesh.new()
        self.mats = list(mats)
        self.part_layer = self.bm.faces.layers.int.new("part")
        self._part = 0

    def mat(self, name):
        if name not in self.mats:
            self.mats.append(name)
        return self.mats.index(name)

    def next_part(self):
        self._part += 1
        return self._part

    def _tag(self, faces, mat, part):
        mi = self.mat(mat) if isinstance(mat, str) else mat
        for f in faces:
            f.material_index = mi
            f[self.part_layer] = part

    # ---- rock blob (icosphere shaped by radial function: noise + plane facets + superellipse)
    def rock(self, size=(1, 1, 1), seed=0, subdiv=3, noise_amp=0.12, noise_scale=1.3, planes=0,
             plane_off=(0.72, 0.95), soft=0.16, flat_bottom=0.6, squarish=0.0, M=None, mat="VC_ROUGH",
             part=0, plane_bias_up=0.3, jitter_v=0.0, flat_top=None):
        rng = random.Random(seed)
        res = bmesh.ops.create_icosphere(self.bm, subdivisions=subdiv, radius=1.0)
        verts = res["verts"]
        pl = []
        for _ in range(planes):
            while True:
                n = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1) + plane_bias_up))
                if 0.2 < n.length < 1.6:
                    break
            pl.append((n.normalized(), rng.uniform(*plane_off)))
        p_exp = 2.0 + squarish * 3.0
        for v in verts:
            d = v.co.normalized()
            r = 1.0
            if squarish > 0:
                r = (abs(d.x) ** p_exp + abs(d.y) ** p_exp + abs(d.z) ** p_exp) ** (-1.0 / p_exp)
            r *= 1.0 + noise_amp * fbm(d * noise_scale * 2.0, seed)
            for n, po in pl:
                dot = d.dot(n)
                if dot > 0.05:
                    r = smin(r, po / dot, soft)
            if flat_bottom is not None and d.z < -0.05:
                r = smin(r, flat_bottom / -d.z, soft * 0.6)
            if flat_top is not None and d.z > 0.05:
                r = smin(r, flat_top / d.z, soft * 0.6)
            if jitter_v:
                r *= 1.0 + rng.uniform(-jitter_v, jitter_v)
            p = Vector((d.x * r * size[0], d.y * r * size[1], d.z * r * size[2]))
            v.co = M @ p if M else p
        faces = {f for v in verts for f in v.link_faces}
        self._tag(faces, mat, part)
        return faces

    # ---- lathe/column: rings of `sides` verts at each (z, r) of profile (z may be non monotonic)
    def column(self, profile, sides=8, seed=0, jit=0.0, top="flat", apex=0.0, bottom=True, lean=(0, 0),
               M=None, mat="VC_ROUGH", part=0, ring_noise=0.0, rn_scale=1.0, rot0=0.0, aspect=1.0,
               twist=0.0, top_slope=(0, 0), r_scale_fn=None):
        rng = random.Random(seed)
        n = sides
        base_j = [rng.uniform(-1, 1) for _ in range(n)]
        rings = []
        last = len(profile) - 1
        for i, (z, r) in enumerate(profile):
            ring = []
            for k in range(n):
                a = rot0 + 2 * math.pi * k / n + twist * z
                rr = r * (1 + jit * (0.6 * base_j[k] + 0.4 * rng.uniform(-1, 1)))
                x = math.cos(a) * rr * aspect
                y = math.sin(a) * rr
                p = Vector((x + lean[0] * z, y + lean[1] * z, z))
                if ring_noise and r > 1e-4:
                    nz = fbm(p * rn_scale, seed)
                    p.x += math.cos(a) * aspect * nz * ring_noise * max(r, 0.2)
                    p.y += math.sin(a) * nz * ring_noise * max(r, 0.2)
                if i == last and (top_slope[0] or top_slope[1]):
                    p.z += top_slope[0] * x + top_slope[1] * y
                ring.append(self.bm.verts.new(M @ p if M else p))
            rings.append(ring)
        faces = []
        for i in range(len(rings) - 1):
            for k in range(n):
                a, b = rings[i][k], rings[i][(k + 1) % n]
                c, d = rings[i + 1][(k + 1) % n], rings[i + 1][k]
                try:
                    faces.append(self.bm.faces.new((a, b, c, d)))
                except ValueError:
                    pass
        if bottom:
            try:
                faces.append(self.bm.faces.new(list(reversed(rings[0]))))
            except ValueError:
                pass
        zt = profile[-1][0]
        if top == "flat":
            try:
                faces.append(self.bm.faces.new(rings[-1]))
            except ValueError:
                pass
        elif top == "point":
            c = Vector((lean[0] * zt, lean[1] * zt, zt + apex))
            av = self.bm.verts.new(M @ c if M else c)
            for k in range(n):
                try:
                    faces.append(self.bm.faces.new((rings[-1][k], rings[-1][(k + 1) % n], av)))
                except ValueError:
                    pass
        self._tag(faces, mat, part)
        return faces

    # ---- sweep rings along frames. ring points (x,y) in frame (u,w), u=w x t. CCW => outward normals
    def sweep(self, frames, rings, cap0=True, cap1=True, mat="VC_ROUGH", part=0, M=None):
        vr = []
        for (o, t, up), ring in zip(frames, rings):
            t = Vector(t).normalized()
            up = Vector(up)
            w = (up - t * up.dot(t)).normalized()
            u = w.cross(t)
            vr.append([self.bm.verts.new((M @ (Vector(o) + u * x + w * y)) if M else (Vector(o) + u * x + w * y))
                       for (x, y) in ring])
        n = len(vr[0])
        faces = []
        for i in range(len(vr) - 1):
            for k in range(n):
                a, b = vr[i][k], vr[i][(k + 1) % n]
                c, d = vr[i + 1][(k + 1) % n], vr[i + 1][k]
                try:
                    faces.append(self.bm.faces.new((a, b, c, d)))
                except ValueError:
                    pass
        if cap0:
            faces.append(self.bm.faces.new(list(reversed(vr[0]))))
        if cap1:
            faces.append(self.bm.faces.new(vr[-1]))
        self._tag(faces, mat, part)
        return faces

    def tube(self, pts, radii, sides=6, mat="VC_ROUGH", part=0, M=None, cap_end=True, up=(0, 0, 1)):
        """Circular tube along polyline (roots, vines)."""
        frames, rings = [], []
        pts = [Vector(p) for p in pts]
        for i, p in enumerate(pts):
            if i == 0:
                t = pts[1] - pts[0]
            elif i == len(pts) - 1:
                t = pts[-1] - pts[-2]
            else:
                t = (pts[i + 1] - p).normalized() + (p - pts[i - 1]).normalized()
            upv = Vector(up)
            if abs(t.normalized().dot(upv.normalized())) > 0.95:
                upv = Vector((1, 0, 0))
            frames.append((p, t, upv))
            r = radii[i]
            rings.append([(math.cos(2 * math.pi * k / sides) * r, math.sin(2 * math.pi * k / sides) * r)
                          for k in range(sides)])
        return self.sweep(frames, rings, cap0=True, cap1=cap_end, mat=mat, part=part, M=M)

    # ---- heightfield grid (top surface only + skirt closed to z=0 plane with bottom fan)
    def heightfield(self, nx, ny, sx, sy, fn, mat="VC_ROUGH", part=0, M=None, bottom=True):
        grid = []
        for j in range(ny + 1):
            row = []
            for i in range(nx + 1):
                x = (i / nx - 0.5) * sx
                y = (j / ny - 0.5) * sy
                z = fn(x, y)
                p = Vector((x, y, z))
                row.append(self.bm.verts.new(M @ p if M else p))
            grid.append(row)
        faces = []
        for j in range(ny):
            for i in range(nx):
                faces.append(self.bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i])))
        if bottom:
            # closing: perimeter loop dropped to z=0 and a single bottom n-gon
            per = [grid[0][i] for i in range(nx + 1)] + [grid[j][nx] for j in range(1, ny + 1)] + \
                  [grid[ny][i] for i in range(nx - 1, -1, -1)] + [grid[j][0] for j in range(ny - 1, 0, -1)]
            floor = []
            for v in per:
                p = Vector((v.co.x, v.co.y, 0.0))
                floor.append(self.bm.verts.new(p))
            m = len(per)
            for k in range(m):
                a, b = per[k], per[(k + 1) % m]
                fa, fb = floor[k], floor[(k + 1) % m]
                faces.append(self.bm.faces.new((a, fa, fb, b)))
            faces.append(self.bm.faces.new(list(reversed(floor))))
        self._tag(faces, mat, part)
        return faces

    def fix_normals(self):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)

    def triangulate(self):
        bmesh.ops.triangulate(self.bm, faces=list(self.bm.faces))

    def weld(self, dist=1e-4):
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=dist)

    def build(self, name, smooth=True, angle=None):
        me = bpy.data.meshes.new(name)
        self.bm.normal_update()
        self.bm.to_mesh(me)
        self.bm.free()
        obj = sl.new_object(name, me)
        for m in self.mats:
            obj.data.materials.append(sl.get_material(m))
        if smooth:
            sl.shade_smooth(obj, angle)
        else:
            sl.shade_flat(obj)
        return obj


# ----------------------------------------------------------------------------- painting
LIGHT = Vector((-0.45, -0.55, 0.70)).normalized()


def lit(c, n, amt=0.22, warm=0.10, shadow=SHADOW):
    """Bake a gentle warm-key / cool-violet-shadow tint into color c (sRGB tuple/hex) by normal n."""
    c = sl.hex_rgb(c)
    d = n.dot(LIGHT) * 0.5 + 0.5  # 0..1
    sh = sl.hex_rgb(shadow)
    # shadow side: multiply with violet
    k = clamp((0.55 - d) / 0.55) * amt
    c = tuple(c[i] * (1 - k) + c[i] * (sh[i] * 1.5) * k for i in range(3))
    # lit side: warm
    w = clamp((d - 0.55) / 0.45) * warm
    if w > 0:
        wc = (1.0, 0.88, 0.72)
        c = tuple(c[i] * (1 - w) + min(1.0, c[i] * 1.1 + 0.02) * wc[i] * w for i in range(3))
    return tuple(clamp(x, 0.035, 0.97) for x in c)


def paint(obj, fn):
    """fn(co, vertex_normal, poly_normal, material_index, part_id) -> sRGB color."""
    me = obj.data
    attr = sl.ensure_colors(obj)
    part = me.attributes.get("part")
    verts = me.vertices
    for poly in me.polygons:
        pn = poly.normal
        mi = poly.material_index
        pid = part.data[poly.index].value if part is not None else 0
        for li in poly.loop_indices:
            v = verts[me.loops[li].vertex_index]
            c = fn(v.co, v.normal, pn, mi, pid)
            sl._write_corner(attr, li, c)


def bake_ao_local(obj, strength=0.45, samples=10, distance=None):
    d = sl.dims(obj)
    if distance is None:
        distance = clamp(max(d) * 0.12, 0.4, 3.5)
    sl.bake_ao(obj, strength=strength, samples=samples, distance=distance)


# ----------------------------------------------------------------------------- finalize / preview
def bbox(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def shift(objs, off):
    for o in objs:
        o.data.transform(Matrix.Translation(-Vector(off)))
        o.data.update()


def render_preview(objs, name, size=512, elev=18, azim=-35, frame=1.15, bg=BG, cam=None, lens=50,
                   cull=False, center=None):
    scn = bpy.context.scene
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    lo, hi = bbox(objs)
    ctr = Vector(center) if center is not None else (lo + hi) / 2
    radius = max((hi - lo).length / 2, 0.05)
    cam_data = bpy.data.cameras.get("_pcam") or bpy.data.cameras.new("_pcam")
    cam_data.lens = lens
    cam_data.clip_start = 0.05
    cam_data.clip_end = 3000
    cam_obj = bpy.data.objects.get("_pcam") or sl.new_object("_pcam", cam_data)
    if cam is None:
        dist = radius * frame / math.tan(cam_data.angle / 2)
        e, a = math.radians(elev), math.radians(azim)
        cam_obj.location = ctr + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
        target = ctr
    else:
        cam_obj.location, target = Vector(cam[0]), Vector(cam[1])
    cam_obj.rotation_euler = (target - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
    scn.camera = cam_obj
    scn.render.engine = "BLENDER_WORKBENCH"
    sh = scn.display.shading
    sh.light = "STUDIO"
    sh.color_type = "VERTEX"
    sh.show_cavity = True
    sh.cavity_type = "BOTH"
    sh.show_shadows = True
    sh.shadow_intensity = 0.35
    sh.show_specular_highlight = False
    scn.world = scn.world or bpy.data.worlds.new("w")
    scn.world.color = tuple(sl.srgb_to_linear(c) for c in sl.hex_rgb(bg))
    scn.render.resolution_x = size
    scn.render.resolution_y = size
    scn.render.film_transparent = False
    scn.view_settings.view_transform = "Standard"
    mats = []
    for o in objs:
        for m in o.data.materials:
            if m not in mats:
                mats.append(m)
    old = [m.use_backface_culling for m in mats]
    if cull:
        for m in mats:
            m.use_backface_culling = True
    hidden = []
    for o in scn.objects:
        if o not in objs and o != cam_obj and not o.hide_render:
            o.hide_render = True
            hidden.append(o)
    path = os.path.join(PREVIEW_DIR, name + ".png")
    scn.render.filepath = path
    bpy.ops.render.render(write_still=True)
    for o in hidden:
        o.hide_render = False
    for m, v in zip(mats, old):
        m.use_backface_culling = v
    return path


def tri_total(objs):
    return sum(sl.tri_count(o) for o in objs)


def finish(objs, asset_id, category, worlds, collision, scatter, ao=0.45, ao_dist=None, extra=None,
           origin="base", preview_kw=None, extra_previews=None, ao_samples=10):
    """Shift origin, bake AO, export glb, render preview(s), return manifest entry."""
    objs = list(objs)
    main = objs[0]
    lo, hi = bbox(objs)
    if origin == "base":
        shift(objs, Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z)))
    elif origin == "center_xy":
        shift(objs, Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, 0.0)))
    # origin == "none": geometry is already authored around the intended origin
    for i, o in enumerate(objs):
        if i == 0:
            o.name = asset_id
            o.data.name = asset_id
        if ao:
            bake_ao_local(o, strength=ao, samples=ao_samples, distance=ao_dist)
    sl.export_glb(objs, asset_id, PACK)
    render_preview(objs, asset_id, **(preview_kw or {}))
    for suffix, kw in (extra_previews or {}).items():
        render_preview(objs, asset_id + suffix, **kw)
    lo, hi = bbox(objs)
    ent = {
        "id": asset_id,
        "file": asset_id + ".glb",
        "category": category,
        "worlds": worlds,
        "height": round(hi.z - lo.z, 3),
        "radius": round(max(hi.x - lo.x, hi.y - lo.y) / 2, 3),
        "collision": collision or {"type": "none"},
        "scatter": scatter,
        "tris": tri_total(objs),
    }
    if extra:
        ent.update(extra)
    return ent


class Recorder:
    """Per-family manifest partials, so families can be built in separate Blender processes."""

    def __init__(self, family):
        self.family = family
        self.entries = []

    def add(self, e):
        self.entries = [x for x in self.entries if x["id"] != e["id"]] + [e]
        print("  +", e["id"], e["tris"], "tris", e["collision"]["type"], "h=%.1f r=%.1f" % (e["height"], e["radius"]))

    def write(self):
        os.makedirs(PARTIAL_DIR, exist_ok=True)
        with open(os.path.join(PARTIAL_DIR, self.family + ".json"), "w") as f:
            json.dump(self.entries, f, indent=1)


def scatter(density=1.0, slope_max=35, min_spacing=3.0, cluster=0.4, zone="any"):
    return {"density": density, "slope_max": slope_max, "min_spacing": min_spacing, "cluster": cluster,
            "zone": zone}


def fresh():
    sl.reset()
