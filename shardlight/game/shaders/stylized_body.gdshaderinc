// Body for stylized surface shaders. Variants via defines before including:
//   SL_FOLIAGE  wind sway + double sided + translucency
//   SL_EMIT     emissive vertex color
//   SL_ROUGH    stronger brush breakup
//   SL_TERRAIN  terrain macro variation
#include "res://shaders/stylized_common.gdshaderinc"

uniform vec4 tint : source_color = vec4(1.0);
uniform float use_vertex_color : hint_range(0.0, 1.0) = 1.0;
uniform float saturation : hint_range(0.0, 2.0) = 1.08;

#ifdef SL_FOLIAGE
instance uniform float sway_height = 4.0;
uniform float sway_amount = 0.12;
uniform vec3 translucency_color : source_color = vec3(0.85, 1.0, 0.45);
uniform float translucency = 0.45;
#endif

#ifdef SL_EMIT
uniform float emission_energy = 3.5;
uniform float pulse_speed = 1.3;
uniform float pulse_amount = 0.25;
#endif

#ifdef SL_TERRAIN
uniform vec3 macro_tint_a : source_color = vec3(1.0, 0.96, 0.9);
uniform vec3 macro_tint_b : source_color = vec3(0.9, 0.95, 1.05);
uniform float macro_scale = 0.008;
#endif

vec3 sl_saturate(vec3 c, float s) {
	float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
	return mix(vec3(l), c, s);
}

void vertex() {
	v_world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
#ifdef SL_FOLIAGE
	float h = clamp(VERTEX.y / max(sway_height, 0.1), 0.0, 1.5);
	float w = h * h;
	vec3 origin = MODEL_MATRIX[3].xyz;
	float phase = dot(origin.xz, vec2(0.13, 0.21)) + v_world_pos.y * 0.15;
	float t = TIME * (0.9 + sl_wind.w);
	float gust = sin(t * 0.35 + origin.x * 0.02) * 0.5 + 0.5;
	vec2 dir = normalize(sl_wind.xy + vec2(1e-4));
	float strength = sway_amount * (0.6 + sl_wind.z) * (0.6 + gust);
	vec3 sway = vec3(dir.x, 0.0, dir.y) * sin(t + phase) * strength;
	sway += vec3(sin(t * 2.3 + phase * 3.0), 0.0, cos(t * 1.9 + phase * 2.0)) * strength * 0.25;
	// leaf flutter (small, high frequency, by vertex position)
	sway += vec3(sin(t * 6.0 + VERTEX.x * 4.0), sin(t * 5.0 + VERTEX.z * 5.0) * 0.5, cos(t * 7.0 + VERTEX.y * 3.0)) * 0.015 * h;
	// push away from the player (bending)
	vec3 to = v_world_pos - sl_player_pos;
	float d = length(to.xz);
	float push = (1.0 - smoothstep(0.4, 1.8, d)) * h;
	sway += normalize(vec3(to.x, 0.0, to.z) + vec3(1e-4)) * push * 0.45;
	// apply in object space (assumes uniform-ish scale)
	VERTEX += (inverse(mat3(MODEL_MATRIX)) * sway) * w;
	v_world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
#endif
	v_world_normal = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

void fragment() {
	vec3 vc = mix(vec3(1.0), COLOR.rgb, use_vertex_color);
	vec3 albedo = vc * tint.rgb;
	float brush = sl_brush_sample(v_world_pos, v_world_normal);
#ifdef SL_ROUGH
	brush = mix(0.5, brush, 1.6);
#endif
	v_brush = brush;
	albedo = sl_painterly_albedo(albedo, brush);
#ifdef SL_TERRAIN
	float m = texture(brush_tex, v_world_pos.xz * macro_scale).r;
	albedo *= mix(macro_tint_a, macro_tint_b, smoothstep(0.3, 0.7, m));
#endif
	ALBEDO = sl_saturate(albedo, saturation);
	ROUGHNESS = 0.9;
	METALLIC = 0.0;
	SPECULAR = 0.2;
#ifdef SL_EMIT
	float pulse = 1.0 + sin(TIME * pulse_speed + v_world_pos.x * 0.3 + v_world_pos.z * 0.2) * pulse_amount;
	EMISSION = COLOR.rgb * tint.rgb * emission_energy * pulse;
#endif
#ifdef SL_FOLIAGE
	if (!FRONT_FACING) {
		NORMAL = -NORMAL;
	}
	BACKLIGHT = translucency_color * translucency;
#endif
}

void light() {
	sl_light(NORMAL, LIGHT, VIEW, LIGHT_COLOR, ATTENUATION, LIGHT_IS_DIRECTIONAL, v_brush, ALBEDO, DIFFUSE_LIGHT, SPECULAR_LIGHT);
#ifdef SL_FOLIAGE
	float back = clamp(dot(-NORMAL, LIGHT), 0.0, 1.0);
	DIFFUSE_LIGHT += LIGHT_COLOR / PI * translucency_color * back * translucency * ATTENUATION;
#endif
}
