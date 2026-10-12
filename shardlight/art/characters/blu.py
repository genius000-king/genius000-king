"""Blu — the slime protagonist (coordinator-built). Blender 4.5:
    blender -b --factory-startup --python art/characters/blu.py

Exports game/assets/models/characters_main/blu.glb with separately named parts the game animates:
  body, core, tag, bubble_0..4, cap, eye_L/eye_R (sclera) + pupil_L/pupil_R + glint_L/glint_R,
  brow_L/brow_R, mouth_smile, mouth_open, mouth_o, mouth_grin, mouth_frown, cheek_L/cheek_R.
Origin = ground contact. Faces Blender -Y (Godot +Z). Height ~0.74 m.
Materials (Godot swaps by name): SLIME (body), EMIT (core, glints), VC (everything else), GLASS (bubbles).
"""
import os
import sys
import math

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import bpy
import bmesh
from mathutils import Vector, noise
import sl_common as sl

PACK = "characters_main"
H = 0.66          # body height
R = 0.44          # body radius at the widest

BLUE = "#3FA2FF"
BLUE_DEEP = "#2450D8"
BLUE_LIGHT = "#8FE0FF"
INK = "#160C26"
WHITE = "#FFFFFF"
CAP = "#6F79F0"
CAP_DARK = "#4A47B8"
CORE = "#B98CFF"
CORE_HOT = "#7AF4FF"
TAG = "#E9E4D8"
TAG_RED = "#E5484D"
BLUSH = "#FF7FB0"


def body_profile_radius(z):
    """Mochi/gumdrop silhouette: base spreads onto the floor, soft belly bulge, round dome."""
    t = max(0.0, min(1.0, z / H))
    if t < 0.05:
        return R * (1.06 + 0.05 * (1 - t / 0.05))
    # smooth belly → dome (C1 continuous): ellipse centered at t=0.22
    u = max(0.0, (t - 0.22) / 0.78)
    belly = 1.0 + 0.03 * math.sin(math.pi * min(1.0, (t - 0.05) / 0.4))
    return R * belly * max(0.0, 1.0 - u * u) ** 0.5


def surface_y(x, z, front=True):
    r = body_profile_radius(z) * 0.985
    y = math.sqrt(max(r * r - x * x, 0.0))
    return -y if front else y


def build_body():
    rings, segs = 26, 48
    bm = bmesh.new()
    verts = []
    zs = []
    for i in range(rings + 1):
        z = H * (i / rings) ** 1.0
        zs.append(z)
    for i, z in enumerate(zs):
        r = body_profile_radius(z)
        ring = []
        for k in range(segs):
            a = 2 * math.pi * k / segs
            # gentle organic asymmetry
            rr = r * (1.0 + 0.018 * math.sin(a * 3 + 0.7) + 0.012 * math.sin(a * 5 + 2.0))
            # front slightly flatter (face area) so eyes sit nicely
            if math.sin(a) < 0:
                rr *= 1.0 - 0.04 * (-math.sin(a)) ** 2 * (1 if 0.25 < z / H < 0.75 else 0.3)
            ring.append(bm.verts.new((math.cos(a) * rr, math.sin(a) * rr, z)))
        verts.append(ring)
    for i in range(rings):
        for k in range(segs):
            a, b = verts[i][k], verts[i][(k + 1) % segs]
            c, d = verts[i + 1][(k + 1) % segs], verts[i + 1][k]
            bm.faces.new((a, b, c, d))
    bottom = bm.faces.new(list(reversed(verts[0])))
    top = bm.verts.new((0, 0.0, H + 0.02))
    for k in range(segs):
        bm.faces.new((verts[-1][k], verts[-1][(k + 1) % segs], top))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    body = sl.bm_to_object(bm, "body", "SLIME")
    sl.subdivide(body, 1)
    # drip tip on top: pull a curled tuft upward/backward
    for v in body.data.vertices:
        d = Vector((v.co.x, v.co.y, 0)).length
        if v.co.z > H * 0.82 and d < 0.13:
            w = (1 - d / 0.13) ** 2
            v.co.z += 0.07 * w
            v.co.y += 0.06 * w * w
    # flat-ish underside
    for v in body.data.vertices:
        if v.co.z < 0.004:
            v.co.z = 0.0
    sl.shade_smooth(body)

    def col(p, n):
        # comic color blocking: light cap of the dome, mid body, deeper base band
        if p.z < H * 0.07:
            return BLUE_DEEP
        return BLUE
    sl.paint_faces(body, lambda poly, c, n: col(c, n))
    return body


def build_core():
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.085)
    for v in bm.verts:
        v.co.z *= 1.45
    core = sl.bm_to_object(bm, "core", "EMIT", smooth=False)
    core.location = (0.0, 0.05, H * 0.4)
    core.rotation_euler = (0.3, 0.2, 0.5)
    sl.apply_transforms_and_location(core)
    sl.paint_faces(core, lambda p, c, n: CORE_HOT if n.z > 0.2 else CORE)
    return core


def build_bubbles():
    out = []
    spots = [(0.16, 0.08, 0.18, 0.035), (-0.18, 0.04, 0.28, 0.025), (0.1, -0.06, 0.48, 0.02), (-0.08, 0.15, 0.12, 0.03),
             (0.2, 0.1, 0.36, 0.018)]
    for i, (x, y, z, r) in enumerate(spots):
        b = sl.blob(f"bubble_{i}", r, seed=i, noise_amt=0.02, subdiv=2, material="GLASS")
        b.location = (x, y, z)
        sl.apply_transforms_and_location(b)
        sl.paint_solid(b, "#DFF8FF")
        out.append(b)
    return out


def build_tag():
    # specimen tag suspended inside the gel: rounded plate with a red stripe and a hole
    plate = sl.rounded_box("tag", (0.07, 0.006, 0.04), 0.006, 2)
    plate.location = (-0.12, 0.12, H * 0.22)
    plate.rotation_euler = (0.2, 0.0, 0.6)
    sl.apply_transforms_and_location(plate)
    sl.paint_faces(plate, lambda p, c, n: TAG_RED if c.z > H * 0.22 + 0.008 else TAG)
    return plate


def build_cap():
    # Rae's cap, small, tilted back and to one side on the dome
    dome = sl.blob("cap_dome", 0.17, seed=3, squash=(1.0, 1.05, 0.72), noise_amt=0.0, subdiv=3)
    for v in dome.data.vertices:
        if v.co.z < 0:
            v.co.z *= 0.05
    bm = bmesh.new()
    rows, cols = 5, 12
    grid = []
    for i in range(rows + 1):
        t = i / rows
        row = []
        for j in range(cols + 1):
            u = j / cols * 2 - 1
            w = 0.15 * (1 - 0.45 * t * t) * math.cos(u * math.pi / 2) ** 0.35
            row.append(bm.verts.new((u * w, -0.13 - t * 0.12, -0.005 - t * 0.02 - u * u * 0.02)))
        grid.append(row)
    for i in range(rows):
        for j in range(cols):
            bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
    brim = sl.bm_to_object(bm, "cap_brim")
    m = brim.modifiers.new("s", "SOLIDIFY")
    m.thickness = 0.014
    sl.apply_modifiers(brim)
    button = sl.blob("cap_button", 0.018, subdiv=2, squash=(1, 1, 0.5), noise_amt=0.0)
    button.location = (0, 0, 0.09)
    sl.apply_transforms_and_location(button)
    cap = sl.join([dome, brim, button], "cap")
    sl.shade_smooth(cap)
    sl.paint_faces(cap, lambda p, c, n: CAP_DARK if (c.y < -0.13 and n.z < 0) else (CAP_DARK if abs(math.sin(math.atan2(c.y, c.x) * 3)) < 0.07 and c.z > 0.02 else CAP))
    cap.scale = (1.22, 1.22, 1.22)
    cap.rotation_euler = (math.radians(-16), math.radians(10), math.radians(-14))
    cap.location = (0.015, 0.04, H * 0.9)
    sl.apply_transforms_and_location(cap)
    return cap


def build_face():
    parts = []
    for side, sx in (("L", 1), ("R", -1)):
        cx, cz = 0.108 * sx, H * 0.52
        eye_y = surface_y(cx, cz)
        sclera = sl.blob(f"eye_{side}", 0.095, subdiv=3, squash=(0.78, 0.3, 1.18), noise_amt=0.0)
        sclera.location = (cx, eye_y + 0.02, cz)
        sl.apply_transforms_and_location(sclera)
        sl.paint_solid(sclera, WHITE)
        pupil = sl.blob(f"pupil_{side}", 0.058, subdiv=3, squash=(0.78, 0.3, 1.12), noise_amt=0.0)
        pupil.location = (cx - 0.006 * sx, eye_y, cz - 0.01)
        sl.apply_transforms_and_location(pupil)
        sl.paint_solid(pupil, INK)
        glint = sl.blob(f"glint_{side}", 0.013, subdiv=2, squash=(1, 0.4, 1), noise_amt=0.0, material="EMIT")
        glint.location = (cx - 0.006 * sx + 0.018, eye_y - 0.018, cz + 0.026)
        sl.apply_transforms_and_location(glint)
        sl.paint_solid(glint, WHITE)
        bz = cz + 0.135
        brow = sl.tapered_tube(f"brow_{side}", [(cx - 0.04 * sx, surface_y(cx - 0.04 * sx, bz) - 0.006, bz - 0.004),
                                                 (cx, surface_y(cx, bz) - 0.01, bz + 0.01),
                                                 (cx + 0.045 * sx, surface_y(cx + 0.045 * sx, bz) - 0.004, bz)], [0.009, 0.013, 0.006], sides=8)
        sl.paint_solid(brow, INK)
        cheek = sl.blob(f"cheek_{side}", 0.035, subdiv=2, squash=(1.3, 0.25, 0.7), noise_amt=0.0)
        cheek.location = (0.19 * sx, surface_y(0.19 * sx, H * 0.4) + 0.012, H * 0.4)
        sl.apply_transforms_and_location(cheek)
        sl.paint_solid(cheek, BLUSH)
        parts += [sclera, pupil, glint, brow, cheek]
    mz = H * 0.37
    my = surface_y(0.0, mz) + 0.004

    def mouth_curve(name, pts, rad):
        m = sl.tapered_tube(name, [(x, my + y, mz + z) for x, y, z in pts], rad, sides=8)
        sl.paint_solid(m, INK)
        return m
    parts.append(mouth_curve("mouth_smile", [(-0.06, 0.004, 0.012), (-0.03, -0.002, -0.008), (0, -0.004, -0.014),
                                             (0.03, -0.002, -0.008), (0.06, 0.004, 0.012)], [0.006, 0.009, 0.01, 0.009, 0.006]))
    parts.append(mouth_curve("mouth_frown", [(-0.05, 0.004, -0.012), (-0.025, -0.002, 0.004), (0, -0.004, 0.008),
                                             (0.025, -0.002, 0.004), (0.05, 0.004, -0.012)], [0.006, 0.009, 0.01, 0.009, 0.006]))
    # open mouth: dark oval with a pink tongue
    om = sl.blob("mouth_open", 0.05, subdiv=3, squash=(1.2, 0.35, 0.8), noise_amt=0.0)
    om.location = (0, my + 0.004, mz - 0.006)
    sl.apply_transforms_and_location(om)
    sl.paint_faces(om, lambda p, c, n: "#FF6F91" if c.z < mz - 0.026 else "#2A0F2E")
    parts.append(om)
    oo = sl.blob("mouth_o", 0.03, subdiv=3, squash=(0.9, 0.35, 1.1), noise_amt=0.0)
    oo.location = (0, my + 0.004, mz)
    sl.apply_transforms_and_location(oo)
    sl.paint_solid(oo, "#2A0F2E")
    parts.append(oo)
    grin = sl.blob("mouth_grin", 0.06, subdiv=3, squash=(1.25, 0.3, 0.5), noise_amt=0.0)
    for v in grin.data.vertices:
        if v.co.z > 0:
            v.co.z *= 0.2       # flat top: D-shaped grin
    grin.location = (0, my + 0.004, mz + 0.01)
    sl.apply_transforms_and_location(grin)
    sl.paint_faces(grin, lambda p, c, n: WHITE if c.z > mz + 0.004 else "#2A0F2E")
    parts.append(grin)
    return parts


def main():
    sl.reset()
    objs = [build_body(), build_core(), build_tag(), build_cap()] + build_bubbles() + build_face()
    for o in objs:
        sl.apply_transforms(o)
    # previews: neutral (hide alt mouths)
    show = [o for o in objs if o.name not in ("mouth_open", "mouth_o", "mouth_grin", "mouth_frown")]
    for tag, az, el in (("front", 0, 8), ("three_q", -35, 14), ("side", 90, 8), ("back", 180, 14)):
        sl.preview(show, f"blu_{tag}", PACK, size=640, bg="#F1EAD8", elev=el, azim=az, frame=1.1)
    sl.export_glb(objs, "blu", PACK)
    man = sl.Manifest(PACK)
    # keep the existing 'rae' entry if present (retired as protagonist; used in memory echoes)
    import json
    mpath = os.path.join(sl.GAME_MODELS, PACK, "manifest.json")
    if os.path.exists(mpath):
        man.assets = [a for a in json.load(open(mpath))["assets"] if a["id"] != "blu"]
    man.add("blu", objs[0], "character", ["all"], {"type": "none"}, None,
            {"parts": [o.name for o in objs], "note": "procedurally animated by scripts/player/slime_body.gd"})
    man.write()
    blend_dir = os.path.join(sl.ROOT, "art", "characters", "blend")
    os.makedirs(blend_dir, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(blend_dir, "blu.blend"))
    print("BLU parts:", len(objs), "body tris:", sl.tri_count(objs[0]))


main()
