"""Helpers for the `characters` pack: meshes, face decals, rig, semantic posing, finishing."""
import sys, os, math, random, json
import bpy, bmesh
from mathutils import Vector, Matrix, Euler, Quaternion

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "lib"))
import sl_common as sl

PACK = "characters"
V = Vector
rad = math.radians


# ------------------------------------------------------------------ mesh primitives
def mk(bm, name, mat="VC", smooth=True, color=None):
    obj = sl.bm_to_object(bm, name, mat, smooth)
    if color:
        sl.paint_solid(obj, color)
    return obj


def xform(obj, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    m = Matrix.Translation(loc) @ Euler(tuple(rad(a) for a in rot), "XYZ").to_matrix().to_4x4() \
        @ Matrix.Diagonal((scale[0], scale[1], scale[2], 1))
    obj.data.transform(m)
    obj.data.update()
    return obj


def rotate_about(obj, pivot, rot):
    p = Vector(pivot)
    m = Matrix.Translation(p) @ Euler(tuple(rad(a) for a in rot), "XYZ").to_matrix().to_4x4() @ Matrix.Translation(-p)
    obj.data.transform(m)
    obj.data.update()
    return obj


def align_to(obj, frm, to, pivot=(0, 0, 0)):
    q = Vector(frm).normalized().rotation_difference(Vector(to).normalized())
    m = Matrix.Translation(pivot) @ q.to_matrix().to_4x4()
    obj.data.transform(m)
    obj.data.update()
    return obj


def ell(name, c, r, segs=16, rings=10, rot=(0, 0, 0), color=None, mat="VC", deform=None, smooth=True):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    for v in bm.verts:
        p = v.co.copy()
        if deform:
            p = deform(p)
        v.co = V((p.x * r[0], p.y * r[1], p.z * r[2]))
    o = mk(bm, name, mat, smooth, color)
    return xform(o, c, rot)


def loft(name, secs, sides=16, color=None, mat="VC", n=2.0, smooth=True, cap0=True, cap1=True):
    """secs: [(z, rx, ry, cx, cy)] along +Z; rx/ry ~0 -> a pole vertex."""
    bm = bmesh.new()
    rings = []
    for (z, rx, ry, cx, cy) in secs:
        if rx < 1e-4 and ry < 1e-4:
            rings.append([bm.verts.new((cx, cy, z))])
            continue
        ring = []
        for k in range(sides):
            a = 2 * math.pi * k / sides
            c, s = math.cos(a), math.sin(a)
            if n != 2.0:
                c = math.copysign(abs(c) ** (2.0 / n), c)
                s = math.copysign(abs(s) ** (2.0 / n), s)
            ring.append(bm.verts.new((cx + rx * c, cy + ry * s, z)))
        rings.append(ring)
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        if len(a) == 1 and len(b) == 1:
            continue
        if len(a) == 1:
            for k in range(sides):
                bm.faces.new((a[0], b[(k + 1) % sides], b[k]))
        elif len(b) == 1:
            for k in range(sides):
                bm.faces.new((a[k], a[(k + 1) % sides], b[0]))
        else:
            for k in range(sides):
                bm.faces.new((a[k], a[(k + 1) % sides], b[(k + 1) % sides], b[k]))
    if cap0 and len(rings[0]) > 1:
        bm.faces.new(list(reversed(rings[0])))
    if cap1 and len(rings[-1]) > 1:
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mk(bm, name, mat, smooth, color)


def lathe(name, prof, sides=20, color=None, mat="VC", smooth=True, sxy=(1, 1), **kw):
    """prof: [(r, z)] revolve about Z."""
    return loft(name, [(z, r * sxy[0], r * sxy[1], 0, 0) for r, z in prof], sides, color, mat, smooth=smooth, **kw)


def tube(name, pts, radii, sides=8, color=None, mat="VC", smooth=True, cap=True):
    o = sl.tapered_tube(name, pts, radii, sides=sides, material=mat, cap=cap)
    if not smooth:
        sl.shade_flat(o)
    if color:
        sl.paint_solid(o, color)
    return o


def box(name, c, size, rot=(0, 0, 0), color=None, radius=0.01, mat="VC", seg=2):
    o = sl.rounded_box(name, size, radius, seg, mat)
    xform(o, c, rot)
    if color:
        sl.paint_solid(o, color)
    return o


def bm_poly(name, verts, faces, color=None, mat="VC", smooth=False):
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in verts]
    for f in faces:
        bm.faces.new([vs[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mk(bm, name, mat, smooth, color)


def col(o, c):
    sl.paint_solid(o, c)
    return o


def paint_fn(obj, fn):
    """fn(co: Vector, normal: Vector) -> color."""
    me = obj.data
    attr = sl.ensure_colors(obj)
    for poly in me.polygons:
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index]
            sl._write_corner(attr, li, sl.hex_rgb(fn(v.co.copy(), v.normal.copy())))
    return obj


def paint_bands(obj, bands, axis=2):
    """bands: [(upper_bound, color)...] ascending on `axis`; last color is for the rest."""
    def f(co, n):
        for ub, c in bands:
            if co[axis] < ub:
                return c
        return bands[-1][1]
    return paint_fn(obj, f)


def paint_faces_fn(obj, fn):
    sl.paint_faces(obj, lambda p, c, n: fn(c, n))
    return obj


# ------------------------------------------------------------------ paths
class Path:
    def __init__(self, pts):
        self.pts = [V(p) for p in pts]
        self.cum = [0.0]
        for i in range(1, len(self.pts)):
            self.cum.append(self.cum[-1] + (self.pts[i] - self.pts[i - 1]).length)
        self.L = self.cum[-1]

    def at(self, t):
        d = max(0.0, min(1.0, t)) * self.L
        for i in range(1, len(self.pts)):
            if d <= self.cum[i] + 1e-9:
                seg = self.cum[i] - self.cum[i - 1]
                f = (d - self.cum[i - 1]) / seg if seg > 1e-9 else 0
                return self.pts[i - 1].lerp(self.pts[i], f)
        return self.pts[-1].copy()

    def sub(self, t0, t1, n):
        return [tuple(self.at(t0 + (t1 - t0) * i / n)) for i in range(n + 1)]


def limb(name, path, t0, t1, rfn, n=6, sides=10, color=None, mat="VC", cap=True):
    pts = path.sub(t0, t1, n)
    rs = [rfn(t0 + (t1 - t0) * i / n) for i in range(n + 1)]
    return tube(name, pts, rs, sides, color, mat, cap=cap)


def spline(pts, n=4):
    """Catmull-Rom through pts (list of vectors) with n subdivisions per span -> list of tuples."""
    P = [V(p) for p in pts]
    P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    out = []
    for i in range(1, len(P) - 2):
        for k in range(n):
            t = k / n
            a, b, c, d = P[i - 1], P[i], P[i + 1], P[i + 2]
            out.append(tuple(0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t ** 3)))
    out.append(tuple(P[-2]))
    return out


def ring_pts(c, rx, ry, n=16, z=0.0, a0=0.0, a1=360.0):
    return [(c[0] + rx * math.cos(rad(a0 + (a1 - a0) * i / n)), c[1] + ry * math.sin(rad(a0 + (a1 - a0) * i / n)), c[2] + z) for i in range(n + 1)]


def lerp(a, b, t):
    return a + (b - a) * t


def prof(keys, t):
    """piecewise-linear profile: keys [(t, v)] -> v at t (smoothstep between keys)."""
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t <= t1:
            f = (t - t0) / (t1 - t0)
            f = f * f * (3 - 2 * f)
            return v0 + (v1 - v0) * f
    return keys[-1][1]


# ------------------------------------------------------------------ face decals (conform to a deformed ellipsoid head)
class Head:
    def __init__(self, c, r, deform=None):
        self.c, self.r, self.deform = V(c), r, deform

    def pt(self, u, v, h=0.0):
        """u: -1..1 lateral (+x = character's left), v: -1..1 vertical on unit sphere, h relative offset."""
        d = max(0.0, 1.0 - u * u - v * v)
        q = V((u, -math.sqrt(d), v))
        if q.length < 1e-6:
            q = V((0, -1, 0))
        q = q.normalized() * (1.0 + h)
        if self.deform:
            q = self.deform(q)
        return self.c + V((q.x * self.r[0], q.y * self.r[1], q.z * self.r[2]))

    def patch(self, name, cu, cv, w, hgt, color, h0=0.004, hmax=0.03, rot=0.0, shape=None, n=20, mat="VC"):
        """Domed elliptical sticker. w/hgt are half extents in unit-sphere (u,v) space; rot in degrees."""
        bm = bmesh.new()
        K = [(1.0, 0.0), (0.8, 0.55), (0.45, 0.9)]
        ca, sa = math.cos(rad(rot)), math.sin(rad(rot))
        rings = []
        for (s, hk) in K:
            ring = []
            for i in range(n):
                a = 2 * math.pi * i / n
                x, y = math.cos(a) * w * s, math.sin(a) * hgt * s
                if shape:
                    x, y = shape(a, x, y)
                u = cu + x * ca - y * sa
                v = cv + x * sa + y * ca
                ring.append(bm.verts.new(self.pt(u, v, h0 + hmax * hk)))
            rings.append(ring)
        top = bm.verts.new(self.pt(cu, cv, h0 + hmax))
        for i in range(len(rings) - 1):
            for k in range(n):
                bm.faces.new((rings[i][k], rings[i][(k + 1) % n], rings[i + 1][(k + 1) % n], rings[i + 1][k]))
        for k in range(n):
            bm.faces.new((rings[-1][k], rings[-1][(k + 1) % n], top))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        return mk(bm, name, mat, True, color)

    def strip(self, name, path_uv, widths, color, h0=0.004, hmax=0.02, mat="VC"):
        """Brow / mouth / scar: ridge strip along (u,v) points with half-widths (unit-sphere space)."""
        bm = bmesh.new()
        m = len(path_uv)
        rows = []
        for i, (u, v) in enumerate(path_uv):
            if i == 0:
                du, dv = path_uv[1][0] - u, path_uv[1][1] - v
            elif i == m - 1:
                du, dv = u - path_uv[i - 1][0], v - path_uv[i - 1][1]
            else:
                du, dv = path_uv[i + 1][0] - path_uv[i - 1][0], path_uv[i + 1][1] - path_uv[i - 1][1]
            L = math.hypot(du, dv) or 1.0
            nu, nv = -dv / L, du / L
            w = widths[i] if isinstance(widths, (list, tuple)) else widths
            taper = 1.0 if 0 < i < m - 1 else 0.55
            rows.append((bm.verts.new(self.pt(u + nu * w, v + nv * w, h0)),
                         bm.verts.new(self.pt(u, v, h0 + hmax * taper)),
                         bm.verts.new(self.pt(u - nu * w, v - nv * w, h0))))
        for i in range(m - 1):
            a, b = rows[i], rows[i + 1]
            bm.faces.new((a[0], b[0], b[1], a[1]))
            bm.faces.new((a[1], b[1], b[2], a[2]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        o = mk(bm, name, mat, True, color)
        return o


def arc(u0, v0, u1, v1, bulge, n=7):
    """points from (u0,v0) to (u1,v1) bowed by `bulge` (+ = upward)."""
    out = []
    for i in range(n):
        t = i / (n - 1)
        out.append((lerp(u0, u1, t), lerp(v0, v1, t) + bulge * math.sin(math.pi * t)))
    return out


# ------------------------------------------------------------------ rig
def seg_dist(p, a, b):
    a, b = V(a), V(b)
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (a + ab * t - p).length


class Parts:
    def __init__(self):
        self.items = []

    def add(self, obj, bones, falloff=3.0):
        if obj is None:
            return None
        self.items.append((obj, bones if isinstance(bones, (list, tuple)) else [bones], falloff))
        return obj


def build_armature(name, bones):
    ad = bpy.data.armatures.new(name)
    arm = bpy.data.objects.new(name, ad)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    eb = {}
    for bn, h, t, parent in bones:
        b = ad.edit_bones.new(bn)
        b.head, b.tail = V(h), V(t)
        if (b.tail - b.head).length < 1e-3:
            b.tail = b.head + V((0, 0, 0.01))
        if parent:
            b.parent = eb[parent]
        eb[bn] = b
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


def weight(obj, allowed, bonedefs, falloff=3.0):
    groups = {n: obj.vertex_groups.get(n) or obj.vertex_groups.new(name=n) for n in allowed}
    if len(allowed) == 1:
        groups[allowed[0]].add([v.index for v in obj.data.vertices], 1.0, "REPLACE")
        return
    segs = [(n, bonedefs[n][1], bonedefs[n][2]) for n in allowed]
    for v in obj.data.vertices:
        ws = sorted(((1.0 / (seg_dist(v.co, h, t) ** falloff + 1e-7), n) for n, h, t in segs), reverse=True)[:2]
        tot = sum(w for w, _ in ws)
        for w, n in ws:
            groups[n].add([v.index], w / tot, "REPLACE")


def join_parts(parts, bonedefs, name):
    objs = []
    for obj, allowed, fo in parts.items:
        sl.apply_transforms(obj)
        weight(obj, allowed, bonedefs, fo)
        objs.append(obj)
    body = sl.join(objs, name)
    mats = [m.name for m in body.data.materials]
    return body


# ------------------------------------------------------------------ posing / animation
class Rig:
    def __init__(self, arm):
        self.arm = arm
        self.R = {b.name: b.matrix_local.to_3x3() for b in arm.data.bones}
        for pb in arm.pose.bones:
            pb.rotation_mode = "QUATERNION"
        arm.animation_data_create()
        self.act = None
        self.tracks = []

    def new(self, name):
        self.act = bpy.data.actions.new(name)
        self.arm.animation_data.action = self.act
        for pb in self.arm.pose.bones:
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
            pb.scale = (1, 1, 1)
        return self.act

    def key(self, frame, rots=None, locs=None, scales=None):
        """rots: {bone: (x,y,z) deg about armature-axes in parent's frame}; locs: {bone: (x,y,z) metres, armature axes};
        scales: {bone: s or (x,y,z)}. Unlisted bones are keyed at rest."""
        rots, locs, scales = rots or {}, locs or {}, scales or {}
        for pb in self.arm.pose.bones:
            R = self.R[pb.name]
            e = rots.get(pb.name, (0, 0, 0))
            qw = Euler(tuple(rad(a) for a in e), "XYZ").to_matrix()
            pb.rotation_quaternion = (R.inverted() @ qw @ R).to_quaternion()
            pb.keyframe_insert("rotation_quaternion", frame=frame)
            loc = locs.get(pb.name)
            if loc is not None or pb.name in self.touched_loc:
                self.touched_loc.add(pb.name)
                pb.location = R.inverted() @ V(loc or (0, 0, 0))
                pb.keyframe_insert("location", frame=frame)
            sc = scales.get(pb.name)
            if sc is not None or pb.name in self.touched_sc:
                self.touched_sc.add(pb.name)
                if sc is None:
                    sc = 1.0
                pb.scale = (sc, sc, sc) if isinstance(sc, (int, float)) else sc
                pb.keyframe_insert("scale", frame=frame)

    touched_loc = set()
    touched_sc = set()

    def begin(self, name, loc=("root",), sc=()):
        """loc/sc: bones that get location/scale channels (keyed on every frame)."""
        self.touched_loc, self.touched_sc = set(loc), set(sc)
        return self.new(name)

    def end(self, const=False):
        act = self.act
        try:
            for fc in act.fcurves:
                for kp in fc.keyframe_points:
                    kp.interpolation = "CONSTANT" if const else "BEZIER"
        except Exception:
            pass
        tr = self.arm.animation_data.nla_tracks.new()
        tr.name = act.name
        tr.strips.new(act.name, int(act.frame_range[0]), act)
        self.arm.animation_data.action = None
        self.tracks.append(act.name)

    def show(self, name, frame):
        self.arm.animation_data.action = bpy.data.actions[name]
        bpy.context.scene.frame_set(frame)


def cyc(frames, steps):
    """frame numbers for a loop of `frames` frames with `steps` keys (last == first state)."""
    return [round(frames * i / steps) for i in range(steps + 1)]


# ------------------------------------------------------------------ finishing
def skin_body(parts, bonedefs, arm, name, ao=0.12):
    body = join_parts(parts, bonedefs, name)
    if ao:
        sl.bake_ao(body, strength=ao, samples=8)
    mod = body.modifiers.new("rig", "ARMATURE")
    mod.object = arm
    body.parent = arm
    return body


def view_at(aid, tag, center, radius, azim=0, elev=5, bg="#CFC8E8", size=640, objs=None):
    """Custom-framed Workbench render (used for face close-ups)."""
    scn = bpy.context.scene
    cam_data = bpy.data.cameras.get("_pcam2") or bpy.data.cameras.new("_pcam2")
    cam_data.lens = 50
    cam = bpy.data.objects.get("_pcam2") or sl.new_object("_pcam2", cam_data)
    center = V(center)
    dist = radius / math.tan(cam_data.angle / 2)
    e, a = rad(elev), rad(azim)
    cam.location = center + V((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
    scn.camera = cam
    out = os.path.join(sl.PREVIEWS, PACK)
    scn.render.engine = "BLENDER_WORKBENCH"
    sh = scn.display.shading
    sh.light, sh.color_type, sh.show_cavity, sh.show_shadows = "STUDIO", "VERTEX", True, True
    scn.world = scn.world or bpy.data.worlds.new("w")
    scn.world.color = tuple(sl.srgb_to_linear(c) for c in sl.hex_rgb(bg))
    scn.render.resolution_x = scn.render.resolution_y = size
    scn.view_settings.view_transform = "Standard"
    scn.render.filepath = os.path.join(out, f"_{aid}_{tag}.png")
    bpy.ops.render.render(write_still=True)


def views(body, aid, bg="#CFC8E8", size=640, elev=8, frame=1.0):
    sl.preview([body], aid, PACK, size=size, bg=bg, elev=elev, azim=-35, frame=frame)
    for tag, az in (("front", 0), ("side", 90), ("back", 180)):
        sl.preview([body], f"_{aid}_{tag}", PACK, size=size, bg=bg, elev=elev - 2, azim=az, frame=frame)


def finish(arm, body, aid, rig, category, worlds, anims, extra=None, pose=None, pose_frame_cam=(-35, 8), frame=1.0,
           bg="#CFC8E8", manifest=None, face=None):
    views(body, aid, bg, frame=frame)
    if face:
        view_at(aid, "face", face[0], face[1], 0, 3, bg)
    sl.export_glb_with_anims([arm, body], aid, PACK)
    if pose:
        rig.show(pose[0], pose[1])
        sl.preview([body], f"_{aid}_pose_{pose[0]}", PACK, size=640, bg=bg, elev=pose_frame_cam[1], azim=pose_frame_cam[0], frame=frame)
        arm.animation_data.action = None
    ex = {"animations": anims, "rig": arm.name}
    if extra:
        ex.update(extra)
    w, d, h = sl.dims(body)
    coll = {"type": "cylinder", "radius": round(max(w, d) / 2 * 0.6, 2), "height": round(h, 2)}
    entry = manifest.add(aid, body, category, worlds, coll, None, ex)
    return entry


# ------------------------------------------------------------------ extras
def pleat(obj, n=10, amp=0.05, z0=None, z1=None, axis_xy=(0.0, 0.0)):
    """Radial pleats (crisp folds) around the Z axis, fading in from z1 (top, none) to z0 (hem, full)."""
    me = obj.data
    zs = [v.co.z for v in me.vertices]
    lo, hi = (min(zs) if z0 is None else z0), (max(zs) if z1 is None else z1)
    for v in me.vertices:
        dx, dy = v.co.x - axis_xy[0], v.co.y - axis_xy[1]
        r = math.hypot(dx, dy)
        if r < 1e-5:
            continue
        a = math.atan2(dy, dx)
        t = max(0.0, min(1.0, (hi - v.co.z) / max(hi - lo, 1e-5)))
        k = 1.0 + amp * (t ** 0.8) * (abs(math.cos(n * a / 2)) ** 0.7 * 2 - 1)
        v.co.x = axis_xy[0] + dx * k
        v.co.y = axis_xy[1] + dy * k
    me.update()
    return obj


def solid(obj, thickness=0.01, offset=0.0):
    m = obj.modifiers.new("solid", "SOLIDIFY")
    m.thickness = thickness
    m.offset = offset
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=m.name)
    return obj


def hair_cap(hd, color, hairline=0.3, back=-0.55, scale=1.045, name="hair", segs=44, rings=30):
    """Skull-hugging hair shell on a Head: kept where z > hairline (front) .. back (nape). Heights in unit-sphere space."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    for v in bm.verts:
        cut = back + (hairline - back) * (max(0.0, -v.co.y)) ** 0.8
        if v.co.z < cut:
            v.co.z = cut          # clamp onto the hairline curve (smooth boundary), then drop zero-area faces
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_area() < 1e-7], context="FACES_ONLY")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    for v in bm.verts:
        q = v.co.copy()
        if hd.deform:
            q = hd.deform(q)
        v.co = V((q.x * hd.r[0] * scale, q.y * hd.r[1] * scale, q.z * hd.r[2] * scale)) + hd.c
    return mk(bm, name, "VC", True, color)


def creature_build(parts, bones, name, ao=0.1):
    """bones: list of (name, head, tail, parent). Returns (arm, body)."""
    arm = build_armature(name + "_rig", bones)
    bd = {b[0]: b for b in bones}
    body = skin_body(parts, bd, arm, name, ao)
    return arm, body


def flat(obj):
    sl.shade_flat(obj)
    return obj


def facet_paint(obj, fn):
    """Per-face colour from (center, normal)."""
    sl.paint_faces(obj, lambda p, c, n: fn(c, n))
    return obj
