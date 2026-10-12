shader_type sky;
render_mode use_debanding;
// Painterly sky for the shard worlds: gradient, brushy clouds, sun halo, the Fracture scar, and the violet
// void below the horizon (each world is a floating shard in the Seam).
uniform vec3 top_color : source_color = vec3(0.31, 0.7, 1.0);
uniform vec3 horizon_color : source_color = vec3(1.0, 0.9, 0.72);
uniform vec3 void_color : source_color = vec3(0.16, 0.08, 0.32);
uniform vec3 void_glow : source_color = vec3(0.62, 0.42, 1.0);
uniform vec3 cloud_light : source_color = vec3(1.0, 0.98, 0.95);
uniform vec3 cloud_shadow : source_color = vec3(0.55, 0.6, 0.95);
uniform float cloud_coverage : hint_range(0.0, 1.0) = 0.5;
uniform float cloud_speed = 0.004;
uniform vec3 scar_color : source_color = vec3(0.75, 0.45, 1.0);
uniform float scar_intensity = 1.0;
uniform float star_intensity = 0.0;
uniform float horizon_sharpness = 2.4;
uniform float sun_size = 0.035;
uniform float sun_halo = 0.35;
uniform sampler2D cloud_noise : filter_linear_mipmap, repeat_enable;
uniform sampler2D cloud_detail : filter_linear_mipmap, repeat_enable;

float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }

void sky() {
	vec3 d = EYEDIR;
	float y = d.y;
	// base gradient
	float up = pow(clamp(y, 0.0, 1.0), 1.0 / horizon_sharpness);
	vec3 col = mix(horizon_color, top_color, up);
	// below horizon: the Seam void, glowing near the rim
	if (y < 0.0) {
		float dn = clamp(-y * 3.0, 0.0, 1.0);
		vec3 glow = mix(horizon_color, void_glow, 0.6);
		col = mix(glow, void_color, pow(dn, 0.55));
		float s = hash(floor(d * 300.0));
		col += vec3(step(0.997, s)) * 0.8 * dn;
	}
	if (AT_CUBEMAP_PASS == false || true) {
		// sun
		vec3 sun_dir = LIGHT0_DIRECTION;
		float sd = dot(d, sun_dir);
		float disc = smoothstep(cos(sun_size), cos(sun_size * 0.8), sd);
		float halo = pow(max(sd, 0.0), 12.0) * sun_halo + pow(max(sd, 0.0), 200.0) * 0.8;
		col += LIGHT0_COLOR * (disc * 6.0 + halo) * float(LIGHT0_ENABLED);
	}
	// Fracture scar: a jagged luminous crack across the sky
	{
		float ang = atan(d.x, d.z);
		float band = d.y - (0.42 + sin(ang * 3.0) * 0.06 + sin(ang * 11.0) * 0.02 + sin(ang * 23.0 + 1.3) * 0.008);
		float jag = abs(band);
		float core = 1.0 - smoothstep(0.0, 0.006, jag);
		float glow = exp(-jag * 40.0) * 0.5;
		float flicker = 0.85 + 0.15 * sin(TIME * 0.7 + ang * 5.0);
		col += scar_color * (core * 2.5 + glow) * scar_intensity * flicker * smoothstep(-0.05, 0.25, d.y);
	}
	// stars
	if (star_intensity > 0.0 && y > 0.0) {
		float s = hash(floor(d * 420.0));
		col += vec3(step(0.996, s)) * star_intensity * up;
	}
	// comic clouds: big cauliflower masses, hard edge, ink outline, lit tops / cool shaded bellies
	if (y > 0.015) {
		vec2 uv = d.xz / (y + 0.12) * 0.35;
		uv += vec2(TIME * cloud_speed, TIME * cloud_speed * 0.4);
		vec2 cu = uv * 0.28;
		float n = texture(cloud_noise, cu).r * 0.82 + texture(cloud_detail, uv * 1.4 + 3.1).r * 0.18;
		float cov = 1.0 - cloud_coverage;
		float aa = 0.012;
		float mask = smoothstep(cov - aa, cov + aa, n);
		float ink = mask * (1.0 - smoothstep(cov + 0.012, cov + 0.03, n));
		// shaded belly: sample the field a little "below" (toward the horizon) — if it's still cloud there, we're on top
		vec2 down = normalize(d.xz + vec2(1e-4)) * 0.035;
		float nb = texture(cloud_noise, cu + down).r * 0.82 + texture(cloud_detail, (uv + down / 0.28) * 1.4 + 3.1).r * 0.18;
		float lit = smoothstep(cov + 0.04, cov + 0.06, nb);
		vec3 ccol = mix(cloud_shadow, cloud_light, lit);
		// sun-side warm rim
		ccol += LIGHT0_COLOR * 0.12 * step(0.9, dot(d, LIGHT0_DIRECTION));
		ccol = mix(ccol, vec3(0.09, 0.06, 0.18), ink * 0.85);
		float fade = smoothstep(0.015, 0.16, y);
		col = mix(col, ccol, mask * fade);
	}
	COLOR = col;
}
