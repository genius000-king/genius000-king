'use strict';
// ─────────────────────────────────────────────────────────────
//  HUD — the "showreel" chrome: chapter marker, timecode, progress hairline.
//  Colours adapt per chapter so it always reads.
// ─────────────────────────────────────────────────────────────
const HUD_STYLE = [
  { col: C.cream, a: .0 },   // 0 point   (kept silent: let the dot breathe)
  { col: C.gold2, a: .75 },  // 1 geometry
  { col: C.gold2, a: .8 },   // 2 depth
  { col: C.ink,   a: .0 },   // 3 letter  (flat colour cards carry their own labels)
  { col: C.cream, a: .75 },  // 4 morph
  { col: C.cream, a: .8 },   // 5 time
  { col: C.cream, a: .85 },  // 6 speed
  { col: C.gold2, a: .0 },   // 7 world
];

function drawHud(x, t, fx) {
  const chs = TL.chapters;
  let ci = chs.findIndex(c => t >= c.t0 && t < c.t1); if (ci < 0) ci = chs.length - 1;
  const ch = chs[ci], lt = t - ch.t0;
  const st = HUD_STYLE[ci];

  // progress hairline along the bottom
  const prog = clamp(t / TL.DUR);
  const inFinale = ci === 7;
  const barA = inFinale ? 0.9 * (1 - sstep(27.2, 27.6, t)) : 0.55;
  x.save();
  x.globalAlpha = barA * (ci === 3 ? 0.8 : 1);
  x.fillStyle = ci === 3 ? C.ink : 'rgba(255,255,255,.14)';
  x.fillRect(60, 1030, 1800, 2);
  x.fillStyle = ci === 3 ? C.ink : C.gold;
  x.fillRect(60, 1030, 1800 * prog, 2);
  // chapter ticks on the hairline
  for (const c of chs) {
    const px = 60 + 1800 * (c.t0 / TL.DUR);
    x.fillStyle = ci === 3 ? C.ink : (t >= c.t0 ? C.gold : 'rgba(255,255,255,.35)');
    x.fillRect(px - 1, 1024, 2, 14);
  }
  x.restore();

  if (st.a <= 0) return;
  // fade the chapter label in on entry, out near the end of chapter
  const inA = sstep(0.1, 0.5, lt) * (1 - sstep(ch.t1 - 0.35, ch.t1 - 0.05, t));
  x.save(); x.globalAlpha = st.a * inA;

  // chapter number + name (top right in RTL reading order)
  const num = AR(String(ch.i + 1).padStart(2, '0'));
  const slide = (1 - E.outExpo(clamp(lt / 0.6))) * 40;
  text(x, num, 1860 - slide, 78, { font: F.reem(30, 700), fill: C.gold, align: 'right' });
  text(x, ch.ar, 1810 - slide, 78, { font: F.reem(30, 700), fill: st.col, align: 'right' });
  x.fillStyle = st.col; x.globalAlpha = st.a * inA * .5;
  x.fillRect(1860 - 220 - slide, 104, 220, 1.5);
  x.globalAlpha = st.a * inA;

  // timecode (top left) in Arabic-Indic digits
  const s = Math.floor(t), fr = Math.floor((t - s) * 60);
  const tc = AR(`${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String(fr).padStart(2, '0')}`);
  text(x, tc, 60, 78, { font: F.reem(24, 400), fill: st.col, align: 'left', dir: 'ltr', alpha: .8 });
  text(x, '٦٠ إطارًا / ثانية', 60, 108, { font: F.ruqaa(22, 400), fill: st.col, align: 'left', alpha: .55 });
  x.restore();
}
