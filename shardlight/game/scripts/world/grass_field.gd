class_name GrassField
extends Node3D
## Dense field grass around the player: 16 m tiles of MultiMesh clumps, rebuilt as the player moves.

const TILE := 16.0

var field: TerrainField
var focus: Node3D
var radius := 56.0
var density := 1.0          # clumps per m² multiplier
var clump_mesh: ArrayMesh
var material: ShaderMaterial
var _tiles := {}            # Vector2i -> MultiMeshInstance3D
var _queue := []
var _pending := {}
var _results := []
var _mutex := Mutex.new()


func setup(p_field: TerrainField, p_focus: Node3D, grass_def: Dictionary) -> void:
	field = p_field
	focus = p_focus
	radius = Settings.grass_radius()
	density = Settings.grass_density() * float(grass_def.get("density", 1.0))
	clump_mesh = _make_clump(float(grass_def.get("height", 0.8)))
	material = ShaderMaterial.new()
	material.shader = preload("res://shaders/grass.gdshader")
	material.set_shader_parameter("brush_tex", Stylizer.brush_texture())
	material.set_shader_parameter("base_color", grass_def.base)
	material.set_shader_parameter("tip_color", grass_def.tip)
	material.set_shader_parameter("alt_tip_color", grass_def.alt)
	material.set_shader_parameter("fade_start", radius * 0.7)
	material.set_shader_parameter("fade_end", radius)
	clump_mesh.surface_set_material(0, material)


func _make_clump(height: float) -> ArrayMesh:
	## 7 curved, tapered blades in a loose tuft; 4 segments each.
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rng := RandomNumberGenerator.new()
	rng.seed = 42
	var blades := 11
	for b in blades:
		var ang := rng.randf() * TAU
		var off := Vector3(cos(ang), 0, sin(ang)) * rng.randf_range(0.0, 0.32)
		var face := rng.randf() * TAU
		var dir := Vector3(cos(face), 0, sin(face))
		var side := Vector3(-dir.z, 0, dir.x)
		var h := height * rng.randf_range(0.4, 0.95)
		var lean := rng.randf_range(0.08, 0.35)
		var wbase := rng.randf_range(0.022, 0.036)
		var segs := 3
		var prev_l := Vector3.ZERO
		var prev_r := Vector3.ZERO
		for s in segs + 1:
			var t := float(s) / segs
			var center := off + dir * lean * t * t * h + Vector3(0, h * t, 0)
			var wdt := wbase * (1.0 - t * 0.92)
			var l := center - side * wdt
			var r := center + side * wdt
			if s > 0:
				var n := (r - prev_l).cross(prev_r - prev_l).normalized()
				if n.y < 0:
					n = -n
				for v in [prev_l, prev_r, r, prev_l, r, l]:
					st.set_normal(n)
					st.add_vertex(v)
			prev_l = l
			prev_r = r
	return st.commit()


func _process(_d: float) -> void:
	if focus == null:
		return
	var fp := focus.global_position
	var c := Vector2i(floori(fp.x / TILE), floori(fp.z / TILE))
	var rt := int(ceilf(radius / TILE))
	var want := {}
	for j in range(c.y - rt, c.y + rt + 1):
		for i in range(c.x - rt, c.x + rt + 1):
			var cc := Vector2((i + 0.5) * TILE, (j + 0.5) * TILE)
			if cc.distance_to(Vector2(fp.x, fp.z)) < radius + TILE * 0.75:
				want[Vector2i(i, j)] = true
	for k in _tiles.keys():
		if not want.has(k):
			if is_instance_valid(_tiles[k]):
				_tiles[k].queue_free()
			_tiles.erase(k)
	for k in want:
		if _tiles.has(k) or _pending.has(k):
			continue
		if _pending.size() >= 3:
			break
		_pending[k] = WorkerThreadPool.add_task(_build_tile.bind(k))
	var budget := 2
	while budget > 0:
		var r = null
		_mutex.lock()
		if _results.size() > 0:
			r = _results.pop_front()
		_mutex.unlock()
		if r == null:
			break
		_finalize(r)
		budget -= 1
	for k in _pending.keys():
		if WorkerThreadPool.is_task_completed(_pending[k]):
			WorkerThreadPool.wait_for_task_completion(_pending[k])
			_pending.erase(k)


func _exit_tree() -> void:
	for k in _pending.keys():
		WorkerThreadPool.wait_for_task_completion(_pending[k])
	_pending.clear()


func _build_tile(key: Vector2i) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = (key.x * 92837111) ^ (key.y * 689287499) ^ 1337
	var ox := key.x * TILE
	var oz := key.y * TILE
	var count := int(TILE * TILE * 3.2 * density)
	var xfs := []
	var customs := []
	var colors := []
	for i in count:
		var x := ox + rng.randf() * TILE
		var z := oz + rng.randf() * TILE
		var h := field.height_at(x, z)
		var n := field.normal_at(x, z, 0.8)
		var w := field.grass_weight(x, z, h, n)
		if w <= 0.0 or rng.randf() > w:
			continue
		var s := rng.randf_range(0.8, 1.25)
		var basis := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(s, s, s))
		basis = Basis(Quaternion(Vector3.UP, Vector3.UP.slerp(n, 0.5))) * basis
		xfs.append(Transform3D(basis, Vector3(x, h - 0.03, z)))
		customs.append(Color(rng.randf(), rng.randf_range(0.7, 1.15) * clampf(w + 0.3, 0.5, 1.0), rng.randf(), rng.randf()))
		colors.append(field.color_at(x, z, h, n).srgb_to_linear())
	_mutex.lock()
	_results.append({"key": key, "xfs": xfs, "customs": customs, "colors": colors})
	_mutex.unlock()


func _finalize(r: Dictionary) -> void:
	var xfs: Array = r.xfs
	if xfs.is_empty():
		_tiles[r.key] = null
		return
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	mm.use_colors = true
	mm.mesh = clump_mesh
	mm.instance_count = xfs.size()
	for i in xfs.size():
		mm.set_instance_transform(i, xfs[i])
		mm.set_instance_custom_data(i, r.customs[i])
		mm.set_instance_color(i, r.colors[i])
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mmi)
	_tiles[r.key] = mmi
