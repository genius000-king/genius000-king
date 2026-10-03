'use strict';
// minimal column-major mat4 / vec3 toolkit
const V3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  mix: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: a => Math.hypot(a[0], a[1], a[2]),
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};
const M4 = {
  persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]; },
  ortho(l, r, b, t, n, f) { return [2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]; },
  look(e, c, up = [0, 1, 0]) {
    const z = V3.norm(V3.sub(e, c)); const x = V3.norm(V3.cross(up, z)); const y = V3.cross(z, x);
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -V3.dot(x, e), -V3.dot(y, e), -V3.dot(z, e), 1];
  },
  mul(a, b) { const o = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return o; },
};
// camera: position, look-at, vertical fov (rad), roll (rad)
class Cam {
  constructor(pos, look, fov = 0.8, roll = 0) { this.pos = pos; this.look = look; this.fov = fov; this.roll = roll; }
  basis() {
    const fwd = V3.norm(V3.sub(this.look, this.pos));
    let up = [0, 1, 0];
    let right = V3.norm(V3.cross(fwd, up)); up = V3.cross(right, fwd);
    if (this.roll) { const c = Math.cos(this.roll), s = Math.sin(this.roll); const r2 = V3.add(V3.mul(right, c), V3.mul(up, s)); up = V3.add(V3.mul(up, c), V3.mul(right, -s)); right = r2; }
    return { fwd, right, up };
  }
  vp(asp) {
    const { up } = this.basis();
    return M4.mul(M4.persp(this.fov, asp, 0.05, 400), M4.look(this.pos, this.look, up));
  }
  // project a world point to virtual 1920×1080 screen coordinates (y down); returns [x,y,w]
  project(p) {
    const m = this.vp(16 / 9);
    const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    return [(x / w * 0.5 + 0.5) * 1920, (1 - (y / w * 0.5 + 0.5)) * 1080, w];
  }
}
// Catmull-Rom through keyframes [{t, p:[x,y,z], look:[...], fov, roll}] → Cam
function camFromKeys(keys, t) {
  t = Math.min(Math.max(t, keys[0].t), keys[keys.length - 1].t);
  let i = 0; while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const a = keys[i], b = keys[i + 1], pa = keys[Math.max(i - 1, 0)], pb = keys[Math.min(i + 2, keys.length - 1)];
  const u = (t - a.t) / (b.t - a.t);
  const cr = (p0, p1, p2, p3) => 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
  const v3 = k => [0, 1, 2].map(j => cr(pa[k][j], a[k][j], b[k][j], pb[k][j]));
  const sc = k => cr(pa[k] ?? 0, a[k] ?? 0, b[k] ?? 0, pb[k] ?? 0);
  return new Cam(v3('p'), v3('look'), keys[0].fov === undefined ? 0.8 : sc('fov'), sc('roll'));
}
