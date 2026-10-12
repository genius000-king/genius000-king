class_name Props
## Placement helpers for level content: assets with collision, snapped to terrain.

static func place(parent: Node3D, field: TerrainField, id: String, x: float, z: float, yaw_deg := 0.0, scale := 1.0, y_offset := 0.0, snap := true) -> Node3D:
	if not AssetDB.has(id):
		push_warning("Props: missing asset " + id)
		return null
	var n := AssetDB.instantiate(id)
	var y := field.height_at(x, z) if snap else 0.0
	n.position = Vector3(x, y + y_offset, z)
	n.rotation_degrees.y = yaw_deg
	n.scale = Vector3.ONE * scale
	parent.add_child(n)
	var shp := AssetDB.shape(id)
	if shp:
		var body := StaticBody3D.new()
		body.collision_layer = 1
		var cs := CollisionShape3D.new()
		cs.shape = shp
		cs.transform = AssetDB.shape_offset(id)
		body.add_child(cs)
		n.add_child(body)
		var e := AssetDB.entry(id)
		var cat: String = e.get("category", "")
		if "town" in id or cat in ["building", "prop"]:
			body.set_meta("surface", "wood")
		elif "hub_" in id:
			body.set_meta("surface", "metal")
		else:
			body.set_meta("surface", "stone")
	return n


static func ring(parent: Node3D, field: TerrainField, ids: Array, center: Vector2, radius: float, count: int, seed := 1, face_center := true, scale_range := Vector2(1, 1)) -> Array:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	var out := []
	for i in count:
		var a := TAU * float(i) / count + rng.randf_range(-0.15, 0.15)
		var p := center + Vector2(cos(a), sin(a)) * radius * rng.randf_range(0.9, 1.1)
		var yaw := rad_to_deg(atan2(center.x - p.x, center.y - p.y)) if face_center else rng.randf() * 360.0
		var id: String = ids[i % ids.size()]
		var n := place(parent, field, id, p.x, p.y, yaw, rng.randf_range(scale_range.x, scale_range.y))
		if n:
			out.append(n)
	return out
