shader_type spatial;
render_mode blend_mix, depth_draw_always, cull_disabled, diffuse_lambert;
// Drawn in the transparent pass AFTER the comic ink pass: grass reads as flat painted strokes, never inked scribble.
// Field grass (MultiMesh clumps). Per-instance INSTANCE_CUSTOM: r = hue jitter, g = height scale, b = color mix, a = phase.
#include "res://shaders/stylized_common.gdshaderinc"
uniform vec3 base_color : source_color = vec3(0.25, 0.62, 0.35);
uniform vec3 tip_color : source_color = vec3(0.78, 0.96, 0.49);
uniform vec3 alt_tip_color : source_color = vec3(0.98, 0.86, 0.45);
uniform float sway = 0.28;
uniform float fade_start = 40.0;
uniform float fade_end = 55.0;
uniform float flower_chance = 0.0;
varying float v_h;
varying vec4 v_custom;
varying vec3 v_ground;
void vertex() {
	v_custom = INSTANCE_CUSTOM;
	v_ground = COLOR.rgb;
	v_h = clamp(VERTEX.y / 0.9, 0.0, 1.0);
	vec3 origin = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	float dist = length(origin - CAMERA_POSITION_WORLD);
	float shrink = 1.0 - smoothstep(fade_start, fade_end, dist);
	VERTEX.y *= INSTANCE_CUSTOM.g * shrink;
	VERTEX.xz *= mix(0.6, 1.0, shrink);
	vec3 wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float t = TIME * (1.2 + sl_wind.w);
	vec2 dir = normalize(sl_wind.xy + vec2(1e-4));
	// rolling wind waves across the field
	float wave = sin(dot(wpos.xz, dir) * 0.22 - t * 1.6) * 0.5 + 0.5;
	float flutter = sin(t * 3.1 + INSTANCE_CUSTOM.a * 6.28 + wpos.x * 0.7) * 0.25;
	float bend = (wave * (0.5 + sl_wind.z) + flutter) * sway * v_h * v_h;
	vec3 disp = vec3(dir.x, 0.0, dir.y) * bend;
	// player trampling
	vec3 to = wpos - sl_player_pos;
	float d = length(to.xz);
	float push = (1.0 - smoothstep(0.3, 1.4, d)) * v_h * step(abs(to.y), 2.0);
	disp += normalize(vec3(to.x, 0.0, to.z) + vec3(1e-4)) * push * 0.6;
	disp.y -= push * 0.35;
	vec3 local = inverse(mat3(MODEL_MATRIX)) * disp;
	VERTEX += local;
	v_world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	// grass normals point up (soft field shading like terrain)
	NORMAL = normalize(inverse(mat3(MODEL_MATRIX)) * vec3(0.0, 1.0, 0.0));
	v_world_normal = vec3(0.0, 1.0, 0.0);
}
void fragment() {
	vec3 tip = mix(tip_color, alt_tip_color, step(0.9, v_custom.b) * 0.7);
	// root blends into the ground color; tips pick up the world's tip tint
	vec3 root = v_ground * 0.86;
	vec3 mid = mix(v_ground, tip, 0.35);
	vec3 c = mix(root, mid, smoothstep(0.0, 0.55, v_h));
	c = mix(c, mix(v_ground, tip, 0.7), smoothstep(0.55, 1.0, v_h));
	c *= 0.92 + v_custom.r * 0.16;
	float brush = sl_brush_sample(v_world_pos, vec3(0.0, 1.0, 0.0));
	v_brush = brush;
	ALBEDO = sl_painterly_albedo(c, brush);
	ALPHA = 1.0;
	ROUGHNESS = 0.85;
	SPECULAR = 0.1;
}
void light() {
	sl_light(NORMAL, LIGHT, VIEW, LIGHT_COLOR, ATTENUATION, LIGHT_IS_DIRECTIONAL, v_brush, ALBEDO, FRAGCOORD.xy, DIFFUSE_LIGHT, SPECULAR_LIGHT);
}
