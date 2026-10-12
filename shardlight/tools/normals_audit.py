import bpy, glob, os, sys
root = "/home/user/genius000-king/shardlight/game/assets/models"
bad = []
files = sorted(glob.glob(root + "/*/*.glb")) if len(sys.argv) < 5 else sys.argv[sys.argv.index("--")+1:]
for f in files:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try:
        bpy.ops.import_scene.gltf(filepath=f)
    except Exception as e:
        print("ERR", f, e); continue
    vol = 0.0; area_in = 0.0; area = 0.0
    for o in bpy.context.scene.objects:
        if o.type != 'MESH': continue
        me = o.data; me.calc_loop_triangles()
        mw = o.matrix_world
        c = sum((mw @ v.co for v in me.vertices), mw @ me.vertices[0].co * 0) / max(len(me.vertices), 1)
        for t in me.loop_triangles:
            a, b, cc = (mw @ me.vertices[i].co for i in t.vertices)
            vol += a.dot(b.cross(cc)) / 6.0
            n = (b - a).cross(cc - a)
            ar = n.length / 2
            area += ar
            cen = (a + b + cc) / 3
            if n.dot(cen - c) < 0: area_in += ar
    frac = area_in / area if area else 0
    if vol < 0 or frac > 0.6:
        bad.append((os.path.relpath(f, root), round(vol, 3), round(frac, 2)))
print("AUDITED", len(files))
for b in bad: print("SUSPECT", *b)
