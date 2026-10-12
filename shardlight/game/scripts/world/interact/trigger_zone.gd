class_name TriggerZone
extends Area3D
## Fires Story.event(event_id) once when Blu enters.
@export var event_id := ""
@export var once := true
var _done := false

func setup(radius: float, height := 6.0) -> void:
	collision_layer = 0
	collision_mask = 2
	var cs := CollisionShape3D.new()
	var c := CylinderShape3D.new()
	c.radius = radius
	c.height = height
	cs.shape = c
	cs.position.y = height * 0.5
	add_child(cs)
	body_entered.connect(_on_enter)

func _on_enter(b: Node) -> void:
	if not b.is_in_group("player") or (_done and once):
		return
	_done = true
	if Story.has_method("event"):
		Story.event(event_id)
