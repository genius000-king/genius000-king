"""Cel preview: approximates the game look. 2-tone matcap (hard terminator, violet shadow) + inverted-hull ink outline
+ screen-space ink from a view-normal pass (composited by compose_cel.py with numpy/PIL; no GPU needed)."""
import os, math
import bpy, bmesh
from mathutils import Vector
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.environ.get("CEL_RAW", os.path.join(HERE, "_raw"))
_loaded = {}


def _matcap(name):
    if name not in _loaded:
        sls = bpy.context.preferences.studio_lights
        sl = sls.load(os.path.join(HERE, "_matcaps", name + ".png"), 'MATCAP')
        _loaded[name] = sl.name if sl else None
    return _loaded[name]


def render(obj, name, size=512):
    scn = bpy.context.scene
    cam = scn.camera
    sh = scn.display.shading
    old = (sh.light, sh.color_type, sh.show_cavity, sh.show_shadows, sh.studio_light, scn.render.film_transparent)
    os.makedirs(RAW, exist_ok=True)
    scn.view_settings.exposure = 0.0
    sh.show_cavity = False; sh.show_shadows = False
    sh.color_type = "VERTEX"
    scn.render.film_transparent = True
    sh.light = "MATCAP"; sh.studio_light = _matcap("cel2")
    scn.render.filepath = os.path.join(RAW, name + "_cel.png")
    bpy.ops.render.render(write_still=True)
    sh.studio_light = _matcap("nrm")
    scn.render.filepath = os.path.join(RAW, name + "_nrm.png")
    bpy.ops.render.render(write_still=True)
    # depth pass: temporary copy of the object with view-depth painted into vertex colour, FLAT light
    me = obj.data.copy()
    o2 = bpy.data.objects.new("_depth", me)
    o2.matrix_world = obj.matrix_world
    scn.collection.objects.link(o2)
    obj.hide_render = True
    cp = cam.matrix_world.translation
    fw = (cam.matrix_world.to_3x3() @ Vector((0, 0, -1))).normalized()
    ds = [((o2.matrix_world @ v.co) - cp).dot(fw) for v in me.vertices]
    lo, hi = min(ds), max(ds)
    col = me.color_attributes["Col"]
    for p in me.polygons:
        for li in p.loop_indices:
            d = (ds[me.loops[li].vertex_index] - lo) / max(hi - lo, 1e-6)
            g = d * 0.9 + 0.05
            col.data[li].color = (g / 12.92 if g <= 0.04045 else ((g + 0.055) / 1.055) ** 2.4,) * 3 + (1,)
    sh.light = "FLAT"
    scn.render.filepath = os.path.join(RAW, name + "_dep.png")
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(o2, do_unlink=True)
    obj.hide_render = False
    sh.light, sh.color_type, sh.show_cavity, sh.show_shadows, sh.studio_light, scn.render.film_transparent = old
