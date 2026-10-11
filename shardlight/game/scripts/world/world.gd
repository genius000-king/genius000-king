class_name ShardWorld
extends Node3D
## Root of a playable shard world. Builds environment, terrain streaming, grass, water, player and the
## world's content (via a per-world content script when present: res://scripts/worlds/<id>_content.gd).

@export var world_id := "verdant"

var def: Dictionary
var field: TerrainField
var terrain: TerrainStreamer
var grass: GrassField
var player: Player
var env_info: Dictionary
var water: MeshInstance3D
var content: Node
var _ready_done := false
var _loading: CanvasLayer


func _ready() -> void:
	if Game.pending_world != "":
		world_id = Game.pending_world
	def = WorldDefs.get_world(world_id)
	field = TerrainField.new(def)
	env_info = WorldEnv.build(self, def)
	RenderingServer.global_shader_parameter_set("sl_wind", Vector4(0.8, 0.45, 0.6, 0.4))
	# player
	player = Player.new()
	player.name = "Player"
	player.world = self
	player.set_world_gravity(def.gravity)
	add_child(player)
	var spawn: Vector3 = def.spawn
	var yaw := deg_to_rad(float(def.get("spawn_yaw", 0.0)))
	if Game.pending_spawn is Vector3:
		spawn = Game.pending_spawn
		yaw = float(Game.state.get("yaw", yaw))
	spawn.y = field.height_at(spawn.x, spawn.z) + 1.0
	player.teleport(spawn, yaw)
	player.set_physics_process(false)
	# terrain
	terrain = TerrainStreamer.new()
	terrain.name = "Terrain"
	add_child(terrain)
	terrain.setup(world_id, field, player)
	terrain.initial_area_ready.connect(_on_initial_ready)
	# grass
	grass = GrassField.new()
	grass.name = "Grass"
	add_child(grass)
	grass.setup(field, player, def.grass)
	# water
	_build_water()
	# per-world content
	var cpath := "res://scripts/worlds/%s_content.gd" % world_id
	if ResourceLoader.exists(cpath):
		content = (load(cpath) as GDScript).new()
		content.name = "Content"
		add_child(content)
		if content.has_method("setup"):
			content.setup(self)
	_show_loading()
	Audio.music(def.get("music", ""))
	Audio.ambience(def.get("ambience", ""))


func _build_water() -> void:
	if float(def.sea_level) < -40.0:
		return
	water = MeshInstance3D.new()
	var pm := PlaneMesh.new()
	var r: float = def.radius
	pm.size = Vector2(r * 2.1, r * 2.1)
	pm.subdivide_width = 96
	pm.subdivide_depth = 96
	water.mesh = pm
	var m := Stylizer.material("WATER", {}).duplicate() as ShaderMaterial
	m.set_shader_parameter("noise_tex", Stylizer.brush_texture())
	m.set_shader_parameter("shallow_color", def.water.shallow)
	m.set_shader_parameter("deep_color", def.water.deep)
	water.material_override = m
	water.position.y = def.sea_level
	water.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(water)


func _show_loading() -> void:
	_loading = CanvasLayer.new()
	_loading.layer = 90
	var bg := ColorRect.new()
	bg.color = Color("#140c26")
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	_loading.add_child(bg)
	var lbl := Label.new()
	lbl.text = "%s\n%s" % [def.name_ar, def.name_en]
	lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	lbl.set_anchors_preset(Control.PRESET_FULL_RECT)
	lbl.add_theme_font_size_override("font_size", 42)
	lbl.add_theme_color_override("font_color", Color("#d8c8ff"))
	_loading.add_child(lbl)
	add_child(_loading)


func _on_initial_ready() -> void:
	if _ready_done:
		return
	_ready_done = true
	# settle player on the ground
	var p := player.global_position
	p.y = field.height_at(p.x, p.z) + 0.2
	player.global_position = p
	player.set_physics_process(true)
	if is_instance_valid(_loading):
		var t := create_tween()
		for c in _loading.get_children():
			t.parallel().tween_property(c, "modulate:a", 0.0, 0.8)
		t.tween_callback(_loading.queue_free)
	Game.on_world_ready(self)


func surface_at(pos: Vector3) -> String:
	# objects can override via metadata "surface" (raycast down)
	var space := get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(pos + Vector3.UP * 0.3, pos + Vector3.DOWN * 0.6, 1)
	var hit := space.intersect_ray(q)
	if hit and hit.collider and hit.collider.has_meta("surface"):
		var s: String = hit.collider.get_meta("surface")
		if s != "terrain":
			return s
	if pos.y < float(def.sea_level) + 0.15 and pos.y > float(def.sea_level) - 1.2:
		return "water"
	return field.surface_at(pos.x, pos.z)


func void_check(p: Node3D) -> void:
	if p.global_position.y < float(def.sea_level) - 120.0:
		# the Seam catches you: return to last safe ground
		var sp: Vector3 = def.spawn
		sp.y = field.height_at(sp.x, sp.z) + 1.0
		(p as Player).teleport(sp)
		Game.message(tr("The Seam pulls you back…"), "warn")


func height_at(x: float, z: float) -> float:
	return field.height_at(x, z)
