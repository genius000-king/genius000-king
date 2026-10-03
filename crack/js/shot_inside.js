'use strict';
// ══════════════════════════════════════════════════════════════
//  ٢ · الداخل — the white studio. The floor draws itself (fine contour lines),
//  then a cube draws itself in 3-D line-art, then it becomes matter.
//  line → plane → volume: the thing you liked, now with a purpose: this is the seed.
// ══════════════════════════════════════════════════════════════
(() => {
  const B = TL.BEAT;
  const T0 = 7.5, T_WIRE = T0 + 2 * B, EDGE_DT = B / 4, T_SOLID = 11.25, T_DIP = 14.88;
  const C = Film.heroC, EDGE = Film.heroEdge;

  // edge order: bottom ring, verticals, top ring (how a draughtsman builds a cube)
  const CORNER = i => [(i & 1) ? 1 : -1, (i & 2) ? 1 : -1, (i & 4) ? 1 : -1];     // x,y(bit1),z(bit2)
  const EDGES = [
    [0, 1], [1, 5], [5, 4], [4, 0],           // y = -1 ring  (bit1=0)
    [0, 2], [1, 3], [5, 7], [4, 6],           // verticals
    [2, 3], [3, 7], [7, 6], [6, 2],           // y = +1 ring
  ];
  Film.wire = { T_WIRE, EDGE_DT, EDGES };

  const KEYS = [
    { t: 7.5, p: [0, 1.4, 9.0], look: [0, 1.5, -1], fov: 0.84 },
    { t: 8.4, p: [0.0, 1.7, 7.6], look: [0, 1.9, 0], fov: 0.80 },
    { t: 9.8, p: [2.1, 2.1, 6.4], look: [0, 1.9, 0], fov: 0.74 },
    { t: 11.25, p: [0.0, 2.2, 6.2], look: [0, 1.9, 0], fov: 0.72 },
    { t: 13.1, p: [-3.6, 2.6, 5.2], look: [0, 1.9, 0], fov: 0.70 },
    { t: 14.85, p: [0.0, 2.0, 3.9], look: [0, 1.9, 0], fov: 0.66 },
    { t: 15.0, p: [0.0, 2.0, 3.85], look: [0, 1.9, 0], fov: 0.66 },
  ];
  Film.insideCam = t => camFromKeys(KEYS, t);
  // the cube's slow turn (also read by the split shot so rotation never jumps)
  Film.heroYaw = t => t < T_SOLID ? 0.42 * (t - T0) * 0.6 : 0.42 * (T_SOLID - T0) * 0.6 + 0.5 * (t - T_SOLID) + 0.05 * Math.pow(Math.max(t - 13.1, 0), 2.2);

  Film.heroSet = () => Film._hero || (Film._hero = new World.CubeSet(Film._heroData = Models.heroCube(32)));

  function corner(i, yaw) {
    const [x, y, z] = CORNER(i), cy = Math.cos(yaw), sy = Math.sin(yaw);
    const h = EDGE / 2;
    return [C[0] + (x * cy + z * sy) * h, C[1] + y * h, C[2] + (-x * sy + z * cy) * h];
  }
  // ink stroke on the normal layer: graphite line with a soft grounding shadow
  function inkLine(o, path, w, alpha) {
    o.save(); o.lineCap = 'round'; o.lineJoin = 'round';
    path(); o.strokeStyle = `rgba(0,0,0,${0.10 * alpha})`; o.lineWidth = w * 4.2; o.stroke();
    path(); o.strokeStyle = `rgba(14,14,16,${alpha})`; o.lineWidth = w; o.stroke();
    o.restore();
  }

  Shots.inside = function (c, t) {
    const { o, fx } = c;
    const cam = Film.insideCam(t);
    const yaw = Film.heroYaw(t);
    const solid = t >= T_SOLID;
    const sol = sstep(T_SOLID - 0.02, T_SOLID + 0.25, t);
    // floor beats after the cube becomes matter
    const bt = (t - T_SOLID) / B, bi = Math.floor(bt), bph = bt - bi;
    const ringOn = solid ? 1 : 0;
    World.begin(c, cam, {
      mood: 0, tilt: 0.6, seam: 0.5, floorY: 0, fogD: 0.03, lines: 1.0,
      reveal: 40 * sstep(7.9, 11.0, t), ringC: [C[0], 0, C[2]],
      pulseR: ringOn ? bph * 11 : 0, pulseA: ringOn ? 0.5 * Math.exp(-bph * 3.5) : 0,
      shC: [0, 0, 9], shK: 0.64,
    });
    const set = Film.heroSet();
    const charge = sstep(13.1, 14.85, t);
    const shake = charge * 0.012 * Math.sin(t * 90);
    const Q = new Array(48).fill(0);
    const put = (i, ...v) => v.forEach((x, k) => { Q[i + k] = x; });
    put(0, 32, 0, EDGE, 0); put(12, 1, 0, 0, 0);
    put(16, C[0] + shake, C[1] + 0.02 * Math.sin(t * 1.7), C[2], 1.0 + 0.05 * (solid ? Math.exp(-(t - T_SOLID) * 7) * Math.cos((t - T_SOLID) * 30) : 0));
    put(20, 0, 1, 0, yaw); put(24, 0.5 * charge + 0.7 * pulse(t, T_SOLID, 0.18), 0.12 * charge, 0, 0);
    if (solid) {
      World.computeState(c, set, 'subdiv', { Q });
      World.shadow(c, set);
    }
    World.drawFloor(c, 0);
    if (solid) World.drawCubes(c, set, { flat: 1 - sstep(T_SOLID + 0.12, T_SOLID + 0.75, t) });

    // ── the wire cube: twelve strokes, one per sixteenth note ──
    const wireA = 1 - sstep(T_SOLID + 0.10, T_SOLID + 0.45, t);
    if (wireA > 0.01 && t > T_WIRE - 0.2) {
      const pc = EDGES.map(([i, j]) => [corner(i, yaw), corner(j, yaw)]);
      const done = [];
      EDGES.forEach((e, k) => {
        const p = E.outCubic(lin(T_WIRE + k * EDGE_DT, T_WIRE + k * EDGE_DT + 0.24, t));
        done.push(p);
        if (p <= 0) return;
        const A = cam.project(pc[k][0]), Bp = cam.project(pc[k][1]);
        const tx = A[0] + (Bp[0] - A[0]) * p, ty = A[1] + (Bp[1] - A[1]) * p;
        const path = () => { o.beginPath(); o.moveTo(A[0], A[1]); o.lineTo(tx, ty); };
        inkLine(o, path, 2.6, wireA);
        // little ink squares fly off where the stroke lands
        const d = t - (T_WIRE + k * EDGE_DT + 0.24);
        if (d > 0 && d < 0.45) for (let q = 0; q < 6; q++) {
          const an = hash1(k * 11 + q) * TAU, sp = 24 + 70 * hash1(k * 5 + q * 3), s = 3 + 3 * hash1(k * 3 + q);
          const px = Bp[0] + Math.cos(an) * sp * E.outCubic(d / 0.45), py = Bp[1] + Math.sin(an) * sp * E.outCubic(d / 0.45);
          o.save(); o.translate(px, py); o.rotate(an + d * 6); o.fillStyle = `rgba(14,14,16,${(1 - d / 0.45) * 0.9 * wireA})`; o.fillRect(-s / 2, -s / 2, s, s); o.restore();
        }
      });
      // corner nodes: a small white disc with an ink ring once two strokes have met there
      const cornerEdges = i => EDGES.map(([x, y], k) => (x === i || y === i) ? k : -1).filter(k => k >= 0);
      for (let i = 0; i < 8; i++) {
        const ks = cornerEdges(i), ready = Math.min(...ks.map(k => done[k]));
        if (ready < 0.98) continue;
        const tNode = Math.max(...ks.map(k => T_WIRE + k * EDGE_DT + 0.24));
        const pp = pulse(t, tNode, 0.35), P = cam.project(corner(i, yaw));
        o.save(); o.globalAlpha = wireA;
        o.beginPath(); o.arc(P[0], P[1], 5 + 9 * pp, 0, TAU); o.fillStyle = '#fafafa'; o.fill(); o.lineWidth = 2.2; o.strokeStyle = '#0e0e10'; o.stroke();
        o.restore();
      }
    }

    // ── post ──
    fx.bloom = 0.12; fx.thresh = 1.2; fx.vig = 0.36; fx.streak = 0;
    fx.zoomBlur += 0.05 * (1 - sstep(7.5, 8.2, t)) + 0.04 * pulse(t, T_SOLID, 0.15);
    fx.ca += 0.003 + 0.008 * pulse(t, T_SOLID, 0.2);
    const dip = sstep(T_DIP, T_DIP + 0.06, t); fx.fade = Math.max(fx.fade, 0.0 * dip);
    fx.exposure = 1;
  };
})();
