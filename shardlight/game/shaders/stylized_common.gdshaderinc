// Shardlight COMIC CEL lighting (Hi-Fi Rush direction, see docs/ART_BIBLE.md).
// Hard light/shadow terminator, colored (hue-shifted) shadows, screen-space halftone in shadow,
// hard comic specular, hard rim. Everything reads as flat painted color areas.

uniform vec3 shadow_tint : source_color = vec3(0.36, 0.30, 0.78);
uniform float shadow_strength : hint_range(0.0, 1.0) = 0.62;
uniform float terminator : hint_range(-1.0, 1.0) = 0.08;
uniform float terminator_soft : hint_range(0.0, 0.2) = 0.015;
uniform float halftone_strength : hint_range(0.0, 1.0) = 0.55;
uniform float halftone_scale = 5.0;          // dot cell size in pixels
uniform float spec_size : hint_range(0.0, 1.0) = 0.12;
uniform float spec_strength : hint_range(0.0, 2.0) = 0.0;
uniform float rim_strength : hint_range(0.0, 2.0) = 0.35;
uniform float rim_width : hint_range(0.0, 1.0) = 0.28;
uniform vec3 rim_color : source_color = vec3(1.0, 0.95, 0.85);
uniform sampler2D brush_tex : hint_default_white, filter_linear_mipmap, repeat_enable;
uniform float brush_strength : hint_range(0.0, 1.0) = 0.12;

global uniform vec3 sl_player_pos;
global uniform vec4 sl_wind; // xy = direction, z = strength, w = speed

varying vec3 v_world_pos;
varying vec3 v_world_normal;
varying float v_brush;

float sl_brush_sample(vec3 wp, vec3 wn) {
	vec3 b = pow(abs(wn), vec3(4.0));
	b /= (b.x + b.y + b.z + 1e-4);
	vec3 p = wp * 0.35;
	return texture(brush_tex, p.zy).r * b.x + texture(brush_tex, p.xz).r * b.y + texture(brush_tex, p.xy).r * b.z;
}

vec3 sl_painterly_albedo(vec3 albedo, float brush) {
	// subtle hand-painted value breakup, quantized so it reads as painted patches, not noise
	float q = floor(brush * 3.0) / 3.0;
	return albedo * (1.0 + (q - 0.5) * brush_strength);
}

float sl_halftone(vec2 frag, float amount) {
	// rotated dot grid in screen space; dot radius grows with 'amount' (0..1)
	mat2 r = mat2(vec2(0.7071, -0.7071), vec2(0.7071, 0.7071));
	vec2 p = r * frag / halftone_scale;
	vec2 cell = fract(p) - 0.5;
	float d = length(cell);
	float radius = sqrt(clamp(amount, 0.0, 1.0)) * 0.62;
	return 1.0 - smoothstep(radius - 0.06, radius + 0.06, d);
}

// diffuse returns lighting multiplier; ALBEDO is applied by the engine afterwards.
void sl_light(vec3 normal, vec3 light, vec3 view, vec3 light_color, float attenuation, bool directional,
		float brush, vec3 albedo, vec2 frag, inout vec3 diffuse, inout vec3 specular) {
	float ndl = dot(normal, light);
	float shadow = attenuation;
	float lit = smoothstep(terminator - terminator_soft, terminator + terminator_soft, ndl) * step(0.5, shadow);
	vec3 lc = light_color / PI;
	if (directional) {
		// colored shadow: shadow side gets tinted fill instead of going grey
		vec3 shade_col = mix(vec3(1.0), shadow_tint, shadow_strength) * (1.0 - shadow_strength * 0.45);
		// halftone dots deepen the shadow near the terminator → classic comic print
		float tone = 1.0 - clamp(ndl * 0.5 + 0.5, 0.0, 1.0);
		float dots = sl_halftone(frag, tone * 0.9) * halftone_strength * (1.0 - lit);
		shade_col *= 1.0 - dots * 0.35;
		diffuse += lc * mix(shade_col, vec3(1.0), lit);
		// hard rim on the lit edge
		float rim = 1.0 - clamp(dot(normal, view), 0.0, 1.0);
		float rimband = step(1.0 - rim_width, rim) * clamp(ndl + 0.4, 0.0, 1.0);
		diffuse += lc * rim_color * rimband * rim_strength;
		// hard comic specular blob
		vec3 h = normalize(light + view);
		float sp = step(1.0 - spec_size * 0.25, dot(normal, h)) * lit;
		specular += lc * sp * spec_strength;
	} else {
		// point/spot lights: two hard bands so energy VFX lights read as graphic pools of color
		float band = step(0.05, ndl * attenuation) * 0.6 + step(0.35, ndl * attenuation) * 0.6;
		diffuse += lc * band;
	}
}
