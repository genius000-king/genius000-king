import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { quadVert, worldFrag, partVert, partFrag, dofFrag, dofCombineFrag, gradeFrag } from './shaders.js';

const Q = new URLSearchParams(location.search);
const IW = +(Q.get('iw') || 1920), IH = +(Q.get('ih') || 1080);
const OW = +(Q.get('ow') || 1280), OH = +(Q.get('oh') || 720);
const DENSITY = +(Q.get('density') || 1);
const DBG = Q.get('dbg') || '';
const TL = await (await fetch('timeline.json')).json();
const TE = TL.explode;

// ---------------------------------------------------------------- math
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sat = (x) => clamp(x, 0, 1);
const mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ssm = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const nrm = (a) => scl(a, 1 / (len(a) || 1));
const lerp3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
function rotAxis(ax, ang) {
  const [x, y, z] = ax, c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y,
          t * x * y + s * z, t * y * y + c, t * y * z - s * x,
          t * x * z - s * y, t * y * z + s * x, t * z * z + c];
}
function mm(a, b) {
  const r = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
    r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
}
const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randUnit(rng) {
  const z = rng() * 2 - 1, a = rng() * Math.PI * 2, r = Math.sqrt(1 - z * z);
  return [r * Math.cos(a), r * Math.sin(a), z];
}
function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return add(add(scl(p0, u * u * u), scl(p1, 3 * u * u * t)), add(scl(p2, 3 * u * t * t), scl(p3, t * t * t)));
}
const wob = (t, s) => Math.sin(t + s) * 0.5 + Math.sin(t * 2.31 + s * 1.7) * 0.3 + Math.sin(t * 4.13 + s * 2.9) * 0.2;
function integrate(f, t, dt = 1 / 240) {
  let acc = 0;
  for (let x = 0; x < t; x += dt) acc += f(Math.min(x + dt * 0.5, t)) * Math.min(dt, t - x);
  return acc;
}

// ---------------------------------------------------------------- story curves
const C0 = [0, 2.4, 0];
const R0 = 1.0;
const GRIPS = TL.hands.map((h) => h[1]);
const SUN = nrm([-0.85, 0.40, -0.25]);

function struggle(t) { return Math.pow(ssm(TL.dimStart, TL.inhale, t), 1.15); }
function envAt(t) {
  if (t >= TE) return mix(0.22, 1.25, ssm(TE + 0.05, TE + 1.7, t));
  let e = mix(1.3, 1.0, ssm(5.5, 11.0, t));
  e = mix(e, 0.66, ssm(TL.dimStart, TL.dimStart + 2.2, t));
  e = mix(e, 0.38, ssm(TL.dimStart + 2.2, TL.climax, t));
  e = mix(e, 0.22, ssm(TL.climax, TL.inhale + 0.3, t));
  return e;
}
function joltAt(t) {
  let j = 0, f = 0;
  for (const g of GRIPS) {
    if (t < g) continue;
    const d = t - g;
    j += Math.exp(-4 * d) * Math.sin(18 * d);
    f += Math.exp(-5 * d);
  }
  return { j, f };
}
function colorRate(t) {
  if (t < TL.pinch - 1.6) return 0;
  if (t >= TE) return 0.32;
  return 0.69 + 3.4 * Math.pow(struggle(t), 1.6);
}
const PALETTE = [
  [1.0, 0.04, 0.05], [0.05, 1.0, 0.28], [0.06, 0.28, 1.0], [0.62, 0.04, 1.0], [0.62, 1.0, 0.02],
  [1.0, 0.28, 0.10], [0.0, 0.92, 1.0], [1.0, 0.70, 0.04], [1.0, 0.04, 0.62],
];
function palette(phi) {
  const n = PALETTE.length;
  const f = ((phi % n) + n) % n;
  const i = Math.floor(f), w = sstep(0, 1, f - i);
  return lerp3(PALETTE[i], PALETTE[(i + 1) % n], w);
}

function sphereState(t, light = false) {
  const st = {
    C: [0, -6, 0], R: 0.5, amp: 0.03, freq: 1.4, nT: 0, colorAmt: 0, stretch: 1, glow: 0, tail: 0, iT: 0,
    colR: -1, colTop: 0, k1: 0.5, k2: 0, white: 0, phi: 0,
  };
  if (!light) {
    st.nT = integrate((x) => 0.35 + 2.4 * struggle(x) + (x > TE ? 0.6 * Math.exp(-(x - TE) * 2) : 0), t);
    st.iT = integrate((x) => 0.5 + 2.5 * struggle(x), t);
    st.phi = integrate(colorRate, t) - integrate(colorRate, TL.pinch);
  }
  const rs = TL.riseStart, pn = TL.pinch;
  if (t < rs) return st;
  if (t < pn) {
    const rho = (t - rs) / (pn - rs);
    const e = ssm(0, 1, rho);
    st.C = [0, mix(-1.25, 2.65, e), 0];
    st.R = mix(0.5, 0.92, Math.pow(rho, 0.7));
    st.k2 = mix(0.95, 0.12, rho);
    st.colR = mix(0.44, 0.02, Math.pow(rho, 0.6));
    st.colTop = st.C[1];
    st.k1 = mix(0.85, 0.35, rho);
    st.amp = 0.03 + 0.035 * rho;
    st.colorAmt = ssm(0.4, 1.0, rho);
    st.stretch = 1 + 0.26 * rho * rho;
    st.tail = 0.5 * ssm(0.55, 1.0, rho);
    st.glow = 0.9 * st.colorAmt;
    return st;
  }
  const tp = t - pn;
  const S = struggle(t);
  const { j, f } = joltAt(t);
  const settle = 0.25 * Math.exp(-2.2 * tp) * (Math.cos(6.5 * tp) + (2.2 / 6.5) * Math.sin(6.5 * tp));
  const bob = [0.05 * Math.sin(1.1 * t), 0.07 * Math.sin(1.3 * t + 1), 0.05 * Math.sin(0.9 * t + 2)];
  const escA = Math.pow(S, 1.2) * 0.2;
  const esc = [escA * wob(t * 2.2, 1.0), escA * 0.7 * wob(t * 2.6, 4.0), escA * wob(t * 1.9, 7.0)];
  st.C = add(add([0, 2.4 + settle, 0], scl(bob, ssm(0, 1.5, tp))), esc);
  st.R = mix(0.92, 1.0, ssm(0, 1.0, tp)) * (1 + 0.02 * Math.sin(2.1 * t)) + 0.04 * j;
  st.amp = 0.065 + 0.012 * Math.sin(t * 1.7) + 0.20 * S + 0.05 * Math.abs(j);
  st.freq = 1.4 + 1.0 * S;
  st.colorAmt = 1;
  st.stretch = 1 + 0.26 * Math.exp(-3 * tp) * Math.cos(12 * tp) + 0.06 * S * Math.sin(t * 9) + 0.06 * j;
  st.tail = 0.5 * Math.exp(-5 * tp) * (0.5 + 0.5 * Math.cos(9 * tp));
  st.colR = tp < 0.32 ? 0.02 * (1 - tp / 0.32) : -1;
  st.colTop = mix(st.C[1] - st.R, -0.2, ssm(0, 0.3, tp));
  st.k1 = 0.35;
  st.k2 = 0.12 * (1 - ssm(0, 0.12, tp));
  st.glow = 0.9 + 0.25 * Math.sin(t * 2.1) + (t > TL.dimStart ? 0.5 + 3.6 * S + 1.6 * f : 0);
  if (t >= TL.inhale) {
    const i = ssm(TL.inhale, TE, t);
    st.R *= 1 - 0.15 * i;
    st.amp = mix(st.amp, 0.03, i);
    st.freq = mix(st.freq, 5.0, i);
    st.glow = mix(st.glow, 10, i);
  }
  if (t >= TE) {
    const te = t - TE;
    const swell = (1 - Math.exp(-14 * te)) * Math.exp(-2.6 * te);
    st.R = 0.85 + 0.15 * (1 - Math.exp(-3 * te)) + 0.45 * swell + 0.02 * Math.sin(2.1 * t);
    st.amp = 0.06 + 0.32 * Math.exp(-3 * te);
    st.freq = mix(1.6, 3.5, Math.exp(-2 * te));
    st.glow = 1.0 + 26 * Math.exp(-5.5 * te);
    st.white = Math.exp(-3.2 * te);
    st.C = add([0, 2.4 + 0.12 * ssm(0, 5, te), 0], bob);
    st.stretch = 1 + 0.08 * Math.exp(-2 * te) * Math.sin(te * 14);
  }
  return st;
}
// light-weight lookup for centre / radius (used by droplets)
const LUT_HZ = 120;
const SPH_LUT = [];
for (let k = 0; k <= TL.duration * LUT_HZ + 2; k++) { const s = sphereState(k / LUT_HZ, true); SPH_LUT.push([s.C, s.R]); }
function sphCR(t) {
  const x = clamp(t * LUT_HZ, 0, SPH_LUT.length - 2), i = Math.floor(x), f = x - i;
  return [lerp3(SPH_LUT[i][0], SPH_LUT[i + 1][0], f), mix(SPH_LUT[i][1], SPH_LUT[i + 1][1], f)];
}

function floorState(t) {
  const fl = { D: 0, W: 2.6, rinA: 0, rinP: 0, routA: 0, routP: 0, remH: 0, remW: 0.45, shockR: 0, shockA: 0 };
  const dp = ssm(TL.dimpleStart, TL.dimpleFull, t);
  fl.D = 0.95 * Math.pow(dp, 1.4);
  fl.W = mix(2.8, 1.65, dp);
  fl.rinA = 0.045 * sstep(TL.dimpleStart, TL.dimpleStart + 1.5, t) * (1 - ssm(TL.riseStart + 1, TL.pinch, t));
  fl.rinP = 4.0 * t;
  if (t >= TL.riseStart) fl.D = mix(fl.D, 0.55, ssm(TL.riseStart, TL.pinch, t));
  if (t >= TL.pinch) {
    const tp = t - TL.pinch;
    fl.D = 0.55 * Math.exp(-1.6 * tp) * Math.cos(4.2 * tp);
    fl.remH = 0.22 * Math.exp(-2.5 * tp) * Math.sin(7 * tp);
    fl.routA = 0.06 * Math.exp(-1.1 * tp) * sstep(0, 0.15, tp);
    fl.routP = 7.5 * tp;
  }
  if (t >= TE) {
    const te = t - TE;
    fl.shockR = 1.2 + 11 * (1 - Math.exp(-1.1 * te));
    fl.shockA = 0.24 * Math.exp(-1.5 * te) * sstep(0, 0.06, te);
    fl.D += 0.35 * Math.exp(-2.2 * te) * Math.sin(Math.min(te * 9, Math.PI));
  }
  return fl;
}

// ---------------------------------------------------------------- hand model
// Right hand, H units (wrist→middle fingertip ≈ 0.95). Wrist at origin,
// fingers along +y, palm normal +z, thumb on +x.
function buildHandModel() {
  const caps = [];
  const P = (a, b, ra, rb, bone = 0) => caps.push({ a, b, ra, rb, bone });
  P([-0.075, 0.035, 0], [0.075, 0.035, 0], 0.074, 0.074);
  P([0.055, 0.06, 0], [0.150, 0.43, 0], 0.062, 0.058);
  P([0.012, 0.06, 0], [0.048, 0.455, 0], 0.064, 0.060);
  P([-0.032, 0.06, 0], [-0.058, 0.44, 0], 0.062, 0.056);
  P([-0.068, 0.06, 0], [-0.150, 0.395, 0], 0.058, 0.050);
  P([-0.115, 0.24, 0.004], [0.12, 0.25, 0.004], 0.068, 0.068);
  P([-0.14, 0.39, 0], [0.14, 0.43, 0], 0.058, 0.058);
  P([0.045, 0.07, 0.025], [0.135, 0.215, 0.02], 0.074, 0.062);
  P([-0.075, 0.08, 0.012], [-0.125, 0.30, 0.012], 0.06, 0.054);
  const fingerDefs = [
    { k: [0.150, 0.43, 0], fan: 5, L: [0.21, 0.125, 0.10], r: [0.049, 0.043, 0.038, 0.032] },
    { k: [0.048, 0.455, 0], fan: 0, L: [0.23, 0.14, 0.105], r: [0.051, 0.045, 0.039, 0.033] },
    { k: [-0.058, 0.44, 0], fan: -4, L: [0.215, 0.135, 0.10], r: [0.048, 0.042, 0.037, 0.031] },
    { k: [-0.150, 0.395, 0], fan: -11, L: [0.17, 0.10, 0.09], r: [0.043, 0.037, 0.033, 0.028] },
    { k: [0.085, 0.095, 0.03], dir: [0.62, 0.70, 0.36], L: [0.20, 0.145, 0.115], r: [0.064, 0.056, 0.05, 0.043], thumb: true },
  ];
  const fingers = [];
  fingerDefs.forEach((fd, fi) => {
    const d = fd.dir ? nrm(fd.dir) : [Math.sin((fd.fan * Math.PI) / 180), Math.cos((fd.fan * Math.PI) / 180), 0];
    const axis = fd.thumb ? nrm(cross(d, nrm([-0.45, 0.25, 0.86]))) : nrm(cross(d, [0, 0, 1]));
    const J = [fd.k];
    for (let k = 0; k < 3; k++) J.push(add(J[k], scl(d, fd.L[k])));
    for (let k = 0; k < 3; k++) P(J[k], J[k + 1], fd.r[k], fd.r[k + 1], 1 + fi * 3 + k);
    fingers.push({ d, axis, L: fd.L, r: fd.r, J, thumb: !!fd.thumb, base: 1 + fi * 3, fi });
  });
  return { caps, fingers };
}
const HAND = buildHandModel();
const NBONES = 16;
const SPREAD_W = [1.0, 0.0, -0.75, -1.5, 1.0];

function sdTaper(p, c) {
  const ba = sub(c.b, c.a), pa = sub(p, c.a);
  const h = sat(dot(pa, ba) / dot(ba, ba));
  return len(sub(pa, scl(ba, h))) - mix(c.ra, c.rb, h);
}
const CAP_AREAS = HAND.caps.map((c) => {
  const L = len(sub(c.b, c.a));
  return Math.PI * (c.ra + c.rb) * L + 2 * Math.PI * (c.ra * c.ra + c.rb * c.rb);
});
const CAP_TOTAL = CAP_AREAS.reduce((a, b) => a + b, 0);
function sampleHandSurface(rng) {
  for (;;) {
    let r = rng() * CAP_TOTAL, ci = 0;
    while (r > CAP_AREAS[ci]) { r -= CAP_AREAS[ci]; ci++; }
    const c = HAND.caps[ci];
    const ab = sub(c.b, c.a), L = len(ab), ax = scl(ab, 1 / L);
    const t1 = nrm(cross(ax, Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), t2 = cross(ax, t1);
    const side = Math.PI * (c.ra + c.rb) * L, capA = 2 * Math.PI * c.ra * c.ra;
    const rr = rng() * (side + capA + 2 * Math.PI * c.rb * c.rb);
    let p, n;
    if (rr < side) {
      const s = rng(), th = rng() * Math.PI * 2, rad = mix(c.ra, c.rb, s);
      n = add(scl(t1, Math.cos(th)), scl(t2, Math.sin(th)));
      p = add(add(c.a, scl(ab, s)), scl(n, rad));
    } else {
      const atA = rr < side + capA;
      let d = randUnit(rng);
      const out = atA ? scl(ax, -1) : ax;
      if (dot(d, out) < 0) d = scl(d, -1);
      n = d;
      p = add(atA ? c.a : c.b, scl(d, atA ? c.ra : c.rb));
    }
    let inside = false;
    for (let k = 0; k < HAND.caps.length; k++) {
      if (k === ci) continue;
      if (sdTaper(p, HAND.caps[k]) < -0.004) { inside = true; break; }
    }
    if (!inside) return { p, n, bone: c.bone };
  }
}

// ---------------------------------------------------------------- arms
const ARM_DEFS = [
  { u: [0.82, -0.28, 0.50], hint: [0, 1, 0], mir: 1, S: 2.0, ofs: 0.45, lean: 0.5, hero: true },
  { u: [-0.80, -0.20, 0.56], hint: [0, 1, 0], mir: -1, S: 1.95, ofs: 0.5, lean: 0.5 },
  { u: [0.12, 0.80, -0.58], hint: [0, 0.2, 1], mir: 1, S: 2.05, ofs: 0.7, lean: 0.35 },
  { u: [0.05, -0.98, 0.20], hint: [0, 0, -1], mir: -1, S: 1.9, ofs: 0.5, lean: 0.6 },
  { u: [0.62, 0.50, 0.60], hint: [0, 1, 0], mir: -1, S: 1.9, ofs: 0.6, lean: 0.45 },
  { u: [-0.60, 0.52, 0.60], hint: [0, 1, 0], mir: 1, S: 1.9, ofs: 0.6, lean: 0.45 },
  { u: [0.80, 0.10, -0.60], hint: [0, 1, 0], mir: -1, S: 2.0, ofs: 0.5, lean: 0.5 },
  { u: [-0.78, 0.15, -0.60], hint: [0, 1, 0], mir: 1, S: 2.0, ofs: 0.5, lean: 0.5 },
  { u: [0.05, -0.55, -0.83], hint: [0, 1, 0], mir: 1, S: 1.95, ofs: 0.5, lean: 0.5 },
  { u: [-0.15, 0.96, 0.20], hint: [1, 0, 0], mir: -1, S: 2.0, ofs: 0.7, lean: 0.35 },
];
// a field of hands rising further away, clawing at the sphere they cannot reach
const FAR_DEFS = [
  { X: [-6.6, 0, -1.6], t0: 13.7, t1: 15.7, S: 2.0, mir: 1, lean: 0.45 },
  { X: [-8.6, 0, 1.8], t0: 14.5, t1: 16.4, S: 2.1, mir: -1, lean: 0.4 },
  { X: [-5.2, 0, -4.6], t0: 15.3, t1: 17.0, S: 1.85, mir: -1, lean: 0.5 },
  { X: [-10.2, 0, -5.0], t0: 16.0, t1: 17.8, S: 2.2, mir: 1, lean: 0.35 },
  { X: [-4.6, 0, 4.6], t0: 16.9, t1: 18.5, S: 1.85, mir: 1, lean: 0.5 },
  { X: [5.6, 0, -5.4], t0: 17.7, t1: 19.2, S: 1.95, mir: -1, lean: 0.45 },
  { X: [6.6, 0, 4.0], t0: 18.5, t1: 19.9, S: 2.0, mir: 1, lean: 0.45 },
  { X: [-1.8, 0, -8.6], t0: 19.3, t1: 20.7, S: 2.1, mir: -1, lean: 0.4 },
];

const _m4 = new THREE.Matrix4();
function quatFromBasis(X, Y, Z) {
  _m4.makeBasis(new THREE.Vector3(...X), new THREE.Vector3(...Y), new THREE.Vector3(...Z));
  return new THREE.Quaternion().setFromRotationMatrix(_m4);
}
function basisFromQuat(q) {
  _m4.makeRotationFromQuaternion(q);
  const e = _m4.elements;
  return { X: [e[0], e[1], e[2]], Y: [e[4], e[5], e[6]], Z: [e[8], e[9], e[10]] };
}
function crossFloor(poly) {
  let hit = null;
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i], b = poly[i + 1];
    if (a[1] < 0 && b[1] >= 0) {
      const s = -a[1] / (b[1] - a[1]);
      hit = { p: lerp3(a, b, s), seg: i, s, dir: nrm(sub(b, a)) };
    }
  }
  return hit;
}

function setupGripArm(def, idx) {
  const u = nrm(def.u);
  const v = nrm(sub(def.hint, scl(u, dot(def.hint, u))));
  const Z = scl(u, -1), Y = v, X = cross(Y, Z);
  const S = def.S;
  const Rh = (R0 + 0.03) / S;
  const cl = [0, 0.29, 0.065 + Rh];
  const wOff = scl(add(scl(Y, cl[1]), scl(Z, cl[2])), -S);
  const Wg = add(C0, wOff);
  const f = nrm(add(scl(v, -1), scl(u, def.ofs)));
  const L2 = 1.35 * S;
  const Eg = add(Wg, scl(f, L2));
  let out = [Eg[0], 0, Eg[2]];
  out = len(out) > 1e-3 ? nrm(out) : [0, 0, 1];
  const g = nrm(add(scl(out, def.lean), [0, -1, 0]));
  const L1 = Math.max(1.45 * S, (Eg[1] + 1.7) / -g[1]);
  const Sh = add(Eg, scl(g, L1));
  const dSW = nrm(sub(Wg, Sh));
  const pole = nrm(sub(sub(Eg, Sh), scl(dSW, dot(sub(Eg, Sh), dSW))));
  const cr = crossFloor([Sh, Eg, Wg]);
  const X0 = cr ? cr.p : [Wg[0], 0, Wg[2]];
  const Zs = nrm([C0[0] - X0[0], 0, C0[2] - X0[2]]);
  const Ys = [0, 1, 0];
  const Xs = cross(Ys, Zs);
  const [t0, t1] = TL.hands[idx];
  return {
    idx, def, far: false, u, v, S, mir: def.mir, wOff, L1, L2, Sh, pole, X0,
    Wstart: [X0[0], -2.7, X0[2]], B1: [X0[0], 1.0, X0[2]], hover: add(scl(u, 0.85), scl(v, -0.45)),
    q0: quatFromBasis(Xs, Ys, Zs), qg: quatFromBasis(X, Y, Z), t0, t1, phase: idx * 1.7 + 0.3, Eg, Wg,
  };
}
function setupFarArm(def, idx) {
  const S = def.S;
  const X0 = def.X;
  const toS = nrm(sub(C0, X0));
  const hz = nrm([toS[0], 0, toS[2]]);
  const fup = nrm(add(scl(hz, def.lean), [0, 1, 0]));
  const L2 = 1.35 * S;
  const Wt = add(X0, scl(fup, L2 * 0.8));
  const Y = nrm(add(fup, scl(hz, 0.4)));
  const dW = nrm(sub(C0, Wt));
  const Z = nrm(sub(dW, scl(Y, dot(dW, Y))));
  const X = cross(Y, Z);
  return {
    idx, def, far: true, S, mir: def.mir, L1: 2, L2, X0, fup, Wt, Wstart: sub(X0, scl(fup, L2 * 1.25)),
    q0: quatFromBasis(X, Y, Z), qg: quatFromBasis(X, Y, Z), t0: def.t0, t1: def.t1, phase: idx * 2.3 + 1.1,
    u: scl(Z, -1), Eg: sub(Wt, scl(Y, L2)),
  };
}
const ARMS = [...ARM_DEFS.map(setupGripArm), ...FAR_DEFS.map((d, i) => setupFarArm(d, ARM_DEFS.length + i))];
const NARM = ARMS.length;

// ---------------------------------------------------------------- particles
const SHAPE_CDF = [0.30, 0.46, 0.62, 0.80, 0.92, 1.0];
function pickShape(r) { let i = 0; while (r > SHAPE_CDF[i]) i++; return i; }

const plan = ARMS.map((a) => {
  const D = DENSITY;
  if (a.far) return { hand: Math.round(6000 * D), fore: Math.round(3800 * D), elbow: 0, upper: 0, debris: Math.round(700 * D) };
  const hero = a.def.hero;
  const upVis = Math.max(0.5, a.Eg[1] + 0.5);
  return {
    hand: Math.round((hero ? 17000 : 12000) * D),
    fore: Math.round((hero ? 9000 : 6500) * D),
    elbow: Math.round(700 * D),
    upper: Math.round(Math.min(10000, 1300 * upVis + 1500) * D),
    debris: Math.round((hero ? 2400 : 1500) * D),
  };
});
const NA = plan.reduce((s, p) => s + p.hand + p.fore + p.elbow + p.upper + p.debris, 0);
const NDROP_GROUPS = Math.round(620 * Math.min(DENSITY * 1.5, 1));
const NBURST = Math.round(2200 * Math.min(DENSITY * 1.5, 1));

// droplets are generated first (count depends on the strands)
const dropDefs = [];
{
  const rng = mulberry32(777);
  const dens = (t) => {
    if (t < TL.pinch || t >= TE) return 0;
    let d = t < TL.dimStart ? 0.5 : 0.5 + 16 * Math.pow(struggle(t), 1.4);
    for (const g of GRIPS) if (t >= g) d += 7 * Math.exp(-(t - g) * 3);
    return d;
  };
  const ts = [], cdf = [];
  let acc = 0;
  for (let t = TL.pinch; t < TE; t += 0.005) { acc += dens(t) * 0.005; ts.push(t); cdf.push(acc); }
  const gripping = (t) => ARMS.filter((a) => !a.far && a.t1 <= t);
  const group = (t0, dir, speed, size0, life, n, hue) => {
    for (let k = 0; k < n; k++) {
      dropDefs.push({ t0, dir, speed, size: Math.max(size0 * (1 - 0.1 * k), 0.006), life, delay: k * 0.028 + (rng() - 0.5) * 0.006, hue, jit: randUnit(rng) });
    }
  };
  // snap of the pinch: a ring of droplets thrown from the neck
  for (let g = 0; g < 26; g++) {
    const a = rng() * Math.PI * 2;
    const dir = nrm([Math.cos(a), -0.6 - rng() * 0.5, Math.sin(a)]);
    group(TL.pinch + rng() * 0.08, dir, 1.5 + 2.5 * rng(), 0.02 + 0.03 * rng(), 0.6 + 0.5 * rng(), 2 + Math.floor(rng() * 5), 0);
  }
  for (let g = 0; g < NDROP_GROUPS; g++) {
    const target = ((g + rng()) / NDROP_GROUPS) * acc;
    let lo = 0, hi = cdf.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < target) lo = m + 1; else hi = m; }
    const t0 = ts[lo];
    const gr = gripping(t0);
    let dir;
    if (gr.length && rng() < 0.65) {
      const a = gr[Math.floor(rng() * gr.length)];
      dir = nrm(add(a.u, scl(randUnit(rng), 0.6)));
    } else {
      dir = randUnit(rng);
      dir[1] = Math.abs(dir[1]) * 0.8 + 0.1;
      dir = nrm(dir);
    }
    const S = struggle(t0);
    const hr = rng();
    group(t0, dir, 1.2 + 3.5 * rng() + 3 * S, 0.016 + 0.045 * Math.pow(rng(), 1.5) * (0.6 + S), 0.55 + 0.7 * rng(),
          2 + Math.floor(rng() * 8), hr < 0.5 ? 0 : hr < 0.8 ? 1 : 2);
  }
  // the burst at the explosion
  for (let g = 0; g < NBURST; g++) {
    const hr = rng();
    group(TE + rng() * 0.05, randUnit(rng), 5 + 15 * rng(), 0.02 + 0.06 * Math.pow(rng(), 1.5), 1.2 + 2.2 * rng(),
          1 + Math.floor(rng() * 3), hr < 0.4 ? 0 : hr < 0.7 ? 1 : 2);
  }
}
const ND = dropDefs.length;
const NP = NA + ND;
console.log('particles', NA, 'droplets', ND);

const pPos = new Float32Array(NP * 3);
const pDyn = new Float32Array(NP * 4);
const pQuat = new Float32Array(NP * 4);
const pInfo = new Float32Array(NP * 4);
const pAxis = new Float32Array(NP * 3);
const kind = new Uint8Array(NP);
const bone = new Uint8Array(NP);
const lp = new Float32Array(NP * 3);
const ln = new Float32Array(NP * 3);
const uu = new Float32Array(NP);
const seedA = new Float32Array(NP);
const seedB = new Float32Array(NP);
const p0 = new Float32Array(NA * 3);
const e0 = new Float32Array(NA);
let explosionCached = false;

{
  const rng = mulberry32(1337);
  let i = 0;
  const common = (sMin, sMax, pw = 1.7) => {
    const u1 = rng(), u2 = rng(), u3 = rng();
    pQuat.set([Math.sqrt(1 - u1) * Math.sin(2 * Math.PI * u2), Math.sqrt(1 - u1) * Math.cos(2 * Math.PI * u2),
               Math.sqrt(u1) * Math.sin(2 * Math.PI * u3), Math.sqrt(u1) * Math.cos(2 * Math.PI * u3)], i * 4);
    pAxis.set(randUnit(rng), i * 3);
    const size = sMin + (sMax - sMin) * Math.pow(rng(), pw);
    pInfo.set([pickShape(rng()), size, rng(), 1], i * 4);
    seedA[i] = rng(); seedB[i] = rng();
    return size;
  };
  // inset depth → ambient occlusion baked into the albedo
  const inset = (size) => {
    const k = rng();
    const depth = size * (0.15 + 0.75 * k * k);
    pInfo[i * 4 + 3] = (0.74 + 0.26 * rng()) * (1 - 0.42 * sat((depth / size - 0.2) / 0.7));
    return depth;
  };
  ARMS.forEach((arm, ai) => {
    const pl = plan[ai];
    arm.start = i;
    const S = arm.S, sc = S / 2;
    for (let k = 0; k < pl.hand; k++, i++) {
      const size = common(0.014 * sc, 0.058 * sc, 1.9);
      const smp = sampleHandSurface(rng);
      const off = (-inset(size) + (rng() < 0.06 ? 0.03 * rng() : 0)) / S;
      kind[i] = 0; bone[i] = smp.bone;
      lp.set(add(smp.p, scl(smp.n, off)), i * 3);
      ln.set(smp.n, i * 3);
      uu[i] = 0.35 * (1 - sat(smp.p[1] / 0.95));
    }
    for (let k = 0; k < pl.fore; k++, i++) {
      const s = -0.06 + 1.1 * rng();
      const size = common(0.02 * sc, (0.07 + 0.03 * sat(s)) * sc, 1.6);
      kind[i] = 1;
      lp.set([s, rng() * Math.PI * 2, -inset(size)], i * 3);
      uu[i] = mix(0.35, 0.65, sat(s));
    }
    for (let k = 0; k < pl.elbow; k++, i++) {
      const size = common(0.03 * sc, 0.075 * sc);
      kind[i] = 3;
      lp.set(randUnit(rng), i * 3);
      ln[i * 3] = -inset(size);
      uu[i] = 0.65;
    }
    for (let k = 0; k < pl.upper; k++, i++) {
      const size = common(0.03 * sc, 0.095 * sc, 1.5);
      kind[i] = 2;
      lp.set([rng() * 1.02, rng() * Math.PI * 2, -inset(size)], i * 3);
      uu[i] = mix(0.65, 1.0, lp[i * 3]);
    }
    for (let k = 0; k < pl.debris; k++, i++) {
      const size = common(0.025 * sc, 0.13 * sc, 2.2);
      pInfo[i * 4 + 3] = 0.72 + 0.28 * rng();
      kind[i] = 4;
      const early = rng() < 0.35;
      const td = early ? arm.t0 + 0.25 + 1.1 * rng() : mix(arm.t1, TE - 0.3, Math.sqrt(rng()));
      const dist = (0.35 + 2.3 * Math.pow(rng(), 1.6)) * sc + size;
      lp.set([0.15 + 1.4 * rng(), rng() * Math.PI * 2, dist], i * 3);
      ln.set([rng() * Math.PI * 2, 0.45 + 0.5 * rng(), 0.2 + 0.6 * rng()], i * 3);
      uu[i] = td;
    }
    arm.end = i;
  });
  // droplets
  dropDefs.forEach((d, k) => {
    pQuat.set([0, 0, 0, 1], i * 4);
    pAxis.set([0, 1, 0], i * 3);
    pInfo.set([6, d.size, rng(), 2 + d.hue], i * 4);
    kind[i] = 5;
    i++;
  });
}

// ---------------------------------------------------------------- arm pose
function solveFinger(fg, curl, spread, cl, Rh, jit, out) {
  const spreadAng = fg.thumb ? 0 : spread * SPREAD_W[fg.fi];
  let Qp = fg.thumb ? I3 : rotAxis([0, 0, 1], spreadAng);
  let J = fg.J[0];
  const rel = fg.thumb ? [0.05, 0.10, 0.12] : [0.10, 0.16, 0.09];
  const mx = fg.thumb ? [0.55, 0.65, 0.95] : [1.35, 1.65, 1.15];
  const ext = fg.thumb ? [-0.35, -0.1, 0.0] : [-0.06, 0.02, 0.0];
  for (let k = 0; k < 3; k++) {
    let target = curl >= 0 ? mix(rel[k], mx[k], curl) : mix(rel[k], ext[k], -curl);
    if (fg.thumb && k === 0) target -= 0.3 * Math.max(spread / 0.3, 0) * (1 - Math.max(curl, 0));
    target += jit * Math.sin(k * 2.1 + fg.base);
    const seg = scl(fg.d, fg.L[k]);
    const r = fg.r[k + 1] * 0.95;
    const ok = (th) => {
      const Qm = mm(Qp, rotAxis(fg.axis, th));
      const e = add(J, mv(Qm, seg));
      const ab = sub(e, J);
      const h = sat(dot(sub(cl, J), ab) / dot(ab, ab));
      return len(sub(add(J, scl(ab, h)), cl)) >= Rh + r;
    };
    const lo = Math.min(rel[k], target) - 0.25;
    let th = target;
    if (!ok(th)) {
      if (!ok(lo)) th = lo;
      else {
        let a = lo, b = target;
        for (let it = 0; it < 14; it++) { const m = 0.5 * (a + b); if (ok(m)) a = m; else b = m; }
        th = a;
      }
    }
    const Qm = mm(Qp, rotAxis(fg.axis, th));
    out.push({ O: J, Q: Qm, rest: fg.J[k] });
    J = add(J, mv(Qm, seg));
    Qp = Qm;
  }
}

function armTension(arm, t) {
  if (arm.far) return t < arm.t1 ? 0 : 0.15 + 0.5 * struggle(t);
  if (t < arm.t1) return 0;
  return ssm(arm.t1, arm.t1 + 0.8, t) * (0.3 + 0.7 * struggle(t));
}

function poseArm(arm, t, sph) {
  if (t < arm.t0) { arm.active = false; return; }
  arm.active = true;
  const tt = Math.min(t, TE);
  const tau = sat((tt - arm.t0) / (arm.t1 - arm.t0));
  const e = ssm(0, 1, tau);
  const tens = armTension(arm, tt);
  let W, B, curl, spread, cl, Rh;
  const mir = arm.mir;
  if (arm.far) {
    const sway = [0.12 * Math.sin(tt * 0.7 + arm.phase), 0.06 * Math.sin(tt * 0.9 + arm.phase * 2), 0.12 * Math.sin(tt * 0.6 + arm.phase * 3)];
    W = add(lerp3(arm.Wstart, arm.Wt, e), scl(sway, e));
    B = basisFromQuat(arm.qg);
    curl = mix(-0.4, 0.15 + 0.3 * (0.5 + 0.5 * Math.sin(tt * 1.5 + arm.phase)) + 0.25 * tens, ssm(0.5, 1, tau));
    spread = mix(0.3, 0.12, ssm(0.5, 1, tau));
    cl = [0, 0, 50];
    Rh = 0.1;
  } else {
    const Wg = add(add(sph.C, arm.wOff), scl(arm.u, (sph.R - R0) * 0.9));
    const B2 = add(Wg, arm.hover);
    W = bezier(arm.Wstart, arm.B1, B2, Wg, e);
    const q = new THREE.Quaternion().slerpQuaternions(arm.q0, arm.qg, ssm(0.12, 0.85, tau));
    B = basisFromQuat(q);
    const { j } = joltAt(tt);
    W = add(W, scl(arm.u, 0.05 * j * sat(tau * 4 - 3)));
    W = add(W, scl(B.X, tens * 0.05 * Math.sin(tt * 13 + arm.phase)));
    curl = tau < 1 ? mix(-0.6, 1.0, ssm(0.78, 1.0, tau)) : 1.0;
    spread = mix(0.3, 0.06, ssm(0.75, 1.0, tau));
  }
  arm.W = W; arm.B = B; arm.tau = tau; arm.tension = tens;
  const Xm = scl(B.X, mir);
  const Bm = [Xm[0], B.Y[0], B.Z[0], Xm[1], B.Y[1], B.Z[1], Xm[2], B.Y[2], B.Z[2]];
  arm.Bm = Bm;
  if (!arm.far) {
    const dC = sub(sph.C, W);
    cl = [dot(Xm, dC) / arm.S, dot(B.Y, dC) / arm.S, dot(B.Z, dC) / arm.S];
    Rh = (sph.R + sph.amp * 0.4 + 0.015) / arm.S;
  }
  const jit = tens * 0.09 * Math.sin(tt * 31 + arm.phase);
  const bones = [{ O: [0, 0, 0], Q: I3, rest: [0, 0, 0] }];
  for (const fg of HAND.fingers) solveFinger(fg, curl, spread, cl, Rh, jit, bones);
  arm.boneM = new Float64Array(NBONES * 9);
  arm.boneT = new Float64Array(NBONES * 3);
  const lateral = 1 + tens * 0.22 * Math.sin(tt * 5.3 + arm.phase);
  for (let b = 0; b < NBONES; b++) {
    const bn = bones[b];
    const M = mm(Bm, bn.Q).map((x) => x * arm.S);
    for (let r = 0; r < 3; r++) M[r * 3] *= lateral;
    const O = add(W, scl(mv(Bm, bn.O), arm.S));
    const T = sub(O, mv(M, bn.rest));
    arm.boneM.set(M, b * 9);
    arm.boneT.set(T, b * 3);
  }
  if (arm.far) {
    arm.E = sub(W, scl(B.Y, arm.L2));
    arm.Sh = add(arm.E, [0, -2, 0]);
  } else {
    const Estr = sub(W, scl(B.Y, arm.L2));
    const d0 = sub(W, arm.Sh);
    let dl = len(d0);
    const dir = scl(d0, 1 / dl);
    let Eik;
    if (dl >= arm.L1 + arm.L2 - 1e-3) Eik = add(arm.Sh, scl(dir, (dl * arm.L1) / (arm.L1 + arm.L2)));
    else {
      dl = Math.max(dl, Math.abs(arm.L1 - arm.L2) + 1e-3);
      const a = (arm.L1 * arm.L1 - arm.L2 * arm.L2 + dl * dl) / (2 * dl);
      const h = Math.sqrt(Math.max(arm.L1 * arm.L1 - a * a, 0));
      const pp = nrm(sub(arm.pole, scl(dir, dot(arm.pole, dir))));
      Eik = add(add(arm.Sh, scl(dir, a)), scl(pp, h));
    }
    const bl = ssm(0.3, 0.95, tau);
    const Ed = nrm(lerp3(sub(Estr, W), sub(Eik, W), bl));
    arm.E = add(W, scl(Ed, arm.L2));
  }
  arm.tip = add(W, scl(B.Y, arm.S * 0.9));
  // where the arm pierces the liquid floor
  const radii = [0.235, 0.2, 0.15, 0.1].map((r) => r * arm.S);
  const hit = crossFloor([arm.Sh, arm.E, arm.W, arm.tip]);
  if (hit) {
    const r = mix(radii[hit.seg], radii[hit.seg + 1], hit.s) * (hit.seg === 2 ? 1.4 : 1);
    arm.cross = { X: hit.p, dir: hit.dir, r, str: 1 };
  } else if (arm.tip[1] > -0.7 && arm.tip[1] < 0) {
    arm.cross = { X: [arm.tip[0], 0, arm.tip[2]], dir: [0, 1, 0], r: 0.22 * arm.S, str: sstep(-0.7, 0, arm.tip[1]) * 0.6 };
  } else arm.cross = null;
}

// ---------------------------------------------------------------- particle update
function flareY(d, rs, k) {
  const c = d - rs;
  if (c >= k) return 0;
  const q = k - Math.max(c, 0);
  return (q * q) / (4 * k) * 1.1;
}

function writeArmParticles(arm, t, sph) {
  const { start, end } = arm;
  if (!arm.active) {
    for (let i = start; i < end; i++) pDyn[i * 4 + 2] = 0;
    return;
  }
  const S = arm.S, M = arm.boneM, T = arm.boneT, tens = arm.tension;
  const W = arm.W, E = arm.E, Sh = arm.Sh, Xm = [arm.Bm[0], arm.Bm[3], arm.Bm[6]];
  const C = sph.C;
  const emerging = 1 - arm.tau;
  const floorAct = 0.45 + 0.55 * emerging;
  const inh = t >= TL.inhale ? ssm(TL.inhale, TE, t) : 0;
  const fa = sub(E, W), faL = len(fa), fd = scl(fa, 1 / faL);
  const e1 = nrm(sub(Xm, scl(fd, dot(Xm, fd))));
  const e2 = cross(fd, e1);
  const ua = sub(Sh, E), uaL = len(ua), ud = scl(ua, 1 / uaL);
  const g1 = nrm(cross(ud, Math.abs(ud[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]));
  const g2 = cross(ud, g1);
  const pulsePhase = t * 0.9 + arm.phase * 0.13;
  const sw = tens * 0.11 * (S / 2);
  const jitA = (0.004 + tens * 0.026 + inh * 0.03) * (S / 2);
  const tum = 0.2 + tens * 2.5 + inh * 4;
  const cr = arm.cross;
  const sleeveTop = cr ? cr.X[1] + 0.5 : 0.5;
  // debris frame
  const dX = cr ? cr.X : [arm.X0[0], 0, arm.X0[2]];
  const dDir = cr ? cr.dir : [0, 1, 0];
  const dR = cr ? cr.r : 0.2 * S;
  const db1 = nrm(cross(dDir, [0, 0, 1])), db2 = cross(dDir, db1);
  const restC = arm.X0;
  for (let i = start; i < end; i++) {
    const k = kind[i];
    const i3 = i * 3, i4 = i * 4;
    if (k === 4) {
      const td = uu[i];
      if (t < td) { pDyn[i4 + 2] = 0; continue; }
      const h0 = lp[i3], th = lp[i3 + 1], dist = lp[i3 + 2];
      const phi = ln[i3], dur = ln[i3 + 1], arc = ln[i3 + 2];
      const size = pInfo[i4 + 1];
      const ox = dX[0] + dDir[0] * h0 + (db1[0] * Math.cos(th) + db2[0] * Math.sin(th)) * dR;
      const oy = Math.max(dX[1] + dDir[1] * h0, 0.2) + (db1[1] * Math.cos(th) + db2[1] * Math.sin(th)) * dR;
      const oz = dX[2] + dDir[2] * h0 + (db1[2] * Math.cos(th) + db2[2] * Math.sin(th)) * dR;
      const rx = restC[0] + Math.cos(phi) * dist, rz = restC[2] + Math.sin(phi) * dist;
      const ry = flareY(dist, dR * 0.9, 0.35 + 0.9 * dR) + size * 0.42;
      const s = sat((t - td) / dur);
      const sh = 1 - (1 - s) * (1 - s);
      pPos[i3] = mix(ox, rx, sh);
      pPos[i3 + 1] = mix(oy, ry, s * s) + arc * 4 * s * (1 - s);
      pPos[i3 + 2] = mix(oz, rz, sh);
      pDyn[i4] = (seedA[i] - 0.5) * 14 * Math.min(t - td, dur);
      pDyn[i4 + 1] = tens * 0.15 * Math.exp(-(t - td) * 2);
      pDyn[i4 + 2] = 1;
      pDyn[i4 + 3] = 0.35;
      continue;
    }
    let px, py, pz, nx, ny, nz;
    if (k === 0) {
      const b = bone[i], m = b * 9, o = b * 3;
      const x = lp[i3], y = lp[i3 + 1], z = lp[i3 + 2];
      px = T[o] + M[m] * x + M[m + 1] * y + M[m + 2] * z;
      py = T[o + 1] + M[m + 3] * x + M[m + 4] * y + M[m + 5] * z;
      pz = T[o + 2] + M[m + 6] * x + M[m + 7] * y + M[m + 8] * z;
      const a = ln[i3], bb = ln[i3 + 1], c = ln[i3 + 2];
      nx = (M[m] * a + M[m + 1] * bb + M[m + 2] * c) / S;
      ny = (M[m + 3] * a + M[m + 4] * bb + M[m + 5] * c) / S;
      nz = (M[m + 6] * a + M[m + 7] * bb + M[m + 8] * c) / S;
    } else if (k === 1) {
      const s = lp[i3], th = lp[i3 + 1], dep = lp[i3 + 2];
      const sp = Math.pow(sat(s), 0.8);
      const rx = S * mix(0.145, 0.205, sp) * (1 + 0.08 * Math.sin(Math.PI * sat(s))), rz = S * mix(0.088, 0.17, sp);
      const c = Math.cos(th), sn = Math.sin(th);
      const gx = e1[0] * c / rx + e2[0] * sn / rz, gy = e1[1] * c / rx + e2[1] * sn / rz, gz = e1[2] * c / rx + e2[2] * sn / rz;
      const gl = Math.hypot(gx, gy, gz);
      nx = gx / gl; ny = gy / gl; nz = gz / gl;
      const al = s * faL;
      px = W[0] + fd[0] * al + e1[0] * rx * c + e2[0] * rz * sn + nx * dep;
      py = W[1] + fd[1] * al + e1[1] * rx * c + e2[1] * rz * sn + ny * dep;
      pz = W[2] + fd[2] * al + e1[2] * rx * c + e2[2] * rz * sn + nz * dep;
    } else if (k === 2) {
      const s = lp[i3], th = lp[i3 + 1], dep = lp[i3 + 2];
      const r = S * mix(0.2, 0.235, s);
      const c = Math.cos(th), sn = Math.sin(th);
      nx = g1[0] * c + g2[0] * sn; ny = g1[1] * c + g2[1] * sn; nz = g1[2] * c + g2[2] * sn;
      const al = s * uaL;
      px = E[0] + ud[0] * al + nx * (r + dep);
      py = E[1] + ud[1] * al + ny * (r + dep);
      pz = E[2] + ud[2] * al + nz * (r + dep);
    } else {
      nx = lp[i3]; ny = lp[i3 + 1]; nz = lp[i3 + 2];
      const r = S * 0.2 + ln[i3];
      px = E[0] + nx * r; py = E[1] + ny * r; pz = E[2] + nz * r;
    }
    const sa = seedA[i], sb = seedB[i], u = uu[i];
    if (tens > 0 || inh > 0) {
      let pulse = 0;
      for (let q = 0; q < 3; q++) {
        const c = (pulsePhase + q / 3) % 1;
        const d = (u - c) / 0.07;
        pulse += Math.exp(-d * d);
      }
      const swell = sw * (0.45 + 0.55 * Math.sin(u * 14 - t * 7 + arm.phase)) * (1 + 1.6 * pulse);
      px += nx * swell; py += ny * swell; pz += nz * swell;
    }
    // loose fragments drifting off the surface
    if (sb < 0.07 + 0.12 * tens) {
      const loose = (0.04 + tens * 0.35 + 0.12 * emerging) * (0.2 + sa) * (0.6 + 0.4 * Math.sin(t * 2.1 + sa * 40)) * (S / 2);
      px += nx * loose; py += ny * loose + loose * 0.3 * Math.sin(t * 1.3 + sb * 30); pz += nz * loose;
    }
    px += jitA * Math.sin(t * 47 + sa * 91);
    py += jitA * Math.sin(t * 53 + sb * 57);
    pz += jitA * Math.sin(t * 59 + sa * 23 + sb * 11);
    if (inh > 0 && !arm.far) {
      const f = 1 - 0.07 * inh;
      px = C[0] + (px - C[0]) * f; py = C[1] + (py - C[1]) * f; pz = C[2] + (pz - C[2]) * f;
    }
    // the limb crumbles where it leaves the liquid
    let sizeMul = 1;
    const crumble = 1.1 + 0.25 * S;
    if (py < sleeveTop + crumble) {
      const a = Math.pow(1 - sat((py - sleeveTop * 0.3) / crumble), 2) * floorAct;
      const hx = Math.sin(sa * 71.3 + t * 0.7), hz = Math.sin(sb * 53.1 - t * 0.6);
      px += (hx * 0.3 + nx * 0.5) * a * 0.32 * (S / 2);
      pz += (hz * 0.3 + nz * 0.5) * a * 0.32 * (S / 2);
      py -= a * 0.05 * (0.5 + 0.5 * Math.sin(t * 2 + sa * 10));
      sizeMul = 1 + 0.35 * a * sb;
      if (py < 0) sizeMul *= sstep(-0.25, 0.05, py);
    }
    const dx = C[0] - px, dy = C[1] - py, dz = C[2] - pz;
    const dl = Math.hypot(dx, dy, dz);
    const facing = sat(((nx * dx + ny * dy + nz * dz) / dl) * 0.6 + 0.45);
    const surf = Math.max(dl - sph.R, 0);
    const energy = arm.far ? 0 : tens * (0.45 * Math.exp(-surf * 5) + 0.2 * Math.exp(-u * 3)) + inh * 0.8 * Math.exp(-surf * 2);
    pPos[i3] = px; pPos[i3 + 1] = py; pPos[i3 + 2] = pz;
    pDyn[i4] = t * tum * (sa - 0.5) * 2;
    pDyn[i4 + 1] = energy;
    pDyn[i4 + 2] = py < -0.2 ? 0 : sizeMul;
    pDyn[i4 + 3] = facing;
  }
}

function cacheExplosion() {
  const sph = sphereState(TE);
  for (const arm of ARMS) { poseArm(arm, TE, sph); writeArmParticles(arm, TE, sph); }
  p0.set(pPos.subarray(0, NA * 3));
  for (let i = 0; i < NA; i++) e0[i] = pDyn[i * 4 + 2];
  explosionCached = true;
}

function writeExplosion(t) {
  const te = t - TE;
  const C = sphCR(TE)[0];
  const k = 1.5;
  const fl = (1 - Math.exp(-k * te)) / k;
  const drift = sstep(0.4, 3.5, te);
  for (let i = 0; i < NA; i++) {
    const i3 = i * 3, i4 = i * 4;
    if (e0[i] <= 0 || p0[i3 + 1] < -0.05) { pDyn[i4 + 2] = 0; continue; }
    const sa = seedA[i], sb = seedB[i];
    let dx = p0[i3] - C[0], dy = p0[i3 + 1] - C[1], dz = p0[i3 + 2] - C[2];
    const d = Math.hypot(dx, dy, dz) || 1;
    dx /= d; dy /= d; dz /= d;
    const rx = Math.sin(sa * 127.1 + sb * 311.7), ry = Math.sin(sa * 269.5 + sb * 183.3), rz = Math.sin(sa * 419.2 + sb * 371.9);
    dx += rx * 0.45; dy += ry * 0.45 + 0.18; dz += rz * 0.45;
    const dn = Math.hypot(dx, dy, dz);
    const near = Math.exp(-Math.max(d - 1, 0) * 0.25);
    const speed = (4 + 13 * sb * sb) * (0.35 + 0.8 * near);
    let px = p0[i3] + (dx / dn) * speed * fl;
    let py = p0[i3 + 1] + (dy / dn) * speed * fl - 0.22 * te * te * (0.5 + sa);
    let pz = p0[i3 + 2] + (dz / dn) * speed * fl;
    px += drift * 0.35 * Math.sin(py * 0.7 + te * 0.5 + sa * 6);
    pz += drift * 0.35 * Math.sin(px * 0.6 - te * 0.4 + sb * 6);
    py += drift * 0.18 * Math.sin(pz * 0.8 + te * 0.6);
    const sz = pInfo[i4 + 1];
    if (py < sz * 0.4) py = sz * 0.4;
    pPos[i3] = px; pPos[i3 + 1] = py; pPos[i3 + 2] = pz;
    pDyn[i4] = (8 + 30 * sa) * fl * (sb > 0.5 ? 1 : -1) + te * 0.6;
    pDyn[i4 + 1] = 2.6 * Math.exp(-te * 2.2) * (0.3 + 0.7 * sa) * near + 0.2 * Math.exp(-te * 0.5) * sa * sa;
    pDyn[i4 + 2] = e0[i] * (1 - 0.25 * sstep(1, 5, te) * sb);
    pDyn[i4 + 3] = 0.6 * Math.exp(-te * 0.6) + 0.15;
  }
}

function writeDroplets(t) {
  for (let k = 0; k < ND; k++) {
    const i = NA + k, i3 = i * 3, i4 = i * 4;
    const d = dropDefs[k];
    const tau = t - d.t0 - d.delay;
    if (tau < 0 || tau > d.life) { pDyn[i4 + 2] = 0; continue; }
    const [C, R] = sphCR(d.t0);
    const kk = 2.2;
    const f = (1 - Math.exp(-kk * tau)) / kk;
    const o = add(C, scl(d.dir, R * 1.01));
    pPos[i3] = o[0] + d.dir[0] * d.speed * f + d.jit[0] * 0.04 * tau;
    pPos[i3 + 1] = o[1] + d.dir[1] * d.speed * f - 1.7 * tau * tau + d.jit[1] * 0.04 * tau;
    pPos[i3 + 2] = o[2] + d.dir[2] * d.speed * f + d.jit[2] * 0.04 * tau;
    if (pPos[i3 + 1] < d.size * 0.5) pPos[i3 + 1] = d.size * 0.5;
    pDyn[i4] = 0;
    pDyn[i4 + 1] = Math.exp(-tau * 1.5);
    pDyn[i4 + 2] = sstep(0, 0.04, tau) * (1 - sstep(d.life * 0.55, d.life, tau));
    pDyn[i4 + 3] = 0;
  }
}

// ---------------------------------------------------------------- camera
// time, position, target, fov, depth-of-field aperture (px of blur at 1080p)
const CAM_KEYS = [
  [0.0, [0.0, 4.3, 14.5], [0, 0.6, 0], 36, 0],
  [2.2, [0.3, 3.8, 12.6], [0, 0.2, 0], 36, 1],
  [5.2, [1.0, 3.1, 9.8], [0, 0.0, 0], 36, 3],
  [8.2, [2.4, 2.3, 8.0], [0, 1.9, 0], 36, 5],
  [10.0, [4.8, 1.5, 5.6], [0.3, 1.9, 0.2], 36, 8],
  [12.2, [5.0, 0.9, 2.5], [0.7, 1.7, 0.4], 34, 12],
  [13.6, [3.7, 0.8, 1.0], [0.5, 1.9, 0.3], 32, 15],
  [15.8, [5.6, 0.8, -1.1], [0.4, 1.6, 0.1], 38, 18],
  [17.6, [6.2, 1.2, -2.2], [0.0, 1.9, 0.0], 40, 15],
  [18.8, [7.4, 2.2, 3.6], [0.0, 2.0, 0.0], 40, 11],
  [20.2, [2.6, 2.9, 9.4], [0.0, 2.0, 0.0], 40, 9],
  [21.7, [-3.2, 3.4, 9.6], [0.0, 2.1, 0.0], 41, 8],
  [23.7, [-2.4, 2.9, 7.8], [0.0, 2.2, 0.0], 38, 8],
  [24.2, [-2.3, 2.8, 7.6], [0.0, 2.2, 0.0], 38, 8],
  [25.6, [-3.7, 3.5, 11.2], [0.0, 2.0, 0.0], 45, 6],
  [30.0, [-4.6, 4.3, 13.8], [0.0, 2.1, 0.0], 43, 4],
];
function hermite(keys, t, sel) {
  const n = keys.length;
  if (t <= keys[0][0]) return sel(keys[0]);
  if (t >= keys[n - 1][0]) return sel(keys[n - 1]);
  let i = 0;
  while (t > keys[i + 1][0]) i++;
  const t0 = keys[i][0], t1 = keys[i + 1][0], h = t1 - t0, s = (t - t0) / h;
  const P = (j) => sel(keys[clamp(j, 0, n - 1)]);
  const T = (j) => keys[clamp(j, 0, n - 1)][0];
  const tan = (j) => {
    const a = clamp(j - 1, 0, n - 1), b = clamp(j + 1, 0, n - 1);
    const pa = P(a), pb = P(b), dt = T(b) - T(a);
    return Array.isArray(pa) ? scl(sub(pb, pa), 1 / dt) : (pb - pa) / dt;
  };
  const h00 = 2 * s * s * s - 3 * s * s + 1, h10 = s * s * s - 2 * s * s + s, h01 = -2 * s * s * s + 3 * s * s, h11 = s * s * s - s * s;
  const p0v = P(i), p1v = P(i + 1), m0 = tan(i), m1 = tan(i + 1);
  if (Array.isArray(p0v)) return add(add(scl(p0v, h00), scl(m0, h10 * h)), add(scl(p1v, h01), scl(m1, h11 * h)));
  return p0v * h00 + m0 * h10 * h + p1v * h01 + m1 * h11 * h;
}
function cameraAt(t) {
  let pos = hermite(CAM_KEYS, t, (k) => k[1]);
  let tgt = hermite(CAM_KEYS, t, (k) => k[2]);
  const fov = hermite(CAM_KEYS, t, (k) => k[3]);
  const aper = Math.max(0, hermite(CAM_KEYS, t, (k) => k[4]));
  const focus = len(sub(tgt, pos));
  const S = struggle(t);
  let amp = 0.003 + 0.03 * S * S + (t > TL.climax ? 0.03 * ssm(TL.climax, TL.inhale, t) : 0);
  if (t >= TE) {
    const te = t - TE;
    amp = 0.004 + 0.28 * Math.exp(-3.5 * te);
    const back = nrm(sub(pos, tgt));
    pos = add(pos, scl(back, 1.3 * (1 - Math.exp(-7 * te)) * Math.exp(-0.6 * te)));
  }
  const { f } = joltAt(Math.min(t, TE));
  amp += 0.02 * f * (t > TL.dimStart ? 1 : 0);
  const sh = [wob(t * 13, 0.3), wob(t * 11.7, 2.1), wob(t * 12.3, 4.4)];
  const sh2 = [wob(t * 9.1, 5.3), wob(t * 10.3, 6.7), wob(t * 8.7, 8.9)];
  pos = add(pos, scl(sh, amp));
  tgt = add(tgt, scl(sh2, amp * 0.6));
  if (pos[1] < 0.35) pos[1] = 0.35;
  return { pos, tgt, fov, aper, focus };
}

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('c');
canvas.width = OW; canvas.height = OH;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, alpha: false });
renderer.setPixelRatio(1);
renderer.setSize(OW, OH, false);
const gl = renderer.getContext();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 400);

const v4s = (n) => Array.from({ length: n }, () => new THREE.Vector4());
const worldMat = new THREE.ShaderMaterial({
  vertexShader: quadVert,
  fragmentShader: worldFrag,
  depthTest: true,
  depthWrite: true,
  depthFunc: THREE.AlwaysDepth,
  uniforms: {
    uCamWorld: { value: new THREE.Matrix4() }, uProjInv: { value: new THREE.Matrix4() }, uViewProj: { value: new THREE.Matrix4() },
    uCamPos: { value: new THREE.Vector3() }, uTime: { value: 0 },
    uSph: { value: new THREE.Vector4() }, uSphA: { value: new THREE.Vector4() }, uSphB: { value: new THREE.Vector4() },
    uFlA: { value: new THREE.Vector4() }, uFlB: { value: new THREE.Vector4() }, uFlC: { value: new THREE.Vector4() }, uFlD: { value: new THREE.Vector4() },
    uSlA: { value: v4s(18) }, uSlB: { value: v4s(18) }, uCapA: { value: v4s(48) }, uCapB: { value: v4s(48) },
    uEnv: { value: 1 }, uCol1: { value: new THREE.Vector3() }, uCol2: { value: new THREE.Vector3() }, uCol3: { value: new THREE.Vector3() },
    uStrange: { value: 0 }, uLightCol: { value: new THREE.Vector3() }, uTension: { value: 0 }, uFogD: { value: 0.03 }, uColPhase: { value: 0 },
    uSun: { value: new THREE.Vector3(...SUN) }, uSunCol: { value: new THREE.Vector3() }, uZen: { value: new THREE.Vector3() }, uHor: { value: new THREE.Vector3() },
  },
});
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), worldMat);
quad.frustumCulled = false;
quad.renderOrder = -1;
scene.add(quad);

const pGeo = new THREE.BufferGeometry();
const posAttr = new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage);
const dynAttr = new THREE.BufferAttribute(pDyn, 4).setUsage(THREE.DynamicDrawUsage);
pGeo.setAttribute('position', posAttr);
pGeo.setAttribute('iDyn', dynAttr);
pGeo.setAttribute('iQuat', new THREE.BufferAttribute(pQuat, 4));
pGeo.setAttribute('iInfo', new THREE.BufferAttribute(pInfo, 4));
pGeo.setAttribute('iAxis', new THREE.BufferAttribute(pAxis, 3));
const partMat = new THREE.ShaderMaterial({
  vertexShader: partVert,
  fragmentShader: partFrag,
  uniforms: {
    uViewH: { value: IH }, uP11: { value: 1 }, uUpV: { value: new THREE.Vector3() }, uSunV: { value: new THREE.Vector3() },
    uSunCol: { value: new THREE.Vector3() }, uZen: { value: new THREE.Vector3() }, uHor: { value: new THREE.Vector3() },
    uSphV: { value: new THREE.Vector3() }, uLightCol: { value: new THREE.Vector3() }, uEmisCol: { value: new THREE.Vector3() },
    uC1: { value: new THREE.Vector3() }, uC2: { value: new THREE.Vector3() }, uC3: { value: new THREE.Vector3() }, uDropGlow: { value: 1 },
    uEnv: { value: 1 }, uFogCol: { value: new THREE.Vector3() }, uFogD: { value: 0.03 },
  },
});
const points = new THREE.Points(pGeo, partMat);
points.frustumCulled = false;
scene.add(points);

// post pipeline
const sceneRT = new THREE.WebGLRenderTarget(IW, IH, { type: THREE.HalfFloatType, depthBuffer: true });
sceneRT.depthTexture = new THREE.DepthTexture(IW, IH, THREE.FloatType);
const dofRT = new THREE.WebGLRenderTarget(IW / 2, IH / 2, { type: THREE.HalfFloatType, depthBuffer: false });
const combRT = new THREE.WebGLRenderTarget(IW, IH, { type: THREE.HalfFloatType, depthBuffer: false });
const passVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const dofUniforms = () => ({
  tColor: { value: sceneRT.texture }, tDepth: { value: sceneRT.depthTexture }, uTexel: { value: new THREE.Vector2(1 / IW, 1 / IH) },
  uNear: { value: 0.1 }, uFar: { value: 400 }, uFocus: { value: 8 }, uAper: { value: 0 }, uMaxCoc: { value: 20 },
});
const dofMat = new THREE.ShaderMaterial({ uniforms: dofUniforms(), vertexShader: passVert, fragmentShader: dofFrag });
const combMat = new THREE.ShaderMaterial({ uniforms: { ...dofUniforms(), tBlur: { value: dofRT.texture } }, vertexShader: passVert, fragmentShader: dofCombineFrag });
const gradeMat = new THREE.ShaderMaterial({
  uniforms: {
    tDiffuse: { value: null }, uSrcRes: { value: new THREE.Vector2(IW, IH) }, uExposure: { value: 1.6 }, uFlash: { value: 0 },
    uFade: { value: 0 }, uVig: { value: 0.2 }, uCA: { value: 0.001 }, uGrain: { value: 0.02 }, uTime: { value: 0 },
    uShock: { value: new THREE.Vector4(0.5, 0.5, 0, 0) }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uContrast: { value: 1.05 },
  },
  vertexShader: passVert,
  fragmentShader: gradeFrag,
});
const fsq = new FullScreenQuad(null);
const bloom = new UnrealBloomPass(new THREE.Vector2(IW, IH), 0.3, 0.6, 1.2);

// ---------------------------------------------------------------- frame
const _v = new THREE.Vector3();
const SKY_ZEN = [0.48, 0.49, 0.515], SKY_HOR = [0.62, 0.625, 0.64], SUN_COL = [0.42, 0.40, 0.37];
function setFrame(t) {
  const sph = sphereState(t);
  const fl = floorState(t);
  const env = envAt(t);
  const S = struggle(t);
  const cam = cameraAt(t);
  camera.fov = cam.fov;
  camera.position.set(...cam.pos);
  camera.lookAt(...cam.tgt);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  // colours
  const strange = t < TL.dimStart ? mix(0.12, 0.35, ssm(TL.pinch, TL.dimStart, t)) : mix(0.35, 0.85, ssm(TL.dimStart, TL.climax, t));
  let c1 = palette(sph.phi);
  let c2 = palette(sph.phi + 1.0);
  let c3 = palette(sph.phi + 2.0);
  const preColor = t < TL.pinch ? ssm(TL.riseStart + 1.2, TL.pinch, t) : 1;
  c1 = lerp3([1, 1, 1], c1, preColor);
  c2 = lerp3([1, 1, 1], c2, preColor);
  c3 = lerp3([1, 1, 1], c3, preColor);
  const avg = lerp3(c1, lerp3(c2, c3, 0.5), strange * 0.5);
  let lightCol = scl(avg, sph.glow * 0.08);
  lightCol = lerp3(lightCol, scl([1, 1, 1], sph.glow * 0.08), sph.white);
  const darkTint = scl(avg, (1 - Math.min(env, 1)) * 0.035 * (t < TE ? 1 : 0));
  const zen = add(scl(SKY_ZEN, env), darkTint);
  const hor = add(scl(SKY_HOR, env), darkTint);
  const sunCol = scl(SUN_COL, env * env);
  const fogD = t < TL.dimStart ? 0.022 : t < TE ? mix(0.022, 0.04, ssm(TL.dimStart, TL.climax, t)) : mix(0.04, 0.02, ssm(TE, TE + 2, t));

  const u = worldMat.uniforms;
  u.uCamWorld.value.copy(camera.matrixWorld);
  u.uProjInv.value.copy(camera.projectionMatrixInverse);
  u.uViewProj.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  u.uCamPos.value.copy(camera.position);
  u.uTime.value = t;
  u.uSph.value.set(sph.C[0], sph.C[1], sph.C[2], sph.R);
  u.uSphA.value.set(sph.amp, sph.freq, sph.nT, sph.colorAmt);
  u.uSphB.value.set(sph.stretch, Math.max(sph.glow, 0.0), sph.tail, sph.iT);
  u.uFlA.value.set(fl.D, fl.W, fl.rinA, fl.rinP);
  u.uFlB.value.set(sph.colR, sph.colTop, sph.k1, sph.k2);
  u.uFlC.value.set(fl.remH, fl.remW, fl.shockR, fl.shockA);
  u.uFlD.value.set(fl.routA, fl.routP, t >= TE && fl.shockA > 0.01 ? 0.8 : 1.0, sph.white);
  u.uEnv.value = env;
  u.uCol1.value.set(...c1); u.uCol2.value.set(...c2); u.uCol3.value.set(...c3);
  u.uStrange.value = strange;
  u.uLightCol.value.set(...lightCol);
  u.uTension.value = S;
  u.uFogD.value = fogD;
  u.uColPhase.value = sph.phi;
  u.uSunCol.value.set(...sunCol); u.uZen.value.set(...zen); u.uHor.value.set(...hor);

  // arms, sleeves, occlusion capsules
  const slA = u.uSlA.value, slB = u.uSlB.value, capA = u.uCapA.value, capB = u.uCapB.value;
  for (let i = 0; i < 48; i++) capB[i].set(0, 0, 0, 0);
  if (t < TE) {
    let ci = 0;
    ARMS.forEach((arm, ai) => {
      poseArm(arm, t, sph);
      writeArmParticles(arm, t, sph);
      const cr = arm.active ? arm.cross : null;
      if (cr) {
        const rise = sat((arm.tip[1] + 0.2) / 1.2);
        const hs = cr.r * (1.5 + 0.3 * Math.sin(t * 1.1 + arm.phase)) * cr.str * rise + 0.05;
        const A = sub(cr.X, scl(cr.dir, 0.6)), Bp = add(cr.X, scl(cr.dir, hs));
        slA[ai].set(A[0], A[1], A[2], cr.r * 0.88 * cr.str);
        slB[ai].set(Bp[0], Bp[1], Bp[2], (0.3 + 0.95 * cr.r) * cr.str);
        arm.sleeveAtTE = [A, Bp, cr.r * 0.88 * cr.str, (0.3 + 0.95 * cr.r) * cr.str];
      } else { slA[ai].set(0, 0, 0, 0); slB[ai].set(0, 0, 0, 0); arm.sleeveAtTE = null; }
      if (arm.active) {
        const handC = add(arm.W, scl(arm.B.Y, arm.S * 0.35));
        if (!arm.far) { capA[ci].set(...arm.Sh, 0.22 * arm.S); capB[ci].set(...arm.E, 1); ci++; }
        capA[ci].set(...arm.E, 0.17 * arm.S); capB[ci].set(...arm.W, 1); ci++;
        capA[ci].set(...arm.W, 0.2 * arm.S); capB[ci].set(...handC, 0.9); ci++;
      }
    });
  } else {
    if (!explosionCached) cacheExplosion();
    writeExplosion(t);
    const te = t - TE;
    ARMS.forEach((arm, ai) => {
      const s = arm.sleeveAtTE;
      if (!s || te > 1.2) { slA[ai].set(0, 0, 0, 0); slB[ai].set(0, 0, 0, 0); return; }
      const f = Math.exp(-te * 5);
      const Bp = lerp3(s[0], s[1], f);
      slA[ai].set(s[0][0], s[0][1], s[0][2], s[2] * f);
      slB[ai].set(Bp[0], Bp[1], Bp[2], s[3] * Math.max(f, 0.3));
    });
  }
  writeDroplets(t);
  posAttr.needsUpdate = true;
  dynAttr.needsUpdate = true;

  const pu = partMat.uniforms;
  const V = camera.matrixWorldInverse;
  pu.uP11.value = camera.projectionMatrix.elements[5];
  pu.uUpV.value.set(0, 1, 0).transformDirection(V);
  pu.uSunV.value.set(...SUN).transformDirection(V);
  pu.uSunCol.value.set(...sunCol); pu.uZen.value.set(...zen); pu.uHor.value.set(...hor);
  pu.uSphV.value.set(...sph.C).applyMatrix4(V);
  pu.uLightCol.value.set(...lightCol);
  const ec = lerp3(lerp3(avg, [1, 1, 1], 0.35), [1, 1, 1], sph.white);
  pu.uEmisCol.value.set(...scl(ec, 1.4));
  pu.uC1.value.set(...c1); pu.uC2.value.set(...c2); pu.uC3.value.set(...c3);
  pu.uDropGlow.value = 0.55 + 0.22 * sph.glow;
  pu.uEnv.value = env;
  pu.uFogCol.value.set(...hor);
  pu.uFogD.value = fogD;

  // depth of field
  for (const m of [dofMat, combMat]) {
    m.uniforms.uFocus.value = cam.focus;
    m.uniforms.uAper.value = cam.aper;
    m.uniforms.uMaxCoc.value = Math.max(cam.aper * 1.25, 2);
  }

  // post
  const te = t - TE;
  const jf = joltAt(Math.min(t, TE)).f;
  bloom.threshold = t < TL.dimStart ? 1.15 : t < TE ? mix(1.15, 0.55, ssm(TL.dimStart, TL.dimStart + 1.8, t)) : mix(0.35, 1.15, ssm(TE + 0.3, TE + 2.0, t));
  bloom.strength = t < TL.dimStart ? 0.45 : t < TE ? 0.6 + 0.6 * S + 0.25 * jf : 0.45 + 2.0 * Math.exp(-2 * te);
  bloom.radius = 0.55 + 0.25 * S;
  const g = gradeMat.uniforms;
  g.uTime.value = t;
  g.uExposure.value = 1.6 * (t >= TL.inhale && t < TE ? 1 - 0.2 * ssm(TL.inhale, TE, t) : 1);
  g.uFlash.value = t >= TE ? 2.5 * Math.exp(-te * 4.5) : 0;
  g.uFade.value = ssm(TL.fadeStart, TL.duration, t);
  g.uVig.value = mix(0.25, 0.6, 1 - Math.min(env, 1));
  g.uCA.value = 0.0015 + 0.006 * S * S + 0.004 * jf + (t >= TE ? 0.03 * Math.exp(-te * 3) : 0);
  g.uGrain.value = 0.02 + 0.012 * (1 - Math.min(env, 1));
  if (t >= TE) {
    _v.set(...sphCR(TE)[0]).project(camera);
    g.uShock.value.set(_v.x * 0.5 + 0.5, _v.y * 0.5 + 0.5, 0.05 + 1.25 * (1 - Math.exp(-1.6 * te)), 1.4 * Math.exp(-2.2 * te));
  } else g.uShock.value.set(0.5, 0.5, 0, 0);
  const cool = 1 - Math.min(env, 1);
  g.uTint.value.set(1 - 0.035 * cool, 1, 1 + 0.045 * cool);
  return cam;
}

function renderAt(t) {
  const t00 = performance.now();
  const cam = setFrame(t);
  if (DBG.includes('prof')) console.log('setFrame', (performance.now()-t00).toFixed(0));
  const T = [performance.now()];
  points.visible = !DBG.includes('noparts');
  quad.visible = !DBG.includes('noworld');
  renderer.setRenderTarget(sceneRT);
  renderer.render(scene, camera);
  if (DBG.includes('prof')) { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); T.push(performance.now()); }
  let src = sceneRT;
  if (cam.aper > 0.4 && !DBG.includes('nodof')) {
    fsq.material = dofMat; renderer.setRenderTarget(dofRT); fsq.render(renderer);
    fsq.material = combMat; renderer.setRenderTarget(combRT); fsq.render(renderer);
    src = combRT;
  }
  bloom.render(renderer, null, src, 0, false);
  gradeMat.uniforms.tDiffuse.value = src.texture;
  fsq.material = gradeMat;
  renderer.setRenderTarget(null);
  fsq.render(renderer);
  if (DBG.includes('prof')) { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); T.push(performance.now()); console.log('scene', (T[1]-T[0]).toFixed(0), 'post', (T[2]-T[1]).toFixed(0)); }
}

let readBuf = null;
function readRGB() {
  if (!readBuf) readBuf = new Uint8Array(OW * OH * 4);
  gl.readPixels(0, 0, OW, OH, gl.RGBA, gl.UNSIGNED_BYTE, readBuf);
  const rgb = new Uint8Array(OW * OH * 3);
  for (let i = 0, j = 0; i < readBuf.length; i += 4, j += 3) { rgb[j] = readBuf[i]; rgb[j + 1] = readBuf[i + 1]; rgb[j + 2] = readBuf[i + 2]; }
  return rgb;
}
function toB64(u8) {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return btoa(s);
}

window.renderFrame = (t) => { renderAt(t); return toB64(readRGB()); };
window.renderStill = (t) => { renderAt(t); return canvas.toDataURL('image/png'); };
window.timeline = TL;
window.ready = true;
