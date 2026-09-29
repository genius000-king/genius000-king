'use strict';
// ══════════════════════════════════════════════════════════════
//  ٨ · عالم — everything is inhaled back into the very first dot.
//  One breath of silence, then the dot exhales the reveal, letter by letter:
//      الفكرة أولًا.   ثم الحركة.   ثم الدهشة.   —   then the signature.
//  The words are ~8 000 particles that fly out of the dot and lock into the type.
// ══════════════════════════════════════════════════════════════
(() => {
  const B = TL.BEAT;
  const bg = frag(`
    uniform float uGlow, uPulse;
    void main(){
      vec3 c=bgVoid(vUv,uT*.5,vec3(1.,.78,.45),.7);
      vec2 p=(vUv-.5)*vec2(uRes.x/uRes.y,1.);
      c+=vec3(1.,.62,.22)*exp(-length(p*vec2(.8,1.3))*3.2)*uGlow*.28;
      c+=vec3(1.,.8,.5)*exp(-length(p)*9.)*uPulse*.5;
      fragColor=vec4(c,1.);
    }`, 's8.bg');

  // statements: text, font, y, colour, appear time, hold-until time
  const FN = TL.finale;
  const LINES = [
    { s: 'الفكرة أولًا',    font: F.kufi(200, 900), y: 330, col: [244, 234, 213], t0: FN.lines[0], t1: FN.implode, fly: .55 },
    { s: 'ثم الحركة',    font: F.kufi(200, 900), y: 545, col: [244, 234, 213], t0: FN.lines[1], t1: FN.implode, fly: .55 },
    { s: 'ثم الدهشة',  font: F.kufi(250, 900), y: 790, col: [255, 196, 84],  t0: FN.lines[2], t1: FN.implode, fly: .55 },
    { s: 'Claude',       font: F.unb(190, 900),  y: 470, col: [244, 234, 213], t0: FN.mark, t1: 99, fly: .36, dir: 'ltr' },
    { s: 'مصمم حركة',   font: F.ruqaa(96, 700), y: 660, col: [255, 182, 39],  t0: FN.tag,  t1: 99, fly: .34 },
  ];
  let PARTS = null;

  function build() {
    const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080;
    const x = cv.getContext('2d', { willReadFrequently: true });
    const R = rng(777);
    PARTS = LINES.map((L, li) => {
      x.clearRect(0, 0, 1920, 1080);
      text(x, L.s, 960, L.y, { font: L.font, fill: '#fff', dir: L.dir || 'rtl' });
      const d = x.getImageData(0, 0, 1920, 1080).data;
      const step = li < 3 ? 4 : 3, pts = [];
      for (let py = 0; py < 1080; py += step) for (let px = 0; px < 1920; px += step) {
        if (d[(py * 1920 + px) * 4 + 3] > 128) pts.push(px + (R() - .5) * step, py + (R() - .5) * step);
      }
      const n = pts.length / 2, arr = new Float32Array(n * 6);
      for (let i = 0; i < n; i++) {
        const an = R() * TAU, rad = 160 + 720 * R();
        arr.set([pts[i * 2], pts[i * 2 + 1], 960 + Math.cos(an) * rad, 540 + Math.sin(an) * rad * .7, R() * .32, .8 + R() * 2.0], i * 6);
      }
      return arr;
    });
  }

  
  registerScene(7, {
    trans: { dur: 0.0, type: 4 },
    render(c) {
      const { lt: q0, o, a, fx } = c;
      if (!PARTS) build();
      const q = Math.max(q0, 0);
      const cx = 960, cy = 540;

      // background breathes with the words
      const anyLine = LINES.some(L => q > L.t0);
      const glow = sstep(FN.lines[0], FN.lines[2] + .3, q);
      c.run(bg, c.tgt, { uT: q, uGlow: glow, uPulse: FN.lines.reduce((a2, t0) => a2 + pulse(q, t0 + .3, .1), 0) + pulse(q, FN.mark + .3, .14) });

      // ── inhale: the last light shrinks into the dot ──
      const inh = E.inOutCubic(lin(0, .9 * B, q));
      const dotR = mix(150, 4.5, inh);
      const dotA = 1 - sstep(7.75 * B, 7.98 * B, q) * 0;
      if (q < FN.lines[0] + .25) {
        const hb = pulse(q, FN.heart[0], .11) * 1.4 + pulse(q, FN.heart[1], .11) * .7;
        const vis = 1 - sstep(FN.lines[0], FN.lines[0] + .22, q);
        glowDot(a, cx, cy, (dotR * 4 + 40 * hb + 30) * (0.6 + 0.4 * vis), [255, 190, 100], .8 * vis);
        o.fillStyle = '#fff'; o.globalAlpha = vis; o.beginPath(); o.arc(cx, cy, Math.max(dotR, 4.5) * (1 + .9 * hb) * .5 + 3, 0, TAU); o.fill(); o.globalAlpha = 1;
        // heartbeat ripple (echoes chapter 1)
        const d = q - FN.heart[0];
        if (d > 0 && d < 1.3) {
          const k = d / 1.3;
          a.strokeStyle = `rgba(255,214,150,${.55 * (1 - k) * (1 - k)})`; a.lineWidth = 2;
          a.beginPath(); a.arc(cx, cy, 30 + 700 * E.outExpo(k), 0, TAU); a.stroke();
        }
      }

      // ── particle type ──
      LINES.forEach((L, li) => {
        const arr = PARTS[li], n = arr.length / 6;
        const tin = q - L.t0, tout = q - L.t1;
        if (tin < 0) return;
        const flyDur = L.fly;
        const [r, g, b] = L.col;
        const outK = tout > 0 ? E.inCubic(clamp(tout / .32)) : 0;       // implode back into the dot
        const settled = lin(flyDur * .95, flyDur * 1.5, tin) * (1 - lin(0, .12, tout));
        // particles (additive)
        if (settled < 1 || tout > 0) {
          for (let i = 0; i < n; i++) {
            const tx = arr[i * 6], ty = arr[i * 6 + 1], sx = arr[i * 6 + 2], sy = arr[i * 6 + 3], dl = arr[i * 6 + 4], sz = arr[i * 6 + 5];
            let p = E.outCubic(clamp((tin - dl * .8) / flyDur));
            if (tout > 0) p = p * (1 - clamp((tout - dl * .3) / .32));
            if (p <= 0.001) continue;
            // curve through a swirl control point
            const mx = mix(sx, cx, .5) + (ty - cy) * .12, my = mix(sy, cy, .5) - (tx - cx) * .12;
            const u1 = 1 - p;
            const px = u1 * u1 * cx + 2 * u1 * p * mx * 0 + 2 * u1 * p * (sx * .5 + tx * .5 + (ty - cy) * .15) + p * p * tx;
            const py = u1 * u1 * cy + 2 * u1 * p * (sy * .5 + ty * .5 - (tx - cx) * .10) + p * p * ty;
            const al = (1 - settled) * (.55 + .45 * p);
            if (al < .02) continue;
            a.fillStyle = `rgba(${Math.min(255, r + 30)},${Math.min(255, g + 50)},${Math.min(255, b + 80)},${al})`;
            a.fillRect(px, py, sz, sz);
          }
        }
        // crisp type fades in as the particles lock
        const crisp = settled * (tout > 0 ? 1 - E.inCubic(clamp(tout / .2)) : 1);
        if (crisp > .01) {
          const pop = 1 + .04 * pulse(tin, flyDur * 1.1, .12);
          text(o, L.s, cx, L.y, { font: L.font, fill: `rgba(${r},${g},${b},${crisp})`, dir: L.dir || 'rtl', sx: pop, sy: pop, shadow: [`rgba(${r},${g},${b},${.45 * crisp})`, 32] });
        }
        // underline stroke on the gold line
        if (li === 2 && crisp > .05) {
          const k = E.outExpo(lin(flyDur * 1.1, flyDur * 1.9, tin));
          a.fillStyle = `rgba(255,190,90,${crisp})`; a.fillRect(cx - 420 * k, 905, 840 * k, 5);
        }
      });

      // thin gold rule that draws itself between the name and the tagline
      const rk = E.outExpo(lin(FN.tag + .1, FN.tag + .7, q));
      if (rk > 0) { a.fillStyle = `rgba(255,190,90,${.9})`; a.fillRect(cx - 220 * rk, 583, 440 * rk, 2.5); }

      // shockwave on each statement + final collapse flash
      for (const L of LINES) {
        const d = q - L.t0; if (d < 0 || d > .7) continue;
        const k = d / .7;
        a.strokeStyle = `rgba(255,220,160,${.42 * (1 - k) * (1 - k)})`; a.lineWidth = 2;
        a.beginPath(); a.arc(cx, cy, 80 + 900 * E.outExpo(k), 0, TAU); a.stroke();
      }
      fx.fade = sstep(3.62, 3.75, q);
      fx.bloom += .2 + .4 * pulse(q, 3 * B, .15);
      fx.streak = .3 * glow;
      fx.vig = .5;
    },
  });
})();
