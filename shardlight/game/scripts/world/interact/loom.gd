class_name LoomMachine
extends Node3D
## The Loom: the hub's hero landmark. Interact → install Keystones / story (dialogue id "loom").
var model: Node3D
var _prism: Node3D
var _t := 0.0

func _ready() -> void:
	if AssetDB.has("hub_loom_core"):
		model = AssetDB.instantiate("hub_loom_core")
		add_child(model)
		_prism = model.find_child("loom_prism", true, false)
		var shp := AssetDB.shape("hub_loom_core")
		if shp:
			var body := StaticBody3D.new()
			body.set_meta("surface", "metal")
			var cs := CollisionShape3D.new()
			cs.shape = shp
			body.add_child(cs)
			add_child(body)
	var l := OmniLight3D.new()
	l.light_color = Color("#9d6bff")
	l.light_energy = 3.0
	l.omni_range = 22.0
	l.position.y = 8.0
	add_child(l)
	var talk := StaticBody3D.new()
	talk.collision_layer = 16
	var cs2 := CollisionShape3D.new()
	var cyl := CylinderShape3D.new()
	cyl.radius = 6.0
	cyl.height = 4.0
	cs2.shape = cyl
	cs2.position.y = 2.0
	talk.add_child(cs2)
	add_child(talk)
	Audio.attach_loop("loom_hum_loop", self, 0.0, 60.0)

func _process(delta: float) -> void:
	_t += delta
	if _prism:
		_prism.rotation.y += delta * 0.6
		_prism.position.y = sin(_t) * 0.15

func interact_prompt() -> String:
	return "النَّوْل" if Settings.language == "ar" else "The Loom"

func interact(_p) -> void:
	if Story.has_method("start_dialogue"):
		Story.start_dialogue("loom")
	if Story.has_method("event"):
		Story.event("loom_interact")
