// Deterministic renderer for the 30 s identity film.
// window.renderFrame(t) renders film time t (seconds). No wall-clock input anywhere.
import * as THREE from '../node_modules/three/build/three.module.js';

const Q = new URLSearchParams(location.search);
const W = +(Q.get('w') || 1920), H = +(Q.get('h') || 1080);
const K = W / 1920;                 // design space is 1920x1080
const SUB = +(Q.get('sub') || 4);   // temporal sub-frames for motion blur
const FPS = +(Q.get('fps') || 60);
const SHUTTER = 0.5;                // fraction of one frame interval (180 degree shutter)

// ---------------------------------------------------------------- utilities
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const prog = (t, a, b) => clamp01((t - a) / (b - a));
const mix = (a, b, t) => (typeof a === 'number' ? a + (b - a) * t : a.map((x, i) => x + (b[i] - x) * t));

// Custom cubic-bezier easing (no overshoot: control y stays within 0..1).
function bezier(x1, y1, x2, y2) {
  const samp = (a1, a2, s) => { const c = 3 * a1, b = 3 * (a2 - a1) - c, a = 1 - c - b; return ((a * s + b) * s + c) * s; };
  return x => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, s = x;
    for (let i = 0; i < 48; i++) {
      const v = samp(x1, x2, s);
      if (Math.abs(v - x) < 1e-7) break;
      if (v < x) lo = s; else hi = s;
      s = (lo + hi) / 2;
    }
    return samp(y1, y2, s);
  };
}
const E = {
  expand: bezier(0.22, 0.7, 0.12, 1),
  settle: bezier(0.45, 0, 0.15, 1),
  reveal: bezier(0.62, 0, 0.2, 1),
  drift: bezier(0.37, 0, 0.63, 1),
  collapse: bezier(0.55, 0, 0.3, 1),
  line: bezier(0.5, 0, 0.3, 1),
};

// keys: [{t, v, dur, e}] ; value holds v0 before first key
function track(keys, t, v0) {
  let k = -1;
  for (let i = 0; i < keys.length; i++) { if (keys[i].t <= t) k = i; else break; }
  if (k < 0) return v0;
  const c = keys[k];
  const prev = k > 0 ? keys[k - 1].v : v0;
  const w = c.dur > 0 ? (c.e || E.settle)(prog(t, c.t, c.t + c.dur)) : 1;
  return mix(prev, c.v, w);
}

// ---------------------------------------------------------------- palette
const PAL = {
  ivory: '#F2F0EB', powder: '#DCE8F0', soft: '#BDD1E0', dusty: '#9FB8CE', mist: '#D7DDE2',
  coral: '#CF8F7E', ink: '#2E4052', ink2: '#6B8097', panel: '#F7F6F2',
};
function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(h, a) { const [r, g, b] = hex2rgb(h); return `rgba(${r},${g},${b},${a})`; }
function colorAt(keys, t) {
  let i = 0;
  while (i < keys.length - 2 && t >= keys[i + 1][0]) i++;
  const [t0, c0] = keys[i], [t1, c1] = keys[i + 1];
  const w = E.drift(prog(t, t0, t1));
  const a = hex2rgb(c0), b = hex2rgb(c1);
  return `rgb(${a.map((x, k) => Math.round(x + (b[k] - x) * w)).join(',')})`;
}
const BG = [[0, PAL.ivory], [9.6, PAL.ivory], [11.6, '#E3E8EC'], [14.6, '#E3E8EC'], [16.0, PAL.ivory], [25.6, PAL.ivory], [27.2, '#E6ECF0']];

const AR = '"IBM Plex Sans Arabic", sans-serif';
const EN = '"Space Grotesk", sans-serif';
const CARD = { x: 460, y: 250, w: 1000, h: 580, rad: 28 };
const WEB = { x: 120, y: 90, w: 1680, h: 900, rad: 14 };

// ---------------------------------------------------------------- fonts
await Promise.all([
  document.fonts.load('300 150px "IBM Plex Sans Arabic"', 'الهوية'),
  document.fonts.load('400 150px "IBM Plex Sans Arabic"', 'الهوية'),
  document.fonts.load('300 40px "Space Grotesk"', 'Identity'),
  document.fonts.load('400 40px "Space Grotesk"', 'Identity'),
]);

// ---------------------------------------------------------------- canvases
const out = document.getElementById('out');
out.width = W; out.height = H;
out.style.width = W + 'px'; out.style.height = H + 'px';
const oc = out.getContext('2d');
const sc = document.createElement('canvas'); sc.width = W; sc.height = H;
const scx = sc.getContext('2d');

// Procedural paper/brush grain tile (seeded).
const grainC = document.createElement('canvas'); grainC.width = grainC.height = 256;
{
  const g = grainC.getContext('2d'), id = g.createImageData(256, 256), r = mulberry32(99);
  for (let i = 0; i < id.data.length; i += 4) {
    const v = 128 + (r() - 0.5) * 110;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255;
  }
  g.putImageData(id, 0, 0);
}
const grainPat = scx.createPattern(grainC, 'repeat');

// ---------------------------------------------------------------- 3D
const glCanvas = document.createElement('canvas');
glCanvas.width = W; glCanvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: true, premultipliedAlpha: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
const ambient = new THREE.AmbientLight(0xffffff, 0.8);
const hemi = new THREE.HemisphereLight(0xffffff, 0xA9B8C7, 0.55);
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
scene.add(ambient, hemi, sun);

function makeBrushTexture() {
  // Mottled painterly texture: soft dabs plus faint, short, mostly isotropic strokes. Tileable in u.
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const x = c.getContext('2d'), r = mulberry32(4242);
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 900; i++) {
    const cx = r() * 1024, cy = r() * 512, rad = 18 + r() * 70;
    const dark = r() < 0.5, a = 0.025 + r() * 0.06;
    const col = dark ? '118,138,160' : '255,255,255';
    for (const ox of [-1024, 0, 1024]) {
      const g = x.createRadialGradient(cx + ox, cy, 0, cx + ox, cy, rad);
      g.addColorStop(0, `rgba(${col},${a.toFixed(3)})`);
      g.addColorStop(1, `rgba(${col},0)`);
      x.fillStyle = g; x.beginPath(); x.arc(cx + ox, cy, rad, 0, Math.PI * 2); x.fill();
    }
  }
  x.lineCap = 'round';
  for (let i = 0; i < 1400; i++) {
    const cx = r() * 1024, cy = r() * 512, len = 14 + r() * 40, th = r() * Math.PI;
    const dark = r() < 0.6, a = 0.02 + r() * 0.04;
    x.strokeStyle = dark ? `rgba(118,138,160,${a.toFixed(3)})` : `rgba(255,255,255,${(a * 2).toFixed(3)})`;
    x.lineWidth = 1 + r() * 2.5;
    for (const ox of [-1024, 0, 1024]) {
      x.beginPath(); x.moveTo(cx + ox, cy); x.lineTo(cx + ox + Math.cos(th) * len, cy + Math.sin(th) * len); x.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
const brushTex = makeBrushTexture();

// Shape kinds. Every body shares one parametric topology; morphs lerp positions.
const POINT = 6, LINE = 0, ORB = 1, CLOUD = 2, SCULPT = 3, GEOM = 4, PEBBLE = 5;
const CLOUD_C = [[0.35, 0.8, 0.25], [-0.6, 0.55, 0.4], [0.1, 0.45, -0.85], [0.75, 0.2, -0.6], [-0.35, 0.35, -0.85]]
  .map(v => { const l = Math.hypot(...v); return v.map(c => c / l); });
function wob(x, y, z) {
  return Math.sin(2.1 * x + 0.7) * Math.cos(1.7 * y - 0.3) + 0.6 * Math.sin(2.7 * z + 1.9 * x) + 0.4 * Math.cos(3.1 * y + 2.3 * z);
}
function shapeP(kind, x, y, z, o) {
  switch (kind) {
    case POINT: o[0] = 0; o[1] = 0; o[2] = 0; return;
    case LINE: o[0] = x * 1.7; o[1] = y * 0.014; o[2] = z * 0.014; return;
    case ORB: { const r = 1 + 0.075 * wob(x, y, z); o[0] = x * r; o[1] = y * r; o[2] = z * r; return; }
    case PEBBLE: { const r = 1 + 0.13 * wob(x, y, z) + 0.05 * Math.sin(5 * x + 3 * z); o[0] = x * r; o[1] = y * r * 0.8; o[2] = z * r; return; }
    case CLOUD: {
      let r = 0.78;
      for (const c of CLOUD_C) r += 0.34 * Math.exp(-(1 - (x * c[0] + y * c[1] + z * c[2])) * 11);
      let py = y * r;
      if (py < -0.25) py = -0.25 + (py + 0.25) * 0.35;
      o[0] = x * r * 1.18; o[1] = py; o[2] = z * r; return;
    }
    case SCULPT: {
      const a = 1.25 * y, ca = Math.cos(a), sa = Math.sin(a);
      const xr = x * ca - z * sa, zr = x * sa + z * ca;
      const r = 0.92 + 0.1 * Math.sin(3 * Math.atan2(z, x) + 2 * y);
      o[0] = xr * 0.8 * r; o[1] = y * 1.42 * r; o[2] = zr * 0.8 * r; return;
    }
    case GEOM: {
      const f = v => Math.sign(v) * Math.pow(Math.abs(v), 0.22);
      const px = f(x) * 0.92, py = f(y) * 0.92, pz = f(z) * 0.92;
      o[0] = px + 0.03 * Math.sin(2.5 * py + pz); o[1] = py; o[2] = pz; return;
    }
  }
}
const SHP_A = [0, 0, 0], SHP_B = [0, 0, 0];

// stage: {t, kind, dur, e}. Morph from previous kind into this kind over dur.
function shapeAt(stages, initKind, t) {
  let k = -1;
  for (let i = 0; i < stages.length; i++) { if (stages[i].t <= t) k = i; else break; }
  if (k < 0) return { a: initKind, b: initKind, w: 0 };
  const s = stages[k];
  const a = k > 0 ? stages[k - 1].kind : initKind;
  const w = s.dur > 0 ? (s.e || E.settle)(prog(t, s.t, s.t + s.dur)) : 1;
  return { a, b: s.kind, w };
}

const NU = 128, NV = 80;      // NU+1 columns (seam duplicated for clean UVs), NV+1 rows
const bodies = [];
function makeBody({ color, pos0, stages, pos, vis, initKind = POINT }) {
  const nVert = (NU + 1) * (NV + 1);
  const dirs = new Float64Array(nVert * 3), uv = new Float32Array(nVert * 2);
  let k = 0;
  for (let i = 0; i <= NU; i++) {
    const u = (i / NU) * 2 * Math.PI;
    for (let j = 0; j <= NV; j++) {
      const v = (j / NV) * Math.PI;
      dirs[3 * k] = Math.sin(v) * Math.cos(u); dirs[3 * k + 1] = Math.cos(v); dirs[3 * k + 2] = Math.sin(v) * Math.sin(u);
      uv[2 * k] = i / NU; uv[2 * k + 1] = j / NV;
      k++;
    }
  }
  const index = [];
  const C = NV + 1;
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    const a = i * C + j, b = (i + 1) * C + j, c = b + 1, d = a + 1;
    index.push(a, b, d, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nVert * 3), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(index);
  const mat = new THREE.MeshLambertMaterial({ color, map: brushTex });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const b = { mesh, geo, dirs, nVert, stages, initKind, pos, pos0, vis };
  bodies.push(b);
  return b;
}
function setShape(b, t) {
  const sh = shapeAt(b.stages, b.initKind, t);
  const P = b.geo.attributes.position.array, d = b.dirs;
  for (let k = 0; k < b.nVert; k++) {
    const x = d[3 * k], y = d[3 * k + 1], z = d[3 * k + 2];
    let px, py, pz;
    if (sh.w <= 0) { shapeP(sh.a, x, y, z, SHP_A); px = SHP_A[0]; py = SHP_A[1]; pz = SHP_A[2]; }
    else if (sh.w >= 1) { shapeP(sh.b, x, y, z, SHP_A); px = SHP_A[0]; py = SHP_A[1]; pz = SHP_A[2]; }
    else {
      shapeP(sh.a, x, y, z, SHP_A); shapeP(sh.b, x, y, z, SHP_B);
      const w = sh.w;
      px = SHP_A[0] + (SHP_B[0] - SHP_A[0]) * w;
      py = SHP_A[1] + (SHP_B[1] - SHP_A[1]) * w;
      pz = SHP_A[2] + (SHP_B[2] - SHP_A[2]) * w;
    }
    P[3 * k] = px; P[3 * k + 1] = py; P[3 * k + 2] = pz;
  }
  const attr = b.geo.attributes.position;
  attr.needsUpdate = true;
  b.geo.computeVertexNormals();
  // average normals across the duplicated seam so Lambert shading has no crease
  const N = b.geo.attributes.normal.array, C = NV + 1;
  for (let j = 0; j <= NV; j++) {
    const a = j, bIdx = NU * C + j;
    for (let c = 0; c < 3; c++) {
      const m = (N[3 * a + c] + N[3 * bIdx + c]) * 0.5;
      N[3 * a + c] = m; N[3 * bIdx + c] = m;
    }
    const la = Math.hypot(N[3 * a], N[3 * a + 1], N[3 * a + 2]) || 1;
    const lb = Math.hypot(N[3 * bIdx], N[3 * bIdx + 1], N[3 * bIdx + 2]) || 1;
    for (let c = 0; c < 3; c++) { N[3 * a + c] /= la; N[3 * bIdx + c] /= lb; }
  }
  b.geo.attributes.normal.needsUpdate = true;
}

// stage helpers
const st = (t, kind, dur = 1.4, e = E.settle) => ({ t, kind, dur, e });
const emerge = (t, kind) => [st(t, LINE, 0.5, E.line), st(t + 0.5, kind, 1.5, E.expand)];
const collapse = t => [st(t, LINE, 0.9, E.collapse), st(t + 0.9, POINT, 0.5, E.collapse)];
const pk = (t, v, dur = 1.5, e = E.settle) => ({ t, v, dur, e });

// Hero body (Soft Blue). Visible across S1, S2, S4 (as a line), S5 card hand-off, S6 signature.
makeBody({
  color: PAL.soft, pos0: [0, 0, 0],
  stages: [
    ...emerge(0.2, ORB),
    st(5.0, CLOUD), st(6.7, SCULPT), st(8.4, GEOM, 1.2), st(10.0, SCULPT),
    ...collapse(14.0),
    ...emerge(18.0, ORB),
    ...collapse(20.0),
    ...emerge(25.6, SCULPT),
  ],
  pos: [pk(10.0, [-2.3, 0.1, -0.5], 1.6), pk(12.6, [-2.1, 0.45, 0.3], 1.4), pk(15.6, [0, 0, 0], 0), pk(26.1, [-2.0, 0.05, 0.2], 1.6)],
  vis: t => (t >= 0.2 && t < 15.6) || (t >= 18.0 && t < 20.6) || (t >= 25.6),
});
// Four companions emerging in S3, one per palette colour.
const companions = [
  { color: PAL.dusty, kind: GEOM, at: 10.3, p0: [-1.0, -0.35, 0.9], p1: [-0.9, -0.6, 0.5] },
  { color: PAL.powder, kind: CLOUD, at: 10.5, p0: [0, 0.3, 0], p1: [0.3, 0.55, -0.5] },
  { color: PAL.mist, kind: PEBBLE, at: 10.7, p0: [1.1, -0.25, 0.8], p1: [1.6, -0.5, 0.2] },
  { color: PAL.ivory, kind: ORB, at: 10.9, p0: [2.3, 0.25, -0.5], p1: [2.2, 0.35, 0.4] },
];
for (const c of companions) {
  makeBody({
    color: c.color, pos0: c.p0,
    stages: [...emerge(c.at, c.kind), ...collapse(14.0)],
    pos: [pk(12.6, c.p1, 1.4)],
    vis: t => t >= c.at && t < 15.6,
  });
}

const YAW = [
  { t: 0, v: -0.22, dur: 0 }, { t: 5.0, v: 0.12, dur: 5.0, e: E.drift }, { t: 10.0, v: 0.42, dur: 2.8 },
  { t: 13.0, v: 0.2, dur: 3.0 }, { t: 20.0, v: 0.0, dur: 6.0 }, { t: 26.0, v: 0.16, dur: 4.0 },
];
const LIGHT = [{ t: 1.8, v: 1.0, dur: 2.8, e: E.drift }];

function setCamera(t) {
  const drift = 1 - 0.7 * prog(t, 26, 29);      // camera settles in the final composition
  const yaw = track(YAW, t, -0.22) + drift * (0.035 * Math.sin(2 * Math.PI * t / 17) + 0.02 * Math.sin(2 * Math.PI * t / 9.3));
  const pitch = 0.06 + drift * 0.05 * Math.sin(2 * Math.PI * t / 21);
  const dist = 9.6 + drift * 0.2 * Math.sin(2 * Math.PI * t / 27);
  camera.position.set(dist * Math.sin(yaw) * Math.cos(pitch), dist * Math.sin(pitch), dist * Math.cos(yaw) * Math.cos(pitch));
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const lv = track(LIGHT, t, 0.35);
  const la = 0.7 + 0.45 * Math.sin(2 * Math.PI * t / 20);
  sun.position.set(4.5 * Math.cos(la), 5.2, 4.5 * Math.sin(la));
  sun.intensity = 0.4 + 1.5 * lv;
  return yaw;
}

// ---------------------------------------------------------------- 2D helpers
function blob(ctx, x, y, r, color, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(0.55, rgba(color, a * 0.45));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}
function sweepLine(ctx, x0, y, x1, p, color, width) {
  if (p <= 0) return;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + (x1 - x0) * p, y); ctx.stroke();
  ctx.restore();
}
// Arabic/Latin text revealed through a clip that grows from the start edge; the whole
// string is shaped by the browser in one call (no per-letter drawing).
function wipeText(ctx, txt, o) {
  const pe = E.reveal(clamp01(o.pin || 0));
  const po = E.settle(clamp01(o.pout || 0));
  const shown = pe * (1 - po);
  if (shown <= 0.002) return;
  ctx.save();
  ctx.font = `${o.wt} ${o.size}px ${o.fam}`;
  ctx.letterSpacing = `${o.ls || 0}px`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = o.color;
  const w = ctx.measureText(txt).width;
  const x = o.x, y = o.y + (o.rise || 0) * (1 - pe);
  const span = w * shown;
  let x0, x1;
  if (o.dir === 'ltr') { const left = x - w / 2; x0 = left - 30; x1 = left + span + 30; }
  else { const right = x + w / 2; x0 = right - span - 30; x1 = right + 30; }
  ctx.beginPath();
  ctx.rect(x0, y - o.size * 1.15, x1 - x0, o.size * 1.9);
  ctx.clip();
  ctx.fillText(txt, x, y);
  ctx.restore();
}
function lerpRect(a, b, m) {
  return { x: mix(a.x, b.x, m), y: mix(a.y, b.y, m), w: mix(a.w, b.w, m), h: mix(a.h, b.h, m), rad: mix(a.rad, b.rad, m) };
}
function cardRect(t) {
  const pw = E.expand(prog(t, 20.0, 20.7));
  const ph = E.settle(prog(t, 20.45, 21.3));
  const r0 = { x: 960 - CARD.w * pw / 2, y: 540 - Math.max(2, CARD.h * ph) / 2, w: CARD.w * pw, h: Math.max(2, CARD.h * ph), rad: CARD.rad };
  const m = E.settle(prog(t, 21.9, 22.8));
  return m > 0 ? lerpRect(r0, WEB, m) : r0;
}

// ---------------------------------------------------------------- scenes (2D layer)
function mistBlobs(ctx, t, yaw) {
  const B = [
    { x: 0.18, y: 0.3, r: 560, c: PAL.powder, a: 0.6, ph: 0.0, d: 0.5 },
    { x: 0.84, y: 0.7, r: 640, c: PAL.soft, a: 0.36, ph: 1.3, d: 1.0 },
    { x: 0.5, y: 1.0, r: 760, c: PAL.mist, a: 0.5, ph: 2.1, d: 0.7 },
    { x: 0.92, y: 0.12, r: 460, c: PAL.dusty, a: 0.16, ph: 0.7, d: 1.4 },
  ];
  for (let i = 0; i < B.length; i++) {
    const b = B[i];
    const x = 1920 * b.x + 90 * Math.sin(2 * Math.PI * t / (24 + i * 4) + b.ph) - yaw * 240 * b.d;
    const y = 1080 * b.y + 50 * Math.cos(2 * Math.PI * t / (21 + i * 3) + b.ph);
    blob(ctx, x, y, b.r, b.c, b.a);
  }
}

function shadows(ctx, t) {
  for (const b of bodies) {
    if (!b.mesh.visible) continue;
    const v = b.mesh.position.clone(); v.y -= 0.95; v.project(camera);
    const sx = (v.x + 1) / 2 * 1920, sy = (1 - v.y) / 2 * 1080;
    ctx.save();
    ctx.translate(sx, sy); ctx.scale(1, 0.2);
    blob(ctx, 0, 0, 260, '#7E97AD', 0.22);
    ctx.restore();
  }
}

function sceneTitle(ctx, t) {
  wipeText(ctx, 'الهوية', { fam: AR, wt: 300, size: 150, color: PAL.ink, x: 960, y: 905, pin: prog(t, 3.0, 4.2), pout: prog(t, 4.6, 5.0), rise: 22 });
  wipeText(ctx, 'VISUAL IDENTITY', { fam: EN, wt: 400, size: 22, ls: 12, color: PAL.ink2, x: 960, y: 978, pin: prog(t, 3.6, 4.4), pout: prog(t, 4.6, 5.0), dir: 'ltr' });
}

function sceneTypeA(ctx, t) {
  // S4: typographic compositions with delicate accents
  const cx = 1180;
  wipeText(ctx, 'شخصية مختلفة', { fam: AR, wt: 300, size: 150, color: PAL.ink, x: cx, y: 470, pin: prog(t, 15.2, 16.2), pout: prog(t, 16.9, 17.5), rise: 18 });
  wipeText(ctx, 'Distinct character', { fam: EN, wt: 400, size: 26, ls: 8, color: PAL.ink2, x: cx, y: 560, pin: prog(t, 15.6, 16.5), pout: prog(t, 16.9, 17.4), dir: 'ltr' });
  sweepLine(ctx, cx - 110, 628, cx + 110, E.settle(prog(t, 16.4, 17.0)), PAL.dusty, 2.2);
  wipeText(ctx, 'حركة لها معنى', { fam: AR, wt: 300, size: 150, color: PAL.ink, x: cx, y: 470, pin: prog(t, 17.2, 18.2), pout: prog(t, 19.2, 19.9), rise: 18 });
  wipeText(ctx, 'Color · Motion · Meaning', { fam: EN, wt: 400, size: 26, ls: 8, color: PAL.ink2, x: cx, y: 560, pin: prog(t, 17.6, 18.4), pout: prog(t, 19.2, 19.8), dir: 'ltr' });
  // delicate geometric accent: ring that draws itself
  const rp = E.settle(prog(t, 18.2, 19.2)) * (1 - E.settle(prog(t, 19.2, 19.9)));   // draws, then retracts
  if (rp > 0) {
    ctx.save();
    ctx.strokeStyle = rgba(PAL.dusty, 0.9); ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(520, 540, 128, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * rp); ctx.stroke();
    ctx.restore();
    if (rp >= 0.999 && t < 19.2) { ctx.fillStyle = PAL.coral; ctx.beginPath(); ctx.arc(520, 412, 7, 0, Math.PI * 2); ctx.fill(); }
  }
}

function drawWeb(ctx, t, r) {
  const s = r.w / WEB.w;
  ctx.save();
  rr(ctx, r.x, r.y, r.w, r.h, r.rad); ctx.clip();
  ctx.translate(r.x, r.y + (r.h - WEB.h * s) / 2); ctx.scale(s, s);
  ctx.fillStyle = PAL.panel; ctx.fillRect(0, 0, WEB.w, WEB.h);
  // nav
  blob(ctx, 90, 48, 90, PAL.soft, 0.9);
  ctx.fillStyle = PAL.dusty; ctx.beginPath(); ctx.arc(90, 48, 13, 0, Math.PI * 2); ctx.fill();
  sweepLine(ctx, 0, 96, WEB.w, E.settle(prog(t, 22.3, 23.0)), rgba(PAL.dusty, 0.6), 2);
  wipeText(ctx, 'الرئيسية', { fam: AR, wt: 300, size: 26, color: PAL.ink2, x: 1560, y: 56, pin: prog(t, 22.3, 22.8) });
  wipeText(ctx, 'المشاريع', { fam: AR, wt: 300, size: 26, color: PAL.ink2, x: 1420, y: 56, pin: prog(t, 22.4, 22.9) });
  wipeText(ctx, 'عني', { fam: AR, wt: 300, size: 26, color: PAL.ink2, x: 1300, y: 56, pin: prog(t, 22.5, 23.0) });
  // hero
  blob(ctx, 420, 480, 380, PAL.soft, 0.85 * E.settle(prog(t, 22.2, 23.0)));
  ctx.strokeStyle = rgba(PAL.dusty, 0.8); ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(440, 470, 210, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * E.settle(prog(t, 22.5, 23.4))); ctx.stroke();
  wipeText(ctx, 'التقنية', { fam: AR, wt: 300, size: 210, color: PAL.ink, x: 1150, y: 400, pin: prog(t, 22.0, 22.9), rise: 24 });
  wipeText(ctx, 'تطبيقات ويب، وخدمات خلفية، وأنظمة مترابطة', { fam: AR, wt: 300, size: 36, color: PAL.ink2, x: 1150, y: 500, pin: prog(t, 22.4, 23.2) });
  wipeText(ctx, 'Engineering · Systems', { fam: EN, wt: 400, size: 24, ls: 6, color: PAL.ink2, x: 1150, y: 560, pin: prog(t, 22.6, 23.3), dir: 'ltr' });
  sweepLine(ctx, 760, 700, 1560, E.settle(prog(t, 22.8, 23.5)), rgba(PAL.dusty, 0.7), 2);
  wipeText(ctx, 'تصميم، وتطوير، وأتمتة', { fam: AR, wt: 300, size: 26, color: PAL.ink2, x: 1160, y: 752, pin: prog(t, 23.0, 23.6) });
  ctx.restore();
}

function sceneCardAndWeb(ctx, t) {
  const r = cardRect(t);
  const morphing = t >= 21.9;
  if (!morphing) {
    ctx.save();
    rr(ctx, r.x, r.y, r.w, r.h, r.rad); ctx.fillStyle = '#F6F5F1'; ctx.fill();
    ctx.clip();
    blob(ctx, 700, 420, 460, PAL.soft, 0.4);
    wipeText(ctx, 'الفن', { fam: AR, wt: 300, size: 230, color: PAL.ink, x: 960, y: 520, pin: prog(t, 20.2, 21.0), pout: prog(t, 21.6, 21.95), rise: 24 });
    wipeText(ctx, 'Title sequence', { fam: EN, wt: 400, size: 26, ls: 10, color: PAL.ink2, x: 960, y: 640, pin: prog(t, 20.9, 21.7), pout: prog(t, 21.6, 21.95), dir: 'ltr' });
    ctx.restore();
    return;
  }
  // card has morphed into the website frame
  let rr2 = r;
  const f = 1 - E.settle(prog(t, 23.0, 23.6));    // vertical wipe out at 23.0-23.6
  if (f < 1) rr2 = { x: r.x, y: r.y, w: r.w, h: r.h * f, rad: r.rad };
  if (f > 0) {
    ctx.save();
    rr(ctx, r.x, r.y, r.w, r.h, r.rad); ctx.clip();
    ctx.beginPath(); ctx.rect(r.x - 4, r.y - 4, r.w + 8, r.h * f + 4); ctx.clip();
    drawWeb(ctx, t, r.x === WEB.x && r.w === WEB.w ? WEB : r);
    ctx.restore();
  }
}

function sceneMotion(ctx, t) {
  // S5 tail: motion-graphic composition with the word "البساطة"
  wipeText(ctx, 'البساطة', { fam: AR, wt: 300, size: 220, color: PAL.ink, x: 600, y: 560, pin: prog(t, 23.0, 23.9), pout: prog(t, 25.0, 25.7), rise: 24 });
  const cx = 1400, cy = 540;
  const out_ = E.settle(prog(t, 25.2, 25.8));
  for (let i = 0; i < 7; i++) {
    const r = 110 + i * 48;
    const a0 = -Math.PI / 2 + 0.04 * (t - 23) * (i % 2 ? 1 : -1);
    const sw = Math.PI * 2 * 0.82 * E.settle(prog(t, 23.2 + i * 0.1, 24.3 + i * 0.1)) * (1 - out_);
    if (sw <= 0.001) continue;
    ctx.save();
    ctx.strokeStyle = rgba(i % 3 === 0 ? PAL.dusty : i % 3 === 1 ? PAL.soft : PAL.ink2, i % 3 === 2 ? 0.55 : 0.9);
    ctx.lineWidth = 3.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, r, a0, a0 + sw); ctx.stroke();
    ctx.restore();
    if (i === 3) {
      ctx.fillStyle = PAL.coral;
      ctx.beginPath(); ctx.arc(cx + r * Math.cos(a0 + sw), cy + r * Math.sin(a0 + sw), 7, 0, Math.PI * 2); ctx.fill();
    }
  }
  const orb = E.expand(prog(t, 23.5, 24.6)) * (1 - out_);
  if (orb > 0.001) blob(ctx, cx, cy, 70 * orb + 1, PAL.soft, 0.95);
}

function sceneFinal(ctx, t) {
  wipeText(ctx, 'الهوية', { fam: AR, wt: 300, size: 300, color: PAL.ink, x: 1400, y: 560, pin: prog(t, 26.5, 27.6), rise: 26 });
  sweepLine(ctx, 1210, 676, 1590, E.settle(prog(t, 27.0, 27.8)), rgba(PAL.dusty, 0.85), 2.2);
  wipeText(ctx, 'Identity', { fam: EN, wt: 400, size: 30, ls: 16, color: PAL.ink2, x: 1400, y: 740, pin: prog(t, 27.2, 28.0), dir: 'ltr' });
  const cp = E.expand(prog(t, 27.8, 28.5));
  if (cp > 0) { ctx.fillStyle = PAL.coral; ctx.beginPath(); ctx.arc(1222, 410, 9 * cp, 0, Math.PI * 2); ctx.fill(); }
}

function grain(ctx, fr) {
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.085;
  const ox = (fr * 53) % 256, oy = (fr * 29) % 256;
  ctx.translate(ox - 256, oy - 256);
  ctx.fillStyle = grainPat;
  ctx.fillRect(0, 0, 2560, 1700);
  ctx.restore();
}

// ---------------------------------------------------------------- frame composition
function drawScene(t, fr) {
  const yaw = setCamera(t);
  for (const b of bodies) {
    const vis = b.vis(t);
    b.mesh.visible = vis;
    if (!vis) continue;
    const p = track(b.pos, t, b.pos0);
    b.mesh.position.set(p[0], p[1], p[2]);
    setShape(b, t);
  }
  renderer.render(scene, camera);

  const ctx = scx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = colorAt(BG, t);
  ctx.fillRect(0, 0, W, H);
  ctx.setTransform(K, 0, 0, K, 0, 0);
  mistBlobs(ctx, t, yaw);
  shadows(ctx, t);
  ctx.drawImage(glCanvas, 0, 0, 1920, 1080);
  sceneTitle(ctx, t);
  sceneTypeA(ctx, t);
  sceneCardAndWeb(ctx, t);
  sceneMotion(ctx, t);
  sceneFinal(ctx, t);
  grain(ctx, fr);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// Renders film time t with SUB temporal sub-frames averaged (shutter SHUTTER frames).
window.renderFrame = (t) => {
  const fr = Math.round(t * FPS);
  oc.setTransform(1, 0, 0, 1, 0, 0);
  oc.globalCompositeOperation = 'source-over';
  for (let s = 0; s < SUB; s++) {
    const tt = t + ((s + 0.5) / SUB - 0.5) * SHUTTER / FPS;
    drawScene(tt, fr);
    oc.globalAlpha = 1 / (s + 1);     // running mean of sub-frames
    oc.drawImage(sc, 0, 0);
  }
  oc.globalAlpha = 1;
};
window.__ready = true;
