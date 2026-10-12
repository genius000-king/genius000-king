class_name WorldEnv
## Builds WorldEnvironment + sun for a world definition. Painterly sky, fog, glow, tonemap.

static func build(parent: Node, def: Dictionary) -> Dictionary:
	var we := WorldEnvironment.new()
	var env := Environment.new()
	var sky := Sky.new()
	var sm := ShaderMaterial.new()
	sm.shader = preload("res://shaders/sky.gdshader")
	var skd: Dictionary = def.sky
	sm.set_shader_parameter("top_color", skd.top)
	sm.set_shader_parameter("horizon_color", skd.horizon)
	sm.set_shader_parameter("void_color", skd.void)
	sm.set_shader_parameter("void_glow", skd.void_glow)
	sm.set_shader_parameter("cloud_light", skd.cloud_light)
	sm.set_shader_parameter("cloud_shadow", skd.cloud_shadow)
	sm.set_shader_parameter("cloud_coverage", skd.coverage)
	sm.set_shader_parameter("scar_intensity", skd.scar)
	sm.set_shader_parameter("star_intensity", skd.stars)
	sm.set_shader_parameter("cloud_noise", _noise_tex(11, 0.012, 512))
	sm.set_shader_parameter("cloud_detail", _noise_tex(23, 0.04, 256))
	sky.sky_material = sm
	sky.process_mode = Sky.PROCESS_MODE_INCREMENTAL
	sky.radiance_size = Sky.RADIANCE_SIZE_128
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_color = def.ambient
	env.ambient_light_sky_contribution = 0.35
	env.ambient_light_energy = float(def.ambient_energy) * 0.6
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	env.tonemap_exposure = 1.0
	env.glow_enabled = true
	env.glow_intensity = 0.7
	env.glow_strength = 1.0
	env.glow_bloom = 0.0
	env.glow_hdr_threshold = 1.15
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT if Settings.is_mobile() else Environment.GLOW_BLEND_MODE_SCREEN
	for i in 7:
		env.set_glow_level(i, 1.0 if i in [1, 3, 5] else 0.0)
	var fog: Dictionary = def.fog
	# comic depth fog: only far distances fade toward the world tint; near/mid stays flat & saturated
	env.fog_enabled = true
	env.fog_mode = Environment.FOG_MODE_DEPTH
	env.fog_light_color = fog.color
	env.fog_light_energy = 1.0
	env.fog_depth_begin = 140.0
	env.fog_depth_end = Settings.view_distance() * 1.05
	env.fog_depth_curve = 1.6
	env.fog_density = 0.85
	env.fog_sky_affect = 0.0
	env.fog_sun_scatter = 0.0
	env.fog_height_density = 0.0
	env.fog_aerial_perspective = 0.0
	if Settings.volumetric_fog():
		env.volumetric_fog_enabled = true
		env.volumetric_fog_density = 0.0004
		env.volumetric_fog_albedo = fog.color
		env.volumetric_fog_length = 64.0
		env.volumetric_fog_detail_spread = 2.0
		env.volumetric_fog_anisotropy = 0.55
		env.volumetric_fog_sky_affect = 0.0
	if Settings.ssao():
		env.ssao_enabled = true
		env.ssao_radius = 1.6
		env.ssao_intensity = 1.4
		env.ssao_light_affect = 0.15
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.15
	env.adjustment_contrast = 1.08
	we.environment = env
	parent.add_child(we)
	var sun := DirectionalLight3D.new()
	var sd: Dictionary = def.sun
	sun.light_color = sd.color
	sun.light_energy = sd.energy
	sun.rotation_degrees = Vector3(sd.pitch, sd.yaw, 0)
	sun.shadow_enabled = true
	sun.shadow_blur = 1.5
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS if not Settings.is_mobile() else DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	sun.directional_shadow_max_distance = 160.0 if not Settings.is_mobile() else 70.0
	sun.light_angular_distance = 1.2
	sun.light_volumetric_fog_energy = 1.4
	parent.add_child(sun)
	return {"env": env, "sun": sun, "sky_material": sm}


static func _noise_tex(seed: int, freq: float, size: int) -> NoiseTexture2D:
	var nt := NoiseTexture2D.new()
	nt.width = size
	nt.height = size
	nt.seamless = true
	var n := FastNoiseLite.new()
	n.seed = seed
	n.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	n.frequency = freq
	n.fractal_octaves = 5
	n.fractal_type = FastNoiseLite.FRACTAL_FBM
	nt.noise = n
	return nt
