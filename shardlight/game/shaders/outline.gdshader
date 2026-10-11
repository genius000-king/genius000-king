shader_type spatial;
render_mode unshaded, cull_front, depth_draw_opaque, shadows_disabled, fog_disabled;
// Inverted-hull ink outline (comic). Constant-ish pixel width, thinner with distance; line color is a deep
// ink tinted by the surface color so lines feel drawn, not mechanical.
uniform vec3 ink : source_color = vec3(0.08, 0.05, 0.14);
uniform float width_px = 2.6;
uniform float tint_amount : hint_range(0.0, 1.0) = 0.25;
uniform float far_fade = 90.0;
varying vec3 v_col;
void vertex() {
	v_col = COLOR.rgb;
	vec4 clip = PROJECTION_MATRIX * (MODELVIEW_MATRIX * vec4(VERTEX, 1.0));
	vec3 n_view = normalize(mat3(MODELVIEW_MATRIX) * NORMAL);
	vec2 dir = (PROJECTION_MATRIX * vec4(n_view, 0.0)).xy;
	float l = length(dir);
	dir = l > 1e-5 ? dir / l : vec2(0.0);
	float w = width_px * mix(1.0, 0.35, smoothstep(6.0, far_fade, clip.w));
	clip.xy += dir / VIEWPORT_SIZE * w * clip.w * 2.0;
	POSITION = clip;
}
void fragment() {
	ALBEDO = mix(ink, v_col * 0.25, tint_amount);
}
