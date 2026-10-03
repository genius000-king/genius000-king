'use strict';
// ══════════════════════════════════════════════════════════════
//  Dragon — a serpent of cubes that follows its own head along a path.
//  Pure function of time: spine(s,t) = path(t − s/v) + a travelling wave.
//  Slots: body rings · dorsal spikes · head · jaw · horns · eyes · bat wings · spade · smoke trail · dust.
// ══════════════════════════════════════════════════════════════
const Dragon = (() => {
  const NC = 32768;
  const V_SP = 6.4, L = 13.0, DS = 0.105, NR = Math.floor(L / DS) + 1;
  const TRAIL_L = 11, NTR = 64;
  const SHOULDER = 2.7;                                           // wing root along the spine

  // head path in world space (scene centre ≈ (0, ·, −1.5)); coils in toward the floor after 27.4 s
  function H(tau) {
    const ph = 0.80 * tau + 0.5;
    const up = sstep(28.0, 31.0, tau);
    const R = 6.4 + 0.9 * Math.sin(0.5 * tau) + 3.2 * up;
    const y = 4.4 + 1.6 * Math.sin(0.62 * tau + 1.0) + 2.4 * up;
    return [R * Math.cos(ph), y, R * Math.sin(ph) - 1.5];
  }
  // spine frame at arclength s, time t → { p, T, N, B }
  function spine(s, t, o) {
    const tau = t - s / V_SP, e = 0.03;
    const a = H(tau - e), b = H(tau + e), p = H(tau);
    let T = V3.norm(V3.sub(b, a));
    let B = V3.cross(T, [0, 1, 0]); const bl = V3.len(B); B = bl < 1e-4 ? [0, 0, 1] : V3.mul(B, 1 / bl);
    const N = V3.cross(B, T);
    const w = (0.35 + 0.65 * Math.min(s / 5, 1)) * 0.30, ph = 1.6 * s - 4.4 * t;
    const lat = w * Math.sin(ph), vert = 0.18 * Math.sin(ph + 1.1) * Math.min(s / 3, 1);
    o.p = [p[0] + B[0] * lat + N[0] * vert, p[1] + B[1] * lat + N[1] * vert, p[2] + B[2] * lat + N[2] * vert];
    o.T = T; o.N = N; o.B = B;
    o.q = frameQuat(T, N, B);
    return o;
  }
  // rotation with columns X=T, Y=N, Z=B → quaternion [x,y,z,w]
  function frameQuat(T, N, B) {
    const m00 = T[0], m10 = T[1], m20 = T[2], m01 = N[0], m11 = N[1], m21 = N[2], m02 = B[0], m12 = B[1], m22 = B[2];
    const tr = m00 + m11 + m22;
    if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); return [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s]; }
    if (m00 > m11 && m00 > m22) { const s = 2 * Math.sqrt(1 + m00 - m11 - m22); return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
    if (m11 > m22) { const s = 2 * Math.sqrt(1 + m11 - m00 - m22); return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]; }
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11); return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
  }
  const radius = s => {
    const neck = 0.19 + 0.40 * sstep(0, 3.2, s);
    const tail = 1 - sstep(6.5, L, s);
    return (s < 6.5 ? neck : 0.59 * Math.pow(tail, 0.85)) + 0.035;
  };

  // ── slot construction ──────────────────────────────────────
  function boxShell(x0, x1, y0, y1, z0, z1, sp) {
    const out = [], nx = Math.max(1, Math.round((x1 - x0) / sp)), ny = Math.max(1, Math.round((y1 - y0) / sp)), nz = Math.max(1, Math.round((z1 - z0) / sp));
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) for (let k = 0; k <= nz; k++) {
      if (i > 0 && i < nx && j > 0 && j < ny && k > 0 && k < nz) continue;
      out.push([x0 + (x1 - x0) * i / nx, y0 + (y1 - y0) * j / ny, z0 + (z1 - z0) * k / nz]);
    }
    return out;
  }
  // wing planform (wing-local: u outward, v backward from the shoulder)
  const WS = 4.4, UW = 1.7;
  const vLE = u => 0.30 * Math.pow(u / WS, 1.5) * WS * 0.55;
  const WPOLY = (() => {
    const T0 = [WS, vLE(WS)], T1 = [WS * 0.80, vLE(WS * 0.8) + 1.7], T2 = [WS * 0.55, vLE(WS * 0.55) + 2.4], T3 = [WS * 0.30, 2.7];
    const scallop = (a, b) => [(a[0] + b[0]) / 2 - 0.30, (a[1] + b[1]) / 2 - 0.55];
    return { tips: [T0, T1, T2, T3], poly: [[0, 0], [UW, vLE(UW)], T0, scallop(T0, T1), T1, scallop(T1, T2), T2, scallop(T2, T3), T3, [0.25, 2.3]] };
  })();
  function inPoly(p, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if (((yi > p[1]) !== (yj > p[1])) && (p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi)) c = !c;
    }
    return c;
  }

  function build() {
    const r = rng(2024), slots = [];
    const add = (kind, a, b, c, size, cls, key, extra) => slots.push({ kind, a, b, c, size, cls, key, ...extra });
    // body rings (+ belly/back colouring)
    for (let i = 0; i < NR; i++) {
      const s = i * DS, rr = radius(s), n = Math.max(4, Math.round(TAU * rr / 0.105));
      for (let k = 0; k < n; k++) {
        const th = k / n * TAU + (i % 2) * 0.5 * TAU / n;
        add(0, i, th, rr, 0.054 * (0.85 + 0.25 * Math.min(rr / 0.5, 1)), (i % 6 === 0) ? 5 + s / L : 1, s / L);
      }
      if (i % 3 === 0 && s > 0.5 && s < L - 1.2) for (let j = 1; j <= 3; j++) add(1, i, j, rr, 0.05 - 0.009 * j, 5 + s / L, s / L);
    }
    // head (local: x forward, y up, z right)
    const sp = 0.105, HS = 1.5;
    const addH = (kind, a, b, c, size, cls, key) => add(kind, a * HS, b * HS, c * HS, size * HS, cls, key);
    boxShell(0.0, 0.66, -0.2, 0.26, -0.30, 0.30, sp).forEach(p => addH(2, p[0], p[1], p[2], 0.054, 1, 0));
    boxShell(0.66, 1.36, -0.10, 0.20, -0.19, 0.19, sp).forEach(p => addH(2, p[0], p[1], p[2], 0.05, 1, 0.01));
    boxShell(0.0, 1.05, -0.20, -0.05, -0.17, 0.17, sp).forEach(p => addH(3, p[0] + 0.25, p[1] - 0.14, p[2], 0.048, 1, 0.01));    // lower jaw (hinged)
    for (const sg of [-1, 1]) {
      for (let i = 0; i <= 9; i++) addH(2, 0.30 - 0.085 * i, 0.26 + 0.075 * i + 0.012 * i * i, sg * (0.22 + 0.045 * i), 0.042 - 0.0025 * i, 5, 0.005);   // horns
      addH(2, 0.52, 0.15, sg * 0.31, 0.040, 8, 0.002);                                                                                                   // eyes
      addH(2, 1.37, 0.12, sg * 0.08, 0.026, 6, 0.01);                                                                                                    // nostrils
      for (let x = 0.55; x < 1.3; x += 0.15) { addH(2, x + 0.05, -0.10, sg * 0.20, 0.022, 0, 0.012); addH(3, x + 0.3, -0.13 + 0.07, sg * 0.18, 0.022, 0, 0.012); }  // teeth
      for (let i = 0; i < 4; i++) addH(2, -0.04 - 0.06 * i, 0.04 + 0.12 * i, sg * (0.34 + 0.05 * i), 0.034, 1, 0.01);                                      // cheek frills
    }
    // wings
    for (const sg of [-1, 1]) {
      // bones: leading edge + three fingers from the wrist
      for (let u = 0.05; u <= WS; u += 0.095) add(4, sg, u, vLE(u), 0.056 * (1 - 0.35 * u / WS), 1, 0.17);
      const wr = [UW, vLE(UW)];
      for (let f = 1; f <= 3; f++) {
        const tip = WPOLY.tips[f]; const len = Math.hypot(tip[0] - wr[0], tip[1] - wr[1]);
        for (let d = 0.1; d <= len; d += 0.1) add(4, sg, wr[0] + (tip[0] - wr[0]) * d / len, wr[1] + (tip[1] - wr[1]) * d / len, 0.046 * (1 - 0.5 * d / len), 1, 0.2);
      }
      // membrane
      for (let u = 0.08; u < WS; u += 0.125) for (let v = 0.0; v < 3.0; v += 0.125) {
        if (!inPoly([u, v], WPOLY.poly)) continue;
        add(4, sg, u, v, 0.050, 5 + u / WS, 0.22);
      }
    }
    // spade at the tail tip
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (Math.abs(i) + Math.abs(j) <= 2) add(5, i, j, 0, 0.048, 6, 1.0);
    const nStruct = slots.length;
    // smoke trail
    for (let i = 0; i < 5200; i++) add(6, r(), r() * 2 - 1, r() * 2 - 1, 0.03, 7 + r(), 0.95, { hz: r() * 2 - 1 });
    // ambient dust fills every remaining cube
    while (slots.length < NC) {
      const rad = 3 + 9 * Math.sqrt(r()), an = r() * TAU;
      const vis = slots.length - nStruct - 5200 < 4500;
      if (vis) add(7, rad * Math.cos(an), 0.2 + 8.5 * Math.pow(r(), 1.3), rad * Math.sin(an) - 1.5, 0.009 + 0.012 * r(), (rad * Math.cos(an) > 0 ? 8 : 7) - 0.0, r(), { ph: r() * TAU });
      else { const g = 2.2 + 5.5 * Math.sqrt(r()); add(7, g * Math.cos(an), 0.04, g * Math.sin(an) - 1.5, 0, 0.3, r(), { ph: r() * TAU, ground: 1 }); }
    }
    return { slots, nStruct };
  }

  // ── evaluation: fills pos[4n] (xyz,size) and quat[4n] for every slot ──
  const _f = Array.from({ length: NR }, () => ({})), _tr = Array.from({ length: NTR }, () => ({}));
  const _head = {}, _sh = {};
  function evalAll(D, t, pos, quat, map) {
    for (let i = 0; i < NR; i++) spine(i * DS, t, _f[i]);
    for (let j = 0; j < NTR; j++) spine(L + TRAIL_L * j / (NTR - 1), t, _tr[j]);
    spine(0, t, _head); spine(SHOULDER, t, _sh);
    const slots = D.slots, open = 0.20 + 0.16 * Math.sin(2.7 * t);
    const hq = _head.q, hT = _head.T, hN = _head.N, hB = _head.B, hp = _head.p;
    const flapA = (u, sg) => 0.15 + 0.62 * Math.sin(5.2 * t - 0.75 * u / WS * 2.0);
    for (let k = 0; k < NC; k++) {
      const s = slots[k]; let x = 0, y = 0, z = 0, sz = s.size, q = QI4;
      switch (s.kind) {
        case 0: {
          const F = _f[s.a], c = Math.cos(s.b) * s.c, d = Math.sin(s.b) * s.c;
          x = F.p[0] + F.N[0] * c + F.B[0] * d; y = F.p[1] + F.N[1] * c + F.B[1] * d; z = F.p[2] + F.N[2] * c + F.B[2] * d; q = F.q; break;
        }
        case 1: {
          const F = _f[s.a], h = s.c + 0.10 * s.b;
          x = F.p[0] + F.N[0] * h; y = F.p[1] + F.N[1] * h; z = F.p[2] + F.N[2] * h; q = F.q; break;
        }
        case 2: case 3: {
          let lx = s.a, ly = s.b, lz = s.c, qq = hq;
          if (s.kind === 3) { const hx = 0.375, hy = -0.18, dx = lx - hx, dy = ly - hy, ca = Math.cos(-open), sa = Math.sin(-open); lx = hx + dx * ca - dy * sa; ly = hy + dx * sa + dy * ca; qq = Forms.qMul(hq, Forms.qAxis([0, 0, 1], -open)); }
          x = hp[0] + hT[0] * lx + hN[0] * ly + hB[0] * lz; y = hp[1] + hT[1] * lx + hN[1] * ly + hB[1] * lz; z = hp[2] + hT[2] * lx + hN[2] * ly + hB[2] * lz; q = qq; break;
        }
        case 4: {
          const sg = s.a, u = s.b, v = s.c, al = flapA(u, sg);
          const ca = Math.cos(al), sa = Math.sin(al), bil = 0.10 * Math.sin(5.2 * t - 1.4 + v) * (v / 3);
          const ob = sg * u * ca, up = u * sa + bil + 0.22;
          x = _sh.p[0] + _sh.B[0] * ob + _sh.N[0] * up - _sh.T[0] * v; y = _sh.p[1] + _sh.B[1] * ob + _sh.N[1] * up - _sh.T[1] * v; z = _sh.p[2] + _sh.B[2] * ob + _sh.N[2] * up - _sh.T[2] * v;
          q = Forms.qMul(_sh.q, Forms.qAxis([1, 0, 0], sg * al)); break;
        }
        case 5: {
          const F = _f[NR - 1];
          x = F.p[0] + F.B[0] * s.a * 0.085 + F.T[0] * s.b * 0.085 + F.T[0] * 0.2; y = F.p[1] + F.B[1] * s.a * 0.085 + F.T[1] * s.b * 0.085 + F.T[1] * 0.2; z = F.p[2] + F.B[2] * s.a * 0.085 + F.T[2] * s.b * 0.085 + F.T[2] * 0.2; q = F.q; break;
        }
        case 6: {
          const j = Math.min(NTR - 1, Math.floor(s.a * (NTR - 1))), F = _tr[j], g = 0.12 + 0.75 * Math.pow(s.a, 1.1);
          x = F.p[0] + (F.N[0] * s.b + F.B[0] * s.c + F.T[0] * s.hz) * g; y = F.p[1] + (F.N[1] * s.b + F.B[1] * s.c + F.T[1] * s.hz) * g; z = F.p[2] + (F.N[2] * s.b + F.B[2] * s.c + F.T[2] * s.hz) * g;
          sz = 0.034 * (1 - 0.75 * s.a); q = F.q; break;
        }
        default: {
          const a = 0.045 * t, ca = Math.cos(a), sa = Math.sin(a), bx = s.a, bz = s.c + 1.5;
          x = bx * ca + bz * sa; z = -bx * sa + bz * ca - 1.5; y = s.ground ? s.b : s.b + 0.18 * Math.sin(0.8 * t + s.ph);
        }
      }
      const o = (map ? map[k] : k) * 4; pos[o] = x; pos[o + 1] = y; pos[o + 2] = z; pos[o + 3] = sz;
      quat[o] = q[0]; quat[o + 1] = q[1]; quat[o + 2] = q[2]; quat[o + 3] = q[3];
    }
  }
  const QI4 = [0, 0, 0, 1];
  return { NC, L, V_SP, H, spine, build, evalAll, radius };
})();
