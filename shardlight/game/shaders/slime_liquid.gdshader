shader_type spatial;
render_mode cull_front, depth_draw_always, diffuse_lambert, specular_disabled;
// Blu as a LIQUID: a raymarched smooth-union of soft blobs (metaballs) inside a bounding box.
// The script moves the blobs with springs/inertia so the body flows, stretches, puddles and splashes.
// Comic look: hard 2-tone cel light, hatch lines in shadow, thick ink silhouette computed from the SDF,
// hard white gel highlights, translucent depth (thicker = deeper blue) and a glowing core inside.
#include "res://shaders/stylized_common.gdshaderinc"

const int MAX_BLOBS = 12;
uniform vec4 blobs[12];            // xyz = local center, w = radius (w <= 0 → unused)
uniform int blob_count = 6;
uniform float smooth_k = 0.16;     // merge softness (higher = more liquid bridging)
uniform float floor_y = 0.0;       // local ground plane: liquid flattens against it
uniform vec3 core_pos = vec3(0.0, 0.28, 0.0);
uniform float core_radius = 0.065;
uniform float charge = 0.0;
uniform vec3 gel_light : source_color = vec3(0.13, 0.55, 1.0);
uniform vec3 gel_deep : source_color = vec3(0.04, 0.12, 0.62);
uniform vec3 gel_rim : source_color = vec3(0.45, 0.93, 1.0);
uniform vec3 core_color : source_color = vec3(0.75, 0.5, 1.0);
uniform vec3 ink : source_color = vec3(0.07, 0.04, 0.13);
uniform float ink_px = 4.2;
uniform float flash = 0.0;
uniform vec3 flash_color : source_color = vec3(1.0);
uniform float hatch_px = 6.0;
uniform float wobble = 0.0;


float smin(float a, float b, float k) {
	float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
	return mix(b, a, h) - k * h * (1.0 - h);
}

float sdf(vec3 p) {
	float d = 1e3;
	for (int i = 0; i < MAX_BLOBS; i++) {
		if (i >= blob_count) break;
		vec4 b = blobs[i];
		if (b.w <= 0.0) continue;
		vec3 q = p - b.xyz;
		// surface ripple
		float rip = sin(q.x * 31.0 + TIME * 9.0) * sin(q.z * 27.0 - TIME * 7.0) * 0.006 * wobble;
		d = smin(d, length(q) - b.w + rip, smooth_k);
	}
	// liquid presses onto the floor: cut below floor and round the contact
	d = max(d, floor_y - p.y);
	return d;
}

vec3 sdf_normal(vec3 p) {
	vec2 e = vec2(0.0015, -0.0015);
	return normalize(e.xyy * sdf(p + e.xyy) + e.yyx * sdf(p + e.yyx) + e.yxy * sdf(p + e.yxy) + e.xxx * sdf(p + e.xxx));
}

void vertex() {
}

void fragment() {
	// ray in local space
	mat4 inv_model = inverse(MODEL_MATRIX);
	vec3 world_frag = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vec3 ro = (inv_model * vec4(CAMERA_POSITION_WORLD, 1.0)).xyz;
	vec3 rd = normalize((inv_model * vec4(world_frag, 1.0)).xyz - ro);
	// start at the box entry (camera may be inside the box)
	vec3 bmin = vec3(-1.0, -0.05, -1.0);
	vec3 bmax = vec3(1.0, 1.4, 1.0);
	vec3 t0 = (bmin - ro) / rd;
	vec3 t1 = (bmax - ro) / rd;
	vec3 tmin3 = min(t0, t1);
	vec3 tmax3 = max(t0, t1);
	float tn = max(max(tmin3.x, tmin3.y), max(tmin3.z, 0.0));
	float tf = min(min(tmax3.x, tmax3.y), tmax3.z);
	float t = tn;
	float min_d = 1e3;
	float t_at_min = t;
	bool hit = false;
	for (int i = 0; i < 64; i++) {
		vec3 p = ro + rd * t;
		float d = sdf(p);
		if (d < min_d) { min_d = d; t_at_min = t; }
		if (d < 0.0008) { hit = true; break; }
		t += max(d * 0.9, 0.002);
		if (t > tf) break;
	}
	// pixel size at the closest approach → constant-width ink silhouette
	float px_world = t_at_min * 2.0 / (PROJECTION_MATRIX[1][1] * VIEWPORT_SIZE.y);
	if (!hit) {
		if (min_d < ink_px * px_world) {
			// outline ring outside the body
			vec3 pw = (MODEL_MATRIX * vec4(ro + rd * t_at_min, 1.0)).xyz;
			vec4 clip = PROJECTION_MATRIX * VIEW_MATRIX * vec4(pw, 1.0);
			DEPTH = clip.z / clip.w;
			ALBEDO = vec3(0.0);
			EMISSION = ink;
			NORMAL = vec3(0.0, 0.0, 1.0);
			v_brush = -1.0;   // flag: unlit ink
		} else {
			discard;
		}
	} else {
		vec3 p = ro + rd * t;
		vec3 n = sdf_normal(p);
		vec3 pw = (MODEL_MATRIX * vec4(p, 1.0)).xyz;
		vec4 clip = PROJECTION_MATRIX * VIEW_MATRIX * vec4(pw, 1.0);
		DEPTH = clip.z / clip.w;
		vec3 nw = normalize((MODEL_MATRIX * vec4(n, 0.0)).xyz);
		NORMAL = normalize((VIEW_MATRIX * vec4(nw, 0.0)).xyz);
		// thickness along the view ray → translucent depth color
		float thick = 0.0;
		vec3 q = p + rd * 0.01;
		for (int i = 0; i < 10; i++) {
			if (sdf(q) < 0.0) thick += 0.045;
			q += rd * 0.045;
		}
		float th = clamp(thick / 0.5, 0.0, 1.0);
		// posterized depth bands (comic, not smooth)
		float band = floor(th * 3.0 + 0.5) / 3.0;
		vec3 col = mix(gel_light, gel_deep, band * 0.75);
		float fres = 1.0 - clamp(dot(nw, normalize(CAMERA_POSITION_WORLD - pw)), 0.0, 1.0);
		col = mix(col, gel_rim, step(0.62, fres) * 0.6);
		// core glow seen through the gel (distance from ray to core)
		vec3 oc = core_pos - ro;
		float tc = clamp(dot(oc, rd), 0.0, 100.0);
		float dc = length(ro + rd * tc - core_pos);
		float cr = core_radius * (1.0 + charge * 0.55);
		float core_mask = 1.0 - smoothstep(cr * 0.9, cr * 1.1, dc);
		// hard-edged comic core: bright disc + one stepped halo ring (no wash over the whole body)
		float core_halo = (1.0 - step(cr * (1.3 + charge * 0.35), dc)) * (1.0 - core_mask);
		vec3 hot = mix(core_color, vec3(1.0, 0.95, 1.0), charge * 0.6);
		ALBEDO = col * (1.0 - core_mask * 0.7);
		EMISSION = hot * core_mask * (0.8 + charge * 1.8) + core_color * core_halo * (0.1 + charge * 0.5) + flash_color * flash;
		ROUGHNESS = 0.2;
		v_brush = 0.5;
		v_world_pos = pw;
	}
}

void light() {
	if (v_brush < 0.0) {
		// ink: unlit
	} else {
		sl_light(NORMAL, LIGHT, VIEW, LIGHT_COLOR, ATTENUATION, LIGHT_IS_DIRECTIONAL, 0.5, ALBEDO, FRAGCOORD.xy, DIFFUSE_LIGHT, SPECULAR_LIGHT);
		if (LIGHT_IS_DIRECTIONAL) {
			float ndl = dot(NORMAL, LIGHT);
			// drawn hatch lines inside the shadow side
			vec2 f = FRAGCOORD.xy;
			float hatch = step(0.62, fract((f.x + f.y) / hatch_px)) * (1.0 - step(-0.05, ndl)) * 0.5;
			DIFFUSE_LIGHT *= 1.0 - hatch;
			// hard gel highlights: big comma + small dot
			vec3 h = normalize(LIGHT + VIEW);
			float hi = step(0.962, dot(NORMAL, h));
			vec3 h2 = normalize(LIGHT * 0.6 + VIEW + vec3(-0.25, 0.15, 0.0));
			hi = max(hi, step(0.992, dot(NORMAL, h2)));
			SPECULAR_LIGHT += vec3(hi) * 1.6 * step(0.5, ATTENUATION);
		}
	}
}
