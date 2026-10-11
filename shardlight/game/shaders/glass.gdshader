shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back;
// Prism crystal / glass: tinted by vertex color, fresnel edge glow, inner sparkle.
uniform vec4 tint : source_color = vec4(1.0);
uniform float base_alpha : hint_range(0.0, 1.0) = 0.45;
uniform float edge_glow = 1.6;
uniform float inner_glow = 0.6;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec3 c = COLOR.rgb * tint.rgb;
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.5);
	float sparkle = pow(max(0.0, sin(wp.x * 7.0 + TIME * 1.7) * sin(wp.y * 9.0 - TIME * 1.3) * sin(wp.z * 8.0 + TIME)), 12.0);
	ALBEDO = c * 0.6;
	EMISSION = c * (fres * edge_glow + inner_glow) + vec3(sparkle) * 2.0;
	ROUGHNESS = 0.05;
	SPECULAR = 0.8;
	ALPHA = clamp(base_alpha + fres * 0.5, 0.0, 1.0);
}
