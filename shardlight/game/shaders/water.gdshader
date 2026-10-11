shader_type spatial;
render_mode blend_mix, depth_draw_always, cull_disabled, specular_schlick_ggx;
// Stylized water: depth-tinted, soft foam at shorelines, painterly sparkle bands.
uniform vec3 shallow_color : source_color = vec3(0.35, 0.92, 0.88);
uniform vec3 deep_color : source_color = vec3(0.12, 0.3, 0.62);
uniform vec3 foam_color : source_color = vec3(0.96, 1.0, 1.0);
uniform float depth_fade = 4.0;
uniform float foam_width = 0.9;
uniform sampler2D noise_tex : hint_default_white, filter_linear_mipmap, repeat_enable;
uniform sampler2D depth_texture : hint_depth_texture, filter_linear_mipmap;
uniform sampler2D screen_texture : hint_screen_texture, filter_linear_mipmap;
varying vec3 wp;
void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float w = sin(wp.x * 0.08 + TIME * 0.9) * 0.12 + sin(wp.z * 0.11 + TIME * 0.7) * 0.1;
	VERTEX.y += w;
	wp.y += w;
}
void fragment() {
	float depth_raw = texture(depth_texture, SCREEN_UV).r;
	vec4 ndc = vec4(SCREEN_UV * 2.0 - 1.0, depth_raw, 1.0);
	vec4 view_pos = INV_PROJECTION_MATRIX * ndc;
	view_pos.xyz /= view_pos.w;
	float scene_depth = -view_pos.z;
	float surf_depth = -VERTEX.z;
	float water_depth = max(scene_depth - surf_depth, 0.0);
	float t = clamp(water_depth / depth_fade, 0.0, 1.0);
	vec2 uv1 = wp.xz * 0.05 + vec2(TIME * 0.02, TIME * 0.013);
	vec2 uv2 = wp.xz * 0.09 - vec2(TIME * 0.017, -TIME * 0.021);
	float n = texture(noise_tex, uv1).r * 0.6 + texture(noise_tex, uv2).r * 0.4;
	float foam_edge = 1.0 - smoothstep(0.0, foam_width * (0.6 + n), water_depth);
	float foam = step(0.55, foam_edge + n * 0.35) * foam_edge;
	vec3 col = mix(shallow_color, deep_color, t);
	vec2 refr = SCREEN_UV + (vec2(n) - 0.5) * 0.02 * (1.0 - t);
	vec3 under = texture(screen_texture, refr).rgb;
	col = mix(under * shallow_color * 1.2, col, clamp(t * 1.4 + 0.25, 0.0, 1.0));
	float bands = smoothstep(0.62, 0.7, n) * 0.35;
	ALBEDO = mix(col, foam_color, max(foam, bands * (1.0 - t * 0.5)));
	EMISSION = foam_color * foam * 0.25;
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 4.0);
	ROUGHNESS = 0.08;
	METALLIC = 0.0;
	SPECULAR = 0.6;
	ALPHA = clamp(0.72 + t * 0.25 + fres * 0.2 + foam, 0.0, 1.0);
	NORMAL_MAP = normalize(vec3((n - 0.5) * 0.6, (texture(noise_tex, uv2 * 1.7).r - 0.5) * 0.6, 1.0)) * 0.5 + 0.5;
}
