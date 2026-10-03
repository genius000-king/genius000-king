'use strict';
// ══════════════════════════════════════════════════════════════
//  ٣ · الانقسام — the cube divides in order (1 → 8 → 64 → 512 → …) on the beat,
//  and pieces of it leave, one beat after another, and become other bodies:
//  a flock · a staircase · a tree · two balloons · an atom · a word.
// ══════════════════════════════════════════════════════════════
(() => {
  const B = TL.BEAT, T0 = 15.0;
  const T_L = [T0, T0 + 4 * B, T0 + 8 * B, T0 + 12 * B, T0 + 24 * B];          // level splits on bars: 15.0, 16.875, 18.75 … see below
  const LV = [T0, T0 + 2 * B, T0 + 4 * B, T0 + 12 * B];                        // L1, L2, L3 (on the beat), L4
  const T_M = T0 + 6 * B;                                                      // first departure (beat 6) = 17.81
  Film.T_M = T_M;
  const C = Film.heroC, EDGE = Film.heroEdge;

  // the camera keeps circling: close and frontal at the first cut, then out and around the ring of ideas
  Film.splitCam = t => {
    const u = clamp((t - T0) / 7.5), tt = Math.min(t, 24.0);
    const th = 7.0 * E.inOutSine(clamp((tt - T0) / 7.5));
    const r = (3.85 + 6.95 * E.outCubic(clamp(u / 0.37))) - 1.6 * lin(0.37, 1, u);
    const h = mix(2.0, 3.3, E.outCubic(clamp(u / 0.37))) + 1.3 * lin(0.37, 1, u);
    return orbitCam([0, 0, -0.8], r, h, th, mix(1.9, 3.1, E.outQuad(clamp(u / 0.4))), mix(0.66, 0.82, E.outCubic(clamp(u / 0.37))), 0.05 * Math.sin(u * TAU * 1.5));
  };
  // continues the pre-split spin without a kink, then settles into a slow turn
  Film.splitYaw = t => { const tau = Math.max(t - T0, 0), y0 = Film.heroYaw(T0); return y0 + 0.30 * tau + 0.44 * 1.2 * (1 - Math.exp(-tau / 1.2)); };

  // group transforms for the ideas
  Film.ideaGroups = (t, cam) => {
    const g0 = new Float32Array(64), g1 = new Float32Array(64);
    for (let g = 0; g < 16; g++) g1[g * 4] = 1;
    const set = (g, ox, oy, oz, yaw, pitch = 0, roll = 0, sc = 1) => { g0.set([ox, oy, oz, yaw], g * 4); g1.set([sc, pitch, roll, 0], g * 4); };
    const u = t - T_M;
    set(0, -6.2 + 1.1 * Math.max(t - 19.4, 0), 6.1 + 0.25 * Math.sin(1.6 * t), -3.2, 0);
    set(1, -5.4, 0, -1.2, 0.45 * u);
    set(2, 5.6, 0, -0.8, 0.22 * u, 0, 0, 1.3);
    set(3, 1.9 + 0.25 * Math.sin(1.1 * t), 1.1 + 0.42 * Math.max(t - 19.6, 0) + 0.12 * Math.sin(0.9 * t), -4.4, 0.3 * t);
    set(4, -1.3 + 0.25 * Math.sin(1.3 * t + 2), 0.9 + 0.36 * Math.max(t - 19.9, 0) + 0.12 * Math.sin(1.0 * t + 1), -5.0, -0.3 * t);
    set(5, -3.0, 6.0, -2.6, 1.3 * u, 0, 0, 1.25);
    set(6, -3.0, 6.0, -2.6, 1.0 * u, 1.05, 0, 1.25);
    set(7, -3.0, 6.0, -2.6, 0.8 * u, 0, -1.05, 1.25);
    return { g0, g1 };
  };

  // the full state of the 32 768 cubes at time t (also the source A of the dragon morph)
  Film.splitState = (c, t, target) => {
    const set = Film.heroSet(), ideas = Film.ideas(), cam = Film.splitCam(t);
    const Lc = t >= LV[3] ? 4 : t >= LV[2] ? 3 : t >= LV[1] ? 2 : t >= LV[0] ? 1 : 0;
    const lastSplit = Math.max(...LV.filter(x => x <= t), T0);
    const tl = t - lastSplit;
    const yaw = Film.splitYaw(t);
    const G = [0.62, 0.52, 0.46, 0.40, 0.3, 0.3];
    const gOf = l => G[l] * spring(t - LV[l], 20, 0.52);
    const Q = new Array(48).fill(0);
    const put = (i, ...v) => v.forEach((x, k) => { Q[i + k] = x; });
    put(0, 32, Lc, EDGE, Math.exp(-tl * 3.2));
    put(4, gOf(0), Lc >= 2 ? gOf(1) : 0, Lc >= 3 ? gOf(2) : 0, Lc >= 4 ? gOf(3) : 0);
    put(8, 0, 0, 1.5, 0);
    put(12, 2, 0, 0, 0);
    put(16, C[0], C[1], C[2], 1.0);
    put(20, 0, 1, 0, yaw);
    put(24, 0.1 * pulse(t, lastSplit, 0.25), 0.05, 0, 0);
    put(32, T_M, 0, 3.0, 0.1); put(36, 0.7, 0.35, 0.7, 0.35); put(40, C[0], C[1], C[2], 0);
    const gr = Film.ideaGroups(t, cam);
    World.computeState(c, set, 'split', { Q, form: { F: ideas.form, phase: t * K8 * 2.3, g0: gr.g0, g1: gr.g1 } }, target || set);
    return { lastSplit, tl };
  };

  Shots.split = function (c, t) {
    const { fx } = c;
    const cam = Film.splitCam(t);
    const set = Film.heroSet();
    Film.ideas();
    const { tl } = Film.splitState(c, t, set);
    World.begin(c, cam, {
      mood: 0, tilt: 0.6, seam: 0.5, floorY: 0, fogD: 0.026, lines: 0.9, reveal: 80, ringC: [C[0], 0, C[2]],
      pulseR: tl * 15, pulseA: 0.5 * Math.exp(-tl * 3.2), shC: [0, -1.5, 13], shK: 0.6,
    });
    World.shadow(c, set);
    World.drawFloor(c, 0);
    World.drawCubes(c, set, {});

    fx.bloom = 0.12; fx.thresh = 1.2; fx.vig = 0.34; fx.streak = 0;
    for (const lt of LV) {
      fx.zoomBlur += 0.05 * pulse(t, lt, 0.1); fx.ca += 0.012 * pulse(t, lt, 0.14);
      fx.shake[0] += 0.006 * pulse(t, lt, 0.12) * Math.sin(t * 90); fx.shake[1] += 0.005 * pulse(t, lt, 0.12) * Math.cos(t * 77);
    }
  };
  const K8 = 8;
  Film.ideas = () => Film._ideas || (Film._ideas = Forms.buildIdeas(Film._heroData, EDGE, C));
})();
