shader_type spatial;
render_mode unshaded, cull_disabled, blend_mix, depth_draw_opaque;
// Comic rift portal: flat-color spiral bands with ink lines, a bright eye, stars drifting inward.
uniform vec3 c1 : source_color = vec3(0.62, 0.42, 1.0);
uniform vec3 c2 : source_color = vec3(0.98, 0.55, 0.85);
uniform vec3 c3 : source_color = vec3(1.0, 0.95, 0.7);
uniform vec3 ink : source_color = vec3(0.08, 0.04, 0.14);
uniform float speed = 1.0;
uniform float energy = 1.6;
void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	float r = length(p);
	if (r > 1.0) discard;
	float a = atan(p.y, p.x);
	float sp = a / TAU + r * 1.6 - TIME * 0.35 * speed;
	float band = fract(sp * 4.0);
	vec3 col = band < 0.33 ? c1 : (band < 0.66 ? c2 : c1 * 0.75);
	float edge = smoothstep(0.0, 0.04, abs(band - 0.33)) * smoothstep(0.0, 0.04, abs(band - 0.66));
	col = mix(ink, col, mix(1.0, edge, 0.85 * smoothstep(0.15, 0.4, r)));
	float eye = 1.0 - smoothstep(0.16, 0.2, r);
	col = mix(col, c3, eye);
	// drifting star specks
	vec2 g = vec2(a * 6.0, r * 8.0 + TIME * 1.5 * speed);
	float star = step(0.97, fract(sin(dot(floor(g), vec2(12.9898, 78.233))) * 43758.5453)) * step(0.3, r);
	col = mix(col, c3, star);
	float rim = smoothstep(0.92, 0.96, r);
	col = mix(col, ink, rim);
	ALBEDO = col * energy;
	ALPHA = 1.0;
}
