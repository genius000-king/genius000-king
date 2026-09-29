'use strict';
// ── math / easing helpers ─────────────────────────────────────
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const mix = (a, b, t) => a + (b - a) * t;
const lin = (a, b, x) => clamp((x - a) / (b - a));            // normalized progress
const sstep = (a, b, x) => { x = lin(a, b, x); return x * x * (3 - 2 * x); };
const TAU = Math.PI * 2;
const E = {
  inQuad: t => t * t, outQuad: t => 1 - (1 - t) * (1 - t),
  inOutQuad: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  inCubic: t => t * t * t, outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  inQuart: t => t ** 4, outQuart: t => 1 - Math.pow(1 - t, 4),
  inOutQuart: t => t < .5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2,
  inQuint: t => t ** 5, outQuint: t => 1 - Math.pow(1 - t, 5),
  inOutQuint: t => t < .5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2,
  inExpo: t => t <= 0 ? 0 : Math.pow(2, 10 * t - 10),
  outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inOutExpo: t => t <= 0 ? 0 : t >= 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inBack: t => { const c1 = 1.70158, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; },
  outElastic: t => t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (TAU / 3)) + 1,
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
};
// analytic damped spring, 0 → 1 with overshoot (t in seconds)
function spring(t, w = 18, z = 0.45) {
  if (t <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
}
// pulse that jumps to 1 at time t0 and decays
const pulse = (t, t0, tau = 0.12) => t < t0 ? 0 : Math.exp(-(t - t0) / tau);
// seeded RNG
function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const hash1 = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ── palette ───────────────────────────────────────────────────
const C = {
  ink: '#05060f', ink2: '#0b0d1a', cream: '#f4ead5', gold: '#ffb627', gold2: '#ffd98a',
  teal: '#19e3d0', cyan: '#00b8ff', mag: '#ff2e88', blue: '#2a2cff', white: '#ffffff',
};
const rgba = (hex, a = 1) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
};

// Arabic-Indic digits
const AR = s => String(s).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]).replace(/\./g, '٫');

// ── 2D drawing helpers (virtual 1920×1080 space) ──────────────
const F = {
  lalezar: s => `400 ${s}px Lalezar`,
  kufi: (s, w = 900) => `${w} ${s}px NotoKufi`,
  ruqaa: (s, w = 700) => `${w} ${s}px Ruqaa`,
  reem: (s, w = 700) => `${w} ${s}px ReemKufi`,
  unb: (s, w = 900) => `${w} ${s}px Unbounded`,
  grot: (s, w = 500) => `${w} ${s}px Grotesk`,
};
function text(x, str, px, py, o = {}) {
  x.save();
  x.font = o.font || F.kufi(100);
  x.direction = o.dir || 'rtl';
  x.textAlign = o.align || 'center';
  x.textBaseline = o.base || 'middle';
  if (o.alpha != null) x.globalAlpha *= o.alpha;
  if (o.blur) x.filter = `blur(${o.blur}px)`;
  x.translate(px, py);
  if (o.rot) x.rotate(o.rot);
  if (o.sx || o.sy) x.scale(o.sx ?? 1, o.sy ?? 1);
  if (o.skew) x.transform(1, 0, o.skew, 1, 0, 0);
  if (o.shadow) { x.shadowColor = o.shadow[0]; x.shadowBlur = o.shadow[1]; }
  if (o.stroke) { x.lineWidth = o.stroke[1]; x.strokeStyle = o.stroke[0]; x.lineJoin = 'round'; x.strokeText(str, 0, 0); }
  if (o.fill !== false) { x.fillStyle = o.fill || C.cream; x.fillText(str, 0, 0); }
  x.restore();
}
// fake extruded text: N stacked copies along (dx,dy), darkening toward the back
function extruded(x, str, px, py, o = {}) {
  const n = o.layers ?? 24, dx = o.dx ?? -2, dy = o.dy ?? 2.4;
  const c0 = o.back || '#1a1030', c1 = o.mid || C.gold;
  for (let i = n; i >= 1; i--) {
    const k = i / n;
    text(x, str, px + dx * i, py + dy * i, { ...o, fill: lerpHex(c1, c0, k), stroke: null, shadow: null, alpha: null });
  }
  text(x, str, px, py, o);
}
function lerpHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = mix(pa >> 16 & 255, pb >> 16 & 255, t) | 0, g = mix(pa >> 8 & 255, pb >> 8 & 255, t) | 0, bl = mix(pa & 255, pb & 255, t) | 0;
  return `rgb(${r},${g},${bl})`;
}
function glowDot(x, px, py, r, col = [255, 200, 110], a = 1) {
  const g = x.createRadialGradient(px, py, 0, px, py, r);
  g.addColorStop(0, `rgba(255,255,255,${a})`);
  g.addColorStop(.12, `rgba(${col[0]},${col[1]},${col[2]},${a * .95})`);
  g.addColorStop(.4, `rgba(${col[0]},${col[1]},${col[2]},${a * .25})`);
  g.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
  x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill();
}
// polyline drawn up to a fraction of its total length (draw-on effect)
function polyProgress(x, pts, p, close = false) {
  const P = close ? pts.concat([pts[0]]) : pts;
  let total = 0; const L = [];
  for (let i = 1; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); L.push(d); total += d; }
  let target = total * clamp(p), acc = 0;
  x.beginPath(); x.moveTo(P[0][0], P[0][1]);
  let tip = P[0];
  for (let i = 1; i < P.length; i++) {
    if (acc + L[i - 1] <= target) { x.lineTo(P[i][0], P[i][1]); acc += L[i - 1]; tip = P[i]; }
    else { const k = (target - acc) / L[i - 1]; tip = [mix(P[i - 1][0], P[i][0], k), mix(P[i - 1][1], P[i][1], k)]; x.lineTo(tip[0], tip[1]); break; }
  }
  return tip;
}
// pretty stroke: dark casing + coloured core + hot highlight
function ribbon(x, col, w, drawPath, alpha = 1) {
  x.save(); x.lineCap = 'round'; x.lineJoin = 'round'; x.globalAlpha *= alpha;
  drawPath(); x.strokeStyle = 'rgba(2,3,10,.9)'; x.lineWidth = w + 5; x.stroke();
  drawPath(); x.strokeStyle = col; x.lineWidth = w; x.stroke();
  drawPath(); x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = Math.max(1, w * .28); x.stroke();
  x.restore();
}

// neon stroke for the additive layer: wide soft halos + white-hot core
function glowStroke(x, drawPath, rgb = [255, 190, 90], w = 3, alpha = 1) {
  x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
  const passes = [[w * 7, .05], [w * 3.5, .10], [w * 1.8, .28], [w, .9]];
  for (const [lw, a] of passes) {
    drawPath(); x.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a * alpha})`; x.lineWidth = lw; x.stroke();
  }
  drawPath(); x.strokeStyle = `rgba(255,255,255,${.85 * alpha})`; x.lineWidth = Math.max(1, w * .4); x.stroke();
  x.restore();
}

// soft dark band behind a caption so it reads over any picture
function captionShade(o, alpha = 1, y0 = 780) {
  const g = o.createLinearGradient(0, y0, 0, 1080);
  g.addColorStop(0, 'rgba(2,3,10,0)'); g.addColorStop(1, `rgba(2,3,10,${.72 * alpha})`);
  o.fillStyle = g; o.fillRect(0, y0, 1920, 1080 - y0);
}
