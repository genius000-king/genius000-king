// Shardlight painterly lighting — shared by all stylized surface shaders.
// Warm key, cool violet shadows (ART_BIBLE §1), soft wrapped ramp, brush-stroke breakup.

uniform vec3 shadow_tint : source_color = vec3(0.42, 0.36, 0.84);
uniform float shadow_tint_strength : hint_range(0.0, 1.0) = 0.38;
uniform float ramp_center : hint_range(0.0, 1.0) = 0.42;
uniform float ramp_softness : hint_range(0.01, 0.5) = 0.16;
uniform float wrap_amount : hint_range(0.0, 1.0) = 0.35;
uniform float rim_strength : hint_range(0.0, 2.0) = 0.35;
uniform vec3 rim_color : source_color = vec3(1.0, 0.92, 0.8);
uniform float brush_strength : hint_range(0.0, 1.0) = 0.22;
uniform float brush_scale = 0.35;
uniform sampler2D brush_tex : hint_default_white, filter_linear_mipmap, repeat_enable;

global uniform vec3 sl_player_pos;
global uniform vec4 sl_wind; // xy = direction, z = strength, w = speed

varying vec3 v_world_pos;
varying vec3 v_world_normal;
varying float v_brush;

float sl_brush_sample(vec3 wp, vec3 wn) {
	vec3 b = pow(abs(wn), vec3(4.0));
	b /= (b.x + b.y + b.z + 1e-4);
	vec3 p = wp * brush_scale;
	float x = texture(brush_tex, p.zy).r;
	float y = texture(brush_tex, p.xz * vec2(1.0, 0.6)).r;
	float z = texture(brush_tex, p.xy).r;
	return x * b.x + y * b.y + z * b.z;
}

vec3 sl_painterly_albedo(vec3 albedo, float brush) {
	// value jitter along brush strokes, keeps hue
	return albedo * (1.0 + (brush - 0.5) * brush_strength * 0.9);
}

void sl_light(vec3 normal, vec3 light, vec3 view, vec3 light_color, float attenuation, bool directional,
		float brush, vec3 albedo, inout vec3 diffuse, inout vec3 specular) {
	float ndl = dot(normal, light);
	float wrapped = (ndl + wrap_amount) / (1.0 + wrap_amount);
	float edge = ramp_center + (brush - 0.5) * 0.22;
	float ramp = smoothstep(edge - ramp_softness, edge + ramp_softness, wrapped * attenuation);
	vec3 lc = light_color / PI;
	diffuse += lc * ramp;
	if (directional) {
		// lavender fill in shadow (instead of plain darkness)
		diffuse += lc * shadow_tint * shadow_tint_strength * (1.0 - ramp) * 0.55;
		// rim / back light
		float rim = pow(1.0 - clamp(dot(normal, view), 0.0, 1.0), 3.0);
		float back = clamp(dot(-view, light) * 0.5 + 0.5, 0.0, 1.0);
		diffuse += lc * rim_color * rim * rim_strength * (0.35 + back) * attenuation;
	}
	// soft broad sheen
	vec3 h = normalize(light + view);
	float spec = pow(clamp(dot(normal, h), 0.0, 1.0), 48.0);
	specular += lc * smoothstep(0.55, 0.75, spec) * 0.12 * attenuation;
}
