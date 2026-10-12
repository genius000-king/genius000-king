class_name RiftGate
extends Node3D
## A comic rift portal ring. Interact → travel to `target_world`.
@export var target_world := "hub"
@export var label_ar := "البوابة"
@export var label_en := "Rift Gate"
@export var locked := false
var _disc: MeshInstance3D
var _t := 0.0

func _ready() -> void:
	var ring := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 2.0
	tm.outer_radius = 2.55
	tm.rings = 48
	tm.ring_segments = 12
	ring.mesh = tm
	ring.rotation_degrees.x = 90
	ring.position.y = 2.7
	ring.material_override = Stylizer.material("VC", {"use_vertex_color": 0.0, "tint": Color("#9d6bff")})
	add_child(ring)
	for i in 6:
		var spike := MeshInstance3D.new()
		var pm := PrismMesh.new()
		pm.size = Vector3(0.5, 1.1, 0.4)
		spike.mesh = pm
		var a := TAU * i / 6.0
		spike.position = Vector3(cos(a) * 2.6, 2.7 + sin(a) * 2.6, 0)
		spike.rotation.z = a - PI / 2
		spike.material_override = Stylizer.material("EMIT", {"use_vertex_color": 0.0, "tint": Color("#ffd166"), "emission_energy": 1.5})
		add_child(spike)
	_disc = MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(4.2, 4.2)
	_disc.mesh = qm
	_disc.position.y = 2.7
	var m := ShaderMaterial.new()
	m.shader = load("res://shaders/fx_portal.gdshader")
	_disc.material_override = m
	add_child(_disc)
	var light := OmniLight3D.new()
	light.light_color = Color("#c79bff")
	light.light_energy = 2.0
	light.omni_range = 9.0
	light.position = Vector3(0, 2.7, 1.0)
	add_child(light)
	var body := StaticBody3D.new()
	body.collision_layer = 16
	var cs := CollisionShape3D.new()
	var cyl := CylinderShape3D.new()
	cyl.radius = 2.4
	cyl.height = 5.4
	cs.shape = cyl
	cs.position.y = 2.7
	body.add_child(cs)
	add_child(body)
	Audio.attach_loop("portal_loop", self, -4.0, 25.0)

func _process(delta: float) -> void:
	_t += delta
	_disc.scale = Vector3.ONE * (1.0 + sin(_t * 2.0) * 0.03)

func interact_prompt() -> String:
	var name := label_ar if Settings.language == "ar" else label_en
	return (("ادخل: " if Settings.language == "ar" else "Enter: ") + name) if not locked else ("مقفلة" if Settings.language == "ar" else "Sealed")

func interact(_player) -> void:
	if locked:
		Game.message(interact_prompt(), "warn")
		return
	Audio.play("portal_enter", global_position)
	Game.save_game()
	Game.change_world(target_world)
