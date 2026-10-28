"""Cinematic desk montage — fully procedural Blender scene.

    blender -b -P build_scene.py -- --quality preview          # build + save .blend
    blender -b cinematic_desk.blend -a                          # render

Story beats (edit TIMING to match your voice-over, in seconds):
  1. open      dark room, LED strip flickers on, slow push-in (establishing)
  2. arc       camera arcs left and down, rack focus keyboard -> notebook
  3. note      top-down on the handwritten note
  4. line      a glowing line is born from the circled word, runs across the
               desk, over the edge, into the dark under the desk
  5. world     match cut: the same line drops into a dark void and becomes
               the first edge of a growing network; camera pulls back, title
"""
import math
import os
import random
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, "textures")
FPS = 24

# ---------------------------------------------------------------- config ---
TIMING = {  # seconds
    "open": (0.0, 4.0),
    "arc": (4.0, 8.0),
    "note": (8.0, 11.0),
    "line": (11.0, 15.5),
    "world": (15.5, 22.0),
}
WORLD_TITLE = "2004"
LINE_COLOR = (0.55, 0.85, 1.0)  # cool cyan-white
LED_COLOR = (0.82, 0.9, 1.0)    # ~6500K
W2 = Vector((0.0, 60.0, 0.0))   # where the second "world" lives
DESK_Z = 0.75

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
QUALITY = args[args.index("--quality") + 1] if "--quality" in args else "preview"
FOG = "--fog" in args


def sec(t):
    return int(round(t * FPS))


# ------------------------------------------------------------- helpers ---
def clean():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def node_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    return m, m.node_tree.nodes, m.node_tree.links, m.node_tree.nodes["Principled BSDF"]


def mat(name, color, rough=0.5, metal=0.0, emit=None, strength=0.0, coat=0.0):
    m, _, _, b = node_mat(name)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Coat Weight"].default_value = coat
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = strength
    return m


def emission(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*color, 1)
    e.inputs["Strength"].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(e.outputs[0], out.inputs[0])
    return m


def image_mat(name, path, rough=0.6, emit=0.0):
    m, n, l, b = node_mat(name)
    t = n.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(path)
    l.new(t.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = rough
    if emit:
        l.new(t.outputs["Color"], b.inputs["Emission Color"])
        b.inputs["Emission Strength"].default_value = emit
    return m


def concrete():
    m, n, l, b = node_mat("Concrete")
    noise = n.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 18
    noise.inputs["Detail"].default_value = 12
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.32, 0.32, 0.33, 1)
    ramp.color_ramp.elements[1].color = (0.55, 0.55, 0.56, 1)
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.25
    l.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    l.new(ramp.outputs["Color"], b.inputs["Base Color"])
    l.new(noise.outputs["Fac"], bump.inputs["Height"])
    l.new(bump.outputs["Normal"], b.inputs["Normal"])
    b.inputs["Roughness"].default_value = 0.85
    return m


def felt(color, scale=400, strength=0.15, rough=0.95):
    m, n, l, b = node_mat("Felt")
    noise = n.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    l.new(noise.outputs["Fac"], bump.inputs["Height"])
    l.new(bump.outputs["Normal"], b.inputs["Normal"])
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    return m


def box(name, loc, dims, material, bevel=0.003, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = dims
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = o.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    o.data.materials.append(material)
    return o


def cyl(name, loc, r, depth, material, rot=(0, 0, 0), verts=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    bpy.ops.object.shade_smooth()
    o.data.materials.append(material)
    return o


def sphere(name, loc, r, material, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=32, ring_count=16)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.shade_smooth()
    o.data.materials.append(material)
    return o


def text_obj(name, body, loc, size, material, rot=(math.radians(90), 0, 0), extrude=0.0, align="CENTER"):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.align_x = align
    cu.align_y = "CENTER"
    font = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
    if os.path.exists(font):
        cu.font = bpy.data.fonts.load(font)
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = rot
    o.data.materials.append(material)
    return o


def area(name, loc, rot, size, energy, color=LED_COLOR, size_y=None):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy
    ld.color = color
    if size_y:
        ld.shape = "RECTANGLE"
        ld.size, ld.size_y = size, size_y
    else:
        ld.size = size
    o = bpy.data.objects.new(name, ld)
    bpy.context.collection.objects.link(o)
    o.location, o.rotation_euler = loc, rot
    return o


def catmull(pts, n_per_seg=16):
    """Smooth poly-line through control points."""
    pts = [Vector(p) for p in pts]
    ext = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
    out = []
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for k in range(n_per_seg):
            t = k / n_per_seg
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(pts[-1])
    return out


class Path:
    """Arc-length parameterised poly-line, so the camera can ride the line tip exactly."""

    def __init__(self, pts):
        self.p = pts
        self.cum = [0.0]
        for a, b in zip(pts, pts[1:]):
            self.cum.append(self.cum[-1] + (b - a).length)
        self.L = self.cum[-1]

    def at(self, u):
        s = max(0.0, min(1.0, u)) * self.L
        for i in range(1, len(self.cum)):
            if self.cum[i] >= s:
                seg = self.cum[i] - self.cum[i - 1] or 1e-9
                return self.p[i - 1].lerp(self.p[i], (s - self.cum[i - 1]) / seg)
        return self.p[-1]


def glow_curve(name, pts, radius, material):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 3
    cu.use_fill_caps = True
    cu.bevel_factor_mapping_end = "SPLINE"
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (*p, 1)
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(material)
    cu.bevel_factor_end = 0.0
    return o


def grow(curve_obj, f0, f1, ease=lambda x: x, path=None, riders=()):
    """Animate the curve drawing itself; optional objects ride the tip."""
    cu = curve_obj.data
    for f in range(f0 - 1, f1 + 2):
        t = max(0.0, min(1.0, (f - f0) / max(1, f1 - f0)))
        u = ease(t)
        cu.bevel_factor_end = u
        cu.keyframe_insert("bevel_factor_end", frame=f)
        if path:
            for r in riders:
                r.location = path.at(u)
                r.keyframe_insert("location", frame=f)


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * t * (t * (t * 6 - 15) + 10)


def ease_in_out_cubic(t):
    return 4 * t ** 3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


def set_linear(id_data):
    ad = id_data.animation_data
    if not ad or not ad.action:
        return
    fcs = getattr(ad.action, "fcurves", None)
    if fcs is None:  # slotted actions (Blender 5)
        fcs = [fc for layer in ad.action.layers for strip in layer.strips
               for bag in strip.channelbags for fc in bag.fcurves]
    for fc in fcs:
        for k in fc.keyframe_points:
            k.interpolation = "LINEAR"


# --------------------------------------------------------------- scene ---
def build_room():
    black = mat("SatinBlack", (0.01, 0.01, 0.011), 0.45, coat=0.1)
    matte = mat("MatteBlack", (0.02, 0.02, 0.021), 0.8)
    metal = mat("DarkMetal", (0.05, 0.05, 0.055), 0.3, 1.0)
    chrome = mat("Chrome", (0.8, 0.8, 0.82), 0.12, 1.0)

    # floor (shag rug) + room shell
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
    bpy.context.active_object.data.materials.append(felt((0.015, 0.015, 0.016), 900, 0.6))
    box("BackWall", (0, 0.5, 1.6), (4.0, 0.1, 3.2), concrete(), 0)
    box("RightWall", (1.75, -1.0, 1.6), (0.1, 3.2, 3.2), matte, 0)
    box("Ceiling", (0, -1.0, 3.2), (4.0, 3.2, 0.1), matte, 0)
    hole = mat("TieHole", (0.08, 0.08, 0.08), 0.9)
    for x in (-1.5, -0.9, -0.3, 0.3, 0.9, 1.5):
        for z in (0.95, 1.55):
            cyl("Tie", (x, 0.448, z), 0.012, 0.01, hole, rot=(math.radians(90), 0, 0), verts=16)

    # upper pegboard cabinet + LED strip under its lip
    box("Cabinet", (0, 0.25, 2.15), (3.4, 0.45, 0.7), matte, 0.01)
    led_mat = emission("LED", LED_COLOR, 12.0)
    box("LEDStrip", (0, 0.04, 1.795), (3.3, 0.02, 0.008), led_mat, 0)
    led = area("LEDWash", (0, 0.2, 1.78), (0, 0, 0), 3.2, 60, size_y=0.08)

    # desk
    box("DeskTop", (0, 0.05, DESK_Z - 0.02), (3.3, 0.9, 0.04), black, 0.006)
    box("DeskShelf", (-0.15, 0.32, DESK_Z + 0.06), (1.6, 0.2, 0.012), black, 0.004)
    for x in (-1.55, 1.55):
        box("Leg", (x, 0.05, (DESK_Z - 0.04) / 2), (0.05, 0.8, DESK_Z - 0.04), black, 0.004)
    box("Drawer", (-1.2, 0.0, 0.55), (0.5, 0.75, 0.3), black, 0.006)

    # monitor on arm
    box("Monitor", (-0.2, 0.32, 1.12), (0.92, 0.025, 0.52), black, 0.004)
    screen = image_mat("Screen", os.path.join(TEX, "screen.png"), 0.2, emit=1.6)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(-0.2, 0.3065, 1.12), rotation=(math.radians(90), 0, 0))
    sc = bpy.context.active_object
    sc.scale = (0.89, 0.5, 1)
    sc.data.materials.append(screen)
    cyl("MonArm", (-0.2, 0.36, 0.95), 0.012, 0.32, metal)

    # speakers (the left one has a glowing ring, like the reference)
    ring = emission("SpeakerRing", LED_COLOR, 6)
    for x in (-1.15, 0.55):
        box("Speaker", (x, 0.2, DESK_Z + 0.16), (0.17, 0.2, 0.3), black, 0.01)
        cyl("Woofer", (x, 0.098, DESK_Z + 0.1), 0.055, 0.01, metal, rot=(math.radians(90), 0, 0))
        cyl("Tweeter", (x, 0.098, DESK_Z + 0.23), 0.025, 0.01, metal, rot=(math.radians(90), 0, 0))
    bpy.ops.mesh.primitive_torus_add(location=(-1.15, 0.094, DESK_Z + 0.16), rotation=(math.radians(90), 0, 0),
                                     major_radius=0.075, minor_radius=0.003)
    bpy.context.active_object.data.materials.append(ring)

    # desk mat, keyboard, mouse, controller
    box("DeskMat", (0.05, -0.12, DESK_Z + 0.002), (0.9, 0.38, 0.004), felt((0.09, 0.09, 0.095)), 0.002)
    box("Keyboard", (0.08, -0.08, DESK_Z + 0.012), (0.36, 0.13, 0.016), metal, 0.003)
    key = box("Key", (0.08 - 0.165, -0.08 - 0.048, DESK_Z + 0.024), (0.016, 0.016, 0.008),
              mat("Keycap", (0.03, 0.03, 0.03), 0.6), 0.002)
    for axis, n in ((0, 18), (1, 6)):
        a = key.modifiers.new("Array", "ARRAY")
        a.count = n
        a.use_relative_offset = False
        a.use_constant_offset = True
        a.constant_offset_displace = (0.0195, 0, 0) if axis == 0 else (0, 0.0195, 0)
    box("KeyGlow", (0.08, -0.08, DESK_Z + 0.005), (0.365, 0.135, 0.002), emission("KeyGlow", LED_COLOR, 3), 0)
    box("WristRest", (0.12, -0.2, DESK_Z + 0.01), (0.3, 0.07, 0.016), matte, 0.006)
    sphere("Mouse", (0.38, -0.05, DESK_Z + 0.015), 0.03, matte, (0.9, 1.5, 0.55))
    pad = mat("PadBlack", (0.02, 0.02, 0.02), 0.45)
    sphere("PadBody", (-0.25, -0.2, DESK_Z + 0.02), 0.05, pad, (1.4, 0.8, 0.4))
    for dx in (-0.055, 0.055):
        sphere("PadGrip", (-0.25 + dx, -0.235, DESK_Z + 0.02), 0.035, pad, (0.8, 1.1, 0.6))

    # PC case with ring fans
    box("PC", (1.3, 0.15, DESK_Z + 0.24), (0.26, 0.45, 0.48), black, 0.006)
    fan = emission("Fan", (0.9, 0.95, 1.0), 10)
    for z in (0.1, 0.25, 0.4):
        bpy.ops.mesh.primitive_torus_add(location=(1.3, -0.08, DESK_Z + z), rotation=(math.radians(90), 0, 0),
                                         major_radius=0.06, minor_radius=0.004)
        bpy.context.active_object.data.materials.append(fan)

    # flip clock + poster
    box("Clock", (0.95, 0.35, DESK_Z + 0.55), (0.18, 0.06, 0.09), matte, 0.004)
    text_obj("ClockDigits", "7 35", (0.95, 0.318, DESK_Z + 0.55), 0.06, emission("ClockInk", (1, 1, 1), 2))
    box("Poster", (1.695, 0.0, 1.35), (0.01, 0.5, 0.7), matte, 0)
    text_obj("PosterText", "LISTEN.\nTHINK.\nBUILD.", (1.688, 0.0, 1.4), 0.1,
             mat("PosterInk", (0.6, 0.6, 0.6), 0.7), rot=(math.radians(90), 0, math.radians(90)))

    # notebook with the handwritten note (origin of the glowing line)
    nb_loc = Vector((-0.42, -0.14, DESK_Z + 0.006))
    box("NotebookCover", nb_loc, (0.16, 0.21, 0.008), mat("Cover", (0.05, 0.04, 0.035), 0.55), 0.002,
        rot=(0, 0, math.radians(8)))
    bpy.ops.mesh.primitive_plane_add(size=1, location=nb_loc + Vector((0, 0, 0.0045)), rotation=(0, 0, math.radians(8)))
    page = bpy.context.active_object
    page.name = "NotePage"
    page.scale = (0.15, 0.2, 1)
    page.data.materials.append(image_mat("Note", os.path.join(TEX, "note.png"), 0.7))

    # loose papers + mug
    paper = mat("Paper", (0.7, 0.7, 0.68), 0.8)
    rnd = random.Random(3)
    for i in range(3):
        bpy.ops.mesh.primitive_plane_add(size=1, location=(-0.85 + i * 0.05, -0.12 + i * 0.02, DESK_Z + 0.001 + i * 0.0006),
                                         rotation=(0, 0, rnd.uniform(-0.4, 0.4)))
        p = bpy.context.active_object
        p.scale = (0.21, 0.297, 1)
        p.data.materials.append(paper)
    cyl("Mug", (-0.68, 0.08, DESK_Z + 0.05), 0.04, 0.1, mat("Ceramic", (0.03, 0.03, 0.03), 0.25))
    cyl("Coffee", (-0.68, 0.08, DESK_Z + 0.092), 0.036, 0.01, mat("Coffee", (0.03, 0.012, 0.005), 0.1))

    # chair (mostly silhouette, frames the foreground)
    mesh = mat("Mesh", (0.02, 0.02, 0.022), 0.7)
    cx, cy = 0.85, -0.95
    box("Seat", (cx, cy, 0.5), (0.5, 0.48, 0.07), mesh, 0.02)
    box("Back", (cx + 0.05, cy - 0.27, 0.9), (0.46, 0.06, 0.65), mesh, 0.03, rot=(math.radians(-10), 0, math.radians(8)))
    cyl("Gas", (cx, cy, 0.3), 0.025, 0.38, chrome)
    for i in range(5):
        a = i * 2 * math.pi / 5
        box("Star", (cx + math.cos(a) * 0.15, cy + math.sin(a) * 0.15, 0.08), (0.3, 0.04, 0.03), chrome, 0.01,
            rot=(0, 0, a))

    # key spot (top right, like the reference lamp)
    sd = bpy.data.lights.new("KeySpot", "SPOT")
    sd.energy, sd.spot_size, sd.spot_blend, sd.color = 150, math.radians(55), 0.6, LED_COLOR
    so = bpy.data.objects.new("KeySpot", sd)
    bpy.context.collection.objects.link(so)
    so.location = (1.3, -0.3, 2.9)
    so.rotation_euler = (math.radians(28), math.radians(22), 0)
    area("Rim", (-1.9, -0.6, 1.2), (math.radians(90), 0, math.radians(-110)), 0.6, 25)

    if FOG:  # volumetric haze makes light beams readable
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.8, 1.6))
        fog = bpy.context.active_object
        fog.scale = (3.4, 2.6, 3.1)
        m = bpy.data.materials.new("Haze")
        m.use_nodes = True
        nt = m.node_tree
        nt.nodes.remove(nt.nodes["Principled BSDF"])
        v = nt.nodes.new("ShaderNodePrincipledVolume")
        v.inputs["Density"].default_value = 0.035
        nt.links.new(v.outputs[0], nt.nodes["Material Output"].inputs["Volume"])
        fog.data.materials.append(m)

    # lights-on flicker at the open
    strip_node = led_mat.node_tree.nodes["Emission"].inputs["Strength"]
    pattern = [(0.0, 0), (0.5, 0), (0.55, 1), (0.62, 0.1), (0.7, 1), (0.74, 0), (0.9, 0), (0.95, 1), (1.4, 1)]
    for t, k in pattern:
        f = sec(t)
        strip_node.default_value = 12 * k
        strip_node.keyframe_insert("default_value", frame=f)
        led.data.energy = 60 * k
        led.data.keyframe_insert("energy", frame=f)
        so.data.energy = 150 * k
        so.data.keyframe_insert("energy", frame=f)
    for id_data in (led.data, so.data, led_mat.node_tree):
        ad = id_data.animation_data
        fcs = getattr(ad.action, "fcurves", [])
        for fc in fcs:
            for kp in fc.keyframe_points:
                kp.interpolation = "CONSTANT"

    return page


def desk_line(page):
    """Line A: born in the circled word, runs across the desk, over the edge, into the dark."""
    mw = page.matrix_world
    start = mw @ Vector((-0.28, -0.34, 0.0))  # circle position in page local space (UV 0.22, 0.16)
    z = DESK_Z + 0.006
    ctrl = [
        start + Vector((0, 0, 0.001)),
        (-0.36, -0.24, z),
        (-0.2, -0.29, z),
        (0.05, -0.27, z),
        (0.3, -0.23, z - 0.002),
        (0.45, -0.32, DESK_Z + 0.002),
        (0.5, -0.395, DESK_Z + 0.002),
        (0.52, -0.41, DESK_Z - 0.05),
        (0.55, -0.42, DESK_Z - 0.35),
        (0.58, -0.38, 0.06),
        (0.62, -0.15, 0.03),
    ]
    pts = catmull(ctrl, 24)
    line_mat = emission("Line", LINE_COLOR, 40)
    line = glow_curve("LineA", pts, 0.0018, line_mat)
    path = Path(pts)
    spark = sphere("SparkA", pts[0], 0.004, emission("Spark", (1, 1, 1), 80))
    ld = bpy.data.lights.new("SparkLightA", "POINT")
    ld.energy, ld.color, ld.shadow_soft_size = 1.5, LINE_COLOR, 0.005
    sl = bpy.data.objects.new("SparkLightA", ld)
    bpy.context.collection.objects.link(sl)
    t0, t1 = TIMING["line"]
    f0, f1 = sec(t0 + 0.3), sec(t1 - 0.2)
    grow(line, f0, f1, ease_in_out_cubic, path, (spark, sl))
    # sparks exist only while the line is drawing
    for o in (spark, sl):
        for f, vis in ((f0 - 2, True), (f0 - 3, False), (sec(t1) + 1, False), (sec(t1), True)):
            o.hide_render = not vis
            o.keyframe_insert("hide_render", frame=f)
    return path, f0, f1


def build_world():
    """World B: a dark void where the line becomes the first edge of a network."""
    # reflective floor with a faint emissive grid fading from the centre
    bpy.ops.mesh.primitive_plane_add(size=80, location=W2)
    fl = bpy.context.active_object
    m, n, l, b = node_mat("VoidFloor")
    b.inputs["Base Color"].default_value = (0.003, 0.003, 0.004, 1)
    b.inputs["Roughness"].default_value = 0.12
    tc = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(tc.outputs["Object"], sep.inputs[0])
    lines = []
    for comp in ("X", "Y"):
        fr = n.new("ShaderNodeMath"); fr.operation = "FRACT"
        sub = n.new("ShaderNodeMath"); sub.operation = "SUBTRACT"; sub.inputs[1].default_value = 0.5
        ab = n.new("ShaderNodeMath"); ab.operation = "ABSOLUTE"
        gt = n.new("ShaderNodeMath"); gt.operation = "GREATER_THAN"; gt.inputs[1].default_value = 0.488
        l.new(sep.outputs[comp], fr.inputs[0]); l.new(fr.outputs[0], sub.inputs[0])
        l.new(sub.outputs[0], ab.inputs[0]); l.new(ab.outputs[0], gt.inputs[0])
        lines.append(gt)
    mx = n.new("ShaderNodeMath"); mx.operation = "MAXIMUM"
    l.new(lines[0].outputs[0], mx.inputs[0]); l.new(lines[1].outputs[0], mx.inputs[1])
    grad = n.new("ShaderNodeTexGradient"); grad.gradient_type = "SPHERICAL"
    mp = n.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (0.06, 0.06, 0.06)
    l.new(tc.outputs["Object"], mp.inputs[0]); l.new(mp.outputs[0], grad.inputs[0])
    mul = n.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
    l.new(mx.outputs[0], mul.inputs[0]); l.new(grad.outputs["Fac"], mul.inputs[1])
    b.inputs["Emission Color"].default_value = (*LINE_COLOR, 1)
    l.new(mul.outputs[0], b.inputs["Emission Strength"])
    fl.data.materials.append(m)

    t0, t1 = TIMING["world"]
    root = W2 + Vector((0, 0, 1.2))
    line_mat = bpy.data.materials["Line"]
    node_mat_ = emission("Node", (1, 1, 1), 30)

    # line B drops in from above (match cut with line A going down)
    ctrl = [W2 + Vector((-0.6, -1.5, 9)), W2 + Vector((-0.4, -0.8, 5)), W2 + Vector((-0.15, -0.2, 2.4)), root]
    pts = catmull(ctrl, 30)
    lb = glow_curve("LineB", pts, 0.012, line_mat)
    path_b = Path(pts)
    fb0, fb1 = sec(t0), sec(t0 + 1.0)
    grow(lb, fb0, fb1, lambda x: 1 - (1 - x) ** 2)

    # network
    rnd = random.Random(11)
    nodes = [(root, fb1, None)]
    rings = [(6, 1.6, 0.4), (14, 3.4, 0.9), (26, 6.0, 1.6)]
    speed = 4.5  # m/s along edges
    prev = [0]
    for count, radius, zvar in rings:
        cur = []
        for i in range(count):
            a = i * 2 * math.pi / count + rnd.uniform(-0.15, 0.15)
            p = W2 + Vector((math.cos(a) * radius, math.sin(a) * radius, 1.2 + rnd.uniform(-zvar, zvar) * 0.6 + radius * 0.12))
            parent = min(prev, key=lambda j: (nodes[j][0] - p).length)
            pp, pf, _ = nodes[parent]
            d = (p - pp).length
            f_arrive = pf + sec(d / speed) + rnd.randint(0, 6)
            nodes.append((p, f_arrive, parent))
            cur.append(len(nodes) - 1)
            mid = (pp + p) / 2 + Vector((0, 0, 0.25 * d))
            e = glow_curve("Edge", catmull([pp, mid, p], 12), 0.006, line_mat)
            grow(e, pf, f_arrive, smooth)
        prev = cur
    for idx, (p, f, _) in enumerate(nodes):
        s = sphere("Node", p, 0.05 if idx else 0.07, node_mat_)
        for ff, k in ((f - 1, 0.0), (f, 0.0), (f + 3, 1.6), (f + 8, 1.0)):
            s.scale = (k, k, k)
            s.keyframe_insert("scale", frame=ff)

    # title
    tm = emission("Title", (1, 1, 1), 0.0)
    text_obj("Title", WORLD_TITLE, W2 + Vector((0, 6.5, 5.2)), 2.6, tm, extrude=0.06)
    s = tm.node_tree.nodes["Emission"].inputs["Strength"]
    for t, v in ((t0 + 3.2, 0.0), (t0 + 4.4, 6.0)):
        s.default_value = v
        s.keyframe_insert("default_value", frame=sec(t))
    pl = bpy.data.lights.new("RootGlow", "POINT")
    pl.energy, pl.color = 60, LINE_COLOR
    po = bpy.data.objects.new("RootGlow", pl)
    bpy.context.collection.objects.link(po)
    po.location = root + Vector((0, 0, 0.3))
    return path_b, root


# -------------------------------------------------------------- camera ---
def build_camera(path_a, fa0, fa1, root):
    cam_d = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_d)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    target = bpy.data.objects.new("CamTarget", None)
    focus = bpy.data.objects.new("Focus", None)
    for o in (target, focus):
        bpy.context.collection.objects.link(o)
    tc = cam.constraints.new("TRACK_TO")
    tc.target, tc.track_axis, tc.up_axis = target, "TRACK_NEGATIVE_Z", "UP_Y"
    cam_d.dof.use_dof = True
    cam_d.dof.focus_object = focus
    cam_d.sensor_width = 36
    cam_d.clip_start = 0.005

    V = Vector
    notebook = V((-0.42, -0.14, DESK_Z + 0.01))
    keyboard = V((0.08, -0.08, DESK_Z + 0.02))

    def lerp(a, b, t):
        return a.lerp(b, t) if isinstance(a, Vector) else a + (b - a) * t

    def seg(t, key, a, b, ease=smooth):
        t0, t1 = TIMING[key]
        u = ease((t - t0) / (t1 - t0))
        return tuple(lerp(x, y, u) for x, y in zip(a, b))

    # (cam, target, focus, lens, fstop)
    P_open_a = (V((-0.25, -3.4, 0.9)), V((0.0, 0.2, 1.05)), V((0.0, 0.2, 1.05)), 26, 2.8)
    P_open_b = (V((-0.1, -2.5, 1.12)), V((-0.1, 0.15, 1.0)), V((-0.1, 0.15, 1.0)), 28, 2.8)
    P_arc_b = (V((-0.95, -0.8, 1.02)), notebook, notebook, 50, 1.8)
    P_note_a = (V((-0.45, -0.3, 1.2)), notebook, notebook, 50, 2.8)
    P_note_b = (V((-0.43, -0.24, 1.0)), notebook, notebook, 50, 2.8)

    def pose(f):
        t = f / FPS
        if t < TIMING["open"][1]:
            return seg(t, "open", P_open_a, P_open_b, lambda x: 1 - (1 - x) ** 3)
        if t < TIMING["arc"][1]:
            a0, a1 = TIMING["arc"]
            u = smooth((t - a0) / (a1 - a0))
            mid = V((-1.3, -1.6, 1.3))
            cpos = catmull([P_open_b[0], mid, P_arc_b[0]], 64)
            c = cpos[int(u * (len(cpos) - 1))]
            tgt = P_open_b[1].lerp(notebook, u)
            # rack focus: hold on keyboard, then snap to notebook
            r = smooth((t - (a0 + 2.0)) / 1.2)
            fo = keyboard.lerp(notebook, r) if u > 0.3 else P_open_b[2].lerp(keyboard, u / 0.3)
            return c, tgt, fo, lerp(28, 50, u), lerp(2.8, 1.8, u)
        if t < TIMING["note"][1]:
            # blend from end of arc into the top-down
            n0, _ = TIMING["note"]
            b = smooth((t - n0) / 1.0)
            c, tg, fo, ln, fs = seg(t, "note", P_note_a, P_note_b, lambda x: x)
            c = P_arc_b[0].lerp(c, b)
            return c, tg, fo, ln, lerp(1.8, fs, b)
        if t < TIMING["line"][1]:
            u_lin = max(0.0, min(1.0, (f - fa0) / (fa1 - fa0)))
            u = ease_in_out_cubic(u_lin)
            tip = path_a.at(u)
            ahead = path_a.at(min(1, u + 0.02))
            behind = path_a.at(max(0, u - 0.08))
            d = (ahead - behind).normalized() if (ahead - behind).length > 1e-6 else V((1, 0, 0))
            side = d.cross(V((0, 0, 1))).normalized()
            follow = behind - d * 0.12 + V((0, 0, 0.07)) - side * 0.06
            b = smooth((t - TIMING["line"][0]) / 0.9)
            c = P_note_b[0].lerp(follow, b)
            tg = notebook.lerp(tip, b)
            # final push into the darkness under the desk
            e = smooth((t - (TIMING["line"][1] - 0.6)) / 0.6)
            c = c.lerp(V((0.62, -0.3, 0.05)), e * 0.7)
            return c, tg, tip, lerp(50, 35, b), lerp(2.8, 2.0, b)
        # world B: start looking up the falling line, then crane back and orbit
        w0, w1 = TIMING["world"]
        u = (t - w0) / (w1 - w0)
        tip = path_b_ref[0].at(min(1, (t - w0) / 1.0))
        ang = math.radians(-100 + 55 * smooth(u))
        dist = lerp(1.2, 13.0, smooth(min(1, u * 1.3)))
        height = lerp(0.5, 5.5, smooth(u))
        c = root + V((math.cos(ang) * dist, math.sin(ang) * dist, height))
        tg = tip.lerp(root + V((0, 2.5, 2.2)), smooth(u * 1.5))
        return c, tg, tg, lerp(32, 28, u), lerp(2.0, 4.0, u)

    end = sec(TIMING["world"][1])
    for f in range(0, end + 1):
        c, tg, fo, ln, fs = pose(f)
        t = f / FPS
        hand = 0.003 if t < TIMING["line"][0] else 0.0015
        tg = tg + Vector((math.sin(t * 2.1) + 0.5 * math.sin(t * 5.3),
                          0.0, math.sin(t * 1.7 + 1) + 0.4 * math.sin(t * 4.1))) * hand
        cam.location, target.location, focus.location = c, tg, fo
        cam_d.lens, cam_d.dof.aperture_fstop = ln, fs
        cam.keyframe_insert("location", frame=f)
        target.keyframe_insert("location", frame=f)
        focus.keyframe_insert("location", frame=f)
        cam_d.keyframe_insert("lens", frame=f)
        cam_d.dof.keyframe_insert("aperture_fstop", frame=f)
    for idb in (cam, target, focus, cam_d):
        set_linear(idb)
    return end


path_b_ref = [None]


# ----------------------------------------------------- render + grade ---
def setup_render(end):
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.frame_start, sc.frame_end = 0, end
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    preview = QUALITY == "preview"
    sc.cycles.samples = 16 if preview else 256
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = "OPENIMAGEDENOISE"
    sc.cycles.max_bounces = 4 if preview else 8
    sc.render.resolution_x, sc.render.resolution_y = (1920, 1080)
    sc.render.resolution_percentage = 33 if preview else 100
    sc.render.use_motion_blur = True
    sc.render.motion_blur_shutter = 0.5  # 180-degree shutter
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = "PNG"
    sc.render.filepath = os.path.join(HERE, "render", "frame_")

    w = bpy.data.worlds.new("World")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.0015, 0.0017, 0.002, 1)
    sc.world = w

    # fade in / out
    for f, ev in ((0, -8), (sec(0.5), 0), (end - sec(0.6), 0), (end, -8)):
        sc.view_settings.exposure = ev
        sc.view_settings.keyframe_insert("exposure", frame=f)
    # a black dip on the match cut, hidden in the darkness under the desk
    cut = sec(TIMING["line"][1])
    for f, ev in ((cut - 5, 0), (cut - 1, -6), (cut, -6), (cut + 4, 0)):
        sc.view_settings.exposure = ev
        sc.view_settings.keyframe_insert("exposure", frame=f)

    # compositor: bloom, subtle lens dispersion, vignette
    sc.use_nodes = True
    nt = sc.node_tree
    nt.nodes.clear()
    rl = nt.nodes.new("CompositorNodeRLayers")
    gl = nt.nodes.new("CompositorNodeGlare")
    gl.glare_type = "FOG_GLOW"
    gl.quality = "HIGH"
    for k, v in (("threshold", 0.9), ("size", 8)):  # props became sockets in newer Blender
        if k.capitalize() in gl.inputs:
            gl.inputs[k.capitalize()].default_value = v if k == "threshold" else 0.6
        elif hasattr(gl, k):
            setattr(gl, k, v)
    ld = nt.nodes.new("CompositorNodeLensdist")
    ld.inputs["Distortion"].default_value = -0.008
    ld.inputs["Dispersion"].default_value = 0.012
    em = nt.nodes.new("CompositorNodeEllipseMask")
    bl = nt.nodes.new("CompositorNodeBlur")
    bl.filter_type = "GAUSS"
    blur_px = sc.render.resolution_x * sc.render.resolution_percentage / 100 * 0.15
    if "Size" in em.inputs:  # Blender 4.5+: options are sockets
        em.inputs["Size"].default_value = (0.95, 0.8)
        bl.inputs["Size"].default_value = (blur_px, blur_px)
    else:
        em.width, em.height = 0.95, 0.8
        bl.size_x = bl.size_y = int(blur_px)
    vg = nt.nodes.new("CompositorNodeMixRGB")
    vg.blend_type = "MULTIPLY"
    vg.inputs[0].default_value = 0.55
    inv = nt.nodes.new("CompositorNodeMixRGB")  # mask -> (mask*1 + (1-mask)*0.25)
    inv.inputs[1].default_value = (0.25, 0.25, 0.25, 1)
    inv.inputs[2].default_value = (1, 1, 1, 1)
    out = nt.nodes.new("CompositorNodeComposite")
    L = nt.links.new
    L(rl.outputs["Image"], gl.inputs["Image"])
    L(gl.outputs["Image"], ld.inputs["Image"])
    L(em.outputs["Mask"], bl.inputs["Image"])
    L(bl.outputs["Image"], inv.inputs[0])
    L(ld.outputs["Image"], vg.inputs[1])
    L(inv.outputs["Image"], vg.inputs[2])
    L(vg.outputs["Image"], out.inputs["Image"])


def main():
    clean()
    page = build_room()
    path_a, fa0, fa1 = desk_line(page)
    path_b, root = build_world()
    path_b_ref[0] = path_b
    end = build_camera(path_a, fa0, fa1, root)
    setup_render(end)
    out = os.path.join(HERE, "cinematic_desk.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out)
    print("saved", out, "frames 0 ..", end)


main()
