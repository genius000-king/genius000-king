class_name Player
extends CharacterBody3D
## Blu the slime. Third-person orbit camera (default) with first-person toggle; gliding hop locomotion with
## squash/stretch; buffered/coyote jumps; landing splats; aim point; hitstop.
## Contract: docs/CONTRACTS.md (Player section).

signal footstep(surface: String, running: bool)
signal landed(impact: float)
signal jumped
signal interact_target_changed(target: Node)

@export var walk_speed := 4.6
@export var run_speed := 8.2
@export var crouch_speed := 2.0
@export var accel_ground := 13.0
@export var accel_air := 4.0
@export var friction := 10.0
@export var jump_height := 1.7

const CAM_PIVOT_H := 0.85
const CAM_DIST := 3.4

var gravity := 9.8
var gravity_scale := 1.0
var world: Node = null
var body_pivot: Node3D
var slime: SlimeBody
var cam_root: Node3D
var cam_yaw_node: Node3D
var cam_pitch_node: Node3D
var spring: SpringArm3D
var camera: Camera3D
var head: Node3D                 # compatibility (= cam_pitch_node)
var viewmodel_anchor: Node3D     # compatibility: = slime mouth anchor
var yaw := 0.0
var pitch := deg_to_rad(-14.0)
var input_locked := false
var look_locked := false
var sprinting := false
var crouching := false
var aiming := false              # weapons set this while charging/firing: Blu faces the camera direction
var on_floor_prev := true
var air_time := 0.0
var fall_speed_peak := 0.0
var coyote := 0.0
var jump_buffer := 0.0
var shake := 0.0
var shake_t := 0.0
var extra_fov := 0.0
var interact_target: Node = null
var move_input := Vector2.ZERO
var look_input := Vector2.ZERO
var touch_sprint := false
var external_velocity := Vector3.ZERO
var bob_phase := 0.0
var bob_amount := 0.0
var first_person := false
var _col: CollisionShape3D
var _hitstop_t := 0.0
var _facing := 0.0
var _interact_area: Area3D


func _ready() -> void:
	add_to_group("player")
	collision_layer = 2
	collision_mask = 1
	floor_max_angle = deg_to_rad(50.0)
	floor_snap_length = 0.3
	var cap := CapsuleShape3D.new()
	cap.radius = 0.36
	cap.height = 0.78
	_col = CollisionShape3D.new()
	_col.shape = cap
	_col.position.y = cap.height * 0.5
	add_child(_col)
	body_pivot = Node3D.new()
	body_pivot.name = "BodyPivot"
	add_child(body_pivot)
	slime = SlimeBody.new()
	slime.name = "Slime"
	body_pivot.add_child(slime)
	slime.hop_contact.connect(_on_hop_contact)
	cam_root = Node3D.new()
	cam_root.name = "CamRoot"
	cam_root.top_level = true
	add_child(cam_root)
	cam_yaw_node = Node3D.new()
	cam_root.add_child(cam_yaw_node)
	cam_pitch_node = Node3D.new()
	cam_yaw_node.add_child(cam_pitch_node)
	head = cam_pitch_node
	spring = SpringArm3D.new()
	spring.spring_length = CAM_DIST
	spring.collision_mask = 1
	spring.margin = 0.25
	var sph := SphereShape3D.new()
	sph.radius = 0.25
	spring.shape = sph
	spring.add_excluded_object(get_rid())
	cam_pitch_node.add_child(spring)
	camera = Camera3D.new()
	camera.name = "Camera"
	camera.fov = Settings.fov
	camera.near = 0.05
	camera.far = 3000.0
	camera.current = true
	spring.add_child(camera)
	ComicPost.attach(camera)
	viewmodel_anchor = slime.mouth_anchor
	_interact_area = Area3D.new()
	_interact_area.collision_layer = 0
	_interact_area.collision_mask = 1 | 16
	var s := CollisionShape3D.new()
	var ss := SphereShape3D.new()
	ss.radius = 2.4
	s.shape = ss
	s.position.y = 0.5
	_interact_area.add_child(s)
	add_child(_interact_area)
	yaw = rotation.y
	rotation = Vector3.ZERO
	_facing = yaw + PI
	cam_root.global_position = global_position + Vector3(0, CAM_PIVOT_H, 0)
	Game.player = self
	if not Game.state.has("health"):
		Game.state["health"] = 100.0
	set_first_person(Settings.first_person)
	if Story.has_signal("blu_emote"):
		Story.blu_emote.connect(func(e): slime.emote(e))
	_attach_plugin("res://scripts/weapons/weapon_system.gd", "Weapons")
	_attach_plugin("res://scripts/weapons/ability_system.gd", "Abilities")
	if not Settings.is_mobile():
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _attach_plugin(path: String, node_name: String) -> void:
	if not ResourceLoader.exists(path):
		return
	var n = (load(path) as GDScript).new()
	n.name = node_name
	add_child(n)
	if n.has_method("setup"):
		n.setup(self)


func set_world_gravity(g: float) -> void:
	gravity = g


func set_first_person(fp: bool) -> void:
	first_person = fp
	spring.spring_length = 0.0 if fp else CAM_DIST
	for n in ["eye_L", "eye_R", "pupil_L", "pupil_R", "glint_L", "glint_R", "brow_L", "brow_R", "cap"]:
		if slime.parts.has(n):
			slime.parts[n].visible = not fp


func _unhandled_input(event: InputEvent) -> void:
	if look_locked:
		return
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_apply_look(event.relative * Settings.mouse_sensitivity)
	elif event is InputEventMouseButton and event.pressed and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED and not Settings.is_mobile() and not get_tree().paused:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _apply_look(d: Vector2) -> void:
	yaw -= d.x
	pitch -= d.y * (-1.0 if Settings.invert_y else 1.0)
	pitch = clampf(pitch, deg_to_rad(-75), deg_to_rad(60))


func add_shake(amount: float) -> void:
	shake = maxf(shake, amount)


func hitstop(seconds: float) -> void:
	_hitstop_t = maxf(_hitstop_t, seconds)
	Engine.time_scale = 0.05


func look_dir() -> Vector3:
	return -camera.global_transform.basis.z


func aim_point() -> Vector3:
	var from := camera.global_position
	var to := from + look_dir() * 400.0
	var q := PhysicsRayQueryParameters3D.create(from, to, 1 | 4)
	q.exclude = [get_rid()]
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	return hit.position if hit else to


func _process(delta: float) -> void:
	if _hitstop_t > 0.0:
		_hitstop_t -= delta / maxf(Engine.time_scale, 0.01)
		if _hitstop_t <= 0.0:
			Engine.time_scale = 1.0
	_update_camera(delta)


func _update_camera(delta: float) -> void:
	var pad_look := Vector2(Input.get_joy_axis(0, JOY_AXIS_RIGHT_X), Input.get_joy_axis(0, JOY_AXIS_RIGHT_Y))
	if pad_look.length() > 0.15 and not look_locked:
		_apply_look(pad_look * pad_look.length() * 3.0 * delta)
	if look_input != Vector2.ZERO and not look_locked:
		_apply_look(look_input * Settings.touch_sensitivity)
		look_input = Vector2.ZERO
	var target := global_position + Vector3(0, 0.5 if first_person else CAM_PIVOT_H, 0)
	if first_person:
		cam_root.global_position = target
	else:
		var cp := cam_root.global_position
		cp.x = lerpf(cp.x, target.x, 1.0 - exp(-delta * 14.0))
		cp.z = lerpf(cp.z, target.z, 1.0 - exp(-delta * 14.0))
		cp.y = lerpf(cp.y, target.y, 1.0 - exp(-delta * 7.0))
		cam_root.global_position = cp
	cam_yaw_node.rotation.y = yaw
	cam_pitch_node.rotation.x = pitch
	shake_t += delta * 40.0
	shake = move_toward(shake, 0.0, delta * 1.8)
	var sh := Vector3(sin(shake_t * 1.3), sin(shake_t * 1.7 + 1.2), 0) * shake * shake * 0.12
	spring.position = Vector3(0.0 if first_person else 0.35, 0, 0) + sh
	var speed := Vector3(velocity.x, 0, velocity.z).length()
	var fov_t := Settings.fov + (7.0 if sprinting and speed > walk_speed + 0.5 else 0.0) + extra_fov
	camera.fov = lerpf(camera.fov, fov_t, 1.0 - exp(-delta * 6.0))
	RenderingServer.global_shader_parameter_set("sl_player_pos", global_position)


func _physics_process(delta: float) -> void:
	var inp := Vector2.ZERO
	if not input_locked:
		inp = Vector2(
			Input.get_action_strength("move_right") - Input.get_action_strength("move_left"),
			Input.get_action_strength("move_back") - Input.get_action_strength("move_forward"))
		if move_input != Vector2.ZERO:
			inp = move_input
		inp = inp.limit_length(1.0)
	sprinting = (Input.is_action_pressed("sprint") or touch_sprint) and inp.length() > 0.3 and not crouching
	if Input.is_action_just_pressed("crouch") and not input_locked:
		crouching = not crouching
	var target_speed := run_speed if sprinting else (crouch_speed if crouching else walk_speed)
	var wish := Basis(Vector3.UP, yaw) * Vector3(inp.x, 0, inp.y)
	var on_floor := is_on_floor()
	var hv := Vector3(velocity.x, 0, velocity.z)
	var want := wish * target_speed
	if on_floor:
		if want.length() > 0.01:
			hv = hv.move_toward(want, accel_ground * target_speed * delta * 0.35)
		else:
			hv = hv.move_toward(Vector3.ZERO, friction * delta * maxf(hv.length(), 1.5))
	else:
		hv = hv.move_toward(want if want.length() > 0.01 else hv, accel_air * target_speed * delta * 0.35)
	var g := gravity * gravity_scale
	if on_floor:
		coyote = 0.12
		if velocity.y < 0:
			velocity.y = -0.5
	else:
		coyote -= delta
		velocity.y -= g * delta
		if velocity.y < 0:
			velocity.y -= g * 0.45 * delta
	if Input.is_action_just_pressed("jump") and not input_locked:
		jump_buffer = 0.14
	jump_buffer -= delta
	if jump_buffer > 0 and coyote > 0:
		velocity.y = sqrt(2.0 * g * jump_height) if gravity_scale > 0.01 else 4.0
		jump_buffer = 0
		coyote = 0
		slime.impulse_squash(-0.55)
		slime.emote("happy", 0.5)
		Audio.play("jump", global_position)
		jumped.emit()
	velocity.x = hv.x + external_velocity.x
	velocity.z = hv.z + external_velocity.z
	external_velocity = external_velocity.move_toward(Vector3.ZERO, 12.0 * delta)
	if not on_floor:
		air_time += delta
		fall_speed_peak = minf(fall_speed_peak, velocity.y)
	move_and_slide()
	var now_floor := is_on_floor()
	if now_floor and not on_floor_prev and air_time > 0.1:
		var impact := clampf(-fall_speed_peak / 11.0, 0.0, 1.6)
		slime.impulse_squash(0.35 + impact * 0.45)
		add_shake(impact * 0.3)
		Audio.play("land_hard" if impact > 0.7 else "land_soft", global_position, -3.0 + impact * 4.0)
		landed.emit(impact)
		_step(true)
	if now_floor:
		air_time = 0.0
		fall_speed_peak = 0.0
	on_floor_prev = now_floor
	var face_target := _facing
	if aiming or first_person:
		face_target = yaw + PI
	elif hv.length() > 0.4:
		face_target = atan2(hv.x, hv.z)
	_facing = lerp_angle(_facing, face_target, 1.0 - exp(-delta * (16.0 if aiming else 10.0)))
	body_pivot.rotation.y = _facing
	var speed := hv.length()
	slime.move_speed = speed if now_floor else 0.0
	slime.grounded = now_floor
	var local_v := body_pivot.global_transform.basis.inverse() * hv
	var lean_amt := 0.05 if sprinting else 0.03
	slime.lean_target = Vector2(0.0, clampf(local_v.z * lean_amt, -0.35, 0.35)) if now_floor else Vector2.ZERO
	slime.look_at_world(aim_point() if aiming else camera.global_position + look_dir() * 30.0)
	bob_phase = slime.hop_phase * PI
	bob_amount = clampf(speed / run_speed, 0.0, 1.0)
	_update_interact()
	if world and world.has_method("void_check"):
		world.void_check(self)


func _on_hop_contact(_strength: float) -> void:
	_step(false)


func _step(force: bool) -> void:
	var surf := "grass"
	if world and world.has_method("surface_at"):
		surf = world.surface_at(global_position)
	var ev := "step_%s_%s" % [surf, "run" if sprinting else "walk"]
	if not Audio.has_event(ev):
		ev = "step_grass_walk"
	Audio.play(ev, global_position + Vector3(0, 0.05, 0), (-8.0 if crouching else -2.0) + (2.0 if force else 0.0), 1.15)
	footstep.emit(surf, sprinting)


func _update_interact() -> void:
	var best: Node = null
	var best_score := INF
	var fwd := -Vector3(sin(yaw), 0, cos(yaw))
	for o in _interact_area.get_overlapping_bodies() + _interact_area.get_overlapping_areas():
		var n: Node = o
		while n != null and not n.has_method("interact"):
			n = n.get_parent()
		if n == null or n == self:
			continue
		var d: Vector3 = (n as Node3D).global_position - global_position
		var score := d.length() - fwd.dot(d.normalized()) * 1.2
		if score < best_score:
			best_score = score
			best = n
	if best != interact_target:
		interact_target = best
		interact_target_changed.emit(best)
	if best and Input.is_action_just_pressed("interact") and not input_locked:
		best.interact(self)


func teleport(pos: Vector3, y: float = NAN) -> void:
	global_position = pos
	velocity = Vector3.ZERO
	if not is_nan(y):
		yaw = y
		_facing = y + PI
	if cam_root:
		cam_root.global_position = pos + Vector3(0, CAM_PIVOT_H, 0)
