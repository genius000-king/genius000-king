'use strict';
// ══════════════════════════════════════════════════════════════
//  Forms — baked formations. Pure data: every shape the 32 768 cubes become.
//  A formation = K animation frames of (position,size,rotation) per cube + aux (cls, delay, duration, group).
//  Slots are generated shape by shape (birds, stairs, tree, …); cubes are matched to slots by proximity
//  so whole chunks of the mother cube peel away together and flow into their new bodies.
// ══════════════════════════════════════════════════════════════
const Forms = (() => {
  const NC = 32768, SWD = 256, SHT = 128, L4 = SWD * SHT * 4;

  // ── quaternions [x,y,z,w] ──
  const qAxis = (ax, a) => { const l = Math.hypot(ax[0], ax[1], ax[2]) || 1, s = Math.sin(a / 2) / l; return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(a / 2)]; };
  const qMul = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const qYaw = a => qAxis([0, 1, 0], a), qPitch = a => qAxis([1, 0, 0], a), qRoll = a => qAxis([0, 0, 1], a);
  const QI = [0, 0, 0, 1];
  // rotate vector by quaternion
  function qRot(q, v) {
    const [x, y, z, w] = q, [vx, vy, vz] = v;
    const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
    return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
  }

  // ── slot list: one entry per cube-to-be ──
  class Slots {
    constructor(K = 1) { this.K = K; this.a = []; }
    // frames: one [x,y,z,s,qx,qy,qz,qw] or K of them
    add(grp, cls, key, frames) {
      this.a.push({ grp, cls, key, f: Array.isArray(frames[0]) ? frames : Array(this.K).fill(frames) });
    }
  }
  const cube = (p, s, q = QI) => [p[0], p[1], p[2], s, q[0], q[1], q[2], q[3]];

  // ── formation builder ──
  class Builder {
    constructor(K = 1) {
      this.K = K; this.pos = new Float32Array(L4 * K); this.quat = new Float32Array(L4 * K); this.aux = new Float32Array(L4);
      for (let i = 0; i < SWD * SHT; i++) {
        for (let f = 0; f < K; f++) this.quat[f * L4 + i * 4 + 3] = 1;
        this.aux[i * 4 + 1] = 1e3; this.aux[i * 4 + 2] = 1;
      }
    }
    put(i, fr, cls, grp, delay, dur) {
      for (let f = 0; f < this.K; f++) {
        const v = fr[f], o = f * L4 + i * 4;
        this.pos[o] = v[0]; this.pos[o + 1] = v[1]; this.pos[o + 2] = v[2]; this.pos[o + 3] = v[3];
        this.quat[o] = v[4]; this.quat[o + 1] = v[5]; this.quat[o + 2] = v[6]; this.quat[o + 3] = v[7];
      }
      const a = i * 4; this.aux[a] = cls; this.aux[a + 1] = delay; this.aux[a + 2] = dur; this.aux[a + 3] = grp;
    }
    build() { return new World.Form(NC, this.K, this.pos, this.quat, this.aux); }
  }

  // ── the mother cube's rest positions (to decide which chunk becomes what) ──
  let _cells = null;
  function heroCells(data, edge, C) {
    if (_cells) return _cells;
    const n = data.length / 12, px = new Float32Array(n), py = new Float32Array(n), pz = new Float32Array(n);
    for (let s = 0; s < n; s++) {
      const o = s * 12, N = 32;
      px[s] = C[0] + ((data[o] + 0.5) / N - 0.5) * edge; py[s] = C[1] + ((data[o + 1] + 0.5) / N - 0.5) * edge; pz[s] = C[2] + ((data[o + 2] + 0.5) / N - 0.5) * edge;
    }
    return (_cells = { n, px, py, pz });
  }
  // the M untaken cubes nearest to `seed` (a cap of the mother cube facing the idea's destination)
  function takeNearest(cells, taken, seed, M) {
    const cand = [];
    for (let s = 0; s < cells.n; s++) {
      if (taken[s]) continue;
      const dx = cells.px[s] - seed[0], dy = cells.py[s] - seed[1], dz = cells.pz[s] - seed[2];
      cand.push([dx * dx + dy * dy + dz * dz, s]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    const out = cand.slice(0, M).map(c => c[1]);
    out.forEach(s => { taken[s] = 1; });
    return out;
  }

  // ── voxel helpers ──
  function sphereShell(R, u, thick = 1.0, sy = 1) {          // R in cells
    const out = [], r = Math.ceil(R + 1);
    for (let x = -r; x <= r; x++) for (let y = -Math.ceil(r * sy); y <= Math.ceil(r * sy); y++) for (let z = -r; z <= r; z++) {
      const d = Math.hypot(x, y / sy, z);
      if (d <= R && d > R - thick) out.push([x * u, y * u, z * u]);
    }
    return out;
  }

  // ═══ the ideas ══════════════════════════════════════════════
  // group ids: 0 birds · 1 stairs · 2 tree · 3 balloon(white) · 4 balloon(graphite) · 5,6,7 atom rings · 8 word
  const K = 8;

  function birds(S) {
    const NB = 13, r = rng(77), sc = 1.55;
    for (let b = 0; b < NB; b++) {
      const row = Math.ceil(b / 2), sg0 = b === 0 ? 0 : (b % 2 ? 1 : -1);
      const P = [-0.95 * row + (r() - 0.5) * 0.12, 0.10 * Math.sin(row * 1.7) + (r() - 0.5) * 0.15, sg0 * (1.15 * row) + (r() - 0.5) * 0.12];
      const qb = qRoll(sg0 * 0.12 + (r() - 0.5) * 0.15), ph = r() * TAU, key = b / NB;
      const part = (loc, s, wing, lag, f) => {
        const th = 0.80 * Math.sin(TAU * f / K + ph - lag);
        let l = loc.slice(), q = qb;
        if (wing) { const sg = wing, d = Math.abs(loc[2]); l = [loc[0], loc[1] + d * Math.sin(th) * 1.05, sg * d * Math.cos(th)]; q = qMul(qb, qAxis([1, 0, 0], sg * th * 0.9)); }
        else l[1] += 0.02 * Math.sin(TAU * f / K + ph);
        const v = qRot(qb, [l[0] * sc, l[1] * sc, l[2] * sc]);
        return cube([P[0] + v[0], P[1] + v[1], P[2] + v[2]], s * sc, q);
      };
      const A = (loc, s, cls, wing = 0, lag = 0) => S.add(0, cls, key, Array.from({ length: K }, (_, f) => part(loc, s, wing, lag, f)));
      [-0.2, -0.1, 0, 0.1, 0.2].forEach((x, i) => A([x, 0, 0], 0.054 + 0.014 * Math.sin(i / 4 * Math.PI), 1));
      A([0.31, 0.03, 0], 0.05, 1); A([0.4, 0.02, 0], 0.028, 1); A([0.33, 0.07, 0.035], 0.012, 4); A([0.33, 0.07, -0.035], 0.012, 4);
      for (let j = 1; j <= 3; j++) for (const sg of [-1, 0, 1]) A([-0.3 - 0.09 * j, 0, sg * (0.04 * j)], 0.036, 1);
      for (const sg of [-1, 1]) {
        for (let j = 1; j <= 10; j++) A([-0.015 * j, 0.0, sg * 0.105 * j], 0.054 * (1 - 0.05 * j), 1, sg, j * 0.20);
        for (let j = 1; j <= 8; j++) A([-0.11 - 0.012 * j, 0.0, sg * 0.105 * j], 0.046 * (1 - 0.055 * j), 1, sg, j * 0.20 + 0.15);
        for (let j = 2; j <= 9; j += 1) A([-0.22 - 0.01 * j, 0.0, sg * 0.105 * j], 0.036 * (1 - 0.05 * j), 1, sg, j * 0.20 + 0.3);
      }
    }
  }

  function stairs(S) {
    const NS = 62, u = 0.098;
    for (let k = 0; k < NS; k++) {
      const a = k * 0.30, y = k * 0.092, key = k / NS, q = qYaw(-a);
      for (let i = 0; i < 7; i++) for (let j = 0; j < 3; j++) {
        const l = [0.36 + i * u, 0, (j - 1) * u], v = qRot(q, l);
        S.add(1, i === 6 ? 1 : 0, key, cube([v[0], y, v[2]], u * 0.47, q));
      }
      for (const [dx, dz] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) S.add(1, 1, key * 0.95, cube([dx * 0.098, y, dz * 0.098], 0.046, QI));   // the pole
      if (k % 2 === 0) { const l = [0.36 + 6 * u + 0.09, 0, 0], v = qRot(q, l); for (let h = 1; h <= 5; h++) S.add(1, 1, key, cube([v[0], y + h * 0.085, v[2]], 0.03, q)); }  // rail posts
    }
  }

  function tree(S) {
    const r = rng(404), leaves = [];
    function branch(p, d, len, th, depth, key) {
      const n = Math.max(3, Math.round(len / (th * 1.5))), q = quatFromDir(d);
      for (let i = 0; i < n; i++) {
        const f = i / n, s = th * (1 - 0.30 * f), c = [p[0] + d[0] * len * f, p[1] + d[1] * len * f, p[2] + d[2] * len * f];
        if (depth >= 3) {                                    // thick trunk / boughs: a 2×2 bundle
          for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) S.add(2, 1, key + f * 0.10, cube([c[0] + ox * s * 0.5, c[1], c[2] + oz * s * 0.5], s * 0.55, q));
        } else S.add(2, 1, key + f * 0.10, cube(c, s, q));
      }
      const e = [p[0] + d[0] * len, p[1] + d[1] * len, p[2] + d[2] * len];
      if (depth === 0) { leaves.push([e, key + 0.18]); return; }
      const nb = depth === 4 ? 3 : (r() < 0.45 ? 2 : 3);
      for (let b = 0; b < nb; b++) {
        const a = (b / nb) * TAU + r() * 1.2, spread = 0.55 + r() * 0.4;
        let nd = [d[0] * 0.8 + Math.cos(a) * spread, d[1] * 0.9 + 0.30, d[2] * 0.8 + Math.sin(a) * spread]; nd = V3.norm(nd);
        branch(e, nd, len * (0.66 + r() * 0.1), th * 0.70, depth - 1, key + 0.10 + 0.08 * (4 - depth));
      }
    }
    branch([0, 0, 0], [0, 1, 0], 1.55, 0.13, 4, 0);
    for (const [e, key] of leaves) for (let i = 0; i < 26; i++) {
      const v = V3.norm([r() - 0.5, r() - 0.5, r() - 0.5]), rad = 0.1 + r() * 0.50;
      S.add(2, 0.35 + 0.35 * r(), key + r() * 0.1, cube([e[0] + v[0] * rad, e[1] + v[1] * rad * 0.8 + 0.1, e[2] + v[2] * rad], 0.028 + r() * 0.026, qAxis(v, r() * 3)));
    }
  }
  function quatFromDir(d) {         // rotate +Y onto d
    const y = [0, 1, 0], c = V3.cross(y, d), l = V3.len(c), dt = V3.dot(y, d);
    if (l < 1e-5) return dt > 0 ? QI : qAxis([1, 0, 0], Math.PI);
    return qAxis(c, Math.atan2(l, dt));
  }

  function balloon(S, grp, cls, key0) {
    const u = 0.088, shell = sphereShell(8.2, u, 1.15, 1.22);
    shell.forEach((p) => {
      const taper = p[1] < 0 ? 1 - 0.35 * Math.min(-p[1] / 0.9, 1) ** 2 : 1;              // pinched at the knot
      S.add(grp, cls, key0 + (p[1] / 1.7 + 0.5) * 0.3, cube([p[0] * taper, p[1], p[2] * taper], u * 0.46, QI));
    });
    S.add(grp, 1, key0, cube([0, -0.98, 0], 0.06, qAxis([0, 1, 0], 0.78)));
    for (let i = 1; i <= 40; i++) S.add(grp, 1, key0 + 0.3 + i * 0.006, cube([0.09 * Math.sin(i * 0.5), -1.02 - i * 0.075, 0.09 * Math.cos(i * 0.4)], 0.02, QI));
  }

  function atom(S) {
    const u = 0.07;
    sphereShell(5.8, u, 1.6).forEach(p => S.add(5, 1, 0.1, cube(p, u * 0.46)));
    const rings = [[5, 1.75, 118], [6, 1.95, 130], [7, 2.15, 140]];
    for (const [g, R, n] of rings) {
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU, p = [R * Math.cos(a), 0, R * Math.sin(a)];
        const isE = (i % Math.floor(n / 2)) === 0;
        S.add(g, isE ? 4 : 0, 0.2 + i / n * 0.2, cube(p, isE ? 0.10 : 0.032, qYaw(-a)));
      }
    }
  }

  // Arabic word from a 2-D canvas, extruded one cube thick
  function word(S, txt, widthUnits) {
    const cv = document.createElement('canvas'); cv.width = 900; cv.height = 360;
    const x = cv.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 900, 360);
    x.fillStyle = '#fff'; x.font = '900 250px NotoKufi'; x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 450, 190);
    const img = x.getImageData(0, 0, 900, 360).data, cell = 5, cols = 900 / cell, rows = 360 / cell;
    const pts = [];
    let minx = 1e9, maxx = -1e9;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      let cov = 0; for (let dy = 0; dy < cell; dy++) for (let dx = 0; dx < cell; dx++) cov += img[((j * cell + dy) * 900 + i * cell + dx) * 4] > 128 ? 1 : 0;
      if (cov >= 7) { pts.push([i, j]); minx = Math.min(minx, i); maxx = Math.max(maxx, i); }
    }
    const cx = (minx + maxx) / 2, sp = widthUnits / (maxx - minx + 1);
    pts.forEach(([i, j]) => {
      S.add(8, 1, (i - minx) / Math.max(maxx - minx, 1), cube([(i - cx) * sp, -(j - rows / 2) * sp, 0], sp * 0.46, QI));
    });
  }

  // 2-D points of a rendered word (centred, y up), spacing chosen so the word is `widthUnits` wide
  function textPoints(txt, widthUnits, px = 220, cell = 5) {
    const cv = document.createElement('canvas'); cv.width = 1400; cv.height = 360;
    const x = cv.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 1400, 360);
    x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.lineWidth = 12; x.lineJoin = 'round'; x.font = `900 ${px}px NotoKufi`; x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.strokeText(txt, 700, 190); x.fillText(txt, 700, 190);
    const img = x.getImageData(0, 0, 1400, 360).data, cols = 1400 / cell, rows = 360 / cell, pts = [];
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      let cov = 0; for (let dy = 0; dy < cell; dy++) for (let dx = 0; dx < cell; dx++) cov += img[((j * cell + dy) * 1400 + i * cell + dx) * 4] > 128 ? 1 : 0;
      if (cov >= cell * cell * 0.3) { pts.push([i, j]); minx = Math.min(minx, i); maxx = Math.max(maxx, i); miny = Math.min(miny, j); maxy = Math.max(maxy, j); }
    }
    const sp = widthUnits / (maxx - minx + 1), cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
    return { pts: pts.map(([i, j]) => [(i - cx) * sp, -(j - cy) * sp]), sp };
  }

  // ═══ the idea formation (used by the split shot) ═══
  // each idea: seed direction on the mother cube, count, start time (s, after the morph's t0), spread, duration
  function buildIdeas(heroData, edge, C) {
    const cells = heroCells(heroData, edge, C), taken = new Uint8Array(cells.n), bd = new Builder(K);
    const ideas = [
      { name: 'stairs', fn: S => stairs(S), seed: [-1, 0, 0.2], T: 0.00, spread: 1.1, dur: 1.5 },
      { name: 'tree', fn: S => tree(S), seed: [1, 0, 0.4], T: 0.47, spread: 1.3, dur: 1.5 },
      { name: 'balloonW', fn: S => balloon(S, 3, 2, 0), seed: [0.4, 0.8, -1], T: 0.94, spread: 0.8, dur: 1.5 },
      { name: 'balloonB', fn: S => balloon(S, 4, 1, 0), seed: [-0.4, 0.8, -1], T: 1.17, spread: 0.8, dur: 1.5 },
      { name: 'atom', fn: S => atom(S), seed: [-0.4, 1, -0.3], T: 1.55, spread: 0.7, dur: 1.4 },
      { name: 'birds', fn: S => birds(S), seed: [0, 1, 0.3], T: 1.95, spread: 0.9, dur: 1.5 },
    ];
    const r = rng(1234), info = {};
    for (const id of ideas) {
      const S = new Slots(K); id.fn(S);
      const M = Math.min(S.a.length, cells.n - taken.reduce((a, b) => a + b, 0));
      const seedP = [C[0] + id.seed[0] * edge * 0.7, C[1] + id.seed[1] * edge * 0.7, C[2] + id.seed[2] * edge * 0.7];
      const cubes = takeNearest(cells, taken, seedP, M);
      const kmax = Math.max(...S.a.map(s => s.key), 1e-6);
      const slots = S.a.slice(0, M).sort((a, b) => a.key - b.key);
      slots.forEach((sl, k) => {
        const s = cubes[k], jitter = r() * 0.28;
        bd.put(s, sl.f, sl.cls, sl.grp, id.T + (sl.key / kmax) * id.spread + jitter, id.dur * (0.85 + 0.3 * r()));
      });
      info[id.name] = { count: M, T: id.T };
    }
    const unused = [];
    for (let s = 0; s < cells.n; s++) if (!taken[s]) unused.push(s);
    return { form: bd.build(), info, ideas, unused };
  }

  return { NC, K, textPoints, Slots, Builder, cube, qAxis, qMul, qYaw, qPitch, qRoll, qRot, QI, buildIdeas, heroCells, takeNearest, sphereShell };
})();
