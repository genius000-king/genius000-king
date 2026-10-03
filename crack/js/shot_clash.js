'use strict';
// ══════════════════════════════════════════════════════════════
//  ٧ · الاصطدام — the charge, bullet time, and the wave of impact running back through the ranks.
//  Real time is warped (Army.warp): the camera lives in real time, the world lives in world time.
// ══════════════════════════════════════════════════════════════
(() => {
  const CZ = -1.5, C0 = [0, 1.0, CZ];
  const TCR = Army.unwarp(Army.T_C);                      // real time of the collision
  Film.clash = { TCR };
  const ORB1 = 49.8;
  const orbit = (t) => {
    const u = clamp((t - TCR) / (ORB1 - TCR));
    const th = mix(-0.62, 5.2, E.inOutSine(u)), rad = mix(7.0, 4.8, E.inOutCubic(u)), h = mix(1.35, 2.7, Math.sin(Math.PI * u * 0.5)) ;
    return new Cam([C0[0] + Math.sin(th) * rad, h, C0[2] + Math.cos(th) * rad], [0, 1.0 + 0.6 * u, CZ], mix(0.66, 0.84, u), 0.12 * Math.sin(TAU * u));
  };
  const PRE = [
    { t: 45.0, p: [0.0, 2.0, 10.5], look: [0, 1.1, -1.5], fov: 0.78, roll: 0 },
    { t: 46.0, p: [-2.4, 1.5, 8.2], look: [0, 1.1, -1.5], fov: 0.72, roll: -0.06 },
    { t: 46.85, p: [-3.2, 1.4, 6.6], look: [0, 1.1, -1.5], fov: 0.66, roll: 0.05 },
    { t: 47.0, p: [-3.2, 1.4, 6.6], look: [0, 1.1, -1.5], fov: 0.66, roll: 0.05 },
  ];
  Film.clashCam = t => {
    const a = camFromKeys(PRE, Math.min(t, 46.85));
    if (t <= TCR) { const o = orbit(TCR), e = sstep(46.6, TCR, t); return new Cam(V3.mix(a.pos, o.pos, e), V3.mix(a.look, o.look, e), mix(a.fov, o.fov, e), mix(a.roll, o.roll, e)); }
    if (t <= ORB1) return orbit(t);
    const o = orbit(ORB1), e = E.inOutCubic(lin(ORB1, 52.5, t));
    return new Cam(V3.mix(o.pos, [1.5, 8.2, 14.5], e), V3.mix(o.look, [0, 0.6, CZ], e), mix(o.fov, 0.92, e), mix(o.roll, 0, e));
  };

  Shots.clash = function (c, t) {
    const { fx } = c;
    const cam = Film.clashCam(t), set = Film.heroSet();
    const F = Film.armyFrame(t), Tw = Army.warp(t);
    F.form.update(F.pos, F.quat);
    World.computeState(c, set, 'form', { Q: [], form: { F: F.form, phase: 0 } });
    const dT = Tw - Army.T_C;
    World.begin(c, cam, { ...Film.spaceWorld(t), ringC: [0, 0, CZ], shC: [0, CZ, 14],
      pulseR: dT > 0 ? dT * 16 : 0, pulseA: dT > 0 ? 0.85 * Math.exp(-dT * 1.1) : 0 });
    World.shadow(c, set);
    World.drawCubes(c, set, { mirror: true });
    World.drawFloor(c, 1);
    World.drawCubes(c, set, {});
    const k = t - TCR;
    fx.bloom = 0.55 + 0.7 * pulse(t, TCR, 0.25); fx.thresh = 0.9; fx.vig = 0.5; fx.streak = 0.15 + 0.6 * pulse(t, TCR, 0.3);
    if (k > 0) { fx.flash = Math.max(fx.flash, 0.75 * Math.exp(-k / 0.09)); fx.ca += 0.02 * Math.exp(-k / 0.3); fx.zoomBlur += 0.06 * Math.exp(-k / 0.15); }
    const sh = 0.012 * Math.exp(-Math.max(k, 0) / 0.5) * (k > -0.05 ? 1 : 0); fx.shake[0] += sh * Math.sin(t * 91); fx.shake[1] += sh * Math.cos(t * 83);
    // speed ramp back to real time: a touch of zoom blur while the rate climbs
    const rate = Army.warp(t + 0.01) - Army.warp(t - 0.01); fx.zoomBlur += 0.03 * sstep(0.2, 1, rate / 0.02) * (1 - sstep(49.8, 50.4, t)) * sstep(49.0, 49.4, t);
  };
})();
