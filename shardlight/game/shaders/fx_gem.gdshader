shader_type spatial;
render_mode unshaded, cull_back;
// Glowing faceted gem (memory echoes, keystones): flat facets in 3 tones + hard white glint, pulsing.
uniform vec3 base : source_color = vec3(0.55, 0.85, 1.0);
uniform vec3 dark : source_color = vec3(0.3, 0.35, 0.9);
uniform vec3 hi : source_color = vec3(1.0, 1.0, 1.0);
uniform float energy = 2.2;
uniform float pulse = 0.25;
void fragment() {
	vec3 n = normalize(NORMAL);
	float f = dot(n, normalize(vec3(0.4, 0.7, 0.6)));
	vec3 col = f > 0.55 ? hi : (f > 0.0 ? base : dark);
	float fres = 1.0 - clamp(dot(n, VIEW), 0.0, 1.0);
	col = mix(col, hi, step(0.85, fres) * 0.6);
	ALBEDO = col * energy * (1.0 + sin(TIME * 3.0) * pulse);
}
