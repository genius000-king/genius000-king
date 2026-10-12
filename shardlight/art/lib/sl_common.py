"""Shardlight shared Blender helpers (Blender 4.5).

Usage inside a pack script run as:
    blender -b --factory-startup --python art/packs/<pack>/<pack>.py

    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "lib"))
    import sl_common as sl

Conventions are defined in docs/ART_BIBLE.md. Colors are hex strings or (r,g,b) tuples in sRGB.
"""
from __future__ import annotations

import bpy
import bmesh
import colorsys
import json
import math
import os
import random
from mathutils import Vector, Matrix, noise

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
GAME_MODELS = os.path.join(ROOT, "game", "assets", "models")
PREVIEWS = os.path.join(ROOT, "art", "previews")

COLOR_ATTR = "Col"


# ----------------------------------------------------------------------------- color utils
def hex_rgb(c):
    """'#RRGGBB' or tuple -> sRGB float tuple."""
    if isinstance(c, (tuple, list)):
        return tuple(float(x) for x in c[:3])
    c = c.lstrip("#")
    return tuple(int(c[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def srgb_to_linear(v):
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def mix(a, b, t):
    a, b = hex_rgb(a), hex_rgb(b)
    t = max(0.0, min(1.0, t))
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def jitter(c, hue=0.02, sat=0.05, val=0.06, rng=random):
    """Small painterly HSV jitter of an sRGB color."""
    r, g, b = hex_rgb(c)
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    h = (h + rng.uniform(-hue, hue)) % 1.0
    s = max(0.0, min(1.0, s + rng.uniform(-sat, sat)))
    v = max(0.03, min(0.98, v + rng.uniform(-val, val)))
    return colorsys.hsv_to_rgb(h, s, v)


# ----------------------------------------------------------------------------- scene
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scn = bpy.context.scene
    scn.unit_settings.system = "METRIC"
    return scn


def new_object(name, mesh_data, collection=None):
    obj = bpy.data.objects.new(name, mesh_data)
    (collection or bpy.context.scene.collection).objects.link(obj)
    return obj


def bm_to_object(bm, name, material="VC", smooth=True):
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    obj = new_object(name, me)
    set_material(obj, material)
    if smooth:
        shade_smooth(obj)
    return obj


def shade_smooth(obj, angle_deg=None):
    for p in obj.data.polygons:
        p.use_smooth = True
    if angle_deg is not None:
        # Blender 4.1+: auto-smooth via modifier-less API
        try:
            obj.data.set_sharp_from_angle(angle=math.radians(angle_deg))
        except Exception:
            pass


def shade_flat(obj):
    for p in obj.data.polygons:
        p.use_smooth = False


def get_material(name):
    """Materials are white base; vertex colors carry color. Name maps to a Godot shader (ART_BIBLE §3)."""
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    attr = nt.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = COLOR_ATTR
    nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.85
    if name.startswith("EMIT"):
        nt.links.new(attr.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = 3.0
    if name == "GLASS":
        bsdf.inputs["Alpha"].default_value = 0.55
        bsdf.inputs["Roughness"].default_value = 0.1
    return mat


def set_material(obj, name):
    obj.data.materials.clear()
    obj.data.materials.append(get_material(name))


def add_material_slot(obj, name):
    """Append a material slot and return its index (use with face.material_index)."""
    obj.data.materials.append(get_material(name))
    return len(obj.data.materials) - 1


def join(objs, name):
    objs = [o for o in objs if o is not None]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    return o


def apply_transforms(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


def apply_modifiers(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    for m in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def origin_to_base(obj):
    """Move geometry so the origin is at bottom-center (ART_BIBLE §2). Object location set to 0."""
    me = obj.data
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    zs = [v.co.z for v in me.vertices]
    off = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)))
    for v in me.vertices:
        v.co -= off
    obj.location = (0, 0, 0)


def dims(obj):
    me = obj.data
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    zs = [v.co.z for v in me.vertices]
    return max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)


def tri_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


# ----------------------------------------------------------------------------- geometry helpers
def bevel(obj, width=0.04, segments=2, angle_deg=40):
    m = obj.modifiers.new("bevel", "BEVEL")
    m.width = width
    m.segments = segments
    m.limit_method = "ANGLE"
    m.angle_limit = math.radians(angle_deg)
    apply_modifiers(obj)


def subdivide(obj, levels=1):
    m = obj.modifiers.new("subsurf", "SUBSURF")
    m.levels = levels
    m.render_levels = levels
    apply_modifiers(obj)


def decimate(obj, ratio):
    m = obj.modifiers.new("dec", "DECIMATE")
    m.ratio = ratio
    apply_modifiers(obj)


def displace_noise(obj, strength=0.2, scale=1.0, seed=0, axis_weights=(1, 1, 1)):
    """Low-frequency organic displacement along normals using mathutils.noise."""
    me = obj.data
    me.calc_loop_triangles()
    off = Vector((seed * 13.37, seed * 7.77, seed * 3.33))
    for v in me.vertices:
        p = v.co * (1.0 / max(scale, 1e-4)) + off
        n = noise.noise(p)  # -1..1
        d = v.normal * n * strength
        v.co += Vector((d.x * axis_weights[0], d.y * axis_weights[1], d.z * axis_weights[2]))
    me.update()


def blob(name, radius=1.0, seed=0, squash=(1, 1, 1), noise_amt=0.25, noise_scale=0.8, subdiv=3, material="VC"):
    """Organic rounded blob — good base for rocks, bushes, clouds, puff canopies."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    for v in bm.verts:
        v.co.x *= squash[0]
        v.co.y *= squash[1]
        v.co.z *= squash[2]
    obj = bm_to_object(bm, name, material)
    displace_noise(obj, strength=noise_amt * radius, scale=noise_scale * radius, seed=seed)
    return obj


def tapered_tube(name, path_pts, radii, sides=8, material="VC", cap=True):
    """Tube along a polyline with per-point radius — trunks, branches, horns, cables, stalks."""
    bm = bmesh.new()
    rings = []
    n = len(path_pts)
    pts = [Vector(p) for p in path_pts]
    # tangents
    tans = []
    for i in range(n):
        if i == 0:
            t = pts[1] - pts[0]
        elif i == n - 1:
            t = pts[-1] - pts[-2]
        else:
            t = (pts[i + 1] - pts[i]).normalized() + (pts[i] - pts[i - 1]).normalized()
        tans.append(t.normalized())
    # parallel-transport frame (no twisting)
    ref = Vector((0, 0, 1)) if abs(tans[0].z) < 0.95 else Vector((1, 0, 0))
    side = tans[0].cross(ref).normalized()
    for i, (p, r) in enumerate(zip(pts, radii)):
        t = tans[i]
        if i > 0:
            rot = tans[i - 1].rotation_difference(t)
            side = (rot @ side)
            side = (side - t * side.dot(t)).normalized()
        up2 = side.cross(t).normalized()
        ring = []
        for k in range(sides):
            a = 2 * math.pi * k / sides
            ring.append(bm.verts.new(p + (side * math.cos(a) + up2 * math.sin(a)) * r))
        rings.append(ring)
    for i in range(n - 1):
        for k in range(sides):
            a, b = rings[i][k], rings[i][(k + 1) % sides]
            c, d = rings[i + 1][(k + 1) % sides], rings[i + 1][k]
            bm.faces.new((a, b, c, d))
    if cap:
        bm.faces.new(list(reversed(rings[0])))
        if radii[-1] > 1e-4:
            bm.faces.new(rings[-1])
    # side quads above are wound clockwise seen from outside → flip so normals point outward
    # (inward normals make the inverted-hull ink outline cover the whole mesh in the game)
    bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
    return bm_to_object(bm, name, material)


def curve_path(start, end, bend=(0, 0, 0), steps=6, wobble=0.0, seed=0):
    """Quadratic bezier polyline from start to end, bent by `bend` at the midpoint."""
    rng = random.Random(seed)
    s, e = Vector(start), Vector(end)
    m = (s + e) / 2 + Vector(bend)
    pts = []
    for i in range(steps + 1):
        t = i / steps
        p = (1 - t) ** 2 * s + 2 * (1 - t) * t * m + t ** 2 * e
        if 0 < i < steps and wobble:
            p += Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))) * wobble
        pts.append(tuple(p))
    return pts


def rounded_box(name, size=(1, 1, 1), radius=0.08, segments=2, material="VC"):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
    obj = bm_to_object(bm, name, material, smooth=False)
    m = obj.modifiers.new("bevel", "BEVEL")
    m.width = radius
    m.segments = segments
    apply_modifiers(obj)
    shade_smooth(obj, 35)
    return obj


def place(obj, loc=(0, 0, 0), rot_deg=(0, 0, 0), scale=(1, 1, 1)):
    obj.location = loc
    obj.rotation_euler = tuple(math.radians(a) for a in rot_deg)
    obj.scale = scale if isinstance(scale, (tuple, list)) else (scale, scale, scale)
    apply_transforms_and_location(obj)
    return obj


def apply_transforms_and_location(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


# ----------------------------------------------------------------------------- vertex colors
def ensure_colors(obj):
    me = obj.data
    if COLOR_ATTR not in me.color_attributes:
        me.color_attributes.new(COLOR_ATTR, "FLOAT_COLOR", "CORNER")
    me.color_attributes.active_color = me.color_attributes[COLOR_ATTR]
    try:
        me.color_attributes.render_color_index = me.color_attributes.active_color_index
    except Exception:
        pass
    return me.color_attributes[COLOR_ATTR]


def _write_corner(attr, loop_index, rgb, a=1.0):
    # FLOAT_COLOR stores linear values; we author in sRGB.
    attr.data[loop_index].color = (srgb_to_linear(rgb[0]), srgb_to_linear(rgb[1]), srgb_to_linear(rgb[2]), a)


def paint_solid(obj, color, jitter_amt=0.0, seed=0):
    rng = random.Random(seed)
    attr = ensure_colors(obj)
    for poly in obj.data.polygons:
        c = jitter(color, 0.01 * jitter_amt, 0.04 * jitter_amt, 0.05 * jitter_amt, rng) if jitter_amt else hex_rgb(color)
        for li in poly.loop_indices:
            _write_corner(attr, li, c)


def paint_gradient(obj, bottom, top, noise_amt=0.06, axis=2, seed=0, curve=1.0, zmin=None, zmax=None):
    """Height gradient (painterly). noise_amt adds low-frequency value/hue variation."""
    me = obj.data
    attr = ensure_colors(obj)
    zs = [v.co[axis] for v in me.vertices]
    lo = min(zs) if zmin is None else zmin
    hi = max(zs) if zmax is None else zmax
    span = max(hi - lo, 1e-5)
    off = Vector((seed * 3.1, seed * 1.7, seed * 0.9))
    for poly in me.polygons:
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index]
            t = ((v.co[axis] - lo) / span) ** curve
            c = mix(bottom, top, t)
            if noise_amt:
                n = noise.noise(v.co * 1.3 + off)
                c = tuple(max(0.0, min(1.0, ch + n * noise_amt)) for ch in c)
            _write_corner(attr, li, c)


def paint_faces(obj, fn):
    """fn(poly, center: Vector, normal: Vector) -> color (or None to keep)."""
    me = obj.data
    attr = ensure_colors(obj)
    for poly in me.polygons:
        c = fn(poly, poly.center.copy(), poly.normal.copy())
        if c is None:
            continue
        c = hex_rgb(c)
        for li in poly.loop_indices:
            _write_corner(attr, li, c)


def paint_by_material(obj, color_for_index):
    """Paint faces by their material slot index: color_for_index = {0:'#hex', 1:'#hex'}."""
    paint_faces(obj, lambda p, c, n: color_for_index.get(p.material_index))


def tint_top(obj, color, threshold=0.6, strength=0.6):
    """Blend faces whose normals point up toward `color` (moss / snow / grass caps)."""
    me = obj.data
    attr = ensure_colors(obj)
    col = hex_rgb(color)
    for poly in me.polygons:
        up = poly.normal.z
        if up < threshold:
            continue
        t = min(1.0, (up - threshold) / (1 - threshold)) * strength
        for li in poly.loop_indices:
            cur = attr.data[li].color
            # back to srgb-ish via approximate gamma
            cs = [c ** (1 / 2.2) for c in cur[:3]]
            nc = [cs[i] + (col[i] - cs[i]) * t for i in range(3)]
            _write_corner(attr, li, nc)


def bake_ao(obj, strength=0.45, samples=12, distance=None):
    """Bake ambient occlusion with Cycles into a temp color attribute and multiply it into `Col`.

    Shadow tint: occluded areas shift toward cool violet (ART_BIBLE lighting language) instead of plain black.
    """
    scn = bpy.context.scene
    prev_engine = scn.render.engine
    scn.render.engine = "CYCLES"
    scn.cycles.device = "CPU"
    scn.cycles.samples = samples
    me = obj.data
    ensure_colors(obj)
    tmp = me.color_attributes.get("_ao") or me.color_attributes.new("_ao", "FLOAT_COLOR", "CORNER")
    me.color_attributes.active_color = tmp
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    if distance is None:
        d = dims(obj)
        distance = max(0.3, max(d) * 0.35)
    scn.world = scn.world or bpy.data.worlds.new("w")
    scn.world.light_settings.distance = distance
    try:
        bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
    except Exception as e:  # never fail an asset because of AO
        print("AO bake failed:", e)
        me.color_attributes.remove(tmp)
        me.color_attributes.active_color = me.color_attributes[COLOR_ATTR]
        scn.render.engine = prev_engine
        return
    col = me.color_attributes[COLOR_ATTR]
    shadow = [srgb_to_linear(x) for x in hex_rgb("#5B4BB0")]
    for i in range(len(col.data)):
        ao = tmp.data[i].color[0]
        occ = (1.0 - ao) * strength
        c = col.data[i].color
        nc = [c[k] * (1.0 - occ) + c[k] * shadow[k] * 1.4 * occ for k in range(3)]
        col.data[i].color = (nc[0], nc[1], nc[2], c[3])
    me.color_attributes.remove(tmp)
    me.color_attributes.active_color = me.color_attributes[COLOR_ATTR]
    scn.render.engine = prev_engine


# ----------------------------------------------------------------------------- export & preview
def export_glb(objs, asset_id, pack):
    out_dir = os.path.join(GAME_MODELS, pack)
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, asset_id + ".glb")
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
        if o.type == "MESH":
            ensure_colors(o)
    bpy.context.view_layer.objects.active = objs[0]
    kw = dict(filepath=path, export_format="GLB", use_selection=True, export_apply=True,
              export_yup=True, export_texcoords=True, export_normals=True, export_materials="EXPORT")
    try:
        bpy.ops.export_scene.gltf(export_vertex_color="ACTIVE", export_all_vertex_colors=False, **kw)
    except TypeError:
        bpy.ops.export_scene.gltf(export_colors=True, **kw)
    return path


def export_glb_with_anims(objs, asset_id, pack):
    """For rigged characters/creatures: exports armature + mesh + all actions (NLA strips / actions)."""
    out_dir = os.path.join(GAME_MODELS, pack)
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, asset_id + ".glb")
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
        if o.type == "MESH":
            ensure_colors(o)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=False,
                              export_yup=True, export_vertex_color="ACTIVE", export_animations=True,
                              export_animation_mode="ACTIONS", export_force_sampling=True,
                              export_skins=True, export_materials="EXPORT")
    return path


def preview(objs, asset_id, pack, size=512, bg="#2A2440", elev=18, azim=-35, frame=1.15):
    """Workbench preview with vertex colors, studio lighting, 3/4 view, auto-framed."""
    scn = bpy.context.scene
    out_dir = os.path.join(PREVIEWS, pack)
    os.makedirs(out_dir, exist_ok=True)
    meshes = [o for o in objs if o.type == "MESH"]
    pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    center = (lo + hi) / 2
    radius = max((hi - lo).length / 2, 0.05)
    cam_data = bpy.data.cameras.get("_pcam") or bpy.data.cameras.new("_pcam")
    cam_data.lens = 50
    cam = bpy.data.objects.get("_pcam") or new_object("_pcam", cam_data)
    dist = radius * frame / math.tan(cam_data.angle / 2)
    e, a = math.radians(elev), math.radians(azim)
    cam.location = center + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
    scn.camera = cam
    scn.render.engine = "BLENDER_WORKBENCH"
    sh = scn.display.shading
    sh.light = "STUDIO"
    sh.color_type = "VERTEX"
    sh.show_cavity = True
    sh.cavity_type = "BOTH"
    sh.show_shadows = True
    sh.shadow_intensity = 0.35
    scn.world = scn.world or bpy.data.worlds.new("w")
    scn.world.color = tuple(srgb_to_linear(c) for c in hex_rgb(bg))
    scn.display.shading.show_specular_highlight = False
    scn.render.resolution_x = size
    scn.render.resolution_y = size
    scn.render.film_transparent = False
    scn.view_settings.view_transform = "Standard"
    # hide everything else
    hidden = []
    for o in scn.objects:
        if o not in objs and o != cam:
            if not o.hide_render:
                o.hide_render = True
                hidden.append(o)
    path = os.path.join(out_dir, asset_id + ".png")
    scn.render.filepath = path
    bpy.ops.render.render(write_still=True)
    for o in hidden:
        o.hide_render = False
    return path


def clear_scene_objects():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        if m.users == 0:
            bpy.data.meshes.remove(m)


class Manifest:
    """Collects asset entries and writes game/assets/models/<pack>/manifest.json."""

    def __init__(self, pack):
        self.pack = pack
        self.assets = []

    def add(self, asset_id, obj, category, worlds, collision=None, scatter=None, extra=None):
        w, d, h = dims(obj)
        entry = {
            "id": asset_id,
            "file": asset_id + ".glb",
            "category": category,
            "worlds": worlds,
            "height": round(h, 3),
            "radius": round(max(w, d) / 2, 3),
            "collision": collision or {"type": "none"},
            "scatter": scatter,
            "tris": tri_count(obj),
        }
        if extra:
            entry.update(extra)
        self.assets = [a for a in self.assets if a["id"] != asset_id] + [entry]
        return entry

    def write(self):
        out_dir = os.path.join(GAME_MODELS, self.pack)
        os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, "manifest.json"), "w") as f:
            json.dump({"pack": self.pack, "assets": self.assets}, f, indent=1)


def finalize(obj, asset_id, pack, manifest, category, worlds, collision=None, scatter=None, ao=0.45,
             extra=None, do_preview=True):
    """Standard pipeline: apply transforms, origin to base, AO, export, preview, manifest. Returns entry."""
    apply_transforms(obj)
    origin_to_base(obj)
    obj.name = asset_id
    if ao:
        bake_ao(obj, strength=ao)
    export_glb([obj], asset_id, pack)
    if do_preview:
        preview([obj], asset_id, pack)
    entry = manifest.add(asset_id, obj, category, worlds, collision, scatter, extra)
    return entry


def contact_sheet(pack, cols=6, cell=256):
    """Builds art/previews/<pack>/_sheet.png from the individual previews (needs Blender's image API)."""
    out_dir = os.path.join(PREVIEWS, pack)
    files = sorted(f for f in os.listdir(out_dir) if f.endswith(".png") and not f.startswith("_"))
    if not files:
        return None
    cols = min(cols, len(files))
    rows = math.ceil(len(files) / cols)
    W, H = cols * cell, rows * cell
    bgc = [srgb_to_linear(c) for c in hex_rgb("#2A2440")] + [1.0]
    sheet = bgc * (W * H)
    for idx, fn in enumerate(files):
        img = bpy.data.images.load(os.path.join(out_dir, fn))
        img.scale(cell, cell)
        px = list(img.pixels)
        cx, cy = idx % cols, rows - 1 - idx // cols
        for y in range(cell):
            row_src = y * cell * 4
            row_dst = ((cy * cell + y) * W + cx * cell) * 4
            sheet[row_dst:row_dst + cell * 4] = px[row_src:row_src + cell * 4]
        bpy.data.images.remove(img)
    out = bpy.data.images.new("_sheet", W, H, alpha=True)
    out.pixels = sheet
    out.filepath_raw = os.path.join(out_dir, "_sheet.png")
    out.file_format = "PNG"
    out.save()
    return out.filepath_raw
