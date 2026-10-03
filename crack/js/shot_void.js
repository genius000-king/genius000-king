'use strict';
// ══════════════════════════════════════════════════════════════
//  ١ · الفراغ — a white sheet. A graphite point, a graphite hairline, and the hairline breaks.
//  The sheet is a real paper layer with real holes; through them: more white, with depth.
// ══════════════════════════════════════════════════════════════
(() => {
  const CRACK = CrackGen.build(7, 2.9);
  const T_POINT = 1.2, T_LINE0 = 1.9, T_CRACK = 2.9, T_BURST = 5.55, T_IRIS0 = 5.85, T_END = 7.5;
  Film.crack = { segs: CRACK, T_CRACK, T_BURST, T_END };

  // world camera while the paper is still there (and the first moments after)
  const KEYS = [
    { t: 0.0, p: [0, 2.2, 30], look: [0, 6.5, 0], fov: 0.72 },
    { t: 4.0, p: [0, 2.0, 22], look: [0, 5.2, 0], fov: 0.74 },
    { t: 5.6, p: [0, 1.9, 17], look: [0, 4.0, -2], fov: 0.77 },
    { t: 6.6, p: [0, 1.7, 12.5], look: [0, 2.8, -3], fov: 0.90 },
    { t: 7.5, p: [0, 1.4, 9.0], look: [0, 1.5, -1], fov: 0.84 },
    { t: 8.0, p: [0, 1.4, 8.4], look: [0, 1.5, -1], fov: 0.82 },
  ];
  Film.voidCam = t => camFromKeys(KEYS, t);

  // paper pieces thrown outward / at the lens
  const PIECES = (() => {
    const r = rng(31), out = [];
    for (let i = 0; i < 64; i++) {
      const a = r() * TAU, d = 30 + r() * 300;
      const n = 3 + (r() * 2 | 0), rad = 22 + r() * 90, poly = [];
      for (let k = 0; k < n; k++) { const an = k / n * TAU + r() * 0.8; poly.push([Math.cos(an) * rad * (0.6 + r() * 0.6), Math.sin(an) * rad * (0.6 + r() * 0.6)]); }
      out.push({ x: Math.cos(a) * d * 1.4, y: Math.sin(a) * d * 0.8, poly, spin: (r() - 0.5) * 6, vz: 0.5 + r() * 1.3, delay: r() * 0.45, shade: 0.9 + r() * 0.1 });
    }
    return out;
  })();

  Shots.void = function (c, t) {
    const { o, fx } = c;
    const sNow = 1 + 0.04 * t + 0.9 * sstep(4.6, 5.9, t) + 1.4 * sstep(5.9, 7.0, t);          // paper zoom (dolly into the sheet)
    const cam = Film.voidCam(t);
    // ── the world behind the paper: soft grey-white void, the floor not yet drawn ──
    World.begin(c, cam, { mood: 0, tilt: 0.6, seam: 0.5, floorY: 0, fogD: 0.03, lines: 0, reveal: 0, dim: mix(0.42, 1.0, sstep(5.7, 7.3, t)) });
    World.drawFloor(c, 0);

    // ── the sheet ──
    const open = 1 + 1.8 * sstep(4.2, T_BURST, t) + 30 * Math.pow(sstep(T_BURST, T_BURST + 0.9, t), 1.6);
    const pop = spring(t - T_POINT, 24, 0.55);
    const lk = E.inExpo(lin(T_LINE0, T_CRACK, t));
    const lineA = 1 - sstep(T_CRACK, T_CRACK + 0.25, t);
    Paper.draw(c, (m) => {
      // hairline + point on the paper (green channel)
      if (pop > 0) { m.fillStyle = 'rgb(0,255,0)'; m.beginPath(); m.arc(960, 540, 5.5 * pop * (1 - sstep(T_CRACK, T_CRACK + 0.9, t)), 0, TAU); m.fill(); }
      if (lk > 0 && lineA > 0) { m.strokeStyle = `rgb(0,${255 * lineA | 0},0)`; m.lineWidth = 2.2; m.beginPath(); m.moveTo(960 - 1000 * lk, 540); m.lineTo(960 + 1000 * lk, 540); m.stroke(); }
      // the tear (red channel)
      m.save(); m.translate(960, 540); m.scale(sNow, sNow); m.lineCap = 'round'; m.strokeStyle = 'rgb(255,0,0)';
      for (const s of CRACK) {
        if (t < s.t0) continue;
        const k = clamp((t - s.t0) / Math.max(s.t1 - s.t0, 1e-4)), grow = sstep(0, 0.45, t - s.t0);
        const w = (open * s.w + 0.4) * grow * (s.lvl ? 0.85 : 1);
        if (w < 0.08) continue;
        m.lineWidth = w; m.beginPath(); m.moveTo(s.x0, s.y0); m.lineTo(s.x0 + (s.x1 - s.x0) * k, s.y0 + (s.y1 - s.y0) * k); m.stroke();
      }
      const ir = sstep(T_IRIS0, T_IRIS0 + 1.1, t);
      if (ir > 0) {
        const R = 80 + 2600 * Math.pow(ir, 1.5), r = rng(5);
        m.fillStyle = 'rgb(255,0,0)'; m.beginPath();
        for (let k = 0; k < 64; k++) { const an = k / 64 * TAU, rr = R * (0.82 + 0.3 * r()); k ? m.lineTo(Math.cos(an) * rr, Math.sin(an) * rr) : m.moveTo(Math.cos(an) * rr, Math.sin(an) * rr); }
        m.closePath(); m.fill();
      }
      m.restore();
    }, { leak: sstep(3.0, 5.4, t) });

    // ── paper pieces flying outward ──
    for (const p of PIECES) {
      const tau = t - (T_BURST + 0.05 + p.delay); if (tau < 0) continue;
      const out = 1 + 2.4 * tau, sc = 1 + p.vz * tau * 1.4, al = 1 - sstep(0.9, 1.5, tau);
      if (al <= 0) continue;
      o.save(); o.translate(960 + p.x * out, 540 + p.y * out); o.rotate(p.spin * tau); o.scale(sc, sc); o.globalAlpha = al;
      o.beginPath(); p.poly.forEach(([x, y], i) => i ? o.lineTo(x, y) : o.moveTo(x, y)); o.closePath();
      const gg = o.createLinearGradient(-40, -40, 40, 40); gg.addColorStop(0, `rgb(${250 * p.shade | 0},${250 * p.shade | 0},${248 * p.shade | 0})`); gg.addColorStop(1, `rgb(${206 * p.shade | 0},${206 * p.shade | 0},${204 * p.shade | 0})`);
      o.fillStyle = gg; o.shadowColor = 'rgba(0,0,0,.30)'; o.shadowBlur = 16; o.fill(); o.restore();
    }

    // ── post: white world — nothing blooms, the vignette gives it depth ──
    fx.thresh = 1.2; fx.bloom = 0.10; fx.exposure = 1.0; fx.vig = 0.34;
    fx.streak = 0;
    fx.grain = 0.022;
    fx.ca += 0.003 * sstep(T_BURST, T_END, t);
    fx.zoomBlur += 0.07 * sstep(6.2, 7.5, t);
  };
})();
