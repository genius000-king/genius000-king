class_name StorySign
extends Node3D
## A readable signpost/note: interact → dialogue (sign_* ids).
@export var dialogue_id := "sign_hub_crater"
@export var model_id := "common_town_signpost"

func _ready() -> void:
	add_to_group("npc")
	set_meta("npc_id", dialogue_id)
	if AssetDB.has(model_id):
		add_child(AssetDB.instantiate(model_id))
	var body := StaticBody3D.new()
	body.collision_layer = 1 | 16
	var cs := CollisionShape3D.new()
	var b := BoxShape3D.new()
	b.size = Vector3(1.2, 2.6, 0.5)
	cs.shape = b
	cs.position.y = 1.3
	body.add_child(cs)
	add_child(body)

func interact_prompt() -> String:
	return "اقرأ" if Settings.language == "ar" else "Read"

func interact(_p) -> void:
	if Story.has_method("start_dialogue"):
		Story.start_dialogue(dialogue_id)
