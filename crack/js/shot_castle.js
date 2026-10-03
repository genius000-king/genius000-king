'use strict';
// ══════════════════════════════════════════════════════════════
//  ٥ · القلعة — a fortress grows out of the floor, block by block, inside the dragon's circle.
//  Its cubes come from the dust that lay on the ground: they rise in waves, bottom to top.
// ══════════════════════════════════════════════════════════════
(() => {
  const T0 = 30.0, T_MORPH_END = 34.6, CZ = -1.5;
  const KEYS = [
    { t: 28.4, p: [0.0, 7.0, 11.0], look: [0, 1.6, -1.5], fov: 0.92 },
    { t: 30.0, p: [0.0, 5.2, 15.5], look: [0, 3.0, -1.5], fov: 0.84 },
    { t: 32.2, p: [5.0, 3.4, 13.5], look: [0, 3.6, -1.5], fov: 0.84 },
    { t: 34.6, p: [-3.8, 2.4, 10.2], look: [0, 3.8, -1.5], fov: 0.80 },
    { t: 36.4, p: [-1.0, 1.9, 8.4], look: [0, 3.0, -1.5], fov: 0.76 },
    { t: 37.5, p: [0.0, 1.6, 7.2], look: [0, 2.6, -1.5], fov: 0.74 },
    { t: 38.5, p: [0.0, 1.6, 7.0], look: [0, 2.6, -1.5], fov: 0.74 },
  ];
  Film.castleCam = t => {
    // before 30 the dragon's chase camera hands over to these keys
    return camFromKeys(KEYS, t);
  };

  Film.castleForm = () => {
    if (Film._castle) return Film._castle;
    const DR = Film.dragon(), D = DR.D, NC = Dragon.NC;
    const cs = Castle.build();
    const hidden = [];
    for (let k = 0; k < NC; k++) if (D.slots[k].kind === 7 && D.slots[k].ground) hidden.push(k);
    if (hidden.length < cs.length) console.log('WARNING: castle needs', cs.length, 'but only', hidden.length, 'ground cubes');
    const az = (x, z) => { const a = Math.atan2(z - CZ, x); return a < 0 ? a + TAU : a; };
    const pos = new Float32Array(131072), quat = new Float32Array(131072);
    Dragon.evalAll(D, T0, pos, quat, DR.map);
    const hs = hidden.slice().sort((a, b) => az(pos[DR.map[a] * 4], pos[DR.map[a] * 4 + 2]) - az(pos[DR.map[b] * 4], pos[DR.map[b] * 4 + 2]));
    const vs = cs.map((v, i) => i).sort((a, b) => az(cs[a].x, cs[a].z + CZ) - az(cs[b].x, cs[b].z + CZ));
    const r = rng(5150), n = Math.min(hs.length, vs.length);
    const aux = new Float32Array(131072);
    for (let i = 0; i < NC; i++) { aux[i * 4 + 1] = 1e3; aux[i * 4 + 2] = 1; }
    const over = [];                                        // [cube, x,y,z,size,cls]
    for (let i = 0; i < n; i++) {
      const cube = DR.map[hs[i]], v = cs[vs[i]];
      over.push([cube, v.x, v.y, v.z + CZ, v.size]);
      aux[cube * 4] = v.cls; aux[cube * 4 + 1] = 0.25 + v.key * 2.4 + r() * 0.25; aux[cube * 4 + 2] = 0.85 + 0.4 * r(); aux[cube * 4 + 3] = 0;
    }
    const q0 = new Float32Array(131072); for (let i = 0; i < 32768; i++) q0[i * 4 + 3] = 1;
    const form = new World.Form(NC, 1, pos, q0, aux);
    return (Film._castle = { form, over, pos: new Float32Array(131072), quat: new Float32Array(131072), cubes: new Set(over.map(o => o[0])) });
  };
  // positions of every cube at time t for the dragon's world + the castle (shared with the next shot)
  Film.castleFrame = (t) => {
    const DR = Film.dragon(), CF = Film.castleForm();
    Dragon.evalAll(DR.D, t, DR.pos, DR.quat, DR.map);
    CF.pos.set(DR.pos); CF.quat.set(DR.quat);
    for (const [cube, x, y, z, s] of CF.over) {
      const o = cube * 4; CF.pos[o] = x; CF.pos[o + 1] = y; CF.pos[o + 2] = z; CF.pos[o + 3] = s;
      CF.quat[o] = 0; CF.quat[o + 1] = 0; CF.quat[o + 2] = 0; CF.quat[o + 3] = 1;
    }
    return { DR, CF };
  };

  Shots.castle = function (c, t) {
    const { fx } = c;
    const cam = Film.castleCam(t), set = Film.heroSet();
    const { DR, CF } = Film.castleFrame(t);
    DR.form.update(DR.pos, DR.quat); CF.form.update(CF.pos, CF.quat);
    const Q = new Array(48).fill(0);
    const put = (i, ...v) => v.forEach((x, k) => { Q[i + k] = x; });
    put(32, T0, 1, 2.2, 0.0); put(36, 0.25, 0.15, 0.5, 0.25); put(40, 0, 0, CZ, 0);
    if (t < T_MORPH_END) {
      World.computeState(c, set, 'form', { Q, form: { F: DR.form, phase: 0 } }, set.scratch[0]);
      World.computeState(c, set, 'swarm', { Q, form: { F: CF.form, phase: 0 }, src: set.scratch[0] });
    } else World.computeState(c, set, 'form', { Q, form: { F: CF.form, phase: 0 } });
    const tl = t - T0;
    World.begin(c, cam, { mood: 0, tilt: 0.6, seam: 0.5, floorY: 0, fogD: 0.026, lines: 0.9, reveal: 80, ringC: [0, 0, CZ],
      pulseR: tl * 12, pulseA: tl > 0 ? 0.5 * Math.exp(-tl * 2.2) : 0, shC: [0, CZ, 13], shK: 0.6 });
    World.shadow(c, set);
    World.drawFloor(c, 0);
    World.drawCubes(c, set, {});
    fx.bloom = 0.12; fx.thresh = 1.2; fx.vig = 0.36; fx.streak = 0;
  };
})();
