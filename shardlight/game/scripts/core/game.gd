extends Node
## Global game state, world transitions and save/load.

signal world_loaded(world_id: String)
signal keystone_collected(world_id: String)
signal ability_unlocked(ability: String)
signal echo_collected(echo_id: String)
signal hud_message(text: String, kind: String)

const SAVE_PATH := "user://shardlight_save.json"
const WORLD_SCENE := "res://scenes/world.tscn"
const MENU_SCENE := "res://scenes/main_menu.tscn"

var state := {}
var pending_world := "hub"
var pending_spawn = null          # Vector3 or null → world default
var player: Node = null           # set by the player on ready
var current_world: Node = null
var playtime := 0.0
var _transition: CanvasLayer


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	new_game_state()
	_transition = CanvasLayer.new()
	_transition.layer = 100
	var rect := ColorRect.new()
	rect.name = "Fade"
	rect.color = Color(0.06, 0.04, 0.12, 0.0)
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	_transition.add_child(rect)
	add_child(_transition)
	if Story.has_signal("travel_requested"):
		Story.travel_requested.connect(func(w): change_world(w))


func _process(delta: float) -> void:
	if not get_tree().paused:
		playtime += delta


func new_game_state() -> void:
	state = {
		"version": 1,
		"world": "hub",
		"pos": null,
		"yaw": 0.0,
		"abilities": {"plasma": true, "shards": true, "dash": true},
		"keystones": [],
		"echoes": [],
		"flags": {},
		"quests": {},
		"playtime": 0.0,
	}
	playtime = 0.0


func has_ability(a: String) -> bool:
	return state.abilities.get(a, false)


func unlock_ability(a: String) -> void:
	if has_ability(a):
		return
	state.abilities[a] = true
	ability_unlocked.emit(a)


func flag(f: String, default = false):
	return state.flags.get(f, default)


func set_flag(f: String, v = true) -> void:
	state.flags[f] = v


func collect_keystone(world_id: String) -> void:
	if world_id in state.keystones:
		return
	state.keystones.append(world_id)
	keystone_collected.emit(world_id)
	save_game()


func collect_echo(echo_id: String) -> void:
	if echo_id in state.echoes:
		return
	state.echoes.append(echo_id)
	echo_collected.emit(echo_id)


func message(text: String, kind := "info") -> void:
	hud_message.emit(text, kind)


# ------------------------------------------------------------------ worlds
func change_world(world_id: String, spawn = null) -> void:
	pending_world = world_id
	pending_spawn = spawn
	await fade_out(0.6)
	state.world = world_id
	get_tree().paused = false
	get_tree().change_scene_to_file(WORLD_SCENE)


func on_world_ready(world: Node) -> void:
	current_world = world
	world_loaded.emit(pending_world)
	fade_in(1.0)


func fade_out(t := 0.5) -> void:
	var r: ColorRect = _transition.get_node("Fade")
	var tw := create_tween()
	tw.tween_property(r, "color:a", 1.0, t)
	await tw.finished


func fade_in(t := 0.8) -> void:
	var r: ColorRect = _transition.get_node("Fade")
	var tw := create_tween()
	tw.tween_property(r, "color:a", 0.0, t)


func to_menu() -> void:
	await fade_out(0.5)
	get_tree().paused = false
	get_tree().change_scene_to_file(MENU_SCENE)
	fade_in(0.6)


# ------------------------------------------------------------------ save
func save_game() -> void:
	if player and is_instance_valid(player):
		var p: Vector3 = player.global_position
		state.pos = [p.x, p.y, p.z]
		state.yaw = player.rotation.y
	state.playtime = playtime
	state.quests = Story.quest_state() if Story.has_method("quest_state") else state.quests
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(state, "\t"))


func has_save() -> bool:
	return FileAccess.file_exists(SAVE_PATH)


func load_game() -> bool:
	if not has_save():
		return false
	var d = JSON.parse_string(FileAccess.get_file_as_string(SAVE_PATH))
	if typeof(d) != TYPE_DICTIONARY:
		return false
	new_game_state()
	for k in d:
		state[k] = d[k]
	playtime = float(state.get("playtime", 0.0))
	if Story.has_method("restore_quests"):
		Story.restore_quests(state.get("quests", {}))
	var spawn = null
	if state.pos is Array and state.pos.size() == 3:
		spawn = Vector3(state.pos[0], state.pos[1], state.pos[2])
	change_world(state.world, spawn)
	return true
