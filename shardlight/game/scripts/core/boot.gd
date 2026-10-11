extends Node
func _ready() -> void:
	if DevTools.args.has("world"):
		return
	get_tree().call_deferred("change_scene_to_file", Game.MENU_SCENE if ResourceLoader.exists(Game.MENU_SCENE) else Game.WORLD_SCENE)
