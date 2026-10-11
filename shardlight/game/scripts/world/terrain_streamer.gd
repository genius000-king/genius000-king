class_name TerrainStreamer
extends Node3D
## Streams terrain chunks around a focus point. Heights, colors and scatter placements are computed on
## worker threads; node creation happens on the main thread with a per-frame budget.

signal initial_area_ready

const CHUNK := 64.0
const LODS := [
	{"dist": 170.0, "step": 2.0},
	{"dist": 380.0, "step": 4.0},
	{"dist": 99999.0, "step": 8.0},
]
const SKIRT := 6.0
const COLLISION_RADIUS := 150.0
const SCATTER_LOD_MAX := 1

const ZONE_FILL := {
	"meadow": 0.16, "forest": 0.62, "shore": 0.10, "cliff": 0.07, "plaza": 0.035, "path": 0.015,
}
const VIS_RANGE := {
	"tree": 420.0, "rock": 300.0, "cliff": 900.0, "landmark": 1500.0, "bush": 180.0, "flower": 90.0,
	"grass": 70.0, "ground_cover": 70.0, "hanging": 200.0, "log": 200.0, "crystal": 320.0, "default": 220.0,
}

var world_id := "verdant"
var field: TerrainField
var focus: Node3D
var view_radius := 640.0
var scatter_enabled := true
var material: ShaderMaterial

var _chunks := {}            # Vector2i -> Dictionary
var _pending := {}           # Vector2i -> task id
var _results := []           # finished build data waiting for main-thread finalize
var _mutex := Mutex.new()
var _zone_candidates := {}
var _initial_emitted := false
var _max_tasks := 3


func setup(p_world_id: String, p_field: TerrainField, p_focus: Node3D) -> void:
	world_id = p_world_id
	field = p_field
	focus = p_focus
	view_radius = Settings.view_distance()
	scatter_enabled = Settings.scatter_enabled()
	_max_tasks = max(2, OS.get_processor_count() - 1)
	material = Stylizer.material("TERRAIN", {"saturation": 1.1}).duplicate()
	material.set_shader_parameter("brush_tex", Stylizer.brush_texture())
	AssetDB.load_all()
	for zn in ZONE_FILL.keys():
		var cands := AssetDB.scatter_candidates(world_id, zn)
		# warm the mesh/shape caches on the main thread (resource loading is not thread-friendly here)
		for e in cands:
			AssetDB.parts(e.id)
			AssetDB.shape(e.id)
		_zone_candidates[zn] = cands


func height_at(x: float, z: float) -> float:
	return field.height_at(x, z)


func _process(_delta: float) -> void:
	if field == null or focus == null:
		return
	var fp := focus.global_position
	var center := Vector2i(floori(fp.x / CHUNK), floori(fp.z / CHUNK))
	var rad_chunks := int(ceilf(view_radius / CHUNK))
	# 1) collect desired chunks
	var wanted := []
	for cz in range(center.y - rad_chunks, center.y + rad_chunks + 1):
		for cx in range(center.x - rad_chunks, center.x + rad_chunks + 1):
			var cc := Vector2((cx + 0.5) * CHUNK, (cz + 0.5) * CHUNK)
			var d := cc.distance_to(Vector2(fp.x, fp.z))
			if d > view_radius + CHUNK:
				continue
			if cc.length() > field.radius * 1.12 + CHUNK:
				continue
			var lod := _lod_for(d)
			wanted.append([d, Vector2i(cx, cz), lod])
	wanted.sort_custom(func(a, b): return a[0] < b[0])
	var wanted_keys := {}
	for w in wanted:
		wanted_keys[w[1]] = w[2]
	# 2) remove far chunks
	for key in _chunks.keys():
		if not wanted_keys.has(key):
			var c: Dictionary = _chunks[key]
			if is_instance_valid(c.node):
				c.node.queue_free()
			_chunks.erase(key)
	# 3) schedule builds (new chunks or lod changes), nearest first
	for w in wanted:
		if _pending.size() >= _max_tasks:
			break
		var key: Vector2i = w[1]
		var lod: int = w[2]
		if _pending.has(key):
			continue
		var need_collision: bool = w[0] < COLLISION_RADIUS
		if _chunks.has(key):
			var c: Dictionary = _chunks[key]
			if c.lod == lod and (c.has_collision or not need_collision):
				continue
		var tid := WorkerThreadPool.add_task(_build_chunk.bind(key, lod, need_collision))
		_pending[key] = tid
	# 4) finalize finished results (budgeted)
	var budget := 3
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
	# clean finished task ids
	for key in _pending.keys():
		if WorkerThreadPool.is_task_completed(_pending[key]):
			WorkerThreadPool.wait_for_task_completion(_pending[key])
			_pending.erase(key)
	if not _initial_emitted and _pending.is_empty() and _results.is_empty() and _chunks.size() > 0:
		var near_ok := true
		for w in wanted:
			if w[0] < COLLISION_RADIUS and not (_chunks.has(w[1]) and _chunks[w[1]].has_collision):
				near_ok = false
				break
		if near_ok:
			_initial_emitted = true
			initial_area_ready.emit()


func _exit_tree() -> void:
	for key in _pending.keys():
		WorkerThreadPool.wait_for_task_completion(_pending[key])
	_pending.clear()


func _lod_for(d: float) -> int:
	for i in LODS.size():
		if d < LODS[i].dist:
			return i
	return LODS.size() - 1


func is_ready_near() -> bool:
	return _initial_emitted


# --------------------------------------------------------------------------- worker thread
func _build_chunk(key: Vector2i, lod: int, need_collision: bool) -> void:
	var step: float = LODS[lod].step
	var n := int(CHUNK / step)
	var ox := key.x * CHUNK
	var oz := key.y * CHUNK
	var w := n + 1
	# heights incl. 1-sample border for normals
	var hs := PackedFloat32Array()
	hs.resize((w + 2) * (w + 2))
	for j in range(-1, w + 1):
		for i in range(-1, w + 1):
			hs[(j + 1) * (w + 2) + (i + 1)] = field.height_at(ox + i * step, oz + j * step)
	var verts := PackedVector3Array()
	var norms := PackedVector3Array()
	var cols := PackedColorArray()
	var idx := PackedInt32Array()
	verts.resize(w * w)
	norms.resize(w * w)
	cols.resize(w * w)
	var any_above_void := false
	for j in w:
		for i in w:
			var h := hs[(j + 1) * (w + 2) + (i + 1)]
			var hl := hs[(j + 1) * (w + 2) + i]
			var hr := hs[(j + 1) * (w + 2) + (i + 2)]
			var hd := hs[j * (w + 2) + (i + 1)]
			var hu := hs[(j + 2) * (w + 2) + (i + 1)]
			var nn := Vector3(hl - hr, 2.0 * step, hd - hu).normalized()
			var x := i * step
			var z := j * step
			verts[j * w + i] = Vector3(x, h, z)
			norms[j * w + i] = nn
			cols[j * w + i] = field.color_at(ox + x, oz + z, h, nn).srgb_to_linear()
			if h > field.sea_level - 60.0:
				any_above_void = true
	for j in n:
		for i in n:
			var a := j * w + i
			var b := a + 1
			var c := a + w
			var d := c + 1
			# alternate diagonal for less directional artifacts
			if (i + j) % 2 == 0:
				idx.append_array([a, b, d, a, d, c])
			else:
				idx.append_array([a, b, c, b, d, c])
	# skirts (hide LOD cracks)
	var edges := [[], [], [], []]
	for i in w:
		edges[0].append(i)
		edges[1].append((w - 1) * w + i)
		edges[2].append(i * w)
		edges[3].append(i * w + w - 1)
	for e in 4:
		var ring: Array = edges[e]
		var base := verts.size()
		for vi in ring:
			var v := verts[vi]
			verts.append(Vector3(v.x, v.y - SKIRT, v.z))
			norms.append(norms[vi])
			cols.append(cols[vi])
		for k in ring.size() - 1:
			var t0: int = ring[k]
			var t1: int = ring[k + 1]
			var b0 := base + k
			var b1 := base + k + 1
			idx.append_array([t0, b0, t1, t1, b0, b1])
			idx.append_array([t0, t1, b0, t1, b1, b0])
	var data := {
		"key": key, "lod": lod, "verts": verts, "norms": norms, "cols": cols, "idx": idx,
		"empty": not any_above_void,
	}
	# collision heightmap at 1 m spacing (65 x 65)
	if need_collision and any_above_void:
		var cw := int(CHUNK) + 1
		var ch := PackedFloat32Array()
		ch.resize(cw * cw)
		for j in cw:
			for i in cw:
				ch[j * cw + i] = field.height_at(ox + i, oz + j)
		data["col_heights"] = ch
		data["col_w"] = cw
	if scatter_enabled and lod <= SCATTER_LOD_MAX and any_above_void:
		data["scatter"] = _compute_scatter(key)
	_mutex.lock()
	_results.append(data)
	_mutex.unlock()


func _hash2(x: int, y: int, s: int) -> int:
	var h := (x * 73856093) ^ (y * 19349663) ^ (s * 83492791)
	return abs(h)


func _compute_scatter(key: Vector2i) -> Dictionary:
	var rng := RandomNumberGenerator.new()
	rng.seed = _hash2(key.x, key.y, int(field.def.seed))
	var placed := {}     # id -> Array[Transform3D]
	var big := []        # [Vector2 pos, radius]
	var cell := 4.0
	var cells := int(CHUNK / cell)
	var ox := key.x * CHUNK
	var oz := key.y * CHUNK
	for cj in cells:
		for ci in cells:
			var x := ox + (ci + rng.randf()) * cell
			var z := oz + (cj + rng.randf()) * cell
			var h := field.height_at(x, z)
			var nrm := field.normal_at(x, z, 1.0)
			var slope_deg := rad_to_deg(acos(clampf(nrm.y, -1.0, 1.0)))
			var zone_i := field.zone_at(x, z, h, 1.0 - nrm.y)
			var zone: String = TerrainField.ZONE_NAMES[zone_i]
			if not ZONE_FILL.has(zone):
				continue
			if rng.randf() > ZONE_FILL[zone]:
				continue
			var cands: Array = _zone_candidates.get(zone, [])
			if cands.is_empty():
				continue
			# weighted choice
			var total := 0.0
			for e in cands:
				total += float(e.scatter.get("density", 1.0))
			var r := rng.randf() * total
			var pick: Dictionary = cands[0]
			for e in cands:
				r -= float(e.scatter.get("density", 1.0))
				if r <= 0.0:
					pick = e
					break
			var sc: Dictionary = pick.scatter
			if slope_deg > float(sc.get("slope_max", 30.0)):
				continue
			# clustering: low-frequency mask
			var cl := float(sc.get("cluster", 0.0))
			if cl > 0.0:
				var m := field.n_forest.get_noise_2d(x * 3.1 + 100.0, z * 3.1) * 0.5 + 0.5
				if m < cl * 0.6:
					continue
			var rad := float(pick.get("radius", 1.0))
			var spacing := float(sc.get("min_spacing", rad * 2.0))
			var ok := true
			if rad > 0.8 or spacing > 3.0:
				for b in big:
					if (b[0] as Vector2).distance_to(Vector2(x, z)) < max(spacing, b[1]):
						ok = false
						break
			if not ok:
				continue
			if rad > 0.8 or spacing > 3.0:
				big.append([Vector2(x, z), spacing])
			var s := rng.randf_range(0.82, 1.22)
			var basis := Basis(Vector3.UP, rng.randf() * TAU)
			var cat: String = pick.get("category", "")
			if cat in ["rock", "bush", "flower", "ground_cover", "grass", "log", "crystal"]:
				# lean with the terrain a little
				var tilt := Vector3.UP.slerp(nrm, 0.6)
				basis = Basis(Quaternion(Vector3.UP, tilt)) * basis
			basis = basis.scaled(Vector3(s, s, s))
			var sink := 0.08 * rad if cat in ["rock", "log", "crystal"] else 0.02
			var xf := Transform3D(basis, Vector3(x - ox, h - sink, z - oz))
			if not placed.has(pick.id):
				placed[pick.id] = []
			placed[pick.id].append(xf)
	return placed


# --------------------------------------------------------------------------- main thread
func _finalize(r: Dictionary) -> void:
	var key: Vector2i = r.key
	if r.empty:
		_replace_chunk(key, {"node": Node3D.new(), "lod": r.lod, "has_collision": true})
		return
	var root := Node3D.new()
	root.name = "chunk_%d_%d" % [key.x, key.y]
	root.position = Vector3(key.x * CHUNK, 0, key.y * CHUNK)
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = r.verts
	arr[Mesh.ARRAY_NORMAL] = r.norms
	arr[Mesh.ARRAY_COLOR] = r.cols
	arr[Mesh.ARRAY_INDEX] = r.idx
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	am.surface_set_material(0, material)
	var mi := MeshInstance3D.new()
	mi.mesh = am
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if r.lod == 0 else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(mi)
	var has_col := false
	var body := StaticBody3D.new()
	body.collision_layer = 1
	body.collision_mask = 0
	body.set_meta("surface", "terrain")
	if r.has("col_heights"):
		var hm := HeightMapShape3D.new()
		hm.map_width = r.col_w
		hm.map_depth = r.col_w
		hm.map_data = r.col_heights
		var cs := CollisionShape3D.new()
		cs.shape = hm
		cs.position = Vector3(CHUNK * 0.5, 0, CHUNK * 0.5)
		body.add_child(cs)
		has_col = true
	# keep previous collision if lod changed but we didn't rebuild it
	var prev: Dictionary = _chunks.get(key, {})
	if r.has("scatter"):
		_add_scatter(root, body, r.scatter, has_col)
	elif not prev.is_empty() and prev.has("scatter_node") and is_instance_valid(prev.scatter_node):
		pass
	root.add_child(body)
	_replace_chunk(key, {"node": root, "lod": r.lod, "has_collision": has_col})


func _replace_chunk(key: Vector2i, c: Dictionary) -> void:
	if _chunks.has(key):
		var old: Dictionary = _chunks[key]
		if is_instance_valid(old.node):
			old.node.queue_free()
	add_child(c.node)
	_chunks[key] = c


func _add_scatter(root: Node3D, body: StaticBody3D, placed: Dictionary, with_collision: bool) -> void:
	for id in placed:
		var xfs: Array = placed[id]
		var e := AssetDB.entry(id)
		var cat: String = e.get("category", "default")
		var vis: float = VIS_RANGE.get(cat, VIS_RANGE.default)
		var h := float(e.get("height", 2.0))
		if h > 12.0:
			vis = max(vis, 600.0)
		for part in AssetDB.parts(id):
			var mm := MultiMesh.new()
			mm.transform_format = MultiMesh.TRANSFORM_3D
			mm.mesh = part.mesh
			mm.instance_count = xfs.size()
			for i in xfs.size():
				mm.set_instance_transform(i, (xfs[i] as Transform3D) * (part.xform as Transform3D))
			var mmi := MultiMeshInstance3D.new()
			mmi.multimesh = mm
			mmi.visibility_range_end = vis
			mmi.visibility_range_end_margin = vis * 0.1
			mmi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
			mmi.set_instance_shader_parameter("sway_height", max(float(part.height), 0.5))
			if cat in ["flower", "grass", "ground_cover"]:
				mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			root.add_child(mmi)
		if with_collision:
			var shp := AssetDB.shape(id)
			if shp:
				var off := AssetDB.shape_offset(id)
				for xf in xfs:
					var cs := CollisionShape3D.new()
					cs.shape = shp
					var t: Transform3D = xf
					# collision ignores scale on basis for primitive shapes: keep rotation only, scale via shape not supported
					cs.transform = Transform3D(t.basis.orthonormalized(), t.origin) * off
					body.add_child(cs)
