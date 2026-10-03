'use strict';
// ══════════════════════════════════════════════════════════════
//  ٨ · العودة — the debris is drawn into a vortex and every cube returns to its own cell:
//  the mother cube, whole again. Then it opens into two words — «من لا شيء» → «كل شيء» —
//  and the world goes white, exactly as it began.
// ══════════════════════════════════════════════════════════════
(() => {
  const T0 = 52.5, T_CUBE = 54.65, T_TXT1 = 55.9, T_TXT2 = 57.55, T_WHITE = 59.25;
  Film.unityT = { T0, T_CUBE, T_TXT1, T_TXT2, T_WHITE };
  const C = Film.heroC, EDGE = Film.heroEdge, N = 32;
  const KEYS = [
    { t: 52.5, p: [1.5, 8.2, 14.5], look: [0, 0.6, -1.5], fov: 0.92 },
    { t: 53.6, p: [3.2, 4.6, 11.0], look: [0, 1.8, 0], fov: 0.86 },
    { t: 54.65, p: [0.8, 2.7, 7.4], look: [0, 1.9, 0], fov: 0.72 },
    { t: 55.9, p: [-0.6, 2.6, 8.2], look: [0, 2.3, 0], fov: 0.74 },
    { t: 57.0, p: [0.0, 2.7, 9.4], look: [0, 2.7, 0], fov: 0.70 },
    { t: 60.0, p: [0.0, 2.7, 8.4], look: [0, 2.7, 0], fov: 0.70 },
  ];
  Film.unityCam = t => camFromKeys(KEYS, t);
  Film.unityYaw = t => Film.splitYaw(T0) * 0 + 0.55 * (t - T0) * (1 - 0.5 * sstep(T_CUBE, T_TXT1, t));

  Film.unity = () => {
    if (Film._unity) return Film._unity;
    const data = Film._heroData || (Film._heroData = Models.heroCube(32));
    const n = data.length / 12;
    const r = rng(8080), q0 = new Float32Array(131072); for (let i = 0; i < 32768; i++) q0[i * 4 + 3] = 1;
    // F1: the cube, each cube in its own cell (only the outer two layers are visible, like the first time)
    const pos1 = new Float32Array(131072), aux1 = new Float32Array(131072);
    for (let s = 0; s < n; s++) {
      const o = s * 12, i = data[o], j = data[o + 1], k = data[o + 2], layer = data[o + 11];
      const p = [((i + 0.5) / N - 0.5) * EDGE, ((j + 0.5) / N - 0.5) * EDGE, ((k + 0.5) / N - 0.5) * EDGE];
      pos1.set([p[0], p[1], p[2], layer <= 1 ? EDGE / N * 0.5 : 0], s * 4);
      aux1.set([0, 0.05 + r() * 1.5, 1.1 + 0.5 * r(), 0], s * 4);
    }
    const form1 = new World.Form(n, 1, pos1, q0, aux1);
    // F2/F3: two words, cut out of the cube's outer cubes (sorted so the cube unrolls left→right into the letters)
    const shell = []; for (let s = 0; s < n; s++) if (data[s * 12 + 11] <= 1) shell.push(s);
    shell.sort((a, b) => data[a * 12] - data[b * 12] || data[a * 12 + 1] - data[b * 12 + 1]);
    const word = (txt, width, y) => {
      const { pts, sp } = Forms.textPoints(txt, width);
      const M = pts.length, step = shell.length / M;
      pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const pos = new Float32Array(131072), aux = new Float32Array(131072), q = new Float32Array(131072);
      for (let s = 0; s < n; s++) { q[s * 4 + 3] = 1; aux[s * 4 + 1] = 1e3; aux[s * 4 + 2] = 1; }
      const used = new Uint8Array(n);
      for (let m = 0; m < M; m++) {
        const cube = shell[Math.min(shell.length - 1, Math.floor(m * step))]; used[cube] = 1;
        pos.set([pts[m][0], pts[m][1] + y, ((m * 7919) % 5) * 0.012, sp * 0.46], cube * 4);
        aux.set([1, (pts[m][0] / width + 0.5) * 0.45 + r() * 0.2, 0.65 + 0.3 * r(), 0], cube * 4);
      }
      // every other cube leaves quietly
      for (let s = 0; s < n; s++) if (!used[s]) { pos.set([(r() - 0.5) * 14, 1 + 5 * r(), (r() - 0.5) * 8, 0], s * 4); aux.set([0.3, 0.2 + 1.2 * r(), 1.0, 0], s * 4); }
      return { pos, aux, q, M };
    };
    const w1 = word('من لا شيء', 10.6, 2.7), w2 = word('كل شيء', 7.6, 2.7);
    const form2 = new World.Form(n, 1, w1.pos, w1.q, w1.aux), form3 = new World.Form(n, 1, w2.pos, w2.q, w2.aux);
    return (Film._unity = { form1, form2, form3, n });
  };
  const groupsFor = (t) => {
    const g0 = new Float32Array(64), g1 = new Float32Array(64); for (let g = 0; g < 16; g++) g1[g * 4] = 1;
    g0.set([C[0], C[1], C[2], Film.unityYaw(t)], 0);
    return { g0, g1 };
  };
  const ident = (() => { const g0 = new Float32Array(64), g1 = new Float32Array(64); for (let g = 0; g < 16; g++) g1[g * 4] = 1; return { g0, g1 }; })();

  Shots.unity = function (c, t) {
    const { fx } = c;
    const cam = Film.unityCam(t), set = Film.heroSet(), U = Film.unity();
    const Q = new Array(48).fill(0);
    const put = (i, ...v) => v.forEach((x, k) => { Q[i + k] = x; });
    const G1 = groupsFor(t);
    if (t < T_CUBE + 2.0) {
      // vortex: debris (live) → the cube, each cube to its own cell
      const F = Film.armyFrame(t); F.form.update(F.pos, F.quat);
      put(32, T0, 0, 5.0, 0.0); put(36, 1.4, 0.3, 3.2, 0.6); put(40, 0, 1.2, -0.5, 0);
      World.computeState(c, set, 'form', { Q, form: { F: F.form, phase: 0 } }, set.scratch[0]);
      World.computeState(c, set, 'swarm', { Q, form: { F: U.form1, phase: 0, g0: G1.g0, g1: G1.g1 }, src: set.scratch[0] });
    } else if (t < T_TXT1) {
      World.computeState(c, set, 'form', { Q, form: { F: U.form1, phase: 0, g0: G1.g0, g1: G1.g1 } });
    } else if (t < T_TXT2) {
      put(32, T_TXT1, 0, 2.5, 0.0); put(36, 0.6, 0.2, 1.0, 0.5); put(40, 0, 2.6, 0, 0);
      World.computeState(c, set, 'form', { Q, form: { F: U.form1, phase: 0, g0: G1.g0, g1: G1.g1 } }, set.scratch[0]);
      World.computeState(c, set, 'swarm', { Q, form: { F: U.form2, phase: 0, g0: ident.g0, g1: ident.g1 }, src: set.scratch[0] });
    } else {
      put(32, T_TXT2, 0, 2.0, 0.0); put(36, 0.4, 0.15, 0.7, 0.4); put(40, 0, 2.6, 0, 0);
      World.computeState(c, set, 'form', { Q, form: { F: U.form2, phase: 0, g0: ident.g0, g1: ident.g1 } }, set.scratch[0]);
      World.computeState(c, set, 'swarm', { Q, form: { F: U.form3, phase: 0, g0: ident.g0, g1: ident.g1 }, src: set.scratch[0] });
    }
    const dC = t - T_CUBE;
    World.begin(c, cam, { ...Film.rivalWorld(t), ringC: [0, 0, 0], shC: [0, 0, 11], shK: 0.6, mirrorK: 0.4,
      pulseR: dC > 0 ? dC * 12 : 0, pulseA: dC > 0 ? 0.55 * Math.exp(-dC * 2.6) : 0, lines: 0.9 });
    World.shadow(c, set);
    World.drawFloor(c, 0);
    World.drawCubes(c, set, {});
    fx.bloom = 0.12; fx.thresh = 1.2; fx.vig = 0.36; fx.streak = 0;
    fx.zoomBlur += 0.05 * pulse(t, T_CUBE, 0.12); fx.ca += 0.012 * pulse(t, T_CUBE, 0.16);
    fx.shake[0] += 0.006 * pulse(t, T_CUBE, 0.12) * Math.sin(t * 90);
    // and the page turns white again
    fx.flashCol = [0.976, 0.974, 0.968]; fx.flash = Math.max(fx.flash, sstep(T_WHITE, 59.75, t));
    // the only words that are not cubes: a signature in graphite on the white page
    const sa = sstep(59.5, 59.8, t);
    if (sa > 0.001) fx.crisp.push(x => { x.save(); x.globalAlpha = sa; x.fillStyle = '#161618'; x.font = F.reem(40, 700); x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('إخراج · Claude', 960, 940); x.restore(); });
  };
})();
