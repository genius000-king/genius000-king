class_name EchoPickup
extends Node3D
## Memory Echo: a floating prism shard. Touch/interact → Story echo + journal + collect.
@export var echo_id := "echo_verdant_1"
var _gem: MeshInstance3D
var _t := randf() * 10.0
var _taken := false

func _ready() -> void:
	if echo_id in Game.state.echoes:
		queue_free()
		return
	_gem = MeshInstance3D.new()
	var pm := PrismMesh.new()
	pm.size = Vector3(0.5, 0.8, 0.5)
	_gem.mesh = pm
	var m := ShaderMaterial.new()
	m.shader = load("res://shaders/fx_gem.gdshader")
	m.next_pass = Stylizer.outline_material(3.0)
	_gem.material_override = m
	_gem.position.y = 1.3
	add_child(_gem)
	var l := OmniLight3D.new()
	l.light_color = Color("#8fe0ff")
	l.light_energy = 1.4
	l.omni_range = 5.0
	l.position.y = 1.3
	add_child(l)
	var area := Area3D.new()
	area.collision_layer = 16
	area.collision_mask = 2
	var cs := CollisionShape3D.new()
	var sp := SphereShape3D.new()
	sp.radius = 1.4
	cs.shape = sp
	cs.position.y = 1.0
	area.add_child(cs)
	add_child(area)
	area.body_entered.connect(func(b): if b.is_in_group("player"): interact(b))

func _process(delta: float) -> void:
	if _taken:
		return
	_t += delta
	_gem.rotation.y = _t * 1.4
	_gem.position.y = 1.3 + sin(_t * 2.0) * 0.15

func interact_prompt() -> String:
	return "صدى ذاكرة" if Settings.language == "ar" else "Memory Echo"

func interact(_p) -> void:
	if _taken:
		return
	_taken = true
	Audio.play("echo_pickup", global_position)
	Game.collect_echo(echo_id)
	if Story.has_method("play_echo"):
		Story.play_echo(echo_id)
	elif Story.has_method("event"):
		Story.event("echo:" + echo_id)
	var tw := create_tween()
	tw.tween_property(_gem, "scale", Vector3.ONE * 2.2, 0.25).set_trans(Tween.TRANS_BACK)
	tw.tween_property(_gem, "scale", Vector3.ZERO, 0.2)
	tw.tween_callback(queue_free)
