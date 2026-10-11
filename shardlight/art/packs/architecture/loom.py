"""The Loom (hero landmark) + broken ring fragments."""
import math
import bmesh
import bpy
from mathutils import Vector, Matrix
from _kit import *  # noqa
from _kit import _recalc  # noqa

CZ = 7.3            # ring center height
R_MID = 4.85        # ring centerline radius
RING_W = 1.7        # radial width of ring body
RING_D = 1.25       # depth (Y)
COLLAR_D = 1.65
NSOCK = 7
WORLD_ORDER = ["verdant", "amber", "tide", "ember", "glass", "hollow", "seam"]
WORLD_COL = ["#7ED957", "#F5B971", "#3FE0D0", "#FF5A1F", "#BDEBFF", "#FF8AD8", "#FFE9A8"]
SOCK_SCALE = 1.25
SOCK_Y_ANCHOR = -(COLLAR_D / 2) - 0.45 * SOCK_SCALE     # y (Blender) of the keystone center, in front of the ring


def sock_pos(k):
    th = math.radians(k * 360.0 / NSOCK)
    return Vector((R_MID * math.sin(th), SOCK_Y_ANCHOR, CZ + R_MID * math.cos(th)))


GAP = (333.0, 336.4)   # theta range (deg) of the fracture in the main ring


def ring_xz(b, R, profile, a0=0.0, a1=360.0, segs=96, loc=(0, 0, 0), extra_rot=0.0, scales=None, gap=True, jag=None, **kw):
    """Ring standing in the XZ plane (axis along Y). a0/a1 are theta degrees clockwise from top as seen from -Y.
    profile: (u radial, v depth) -> v maps to -Y (front). Full rings get the fracture GAP unless gap=False."""
    if gap and abs((a1 - a0) - 360.0) < 1e-6:
        a0, a1 = GAP[1], GAP[0] + 360.0
    # prim_ring angle a (from +X ccw in XY) -> after Rx(+90) lies in XZ with a measured from +X toward +Z.
    A0, A1 = 90.0 - a1, 90.0 - a0
    ej = (jag, jag) if jag else None
    bm = prim_ring(R, profile, segs=segs, a0=A0, a1=A1, scales=scales, end_jitter=ej)
    return b.add(bm, loc=loc, rot=(90 + extra_rot, 0, 0), **kw)


def sector_panels(p, n):
    ang = math.atan2(p.y, p.x) % (2 * math.pi)
    k = int(ang / (2 * math.pi / 24))
    return C["white"] if k % 2 == 0 else "#E3E6F4"


sector_panels.per_face = True


def tier(b, R, z0, h, side_color, top_color=None, n=40):
    prof = [(0, z0), (R - 0.06, z0), (R, z0 + 0.06), (R, z0 + h - 0.1), (R - 0.1, z0 + h)]
    rs = [R * 0.75, R * 0.5, R * 0.25]
    prof += [(r, z0 + h) for r in rs] + [(0, z0 + h)]
    tc = top_color
    b.lathe(prof, n=n, color=(lambda p, nn, sc=side_color, tc=tc: (tc(p, nn) if (tc and nn.z > 0.9) else sc)),
            nz=0.035) if False else None
    # side & top colored via function (per-face)
    def fn(p, nn, sc=side_color, tc=tc):
        if nn.z > 0.9 and tc is not None:
            return tc(p, nn) if callable(tc) else tc
        return sc
    fn.per_face = True
    b.lathe(prof, n=n, color=fn, nz=0.03)


def cable_polar(phi0, plan, wob=7.0, k=1.0):
    pts = []
    for (r, z) in plan:
        phi = math.radians(phi0 + wob * math.sin(r * 0.8 * k))
        pts.append(Vector((r * math.cos(phi), r * math.sin(phi), z)))
    return pts


def build_prism():
    """Cracked prism: two halves (hot cut faces) + floating shards. Local coords centered on the prism."""
    b = Build("loom_prism")
    b.flat_all = True
    prof = [(0, -1.85), (0.62, -1.0), (0.95, -0.35), (0.95, 0.35), (0.62, 1.0), (0, 1.85)]

    def mk(clear_inner):
        bm = prim_lathe(prof, n=6, cap=False)
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, 0), plane_no=(1, 0, 0),
                               clear_inner=clear_inner, clear_outer=not clear_inner)
        bd = [e for e in bm.edges if e.is_boundary]
        bmesh.ops.holes_fill(bm, edges=bd, sides=0)
        _recalc(bm)
        return bm

    def col(p, n):
        if abs(n.x) > 0.97 and abs(n.y) < 0.2:
            return "#F2E8FF"
        t = max(0, min(1, (p.z + 1.85) / 3.7))
        return sl.mix("#7B45E8", "#CDB5FF", t ** 0.9)

    col.per_face = True
    # halves: slight separation and misalignment (the prism is cracked & drifting apart)
    b.add(mk(True), loc=(-0.07, 0, 0.02), rot=(0, -1.5, 2.5), color=col, mat="EMIT", jit=0.3, nz=0.04, flat=True)
    b.add(mk(False), loc=(0.07, 0, -0.03), rot=(0, 1.5, -2.5), color=col, mat="EMIT", jit=0.3, nz=0.04, flat=True)
    # orbiting shards
    rng = b.rng
    for i in range(9):
        ang = rng.uniform(0, 2 * math.pi)
        rr = rng.uniform(1.5, 2.5)
        zz = rng.uniform(-1.4, 1.5)
        sz = rng.uniform(0.16, 0.38)
        shard = prim_lathe([(0, -sz * 1.7), (sz * 0.5, 0), (0, sz * 1.7)], n=4, cap=False)
        b.add(shard, loc=(rr * math.cos(ang), rr * math.sin(ang) * 0.8, zz),
              rot=(rng.uniform(0, 60), rng.uniform(0, 60), rng.uniform(0, 360)),
              color=G("#8A55F5", "#D8C6FF"), mat="EMIT", jit=0.5, flat=True, nz=0.0)
    for v in b.bm.verts:
        v.co *= 1.3
    return b.to_object("loom_prism", flat=True)


def sp(w, d):
    return [(-w / 2, d / 2), (w / 2, d / 2), (w / 2, -d / 2), (-w / 2, -d / 2)]


def stripe(R, w, d, **kw):
    return prim_ring(R, [(-w / 2, d / 2), (w / 2, d / 2), (w / 2, -d / 2), (-w / 2, -d / 2)], **kw)


def build_loom(man):
    b = Build("hub_loom_core")
    sock_info = []
    ZT = 1.35   # platform top
    # ------------------------------------------------------------------ platform (3 stepped tiers)
    tier(b, 8.0, 0.0, 0.5, "#8C93B5", None)
    n_h = 26
    for i in range(n_h):
        a0 = 360.0 * i / n_h
        b.add(stripe(7.55, 0.8, 0.06, segs=200, a0=a0, a1=a0 + 360.0 / n_h * 0.5), loc=(0, 0, 0.51),
              color=C["orange"] if i % 2 == 0 else "#4A4570", nz=0.02, jit=0.3)
    tier(b, 6.9, 0.5, 0.45, "#DDE1F2", sector_panels)
    tier(b, 5.9, 0.95, 0.4, "#EDEFF7", sector_panels)
    b.add(stripe(6.92, 0.1, 0.24, segs=64), loc=(0, 0, 0.72), color=C["orange"], jit=0.3)
    b.add(stripe(5.92, 0.1, 0.2, segs=64), loc=(0, 0, 1.15), color=C["orange"], jit=0.3)
    # violet inlay rings (EMIT) on the top tiers
    for (rr, zz, ww) in ((5.2, ZT + 0.012, 0.14), (2.7, ZT + 0.012, 0.12), (6.45, 0.95 + 0.012 + 0.0, 0.1)):
        b.add(stripe(rr, ww, 0.03, segs=72), loc=(0, 0, zz), color="#B691FF", mat="EMIT", nz=0)
    # cradle block that holds the ring foot
    b.box((3.9, 2.5, 1.55), loc=(0, 0, ZT + 0.75), r=0.24, color=G("#8C93B5", "#B4BAD6"))
    for zz in (ZT + 0.45, ZT + 1.0):
        b.box((4.0, 0.2, 0.26), loc=(0, -1.2, zz), r=0.07, color=C["orange"], jit=0.3)

    b.mark('platform')
    # ------------------------------------------------------------------ main ring
    Z0, Z1 = CZ - R_MID - RING_W / 2, CZ + R_MID + RING_W / 2
    gring = G("#C9CDE4", "#F5F6FC", lo=Z0, hi=Z1)
    def jag_main(pu, pv):
        return 0.04 + 0.22 * abs(math.sin(pu * 6.1 + pv * 4.3))

    ring_xz(b, R_MID, rrect(RING_W, RING_D, 0.34, 3), loc=(0, 0, CZ), segs=84, color=gring, nz=0.04, jag=jag_main)
    ring_xz(b, R_MID - 0.15, sp(0.6, 0.14), loc=(0, -RING_D / 2 - 0.02, CZ), segs=96, color=C["steel"], nz=0.03)
    ring_xz(b, R_MID + 0.6, sp(0.16, 0.14), loc=(0, -RING_D / 2 - 0.02, CZ), segs=96, color=C["orange"], jit=0.3)
    ring_xz(b, R_MID - 0.6, sp(0.12, 0.14), loc=(0, -RING_D / 2 - 0.02, CZ), segs=96, color=C["orange"], jit=0.3)
    # inner energy channel: dark conduit + lit arcs (the Loom is mostly dead, but not fully)
    ring_xz(b, R_MID - RING_W / 2 + 0.02, sp(0.14, 0.46), loc=(0, 0, CZ), segs=96, color="#4A4570")
    for (a, c) in [(8, 68), (82, 135), (160, 212), (232, 300), (312, 331)]:
        ring_xz(b, R_MID - RING_W / 2 + 0.03, sp(0.17, 0.38), a0=a, a1=c, loc=(0, 0, CZ), segs=96,
                color=G("#8A55F5", "#C7ADFF", axis=2, lo=Z0, hi=Z1), mat="EMIT", nz=0)
    # collars at the 7 socket positions + small orange clamps between them
    for k in range(NSOCK):
        th = k * 360.0 / NSOCK
        ring_xz(b, R_MID, rrect(RING_W + 0.4, COLLAR_D, 0.32, 2), a0=th - 7.0, a1=th + 7.0, loc=(0, 0, CZ), segs=300,
                color=G("#9AA1C3", "#C6CBE3", lo=Z0, hi=Z1), nz=0.04)
        tm = th + 360.0 / NSOCK / 2
        if k == NSOCK - 1:
            continue   # the fracture is here
        ring_xz(b, R_MID, rrect(RING_W + 0.22, RING_D + 0.3, 0.2, 1), a0=tm - 3.2, a1=tm + 3.2, loc=(0, 0, CZ), segs=400,
                color=C["orange"], jit=0.25)
    b.mark('ring')
    for sgn, thc in ((-1, GAP[0]), (1, GAP[1])):
        th = math.radians(thc)
        tdir = Vector((math.cos(th), 0, -math.sin(th))) * sgn      # tangent pointing into the gap
        for j in range(5):
            rr = R_MID + (j - 2) * 0.3
            e0 = Vector((rr * math.sin(th), (j % 3 - 1) * 0.3, CZ + rr * math.cos(th)))
            b.rod(e0 - tdir * 0.1, e0 + tdir * (0.35 + 0.25 * ((j * 3) % 4) / 3), 0.05, n=5,
                  color=C["orange_dk"] if j % 2 else "#4A4570", nz=0, jit=0.3)
    # ------------------------------------------------------------------ sockets (cradles)
    for k in range(NSOCK):
        th = k * 360.0 / NSOCK
        P = Vector((R_MID * math.sin(math.radians(th)), -COLLAR_D / 2, CZ + R_MID * math.cos(math.radians(th))))
        M = Matrix.Translation(P) @ Matrix.Rotation(math.radians(th), 4, "Y") @ Matrix.Scale(SOCK_SCALE, 4)
        b.add(prim_box(1.2, 0.12, 1.3, 0.05, 1), matrix=M @ Matrix.Translation((0, -0.06, 0)), color="#6A7099", nz=0.02)
        b.add(prim_box(0.86, 0.3, 0.98, 0.08, 1), matrix=M @ Matrix.Translation((0, -0.27, 0.0)), color="#9AA1C3", nz=0.02)
        for sx in (-1, 1):
            b.add(prim_box(0.18, 0.48, 0.94, 0.06, 1), matrix=M @ Matrix.Translation((sx * 0.45, -0.37, 0.02)),
                  color=C["steel_lt"], nz=0.02)
            b.add(prim_box(0.2, 0.22, 0.3, 0.05, 1), matrix=M @ Matrix.Translation((sx * 0.45, -0.6, 0.34)),
                  color=C["orange"], jit=0.3)
        b.add(prim_box(0.86, 0.5, 0.18, 0.05, 1), matrix=M @ Matrix.Translation((0, -0.36, -0.44)), color=C["steel_lt"], nz=0.02)
        Mx = M @ Matrix.Translation((0, -0.425, 0.04)) @ Matrix.Rotation(math.radians(90), 4, "X")
        b.add(prim_cyl(0.34, 0.34, 0.05, 16, 0.0, 2), matrix=Mx, color=WORLD_COL[k], jit=0.1, nz=0.0)
        Mx2 = M @ Matrix.Translation((0, -0.45, 0.04)) @ Matrix.Rotation(math.radians(90), 4, "X")
        b.add(prim_cyl(0.23, 0.23, 0.04, 16, 0.0, 2), matrix=Mx2, color="#7B4FDA", mat="EMIT", nz=0, jit=0.1)
        sock_info.append((k, sock_pos(k)))

    b.mark('sockets')
    # ------------------------------------------------------------------ cradling arms (claws)
    for sx in (-1, 1):
        pts = [(sx * 6.4, 0, 0.9), (sx * 7.55, 0, 2.3), (sx * 7.6, 0, 3.8), (sx * 6.8, 0, 4.8), (sx * 5.5, 0, 5.15)]
        path = catmull(pts, 7)
        sc = [(1.0 - 0.34 * i / (len(path) - 1)) for i in range(len(path))]
        b.add(prim_sweep(path, rrect(1.7, 2.1, 0.5, 3), scales=sc, up=Vector((0, 1, 0))), color=G("#BFC4DE", "#F2F3FB"), nz=0.04)
        b.box((2.8, 2.9, 0.9), loc=(sx * 6.4, 0, 0.95 + 0.4), r=0.24, color=C["steel"], nz=0.03)
        for t in (0.3, 0.58):
            i = int(t * (len(path) - 1))
            q = path[i]
            tang = (path[i + 1] - path[i - 1]).normalized()
            ang = math.degrees(math.atan2(tang.x, tang.z))
            sc_i = sc[i]
            b.add(prim_box(1.95 * sc_i, 2.35 * sc_i, 0.3, 0.09, 1), loc=q, rot=(0, ang, 0), color=C["orange"], jit=0.25)
        th = 112.0
        Pc = Vector((sx * (R_MID + 0.55) * math.sin(math.radians(th)), 0, CZ + (R_MID + 0.55) * math.cos(math.radians(th))))
        b.add(prim_box(1.4, 2.2, 1.7, 0.26, 2), loc=Pc, rot=(0, th * sx, 0), color="#9AA1C3", nz=0.03)
        b.add(prim_box(1.45, 2.3, 0.32, 0.1, 1), loc=Pc, rot=(0, th * sx, 0), color=C["orange"], jit=0.25)
    # rear braces (A-frame legs) so it reads as a freestanding machine
    for sx in (-1, 1):
        a = math.radians(148)
        top = Vector((sx * R_MID * math.sin(a), 0.55, CZ + R_MID * math.cos(a)))
        b.beam(top, Vector((sx * 3.0, 5.0, ZT)), 0.95, 1.0, r=0.2, color=G("#8C93B5", "#C6CBE3"), nz=0.03)
        b.box((1.9, 1.9, 0.8), loc=(sx * 3.0, 5.0, ZT + 0.35), r=0.2, color=C["steel"])
        b.box((1.2, 1.2, 0.3), loc=top + Vector((0, 0.1, 0)), r=0.1, color=C["orange"], jit=0.25)

    b.mark('arms')
    # ------------------------------------------------------------------ halo (broken outer ring, behind)
    hy = 1.6
    HR = R_MID + 1.75

    def jag(pu, pv):
        return 0.15 + 0.5 * ((pu * 7.3 + pv * 3.1) % 1.0)

    bm = prim_ring(HR, rrect(0.8, 0.6, 0.2, 2), segs=120, a0=90 - 150, a1=90 + 105, end_jitter=(jag, jag))
    b.add(bm, loc=(0, hy, CZ), rot=(90, 0, 0), color=G("#B8BDD8", "#EEF0F9", lo=1.0, hi=14.5), nz=0.05)
    for (a, c) in ((-62, -40), (3, 22), (58, 76), (108, 126)):
        bm = prim_ring(HR, sp(0.96, 0.74), segs=300, a0=90 - c, a1=90 - a)
        b.add(bm, loc=(0, hy, CZ), rot=(90, 0, 0), color=C["orange"], jit=0.25)
    for thc in (150.0, -105.0):
        th = math.radians(thc)
        end = Vector((HR * math.sin(th), hy, CZ + HR * math.cos(th)))
        outd = Vector((math.cos(th), 0, -math.sin(th))) * (1 if thc > 0 else -1)
        for j in range(4):
            off = Vector((math.sin(th), 0, math.cos(th))) * ((j - 1.5) * 0.15)
            wob = Vector((0, (j - 1.5) * 0.12, 0))
            b.rod(end + off + wob - outd * 0.2, end + off + wob + outd * (0.8 + 0.35 * j) + Vector((0, 0.05 * j, -0.12 * j)),
                  0.05, n=5, color="#4A4570" if j % 2 else C["orange_dk"], nz=0, jit=0.3)
    for thc in (-70, 20, 68, 128):
        th = math.radians(thc)
        r0, r1 = R_MID + 0.5, HR - 0.1
        p0 = Vector((r0 * math.sin(th), 0.45, CZ + r0 * math.cos(th)))
        p1 = Vector((r1 * math.sin(th), hy, CZ + r1 * math.cos(th)))
        b.beam(p0, p1, 0.36, 0.55, r=0.1, color=C["steel"], nz=0.02)

    b.mark('halo')
    # ------------------------------------------------------------------ inner tilted gyro ring + axles
    GR = R_MID - RING_W / 2 - 0.55
    b.add(prim_ring(GR, rrect(0.6, 0.46, 0.14, 2), segs=64), loc=(0, 0, CZ), rot=(90 + 17, 0, 0),
          color=G("#9AA1C3", "#E3E6F4", lo=CZ - GR, hi=CZ + GR), nz=0.04)
    b.add(prim_ring(GR, sp(0.24, 0.5), segs=200, a0=40, a1=130), loc=(0, 0, CZ), rot=(90 + 17, 0, 0),
          color=C["orange"], jit=0.2)
    for sx in (-1, 1):
        b.rod((sx * (GR - 0.3), 0, CZ), (sx * (R_MID - RING_W / 2 + 0.2), 0, CZ), 0.25, n=10, color=C["steel_dk"], nz=0.02)
        b.rod((sx * (GR - 0.1), 0, CZ), (sx * (GR + 0.3), 0, CZ), 0.37, n=10, color=C["orange"], jit=0.25)

    b.mark('gyro')
    # ------------------------------------------------------------------ cables to the floor
    cab_col = "#58527F"
    start_pts = [
        [Vector((0.9, 1.25, ZT + 0.9)), Vector((1.3, 2.4, ZT + 0.3))],
        [Vector((-0.9, 1.25, ZT + 0.6)), Vector((-1.5, 2.6, ZT + 0.3))],
        [Vector((1.7, -1.25, ZT + 0.5)), Vector((2.4, -2.2, ZT + 0.3))],
    ]
    plan = [(3.0, 1.55), (4.6, 1.55), (5.7, 1.55), (6.1, 1.15), (6.7, 1.15), (7.1, 0.7), (7.9, 0.68), (8.4, 0.34),
            (9.6, 0.3), (11.2, 0.3), (12.5, 0.3)]
    for (st, phi) in zip(start_pts, (68.0, 112.0, -52.0)):
        sm = catmull(st + cable_polar(phi, plan), 3)
        b.add(prim_sweep(sm, circle_prof(0.27, 7), None, False, None, True), color=cab_col, jit=0.4, nz=0.03)
        for i in (4, 12, 22):
            if i < len(sm) - 1:
                tdir = (sm[i + 1] - sm[i - 1]).normalized()
                qq = Vector((0, 0, 1)).rotation_difference(tdir)
                b.add(prim_cyl(0.29, 0.29, 0.28, 8, 0.0, 2), matrix=Matrix.Translation(sm[i]) @ qq.to_matrix().to_4x4(),
                      color=C["orange"], jit=0.25, nz=0)
    for sx, phi in ((1, 20.0), (-1, 160.0)):
        a = math.radians(124)
        st = Vector((sx * (R_MID + 0.3) * math.sin(a), 0.9, CZ + (R_MID + 0.3) * math.cos(a)))
        path = [st, Vector((sx * 7.0, 1.4, 4.2)), Vector((sx * 7.5, 1.6, 2.4)), Vector((sx * 6.7, 1.8, 1.5))]
        tail = cable_polar(phi, [(6.4, 1.15), (7.0, 0.7), (7.9, 0.68), (8.4, 0.34), (9.6, 0.3), (11.0, 0.3)])
        sm = catmull(path + tail, 3)
        b.add(prim_sweep(sm, circle_prof(0.22, 7), None, False, None, True), color=cab_col, jit=0.4, nz=0.03)

    b.mark('cables')
    # ------------------------------------------------------------------ rubble on the tiers
    rng = b.rng
    for i in range(9):
        a = rng.uniform(0, 2 * math.pi)
        rr = rng.uniform(4.2, 7.6)
        zt = ZT if rr < 5.9 else (0.95 if rr < 6.9 else 0.5)
        if abs(math.cos(a) * rr) < 2.6 and abs(math.sin(a) * rr) < 1.8:
            continue
        sz = rng.uniform(0.35, 0.8)
        b.box((sz * 1.4, sz, sz * 0.8), loc=(rr * math.cos(a), rr * math.sin(a), zt + sz * 0.3), r=0.12,
              rot=(rng.uniform(-20, 20), rng.uniform(-20, 20), rng.uniform(0, 360)),
              color=G("#C6CBE3", "#EDEFF7"), nz=0.05)
    for i in range(5):
        a = rng.uniform(0, 2 * math.pi)
        rr = rng.uniform(6.0, 7.4)
        zt = 0.95 if rr < 6.9 else 0.5
        b.rod((rr * math.cos(a), rr * math.sin(a), zt), (rr * math.cos(a) + rng.uniform(-0.5, 0.5),
              rr * math.sin(a) + rng.uniform(-0.5, 0.5), zt + rng.uniform(0.7, 1.3)), 0.04, n=5, color="#7A6F8F", nz=0)

    main = b.to_object("hub_loom_core")
    prism = build_prism()
    prism.location = (0, 0, CZ)
    empties = []
    for k, p in sock_info:
        e = bpy.data.objects.new(f"socket_{k}", None)
        bpy.context.scene.collection.objects.link(e)
        e.empty_display_type = "ARROWS"
        e.empty_display_size = 0.3
        e.location = p
        empties.append(e)

    def godot(p):
        return [round(p.x, 3), round(p.z, 3), round(-p.y, 3)]

    sockets = [{"index": k, "pos": godot(p), "pos_blender": [round(p.x, 3), round(p.y, 3), round(p.z, 3)],
                "normal": [0.0, 0.0, 1.0], "theta_deg_cw_from_top": round(k * 360.0 / NSOCK, 2),
                "world_hint": WORLD_ORDER[k]} for k, p in sock_info]
    extra = {
        "sockets": sockets,
        "sockets_note": ("Local positions in the asset's own space (origin = platform center on the ground), "
                         "Godot axes (Y up, +Z = front side = Blender -Y). Each is the keystone center, ~0.45 m in front of "
                         "the cradle pad. Also exported as Node3D empties 'socket_0'..'socket_6' in the glb. Index 0 is the "
                         "top, then clockwise as seen from the front (+Z). 'world_hint' is a suggested keystone/world mapping."),
        "ring": {"center": [0.0, CZ, 0.0], "radius_mid": R_MID, "width": RING_W, "plane": "XY (normal = Godot Z)"},
        "separate_nodes": ["loom_prism"],
        "prism": {"node": "loom_prism", "pivot_godot": [0.0, CZ, 0.0], "material": "EMIT",
                  "note": "origin at the prism center so it can bob/rotate; cracked halves + orbiting shards share the node"},
        "platform_top_y": ZT,
        "footprint_radius": 8.0, "cables_extend_to_radius": 12.5,
    }
    return finish(man, "hub_loom_core", main, [prism], empties, category="landmark", worlds=["hub"],
                  collision="trimesh", scatter=None, ao=0.4, origin="authored", extra=extra,
                  views=[("side", dict(azim=70, elev=14)), ("back", dict(azim=160, elev=20)),
                         ("top", dict(azim=-20, elev=58)), ("front", dict(azim=0, elev=8))],
                  preview_kw=dict(frame=0.85))


# ----------------------------------------------------------------------------- ring fragments
def build_fragment(man, key):
    aid = f"hub_loom_ring_fragment_{key}"
    b = Build(aid)
    cfg = {"a": dict(arc=62, sock=True, tilt=(6, -4)), "b": dict(arc=38, sock=False, tilt=(-9, 5)),
           "c": dict(arc=85, sock=False, tilt=(4, 10))}[key]
    arc = cfg["arc"]
    rng = b.rng
    # lie flat: ring in XY plane (axis = Z), profile v = height -> ring thickness vertical.
    # A ring section "face" (front, -Y in the Loom) faces up here.
    prof = rrect(RING_W, RING_D, 0.3, 3)

    def jag(pu, pv):
        return 0.1 + 0.55 * abs(math.sin(pu * 5.1 + pv * 3.7 + len(key)))

    a0 = -arc / 2
    bm = prim_ring(R_MID, prof, segs=120, a0=a0, a1=a0 + arc, end_jitter=(jag, jag))
    # bury / raise: ring center z so the piece rests on the ground (half-thickness), then sinks a bit
    b.add(bm, loc=(-R_MID * 0.0, 0, RING_D / 2 - 0.12), rot=(0, 0, 0), color=G("#B4B9D4", "#F0F1FA"), nz=0.06)
    # steel inner exposed core at the broken ends: darker inside strip along the ring
    b.add(prim_ring(R_MID - RING_W / 2 + 0.03, rrect(0.12, 0.42, 0.03, 2), segs=120, a0=a0 + 3, a1=a0 + arc - 3),
          loc=(0, 0, RING_D / 2 - 0.12), color="#4A4570")
    for (u, v) in ((0.0, 0.6),):
        pass
    # lit energy arc (still glowing)
    s0 = a0 + arc * 0.18
    s1 = a0 + arc * (0.55 if key != "b" else 0.7)
    b.add(prim_ring(R_MID - RING_W / 2 + 0.04, rrect(0.14, 0.34, 0.04, 2), segs=240, a0=s0, a1=s1),
          loc=(0, 0, RING_D / 2 - 0.12), color="#B691FF", mat="EMIT", nz=0)
    # orange edge trim along the (upward) front face
    b.add(prim_ring(R_MID + 0.5, rrect(0.13, 0.14, 0.04, 2), segs=120, a0=a0 + 4, a1=a0 + arc - 4),
          loc=(0, 0, RING_D - 0.12 + 0.02), color=C["orange"], jit=0.3)
    b.add(prim_ring(R_MID - 0.12, rrect(0.5, 0.14, 0.05, 2), segs=120, a0=a0 + 4, a1=a0 + arc - 4),
          loc=(0, 0, RING_D - 0.12 + 0.02), color=C["steel"])
    # collar (and socket on fragment a)
    cth = a0 + arc * (0.5 if key != "c" else 0.35)
    b.add(prim_ring(R_MID, rrect(RING_W + 0.35, RING_D + 0.4, 0.3, 3), segs=300, a0=cth - 6.5, a1=cth + 6.5),
          loc=(0, 0, RING_D / 2 - 0.12 + 0.0), color="#9AA1C3", nz=0.04)
    if cfg["sock"]:
        ang = math.radians(cth)
        P = Vector((R_MID * math.cos(ang), R_MID * math.sin(ang), RING_D / 2 - 0.12 + (RING_D + 0.4) / 2))
        # cradle on the up-facing side: local z radial -> now z world up; build rotated: socket front (-Y) -> +Z
        M = Matrix.Translation(P) @ Matrix.Rotation(ang - math.radians(90), 4, "Z") @ Matrix.Rotation(math.radians(-90), 4, "X") @ Matrix.Scale(SOCK_SCALE, 4)
        b.add(prim_box(1.15, 0.12, 1.25, 0.05, 2), matrix=M @ Matrix.Translation((0, -0.06, 0)), color="#6A7099")
        b.add(prim_box(0.82, 0.3, 0.95, 0.08, 2), matrix=M @ Matrix.Translation((0, -0.27, 0.0)), color="#9AA1C3")
        for sx in (-1, 1):
            b.add(prim_box(0.17, 0.46, 0.9, 0.06, 2), matrix=M @ Matrix.Translation((sx * 0.43, -0.37, 0.02)), color=C["steel_lt"])
        b.add(prim_box(0.82, 0.48, 0.17, 0.05, 2), matrix=M @ Matrix.Translation((0, -0.35, -0.42)), color=C["steel_lt"])
        b.add(prim_cyl(0.33, 0.33, 0.05, 20, 0.0, 2), matrix=M @ Matrix.Translation((0, -0.425, 0.04)) @ Matrix.Rotation(math.radians(90), 4, "X"),
              color=WORLD_COL[3], jit=0.1, nz=0)
    # exposed wires / rebar at both broken ends
    for sgn, ang0 in ((1, a0), (-1, a0 + arc)):
        a = math.radians(ang0)
        end = Vector((R_MID * math.cos(a), R_MID * math.sin(a), RING_D / 2 - 0.12))
        out = Vector((math.sin(a), -math.cos(a), 0)) * (-1 if ang0 == a0 else 1)
        out = Vector((math.sin(a), -math.cos(a), 0))
        if ang0 != a0:
            out = -out
        # tangent pointing out of the piece
        t_out = Vector((math.sin(a), -math.cos(a), 0)) * (1 if ang0 == a0 else -1)
        t_out = Vector((math.sin(a), -math.cos(a), 0)) if ang0 == a0 else Vector((-math.sin(a), math.cos(a), 0))
        radial = Vector((math.cos(a), math.sin(a), 0))
        for j in range(5):
            off = radial * ((j - 2) * 0.22) + Vector((0, 0, (j % 2) * 0.25 - 0.1))
            b.rod(end + off - t_out * 0.1, end + off + t_out * (0.5 + 0.3 * ((j * 7) % 5) / 4.0) + Vector((0, 0, 0.1 * j)),
                  0.045, n=5, color=C["orange_dk"] if j % 2 == 0 else "#4A4570", nz=0, jit=0.3)
    # a loose cable curling out of one end
    a = math.radians(a0 + arc)
    st = Vector((R_MID * math.cos(a), R_MID * math.sin(a), 0.5))
    tout = Vector((-math.sin(a), math.cos(a), 0))
    pts = [st, st + tout * 0.8 + Vector((0, 0, 0.3)), st + tout * 1.6 + Vector((0.3, 0.2, 0.0)), st + tout * 2.2 + Vector((0.2, 0.7, -0.35))]
    b.add(prim_sweep(catmull(pts, 5), circle_prof(0.12, 6), None, False, None, True), color="#4A4570", nz=0.02)
    # tilt to sit crooked in the dirt
    M = Matrix.Rotation(math.radians(cfg["tilt"][0]), 4, "X") @ Matrix.Rotation(math.radians(cfg["tilt"][1]), 4, "Y")
    for v in b.bm.verts:
        v.co = (M @ v.co.to_4d()).to_3d()
    main = b.to_object(aid)
    return finish(man, aid, main, category="debris", worlds=["hub"], collision="convex", scatter=None, ao=0.45,
                  origin="bbox_base",
                  extra={"note": "lies flat on the ground; same ring profile as hub_loom_core (radius_mid 5.0, width 1.3, depth 1.0)",
                         "arc_deg": arc, "has_socket": cfg["sock"]},
                  views=[("top", dict(azim=-30, elev=60))])


REGISTRY = {
    "hub_loom_core": build_loom,
    "hub_loom_ring_fragment_a": lambda man: build_fragment(man, "a"),
    "hub_loom_ring_fragment_b": lambda man: build_fragment(man, "b"),
    "hub_loom_ring_fragment_c": lambda man: build_fragment(man, "c"),
}
