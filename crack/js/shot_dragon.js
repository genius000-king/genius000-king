'use strict';
// ══════════════════════════════════════════════════════════════
//  ٤ · التنين — everything that was built a moment ago winds into a vortex and becomes one animal.
//  A serpent of cubes with a hinged jaw, horns, blue-glint eyes and bat wings; it circles the scene,
//  trailing smoke made of cubes, then coils down to the floor.
// ══════════════════════════════════════════════════════════════
(() => {
  const T0 = 22.5, T_MORPH_END = 26.2;
  const KEYS = [
    { t: 22.5, p: [-3.8, 4.2, 10.2], look: [0, 3.3, -1.5], fov: 0.82 },
    { t: 24.0, p: [-2.4, 4.6, 11.6], look: [0, 3.6, -1.5], fov: 0.86 },
    { t: 26.2, p: [2.6, 3.4, 9.0], look: [0, 3.2, -1.5], fov: 0.92 },
    { t: 28.4, p: [0.0, 6.6, 11.5], look: [0, 2.6, -1.5], fov: 0.90 },
    { t: 30.0, p: [0.0, 5.2, 15.5], look: [0, 3.0, -1.5], fov: 0.84 },
    { t: 31.0, p: [1.0, 4.9, 15.0], look: [0, 3.1, -1.5], fov: 0.84 },
  ];
  // static keys, with a chase camera riding behind the head through the flight
  Film.dragonCam = t => {
    const base = camFromKeys(KEYS, t);
    const w = sstep(24.2, 25.2, t) * (1 - sstep(27.4, 28.4, t));
    if (w <= 0.001) return base;
    const hd = Dragon.spine(0, t, {}), hl = Dragon.spine(0, t - 0.4, {});
    const pos = V3.add(V3.add(V3.add(hl.p, V3.mul(hl.T, 1.5)), V3.mul(hl.N, 2.4)), V3.mul(hl.B, -7.6));
    const look = V3.add(V3.add(hd.p, V3.mul(hd.T, -2.0)), V3.mul(hd.N, 0.0));
    const e = E.inOutCubic(w);
    return new Cam(V3.mix(base.pos, pos, e), V3.mix(base.look, look, e), mix(base.fov, 0.80, e), 0);
  };

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
    World.begin(c, cam, { mood: 0, tilt: 0.6, seam: 0.5, floorY: 0, fogD: 0.026, lines: 0.9, reveal: 80, ringC: [0, 0, -1.5], shC: [0, -1.5, 13], shK: 0.6 });
    World.shadow(c, set);
    World.drawFloor(c, 0);
    World.drawCubes(c, set, {});
    fx.bloom = 0.12; fx.thresh = 1.2; fx.vig = 0.36; fx.streak = 0;
  };
})();
