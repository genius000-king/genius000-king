'use strict';
// ══════════════════════════════════════════════════════════════
//  ٢ · هندسة — the circle becomes an 8-pointed star (ربع الحزب) by
//  compass & straightedge, then multiplies into a lattice while the camera
//  pulls back and tilts into 3-D. The 2D overlay lives in the same world units
//  as the shader plane (S = px per unit), so the hand-off is pixel-exact.
// ══════════════════════════════════════════════════════════════
const S2 = (() => {
  const B = TL.BEAT, S0 = 300, S1 = 118;
  const HAND = { pitch0: Math.PI / 2 - 0.0008 };

  // camera as a function of local time (also read by chapter 3 to continue seamlessly)
  function cam(u) {
    const z = E.inOutCubic(lin(1.875, 3.3, u));
    const S = S0 * Math.pow(S1 / S0, z);
    const tilt = E.inOutCubic(lin(2.1, 3.75, u));
    const pitch = HAND.pitch0 - 0.80 * tilt;
    const yaw = 0.0 + 0.10 * tilt;
    return { S, dist: cityDistFor(S), pitch, yaw, roll: 0.03 * tilt };
  }

  const PT = k => [Math.cos(k * Math.PI / 4), Math.sin(k * Math.PI / 4)];
  const sqA = [0, 2, 4, 6], sqB = [1, 3, 5, 7];
  // outline of the union of both squares (tips r=1, notches r=.7654)
  const OUT = [];
  for (let k = 0; k < 8; k++) {
    const t = k * Math.PI / 4, n = t + Math.PI / 8;
    OUT.push([Math.cos(t), Math.sin(t)], [.7654 * Math.cos(n), .7654 * Math.sin(n)]);
  }

  registerScene(1, {
    trans: { dur: 0, type: 4 },
    render(c) {
      const { lt: u, o, a, fx } = c;
      const cm = cam(u);
      const S = cm.S;
      const revealT = Math.max(0, u - 1.875);
      runCity(c, {
        dist: cm.dist, pitch: cm.pitch, yaw: cm.yaw, roll: cm.roll,
        reveal: revealT * 14 + 60 * sstep(3.0, 3.4, u), centerOn: sstep(1.875, 2.15, u), rise: -1, kick: u > 1.875 ? 1 : 0.0,
        bgMix: 1 - sstep(1.9, 3.0, u), warm: 0.55, fog: 0.02, expo: 1,
      });

      // ── overlay: only while the camera is (nearly) top-down ──
      const overlayA = 1 - sstep(1.9, 2.25, u);
      const W2S = (x, z) => [960 + x * S, 540 + z * S];
      const cx = 960, cy = 540, R = S;

      // circle + diameter (continuation of chapter 1)
      const ringA = (0.95 - 0.55 * sstep(1.7, 2.0, u)) * overlayA;
      if (ringA > 0.01) {
        glowStroke(a, () => { a.beginPath(); a.arc(cx, cy, R, 0, TAU); }, [255, 190, 90], 2.4, ringA);
        const dl = () => { a.beginPath(); a.moveTo(cx - R, cy); a.lineTo(cx + R, cy); };
        glowStroke(a, dl, [255, 190, 90], 1.4, .85 * (1 - sstep(.9, 1.6, u)));
      }
      // centre dot
      glowDot(a, cx, cy, 60 * (1 + .7 * pulse(u, 1.875, .2)), [255, 190, 100], .8 * overlayA);
      o.fillStyle = '#fff'; o.globalAlpha = overlayA; o.beginPath(); o.arc(cx, cy, 5, 0, TAU); o.fill(); o.globalAlpha = 1;

      // eight points, one 16th-note apart
      for (let k = 0; k < 8; k++) {
        const tk = k * B / 4, p = spring(u - tk, 26, .5);
        if (p <= 0) continue;
        const [px, py] = W2S(...PT(k));
        glowDot(a, px, py, 34 * p, [255, 200, 120], .9 * overlayA);
        o.globalAlpha = overlayA; o.fillStyle = '#fff'; o.beginPath(); o.arc(px, py, 6.5 * p, 0, TAU); o.fill(); o.globalAlpha = 1;
        // ping ring
        const d = u - tk;
        if (d < .5) { a.strokeStyle = `rgba(255,220,160,${.7 * (1 - d / .5) * overlayA})`; a.lineWidth = 1.5; a.beginPath(); a.arc(px, py, 10 + 60 * E.outCubic(d / .5), 0, TAU); a.stroke(); }
      }

      // the two squares, edge by edge (16th notes), then the star flashes
      const edges = [];
      [sqA, sqB].forEach((sq, si) => sq.forEach((k, i) => edges.push([k, sq[(i + 1) % 4], si])));
      edges.forEach(([k0, k1, si], ei) => {
        const t0 = 2 * B + ei * (B / 4);          // 0.9375 → 1.875
        const p = E.outCubic(lin(t0, t0 + B / 4 * 0.95, u));
        if (p <= 0) return;
        const p0 = W2S(...PT(k0)), p1 = W2S(...PT(k1));
        const path = () => { a.beginPath(); a.moveTo(p0[0], p0[1]); a.lineTo(p0[0] + (p1[0] - p0[0]) * p, p0[1] + (p1[1] - p0[1]) * p); };
        glowStroke(a, path, si ? [90, 240, 220] : [255, 190, 90], 2.6, overlayA);
        if (p < 1) { const tx = p0[0] + (p1[0] - p0[0]) * p, ty = p0[1] + (p1[1] - p0[1]) * p; glowDot(a, tx, ty, 34, si ? [120, 255, 235] : [255, 210, 130], overlayA); }
        else {
          // little spark burst as the edge lands
          const d = u - (t0 + B / 4 * .95);
          if (d < .35) for (let j = 0; j < 7; j++) {
            const an = hash1(ei * 9 + j) * TAU, sp = 40 + 90 * hash1(ei * 5 + j * 3);
            const px = p1[0] + Math.cos(an) * sp * E.outCubic(d / .35), py = p1[1] + Math.sin(an) * sp * E.outCubic(d / .35);
            a.fillStyle = `rgba(255,235,190,${(1 - d / .35) * .9 * overlayA})`; a.fillRect(px, py, 2.2, 2.2);
          }
        }
      });

      // completion: fill + inner ring + shockwave
      const done = u - 4 * B;
      if (done > -0.02) {
        const k = lin(0, .5, done);
        const g = a.createRadialGradient(cx, cy, 0, cx, cy, R);
        g.addColorStop(0, `rgba(255,220,150,${.30 * overlayA * (1 - k * .6)})`); g.addColorStop(1, `rgba(255,150,60,${.08 * overlayA})`);
        a.fillStyle = g; a.beginPath();
        OUT.forEach(([x, z], i) => { const [px, py] = W2S(x, z); i ? a.lineTo(px, py) : a.moveTo(px, py); });
        a.closePath(); a.fill();
        // inner ring draws itself
        const ir = E.outCubic(lin(0, .35, done));
        glowStroke(a, () => { a.beginPath(); a.arc(cx, cy, R * .30, -Math.PI / 2, -Math.PI / 2 + TAU * ir); }, [255, 210, 130], 2, overlayA);
        // shockwave
        if (done < 1.0) {
          const kk = done / 1.0;
          a.strokeStyle = `rgba(255,230,180,${.8 * (1 - kk) * (1 - kk)})`; a.lineWidth = 3 * (1 - kk) + 1;
          a.beginPath(); a.arc(cx, cy, R * (1 + 6 * E.outExpo(kk)), 0, TAU); a.stroke();
        }
        fx.bloom += .5 * pulse(u, 4 * B, .15);
      }

      // caption
      const capIn = E.outCubic(lin(.35, 1.0, u)), capOut = 1 - sstep(2.0, 2.4, u);
      if (capIn > 0 && capOut > 0) {
        const w = 560;
        o.save(); o.beginPath(); o.rect(960 + w / 2 - w * capIn, 900, w * capIn + 2, 110); o.clip();
        text(o, 'ثم صار الفراغ شكلًا', 960, 950, { font: F.ruqaa(56, 700), fill: C.cream, alpha: capOut * .92 });
        o.restore();
      }
      // pre-drop tension: the lattice whitens in the last eighth
      const dip = sstep(3.60, 3.68, u) * (1 - sstep(3.76, 3.80, u));
      fx.fade = Math.max(fx.fade, .92 * dip);
      const tens = sstep(3.35, 3.60, u);
      fx.exposure = 1 + .08 * tens; fx.ca += .003 * tens;
      fx.bloom += .3 * tens;
    },
  });
  return { cam };
})();
