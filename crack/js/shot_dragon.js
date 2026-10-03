'use strict';
// ══════════════════════════════════════════════════════════════
//  ٤ · التنين — the world flips: white → black space, and the lattice and its ideas wind into one animal.
//  A serpent of cubes (graphite, with purple→red energy veins, red eyes) circles the scene.
//  Camera rigs change on the bar: a dive through the vortex · a side chase · a 360° orbit of the head · a crane out.
// ══════════════════════════════════════════════════════════════
(() => {
  const T0 = 22.5, T_MORPH_END = 26.2, CZ = -1.5, BAR = TL.BAR;
  const hd = (t, s = 0) => Dragon.spine(s, t, {});

  const rigVortex = t => {
    const u = clamp((t - T0) / BAR);
    return orbitCam([0, 0, CZ], mix(2.8, 9.8, E.outQuad(u)), mix(0.9, 4.2, E.outCubic(u)), -0.5 + 5.2 * E.outCubic(u), mix(4.4, 3.2, u), mix(0.98, 0.82, u), mix(-0.24, 0, E.outCubic(u)));
  };
  const rigChase = t => {                                                  // a tracking shot from the dragon's flank
    const h = hd(t), l = hd(t - 0.4);
    const pos = V3.add(V3.add(V3.add(l.p, V3.mul(l.T, 1.5)), V3.mul(l.N, 2.4)), V3.mul(l.B, -7.6));
    return new Cam(pos, V3.add(h.p, V3.mul(h.T, -2.0)), 0.80, 0.07 * Math.sin(0.9 * t));
  };
  const rigHead = t => {                                                   // one full circle around the head, riding along with it
    const u = clamp((t - (T0 + 2 * BAR)) / BAR), ph = TAU * E.inOutSine(u), R = mix(4.8, 3.3, Math.sin(Math.PI * u));
    const h = hd(t);
    const off = V3.add(V3.add(V3.mul(h.B, R * Math.cos(ph)), V3.mul(h.T, R * 1.05 * Math.sin(ph))), V3.mul(h.N, 1.2 + 0.9 * Math.sin(ph)));
    return new Cam(V3.add(h.p, off), V3.add(h.p, V3.mul(h.T, 0.3)), 0.72, 0.11 * Math.sin(TAU * u));
  };
  const CRANE = [
    { t: 28.125, p: [5.5, 1.3, 6.5], look: [0, 3.2, -1.5], fov: 0.90, roll: 0.10 },
    { t: 29.0, p: [3.2, 3.2, 11.0], look: [0, 3.4, -1.5], fov: 0.86, roll: 0.05 },
    { t: 30.0, p: [0.0, 5.2, 15.5], look: [0, 3.0, -1.5], fov: 0.84, roll: 0 },
    { t: 31.0, p: [1.0, 4.9, 15.0], look: [0, 3.1, -1.5], fov: 0.84, roll: 0 },
  ];
  Film.dragonCam = t => t < T0 + BAR ? rigVortex(t) : t < T0 + 2 * BAR ? rigChase(t) : t < T0 + 3 * BAR ? rigHead(t) : camFromKeys(CRANE, t);

  Film.dragon = () => {
    if (Film._dragon) return Film._dragon;
    const set = Film.heroSet(); Film.ideas();
    const D = Dragon.build(), NC = Dragon.NC;
    // where every cube is at the moment the morph begins (exact, read back from the GPU)
    Film.splitState({ lt: T0 }, T0, set);
    const A = World.readState(set, 0);
    const az = (x, z) => { let a = Math.atan2(z + 1.5, x); return a < 0 ? a + TAU : a; };
    const cubeIdx = Array.from({ length: NC }, (_, i) => i).sort((a, b) => az(A[a * 4], A[a * 4 + 2]) - az(A[b * 4], A[b * 4 + 2]));
    const pos0 = new Float32Array(131072), q0 = new Float32Array(131072);
    Dragon.evalAll(D, T0 + 1.4, pos0, q0);
    const slotIdx = Array.from({ length: NC }, (_, k) => k).sort((a, b) => az(pos0[a * 4], pos0[a * 4 + 2]) - az(pos0[b * 4], pos0[b * 4 + 2]));
    const map = new Int32Array(NC), r = rng(99);
    for (let k = 0; k < NC; k++) map[slotIdx[k]] = cubeIdx[k];
    const aux = new Float32Array(131072);
    for (let k = 0; k < NC; k++) {
      const s = D.slots[k], o = map[k] * 4;
      let delay;
      if (s.kind === 6) delay = 1.15 + 0.8 * s.a + r() * 0.3;
      else if (s.kind === 7) delay = r() * 1.7;
      else delay = 0.05 + s.key * 1.45 + r() * 0.3;
      aux[o] = s.cls; aux[o + 1] = delay; aux[o + 2] = 0.95 + 0.35 * r(); aux[o + 3] = 0;
    }
    const quat = new Float32Array(131072); for (let i = 0; i < 32768; i++) quat[i * 4 + 3] = 1;
    const form = new World.Form(NC, 1, pos0, quat, aux);
    return (Film._dragon = { D, map, form, pos: new Float32Array(131072), quat: new Float32Array(131072) });
  };

  Shots.dragon = function (c, t) {
    const { fx } = c;
    const cam = Film.dragonCam(t), set = Film.heroSet();
    const DR = Film.dragon();
    Dragon.evalAll(DR.D, t, DR.pos, DR.quat, DR.map);
    DR.form.update(DR.pos, DR.quat);
    const Q = new Array(48).fill(0);
    const put = (i, ...v) => v.forEach((x, k) => { Q[i + k] = x; });
    put(32, T0, 0, 4.0, 0.1); put(36, 0.5, 0.5, 2.4, 0.3); put(40, 0, 3.0, -1.5, 0);
    if (t < T_MORPH_END) {
      Film.splitState(c, t, set.scratch[0]);
      World.computeState(c, set, 'swarm', { Q, form: { F: DR.form, phase: 0 }, src: set.scratch[0] });
    } else {
      World.computeState(c, set, 'form', { Q, form: { F: DR.form, phase: 0 } });
    }
    const k = t - T0;
    World.begin(c, cam, { ...Film.spaceWorld(t), ringC: [0, 0, CZ], pulseR: Math.max(k, 0) * 14, pulseA: k > 0 ? 0.9 * Math.exp(-k * 1.8) : 0, shC: [0, -1.5, 13] });
    World.shadow(c, set);
    World.drawCubes(c, set, { mirror: true });
    World.drawFloor(c, 1);
    World.drawCubes(c, set, {});
    fx.bloom = 0.5; fx.thresh = 0.95; fx.vig = 0.5; fx.streak = 0.12;
    // the cut: a white frame, a glitch, a shove
    if (k >= -0.001) {
      fx.flash = Math.max(fx.flash, 0.9 * Math.exp(-k / 0.11)); fx.flashCol = [1, 1, 1];
      fx.glitch = Math.max(fx.glitch, 0.9 * Math.exp(-k / 0.28)); fx.ca += 0.035 * Math.exp(-k / 0.35);
      fx.zoomBlur += 0.20 * Math.exp(-k / 0.16); fx.shake[0] += 0.02 * Math.exp(-k / 0.2) * Math.sin(t * 97); fx.shake[1] += 0.015 * Math.exp(-k / 0.2) * Math.cos(t * 83);
    }
    // each bar-line cut gets a little punch
    for (const tc of [T0 + BAR, T0 + 2 * BAR, T0 + 3 * BAR]) { fx.zoomBlur += 0.07 * pulse(t, tc, 0.1); fx.ca += 0.01 * pulse(t, tc, 0.14); }
  };
})();
