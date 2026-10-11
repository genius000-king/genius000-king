class_name Player
extends CharacterBody3D
## First-person controller: momentum, sprint, crouch, jump buffering/coyote time, head bob tied to strides,
## per-surface footsteps, landing impact, FOV kick, low-gravity aware. Input: keyboard/mouse, gamepad, touch.

signal footstep(surface: String, running: bool)
signal landed(impact: float)
signal interact_target_changed(target: Node)

@export var walk_speed := 4.3
@export var run_speed := 7.6
@export var crouch_speed := 2.2
@export var accel_ground := 11.0
@export var accel_air := 2.6
@export var friction := 9.0
@export var jump_height := 1.25
@export var eye_height := 1.6

var gravity := 9.8
var gravity_scale := 1.0          # abilities (Lift) modify
var world: Node = null
var head: Node3D
var camera: Camera3D
var viewmodel_anchor: Node3D
var interact_ray: RayCast3D
var yaw := 0.0
var pitch := 0.0
var input_locked := false
var look_locked := false
var sprinting := false
var crouching := false
var on_floor_prev := true
var air_time := 0.0
var fall_speed_peak := 0.0
var coyote := 0.0
var jump_buffer := 0.0
var stride_dist := 0.0
var bob_phase := 0.0
var bob_amount := 0.0
var land_dip := 0.0
var shake := 0.0
var shake_t := 0.0
var fov_target := 78.0
var extra_fov := 0.0
var interact_target: Node = null
var move_input := Vector2.ZERO     # set by touch UI too
var look_input := Vector2.ZERO     # touch look delta accumulator
var touch_sprint := false
var external_velocity := Vector3.ZERO
var _col: CollisionShape3D
var _capsule: CapsuleShape3D


func _ready() -> void:
	add_to_group("player")
	collision_layer = 2
	collision_mask = 1
	floor_max_angle = deg_to_rad(48.0)
	floor_snap_length = 0.35
	_capsule = CapsuleShape3D.new()
	_capsule.radius = 0.32
	_capsule.height = 1.75
	_col = CollisionShape3D.new()
	_col.shape = _capsule
	_col.position.y = _capsule.height * 0.5
	add_child(_col)
	head = Node3D.new()
	head.name = "Head"
	head.position.y = eye_height
	add_child(head)
	camera = Camera3D.new()
	camera.name = "Camera"
	camera.fov = Settings.fov
	camera.near = 0.05
	camera.far = 3000.0
	camera.current = true
	head.add_child(camera)
	ComicPost.attach(camera)
	viewmodel_anchor = Node3D.new()
	viewmodel_anchor.name = "ViewmodelAnchor"
	camera.add_child(viewmodel_anchor)
	interact_ray = RayCast3D.new()
	interact_ray.target_position = Vector3(0, 0, -3.2)
	interact_ray.collision_mask = 1 | 16
	interact_ray.collide_with_areas = true
	camera.add_child(interact_ray)
	fov_target = Settings.fov
	yaw = rotation.y
	Game.player = self
	if not Game.state.has("health"):
		Game.state["health"] = 100.0
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


func _unhandled_input(event: InputEvent) -> void:
	if look_locked:
		return
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		var s := Settings.mouse_sensitivity
		_apply_look(event.relative * s)
	elif event is InputEventMouseButton and event.pressed and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED and not Settings.is_mobile() and not get_tree().paused:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _apply_look(d: Vector2) -> void:
	yaw -= d.x
	pitch -= d.y * (-1.0 if Settings.invert_y else 1.0)
	pitch = clamp(pitch, deg_to_rad(-88), deg_to_rad(88))


func add_shake(amount: float) -> void:
	shake = max(shake, amount)


func _physics_process(delta: float) -> void:
	# --- look (gamepad + touch)
	var pad_look := Vector2(Input.get_joy_axis(0, JOY_AXIS_RIGHT_X), Input.get_joy_axis(0, JOY_AXIS_RIGHT_Y))
	if pad_look.length() > 0.15 and not look_locked:
		_apply_look(pad_look * pad_look.length() * 3.2 * delta)
	if look_input != Vector2.ZERO and not look_locked:
		_apply_look(look_input * Settings.touch_sensitivity)
		look_input = Vector2.ZERO
	rotation.y = yaw
	head.rotation.x = pitch
	# --- input
	var inp := Vector2.ZERO
	if not input_locked:
		inp = Vector2(
			Input.get_action_strength("move_right") - Input.get_action_strength("move_left"),
			Input.get_action_strength("move_back") - Input.get_action_strength("move_forward"))
		if move_input != Vector2.ZERO:
			inp = move_input
		inp = inp.limit_length(1.0)
	sprinting = (Input.is_action_pressed("sprint") or touch_sprint) and inp.y < -0.2 and not crouching
	if Input.is_action_just_pressed("crouch") and not input_locked:
		crouching = not crouching
	var target_speed := run_speed if sprinting else (crouch_speed if crouching else walk_speed)
	var wish := (transform.basis * Vector3(inp.x, 0, inp.y))
	wish.y = 0
	var on_floor := is_on_floor()
	# --- horizontal velocity with momentum
	var hv := Vector3(velocity.x, 0, velocity.z)
	var want := wish * target_speed
	if on_floor:
		if want.length() > 0.01:
			hv = hv.move_toward(want, accel_ground * target_speed * delta * 0.35)
		else:
			hv = hv.move_toward(Vector3.ZERO, friction * delta * max(hv.length(), 1.5))
	else:
		hv = hv.move_toward(want if want.length() > 0.01 else hv, accel_air * target_speed * delta * 0.35)
	# --- vertical
	var g := gravity * gravity_scale
	if on_floor:
		coyote = 0.12
		if velocity.y < 0:
			velocity.y = -0.5
	else:
		coyote -= delta
		velocity.y -= g * delta
		# heavier fall for snappier arcs (less so in low gravity)
		if velocity.y < 0:
			velocity.y -= g * 0.35 * delta
	if Input.is_action_just_pressed("jump") and not input_locked:
		jump_buffer = 0.14
	jump_buffer -= delta
	if jump_buffer > 0 and coyote > 0:
		velocity.y = sqrt(2.0 * g * jump_height) if gravity_scale > 0.01 else 4.0
		jump_buffer = 0
		coyote = 0
		Audio.play("jump", global_position)
		land_dip = -0.04
	velocity.x = hv.x + external_velocity.x
	velocity.z = hv.z + external_velocity.z
	external_velocity = external_velocity.move_toward(Vector3.ZERO, 12.0 * delta)
	if not on_floor:
		air_time += delta
		fall_speed_peak = min(fall_speed_peak, velocity.y)
	move_and_slide()
	# --- landing
	var now_floor := is_on_floor()
	if now_floor and not on_floor_prev and air_time > 0.12:
		var impact: float = clamp(-fall_speed_peak / 12.0, 0.0, 1.5)
		land_dip = -0.06 - impact * 0.12
		add_shake(impact * 0.25)
		Audio.play("land_hard" if impact > 0.7 else "land_soft", global_position, -4.0 + impact * 4.0)
		landed.emit(impact)
		_step(true)
	if now_floor:
		air_time = 0.0
		fall_speed_peak = 0.0
	on_floor_prev = now_floor
	# --- crouch height
	var target_eye := eye_height * (0.62 if crouching else 1.0)
	head.position.y = lerp(head.position.y, target_eye, 10.0 * delta)
	# --- strides, bob, footsteps
	var speed := Vector3(velocity.x, 0, velocity.z).length()
	if now_floor and speed > 0.4:
		var stride := 2.3 if sprinting else 1.55
		stride_dist += speed * delta
		bob_phase += speed * delta / stride * PI
		bob_amount = lerp(bob_amount, clamp(speed / run_speed, 0.0, 1.0), 6.0 * delta)
		if stride_dist >= stride:
			stride_dist -= stride
			_step(false)
	else:
		bob_amount = lerp(bob_amount, 0.0, 6.0 * delta)
	land_dip = lerp(land_dip, 0.0, 7.0 * delta)
	var bob_y := -absf(sin(bob_phase)) * 0.055 * bob_amount + land_dip
	var bob_x := cos(bob_phase) * 0.03 * bob_amount
	shake_t += delta * 40.0
	shake = move_toward(shake, 0.0, delta * 1.6)
	var sh := Vector3(sin(shake_t * 1.3), sin(shake_t * 1.7 + 1.2), 0) * shake * shake * 0.08
	camera.position = Vector3(bob_x, bob_y, 0) + sh
	camera.rotation.z = lerp(camera.rotation.z, -inp.x * 0.025 - bob_x * 0.15, 8.0 * delta)
	# --- FOV kick
	fov_target = Settings.fov + (8.0 if sprinting and speed > walk_speed + 0.5 else 0.0) + extra_fov
	camera.fov = lerp(camera.fov, fov_target, 6.0 * delta)
	# --- shader globals
	RenderingServer.global_shader_parameter_set("sl_player_pos", global_position)
	# --- interaction
	_update_interact()
	# --- void safety: fell off the shard
	if world and world.has_method("void_check"):
		world.void_check(self)


func _step(force: bool) -> void:
	var surf := "grass"
	if world and world.has_method("surface_at"):
		surf = world.surface_at(global_position)
	var ev := "step_%s_%s" % [surf, "run" if sprinting else "walk"]
	if not Audio.has_event(ev):
		ev = "step_grass_walk"
	Audio.play(ev, global_position + Vector3(0, 0.05, 0), (-8.0 if crouching else 0.0) + (2.0 if force else 0.0))
	footstep.emit(surf, sprinting)


func _update_interact() -> void:
	var t: Node = null
	if interact_ray.is_colliding():
		var c := interact_ray.get_collider()
		var n: Node = c
		while n != null and not n.has_method("interact"):
			n = n.get_parent()
		t = n
	if t != interact_target:
		interact_target = t
		interact_target_changed.emit(t)
	if t and Input.is_action_just_pressed("interact") and not input_locked:
		t.interact(self)


func look_dir() -> Vector3:
	return -camera.global_transform.basis.z


func teleport(pos: Vector3, y: float = NAN) -> void:
	global_position = pos
	velocity = Vector3.ZERO
	if not is_nan(y):
		yaw = y
		rotation.y = y
