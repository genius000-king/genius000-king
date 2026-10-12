extends Node3D
## Meridian Crater (hub): the Loom, institute ruins, seven rift gates, Lumen companion, prologue hooks.

var world: ShardWorld
var field: TerrainField
const GATES := {
	"gate_verdant": ["verdant", "المرج الطافي", "Verdant Drift"],
	"gate_amber": ["amber", "ساعات الكهرمان", "Amber Hours"],
	"gate_tide": ["tide", "البئر المقلوب", "Tidewell"],
	"gate_ember": ["ember", "جوقة الجمر", "Ember Choir"],
	"gate_glass": ["glass", "أرشيف الزجاج", "Glasswake Archive"],
	"gate_hollow": ["hollow", "الإزهار الأجوف", "Hollowbloom"],
}

func setup(w: ShardWorld) -> void:
	world = w
	field = w.field
	var loom := LoomMachine.new()
	add_child(loom)
	loom.position = Vector3(0, field.height_at(0, 0), 0)
	# broken ring fragments thrown around the crater
	var rng := RandomNumberGenerator.new()
	rng.seed = 77
	for i in 9:
		var a := rng.randf() * TAU
		var r := rng.randf_range(30.0, 95.0)
		var id: String = ["hub_loom_ring_fragment_a", "hub_loom_ring_fragment_b", "hub_loom_ring_fragment_c"][i % 3]
		Props.place(self, field, id, cos(a) * r, sin(a) * r, rng.randf() * 360.0, rng.randf_range(1.0, 1.8), -0.4)
	# institute ruins on the crater rim
	var ruins := ["hub_ruin_wall_window", "hub_ruin_wall_broken", "hub_ruin_pillar", "hub_ruin_dome_half", "hub_ruin_wall_curved",
		"hub_ruin_doorway", "hub_ruin_pillar_broken", "hub_ruin_dome_collapsed", "hub_ruin_corner", "hub_ruin_stairs",
		"hub_ruin_wall_straight", "hub_prop_antenna_dish", "hub_prop_server_rack", "hub_prop_terminal", "hub_prop_floodlight"]
	Props.ring(self, field, ruins, Vector2.ZERO, 128.0, 30, 5, true, Vector2(0.9, 1.3))
	Props.ring(self, field, ["hub_ruin_debris_a", "hub_ruin_debris_b", "hub_ruin_debris_c", "hub_ruin_debris_d"], Vector2.ZERO, 70.0, 12, 6, false)
	# crater floor clutter: rubble, fracture crystals, cables, scorched instruments
	var clutter := ["hub_ruin_debris_a", "hub_ruin_debris_b", "hub_ruin_debris_c", "hub_ruin_debris_d", "hub_ruin_floor_broken",
		"hub_ruin_floor_tile", "hub_prop_cable_bundle", "hub_prop_warning_sign", "hub_prop_lab_table", "hub_ruin_railing"]
	for i in 46:
		var a3 := rng.randf() * TAU
		var r3 := rng.randf_range(16.0, 105.0)
		Props.place(self, field, clutter[i % clutter.size()], cos(a3) * r3, sin(a3) * r3, rng.randf() * 360.0, rng.randf_range(0.7, 1.3), -0.15)
	for i in 18:
		var a4 := rng.randf() * TAU
		var r4 := rng.randf_range(14.0, 100.0)
		Props.place(self, field, "hub_crystal_cluster_b", cos(a4) * r4, sin(a4) * r4, rng.randf() * 360.0, rng.randf_range(0.35, 1.1), -0.3)
	# floating slabs above the crater (the explosion froze mid-air)
	for i in 10:
		var a2 := rng.randf() * TAU
		var r2 := rng.randf_range(20.0, 120.0)
		Props.place(self, field, "hub_ruin_slab_floating", cos(a2) * r2, sin(a2) * r2, rng.randf() * 360.0, rng.randf_range(0.8, 1.6), rng.randf_range(12.0, 40.0))
	# gates: only Verdant is open in the slice; the rest seal until their keystone order
	for gid in GATES:
		var info: Array = GATES[gid]
		var p := _poi(gid)
		var g := RiftGate.new()
		g.target_world = info[0]
		g.label_ar = info[1]
		g.label_en = info[2]
		g.locked = info[0] != "verdant" and not ("verdant" in Game.state.keystones and info[0] == "amber")
		if info[0] == "verdant":
			g.dialogue_id = "gate_verdant"
			g.wake_flag = "gate_verdant_awake"
			g.wake_event = "gate_verdant_awake"
		add_child(g)
		g.position = Vector3(p.x, field.height_at(p.x, p.y), p.y)
		g.look_at(Vector3(0, g.position.y, 0), Vector3.UP)
		g.rotate_y(PI)
	var lumen := LumenCompanion.new()
	add_child(lumen)
	# prologue beats near the spawn (spawn is at 0,70 facing the Loom)
	var vent := PlasmaVent.new()
	add_child(vent)
	vent.position = Vector3(7, field.height_at(7, 50), 50)
	_sign("sign_hub_crater", Vector2(-5, 63), 200)
	_sign("sign_hub_case", Vector2(11, 54), 160)
	Props.place(self, field, "hub_prop_lab_table", 12.5, 51.5, 30)
	_zone("tut_jump", Vector2(0, 60), 4.0)
	_zone("hub_vent_near", Vector2(7, 50), 9.0)
	_zone("loom_near", Vector2(0, 0), 30.0)
	if Story.has_method("event") and not Game.flag("prologue_done"):
		Story.call_deferred("event", "hub_wake")
	var echo_spots := [Vector2(40, 30), Vector2(-70, -20)]
	for i in echo_spots.size():
		var e := EchoPickup.new()
		e.echo_id = "echo_hub_%d" % (i + 1)
		add_child(e)
		var ep: Vector2 = echo_spots[i]
		e.position = Vector3(ep.x, field.height_at(ep.x, ep.y), ep.y)

func _sign(id: String, at: Vector2, yaw: float) -> void:
	var sgn := StorySign.new()
	sgn.dialogue_id = id
	add_child(sgn)
	sgn.position = Vector3(at.x, field.height_at(at.x, at.y), at.y)
	sgn.rotation_degrees.y = yaw

func _zone(event_id: String, at: Vector2, radius: float) -> void:
	var z := TriggerZone.new()
	z.event_id = event_id
	add_child(z)
	z.position = Vector3(at.x, field.height_at(at.x, at.y) - 1.0, at.y)
	z.setup(radius)

func _poi(id: String) -> Vector2:
	for p in world.def.pois:
		if p.id == id:
			return p.pos
	return Vector2.ZERO
