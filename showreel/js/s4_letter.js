'use strict';
// ══════════════════════════════════════════════════════════════
//  ٤ · حرف — kinetic typography on flat colour, cut to the beat.
//  Cut rhythm accelerates: 2 beats → 1 → 1 → ½ → ½ → 1 → then ¼-beat strobe.
//  Every word is performed the way it sounds.
// ══════════════════════════════════════════════════════════════
(() => {
  const B = TL.BEAT;
  const INK = '#0b0d1a', CREAM = '#f2e8d5';
  const CARDS = [
    { w: 'فكرة',  t0: 0,       t1: 2 * B,   bg: CREAM,     fg: INK,     acc: '#ffb627' },
    { w: 'حركة',  t0: 2 * B,   t1: 3 * B,   bg: '#ff2e6e', fg: CREAM,   acc: INK },
    { w: 'إيقاع', t0: 3 * B,   t1: 4 * B,   bg: '#2a2cff', fg: '#ffb627', acc: CREAM },
    { w: 'لون',   t0: 4 * B,   t1: 4.5 * B, bg: '#ffb627', fg: INK,     acc: '#ff2e6e' },
    { w: 'عمق',   t0: 4.5 * B, t1: 5 * B,   bg: '#04121c', fg: '#19e3d0', acc: '#ffb627' },
    { w: 'زمن',   t0: 5 * B,   t1: 6 * B,   bg: '#05060f', fg: CREAM,   acc: '#ff2e88' },
  ];
  const STROBE = ['فكرة', 'حركة', 'إيقاع', 'لون', 'عمق', 'زمن', 'شكل', 'عالم'];
  const STROBE_COL = [['#05060f', CREAM], [CREAM, '#05060f'], ['#ff2e6e', CREAM], ['#ffb627', INK], ['#2a2cff', '#ffb627'], [CREAM, '#ff2e6e'], ['#19e3d0', INK], ['#05060f', '#ffb627']];
  const CX = 960, CY = 520;

  // frame: inset hairline + corner ticks + index — the "design system" holding every card together
  function frame(o, col, idx, a = .8) {
    o.save(); o.globalAlpha = a; o.strokeStyle = col; o.lineWidth = 2;
    o.strokeRect(44, 44, 1832, 992);
    for (const [x, y] of [[44, 44], [1876, 44], [44, 1036], [1876, 1036]]) {
      o.beginPath(); o.moveTo(x - 14, y); o.lineTo(x + 14, y); o.moveTo(x, y - 14); o.lineTo(x, y + 14); o.stroke();
    }
    text(o, AR(String(idx).padStart(2, '0')) + ' / ' + AR('06'), 1836, 84, { font: F.reem(26, 700), fill: col, align: 'right', dir: 'ltr' });
    o.restore();
  }

  // bg wipes when a new card takes over (0..1)
  function wipeIn(o, k, prev, cur, p) {
    o.fillStyle = prev; o.fillRect(0, 0, 1920, 1080);
    if (p >= 1) { o.fillStyle = cur; o.fillRect(0, 0, 1920, 1080); return; }
    o.save(); o.fillStyle = cur;
    if (k === 1) {                                   // diagonal blade from the right
      const x = mix(2300, -400, E.outCubic(p));
      o.beginPath(); o.moveTo(x, 0); o.lineTo(2300, 0); o.lineTo(2300, 1080); o.lineTo(x - 420, 1080); o.closePath(); o.fill();
    } else if (k === 2) {                            // iris from centre
      o.beginPath(); o.arc(CX, CY, 1400 * E.outCubic(p), 0, TAU); o.fill();
    } else if (k === 3) {                            // 6 vertical slats
      for (let i = 0; i < 6; i++) { const q = E.outCubic(clamp(p * 1.6 - i * .12)); o.fillRect(i * 320, 0, 321, 1080 * q); }
    } else if (k === 4) {                            // horizontal slats
      for (let i = 0; i < 6; i++) { const q = E.outCubic(clamp(p * 1.6 - i * .10)); o.fillRect(1920 * (1 - q), i * 180, 1920 * q, 181); }
    } else { o.fillRect(0, 0, 1920, 1080); }
    o.restore();
  }

  // ── card performances ────────────────────────────────────
  function fikra(o, w) {
    const s = spring(w - .02, 15, .52);
    o.fillStyle = '#ffb627'; o.beginPath(); o.arc(CX, CY, 400 * s, 0, TAU); o.fill();
    // idea burst
    o.strokeStyle = INK; o.lineCap = 'round';
    for (let i = 0; i < 22; i++) {
      const an = i / 22 * TAU + .15 * w, r0 = 430 + (i % 2) * 20;
      const q = E.outCubic(lin(.10 + (i % 4) * .025, .42, w)), q2 = E.inCubic(lin(.45, .8, w));
      const a0 = r0 + 260 * q2 * (i % 2 ? 1.4 : 1), a1 = r0 + (90 + 110 * hash1(i * 3.3)) * q + 260 * q2 * (i % 2 ? 1.4 : 1);
      o.lineWidth = i % 2 ? 5 : 9;
      o.beginPath(); o.moveTo(CX + Math.cos(an) * a0, CY + Math.sin(an) * a0 * .82); o.lineTo(CX + Math.cos(an) * a1, CY + Math.sin(an) * a1 * .82); o.stroke();
    }
    const e = E.outExpo(lin(0, .26, w));
    const sc = mix(2.7, 1, e), rot = mix(-.10, 0, e);
    const sq = 1 - .10 * pulse(w, B, .09) + .0;
    extruded(o, 'فكرة', CX, CY + 20, { font: F.lalezar(500), fill: INK, sx: sc, sy: sc * sq, rot, layers: 18, dx: -3.2, dy: 4.2, mid: '#ff2e6e', back: '#3a0b2a' });
    // sparkles that pop on the second beat
    for (let i = 0; i < 9; i++) {
      const t0 = B + i * .012, q = lin(t0, t0 + .35, w); if (q <= 0 || q >= 1) continue;
      const an = hash1(i * 9.1) * TAU, d = 300 + 260 * E.outCubic(q);
      const x = CX + Math.cos(an) * d * 1.25, y = CY + Math.sin(an) * d * .8, r = (1 - q) * 20;
      o.fillStyle = INK; o.beginPath(); o.moveTo(x, y - r); o.lineTo(x + r * .3, y - r * .3); o.lineTo(x + r, y); o.lineTo(x + r * .3, y + r * .3);
      o.lineTo(x, y + r); o.lineTo(x - r * .3, y + r * .3); o.lineTo(x - r, y); o.lineTo(x - r * .3, y - r * .3); o.closePath(); o.fill();
    }
  }

  function haraka(o, w) {
    // speed lines
    o.fillStyle = 'rgba(244,234,213,.55)';
    for (let i = 0; i < 26; i++) {
      const y = 60 + (i * 41.3) % 960, len = 300 + 900 * hash1(i * 5.1), sp = 6000 + 4000 * hash1(i * 2.2);
      const x = 1920 + 200 - ((w * sp + hash1(i) * 3000) % (3200));
      o.fillRect(x, y, len, 3 + (i % 3) * 2);
    }
    // the word smears across, overshoots, settles
    const pos = t => { const p = E.outExpo(lin(0, .3, t)); return mix(1500, 0, p) - 60 * Math.sin(lin(.30, .46, t) * Math.PI) * 0; };
    const N = 16, span = .09 * (1 - E.outCubic(lin(.12, .34, w)));
    for (let i = N; i >= 0; i--) {
      const t = w - (i / N) * span, x = pos(t);
      o.globalAlpha = i === 0 ? 1 : .09 + .04 * (1 - i / N);
      text(o, 'حركة', CX + x, CY + 20, { font: F.lalezar(470), fill: CREAM, skew: -.28 * (1 - E.outCubic(lin(.15, .42, w))) });
    }
    o.globalAlpha = 1;
    // underline stroke wiping under the word
    o.fillStyle = INK; o.fillRect(CX - 520, 800, 1040 * E.outExpo(lin(.15, .4, w)), 14);
  }

  function iqaa(o, w) {
    const hits = [0, .16, .31];
    let pk = 0; hits.forEach(h => pk = Math.max(pk, pulse(w, h, .07)));
    // rings from each hit
    hits.forEach((h, i) => { const q = lin(h, h + .35, w); if (q > 0 && q < 1) { o.strokeStyle = `rgba(255,182,39,${.7 * (1 - q)})`; o.lineWidth = 8 * (1 - q) + 1; o.beginPath(); o.arc(CX, CY, 220 + 700 * E.outCubic(q), 0, TAU); o.stroke(); } });
    // equaliser
    for (let i = 0; i < 28; i++) {
      const x = 90 + i * 64.5, hgt = 40 + 240 * (0.25 + .75 * hash1(i * 7.7 + Math.floor(w / .05) * 1.3)) * (0.35 + pk);
      o.fillStyle = i % 2 ? CREAM : '#ffb627';
      o.fillRect(x, 1000 - hgt, 40, hgt);
    }
    const sc = 1 + .16 * pk;
    extruded(o, 'إيقاع', CX, CY + 10, { font: F.lalezar(500), fill: '#ffb627', sx: sc, sy: sc, layers: 18, dx: 3.2, dy: 5, mid: '#f4ead5', back: '#0d0d70' });
  }

  function lawn(o, w) {
    const cols = ['#ff2e6e', '#19e3d0', '#2a2cff', CREAM, '#0b0d1a'];
    cols.forEach((c, i) => { const q = E.outCubic(clamp(lin(0, .16, w) * 1.5 - i * .12)); o.fillStyle = c; o.fillRect(i * 384, 0, 385, 1080 * q); });
    o.save(); o.globalCompositeOperation = 'difference';
    text(o, 'لون', CX, CY + 25, { font: F.lalezar(600), fill: '#ffffff', sx: 1 + .05 * pulse(w, 0, .1), sy: 1 + .05 * pulse(w, 0, .1) });
    o.restore();
  }

  function omq(o, w) {
    // perspective grid rushing toward the horizon
    const hz = 560;
    o.strokeStyle = 'rgba(25,227,208,.55)'; o.lineWidth = 2;
    for (let i = -14; i <= 14; i++) { o.beginPath(); o.moveTo(CX + i * 40, hz); o.lineTo(CX + i * 340, 1100); o.stroke(); }
    for (let j = 0; j < 12; j++) {
      const q = (j / 12 + w * 3) % 1, y = hz + (1100 - hz) * q * q;
      o.beginPath(); o.moveTo(0, y); o.lineTo(1920, y); o.globalAlpha = .25 + .6 * q; o.stroke(); o.globalAlpha = 1;
    }
    // true perspective extrusion: each layer shrinks toward the vanishing point
    const N = 46, depth = .0075 + .004 * Math.sin(w * 18);
    for (let i = N; i >= 1; i--) {
      const s = 1 - depth * i, k = i / N;
      text(o, 'عمق', CX + (CX - CX) * 0, CY + 30 + (CY - 300) * (1 - s) * 0, {
        font: F.lalezar(560), fill: lerpHex('#19e3d0', '#020a12', Math.pow(k, .7)), sx: s, sy: s, alpha: 1,
      });
    }
    text(o, 'عمق', CX, CY + 30, { font: F.lalezar(560), fill: '#e9fffb', sx: 1 + .05 * E.outCubic(lin(0, .2, w)), sy: 1 + .05 * E.outCubic(lin(0, .2, w)) });
  }

  function zaman(o, w) {
    // the time-echo: ghosts trail behind and rewind
    const N = 9;
    for (let i = N; i >= 1; i--) {
      const q = i / N, dx = Math.sin(w * 6 - q * 3) * 90 * q, sc = 1 + .05 * i;
      text(o, 'زمن', CX + dx, CY + 20, { font: F.lalezar(520), fill: 'rgba(0,0,0,0)', stroke: [rgba('#ff2e88', .55 * (1 - q)), 3], sx: sc, sy: sc });
    }
    text(o, 'زمن', CX, CY + 20, { font: F.lalezar(520), fill: CREAM });
    // a stopwatch ring whose hand spins fast and slows (foreshadowing the slow-mo)
    const R = 430, cy = CY + 10;
    o.save(); o.strokeStyle = 'rgba(244,234,213,.75)'; o.lineWidth = 3;
    o.beginPath(); o.arc(CX, cy, R, 0, TAU); o.stroke();
    for (let i = 0; i < 60; i++) { const an = i / 60 * TAU - Math.PI / 2, l = i % 5 ? 12 : 28; o.beginPath(); o.moveTo(CX + Math.cos(an) * (R - l), cy + Math.sin(an) * (R - l)); o.lineTo(CX + Math.cos(an) * R, cy + Math.sin(an) * R); o.stroke(); }
    const hand = (1 - Math.exp(-w * 5.2)) * TAU * 2.2 - Math.PI / 2;
    o.strokeStyle = '#ff2e88'; o.lineWidth = 6; o.lineCap = 'round';
    o.beginPath(); o.moveTo(CX, cy); o.lineTo(CX + Math.cos(hand) * (R - 8), cy + Math.sin(hand) * (R - 8)); o.stroke();
    o.fillStyle = '#ff2e88'; o.beginPath(); o.arc(CX, cy, 12, 0, TAU); o.fill();
    o.restore();
  }
  const PERF = [fikra, haraka, iqaa, lawn, omq, zaman];

  registerScene(3, {
    trans: { dur: 0.30, type: 1 },
    render(c) {
      const { lt: w0, o, fx } = c;
      const w = Math.max(w0, 0);
      fx.bloom = Math.min(fx.bloom, .16); fx.thresh = .95; fx.streak = 0; fx.vig = .12; fx.grain = .02;

      let ci = 0; while (ci < CARDS.length - 1 && w >= CARDS[ci].t1) ci++;
      const inStrobe = w >= 6 * B;
      let flashA = 0, shakeA = 0;

      if (!inStrobe) {
        const cd = CARDS[ci], lw = w - cd.t0;
        const prev = ci ? CARDS[ci - 1].bg : cd.bg;
        wipeIn(o, ci, prev, cd.bg, ci ? lin(0, .12, lw) : 1);
        o.save();
        const sh = 14 * pulse(lw, 0, .09);
        o.translate(sh * Math.sin(w * 300), sh * Math.cos(w * 250));
        PERF[ci](o, lw);
        o.restore();
        frame(o, cd.fg, ci + 1, ci === 3 || ci === 4 ? .6 : .8);
        flashA = .35 * pulse(lw, 0, .05);
        fx.ca += .004 * pulse(lw, 0, .12);
      } else {
        // ¼-beat strobe: black/white/colour inversions with glitch
        const q = (w - 6 * B) / (B / 4), k = Math.min(7, Math.floor(q)), lk = (q - k) * (B / 4);
        const [bg, fg] = STROBE_COL[k];
        o.fillStyle = bg; o.fillRect(0, 0, 1920, 1080);
        const jx = (hash1(k * 7.7) - .5) * 120 * pulse(lk, 0, .04), jr = (hash1(k * 3.1) - .5) * .06;
        const sz = 560 + 90 * (k % 3);
        text(o, STROBE[k], CX + jx, CY + 20, { font: F.kufi(sz, 900), fill: fg, rot: jr, sx: 1 + .12 * pulse(lk, 0, .05), sy: 1 + .12 * pulse(lk, 0, .05) });
        // slice offsets
        o.globalCompositeOperation = 'difference'; o.fillStyle = '#fff';
        if (hash1(k * 2.2) > .4) o.fillRect(0, 300 + hash1(k) * 400, 1920, 40 * pulse(lk, 0, .04));
        o.globalCompositeOperation = 'source-over';
        fx.glitch = .22 + .3 * pulse(lk, 0, .05); fx.ca += .008;
        frame(o, fg, 6, .5);
        flashA = .25 * pulse(lk, 0, .03);
      }
      if (flashA > .01) { o.fillStyle = `rgba(255,255,255,${flashA})`; o.fillRect(0, 0, 1920, 1080); }
      // final whip toward chapter 5
      const endk = lin(3.55, 3.75, w);
      fx.zoomBlur += .18 * endk; fx.ca += .01 * endk;
    },
  });
})();
