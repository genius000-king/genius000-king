'use strict';
// ══════════════════════════════════════════════════════════════
//  ١ · نقطة — a heartbeat, a line, a compass-drawn circle.
//  In Arabic calligraphy the dot is the unit that measures every letter.
// ══════════════════════════════════════════════════════════════
(() => {
  const bg = frag(`
    uniform float uPulse;
    void main(){
      vec3 c=bgVoid(vUv,uT,vec3(.55,.65,1.),1.);
      vec2 p=(vUv-.5)*vec2(uRes.x/uRes.y,1.);
      c+=vec3(1.,.72,.3)*.10*uPulse*exp(-length(p)*5.);
      fragColor=vec4(c,1.);
    }`, 's1.bg');

  // heart: lub-dub pairs on the beat grid (matches the sub-bass in the music)
  const B = TL.BEAT;
  const HB = [[1 * B, 1], [1 * B + B / 2, .55], [3 * B, 1], [3 * B + B / 2, .55], [5 * B, 1], [5 * B + B / 2, .55], [7 * B, .8]];
  const heart = t => HB.reduce((s, [e, a]) => s + a * pulse(t, e, .11), 0);

  const R_END = 300;                     // circle radius handed to chapter 2
  const cx = 960, cy = 540;

  registerScene(0, {
    render(c) {
      const { lt, o, a, run, tgt, fx } = c;
      const hb = heart(lt);
      run(bg, tgt, { uT: lt, uPulse: hb });

      // ── the point ────────────────────────────────────────
      const pop = spring(lt - 0.40, 24, 0.55);
      const r = 5.5 * pop * (1 + 0.9 * hb);
      const gr = (90 + 140 * hb) * pop;
      if (pop > 0) {
        glowDot(a, cx, cy, gr, [255, 190, 100], .55 + .45 * Math.min(1, hb));
        o.fillStyle = '#fff'; o.beginPath(); o.arc(cx, cy, r, 0, TAU); o.fill();
      }
      // heartbeat ripples
      for (const [e, amp] of HB) {
        const d = lt - e; if (d < 0 || d > 1.5 || amp < .7) continue;
        const k = d / 1.5;
        a.strokeStyle = `rgba(255,214,150,${.55 * (1 - k) * (1 - k)})`;
        a.lineWidth = 2 * (1 - k) + .6;
        a.beginPath(); a.arc(cx, cy, 30 + 620 * E.outExpo(k), 0, TAU); a.stroke();
      }

      // ── caption (right → left reveal, like reading) ────────
      const capIn = E.outCubic(lin(1.0, 1.8, lt)), capOut = 1 - sstep(2.05, 2.4, lt);
      if (capIn > 0 && capOut > 0) {
        const w = 640;
        o.save(); o.beginPath(); o.rect(cx + w / 2 - w * capIn, 690, w * capIn + 2, 150); o.clip();
        text(o, 'كل شيء يبدأ بنقطة', cx, 770 - (1 - capIn) * 12,
          { font: F.ruqaa(64, 700), fill: C.cream, alpha: capOut * .95 });
        o.restore();
      }

      // ── the line: point → horizon ─────────────────────────
      const lp = E.inExpo(lin(2.15, 2.78, lt));
      const shrink = E.outExpo(lin(2.80, 3.12, lt));
      let half = 26 + 1040 * lp;
      half = mix(half, R_END * 0.57, shrink);                 // collapses onto the future diameter
      const lineA = lt < 2.15 ? 0 : 1;
      if (lineA && lt < 3.3) {
        const grad = a.createLinearGradient(cx - half, 0, cx + half, 0);
        grad.addColorStop(0, 'rgba(255,190,90,0)'); grad.addColorStop(.5, 'rgba(255,255,255,1)'); grad.addColorStop(1, 'rgba(255,190,90,0)');
        a.strokeStyle = grad;
        for (const [w, al] of [[22, .08], [9, .18], [3.6, .85], [1.6, 1]]) {
          a.globalAlpha = al * (0.4 + 0.6 * lp); a.lineWidth = w;
          a.beginPath(); a.moveTo(cx - half, cy); a.lineTo(cx + half, cy); a.stroke();
        }
        a.globalAlpha = 1;
        // sparks shed along the line
        for (let i = 0; i < 46; i++) {
          const h1 = hash1(i * 3.1), h2 = hash1(i * 7.7), h3 = hash1(i * 1.9);
          const px = cx + (h1 * 2 - 1) * half, py = cy + (h2 - .5) * 34 * lp - lin(0, 1, lt - 2.4) * 40 * (h3 - .5) * 3;
          a.fillStyle = `rgba(255,220,160,${.8 * lp * h3 * (1 - shrink)})`;
          a.fillRect(px, py, 1.8, 1.8);
        }
      }
      fx.streak = 1.5 * lp * (1 - sstep(3.0, 3.4, lt));
      fx.bloom += 0.25 * lp;

      // ── the circle (compass) ──────────────────────────────
      const ang = E.inOutCubic(lin(2.95, 3.5, lt)) * TAU;
      const grow = E.outBack(lin(3.35, 3.72, lt));
      const R = mix(170, R_END, grow);
      if (lt > 2.95) {
        const path = () => { a.beginPath(); a.arc(cx, cy, R, 0, ang); };
        glowStroke(a, path, [255, 190, 90], 2.4, 1);
        // the compass arm sweeping around
        if (ang < TAU - .01) {
          const tx = cx + R * Math.cos(ang), ty = cy + R * Math.sin(ang);
          a.strokeStyle = 'rgba(255,240,210,.55)'; a.lineWidth = 1.4;
          a.beginPath(); a.moveTo(cx, cy); a.lineTo(tx, ty); a.stroke();
          glowDot(a, tx, ty, 26, [255, 200, 120], 1);
        } else {
          // circle closed: a soft ring flash
          const k = lin(3.5, 3.75, lt);
          a.strokeStyle = `rgba(255,230,180,${.5 * (1 - k)})`; a.lineWidth = 3;
          a.beginPath(); a.arc(cx, cy, R * (1 + .08 * k), 0, TAU); a.stroke();
        }
        // diameter line (persists into chapter 2)
        if (lt > 3.1) {
          const d = () => { a.beginPath(); a.moveTo(cx - R, cy); a.lineTo(cx + R, cy); };
          glowStroke(a, d, [255, 190, 90], 1.4, .85 * sstep(3.1, 3.4, lt));
        }
      }
    },
  });
})();
