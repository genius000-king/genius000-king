'use strict';
// ══════════════════════════════════════════════════════════════
//  Armies — two ranks of cube-soldiers (graphite on the left, white on the right).
//  They idle, march, charge; when the fronts meet, a wave of impact runs back through the ranks and every
//  soldier bursts into ballistic cubes (gravity, floor bounces, tumbling). All of it is a pure function of
//  WORLD time Tw, and Tw is a warp of real time (bullet time) — so the same code serves picture and sound.
// ══════════════════════════════════════════════════════════════
const Army = (() => {
  const CZ = -1.5, RANKS = 8, FILES = 12, GAP0 = 3.4, SC = 1.45;
  const T_SLOW = 40.5, T_CHARGE = 45.8, T_C = 47.05;
  const PER = 49;

  // soldier template in soldier space: +x forward, y up, z right. part: 0 legL 1 legR 2 torso 3 head 4 armL 5 armR 6 shield 7 spear
  const TPL = (() => {
    const T = [], a = (part, x, y, z, s) => T.push({ part, x, y, z, s });
    for (const [sg, p] of [[-1, 0], [1, 1]]) for (let i = 0; i < 5; i++) a(p, 0, 0.04 + 0.075 * i, sg * 0.075, 0.036);
    for (let yi = 0; yi < 4; yi++) for (let zi = -1; zi <= 1; zi++) a(2, 0, 0.40 + 0.075 * yi, zi * 0.075, 0.037);
    a(3, 0, 0.74, 0, 0.05); a(3, 0.01, 0.82, 0, 0.026); a(3, -0.03, 0.86, 0, 0.024);
    for (let i = 0; i < 3; i++) { a(4, 0.0, 0.62 - 0.07 * i, -0.17, 0.03); a(5, 0.02, 0.62 - 0.07 * i, 0.17, 0.03); }
    for (let yi = 0; yi < 3; yi++) for (let zi = 0; zi < 3; zi++) a(6, 0.10, 0.34 + 0.075 * yi, -0.26 - 0.07 * zi * 0.0 + (zi - 1) * 0.07, 0.03 + (yi === 1 && zi === 1 ? 0.0 : 0.004));
    for (let i = 0; i < 8; i++) a(7, 0.06 + 0.012 * i, 0.30 + 0.075 * i, 0.22, 0.016);
    a(7, 0.15, 0.93, 0.22, 0.034);
    return T;
  })();

  function build() {
    const r = rng(777), sol = [];
    for (const side of [0, 1]) {                                  // 0: left / graphite / faces +x · 1: right / white / faces −x
      for (let rk = 0; rk < RANKS; rk++) for (let f = 0; f < FILES; f++) {
        const dir = side === 0 ? 1 : -1;
        sol.push({ side, dir, rk, f, bx: -dir * (GAP0 + 0.80 * rk) + (r() - 0.5) * 0.10, bz: CZ + (f - (FILES - 1) / 2) * 0.90 + (r() - 0.5) * 0.10, ph: r() * TAU, tb: T_C + 0.05 * rk + 0.01 * r(), seed: r() });
      }
    }
    // slots: soldier-major, template-minor
    const slots = [];
    sol.forEach((s, si) => TPL.forEach((tp, ti) => slots.push({ si, ti })));
    return { sol, slots, n: slots.length };
  }

  // ── time warp (bullet time): world time as a function of real time ──
  const WARP = (() => {
    const dt = 0.002, N = Math.round(64 / dt), tab = new Float32Array(N + 1);
    const rate = t => 1 - 0.85 * (sstep(46.85, 47.10, t) - sstep(49.0, 49.8, t));
    let T = 0; tab[0] = 0;
    for (let i = 1; i <= N; i++) { T += rate((i - 0.5) * dt) * dt; tab[i] = T; }
    return { dt, tab, rate };
  })();
  const warp = t => { const x = Math.max(0, t) / WARP.dt, i = Math.min(Math.floor(x), WARP.tab.length - 2); return WARP.tab[i] + (WARP.tab[i + 1] - WARP.tab[i]) * (x - i); };
  const unwarp = Tw => { let lo = 0, hi = 64; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; (warp(m) < Tw) ? lo = m : hi = m; } return lo; };

  const adv = T => T < T_SLOW ? 0 : T < T_CHARGE ? 0.12 * (T - T_SLOW) : T < T_C ? 0.636 + 2.66 * E.inQuad((T - T_CHARGE) / (T_C - T_CHARGE)) : 3.3 + 4.4 * (T - T_C);
  const gaitHz = T => 1.1 + 3.4 * sstep(T_CHARGE - 1.5, T_C, T);

  // pose of one template cube at world time T (before any explosion): returns [x,y,z,size,qx,qy,qz,qw]
  const _o = [0, 0, 0, 0, 0, 0, 0, 1];
  function pose(s, tp, T, out = _o) {
    const march = T >= T_SLOW ? 1 : 0, ph = TAU * gaitHz(T) * T + s.ph;
    let lx = tp.x, ly = tp.y, lz = tp.z, q = Forms.QI;
    const swing = march ? 0.55 * Math.sin(ph) : 0.03 * Math.sin(1.3 * T + s.ph);
    if (tp.part === 0 || tp.part === 1) {
      const th = (tp.part === 0 ? swing : -swing), hip = 0.34, dy = ly - hip, c = Math.cos(th), sn = Math.sin(th);
      ly = hip + dy * c; lx = tp.x - dy * sn; q = Forms.qAxis([0, 0, 1], th);
    } else if (tp.part === 4 || tp.part === 5) {
      const th = (tp.part === 4 ? -swing : swing) * 0.7, sh = 0.64, dy = ly - sh, c = Math.cos(th), sn = Math.sin(th);
      ly = sh + dy * c; lx = tp.x - dy * sn; q = Forms.qAxis([0, 0, 1], th);
    } else if (tp.part === 7) {
      const th = -0.20 + 0.04 * Math.sin(ph), hy = 0.34, dy = ly - hy, dx = lx - 0.06, c = Math.cos(th), sn = Math.sin(th);
      lx = 0.06 + dx * c - dy * sn; ly = hy + dx * sn + dy * c; q = Forms.qAxis([0, 0, 1], th);
    }
    const bob = march ? 0.02 * Math.abs(Math.sin(ph)) : 0;
    const a = adv(T);
    // soldier space → world: facing +x for side 0, −x for side 1 (rotate 180° about Y)
    const d = s.dir;
    out[0] = s.bx + d * a + d * lx * SC; out[1] = ly * SC + bob; out[2] = s.bz + d * lz * SC; out[3] = tp.s * SC;
    const qq = d > 0 ? q : Forms.qMul(Forms.qYaw(Math.PI), q);
    out[4] = qq[0]; out[5] = qq[1]; out[6] = qq[2]; out[7] = qq[3];
    return out;
  }

  // ballistic height with floor bounces
  function bounceY(y0, vy, tau, floor, e = 0.38) {
    let y = y0, v = vy, t = tau, g = 9.0;
    for (let k = 0; k < 4; k++) {
      const disc = v * v + 2 * g * (y - floor);
      const th = disc < 0 ? 1e9 : (v + Math.sqrt(disc)) / g;
      if (t <= th) return floor + (y - floor) + v * t - 0.5 * g * t * t;
      const vh = v - g * th; y = floor; v = -vh * e; t -= th;
      if (Math.abs(v) < 0.4) return floor;
    }
    return floor;
  }
  const _p = [0, 0, 0, 0, 0, 0, 0, 1];
  // full cube state for army slot (si, ti) at world time T
  function evalCube(s, tp, ti, T, out) {
    if (T < s.tb) { pose(s, tp, T, out); return out; }
    const tau = T - s.tb;
    pose(s, tp, s.tb, _p);                                           // where it was when the wave reached it
    const h = (n) => hash1(s.seed * 977 + ti * 13.17 + n * 3.31);
    const fwd = s.dir * (adv(Math.max(s.tb, T_C)) > 0 ? 1 : 1);
    const vx = fwd * (3.2 + 3.8 * h(1)) * (h(2) < 0.55 ? 1 : -0.6) + (h(3) - 0.5) * 3.0;
    const vz = (h(4) - 0.5) * 6.0;
    const vy = 3.2 + 7.5 * h(5) * (1 - 0.35 * s.rk / RANKS);
    const k = 0.7;                                                     // horizontal drag
    const dxy = (1 - Math.exp(-k * tau)) / k;
    out[0] = _p[0] + vx * dxy; out[2] = _p[2] + vz * dxy;
    out[1] = bounceY(_p[1], vy, tau, _p[3] * 1.0);
    out[3] = _p[3];
    const w = 3 + 9 * h(6), ang = w * (1 - Math.exp(-tau * 0.9)) / 0.9;
    const ax = V3.norm([h(7) - 0.5, h(8) - 0.5 + 0.2, h(9) - 0.5]);
    const qq = Forms.qMul(Forms.qAxis(ax, ang), [_p[4], _p[5], _p[6], _p[7]]);
    out[4] = qq[0]; out[5] = qq[1]; out[6] = qq[2]; out[7] = qq[3];
    return out;
  }
  return { RANKS, FILES, PER, CZ, GAP0, T_SLOW, T_CHARGE, T_C, TPL, build, warp, unwarp, pose, evalCube, adv };
})();
