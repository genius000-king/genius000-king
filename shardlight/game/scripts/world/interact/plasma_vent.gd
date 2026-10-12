class_name PlasmaVent
extends Node3D
## A glowing fissure leaking Loom plasma. Blu gulps it (enter) → first-gulp story beat + a charge flash.
var _area: Area3D
var _glow: MeshInstance3D
var _t := 0.0

func _ready() -> void:
	_glow = MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 1.6
	cm.bottom_radius = 1.9
	cm.height = 0.12
	_glow.mesh = cm
	var m := ShaderMaterial.new()
	m.shader = load("res://shaders/fx_portal.gdshader")
	m.set_shader_parameter("c1", Color("#b46cff"))
	m.set_shader_parameter("c2", Color("#7af4ff"))
	m.set_shader_parameter("speed", 2.5)
	_glow.material_override = m
	_glow.position.y = 0.06
	add_child(_glow)
	var l := OmniLight3D.new()
	l.light_color = Color("#b46cff")
	l.light_energy = 2.5
	l.omni_range = 7.0
	l.position.y = 1.0
	add_child(l)
	_area = Area3D.new()
	_area.collision_mask = 2
	var cs := CollisionShape3D.new()
	var c := CylinderShape3D.new()
	c.radius = 1.8
	c.height = 3.0
	cs.shape = c
	cs.position.y = 1.5
	_area.add_child(cs)
	add_child(_area)
	_area.body_entered.connect(_on_enter)
	Audio.attach_loop("crystal_hum_loop", self, -2.0, 20.0)

func _process(delta: float) -> void:
	_t += delta
	_glow.scale = Vector3(1.0, 1.0, 1.0) * (1.0 + sin(_t * 4.0) * 0.05)

func _on_enter(b: Node) -> void:
	if not b.is_in_group("player"):
		return
	var p: Player = b
	p.slime.set_charge(1.0)
	p.slime.flash(Color("#c79bff"), 0.8)
	p.slime.emote("surprised", 1.2)
	p.slime.splash(0.6, Vector3.UP)
	Audio.play("plasma_charge_full", p.global_position)
	get_tree().create_timer(0.9).timeout.connect(func(): if is_instance_valid(p): p.slime.set_charge(0.0))
	if Story.has_method("event"):
		Story.event("plasma_first_gulp")
