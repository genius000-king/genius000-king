'use strict';
// ══════════════════════════════════════════════════════════════
//  ٥ · القلعة — a fortress grows out of the floor, block by block, inside the dragon's circle.
//  Its cubes come from the dust that lay on the ground: they rise in waves, bottom to top.
// ══════════════════════════════════════════════════════════════
(() => {
  const T0 = 30.0, T_MORPH_END = 34.6, CZ = -1.5;
  const CK = [
    { t: 30.0, p: [0.0, 5.2, 15.5], look: [0, 3.0, -1.5], fov: 0.84, roll: 0 },
    { t: 31.0, p: [5.5, 2.6, 13.5], look: [0, 3.2, -1.5], fov: 0.84, roll: -0.05 },
    { t: 32.2, p: [7.0, 1.6, 6.5], look: [0, 3.6, -1.5], fov: 0.82, roll: 0 },
    { t: 33.0, p: [7.0, 1.6, 6.5], look: [0, 3.6, -1.5], fov: 0.82, roll: 0 },
  ];
  // a low rising crane while the blocks climb, then a full circle of the fortress, ending face-on at the gate
  Film.castleCam = t => {
    if (t < 32.2) return camFromKeys(CK, t);
    const C = [0, 0, CZ];
    if (t < 36.0) {
      const u = clamp((t - 32.2) / 3.8), e = E.inOutSine(u);
      return orbitCam(C, mix(10.6, 10.0, u), 1.6 + 1.6 * Math.sin(Math.PI * u) + 0.4 * u, 0.72 + (TAU - 0.72) * e, mix(3.6, 3.0, u), mix(0.82, 0.76, u), 0.06 * Math.sin(Math.PI * u));
    }
    const u = clamp((t - 36.0) / 1.5), e = E.inOutQuad(u);
    return orbitCam(C, mix(10.0, 8.7, e), mix(2.0, 1.6, e), TAU, mix(3.0, 2.6, e), mix(0.76, 0.74, e), 0);
  };

  const CMAP = { 0: 1, 1: 5, 2: 6, 3: 7 };           // wall → graphite · roof → purple energy · windows/gate → red energy · flags → sparks
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
      aux[cube * 4] = CMAP[v.cls] + (v.cls === 3 ? (v.x > 0 ? 0.8 : 0) : 0); aux[cube * 4 + 1] = 0.25 + v.key * 2.4 + r() * 0.25; aux[cube * 4 + 2] = 0.85 + 0.4 * r(); aux[cube * 4 + 3] = 0;
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
    World.begin(c, cam, { ...Film.spaceWorld(t), ringC: [0, 0, CZ], pulseR: tl * 12, pulseA: tl > 0 ? 0.8 * Math.exp(-tl * 2.2) : 0, shC: [0, CZ, 13] });
    World.shadow(c, set);
    World.drawCubes(c, set, { mirror: true });
    World.drawFloor(c, 1);
    World.drawCubes(c, set, {});
    fx.bloom = 0.5; fx.thresh = 0.95; fx.vig = 0.5; fx.streak = 0.12;
    fx.zoomBlur += 0.08 * pulse(t, T0, 0.12); fx.ca += 0.01 * pulse(t, T0, 0.15);
  };
})();
