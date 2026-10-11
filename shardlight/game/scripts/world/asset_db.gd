class_name AssetDB
## Loads model pack manifests (game/assets/models/<pack>/manifest.json) and gives meshes/scenes/collision.

const MODELS_DIR := "res://assets/models"

static var _loaded := false
static var assets := {}          # id -> entry (with "pack" and "path")
static var _parts_cache := {}    # id -> Array[{mesh, xform}]
static var _shape_cache := {}    # id -> Shape3D
static var _scene_cache := {}    # id -> PackedScene


static func load_all() -> void:
	if _loaded:
		return
	_loaded = true
	var dir := DirAccess.open(MODELS_DIR)
	if dir == null:
		push_warning("AssetDB: no models dir")
		return
	for pack in dir.get_directories():
		if pack.begins_with("_"):
			continue
		var mpath := "%s/%s/manifest.json" % [MODELS_DIR, pack]
		if not FileAccess.file_exists(mpath):
			continue
		var data = JSON.parse_string(FileAccess.get_file_as_string(mpath))
		if typeof(data) != TYPE_DICTIONARY:
			push_warning("AssetDB: bad manifest " + mpath)
			continue
		for a in data.get("assets", []):
			var e: Dictionary = a.duplicate(true)
			e["pack"] = pack
			e["path"] = "%s/%s/%s" % [MODELS_DIR, pack, a.file]
			if not ResourceLoader.exists(e.path):
				continue
			assets[e.id] = e


static func has(id: String) -> bool:
	load_all()
	return assets.has(id)


static func entry(id: String) -> Dictionary:
	load_all()
	return assets.get(id, {})


static func scatter_candidates(world: String, zone: String) -> Array:
	load_all()
	var out := []
	for id in assets:
		var e: Dictionary = assets[id]
		var sc = e.get("scatter")
		if sc == null or typeof(sc) != TYPE_DICTIONARY:
			continue
		var ws: Array = e.get("worlds", [])
		if not (world in ws or "common" in ws or "all" in ws):
			continue
		var z: String = sc.get("zone", "any")
		if z == zone or z == "any":
			out.append(e)
	return out


static func scene(id: String) -> PackedScene:
	load_all()
	if _scene_cache.has(id):
		return _scene_cache[id]
	var e := entry(id)
	if e.is_empty():
		return null
	var ps := load(e.path) as PackedScene
	_scene_cache[id] = ps
	return ps


static func instantiate(id: String) -> Node3D:
	var ps := scene(id)
	if ps == null:
		push_warning("AssetDB: missing asset " + id)
		return null
	var n := ps.instantiate() as Node3D
	Stylizer.stylize_tree(n)
	return n


static func parts(id: String) -> Array:
	## Flattened [{mesh: Mesh, xform: Transform3D}] for MultiMesh scattering.
	if _parts_cache.has(id):
		return _parts_cache[id]
	var out := []
	var ps := scene(id)
	if ps:
		var root := ps.instantiate() as Node3D
		for mi in root.find_children("*", "MeshInstance3D", true, false):
			var m := mi as MeshInstance3D
			if m.mesh == null:
				continue
			Stylizer.stylize_mesh(m.mesh)
			var xf := Transform3D.IDENTITY
			var n: Node = m
			while n != null and n != root:
				xf = (n as Node3D).transform * xf
				n = n.get_parent()
			out.append({"mesh": m.mesh, "xform": xf, "height": m.get_aabb().size.y})
		root.free()
	_parts_cache[id] = out
	return out


static func shape(id: String) -> Shape3D:
	if _shape_cache.has(id):
		return _shape_cache[id]
	var e := entry(id)
	var col: Dictionary = e.get("collision", {"type": "none"})
	var s: Shape3D = null
	match col.get("type", "none"):
		"cylinder":
			var c := CylinderShape3D.new()
			c.radius = col.get("radius", 0.4)
			c.height = col.get("height", 3.0)
			s = c
		"box":
			var b := BoxShape3D.new()
			var sz: Array = col.get("size", [1, 1, 1])
			b.size = Vector3(sz[0], sz[1], sz[2])
			s = b
		"convex":
			var ps := parts(id)
			if ps.size() > 0:
				var pts := PackedVector3Array()
				for p in ps:
					var arr: Array = (p.mesh as Mesh).surface_get_arrays(0)
					for v in arr[Mesh.ARRAY_VERTEX]:
						pts.append(p.xform * v)
				var cs := ConvexPolygonShape3D.new()
				# decimate point cloud for speed
				if pts.size() > 400:
					var step := int(ceilf(pts.size() / 400.0))
					var red := PackedVector3Array()
					for i in range(0, pts.size(), step):
						red.append(pts[i])
					pts = red
				cs.points = pts
				s = cs
		"trimesh":
			var ps2 := parts(id)
			var faces := PackedVector3Array()
			for p in ps2:
				var tm: Mesh = p.mesh
				for si in tm.get_surface_count():
					var fa := tm.surface_get_arrays(si)
					var verts: PackedVector3Array = fa[Mesh.ARRAY_VERTEX]
					var idx = fa[Mesh.ARRAY_INDEX]
					if idx != null and idx.size() > 0:
						for i in idx:
							faces.append(p.xform * verts[i])
					else:
						for v in verts:
							faces.append(p.xform * v)
			if faces.size() > 0:
				var cps := ConcavePolygonShape3D.new()
				cps.set_faces(faces)
				s = cps
	_shape_cache[id] = s
	return s


static func shape_offset(id: String) -> Transform3D:
	## cylinder/box shapes are centered; lift them so they sit on the ground.
	var e := entry(id)
	var col: Dictionary = e.get("collision", {})
	match col.get("type", "none"):
		"cylinder":
			return Transform3D(Basis.IDENTITY, Vector3(0, col.get("height", 3.0) * 0.5, 0))
		"box":
			var sz: Array = col.get("size", [1, 1, 1])
			return Transform3D(Basis.IDENTITY, Vector3(0, sz[1] * 0.5, 0))
	return Transform3D.IDENTITY
