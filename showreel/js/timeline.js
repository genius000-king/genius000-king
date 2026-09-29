'use strict';
// ─────────────────────────────────────────────────────────────
//  Timeline: the single source of truth shared by picture and sound.
//  128 BPM → one bar = 1.875 s → 16 bars = exactly 30 s.
// ─────────────────────────────────────────────────────────────
const TL = (() => {
  const BPM = 128, BEAT = 60 / BPM, BAR = BEAT * 4, DUR = 30, FPS = 60;

  // Chapters — each one is a transformation of the previous.
  const chapters = [
    { id: 'point',    ar: 'نقطة',   t0: 0 * BAR },
    { id: 'geometry', ar: 'هندسة',  t0: 2 * BAR },
    { id: 'depth',    ar: 'عمق',    t0: 4 * BAR },
    { id: 'letter',   ar: 'حرف',    t0: 6 * BAR },
    { id: 'morph',    ar: 'تحوّل',  t0: 8 * BAR },
    { id: 'time',     ar: 'زمن',    t0: 10 * BAR },
    { id: 'speed',    ar: 'سرعة',   t0: 12 * BAR },
    { id: 'world',    ar: 'عالم',   t0: 14 * BAR },
  ];
  chapters.forEach((c, i) => { c.t1 = i < chapters.length - 1 ? chapters[i + 1].t0 : DUR; c.i = i; });

  // ── Time-warp for the "Time" chapter (local seconds u ∈ [0, 3.75]) ──
  // τ(u): burst → slow-motion → near-freeze → rewind (accelerating) → snap back to 0.
  const TW = { dur: 2 * BAR, ur: 2.30, A: 3.0, k: 0.28, creep: 0.055 };
  function tau(u) {
    if (u <= 0) return 0;
    const fwd = x => TW.A * (1 - Math.exp(-x / TW.k)) + TW.creep * x;
    if (u <= TW.ur) return fwd(u);
    const top = fwd(TW.ur);
    const s = Math.min(1, (u - TW.ur) / (TW.dur - TW.ur));
    return top * (1 - Math.pow(s, 2.35));
  }
  function tauSpeed(u) { const h = 1e-4; return (tau(u + h) - tau(u - h)) / (2 * h); }

  // Impact moments (seconds, amplitude 0..1) → flash / shake / aberration; audio hits too.
  const impacts = [
    { t: 0.469, a: 0.25 }, { t: 3.75, a: 0.55 }, { t: 7.5, a: 1.0 }, { t: 11.25, a: 0.7 },
    { t: 15.0, a: 0.8 }, { t: 18.75, a: 1.0 }, { t: 22.5, a: 1.0 }, { t: 26.25, a: 0.7 },
  ];

  // Finale schedule (local seconds inside chapter 8) — the score hits exactly these.
  const finale = {
    heart: [1 * BEAT, 1.5 * BEAT],
    lines: [1.75 * BEAT, 2.5 * BEAT, 3.25 * BEAT],
    implode: 5.3 * BEAT, mark: 5.5 * BEAT, tag: 5.9 * BEAT, sub: 6.5 * BEAT,
  };

  return { BPM, BEAT, BAR, DUR, FPS, chapters, tau, tauSpeed, TW, impacts, finale };
})();

if (typeof module !== 'undefined') module.exports = TL;
