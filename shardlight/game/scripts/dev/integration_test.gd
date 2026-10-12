extends Node
## In-engine M1 critical path: real worlds, real nodes. Run:
##   godot --headless --path . -- --world=hub --itest=1
## Prints PASS/FAIL lines and quits with exit code.
var fails := 0

func check(name: String, ok: bool) -> void:
	print(("PASS " if ok else "FAIL ") + name)
	if not ok:
		fails += 1

func run() -> void:
	get_tree().create_timer(200.0).timeout.connect(func():
		print("FAIL watchdog timeout")
		print("ITEST DONE fails=%d" % (fails + 1))
		get_tree().quit(2))
	await _wait_world()
	var w = Game.current_world
	check("hub loaded", w != null and w.world_id == "hub")
	check("Loom present", w.content.find_children("*", "LoomMachine", true, false).size() > 0 or _has_class(w.content, LoomMachine))
	check("story prologue fired", Game.flag("ev_hub_wake") or Game.flag("prologue_done") or Story.is_in_dialogue())
	# drain the opening dialogue
	for i in 80:
		if Story.is_in_dialogue():
			Story.advance()
		await get_tree().process_frame
	# gulp at the vent
	var vent = _first(w.content, PlasmaVent)
	check("plasma vent present", vent != null)
	if vent:
		w.player.global_position = vent.global_position + Vector3(0, 0.3, 0)
		for i in 30:
			await get_tree().physics_frame
	check("first gulp flag", Game.flag("gulped"))
	# wake the Verdant gate with plasma
	var gate: RiftGate = null
	for g in w.content.find_children("*", "", true, false):
		if g is RiftGate and g.target_world == "verdant":
			gate = g
	check("verdant gate present", gate != null)
	if gate:
		gate.take_damage(50.0, gate.global_position, Vector3.FORWARD, "plasma")
	check("gate awake", Game.flag("gate_verdant_awake"))
	for i in 60:
		if Story.is_in_dialogue():
			Story.advance()
		await get_tree().process_frame
	Game.change_world("verdant")
	await get_tree().create_timer(1.0).timeout
	Game.current_world = null
	await _wait_world()
	w = Game.current_world
	check("verdant loaded", w != null and w.world_id == "verdant")
	check("NPCs spawned", get_tree().get_nodes_in_group("npc").size() >= 5)
	check("echoes placed", _count(w.content, EchoPickup) >= 10)
	for ev in ["arrive_verdant", "enter_village", "trial_float_done", "trial_bloom_done"]:
		Story.event(ev)
	for e in _all(w.content, EchoPickup):
		if String(e.echo_id).begins_with("echo_trial_"):
			e.interact(w.player)
	await get_tree().process_frame
	check("trial echo done", Game.flag("trial_echo"))
	check("sanctum open", Game.flag("sanctum_open"))
	var k = _first(w.content, KeystonePickup)
	check("keystone present", k != null)
	if k:
		k.interact(w.player)
	await get_tree().create_timer(0.5).timeout
	check("keystone collected", "verdant" in Game.state.keystones)
	check("lift unlocked", Game.has_ability("lift"))
	for i in 120:
		if Story.is_in_dialogue():
			Story.advance()
		await get_tree().process_frame
	print("ITEST DONE fails=%d" % fails)
	get_tree().quit(1 if fails > 0 else 0)

func _wait_world() -> void:
	for i in 3000:
		if Game.current_world != null:
			return
		await get_tree().process_frame

func _all(root: Node, cls) -> Array:
	var out := []
	for n in root.find_children("*", "", true, false):
		if is_instance_of(n, cls):
			out.append(n)
	return out

func _first(root: Node, cls):
	var a := _all(root, cls)
	return a[0] if a.size() > 0 else null

func _count(root: Node, cls) -> int:
	return _all(root, cls).size()

func _has_class(root: Node, cls) -> bool:
	return _count(root, cls) > 0
