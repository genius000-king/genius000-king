shader_type spatial;
render_mode blend_mix, depth_prepass_alpha, cull_back, diffuse_lambert;
// Blu's gel: cel-lit, translucent toward the center (you can see the core/tag/bubbles), bright cyan rim,
// big hard comic highlight, inner core glow that swells with plasma charge, surface jiggle.
#include "res://shaders/stylized_common.gdshaderinc"

uniform vec3 rim_gel : source_color = vec3(0.62, 0.95, 1.0);
uniform vec3 core_glow : source_color = vec3(0.72, 0.55, 1.0);
uniform float charge = 0.0;
uniform float glow_base = 0.12;
uniform float alpha_center = 0.7;
uniform float alpha_edge = 0.97;
uniform float wobble = 0.0;           // 0..1 jiggle amplitude (decays from script)
uniform vec3 wobble_dir = vec3(0.0, 0.0, 1.0);
uniform float flash = 0.0;
uniform vec3 flash_color : source_color = vec3(1.0);
uniform float height = 0.66;

void vertex() {
	float h = clamp(VERTEX.y / height, 0.0, 1.0);
	float ang = atan(VERTEX.x, VERTEX.z);
	float j = sin(TIME * 17.0 + VERTEX.y * 14.0 + ang * 2.0) * 0.6 + sin(TIME * 11.0 + ang * 3.0) * 0.4;
	VERTEX += NORMAL * j * wobble * 0.035 * h;
	VERTEX += wobble_dir * sin(TIME * 13.0) * wobble * 0.03 * h * h;
	// charge swell: belly bulges & surface ripples
	VERTEX += NORMAL * charge * (0.02 + 0.012 * sin(TIME * 30.0 + VERTEX.y * 30.0)) * h;
	v_world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	v_world_normal = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

void fragment() {
	float ndv = clamp(dot(NORMAL, VIEW), 0.0, 1.0);
	float fres = 1.0 - ndv;
	vec3 base = COLOR.rgb;
	// gel: deeper toward center, glassy cyan toward the silhouette (hard band = comic)
	vec3 c = mix(base * 0.82, base, smoothstep(0.15, 0.5, fres));
	c = mix(c, rim_gel, step(0.72, fres) * 0.55);
	v_brush = 0.5;
	ALBEDO = c;
	ROUGHNESS = 0.2;
	SPECULAR = 0.5;
	float core = pow(ndv, 2.5);
	EMISSION = core_glow * (glow_base + charge * 2.2) * core + flash_color * flash;
	ALPHA = mix(alpha_center, alpha_edge, smoothstep(0.1, 0.6, fres));
}

void light() {
	sl_light(NORMAL, LIGHT, VIEW, LIGHT_COLOR, ATTENUATION, LIGHT_IS_DIRECTIONAL, 0.5, ALBEDO, FRAGCOORD.xy, DIFFUSE_LIGHT, SPECULAR_LIGHT);
	if (LIGHT_IS_DIRECTIONAL) {
		// big comic gel highlight (hard-edged) + small secondary dot
		vec3 h = normalize(LIGHT + VIEW);
		float nh = dot(NORMAL, h);
		float hi = step(0.94, nh) + step(0.985, dot(NORMAL, normalize(LIGHT + VIEW * 1.6 + vec3(0.0, 0.3, 0.0)))) * 0.6;
		SPECULAR_LIGHT += LIGHT_COLOR / PI * min(hi, 1.0) * 2.4 * step(0.5, ATTENUATION);
	}
}
