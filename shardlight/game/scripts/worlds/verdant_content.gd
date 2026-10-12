extends Node3D
## Verdant Drift — level layout for the M1 slice: arrival gate, village, windmill hill, three trials,
## sanctum with the Keystone, memory echoes, sky islands. Story hooks call Story.event(<id>) (see data/EVENTS.md).

var world: ShardWorld
var field: TerrainField
var npcs := {}

func setup(w: ShardWorld) -> void:
	world = w
	field = w.field
	_arrival()
	_village()
	_windmill_hill()
	_trial_float()
	_trial_bloom()
	_trial_echo()
	_sanctum()
	_echoes()
	_sky_islands()

func _poi(id: String) -> Vector2:
	for p in world.def.pois:
		if p.id == id:
			return p.pos
	return Vector2.ZERO

func _y(p: Vector2) -> float:
	return field.height_at(p.x, p.y)

func _gate(at: Vector2, target: String, ar: String, en: String) -> RiftGate:
	var g := RiftGate.new()
	g.target_world = target
	g.label_ar = ar
	g.label_en = en
	add_child(g)
	g.position = Vector3(at.x, _y(at), at.y)
	return g

func _npc(id: String, at: Vector2, yaw := 0.0) -> Node3D:
	var path := "res://scripts/npc/npc.gd"
	if not ResourceLoader.exists(path):
		return null
	var n: Node3D = (load(path) as GDScript).new()
	n.set("npc_id", id)
	add_child(n)
	n.position = Vector3(at.x, _y(at), at.y)
	n.rotation_degrees.y = yaw
	npcs[id] = n
	return n

func _zone(event_id: String, at: Vector2, radius: float) -> void:
	var z := TriggerZone.new()
	z.event_id = event_id
	add_child(z)
	z.position = Vector3(at.x, _y(at) - 1.0, at.y)
	z.setup(radius)

# ------------------------------------------------------------------------------------------------
func _arrival() -> void:
	var a := _poi("arrival_gate")
	_gate(a + Vector2(0, 8), "hub", "العودة إلى الفوهة", "Back to the Crater")
	Props.place(self, field, "hub_ruin_pillar_broken", a.x - 6, a.y + 6, 20)
	Props.place(self, field, "hub_ruin_pillar", a.x + 6, a.y + 7, -10)
	Props.place(self, field, "common_town_signpost", a.x + 4, a.y - 4, 200)
	_zone("arrive_verdant", a, 12.0)

func _village() -> void:
	var c := _poi("village")
	Props.place(self, field, "common_town_well", c.x, c.y, 0)
	var houses := ["common_town_cottage_a", "common_town_bakery", "common_town_cottage_b", "common_town_shop",
		"common_town_cottage_tower", "common_town_greenhouse", "common_town_cottage_a", "common_town_cottage_b"]
	Props.ring(self, field, houses, c, 38.0, houses.size(), 11, true)
	Props.ring(self, field, ["common_town_lamppost"], c, 18.0, 6, 12, true)
	Props.ring(self, field, ["common_town_bench", "common_town_market_stall_a", "common_town_bench", "common_town_market_stall_b"], c, 12.0, 4, 13, true)
	Props.place(self, field, "common_town_cart", c.x + 8, c.y - 15, 35)
	Props.place(self, field, "common_town_mailbox", c.x - 14, c.y + 6, 90)
	Props.place(self, field, "common_town_bunting", c.x, c.y - 6, 0)
	Props.ring(self, field, ["common_town_fence_a", "common_town_fence_b"], c, 52.0, 18, 14, true)
	_npc("marrow", c + Vector2(-10, 20), 160)
	_npc("ilse", c + Vector2(-14, 23), 140)
	_npc("pip", c + Vector2(6, -8), 30)
	_npc("tansy", c + Vector2(9, -6), -20)
	_zone("enter_village", c, 30.0)

func _windmill_hill() -> void:
	var c := _poi("windmill_hill")
	Props.place(self, field, "common_town_windmill", c.x, c.y, 30)
	Props.place(self, field, "common_town_garden_wall", c.x + 9, c.y + 4, 80)
	for i in 4:
		Props.place(self, field, "common_town_market_stall_a" if i == 0 else "common_town_fence_a", c.x - 10 + i * 4, c.y + 12, 0)
	_npc("wren", c + Vector2(8, 10), 200)

func _trial_float() -> void:
	# a rising staircase of floating islands in low gravity, ending at the Drift shrine
	var c := _poi("trial_float")
	var base := _y(c)
	var ids := ["verdant_island_04", "verdant_island_08", "verdant_island_04", "verdant_island_12_b", "verdant_island_08", "verdant_island_16"]
	var p := c
	for i in ids.size():
		p += Vector2(cos(i * 1.1) * 9.0, sin(i * 1.1) * 9.0)
		Props.place(self, field, ids[i], p.x, p.y, i * 47.0, 1.0, 4.0 + i * 4.5, true)
	var top := Vector3(p.x, base + 4.0 + (ids.size() - 1) * 4.5 + 3.0, p.y)
	var shrine := Props.place(self, field, "hub_crystal_cluster_b", p.x, p.y, 0, 0.6, 4.0 + (ids.size() - 1) * 4.5 + 2.0)
	var z := TriggerZone.new()
	z.event_id = "trial_float_done"
	add_child(z)
	z.position = top - Vector3(0, 3, 0)
	z.setup(5.0)
	_zone("trial_float_start", c, 14.0)

func _trial_bloom() -> void:
	var c := _poi("trial_bloom")
	Props.place(self, field, "verdant_flower_hero_heartbloom", c.x, c.y, 0, 1.4)
	Props.ring(self, field, ["verdant_flower_hero_sunbloom"], c, 16.0, 4, 21, true, Vector2(0.8, 1.1))
	Props.ring(self, field, ["verdant_rock_chunk_b", "verdant_rock_menhir_a"], c, 28.0, 7, 22, false)
	var spawner_path := "res://scripts/enemies/static_spawner.gd"
	if ResourceLoader.exists(spawner_path):
		var sp: Node3D = (load(spawner_path) as GDScript).new()
		sp.set("count", 5)
		add_child(sp)
		sp.position = Vector3(c.x, _y(c), c.y)
		if sp.has_signal("cleared"):
			sp.connect("cleared", func(): if Story.has_method("event"): Story.event("trial_bloom_done"))
	_zone("trial_bloom_start", c, 20.0)

func _trial_echo() -> void:
	var c := _poi("trial_echo")
	for i in 7:
		var a := TAU * i / 7.0
		Props.place(self, field, "verdant_log_hollow" if i % 2 == 0 else "verdant_log_mossy", c.x + cos(a) * 18.0, c.y + sin(a) * 18.0, rad_to_deg(a) + 90.0)
	for i in 3:
		var e := EchoPickup.new()
		e.echo_id = "echo_trial_%d" % (i + 1)
		add_child(e)
		var a2 := TAU * i / 3.0 + 0.4
		var pp := c + Vector2(cos(a2), sin(a2)) * 18.0
		e.position = Vector3(pp.x, _y(pp), pp.y)
	_zone("trial_echo_start", c, 22.0)

func _sanctum() -> void:
	var c := _poi("sanctum")
	Props.place(self, field, "verdant_arch_natural_b", c.x, c.y + 18.0, 180)
	Props.ring(self, field, ["verdant_pillar_balanced_a", "verdant_rock_menhir_a"], c, 22.0, 8, 31, true)
	var k := KeystonePickup.new()
	k.world_id = "verdant"
	k.ability = "lift"
	add_child(k)
	k.position = Vector3(c.x, _y(c), c.y)
	var warden := "res://scripts/enemies/static_warden.gd"
	if ResourceLoader.exists(warden):
		var w: Node3D = (load(warden) as GDScript).new()
		add_child(w)
		w.position = Vector3(c.x, _y(c) + 1.0, c.y - 10.0)
	_zone("enter_sanctum", c, 26.0)

func _echoes() -> void:
	var spots := [Vector2(-120, 200), Vector2(180, 40), Vector2(-260, -180), Vector2(420, 260), Vector2(-20, -300), Vector2(260, -330), Vector2(-420, 60)]
	for i in spots.size():
		var e := EchoPickup.new()
		e.echo_id = "echo_verdant_%d" % (i + 1)
		add_child(e)
		var p: Vector2 = spots[i]
		e.position = Vector3(p.x, _y(p), p.y)

func _sky_islands() -> void:
	# the low-gravity sky: big islands drifting overhead (visual landmarks; reachable later with Lift)
	var rng := RandomNumberGenerator.new()
	rng.seed = 404
	for i in 9:
		var a := rng.randf() * TAU
		var r := rng.randf_range(150.0, 700.0)
		var p := Vector2(cos(a), sin(a)) * r
		var id := "verdant_island_40" if i % 3 == 0 else "verdant_island_26"
		Props.place(self, field, id, p.x, p.y, rng.randf() * 360.0, rng.randf_range(0.8, 1.6), rng.randf_range(45.0, 110.0))
