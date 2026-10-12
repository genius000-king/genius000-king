extends Node3D
## Fast inspection stage for Blu: flat floor, Verdant lighting, a few props, scripted states.
##   godot --path . res://scenes/dev/slime_lab.tscn -- --state=idle|run|land|charge|splash|happy|angry --out=/abs.png
var player: Player
var state := "idle"
var t := 0.0
var out := ""
var shot_at := 3.5

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--state="): state = a.substr(8)
		if a.begins_with("--out="): out = a.substr(6)
		if a.begins_with("--at="): shot_at = float(a.substr(5))
	var def := WorldDefs.get_world("verdant")
	var envi := WorldEnv.build(self, def)
	if "--nofog" in OS.get_cmdline_user_args():
		envi.env.fog_enabled = false
		envi.env.volumetric_fog_enabled = false
	var floor := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(60, 1, 60)
	cs.shape = bs
	cs.position.y = -0.5
	floor.add_child(cs)
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(60, 60)
	mi.mesh = pm
	var fm := Stylizer.material("VC", {"use_vertex_color": 0.0, "tint": Color("#7fd35e")})
	mi.material_override = fm
	floor.add_child(mi)
	add_child(floor)
	for i in 6:
		var ids := ["verdant_rock_chunk_a", "verdant_bush_berry_a", "verdant_flower_tulip_pink", "verdant_tree_puffcap_a", "verdant_flower_daisy_cream", "verdant_rock_river_a"]
		if AssetDB.has(ids[i]):
			var n := AssetDB.instantiate(ids[i])
			n.position = Vector3(cos(i * 1.1) * (3.0 + i), 0, sin(i * 1.1) * (3.0 + i) - 2.0)
			add_child(n)
	player = Player.new()
	add_child(player)
	player.teleport(Vector3(0, 0.05, 0), deg_to_rad(180))
	player.pitch = deg_to_rad(-10)
	player.yaw = deg_to_rad(200)
	player._facing = player.yaw + (PI if "--flip" in OS.get_cmdline_user_args() else 0.0)
	player.spring.spring_length = 2.1
	if state == "land":
		player.global_position.y = 2.5

func _physics_process(delta: float) -> void:
	t += delta
	match state:
		"run":
			player.move_input = Vector2(0.0, -1.0)
			player.touch_sprint = true
			player.yaw = deg_to_rad(200)
			player.move_input = Vector2(1.0, 0.0)
		"charge":
			player.slime.set_charge(clampf(t / 1.2, 0.0, 1.0))
		"splash":
			if absf(t - 2.6) < delta * 0.6:
				player.slime.splash(1.0, Vector3.UP)
				player.slime.impulse_squash(0.5)
		"happy", "angry", "surprised", "sad":
			if absf(t - 1.0) < delta * 0.6:
				player.slime.emote(state, 5.0)
	if out != "" and t >= shot_at:
		var img := get_viewport().get_texture().get_image()
		img.save_png(out)
		print("SHOT ", out)
		get_tree().quit()
		out = ""
