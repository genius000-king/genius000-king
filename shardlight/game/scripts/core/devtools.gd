extends Node
## Automation for verification: screenshots and scripted camera placement from the command line.
##   godot --path game -- --world=verdant --pos=x,y,z --yaw=deg --pitch=deg --shot=res://../shots/a.png --wait=6
## Also F12 in game saves a screenshot to user://shots/.

var args := {}
var _shots_taken := 0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--"):
			var kv := a.substr(2).split("=", true, 1)
			args[kv[0]] = kv[1] if kv.size() > 1 else "1"
	if args.has("world"):
		Game.pending_world = args.world
		call_deferred("_goto_world")
	if args.has("shot"):
		_run_shots()
	if args.has("itest"):
		var t = (load("res://scripts/dev/integration_test.gd") as GDScript).new()
		add_child(t)
		t.call_deferred("run")
	if args.has("debug"):
		_debug_loop()
	if args.has("nearby"):
		_nearby()


func _goto_world() -> void:
	get_tree().change_scene_to_file("res://scenes/world.tscn")


func _run_shots() -> void:
	# wait for world ready + extra seconds for streaming to settle
	var wait := float(args.get("wait", "5"))
	var deadline := Time.get_ticks_msec() + 120000
	while Game.current_world == null and Time.get_ticks_msec() < deadline and args.has("world"):
		await get_tree().process_frame
	if args.has("pos") and Game.player:
		var p: PackedStringArray = args.pos.split(",")
		var pos := Vector3(float(p[0]), float(p[1]), float(p[2]))
		if args.get("ground", "0") == "1" and Game.current_world:
			pos.y += Game.current_world.height_at(pos.x, pos.z)
		if Game.current_world and Game.current_world.has_method("place_player") and args.get("fly", "0") != "1":
			await Game.current_world.place_player(pos, deg_to_rad(float(args.get("yaw", "0"))))
		else:
			Game.player.teleport(pos, deg_to_rad(float(args.get("yaw", "0"))))
		Game.player.pitch = deg_to_rad(float(args.get("pitch", "0")))
		if Game.player.get("_facing") != null and args.has("face_cam"):
			Game.player._facing = Game.player.yaw
		if args.get("fly", "0") == "1":
			Game.player.set_physics_process(false)
			Game.player.rotation.y = Game.player.yaw
			Game.player.head.rotation.x = Game.player.pitch
	if args.has("exec") and Game.current_world:
		# optional hook: call a method on world content for staged shots
		var c = Game.current_world.get("content")
		if c and c.has_method(args.exec):
			c.call(args.exec)
	var t0 := Time.get_ticks_msec()
	while Time.get_ticks_msec() - t0 < wait * 1000.0:
		await get_tree().process_frame
	var shots: PackedStringArray = args.shot.split(";")
	for i in shots.size():
		await RenderingServer.frame_post_draw
		var img := get_viewport().get_texture().get_image()
		var path: String = shots[i]
		if path.begins_with("res://"):
			path = ProjectSettings.globalize_path(path)
		DirAccess.make_dir_recursive_absolute(path.get_base_dir())
		img.save_png(path)
		print("SHOT ", path, " fps=", Engine.get_frames_per_second())
		if i < shots.size() - 1:
			await get_tree().create_timer(float(args.get("interval", "1"))).timeout
	get_tree().quit()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("photo"):
		var img := get_viewport().get_texture().get_image()
		DirAccess.make_dir_recursive_absolute("user://shots")
		_shots_taken += 1
		img.save_png("user://shots/shot_%d_%d.png" % [Time.get_unix_time_from_system(), _shots_taken])


func _debug_loop() -> void:
	for i in 12:
		await get_tree().create_timer(1.0).timeout
		var w = Game.current_world
		if w == null:
			w = get_tree().current_scene
		if w and w.get("grass"):
			var g = w.grass
			var n := 0
			for k in g._tiles:
				if g._tiles[k]:
					n += g._tiles[k].multimesh.instance_count
			print("DBG t=", i, " grass tiles=", g._tiles.size(), " inst=", n, " pending=", g._pending.size(), " chunks=", w.terrain._chunks.size())


func _nearby() -> void:
	await get_tree().create_timer(8.0).timeout
	var q: PackedStringArray = args.nearby.split(",")
	var c := Vector3(float(q[0]), 0, float(q[1]))
	var r := float(q[2])
	for mmi in get_tree().root.find_children("*", "MultiMeshInstance3D", true, false):
		var mm: MultiMesh = mmi.multimesh
		if mm == null or mm.mesh == null:
			continue
		for i in mm.instance_count:
			var p: Vector3 = mmi.global_transform * mm.get_instance_transform(i).origin
			if Vector2(p.x - c.x, p.z - c.z).length() < r and mm.mesh.get_surface_count() > 0 and not mm.use_custom_data:
				print("NEAR ", mm.mesh.resource_name, " ", p.snapped(Vector3.ONE * 0.1))
	get_tree().quit()
