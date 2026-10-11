"""Crystal clusters (EMIT core + GLASS shell, rock mound) for every world + reusable crystal builder."""
import math
import random
from mathutils import Vector, Matrix
import sl_common as sl
from tf_core import *
from tf_paint import PAL, paint_rock


def basis_matrix(origin, direction, roll=0.0):
    d = Vector(direction).normalized()
    q = d.to_track_quat("Z", "Y")
    M = q.to_matrix().to_4x4()
    M = M @ Matrix.Rotation(roll, 4, "Z")
    M.translation = Vector(origin)
    return M


class CrystalSet:
    """Collects crystals into an MB and remembers (origin, axis, L) per part so the painter can do base->tip gradients."""

    def __init__(self, mb):
        self.mb = mb
        self.info = {}

    def add(self, origin, direction, L, r, seed, shell="GLASS", core_ratio=0.5, sides=6, base_part=None, skew=0.0):
        mb = self.mb
        rng = random.Random(seed)
        d = Vector(direction).normalized()
        M = basis_matrix(origin, d, rng.uniform(0, 6.28))
        pid = base_part or (1000 + len(self.info) * 2)
        body = [(-0.15 * L, r * 0.8), (0.0, r * 0.92), (0.7 * L, r)]
        if shell:
            mb.column(body, sides=sides, seed=seed, jit=0.05, top="point", apex=0.3 * L, lean=(skew, 0), M=M,
                      mat=shell, part=pid)
            self.info[pid] = (Vector(origin), d, L)
        if core_ratio:
            cr = r * core_ratio
            mb.column([(0.04 * L, cr * 0.8), (0.12 * L, cr), (0.66 * L, cr * 0.95)], sides=sides, seed=seed, jit=0.05,
                      top="point", apex=0.22 * L, lean=(skew * 0.9, 0), M=M, mat="EMIT", part=pid + 1,
                      rot0=0.0)
            self.info[pid + 1] = (Vector(origin), d, L)
        if not shell and not core_ratio:
            pass
        return pid


def cluster(cs, n, size, spread, seed, tall=1.0, lean_max=38, shell="GLASS", core_ratio=0.5, thick=0.17, origin=(0, 0, 0),
            axis=(0, 0, 1)):
    """A fan of crystals around a base point. size = tallest length (m)."""
    rng = random.Random(seed)
    ax = Vector(axis).normalized()
    # tangent basis
    t1 = ax.cross(Vector((0, 0, 1)) if abs(ax.z) < 0.9 else Vector((1, 0, 0))).normalized()
    t2 = ax.cross(t1)
    org = Vector(origin)
    for i in range(n):
        if i == 0:
            off, a, lean = Vector((0, 0)), 0, rng.uniform(0, 8)
            L = size
        else:
            a = rng.uniform(0, 6.28) + i * 2.4
            rr = spread * rng.uniform(0.3, 1.0)
            off = Vector((math.cos(a) * rr, math.sin(a) * rr))
            lean = lean_max * (rr / max(spread, 1e-3)) * rng.uniform(0.6, 1.1) + rng.uniform(0, 8)
            L = size * rng.uniform(0.3, 0.8) * tall ** (0.5)
        la = math.radians(lean)
        dirv = ax * math.cos(la) + (t1 * math.cos(a) + t2 * math.sin(a)) * math.sin(la)
        pos = org + t1 * off.x + t2 * off.y
        r = max(0.06, thick * L * rng.uniform(0.85, 1.15) ** 1.0) if thick > 0.02 else 0.1
        r = min(r, size * 0.16)
        cs.add(pos, dirv, L, r, seed * 10 + i, shell=shell, core_ratio=core_ratio, sides=6 if rng.random() < 0.8 else 5)


def paint_crystals(o, cs, cols, pal, seed, mound_args=None):
    """cols: dict(shell_lo, shell_hi, core_lo, core_hi)."""
    names = [m.name for m in o.data.materials]
    pal_rock = PAL[pal]
    # rock first (so mound gets the standard rock paint), crystals override
    kw = dict(top_thr=0.5, top_str=0.5)
    kw.update(mound_args or {})
    paint_rock(o, pal_rock, seed, **kw)
    me = o.data
    attr = sl.ensure_colors(o)
    part = me.attributes["part"]
    verts = me.vertices
    for poly in me.polygons:
        nm = names[poly.material_index]
        if nm not in ("GLASS", "EMIT"):
            continue
        pid = part.data[poly.index].value
        info = cs.info.get(pid)
        for li in poly.loop_indices:
            v = verts[me.loops[li].vertex_index]
            if info:
                org, d, L = info
                t = clamp(((v.co - org).dot(d)) / max(L, 1e-3))
            else:
                t = clamp(v.co.z / 5.0)
            if nm == "GLASS":
                c = sl.mix(cols["shell_lo"], cols["shell_hi"], t ** 0.9)
                c = lit(tuple(clamp(x * 1.12 + 0.03) for x in c), v.normal, 0.03, 0.1)
            else:
                c = sl.mix(cols["core_lo"], cols["core_hi"], t ** 0.8)
            sl._write_corner(attr, li, c)


def crystal_cluster_obj(world, n, size, spread, seed, cols, mound=1.0, tall=1.0, lean_max=38, thick=0.17,
                        mound_squash=0.32, shell="GLASS", core_ratio=0.5, mound_planes=7, extra_chips=3,
                        mound_pal=None):
    mb = MB(("VC_ROUGH", "EMIT", "GLASS"))
    cs = CrystalSet(mb)
    rk = max(spread * 1.25, size * 0.28) * mound
    mb.rock(size=(rk * 1.15, rk, rk * mound_squash * 1.6), seed=seed, subdiv=3, noise_amp=0.14, planes=mound_planes,
            soft=0.1, plane_off=(0.68, 0.93), flat_bottom=0.5, M=xf((0, 0, rk * mound_squash * 0.5)), part=500)
    rng = random.Random(seed + 3)
    for i in range(extra_chips):
        a = rng.uniform(0, 6.28)
        k = rk * rng.uniform(0.18, 0.3)
        mb.rock(size=(k * 1.3, k, k * 0.7), seed=seed + 40 + i, subdiv=2, noise_amp=0.12, planes=5, soft=0.08,
                flat_bottom=0.4, M=xf((math.cos(a) * rk * 1.25, math.sin(a) * rk * 1.2, 0), (0, 0, rng.uniform(0, 360))),
                part=510 + i)
    cluster(cs, n, size, spread, seed, tall=tall, lean_max=lean_max, shell=shell, core_ratio=core_ratio, thick=thick,
            origin=(0, 0, rk * mound_squash * 0.9))
    o = mb.build("crystal", angle=30)
    # crystals are faceted
    for poly in o.data.polygons:
        if o.data.materials[poly.material_index].name in ("GLASS", "EMIT"):
            poly.use_smooth = False
    paint_crystals(o, cs, cols, mound_pal or world, seed)
    return o


COLS = {
    "amber": dict(shell_lo="#3CC8B4", shell_hi="#B8FFF2", core_lo="#52E0C8", core_hi="#7DF9E0"),
    "amber_rose": dict(shell_lo="#E0857A", shell_hi="#FFD6CE", core_lo="#F2A7A0", core_hi="#FFE0A8"),
    "glass": dict(shell_lo="#A9BFFF", shell_hi="#E9E0FF", core_lo="#B46CFF", core_hi="#C9B6FF"),
    "glass_ice": dict(shell_lo="#8FD8FF", shell_hi="#F7FAFF", core_lo="#6CFFC8", core_hi="#BDEBFF"),
    "hollow": dict(shell_lo="#35D9BE", shell_hi="#9FFFEA", core_lo="#22D9B6", core_hi="#3DFFD8"),
    "hollow_pink": dict(shell_lo="#B24A9A", shell_hi="#FFC2EC", core_lo="#FF6FCF", core_hi="#FF8AD8"),
    "hub": dict(shell_lo="#8458F0", shell_hi="#D8C4FF", core_lo="#8A55F0", core_hi="#9D6BFF"),
    "ember": dict(shell_lo="#E0218A", shell_hi="#FFD98A", core_lo="#FF8A2A", core_hi="#FFC23D"),
    "verdant": dict(shell_lo="#59C6E8", shell_hi="#D4F7FF", core_lo="#FF7AA8", core_hi="#7AE7FF"),
}


def build_crystals(rec, only=None):
    jobs = [
        # id, world, mound pal, cols, kwargs, size_class, scatter
        ("amber_crystal_cluster_a", "amber", "amber", "amber", dict(n=8, size=1.7, spread=0.7, seed=301), "small",
         scatter(0.5, 35, 6, 0.5, "cave")),
        ("amber_crystal_cluster_b", "amber", "amber", "amber_rose", dict(n=11, size=1.1, spread=0.7, seed=302, lean_max=62, tall=0.8), "small",
         scatter(0.5, 35, 6, 0.5, "any")),
        ("amber_crystal_landmark", "amber", "amber", "amber", dict(n=16, size=10.0, spread=2.8, seed=303, lean_max=28, mound=1.3, extra_chips=6, thick=0.21), "landmark", None),
        ("glass_crystal_cluster_a", "glass", "glass", "glass", dict(n=9, size=2.2, spread=0.9, seed=311), "medium",
         scatter(0.4, 35, 7, 0.4, "any")),
        ("glass_crystal_cluster_b", "glass", "glass", "glass_ice", dict(n=7, size=3.6, spread=0.8, seed=312, lean_max=22, thick=0.13), "medium",
         scatter(0.3, 35, 8, 0.4, "any")),
        ("glass_crystal_landmark", "glass", "glass", "glass", dict(n=15, size=10.0, spread=2.6, seed=313, lean_max=24, mound=1.25, thick=0.19, extra_chips=6), "landmark", None),
        ("hollow_crystal_cluster_a", "hollow", "hollow", "hollow", dict(n=9, size=1.4, spread=0.6, seed=321), "small",
         scatter(0.8, 35, 5, 0.6, "cave")),
        ("hollow_crystal_cluster_b", "hollow", "hollow", "hollow_pink", dict(n=7, size=1.2, spread=0.55, seed=322, lean_max=50), "small",
         scatter(0.6, 35, 5, 0.6, "cave")),
        ("hollow_crystal_cluster_c", "hollow", "hollow", "hollow", dict(n=14, size=4.2, spread=1.6, seed=323, lean_max=34, mound=1.2), "large", None),
        ("hub_crystal_cluster_a", "hub", "hub", "hub", dict(n=8, size=2.0, spread=0.8, seed=331), "medium",
         scatter(0.3, 35, 8, 0.4, "any")),
        ("hub_crystal_cluster_b", "hub", "hub", "hub", dict(n=13, size=5.5, spread=1.8, seed=332, lean_max=26, mound=1.3, thick=0.15), "large", None),
        ("ember_crystal_cluster_a", "ember", "ember", "ember", dict(n=9, size=1.9, spread=0.8, seed=341), "medium",
         scatter(0.4, 35, 7, 0.4, "any")),
        ("verdant_crystal_cluster_a", "verdant", "verdant", "verdant", dict(n=8, size=1.2, spread=0.6, seed=351), "small",
         scatter(0.3, 35, 8, 0.4, "cave")),
    ]
    for id_, world, mpal, ckey, kw, sc, scat in jobs:
        if only and not any(o in id_ for o in only):
            continue
        fresh()
        kw = dict(kw)
        o = crystal_cluster_obj(world, kw.pop("n"), kw.pop("size"), kw.pop("spread"), kw.pop("seed"), COLS[ckey],
                                mound_pal=mpal, **kw)
        e = finish([o], id_, "crystal", [world], {"type": "convex"}, scat, ao=0.4, ao_dist=1.0 if sc == "small" else None,
                   preview_kw=dict(elev=16, azim=-30, frame=1.05),
                   extra={"family": "crystal", "size_class": sc, "emit_color": "#" + "".join("%02X" % int(c * 255) for c in sl.hex_rgb(COLS[ckey]["core_hi"]))})
        rec.add(e)
