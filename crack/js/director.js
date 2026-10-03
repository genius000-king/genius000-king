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

registerScene(0, {
  render(c) {
    const t = Math.min(Math.max(c.t, 0), TL.DUR - 1e-4);
    c.fx.thresh = 1.1;
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
