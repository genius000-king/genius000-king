// Full-screen comic pass (quad in front of the camera): ink lines from depth + normal discontinuities,
// slight paper grain and a vignette. Draws before other transparents (render_priority -128) so VFX stay clean.
uniform sampler2D screen_tex : hint_screen_texture, filter_nearest;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest;
#ifdef SL_NORMALS
uniform sampler2D normal_tex : hint_normal_roughness_texture, filter_nearest;
#endif
uniform vec3 ink : source_color = vec3(0.07, 0.04, 0.13);
uniform float line_px = 1.25;
uniform float depth_sens = 1.1;
uniform float normal_sens = 1.0;
uniform float line_strength = 0.92;
uniform float max_dist = 220.0;
uniform float vignette = 0.28;
uniform float grain = 0.035;

void vertex() {
	POSITION = vec4(VERTEX.xy * 2.0, 1.0, 1.0);
}

float lin_depth(vec2 uv, mat4 inv_proj) {
	float d = texture(depth_tex, uv).r;
	vec4 v = inv_proj * vec4(uv * 2.0 - 1.0, d, 1.0);
	return -v.z / v.w;
}

void fragment() {
	vec2 px = line_px / VIEWPORT_SIZE;
	vec2 uv = SCREEN_UV;
	float c = lin_depth(uv, INV_PROJECTION_MATRIX);
	float l = lin_depth(uv - vec2(px.x, 0.0), INV_PROJECTION_MATRIX);
	float r = lin_depth(uv + vec2(px.x, 0.0), INV_PROJECTION_MATRIX);
	float u = lin_depth(uv - vec2(0.0, px.y), INV_PROJECTION_MATRIX);
	float d = lin_depth(uv + vec2(0.0, px.y), INV_PROJECTION_MATRIX);
	// relative depth discontinuity (scale-invariant), second-derivative so slopes don't ink
	float dd = abs(l + r - 2.0 * c) + abs(u + d - 2.0 * c);
	float edge_d = smoothstep(0.04, 0.12, dd / max(c, 0.5) * depth_sens * 8.0);
	float edge_n = 0.0;
#ifdef SL_NORMALS
	vec3 nc = texture(normal_tex, uv).xyz * 2.0 - 1.0;
	vec3 nl = texture(normal_tex, uv - vec2(px.x, 0.0)).xyz * 2.0 - 1.0;
	vec3 nr = texture(normal_tex, uv + vec2(px.x, 0.0)).xyz * 2.0 - 1.0;
	vec3 nu = texture(normal_tex, uv - vec2(0.0, px.y)).xyz * 2.0 - 1.0;
	vec3 nd = texture(normal_tex, uv + vec2(0.0, px.y)).xyz * 2.0 - 1.0;
	float ndiff = (1.0 - dot(nc, nl)) + (1.0 - dot(nc, nr)) + (1.0 - dot(nc, nu)) + (1.0 - dot(nc, nd));
	edge_n = smoothstep(0.35, 0.9, ndiff * normal_sens);
#endif
	float edge = max(edge_d, edge_n) * (1.0 - smoothstep(max_dist * 0.5, max_dist, c));
	vec3 col = texture(screen_tex, uv).rgb;
	col = mix(col, ink, edge * line_strength);
	// paper grain + vignette
	float n = fract(sin(dot(floor(FRAGCOORD.xy * 0.5), vec2(12.9898, 78.233))) * 43758.5453);
	col *= 1.0 + (n - 0.5) * grain;
	vec2 q = uv - 0.5;
	col *= 1.0 - dot(q, q) * vignette;
	ALBEDO = col;
	ALPHA = 1.0;
}
