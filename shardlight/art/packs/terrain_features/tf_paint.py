"""World palettes + painterly vertex-color rules for rock-like surfaces."""
import random
from mathutils import Vector
import sl_common as sl
from tf_core import fbm, clamp, smoothstep, mix3, lit, paint, lerp

# low/mid/high = height gradient of the stone; top/top2 = cap tint (moss, sand, ash, snow); base = dirt at the foot
PAL = {
    "verdant": dict(low="#7C78B8", mid="#A3A9D6", high="#D2D6F6", top="#6FD14F", top2="#C6F57E", base="#8A5A44",
                    shadow="#6B5BD6", accent="#FF7AA8"),
    "amber": dict(low="#B25643", mid="#C4644F", high="#EBA062", top="#F5B971", top2="#FFDDA6", base="#8F4B45",
                  shadow="#7A4A8C", accent="#2A9D8F"),
    "ember": dict(low="#1D1727", mid="#2B2238", high="#5C4D69", top="#6E6077", top2="#968AA0", base="#14101C",
                  shadow="#3A1E4D", accent="#FF5A1F"),
    "glass": dict(low="#8FA6E6", mid="#BDEBFF", high="#E6F4FF", top="#F7FAFF", top2="#FFFFFF", base="#7C8FD6",
                  shadow="#4656A8", accent="#C9B6FF"),
    "hub": dict(low="#666C94", mid="#8C93B5", high="#C9CEE6", top="#6FBF73", top2="#9ADB8E", base="#55507E",
                shadow="#5B4BB0", accent="#9D6BFF"),
    "hollow": dict(low="#2A1650", mid="#4B2A7B", high="#7B52B8", top="#5B8F4F", top2="#86C26F", base="#1A1030",
                   shadow="#24113F", accent="#3DFFD8"),
}


def zrange(obj):
    zs = [v.co.z for v in obj.data.vertices]
    return min(zs), max(zs)


def paint_rock(obj, pal, seed=0, top_thr=0.5, top_str=0.9, noise=0.05, dirt=0.18, vein=None, part_jit=0.0,
               lit_amt=0.22, strata=None, zr=None, hue_shift=0.0, top_noise=0.35):
    """pal: dict from PAL. vein=(color, scale, thr). strata=(band_h, [colors]) paints horizontal sediment bands."""
    zlo, zhi = zr or zrange(obj)
    span = max(zhi - zlo, 1e-4)
    rng_cache = {}

    def fn(co, n, pn, mi, pid):
        t = (co.z - zlo) / span
        c = mix3(pal["low"], pal["mid"], pal["high"], clamp(t * 1.05))
        if strata:
            bh, cols = strata
            bi = co.z / bh + 0.35 * fbm(co * 0.35, seed + 11)
            k = int(bi // 1) % len(cols)
            k2 = (k + 1) % len(cols)
            f = bi % 1.0
            sc = sl.mix(cols[k], cols[k2], smoothstep(0.7, 1.0, f))
            c = sl.mix(c, sc, 0.85)
        k = fbm(co * 0.7, seed) * noise * 2.0
        c = tuple(clamp(x + k, 0, 1) for x in c)
        # facet-to-facet value variation: readable planes
        fv = (pn.x * 0.5 + pn.y * 0.3) * 0.06
        c = tuple(clamp(x + fv, 0, 1) for x in c)
        if part_jit:
            if pid not in rng_cache:
                rg = random.Random(pid * 77 + seed)
                rng_cache[pid] = (rg.uniform(-1, 1), rg.uniform(-1, 1))
            a, b = rng_cache[pid]
            c = tuple(clamp(x * (1 + a * part_jit) + b * part_jit * 0.3, 0, 1) for x in c)
        if dirt and t < 0.2:
            c = sl.mix(c, pal["base"], (1 - smoothstep(0.0, 0.2, t)) * dirt * 2.2)
        if vein:
            vc, vs, vt = vein
            r = abs(fbm(co * vs, seed + 5, 2))
            if r < vt:
                c = sl.mix(c, vc, smoothstep(vt, vt * 0.3, r))
        if top_str:
            nz = n.z * 0.65 + pn.z * 0.35 + top_noise * fbm(co * 2.1, seed + 3)
            w = smoothstep(top_thr, top_thr + 0.3, nz) * top_str
            if w > 0:
                tc = sl.mix(pal["top"], pal["top2"], clamp(0.5 + fbm(co * 1.7, seed + 5) * 1.6))
                c = sl.mix(c, tc, w)
        nn = (n * 0.6 + pn * 0.4)
        if nn.length > 1e-6:
            nn.normalize()
        return lit(c, nn, lit_amt)

    paint(obj, fn)
