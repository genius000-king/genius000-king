'use strict';
// ══════════════════════════════════════════════════════════════
//  ٣ · عمق — the DROP. Every flat star extrudes into a lit octagram tower,
//  radiating outward from the origin; the camera stoops out of the sky and
//  streaks down a canyon between them.
// ══════════════════════════════════════════════════════════════
(() => {
  const B = TL.BEAT;
  // camera handed over from chapter 2 (u = 3.75)
  const c0 = S2.cam(3.75);
  const P0 = cityCam([0, 0, 0], c0.dist, c0.yaw, c0.pitch);

  // hand-authored flight: swing round the erupting hero tower, skim the roofs, drop into the avenue
  const WP = [
    { t: 0.0,  p: P0,                look: [0, 0, 0] },
    { t: 0.8,  p: [3.6, 7.0, 7.6],   look: [0, 1.2, 0] },
    { t: 1.6,  p: [1.2, 5.7, 1.0],   look: [0, 2.0, -10] },
    { t: 2.4,  p: [0.0, 3.7, -8.0],  look: [0, 2.0, -22] },
    { t: 3.2,  p: [0.0, 2.4, -19.0], look: [0.4, 2.4, -34] },
    { t: 3.75, p: [0.1, 2.1, -27.0], look: [0.8, 2.6, -42] },
  ];
  const cr = (p0, p1, p2, p3, u) => 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
  function rig(v) {
    v = clamp(v, 0, 3.75);
    let i = 0; while (i < WP.length - 2 && v > WP[i + 1].t) i++;
    const a = WP[i], b = WP[i + 1], pa = WP[Math.max(i - 1, 0)], pb = WP[Math.min(i + 2, WP.length - 1)];
    const u = clamp((v - a.t) / (b.t - a.t));
    const mixv = (k) => [0, 1, 2].map(j => cr(pa[k][j], a[k][j], b[k][j], pb[k][j], u));
    const k = clamp(v / 3.75);
    const roll = mix(c0.roll, 0, sstep(0, .6, v)) + 0.07 * Math.sin(v * 1.9) * sstep(.8, 2.4, v) + 0.05 * pulse(v, 2.5, .3);
    const focal = mix(CITY_FOCAL, 1.05, E.inOutCubic(lin(.3, 2.6, v)));
    return { pos: mixv('p'), look: mixv('look'), roll, focal };
  }

  registerScene(2, {
    trans: { dur: 0.14, type: 3 },
    render(c) {
      const { lt: v, o, a, fx } = c;
      const r = rig(Math.max(v, 0));
      runCity(c, {
        camPos: r.pos, lookAt: r.look, roll: r.roll, focal: r.focal,
        rise: v, reveal: 40, centerOn: 1, bgMix: 0, warm: 0.75, fog: 0.028, hmax: 4.6, expo: 1, avenue: 1,
      });

      // caption + tiny depth readout that scrolls with the flight
      const capIn = E.outCubic(lin(1.35, 2.0, v)), capOut = 1 - sstep(3.2, 3.55, v);
      if (capIn > 0 && capOut > 0) {
        captionShade(o, capIn * capOut);
        const w = 520;
        o.save(); o.beginPath(); o.rect(960 + w / 2 - w * capIn, 900, w * capIn + 2, 110); o.clip();
        text(o, 'ثم صار الشكل عالمًا', 960, 950, { font: F.ruqaa(60, 700), fill: C.cream, alpha: capOut * .98, shadow: ['rgba(0,0,0,.7)', 22] });
        o.restore();
      }
      // speed streak pushing at the end (into chapter 4's whip)
      const k = lin(3.0, 3.75, v);
      fx.zoomBlur += .10 * k * k;
      fx.ca += .006 * k;
      fx.streak = .5 * Math.exp(-v * 2.5);
      fx.bloom += .25 * pulse(v, 0, .35);
    },
  });
})();
