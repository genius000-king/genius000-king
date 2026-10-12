class_name TerrainField
extends RefCounted
## Deterministic height/zone/color field for a shard world. Pure function of (x, z); safe to call from
## worker threads (FastNoiseLite sampling is read-only).

enum Zone { MEADOW, FOREST, SHORE, CLIFF, PLAZA, PATH, WATER, VOID }
const ZONE_NAMES := ["meadow", "forest", "shore", "cliff", "plaza", "path", "water", "void"]

var def: Dictionary
var radius: float
var sea_level: float
var height_scale: float
var ridge_scale: float
var terrace: float
var pal: Dictionary
var pois: Array = []
var crater: Dictionary = {}

var n_hills := FastNoiseLite.new()
var n_ridge := FastNoiseLite.new()
var n_mask := FastNoiseLite.new()
var n_detail := FastNoiseLite.new()
var n_forest := FastNoiseLite.new()
var n_path := FastNoiseLite.new()
var n_edge := FastNoiseLite.new()
var n_color := FastNoiseLite.new()


func _init(world_def: Dictionary) -> void:
	def = world_def
	radius = def.radius
	sea_level = def.sea_level
	height_scale = def.height_scale
	ridge_scale = def.ridge_scale
	terrace = def.get("terrace", 0.0)
	pal = def.palette
	pois = (def.get("pois", []) as Array).duplicate(true)
	crater = (def.get("crater", {}) as Dictionary).duplicate(true)
	var s: int = def.seed
	n_hills.seed = s
	n_hills.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	n_hills.frequency = def.hill_freq
	n_hills.fractal_type = FastNoiseLite.FRACTAL_FBM
	n_hills.fractal_octaves = 4
	n_ridge.seed = s + 1
	n_ridge.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	n_ridge.frequency = def.hill_freq * 0.7
	n_ridge.fractal_type = FastNoiseLite.FRACTAL_RIDGED
	n_ridge.fractal_octaves = 4
	n_mask.seed = s + 2
	n_mask.frequency = 0.0011
	n_detail.seed = s + 3
	n_detail.frequency = 0.03
	n_detail.fractal_octaves = 2
	n_forest.seed = s + 4
	n_forest.frequency = 0.006
	n_forest.fractal_octaves = 3
	n_path.seed = s + 5
	n_path.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	n_path.frequency = 0.0035
	n_path.fractal_octaves = 1
	n_edge.seed = s + 6
	n_edge.frequency = 0.004
	n_color.seed = s + 7
	n_color.frequency = 0.02
	n_color.fractal_octaves = 2
	# precompute POI plateau heights (keeps height_at() read-only → thread safe)
	for p in pois:
		_poi_height(p)


func _raw_height(x: float, z: float) -> float:
	var hills := n_hills.get_noise_2d(x, z) * 0.5 + 0.5
	var ridge := n_ridge.get_noise_2d(x, z) * 0.5 + 0.5
	var mmask := smoothstep(0.05, 0.55, n_mask.get_noise_2d(x, z) * 0.5 + 0.5)
	var h := hills * height_scale + pow(ridge, 2.2) * ridge_scale * mmask
	h += n_detail.get_noise_2d(x, z) * 1.6
	if terrace > 0.0:
		var t := h / terrace
		var f := t - floorf(t)
		h = (floor(t) + smoothstep(0.35, 0.65, f)) * terrace
	return h


func _rim_factor(x: float, z: float) -> float:
	# 1 inside the shard, falls to 0 at the rim (shard edge cliffs into the void)
	var d := Vector2(x, z).length()
	var wobble := n_edge.get_noise_2d(x, z) * radius * 0.12
	return 1.0 - smoothstep(radius * 0.86 + wobble, radius + wobble, d)


func height_at(x: float, z: float) -> float:
	var h := _raw_height(x, z)
	# lower the whole field so hills sit on a base above sea level
	h = h - height_scale * 0.35 + sea_level + 6.0
	# crater (hub)
	if not crater.is_empty():
		var cd := Vector2(x, z).distance_to(crater.center)
		var cr: float = crater.radius
		if cd < cr * 1.6:
			var bowl := 1.0 - smoothstep(0.0, cr, cd)
			var lip := exp(-pow((cd - cr) / (cr * 0.18), 2.0))
			h += -bowl * bowl * crater.depth + lip * 6.0
	# POI flattening
	for p in pois:
		if not p.get("flatten", false):
			continue
		var pd := Vector2(x, z).distance_to(p.pos)
		var r: float = p.radius
		if pd < r * 2.0:
			var target := _poi_height(p)
			var w := 1.0 - smoothstep(r * 0.8, r * 2.0, pd)
			h = lerp(h, target, w)
	# lakes for the 'lake' POI
	for p in pois:
		if p.id == "lake":
			var ld := Vector2(x, z).distance_to(p.pos)
			var lr: float = p.radius
			if ld < lr * 1.4:
				var depth := (1.0 - smoothstep(lr * 0.3, lr * 1.3, ld))
				h = lerp(h, sea_level - 6.0, depth * depth)
	# rim → void
	var rim := _rim_factor(x, z)
	h = lerp(sea_level - 260.0, h, pow(rim, 0.35))
	return h


func _poi_height(p: Dictionary) -> float:
	if p.has("_h"):
		return p._h
	var hp: Vector2 = p.pos
	var hh := _raw_height(hp.x, hp.y) - height_scale * 0.35 + sea_level + 6.0
	hh = max(hh, sea_level + 2.5)
	if not crater.is_empty() and hp.distance_to(crater.center) < crater.radius:
		var bowl := 1.0 - smoothstep(0.0, crater.radius, hp.distance_to(crater.center))
		hh += -bowl * bowl * crater.depth
	p["_h"] = hh
	return hh


func normal_at(x: float, z: float, e: float = 1.0) -> Vector3:
	var hl := height_at(x - e, z)
	var hr := height_at(x + e, z)
	var hd := height_at(x, z - e)
	var hu := height_at(x, z + e)
	return Vector3(hl - hr, 2.0 * e, hd - hu).normalized()


func path_value(x: float, z: float) -> float:
	# 0 on path center, grows away. Winding trails from ridged noise zero-crossings.
	return abs(n_path.get_noise_2d(x, z))


func zone_at(x: float, z: float, h: float = INF, slope: float = -1.0) -> int:
	if h == INF:
		h = height_at(x, z)
	if _rim_factor(x, z) < 0.6:
		return Zone.VOID
	if h < sea_level - 0.2:
		return Zone.WATER
	if slope < 0.0:
		slope = 1.0 - normal_at(x, z, 1.5).y
	if slope > 0.32:
		return Zone.CLIFF
	for p in pois:
		if p.get("flatten", false) and Vector2(x, z).distance_to(p.pos) < p.radius * 0.85:
			return Zone.PLAZA
	if h < sea_level + 1.6:
		return Zone.SHORE
	if path_value(x, z) < 0.022:
		return Zone.PATH
	var f := n_forest.get_noise_2d(x, z)
	if f > 0.18:
		return Zone.FOREST
	return Zone.MEADOW


func color_at(x: float, z: float, h: float, n: Vector3) -> Color:
	var slope := 1.0 - n.y
	var cn := n_color.get_noise_2d(x, z) * 0.5 + 0.5
	var zone := zone_at(x, z, h, slope)
	var c: Color
	var grass: Color = (pal.grass_a as Color).lerp(pal.grass_b, smoothstep(0.25, 0.85, cn))
	match zone:
		Zone.FOREST:
			c = (pal.forest as Color).lerp(grass, 0.25 + cn * 0.2)
		Zone.SHORE, Zone.WATER:
			c = (pal.sand as Color).lerp(pal.soil, clamp((sea_level - h) * 0.15, 0.0, 0.6))
		Zone.PATH:
			var pv := path_value(x, z) / 0.022
			c = (pal.path as Color).lerp(grass, smoothstep(0.5, 1.0, pv))
		Zone.PLAZA:
			c = grass.lerp(pal.path, 0.25)
		_:
			c = grass
	# rock on steep slopes, with lighter strata
	var rock_t := smoothstep(0.22, 0.42, slope)
	if rock_t > 0.0:
		var rock: Color = (pal.rock as Color).lerp(pal.rock_b, fposmod(h * 0.11 + cn * 0.6, 1.0) * 0.6)
		c = c.lerp(rock, rock_t)
	# subtle hue drift for painterly richness
	c = c.lerp(Color(c.r * 1.06, c.g, c.b * 0.94), cn * 0.5)
	# crater (hub): scorched, cracked floor around the Loom
	if not crater.is_empty():
		var cdist := Vector2(x, z).distance_to(crater.center)
		var cr: float = crater.radius
		if cdist < cr * 1.1:
			var burn := 1.0 - smoothstep(cr * 0.35, cr * 1.05, cdist)
			var crack := 1.0 - smoothstep(0.02, 0.07, absf(n_path.get_noise_2d(x * 1.6, z * 1.6)))
			c = c.lerp(Color("#5b4a7a"), burn * 0.7)
			c = c.lerp(Color("#c79bff"), crack * burn * 0.9)
	# edge of the shard darkens toward the void tint
	var rim := _rim_factor(x, z)
	if rim < 1.0:
		c = c.lerp(pal.scorch, (1.0 - rim) * 0.8)
	return c


func surface_at(x: float, z: float) -> String:
	## footstep surface for the player
	var h := height_at(x, z)
	var zone := zone_at(x, z, h)
	match zone:
		Zone.SHORE:
			return "sand"
		Zone.WATER:
			return "water"
		Zone.CLIFF:
			return "stone"
		Zone.PATH, Zone.PLAZA:
			return "sand" if def.get("law", "") == "uneven_time" else "stone"
	match def.get("law", ""):
		"uneven_time":
			return "sand"
		"solid_light":
			return "snow"
		"sound_force":
			return "stone"
	return "grass"


func grass_weight(x: float, z: float, h: float, n: Vector3) -> float:
	var slope := 1.0 - n.y
	var crater_k := 1.0
	if not crater.is_empty():
		crater_k = smoothstep(crater.radius * 0.6, crater.radius * 1.15, Vector2(x, z).distance_to(crater.center))
		if crater_k <= 0.01:
			return 0.0
	var zone := zone_at(x, z, h, slope)
	match zone:
		Zone.MEADOW:
			return 1.0 * crater_k
		Zone.FOREST:
			return 0.55 * crater_k
		Zone.PLAZA:
			return 0.25
		Zone.PATH:
			return clamp((path_value(x, z) - 0.012) / 0.01, 0.0, 0.4)
		Zone.SHORE:
			return 0.1
	return 0.0
