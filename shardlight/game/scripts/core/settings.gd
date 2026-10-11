extends Node
## Quality presets + user options. Persisted to user://settings.cfg.

enum Quality { LOW, MEDIUM, HIGH, ULTRA }

var quality: int = Quality.HIGH
var mouse_sensitivity := 0.0022
var touch_sensitivity := 0.0045
var fov := 78.0
var language := "ar"
var master_db := 0.0
var music_db := -4.0
var sfx_db := 0.0
var invert_y := false
var show_fps := false

const PATH := "user://settings.cfg"


const ACTIONS := {
	"move_forward": [KEY_W, KEY_UP, ["axis", JOY_AXIS_LEFT_Y, -1.0]],
	"move_back": [KEY_S, KEY_DOWN, ["axis", JOY_AXIS_LEFT_Y, 1.0]],
	"move_left": [KEY_A, KEY_LEFT, ["axis", JOY_AXIS_LEFT_X, -1.0]],
	"move_right": [KEY_D, KEY_RIGHT, ["axis", JOY_AXIS_LEFT_X, 1.0]],
	"jump": [KEY_SPACE, ["joy", JOY_BUTTON_A]],
	"sprint": [KEY_SHIFT, ["joy", JOY_BUTTON_LEFT_STICK]],
	"crouch": [KEY_C, KEY_CTRL, ["joy", JOY_BUTTON_B]],
	"interact": [KEY_E, KEY_F, ["joy", JOY_BUTTON_X]],
	"fire": [["mouse", MOUSE_BUTTON_LEFT], ["axis", JOY_AXIS_TRIGGER_RIGHT, 1.0]],
	"alt_fire": [["mouse", MOUSE_BUTTON_RIGHT], ["axis", JOY_AXIS_TRIGGER_LEFT, 1.0]],
	"weapon_next": [KEY_Q, ["mouse", MOUSE_BUTTON_WHEEL_UP], ["joy", JOY_BUTTON_RIGHT_SHOULDER]],
	"weapon_prev": [["mouse", MOUSE_BUTTON_WHEEL_DOWN], ["joy", JOY_BUTTON_LEFT_SHOULDER]],
	"ability_1": [KEY_1, ["joy", JOY_BUTTON_Y]],
	"ability_2": [KEY_2, ["joy", JOY_BUTTON_DPAD_UP]],
	"ability_3": [KEY_3, ["joy", JOY_BUTTON_DPAD_RIGHT]],
	"dash": [KEY_R, KEY_ALT, ["joy", JOY_BUTTON_RIGHT_STICK]],
	"journal": [KEY_J, KEY_TAB, ["joy", JOY_BUTTON_BACK]],
	"pause": [KEY_ESCAPE, KEY_P, ["joy", JOY_BUTTON_START]],
	"photo": [KEY_F12],
}


func _register_actions() -> void:
	for a in ACTIONS:
		if InputMap.has_action(a):
			continue
		InputMap.add_action(a, 0.2)
		for b in ACTIONS[a]:
			var ev: InputEvent
			if b is int:
				ev = InputEventKey.new()
				ev.physical_keycode = b
			elif b[0] == "mouse":
				ev = InputEventMouseButton.new()
				ev.button_index = b[1]
			elif b[0] == "joy":
				ev = InputEventJoypadButton.new()
				ev.button_index = b[1]
			else:
				ev = InputEventJoypadMotion.new()
				ev.axis = b[1]
				ev.axis_value = b[2]
			InputMap.action_add_event(a, ev)


func _ready() -> void:
	_register_actions()
	if is_mobile():
		quality = Quality.MEDIUM
	_load()
	apply_audio()
	TranslationServer.set_locale(language)


func is_mobile() -> bool:
	return OS.has_feature("mobile") or OS.has_feature("android") or OS.has_feature("ios")


func view_distance() -> float:
	return [300.0, 420.0, 640.0, 900.0][quality]


func scatter_enabled() -> bool:
	return true


func grass_radius() -> float:
	return [26.0, 38.0, 56.0, 72.0][quality]


func grass_density() -> float:
	return [0.45, 0.7, 1.0, 1.35][quality]


func shadows_size() -> int:
	return [1024, 2048, 4096, 4096][quality]


func outlines(kind: String) -> bool:
	if kind == "TERRAIN":
		return false   # terrain is inked by the screen-space pass (hulls on heightfields look bad)
	if is_mobile() and kind == "VC_FOLIAGE":
		return quality >= Quality.HIGH
	return true


func screen_ink() -> bool:
	return quality >= Quality.MEDIUM


func volumetric_fog() -> bool:
	return quality >= Quality.HIGH and not is_mobile()


func ssao() -> bool:
	return quality >= Quality.HIGH and not is_mobile()


func render_scale() -> float:
	return [0.6, 0.75, 1.0, 1.0][quality] if is_mobile() else [0.75, 0.9, 1.0, 1.0][quality]


func apply_audio() -> void:
	var m := AudioServer.get_bus_index("Master")
	if m >= 0:
		AudioServer.set_bus_volume_db(m, master_db)
	for pair in [["Music", music_db], ["SFX", sfx_db]]:
		var i := AudioServer.get_bus_index(pair[0])
		if i >= 0:
			AudioServer.set_bus_volume_db(i, pair[1])


func save() -> void:
	var c := ConfigFile.new()
	for k in ["quality", "mouse_sensitivity", "touch_sensitivity", "fov", "language", "master_db", "music_db", "sfx_db", "invert_y", "show_fps"]:
		c.set_value("settings", k, get(k))
	c.save(PATH)


func _load() -> void:
	var c := ConfigFile.new()
	if c.load(PATH) != OK:
		return
	for k in c.get_section_keys("settings"):
		set(k, c.get_value("settings", k))
