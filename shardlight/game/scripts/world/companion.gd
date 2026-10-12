class_name LumenCompanion
extends Node3D
## Lumen, the prism drone: hovers beside Blu, looks where Blu looks, glows when speaking. Interact → dialogue.
var player: Node3D
var model: Node3D
var _t := 0.0
var _speak := 0.0
var _vel := Vector3.ZERO

func _ready() -> void:
	add_to_group("npc")
	set_meta("npc_id", "lumen")
	if AssetDB.has("lumen"):
		model = AssetDB.instantiate("lumen")
	else:
		model = _build_drone()
	add_child(model)
	var body := StaticBody3D.new()
	body.collision_layer = 16
	var cs := CollisionShape3D.new()
	var sp := SphereShape3D.new()
	sp.radius = 0.6
	cs.shape = sp
	body.add_child(cs)
	add_child(body)
	if Story.has_signal("lumen_line"):
		Story.lumen_line.connect(func(_t): _speak = 1.0)

func _build_drone() -> Node3D:
	var root := Node3D.new()
	var gem := MeshInstance3D.new()
	var pm := PrismMesh.new()
	pm.size = Vector3(0.35, 0.5, 0.35)
	gem.mesh = pm
	var m := ShaderMaterial.new()
	m.shader = load("res://shaders/fx_gem.gdshader")
	m.set_shader_parameter("base", Color("#ffe7a0"))
	m.set_shader_parameter("dark", Color("#c79bff"))
	m.next_pass = Stylizer.outline_material(3.0)
	gem.material_override = m
	root.add_child(gem)
	var ring := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.38
	tm.outer_radius = 0.44
	ring.mesh = tm
	ring.name = "Halo"
	ring.material_override = Stylizer.material("EMIT", {"use_vertex_color": 0.0, "tint": Color("#9d6bff"), "emission_energy": 2.0})
	root.add_child(ring)
	var l := OmniLight3D.new()
	l.light_color = Color("#ffe7a0")
	l.light_energy = 0.8
	l.omni_range = 4.0
	root.add_child(l)
	return root

func _process(delta: float) -> void:
	_t += delta
	if player == null:
		player = Game.player
		if player == null:
			return
		global_position = player.global_position + Vector3(1.2, 1.4, 0)
	# follow: offset to Blu's right-back, springy
	var cam_yaw: float = player.yaw if "yaw" in player else 0.0
	var offset := Basis(Vector3.UP, cam_yaw) * Vector3(1.1, 1.25 + sin(_t * 1.7) * 0.12, 0.6)
	var target := player.global_position + offset
	_vel = _vel.lerp((target - global_position) * 4.0, 1.0 - exp(-delta * 5.0))
	global_position += _vel * delta
	model.rotation.y += delta * (1.2 + _speak * 6.0)
	var halo := model.get_node_or_null("Halo")
	if halo:
		halo.rotation.x = sin(_t * 0.9) * 0.5
	_speak = move_toward(_speak, 0.0, delta)
	model.scale = Vector3.ONE * (1.0 + _speak * 0.15 * sin(_t * 30.0))

func interact_prompt() -> String:
	return "تحدّث إلى لومن" if Settings.language == "ar" else "Talk to Lumen"

func interact(_p) -> void:
	if Story.has_method("start_dialogue"):
		Story.start_dialogue("lumen")
