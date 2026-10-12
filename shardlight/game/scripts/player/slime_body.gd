class_name SlimeBody
extends Node3D
## Blu as a LIQUID body. A handful of soft blobs (metaballs) are simulated with springs + inertia and rendered
## as one fused fluid surface by shaders/slime_liquid.gdshader. Motion makes the body stream into a drop shape,
## landing spreads it into a puddle, hits splash droplets that flow back, charging pulls the liquid inward.
## Face parts (eyes, brows, mouths, cheeks) and Rae's cap ride on the head blob.

signal wobble_peak
signal hop_contact(strength: float)
signal splashed(world_pos: Vector3, amount: float)

const MOUTHS := ["mouth_smile", "mouth_open", "mouth_o", "mouth_grin", "mouth_frown"]
const HEIGHT := 0.66
const MAX_BLOBS := 12
const FIXED := 6                   # blobs 0..5 form the body; 6..11 are free droplets

# rest layout (local, +Z = front): [offset, radius]
const REST := [
	[Vector3(0.0, 0.28, 0.02), 0.39],    # 0 core body
	[Vector3(0.0, 0.10, 0.0), 0.43],     # 1 base puddle
	[Vector3(0.0, 0.45, 0.0), 0.20],     # 2 head
	[Vector3(0.0, 0.22, -0.15), 0.24],   # 3 tail (lags behind when moving)
	[Vector3(0.22, 0.16, 0.10), 0.20],   # 4 left lobe
	[Vector3(-0.22, 0.16, 0.10), 0.20],  # 5 right lobe
]

var mesh_inst: MeshInstance3D
var mat: ShaderMaterial
var face: Node3D
var model: Node3D
var parts := {}

var core_anchor: Node3D
var mouth_anchor: Node3D
var ground_anchor: Node3D
var eye_anchor: Node3D

var pos: Array[Vector3] = []
var vel: Array[Vector3] = []
var rad: Array[float] = []
var drop_life: Array[float] = []

# global shape state
var squash := 0.0
var squash_v := 0.0
var lean_target := Vector2.ZERO     # kept for API compatibility (x unused, y = forward lean)
var wobble := 0.0
var charge := 0.0
var _charge_vis := 0.0
var flash_amt := 0.0
var move_speed := 0.0
var grounded := true
var hop_phase := 0.0
var _hop := 0.0
var _prev_world := Vector3.ZERO
var _prev_vel := Vector3.ZERO
var _t := 0.0

# face state
var look_target_local := Vector3(0, 0.35, 1.0)
var _blink_t := 2.0
var _blinking := 0.0
var _emote := "neutral"
var _emote_t := 0.0
var _mouth_cur := ""
var _mouth_open := 0.0
var _eye_base := {}
var _pupil_base := {}
var _brow_base := {}
var first_person_hidden := false


func _ready() -> void:
	for i in MAX_BLOBS:
		var r: float = REST[i][1] if i < FIXED else 0.0
		var p: Vector3 = REST[i][0] if i < FIXED else Vector3.ZERO
		pos.append(p)
		vel.append(Vector3.ZERO)
		rad.append(r)
		drop_life.append(0.0)
	mat = ShaderMaterial.new()
	mat.shader = load("res://shaders/slime_liquid.gdshader")
	mesh_inst = MeshInstance3D.new()
	mesh_inst.name = "Liquid"
	mesh_inst.mesh = _box_mesh(Vector3(-1.0, -0.05, -1.0), Vector3(1.0, 1.4, 1.0))
	mesh_inst.material_override = mat
	mesh_inst.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mesh_inst.extra_cull_margin = 1.0
	add_child(mesh_inst)
	# a simple stand-in volume casts the shadow (raymarched depth isn't used for shadow maps)
	var shadow := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.42
	sm.height = 0.62
	shadow.mesh = sm
	shadow.position.y = 0.3
	shadow.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY
	add_child(shadow)
	# face & accessories from the Blender parts
	face = Node3D.new()
	face.name = "Face"
	add_child(face)
	var ps: PackedScene = load("res://assets/models/characters_main/blu.glb")
	model = ps.instantiate()
	face.add_child(model)
	for mi in model.find_children("*", "MeshInstance3D", true, false):
		var n := String(mi.name)
		if n == "body" or n == "core" or n == "tag" or n.begins_with("bubble_"):
			mi.queue_free()
			continue
		parts[n] = mi
		mi.set_meta("center", (mi as MeshInstance3D).get_aabb().get_center())
	_setup_face_materials()
	for n in ["eye_L", "eye_R"]:
		if parts.has(n):
			_eye_base[n] = true
	for n in ["pupil_L", "pupil_R", "glint_L", "glint_R"]:
		if parts.has(n):
			_pupil_base[n] = parts[n].position
	for n in ["brow_L", "brow_R"]:
		if parts.has(n):
			_brow_base[n] = parts[n].transform
	core_anchor = _anchor("CoreAnchor", Vector3(0, 0.27, 0.0))
	mouth_anchor = _anchor("MouthAnchor", Vector3(0, 0.28, 0.44))
	ground_anchor = _anchor("GroundAnchor", Vector3.ZERO)
	eye_anchor = _anchor("EyeAnchor", Vector3(0, 0.36, 0.34))
	_prev_world = global_position


func _box_mesh(a: Vector3, b: Vector3) -> ArrayMesh:
	var bm := BoxMesh.new()
	bm.size = b - a
	var arr := bm.get_mesh_arrays()
	var verts: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var c := (a + b) * 0.5
	for i in verts.size():
		verts[i] += c
	arr[Mesh.ARRAY_VERTEX] = verts
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	return am


func _anchor(n: String, p: Vector3) -> Node3D:
	var a := Node3D.new()
	a.name = n
	a.position = p
	add_child(a)
	return a


func _setup_face_materials() -> void:
	var plain := Stylizer.material("VC", {"posterize": 0.0, "halftone_strength": 0.0, "rim_strength": 0.15})
	var no_line := plain.duplicate() as ShaderMaterial
	no_line.next_pass = null
	for n in parts:
		var mi: MeshInstance3D = parts[n]
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		if n.begins_with("pupil_") or n.begins_with("cheek_") or n.begins_with("mouth_") or n.begins_with("brow_"):
			mi.material_override = no_line
		elif n.begins_with("glint_"):
			mi.material_override = Stylizer.material("EMIT", {"emission_energy": 1.2})
		else:
			mi.material_override = plain
			if n == "cap":
				mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON


# ------------------------------------------------------------------ API
func impulse_squash(amount: float) -> void:
	squash_v += amount * 9.0
	wobble = minf(1.0, wobble + absf(amount) * 1.5)
	if amount > 0.3:
		splash(amount * 0.7, Vector3.UP)


func set_charge(ratio: float) -> void:
	charge = clampf(ratio, 0.0, 1.0)


func set_mouth(open: float) -> void:
	_mouth_open = open


func flash(color: Color, amount := 1.0) -> void:
	mat.set_shader_parameter("flash_color", color)
	flash_amt = amount


func splash(amount: float, dir := Vector3.UP) -> void:
	## throw liquid droplets out of the body; they fall and flow back in
	var n := int(clampf(amount * 6.0, 1.0, 6.0))
	for k in n:
		var slot := -1
		for i in range(FIXED, MAX_BLOBS):
			if drop_life[i] <= 0.0:
				slot = i
				break
		if slot < 0:
			return
		var a := randf() * TAU
		var out := Vector3(cos(a), 0.0, sin(a))
		pos[slot] = Vector3(out.x * 0.2, 0.3 + randf() * 0.15, out.z * 0.2)
		vel[slot] = (out * randf_range(1.2, 2.6) + dir * randf_range(1.5, 3.0)) * (0.6 + amount * 0.6)
		rad[slot] = randf_range(0.045, 0.085)
		drop_life[slot] = randf_range(0.9, 1.4)
	splashed.emit(global_position, amount)


func emote(name: String, duration := 1.6) -> void:
	_emote = name
	_emote_t = duration
	match name:
		"blink":
			_blinking = 0.14
			_emote = "neutral"
		"happy":
			impulse_squash(-0.22)
		"surprised":
			impulse_squash(-0.4)
		"angry":
			impulse_squash(0.18)
		"sad":
			impulse_squash(0.15)


func look_at_world(p: Vector3) -> void:
	look_target_local = to_local(p)


# ------------------------------------------------------------------ simulation
func _physics_process(delta: float) -> void:
	_t += delta
	# world-space acceleration of the body → inertia on the liquid (in local space)
	var wp := global_position
	var wv := (wp - _prev_world) / maxf(delta, 1e-4)
	var wa := (wv - _prev_vel) / maxf(delta, 1e-4)
	_prev_world = wp
	_prev_vel = wv
	var inv := global_transform.basis.inverse()
	var la := inv * wa
	var lv := inv * wv
	la = la.limit_length(60.0)
	# global squash spring
	squash_v += (-150.0 * squash - 7.0 * squash_v) * delta
	squash = clampf(squash + squash_v * delta, -0.5, 0.65)
	wobble = move_toward(wobble, 0.0, delta * 1.3)
	flash_amt = move_toward(flash_amt, 0.0, delta * 5.0)
	_charge_vis = lerpf(_charge_vis, charge, 1.0 - exp(-delta * 10.0))
	_update_hop(delta)
	var sy := 1.0 - squash * 0.6
	var sxz := 1.0 / sqrt(maxf(sy, 0.3))
	var speed_h := Vector2(lv.x, lv.z).length()
	var stream := clampf(speed_h / 8.0, 0.0, 1.0)
	for i in FIXED:
		var rest: Vector3 = REST[i][0]
		var r0: float = REST[i][1]
		var target := Vector3(rest.x * sxz, rest.y * sy + _hop, rest.z * sxz)
		# charging: liquid pulls inward and up, belly swells
		target = target.lerp(Vector3(0, 0.27, 0), _charge_vis * 0.35)
		# streaming: tail stretches backward, head leans forward when running
		if i == 3:
			target += Vector3(0, -0.02, -0.22) * stream
		if i == 2:
			target += Vector3(0, -0.03 * stream, 0.08 * stream)
		# idle breathing
		target.y += sin(_t * 2.1 + i) * 0.006
		var k := 140.0 if i != 3 else 70.0
		var c := 9.0
		var acc := (target - pos[i]) * k - vel[i] * c - la * (0.03 if i <= 1 else 0.06)
		vel[i] += acc * delta
		pos[i] += vel[i] * delta
		pos[i].y = maxf(pos[i].y, 0.02)
		var rr := r0 * (1.0 + _charge_vis * (0.1 if i == 0 else -0.15))
		if i == 1:
			rr *= 1.0 + maxf(squash, 0.0) * 0.5      # puddle spreads on impact
		rad[i] = rr
	# droplets
	for i in range(FIXED, MAX_BLOBS):
		if drop_life[i] <= 0.0:
			rad[i] = 0.0
			continue
		drop_life[i] -= delta
		if drop_life[i] > 0.5:
			vel[i].y -= 14.0 * delta
			pos[i] += vel[i] * delta
			if pos[i].y < rad[i] * 0.4:
				pos[i].y = rad[i] * 0.4
				vel[i] = Vector3(vel[i].x * 0.4, 0.0, vel[i].z * 0.4)
		else:
			# flow back into the body
			pos[i] = pos[i].lerp(Vector3(0, 0.12, 0), 1.0 - exp(-delta * 7.0))
			rad[i] *= 1.0 - delta * 0.8
		if drop_life[i] <= 0.0:
			rad[i] = 0.0
	_upload()
	_update_face(delta)


func _update_hop(delta: float) -> void:
	if grounded and move_speed > 0.3:
		var rate := lerpf(2.4, 3.8, clampf((move_speed - 2.0) / 6.0, 0.0, 1.0))
		var prev := hop_phase
		hop_phase += delta * rate
		_hop = maxf(0.0, sin(hop_phase * TAU)) * lerpf(0.02, 0.07, clampf(move_speed / 8.0, 0.0, 1.0))
		if floorf(prev) != floorf(hop_phase):
			var strength := clampf(move_speed / 8.0, 0.2, 1.0)
			squash_v += (0.1 + 0.15 * strength) * 9.0
			wobble = minf(1.0, wobble + 0.2)
			if strength > 0.7 and randf() < 0.5:
				splash(0.25, Vector3.UP)
			hop_contact.emit(strength)
	else:
		_hop = move_toward(_hop, 0.0, delta * 0.4)
		hop_phase = 0.0


func _upload() -> void:
	var arr := PackedVector4Array()
	arr.resize(MAX_BLOBS)
	for i in MAX_BLOBS:
		arr[i] = Vector4(pos[i].x, pos[i].y, pos[i].z, rad[i])
	mat.set_shader_parameter("blobs", arr)
	mat.set_shader_parameter("blob_count", MAX_BLOBS)
	mat.set_shader_parameter("smooth_k", 0.14 + wobble * 0.04 + _charge_vis * 0.04)
	mat.set_shader_parameter("charge", _charge_vis)
	mat.set_shader_parameter("core_pos", pos[0] + Vector3(0, -0.12, 0.06))
	mat.set_shader_parameter("wobble", wobble)
	mat.set_shader_parameter("flash", flash_amt)
	core_anchor.position = pos[0] + Vector3(0, -0.12, 0.06)
	mouth_anchor.position = pos[0] + Vector3(0, 0.0, 0.42)


# ------------------------------------------------------------------ face
# Face features are projected onto the actual liquid surface every frame (same SDF as the shader), so
# eyes/mouth/cap ride the fluid as it stretches, streams and splats.
const FACE_DIRS := {
	"eye_L": Vector3(0.36, 0.30, 1.0), "eye_R": Vector3(-0.36, 0.30, 1.0),
	"mouth": Vector3(0.0, -0.04, 1.0),
	"cheek_L": Vector3(0.62, -0.02, 0.85), "cheek_R": Vector3(-0.62, -0.02, 0.85),
	"brow_L": Vector3(0.36, 0.62, 1.0), "brow_R": Vector3(-0.36, 0.62, 1.0),
	"cap": Vector3(0.08, 1.0, -0.12),
}
const GROUPS := {
	"eye_L": ["eye_L", "pupil_L", "glint_L"], "eye_R": ["eye_R", "pupil_R", "glint_R"],
	"mouth": ["mouth_smile", "mouth_open", "mouth_o", "mouth_grin", "mouth_frown"],
	"cheek_L": ["cheek_L"], "cheek_R": ["cheek_R"], "brow_L": ["brow_L"], "brow_R": ["brow_R"], "cap": ["cap"],
}
const PIVOT_PART := {"eye_L": "eye_L", "eye_R": "eye_R", "mouth": "mouth_smile", "cheek_L": "cheek_L",
	"cheek_R": "cheek_R", "brow_L": "brow_L", "brow_R": "brow_R", "cap": "cap"}


func _smin(a: float, b: float, k: float) -> float:
	var h := clampf(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
	return lerpf(b, a, h) - k * h * (1.0 - h)


func sdf(p: Vector3) -> float:
	var d := 1e3
	var k := 0.14 + wobble * 0.04 + _charge_vis * 0.04
	for i in MAX_BLOBS:
		if rad[i] <= 0.0:
			continue
		d = _smin(d, p.distance_to(pos[i]) - rad[i], k)
	return maxf(d, -p.y)


func surface_point(origin: Vector3, dir: Vector3) -> Vector3:
	dir = dir.normalized()
	var t := 0.0
	var prev := origin
	for i in 48:
		var p := origin + dir * t
		if sdf(p) > 0.0:
			# refine between prev and p
			var a := prev
			var b := p
			for j in 6:
				var m := (a + b) * 0.5
				if sdf(m) > 0.0:
					b = m
				else:
					a = m
			return (a + b) * 0.5
		prev = p
		t += 0.02
	return origin + dir * t


func surface_normal(p: Vector3) -> Vector3:
	var e := 0.004
	return Vector3(sdf(p + Vector3(e, 0, 0)) - sdf(p - Vector3(e, 0, 0)),
		sdf(p + Vector3(0, e, 0)) - sdf(p - Vector3(0, e, 0)),
		sdf(p + Vector3(0, 0, e)) - sdf(p - Vector3(0, 0, e))).normalized()


func _orient(n: Vector3) -> Basis:
	var up := Vector3.UP
	if absf(n.dot(up)) > 0.95:
		up = Vector3(0, 0, -1)
	var z := n.normalized()
	var x := up.cross(z).normalized()
	var y := z.cross(x).normalized()
	return Basis(x, y, z)


func _update_face(delta: float) -> void:
	face.transform = Transform3D.IDENTITY
	var center := pos[0] * 0.7 + pos[2] * 0.3
	# blink / emote state
	_blink_t -= delta
	if _blink_t <= 0.0:
		_blink_t = randf_range(1.8, 4.5)
		_blinking = 0.13
	_blinking = maxf(0.0, _blinking - delta)
	var lid := 0.12 if _blinking > 0.0 else 1.0
	_emote_t -= delta
	if _emote_t <= 0.0:
		_emote = "neutral"
	var eye_scale := 1.0
	var brow_lift := 0.0
	var brow_tilt := 0.0
	var mouth := "mouth_smile"
	match _emote:
		"happy":
			mouth = "mouth_grin"
			lid = minf(lid, 0.55)
			brow_lift = 0.012
		"surprised":
			mouth = "mouth_o"
			eye_scale = 1.18
			brow_lift = 0.03
		"angry":
			mouth = "mouth_frown"
			brow_tilt = 0.45
			lid = minf(lid, 0.75)
		"sad":
			mouth = "mouth_frown"
			brow_tilt = -0.4
			lid = minf(lid, 0.7)
		"determined":
			mouth = "mouth_frown"
			brow_tilt = 0.25
	if _charge_vis > 0.15:
		mouth = "mouth_o" if _charge_vis < 0.85 else "mouth_open"
		brow_tilt = 0.3
	if _mouth_open > 0.5:
		mouth = "mouth_open"
	_set_mouth(mouth)
	var look := (look_target_local - Vector3(0, 0.35, 0)).normalized()
	var look_off := Vector3(clampf(look.x, -0.6, 0.6) * 0.022, clampf(look.y, -0.5, 0.5) * 0.02, 0.0)
	for key in FACE_DIRS:
		var pivot_name: String = PIVOT_PART[key]
		if not parts.has(pivot_name):
			continue
		var pivot: Vector3 = parts[pivot_name].get_meta("center")
		var sp := surface_point(center, FACE_DIRS[key])
		var n := surface_normal(sp)
		var inset := 0.004
		match key:
			"cap":
				inset = 0.03
			"mouth", "brow_L", "brow_R":
				inset = -0.012
			"cheek_L", "cheek_R":
				inset = -0.004
		var R := _orient(n)
		if key == "cap":
			# the cap's authored up axis (+Y) follows the surface normal; front stays forward
			var y := n.lerp(Vector3.UP, 0.5).normalized()
			var z := (Vector3(0, 0, 1) - y * y.z).normalized()
			R = Basis(y.cross(z).normalized(), y, z)
		var sc := 1.45 if key == "cap" else 1.0
		var T := Transform3D(R.scaled(Vector3(sc, sc, sc)), sp - n * inset - R.scaled(Vector3(sc, sc, sc)) * pivot)
		for pn in GROUPS[key]:
			if not parts.has(pn):
				continue
			var part: MeshInstance3D = parts[pn]
			var c: Vector3 = part.get_meta("center")
			var local := Transform3D.IDENTITY
			if pn.begins_with("eye_"):
				var b := Basis.from_scale(Vector3(eye_scale, eye_scale * lid, eye_scale))
				local = Transform3D(b, c - b * c)
			elif pn.begins_with("pupil_") or pn.begins_with("glint_"):
				var b2 := Basis.from_scale(Vector3(eye_scale, eye_scale * maxf(lid, 0.1), 1.0))
				local = Transform3D(b2, c - b2 * c + look_off)
				part.visible = lid > 0.3 and not first_person_hidden
			elif pn.begins_with("brow_"):
				var side := 1.0 if pn.ends_with("L") else -1.0
				var rot := Basis(Vector3(0, 0, 1), -brow_tilt * side)
				local = Transform3D(rot, c - rot * c + Vector3(0, brow_lift, 0))
			part.transform = T * local


func _set_mouth(name: String) -> void:
	if _mouth_cur == name:
		return
	_mouth_cur = name
	for m in MOUTHS:
		if parts.has(m):
			parts[m].visible = (m == name)
