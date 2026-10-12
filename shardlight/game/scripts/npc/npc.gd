class_name NPC
extends Node3D
## Talkable character / sign / gate. Set `npc_id` before adding to the tree:
##   var n := NPC.new(); n.npc_id = "marrow"; add_child(n)
## Interact collider on physics layer 5 (bit 16). Model: AssetDB.has(npc_id) else a placeholder.
## Forward is +Z (glTF convention): the NPC yaws to face Blu while talking.

@export var npc_id := ""
@export var model_id := ""               ## override of the AssetDB id (default npc_id)
@export var height := 1.2                ## placeholder / label height
@export var bark_radius := 8.0
@export var bark_cooldown := Vector2(10.0, 20.0)
@export var interact_radius := 0.9
@export var labels := true

const COLORS := {
	"marrow": [Color("6f9a4e"), Color("8a5a2b")],
	"ilse": [Color("e08a4a"), Color("f2d6a0")],
	"pip": [Color("f2c744"), Color("d9442f")],
	"tansy": [Color("e0568a"), Color("7a3b1e")],
	"wren": [Color("8a6cc7"), Color("f0e6c0")],
}
const KIDS := {"pip": 0.62, "tansy": 0.78}

var _model: Node3D
var _anim: AnimationPlayer
var _name_label: Label3D
var _marker: Label3D
var _bubble: Label3D
var _talking := false
var _t := 0.0
var _bark_timer := 0.0
var _bubble_timer := 0.0
var _base_y := 0.0
var _refresh_pending := false


func _ready() -> void:
	add_to_group("npc")
	_t = randf() * 10.0
	_bark_timer = randf_range(2.0, bark_cooldown.y)
	_build_model()
	_build_collider()
	if labels and _kind() != "object":
		_build_labels()
	Story.dialogue_started.connect(_on_dialogue_started)
	Story.dialogue_ended.connect(_on_dialogue_ended)
	Story.quest_updated.connect(func(_q): _queue_refresh())
	Story.flag_changed.connect(func(_f, _v): _queue_refresh())
	_refresh()


# ------------------------------------------------------------------ kinds / text
func _kind() -> String:
	if npc_id.begins_with("sign_"):
		return "sign"
	if npc_id == "loom" or npc_id.begins_with("gate"):
		return "object"
	if npc_id == "lumen":
		return "drone"
	return "character"


func interact_name() -> String:
	return Story.display_name(npc_id)


func interact_prompt() -> String:
	var ar: bool = Settings.language == "ar"
	var n := interact_name()
	match _kind():
		"sign": return "اقرأ" if ar else "Read"
		"object":
			if npc_id == "loom":
				return "المس النَّوْل" if ar else "Touch the Loom"
			return "استخدم البوّابة" if ar else "Use the gate"
	return ("تحدّث إلى %s" % n) if ar else ("Talk to %s" % n)


func interact(_player = null) -> void:
	if Story.is_in_dialogue():
		return
	Story.start_dialogue(npc_id)
	if not Story.is_in_dialogue():
		_show_bark()


# ------------------------------------------------------------------ build
func _build_model() -> void:
	var mid := model_id if model_id != "" else npc_id
	if AssetDB.has(mid):
		_model = AssetDB.instantiate(mid)
	elif _kind() != "object":
		_model = _placeholder()
	if _model == null:
		return
	add_child(_model)
	_base_y = _model.position.y
	var found := _model.find_children("*", "AnimationPlayer", true, false)
	if not found.is_empty():
		_anim = found[0]
		_play("idle")


func _mat(c: Color, emit := false) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = 0.8
	if emit:
		m.emission_enabled = true
		m.emission = c
		m.emission_energy_multiplier = 1.4
	return m


func _mesh(shape: Mesh, c: Color, pos: Vector3, emit := false) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = shape
	mi.material_override = _mat(c, emit)
	mi.position = pos
	return mi


func _placeholder() -> Node3D:
	var root := Node3D.new()
	match _kind():
		"sign":
			root.add_child(_mesh(_box(Vector3(0.12, 1.0, 0.12)), Color("6b4a2b"), Vector3(0, 0.5, 0)))
			var board := _mesh(_box(Vector3(0.9, 0.5, 0.08)), Color("c89a5c"), Vector3(0, 1.0, 0))
			root.add_child(board)
			height = 1.5
		"drone":
			var prism := SphereMesh.new()
			prism.radius = 0.16
			prism.height = 0.32
			prism.radial_segments = 6
			prism.rings = 2
			root.add_child(_mesh(prism, Color("9fe8ff"), Vector3(0, 0.9, 0), true))
			var halo := TorusMesh.new()
			halo.inner_radius = 0.22
			halo.outer_radius = 0.27
			root.add_child(_mesh(halo, Color("ffe08a"), Vector3(0, 0.9, 0), true))
			height = 1.3
		_:
			var cols: Array = COLORS.get(npc_id, [Color.from_hsv(float(npc_id.hash() % 360) / 360.0, 0.5, 0.85), Color("6b4a2b")])
			var s: float = KIDS.get(npc_id, 1.0)
			var body := CapsuleMesh.new()
			body.radius = 0.28
			body.height = 1.0
			root.add_child(_mesh(body, cols[0], Vector3(0, 0.5, 0)))
			var head := SphereMesh.new()
			head.radius = 0.24
			head.height = 0.48
			root.add_child(_mesh(head, Color("f0c9a0"), Vector3(0, 1.12, 0)))
			var eye := SphereMesh.new()
			eye.radius = 0.045
			eye.height = 0.09
			for sx in [-0.09, 0.09]:
				root.add_child(_mesh(eye, Color("2a1e18"), Vector3(sx, 1.15, 0.21)))
			var hat := CylinderMesh.new()
			hat.top_radius = 0.2
			hat.bottom_radius = 0.34 if npc_id == "marrow" else 0.25
			hat.height = 0.14
			root.add_child(_mesh(hat, cols[1], Vector3(0, 1.34, 0)))
			root.scale = Vector3.ONE * s
			height = 1.6 * s
	return root


func _box(sz: Vector3) -> BoxMesh:
	var b := BoxMesh.new()
	b.size = sz
	return b


func _build_collider() -> void:
	var area := Area3D.new()
	area.name = "InteractArea"
	area.collision_layer = 16
	area.collision_mask = 0
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	var big := _kind() == "object"
	cap.radius = interact_radius * (2.0 if big else 1.0)
	cap.height = maxf(height, cap.radius * 2.0 + 0.1) * (1.6 if big else 1.0)
	cs.shape = cap
	cs.position = Vector3(0, cap.height * 0.5, 0)
	area.add_child(cs)
	add_child(area)


func _build_labels() -> void:
	_name_label = _label(Story.display_name(npc_id), 0.0045, Color("fff4d6"))
	_name_label.position = Vector3(0, height + 0.25, 0)
	add_child(_name_label)
	_marker = _label("!", 0.012, Color("ffd23f"))
	_marker.position = Vector3(0, height + 0.75, 0)
	_marker.visible = false
	add_child(_marker)
	_bubble = _label("", 0.0042, Color.WHITE)
	_bubble.position = Vector3(0, height + 0.55, 0)
	_bubble.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_bubble.width = 380.0
	_bubble.modulate.a = 0.0
	add_child(_bubble)


func _label(text: String, px: float, col: Color) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.pixel_size = px
	l.font_size = 48
	l.outline_size = 14
	l.outline_modulate = Color(0.08, 0.05, 0.12, 0.95)
	l.modulate = col
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = false
	l.double_sided = true
	return l


# ------------------------------------------------------------------ state
func _queue_refresh() -> void:
	if _refresh_pending:
		return
	_refresh_pending = true
	call_deferred("_refresh")


func _refresh() -> void:
	_refresh_pending = false
	if _marker:
		_marker.visible = Story.npc_has_marker(npc_id) and not _talking
	if _name_label:
		_name_label.text = Story.display_name(npc_id)


func _on_dialogue_started(id: String, _name: String) -> void:
	if id != npc_id:
		return
	_talking = true
	_hide_bubble()
	_play("talk")
	_refresh()


func _on_dialogue_ended(id: String) -> void:
	if id != npc_id:
		return
	_talking = false
	_play("idle")
	_bark_timer = randf_range(bark_cooldown.x, bark_cooldown.y)
	_queue_refresh()


func _play(anim: String) -> void:
	if _anim and _anim.has_animation(anim):
		_anim.play(anim, 0.2)


func _player() -> Node3D:
	var p = Game.player
	return p if p and is_instance_valid(p) else null


func _process(delta: float) -> void:
	_t += delta
	var p := _player()
	var dist := 999.0
	if p:
		dist = global_position.distance_to(p.global_position)
	# face Blu while talking (characters only)
	if _talking and p and _kind() == "character":
		var d := p.global_position - global_position
		var yaw := atan2(d.x, d.z)
		rotation.y = lerp_angle(rotation.y, yaw, 1.0 - exp(-8.0 * delta))
	# procedural life when the model has no animations
	if _model and _anim == null and _kind() != "sign":
		var speed := 14.0 if _talking else 2.2
		var amp := 0.035 if _talking else 0.03
		if _kind() == "drone":
			_model.position.y = _base_y + sin(_t * 2.0) * 0.08
			_model.rotation.y += delta * 0.8
		else:
			_model.position.y = _base_y
			_model.scale.y = 1.0 + sin(_t * speed) * amp
	# labels
	if _name_label:
		_name_label.visible = _talking or dist < 14.0
	if _marker and _marker.visible:
		_marker.position.y = height + 0.75 + sin(_t * 3.0) * 0.06
	# ambient barks
	if _bubble:
		if _bubble_timer > 0.0:
			_bubble_timer -= delta
			_bubble.modulate.a = clampf(_bubble_timer * 2.0, 0.0, 1.0)
		if not _talking and dist < bark_radius and not Story.is_in_dialogue():
			_bark_timer -= delta
			if _bark_timer <= 0.0:
				_show_bark()
				_bark_timer = randf_range(bark_cooldown.x, bark_cooldown.y)


func _show_bark() -> void:
	if _bubble == null:
		return
	var s := Story.bark(npc_id)
	if s == "":
		return
	_bubble.text = s
	_bubble.modulate.a = 1.0
	_bubble_timer = 4.0 + s.length() * 0.04


func _hide_bubble() -> void:
	_bubble_timer = 0.0
	if _bubble:
		_bubble.modulate.a = 0.0
