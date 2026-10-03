'use strict';
// ══════════════════════════════════════════════════════════════
//  ٦ · الفريقان — the castle splits down its middle: its left half becomes a graphite army, its right
//  half a white one. The world splits with it: light on the left, dark on the right (like your reference).
// ══════════════════════════════════════════════════════════════
(() => {
  const T0 = 37.5, T_MORPH_END = 41.2, CZ = -1.5;
  const KEYS = [
    { t: 37.5, p: [0.0, 1.6, 7.2], look: [0, 2.6, -1.5], fov: 0.74 },
    { t: 38.6, p: [0.0, 3.0, 12.5], look: [0, 1.6, -1.5], fov: 0.80 },
    { t: 40.6, p: [0.4, 3.8, 15.0], look: [0, 1.2, -1.5], fov: 0.80 },
    { t: 43.0, p: [0.0, 2.8, 12.5], look: [0, 1.1, -1.5], fov: 0.78 },
    { t: 45.0, p: [0.0, 2.0, 10.5], look: [0, 1.1, -1.5], fov: 0.78 },
    { t: 46.0, p: [-2.4, 1.5, 8.2], look: [0, 1.1, -1.5], fov: 0.72 },
    { t: 46.85, p: [-3.2, 1.4, 6.6], look: [0, 1.1, -1.5], fov: 0.66 },
  ];
  Film.rivalCam = t => camFromKeys(KEYS, t);

  Film.armyForm = () => {
    if (Film._army) return Film._army;
    const DR = Film.dragon(), CF = Film.castleForm(), D = DR.D, NC = Dragon.NC;
    const AR = Army.build(), r = rng(31337);
    const cs = CF.over.map(o => ({ cube: o[0], x: o[1], y: o[2] })).sort((a, b) => a.x - b.x);
    const half = AR.sol.length * Army.PER / 2;
    const slotX = k => { const sl = AR.slots[k], s = AR.sol[sl.si], tp = Army.TPL[sl.ti]; return s.bx + s.dir * tp.x; };
    const L = [], Rr = [];
    AR.slots.forEach((sl, k) => (AR.sol[sl.si].side === 0 ? L : Rr).push(k));
    L.sort((a, b) => slotX(a) - slotX(b)); Rr.sort((a, b) => slotX(a) - slotX(b));
    const role = new Uint8Array(NC), slotOf = new Int32Array(NC).fill(-1);
    const aux = new Float32Array(131072); for (let i = 0; i < NC; i++) { aux[i * 4 + 1] = 1e3; aux[i * 4 + 2] = 1; }
    const army = [];                                              // [cube, slot]
    const assign = (list, cubes) => list.forEach((k, i) => {
      const c = cubes[i]; if (!c) return;
      const sl = AR.slots[k], s = AR.sol[sl.si], tp = Army.TPL[sl.ti];
      const emblem = (tp.part === 6 && tp.y > 0.40 && tp.y < 0.5 && Math.abs(tp.z + 0.26) < 0.02) || (tp.part === 3 && tp.s < 0.03);
      const cls = tp.part === 7 && tp.s > 0.03 ? 2 : (s.side === 0 ? (emblem ? 0 : 1) : (emblem ? 1 : 0));
      role[c.cube] = 1; slotOf[c.cube] = k; army.push([c.cube, k]);
      aux[c.cube * 4] = cls; aux[c.cube * 4 + 1] = 0.12 + Math.abs(c.x) / 3.6 * 0.9 + c.y / 9 * 0.55 + r() * 0.22; aux[c.cube * 4 + 2] = 1.0 + 0.35 * r(); aux[c.cube * 4 + 3] = 0;
    });
    assign(L, cs.slice(0, half)); assign(Rr, cs.slice(cs.length - half));
    // the few castle cubes that found no soldier shrink away
    const hide = [];
    for (const o of CF.over) if (!role[o[0]]) { role[o[0]] = 3; hide.push({ cube: o[0], x: o[1], y: o[2], z: o[3] }); const q = o[0] * 4; aux[q] = 0.5; aux[q + 1] = 0.3 + r() * 0.8; aux[q + 2] = 0.8; aux[q + 3] = 0; }
    // dragon + smoke become a high storm of dust
    const storm = [];
    for (let k = 0; k < NC; k++) if (D.slots[k].kind <= 6) {
      const c = DR.map[k]; role[c] = 2;
      const o = c * 4; aux[o] = 0.5; aux[o + 1] = 0.2 + r() * 1.3; aux[o + 2] = 1.1 + 0.4 * r(); aux[o + 3] = 0;
      storm.push({ cube: c, x: (r() - 0.5) * 34, y: 3.2 + 7 * Math.pow(r(), 1.2), z: CZ + (r() - 0.5) * 22, s: storm.length < 4200 ? 0.010 + 0.014 * r() : 0, ph: r() * TAU });
    }
    const quat0 = new Float32Array(131072); for (let i = 0; i < NC; i++) quat0[i * 4 + 3] = 1;
    const form = new World.Form(NC, 1, new Float32Array(131072), quat0, aux);
    return (Film._army = { form, AR, army, storm, hide, role, pos: new Float32Array(131072), quat: new Float32Array(131072), D, DR, CF });
  };
  // every cube's pose at real time t
  Film.armyFrame = (t) => {
    const F = Film.armyForm(), Tw = Army.warp(t), { AR, DR, D } = F;
    Dragon.evalAll(D, t, F.pos, F.quat, DR.map);                     // dust keeps floating
    const out = [0, 0, 0, 0, 0, 0, 0, 1];
    for (const [cube, k] of F.army) {
      const sl = AR.slots[k]; Army.evalCube(AR.sol[sl.si], Army.TPL[sl.ti], sl.ti, Tw, out);
      const o = cube * 4; F.pos[o] = out[0]; F.pos[o + 1] = out[1]; F.pos[o + 2] = out[2]; F.pos[o + 3] = out[3];
      F.quat[o] = out[4]; F.quat[o + 1] = out[5]; F.quat[o + 2] = out[6]; F.quat[o + 3] = out[7];
    }
    for (const h of F.hide) { const o = h.cube * 4; F.pos[o] = h.x; F.pos[o + 1] = h.y; F.pos[o + 2] = h.z; F.pos[o + 3] = 0; F.quat[o + 3] = 1; F.quat[o] = F.quat[o + 1] = F.quat[o + 2] = 0; }
    for (const s of F.storm) {
      const a = 0.035 * Tw, ca = Math.cos(a), sa = Math.sin(a), o = s.cube * 4;
      F.pos[o] = s.x * ca + (s.z - CZ) * sa; F.pos[o + 2] = -s.x * sa + (s.z - CZ) * ca + CZ; F.pos[o + 1] = s.y + 0.25 * Math.sin(0.7 * Tw + s.ph); F.pos[o + 3] = s.s;
      F.quat[o] = 0; F.quat[o + 1] = 0; F.quat[o + 2] = 0; F.quat[o + 3] = 1;
    }
    return F;
  };

  Film.rivalWorld = (t) => {
    const sx = t < 45 ? mix(26, 0, E.inOutCubic(lin(37.7, 39.8, t))) : mix(0, 30, E.inOutCubic(lin(51.4, 53.2, t)));
    return { mood: 0, tilt: 0.5, seam: 0.8, split: 1, splitX: sx, splitD: clamp(sx / 14, -0.6, 2), floorY: 0, fogD: 0.026, lines: 0.9, reveal: 80 };
  };

  Shots.rival = function (c, t) {
    const { fx } = c;
    const cam = Film.rivalCam(t), set = Film.heroSet();
    const F = Film.armyFrame(t), { CF } = F;
    // the castle (source A) at this very moment
    const { DR } = Film.castleFrame(t);
    DR.form.update(DR.pos, DR.quat); CF.form.update(CF.pos, CF.quat);
    F.form.update(F.pos, F.quat);
    const Q = new Array(48).fill(0);
    const put = (i, ...v) => v.forEach((x, k) => { Q[i + k] = x; });
    put(32, T0, 0, 3.0, 0.1); put(36, 0.8, 0.35, 0.5, 0.3); put(40, 0, 2, CZ, 0);
    if (t < T_MORPH_END) {
      World.computeState(c, set, 'form', { Q, form: { F: CF.form, phase: 0 } }, set.scratch[0]);
      World.computeState(c, set, 'swarm', { Q, form: { F: F.form, phase: 0 }, src: set.scratch[0] });
    } else World.computeState(c, set, 'form', { Q, form: { F: F.form, phase: 0 } });
    World.begin(c, cam, { ...Film.rivalWorld(t), ringC: [0, 0, CZ], shC: [0, CZ, 13], shK: 0.55, mirrorK: 0.5 });
    World.shadow(c, set);
    World.drawCubes(c, set, { mirror: true });
    World.drawFloor(c, 1);
    World.drawCubes(c, set, {});
    fx.bloom = 0.16; fx.thresh = 1.1; fx.vig = 0.40; fx.streak = 0;
  };
})();
