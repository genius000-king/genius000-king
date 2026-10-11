class_name ComicPost
## Attaches the full-screen comic ink pass to a camera.

static func attach(camera: Camera3D) -> MeshInstance3D:
	if not Settings.screen_ink():
		return null
	var q := MeshInstance3D.new()
	q.name = "ComicPost"
	var qm := QuadMesh.new()
	qm.size = Vector2(1, 1)
	q.mesh = qm
	var m := ShaderMaterial.new()
	var use_normals := RenderingServer.get_current_rendering_method() == "forward_plus"
	m.shader = load("res://shaders/comic_post_normals.gdshader" if use_normals else "res://shaders/comic_post.gdshader")
	m.render_priority = -128
	q.material_override = m
	q.extra_cull_margin = 16384.0
	q.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	q.position = Vector3(0, 0, -0.2)
	camera.add_child(q)
	return q
