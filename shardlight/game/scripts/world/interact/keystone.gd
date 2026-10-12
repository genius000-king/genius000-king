class_name KeystonePickup
extends Node3D
## A Keystone: big prism wrapped in orbiting shards. Taking it unlocks the world's law as an ability.
@export var world_id := "verdant"
@export var ability := "lift"
var _gem: MeshInstance3D
var _orbit: Node3D
var _t := 0.0
var _taken := false

func _ready() -> void:
	if world_id in Game.state.keystones:
		queue_free()
		return
	var m := ShaderMaterial.new()
	m.shader = load("res://shaders/fx_gem.gdshader")
	m.set_shader_parameter("base", Color("#7df9a8"))
	m.set_shader_parameter("dark", Color("#2f8f6a"))
	m.set_shader_parameter("energy", 2.6)
	m.next_pass = Stylizer.outline_material(4.0)
	_gem = MeshInstance3D.new()
	var pm := PrismMesh.new()
	pm.size = Vector3(1.0, 2.0, 1.0)
	_gem.mesh = pm
	_gem.material_override = m
	_gem.position.y = 2.2
	add_child(_gem)
	_orbit = Node3D.new()
	_orbit.position.y = 2.2
	add_child(_orbit)
	for i in 8:
		var s := MeshInstance3D.new()
		var sm := PrismMesh.new()
		sm.size = Vector3(0.25, 0.5, 0.25)
		s.mesh = sm
		s.material_override = m
		var a := TAU * i / 8.0
		s.position = Vector3(cos(a) * 1.6, sin(a * 2.0) * 0.4, sin(a) * 1.6)
		s.rotation = Vector3(a, a * 0.5, 0)
		_orbit.add_child(s)
	var l := OmniLight3D.new()
	l.light_color = Color("#9fffc8")
	l.light_energy = 3.0
	l.omni_range = 12.0
	l.position.y = 2.2
	add_child(l)
	var body := StaticBody3D.new()
	body.collision_layer = 16
	var cs := CollisionShape3D.new()
	var sp := SphereShape3D.new()
	sp.radius = 1.6
	cs.shape = sp
	cs.position.y = 2.2
	body.add_child(cs)
	add_child(body)
	Audio.attach_loop("crystal_hum_loop", self, 0.0, 30.0)

func _process(delta: float) -> void:
	_t += delta
	if _taken:
		return
	_gem.rotation.y = _t * 0.8
	_gem.position.y = 2.2 + sin(_t * 1.5) * 0.25
	_orbit.rotation.y = -_t * 1.3

func interact_prompt() -> String:
	return "خُذ حجر المفتاح" if Settings.language == "ar" else "Take the Keystone"

func interact(player) -> void:
	if _taken:
		return
	_taken = true
	if not Story.has_method("event"):
		Audio.stinger("keystone_pickup")
	Game.collect_keystone(world_id)
	Game.unlock_ability(ability)
	if player and player.has_method("hitstop"):
		player.hitstop(0.12)
		player.add_shake(1.0)
		player.slime.emote("surprised", 2.0)
		player.slime.splash(1.0, Vector3.UP)
	var abil = player.get_node_or_null("Abilities") if player else null
	if abil and abil.has_method("play_unlock_vfx"):
		abil.play_unlock_vfx(ability)
	if Story.has_method("event"):
		Story.event("keystone_" + world_id)
	var tw := create_tween()
	tw.tween_property(_gem, "scale", Vector3.ONE * 3.0, 0.3).set_trans(Tween.TRANS_BACK)
	tw.parallel().tween_property(_orbit, "scale", Vector3.ONE * 4.0, 0.3)
	tw.tween_property(self, "scale", Vector3.ZERO, 0.35)
	tw.tween_callback(queue_free)
