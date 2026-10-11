class_name Stylizer
## Maps Blender material names (ART_BIBLE §3) to shared Shardlight shader materials.

const SHADERS := {
	"VC": preload("res://shaders/stylized.gdshader"),
	"VC_ROUGH": preload("res://shaders/stylized_rough.gdshader"),
	"VC_FOLIAGE": preload("res://shaders/stylized_foliage.gdshader"),
	"EMIT": preload("res://shaders/stylized_emit.gdshader"),
	"GLASS": preload("res://shaders/glass.gdshader"),
	"WATER": preload("res://shaders/water.gdshader"),
	"TERRAIN": preload("res://shaders/stylized_terrain.gdshader"),
}

const OUTLINE := preload("res://shaders/outline.gdshader")

static var _cache := {}
static var _outline_mats := {}


static func outline_material(width := 2.6) -> ShaderMaterial:
	var key := str(width)
	if not _outline_mats.has(key):
		var m := ShaderMaterial.new()
		m.shader = OUTLINE
		m.set_shader_parameter("width_px", width)
		m.render_priority = -1
		_outline_mats[key] = m
	return _outline_mats[key]
static var _brush: Texture2D


static func brush_texture() -> Texture2D:
	if _brush == null:
		var nt := NoiseTexture2D.new()
		nt.width = 256
		nt.height = 256
		nt.seamless = true
		nt.generate_mipmaps = true
		var n := FastNoiseLite.new()
		n.noise_type = FastNoiseLite.TYPE_CELLULAR
		n.frequency = 0.035
		n.cellular_return_type = FastNoiseLite.RETURN_CELL_VALUE
		n.domain_warp_enabled = true
		n.domain_warp_amplitude = 18.0
		n.domain_warp_frequency = 0.03
		nt.noise = n
		_brush = nt
	return _brush


static func kind_for(material_name: String) -> String:
	var n := material_name.to_upper()
	# Blender may append .001 suffixes
	var dot := n.find(".")
	if dot > 0:
		n = n.substr(0, dot)
	if n.begins_with("EMIT"):
		return "EMIT"
	if n.begins_with("VC_FOLIAGE") or n.begins_with("FOLIAGE"):
		return "VC_FOLIAGE"
	if n.begins_with("VC_ROUGH"):
		return "VC_ROUGH"
	if n.begins_with("GLASS"):
		return "GLASS"
	if n.begins_with("WATER"):
		return "WATER"
	return "VC"


static func material(kind: String, params: Dictionary = {}) -> ShaderMaterial:
	var key := kind + str(params)
	if _cache.has(key):
		return _cache[key]
	var m := ShaderMaterial.new()
	m.shader = SHADERS.get(kind, SHADERS["VC"])
	if kind != "GLASS" and kind != "WATER":
		m.set_shader_parameter("brush_tex", brush_texture())
	if kind == "WATER":
		m.set_shader_parameter("noise_tex", brush_texture())
	for k in params:
		m.set_shader_parameter(k, params[k])
	if kind == "GLASS":
		m.render_priority = 1
	if kind in ["VC", "VC_ROUGH", "VC_FOLIAGE", "EMIT", "TERRAIN"] and Settings.outlines(kind):
		m.next_pass = outline_material(1.6 if kind == "VC_FOLIAGE" else 2.4)
	_cache[key] = m
	return m


static func stylize_mesh(mesh: Mesh) -> Mesh:
	## Replace surface materials on a Mesh resource in place (shared by MultiMesh instances).
	if mesh == null or mesh.has_meta("sl_stylized"):
		return mesh
	for i in mesh.get_surface_count():
		var src := mesh.surface_get_material(i)
		var name := src.resource_name if src else "VC"
		mesh.surface_set_material(i, material(kind_for(name)))
	mesh.set_meta("sl_stylized", true)
	return mesh


static func stylize_tree(root: Node) -> void:
	for mi in root.find_children("*", "MeshInstance3D", true, false):
		stylize_mesh((mi as MeshInstance3D).mesh)
		var h := (mi as MeshInstance3D).get_aabb().size.y
		(mi as MeshInstance3D).set_instance_shader_parameter("sway_height", max(h, 0.5))
	if root is MeshInstance3D:
		stylize_mesh(root.mesh)
