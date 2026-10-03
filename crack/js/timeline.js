'use strict';
// ─────────────────────────────────────────────────────────────
//  «الشق» — 60 s = 32 bars @ 128 BPM. One timeline for picture and sound.
// ─────────────────────────────────────────────────────────────
const TL = (() => {
  const BPM = 128, BEAT = 60 / BPM, BAR = BEAT * 4, DUR = 60, FPS = 60;
  // eight sections of four bars each
  const sections = [
    { id: 'void',    ar: 'الفراغ',  t0: 0 * BAR },
    { id: 'lattice', ar: 'الداخل',  t0: 4 * BAR },
    { id: 'split',   ar: 'الانقسام', t0: 8 * BAR },
    { id: 'dragon',  ar: 'التنين',  t0: 12 * BAR },
    { id: 'castle',  ar: 'القلعة',  t0: 16 * BAR },
    { id: 'rival',   ar: 'الخصم',   t0: 20 * BAR },
    { id: 'clash',   ar: 'الصدام',  t0: 24 * BAR },
    { id: 'unity',   ar: 'الوحدة',  t0: 28 * BAR },
  ];
  sections.forEach((c, i) => { c.i = i; c.t1 = i < sections.length - 1 ? sections[i + 1].t0 : DUR; });
  // the engine runs one continuous scene
  const chapters = [{ id: 'film', ar: 'الشق', t0: 0, t1: DUR, i: 0 }];
  const impacts = [];            // filled by the director (flash / shake / aberration)
  return { BPM, BEAT, BAR, DUR, FPS, sections, chapters, impacts };
})();
if (typeof module !== 'undefined') module.exports = TL;
