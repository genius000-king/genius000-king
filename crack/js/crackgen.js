'use strict';
// ══════════════════════════════════════════════════════════════
//  Procedural crack — pure data, so the SAME segments drive the picture and the score.
//  Coordinates are screen-space pixels at zoom 1, origin = screen centre (y down).
// ══════════════════════════════════════════════════════════════
const CrackGen = (() => {
  function build(seed = 7, T0 = 2.9) {
    const R = rng(seed);
    const segs = []; let id = 0;
    function branch(x, y, dir, lvl, t, speed, w0, maxLen) {
      let len = 0;
      while (len < maxLen) {
        const step = (22 + R() * 44) * (lvl === 0 ? 1 : 0.72);
        const ang = dir + (R() - 0.5) * (lvl === 0 ? 0.62 : 0.95);
        const x1 = x + Math.cos(ang) * step, y1 = y + Math.sin(ang) * step;
        const dt = step / speed;
        const me = id++;
        segs.push({ id: me, x0: x, y0: y, x1, y1, t0: t, t1: t + dt, w: w0 * (1 - 0.7 * len / maxLen) * (0.75 + 0.5 * R()), lvl });
        const pChild = lvl === 0 ? 0.20 : lvl === 1 ? 0.11 : 0.0;
        if (R() < pChild) {
          const side = R() < 0.5 ? -1 : 1;
          branch(x1, y1, ang + side * (0.45 + R() * 0.8), lvl + 1, t + dt, speed * 0.72, w0 * 0.6, maxLen * (0.22 + R() * 0.32));
        }
        x = x1; y = y1; t += dt; len += step; speed *= 1.055; dir = ang * 0.45 + dir * 0.55;
      }
    }
    branch(0, 0, 0.04, 0, T0, 300, 5.5, 1250);                 // to the right
    branch(0, 0, Math.PI - 0.05, 0, T0 + 0.07, 300, 5.5, 1250); // to the left
    // two long vertical-ish arms that make the opening read as a tear, not a line
    branch(-60, 2, -Math.PI / 2 + 0.2, 1, T0 + 0.55, 360, 4.5, 560);
    branch(70, -2, Math.PI / 2 - 0.15, 1, T0 + 0.75, 360, 4.5, 520);
    segs.sort((a, b) => a.t0 - b.t0);
    return segs;
  }
  // events for the score: pick a readable subset (~26) of the segment starts
  function cues(segs) {
    const ev = [];
    let lastT = -1;
    for (const s of segs) {
      if (s.lvl > 1) continue;
      if (s.t0 - lastT < 0.055) continue;
      lastT = s.t0;
      ev.push({ t: s.t0, x: s.x0, y: s.y0, lvl: s.lvl, len: Math.hypot(s.x1 - s.x0, s.y1 - s.y0) });
    }
    return ev;
  }
  return { build, cues };
})();
if (typeof module !== 'undefined') module.exports = CrackGen;
