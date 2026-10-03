'use strict';
// ══════════════════════════════════════════════════════════════
//  The director — one continuous scene [0, 60 s]; shots are functions of time.
//  Identity: a seamless grey-white studio void · matte white ceramic and graphite cubes ·
//  fine contour lines and particles · one cold-blue glint. No colour. No sun.
// ══════════════════════════════════════════════════════════════
const Shots = {};
const Film = {
  B: TL.BEAT, BAR: TL.BAR,
  heroEdge: 2.4, heroC: [0, 1.9, 0],
};

// the world flips twice: white → black space with a purple/red nebula (the dragon is born) → white again (the cube returns)
Film.T_FLIP_IN = 22.5; Film.T_FLIP_OUT = 54.65;
Film.spaceWorld = (t) => {
  const f1 = Math.round((t - Film.T_FLIP_IN) * 60), f2 = Math.round((t - Film.T_FLIP_OUT) * 60);
  let mood;
  if (t < Film.T_FLIP_IN - 1e-4) mood = 0;
  else if (f1 < 4) mood = (f1 % 2 === 0) ? 0 : 1;
  else if (t < Film.T_FLIP_OUT - 1e-4) mood = 1;
  else if (f2 < 3) mood = (f2 % 2 === 0) ? 0 : 1;
  else mood = 0;
  return { mood, tilt: 0.5, seam: mood > 0.5 ? 1.0 : 0.5, split: 0, splitX: 0, splitD: 0, floorY: 0, fogD: mood > 0.5 ? 0.02 : 0.026, lines: 0.9, reveal: 80, shK: mood > 0.5 ? 0.0 : 0.6, mirrorK: 0.55 };
};

registerScene(0, {
  render(c) {
    const t = Math.min(Math.max(c.t, 0), TL.DUR - 1e-4);
    c.fx.thresh = 1.1;
    // a trace of hand-held life in every shot
    c.fx.shake[0] += 0.0009 * (Math.sin(t * 2.1) + 0.6 * Math.sin(t * 5.3 + 1)); c.fx.shake[1] += 0.0007 * (Math.sin(t * 1.7 + 2) + 0.6 * Math.sin(t * 4.6));
    if (t < 7.5) Shots.void(c, t);
    else if (Shots.inside && t < 15) Shots.inside(c, t);
    else if (Shots.split && t < 22.5) Shots.split(c, t);
    else if (Shots.dragon && t < 30) Shots.dragon(c, t);
    else if (Shots.castle && t < 37.5) Shots.castle(c, t);
    else if (Shots.rival && t < 45) Shots.rival(c, t);
    else if (Shots.clash && t < 52.5) Shots.clash(c, t);
    else if (Shots.unity) Shots.unity(c, t);
  },
});
