"""Recalculate outward normals for listed glbs in place (keeps vertex colors/materials).
   blender -b --factory-startup --python tools/fix_normals.py -- path1.glb path2.glb"""
import bpy, bmesh, sys
for f in sys.argv[sys.argv.index("--") + 1:]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=f)
    objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in objs:
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(o.data); bm.free()
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=f, export_format="GLB", use_selection=True, export_vertex_color="ACTIVE",
                              export_yup=True, export_materials="EXPORT")
    print("FIXED", f)
