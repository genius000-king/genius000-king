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

function struggle(t) { return Math.pow(ssm(TL.dimStart, TL.inhale, t), 1.15); }
// three lighting moods: the white void, the grey haze of the reference image, the dark climax
const MOOD = {
  void: { zen: [0.82, 0.83, 0.86], hor: [0.98, 0.98, 1.0], sun: [0.1, 0.1, 0.095] },
  ref: { zen: [0.165, 0.17, 0.185], hor: [0.53, 0.52, 0.515], sun: [0.13, 0.125, 0.115] },
  dark: { zen: [0.045, 0.046, 0.055], hor: [0.13, 0.128, 0.135], sun: [0.02, 0.02, 0.02] },
};
function moodAt(t) {
  const L = (k) => {
    let v = MOOD.void[k];
    v = lerp3(v, MOOD.ref[k], ssm(9.6, 13.4, t));
    v = lerp3(v, MOOD.dark[k], Math.pow(ssm(TL.hero[1], TL.inhale + 0.3, t), 1.2));
    if (t >= TE) v = lerp3(MOOD.dark[k], MOOD.void[k], ssm(TE + 0.05, TE + 1.8, t));
    return v;
  };
  const zen = L('zen'), hor = L('hor'), sun = L('sun');
  const env = (zen[1] + hor[1]) / (MOOD.ref.zen[1] + MOOD.ref.hor[1]);
  return { zen, hor, sun, env };
}
function envAt(t) { return moodAt(t).env; }
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
  return 0.69 + 3.0 * Math.pow(struggle(t), 1.6);
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

const PHI0 = integrate(colorRate, TL.pinch);
const PHI_FIX = (() => { const p = integrate(colorRate, TL.heroFrame) - PHI0; return Math.ceil(p / 9) * 9 - p; })();
function sphereState(t, light = false) {
  const st = {
    C: [0, -6, 0], R: 0.5, amp: 0.03, freq: 1.4, nT: 0, colorAmt: 0, stretch: 1, glow: 0, tail: 0, iT: 0,
    colR: -1, colTop: 0, k1: 0.5, k2: 0, white: 0, phi: 0,
  };
  if (!light) {
    st.nT = integrate((x) => 0.35 + 2.4 * struggle(x) + (x > TE ? 0.6 * Math.exp(-(x - TE) * 2) : 0), t);
    st.iT = integrate((x) => 0.5 + 2.5 * struggle(x), t);
    st.phi = integrate(colorRate, t) - PHI0;
    st.phi += PHI_FIX * ssm(11.4, 13.4, t);
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
    { k: [0.150, 0.43, 0], fan: 8, L: [0.22, 0.13, 0.105], r: [0.042, 0.037, 0.032, 0.026] },
    { k: [0.048, 0.455, 0], fan: 1, L: [0.24, 0.145, 0.11], r: [0.044, 0.038, 0.033, 0.027] },
    { k: [-0.058, 0.44, 0], fan: -7, L: [0.225, 0.14, 0.105], r: [0.041, 0.036, 0.031, 0.026] },
    { k: [-0.150, 0.395, 0], fan: -16, L: [0.18, 0.105, 0.095], r: [0.036, 0.031, 0.027, 0.023] },
    { k: [0.085, 0.095, 0.03], dir: [0.66, 0.66, 0.36], L: [0.20, 0.15, 0.12], r: [0.058, 0.05, 0.044, 0.037], thumb: true },
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
const SPREAD_W = [1.2, 0.1, -0.9, -1.8, 1.0];

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

// ---------------------------------------------------------------- hero camera
// Solved so that one stretch of the film reproduces the reference image: camera
// 0.86 above the floor, horizon at 69% of the frame height, sphere centre at
// (60%, 27%) of the frame and its diameter ≈ 55% of the frame height.
const REF_W = 1672, REF_H = 941;
const HERO = (() => {
  const az = (20 * Math.PI) / 180, hd = 4.86, hc = 0.86, fov = 40;
  const P = [C0[0] + Math.sin(az) * hd, hc, C0[2] + Math.cos(az) * hd];
  const th = Math.tan((fov * Math.PI) / 360), asp = 16 / 9;
  const basis = (yaw, pitch) => {
    const f = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
    const r = nrm(cross(f, [0, 1, 0]));
    return { f, r, u: cross(r, f) };
  };
  const proj = (yaw, pitch, X) => { const B = basis(yaw, pitch); const d = sub(X, P); const z = dot(d, B.f); return [dot(d, B.r) / z / (th * asp), dot(d, B.u) / z / th]; };
  const target = [(1000 / REF_W) * 2 - 1, 1 - (250 / REF_H) * 2];
  let yaw = Math.atan2(C0[0] - P[0], C0[2] - P[2]), pitch = 0.14;
  for (let it = 0; it < 40; it++) {
    const p = proj(yaw, pitch, C0), h = 1e-5;
    const px = proj(yaw + h, pitch, C0), py = proj(yaw, pitch + h, C0);
    const J = [(px[0] - p[0]) / h, (py[0] - p[0]) / h, (px[1] - p[1]) / h, (py[1] - p[1]) / h];
    const e0 = target[0] - p[0], e1 = target[1] - p[1];
    const det = J[0] * J[3] - J[1] * J[2];
    yaw += (J[3] * e0 - J[1] * e1) / det;
    pitch += (-J[2] * e0 + J[0] * e1) / det;
  }
  const B = basis(yaw, pitch);
  const ray = (px, py) => nrm(add(B.f, add(scl(B.r, ((px / REF_W) * 2 - 1) * th * asp), scl(B.u, (1 - (py / REF_H) * 2) * th))));
  return { pos: P, tgt: add(P, scl(B.f, 5)), fov, B, ray, th, az: Math.atan2(P[0] - C0[0], P[2] - C0[2]) };
})();
function refFloor(px, py, dmin, dmax) {
  const d = HERO.ray(px, py);
  const dh = Math.hypot(d[0], d[2]);
  let th = d[1] < -1e-4 ? (-HERO.pos[1] / d[1]) * dh : dmax;
  th = clamp(th, dmin, dmax);
  return [HERO.pos[0] + (d[0] / dh) * th, 0, HERO.pos[2] + (d[2] / dh) * th];
}
// a direction expressed in the hero camera's frame (right, up, toward camera)
const heroDir = (x, y, z) => nrm(add(add(scl(HERO.B.r, x), [0, y, 0]), scl(HERO.B.f, -z)));

// ---------------------------------------------------------------- arms
// hero:  rises beside the sphere and grips its left side, as in the reference.
// mid:   the three nearer background hands of the reference — rise, claw, then lunge in.
// field: the small far hands near the horizon of the reference — they only claw.
// side:  hands from outside the hero frame that join the struggle later.
function armList() {
  const L = [];
  const g = TL.hands, f = TL.field;
  const qv = (k, d) => (Q.get(k) ? Q.get(k).split(',').map(Number) : d);
  L.push({ type: 'hero', S: +(Q.get('hs') || 1.6), mir: -1, u: heroDir(...qv('hu', [-0.85, -0.25, 0.45])), hint: heroDir(...qv('hh', [1, 0.75, 0])),
           fdir: heroDir(...qv('hf', [-0.07, -1, 0.2])), ulean: 0.5, gap: +(Q.get('hgap') || 0.28), foreK: 1.3,
           lean: -0.15, reachK: 0.5, yLean: 0.0, t0: g[0][0], t1: g[0][1] });
  const mids = [[1490, 775, 250, 0.15], [300, 700, 290, 0.35]];
  mids.forEach(([px, py, ph, elev], k) => L.push({ type: 'mid', ref: [px, py, ph], dmin: 6.5, dmax: 10.5, mir: k % 2 ? -1 : 1, elev,
    t0: g[k + 1][0], t1: g[k + 1][1], lean: 0.45, gap: 0.24 }));
  L.push({ type: 'field', ref: [1250, 720, 120], dmin: 6.5, dmax: 12, mir: 1, t0: g[3][0], lean: 0.4 });
  const fields = [[970, 705, 65], [1115, 715, 65], [115, 660, 125], [1050, 712, 32]];
  fields.forEach(([px, py, ph], k) => L.push({ type: 'field', ref: [px, py, ph], dmin: 13, dmax: 22, mir: k % 2 ? 1 : -1, t0: f[k], lean: 0.35 }));
  const sides = [[115, 4.8, 0.1], [95, 4.6, 0.55], [-100, 5.0, 0.25], [150, 5.5, -0.35], [-150, 5.2, 0.9], [60, 6.0, -0.5], [-60, 6.2, 1.25]];
  const slots = [3, 4, 5, 6, 7, 8, 9];
  sides.forEach(([az, dist, elev], k) => L.push({ type: 'side', az, dist, elev, mir: k % 2 ? -1 : 1, S: 1.3 + 0.1 * (k % 3), gap: 0.24,
    t0: g[slots[k]][0] + (k === 0 ? 2.7 : 0), t1: g[slots[k]][1], lean: 0.45 }));
  return L;
}

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

function gripPose(u, hint, S, ofs, ulean, fdir, gap = 0.065) {
  const v = nrm(sub(hint, scl(u, dot(hint, u))));
  const Z = scl(u, -1), Y = v, X = cross(Y, Z);
  const Rh = (R0 + 0.03) / S;
  const wOff = scl(add(scl(Y, 0.29), scl(Z, gap + Rh)), -S);
  const Wg = add(C0, wOff);
  const f = fdir || nrm(add(scl(v, -1), scl(u, ofs)));
  const L2 = 1.35 * S;
  const Eg = add(Wg, scl(f, L2));
  let out = [Eg[0] - C0[0], 0, Eg[2] - C0[2]];
  out = len(out) > 1e-3 ? nrm(out) : [0, 0, 1];
  const g = nrm(add(scl(out, ulean), [0, -1, 0]));
  const L1 = Math.max(1.45 * S, (Eg[1] + 1.7) / -g[1]);
  const Sh = add(Eg, scl(g, L1));
  const dSW = nrm(sub(Wg, Sh));
  const pole = nrm(sub(sub(Eg, Sh), scl(dSW, dot(sub(Eg, Sh), dSW))));
  const cr = crossFloor([Sh, Eg, Wg]);
  const X0 = cr ? cr.p : [Wg[0], 0, Wg[2]];
  return { u, v, wOff, L1, L2, Sh, pole, X0, Eg, qg: quatFromBasis(X, Y, Z), hover: add(scl(u, 0.85), scl(v, -0.45)) };
}
function reachPose(Xe, S, lean, k, yLean, faceCam = 0) {
  const toS = nrm(sub(C0, Xe));
  const hz = nrm([toS[0], 0, toS[2]]);
  const fup = nrm(add(scl(hz, lean), [0, 1, 0]));
  const L2 = 1.35 * S;
  const Wr = add(Xe, scl(fup, L2 * k));
  const Y = nrm(add(fup, scl(hz, yLean)));
  const toCam = nrm([HERO.pos[0] - Wr[0], 0, HERO.pos[2] - Wr[2]]);
  const dW = nrm(add(scl(nrm(sub(C0, Wr)), 1 - faceCam), scl(toCam, faceCam)));
  let Z = sub(dW, scl(Y, dot(dW, Y)));
  Z = len(Z) > 1e-3 ? nrm(Z) : hz;
  return { Wr, Y, fup, q: quatFromBasis(cross(Y, Z), Y, Z), Wstart: sub(Xe, scl(fup, L2 * 1.25)) };
}
function setupArm(d, idx) {
  let S = d.S, Xe, grip = null;
  if (d.type === 'mid' || d.type === 'field') {
    Xe = refFloor(d.ref[0], d.ref[1], d.dmin, d.dmax);
    const dist = len(sub(Xe, HERO.pos));
    S = clamp(((d.ref[2] / REF_H) * 2 * HERO.th * dist) / 1.95, 0.6, 2.4);
  }
  if (d.type === 'side') {
    const a = (d.az * Math.PI) / 180 + HERO.az;
    Xe = [C0[0] + Math.sin(a) * d.dist, 0, C0[2] + Math.cos(a) * d.dist];
  }
  if (d.type !== 'field') {
    let u, hint;
    if (d.type === 'hero') { u = d.u; hint = d.hint; }
    else {
      const hz = nrm([Xe[0] - C0[0], 0, Xe[2] - C0[2]]);
      u = nrm(add(hz, [0, d.elev, 0]));
      hint = Math.abs(u[1]) > 0.75 ? scl(hz, -1) : [0, 1, 0];
    }
    grip = gripPose(u, hint, S, d.ofs ?? 0.5, d.ulean ?? 0.5, d.fdir, d.gap);
    if (d.type === 'hero') {
      const out = nrm([grip.X0[0] - C0[0], 0, grip.X0[2] - C0[2]]);
      Xe = add(grip.X0, scl(add(out, scl(HERO.B.r, -0.6)), 0.9));
    }
  }
  const reach = reachPose(Xe, S, d.lean, d.reachK ?? 0.8, d.yLean ?? 0.4, d.type === 'mid' || d.type === 'field' ? 0.85 : 0);
  let tr, tm, t1;
  if (d.type === 'hero') { tr = d.t0 + 1.25; tm = tr; t1 = d.t1; }
  else if (d.type === 'mid') { tr = d.t0 + 1.4; t1 = d.t1; tm = t1 - 1.2; }
  else if (d.type === 'side') { tr = d.t0 + 1.0; t1 = d.t1; tm = t1 - 1.0; }
  else { tr = d.t0 + 1.4; tm = Infinity; t1 = Infinity; }
  return { idx, d, type: d.type, hero: d.type === 'hero', S, mir: d.mir, Xe, reach, grip, t0: d.t0, tr, tm, t1, foreK: d.foreK ?? 1,
           phase: idx * 1.7 + 0.3, L2: 1.35 * S, Eg: grip ? grip.Eg : sub(reach.Wr, scl(reach.Y, 1.35 * S)) };
}
const SUN = nrm(add(add(HERO.B.f, scl(HERO.B.r, 0.3)), [0, 0.5, 0]));
const KEY = nrm(add(add(scl(HERO.B.r, -0.5), [0, 0.6, 0]), scl(HERO.B.f, -0.65)));
const ARMS = armList().map(setupArm);
const NARM = ARMS.length;

// ---------------------------------------------------------------- particles
const SHAPE_CDF = [0.30, 0.46, 0.62, 0.80, 0.92, 1.0];
function pickShape(r) { let i = 0; while (r > SHAPE_CDF[i]) i++; return i; }

const plan = ARMS.map((a) => {
  const D = DENSITY;
  if (a.type === 'field') return { hand: Math.round(4000 * D), fore: Math.round(2500 * D), elbow: 0, upper: 0, debris: Math.round(400 * D) };
  const hero = a.hero;
  const upVis = Math.max(0.5, a.Eg[1] + 0.5);
  return {
    hand: Math.round((hero ? 15000 : 9500) * D),
    fore: Math.round((hero ? 15000 : 5500) * D),
    elbow: Math.round(600 * D),
    upper: Math.round(Math.min(8000, 1100 * upVis + 1400) * D),
    debris: Math.round((hero ? 3200 : 1200) * D),
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
    if (t > TL.hero[0] - 0.8 && t < TL.hero[1]) d += 9;
    return d;
  };
  const ts = [], cdf = [];
  let acc = 0;
  for (let t = TL.pinch; t < TE; t += 0.005) { acc += dens(t) * 0.005; ts.push(t); cdf.push(acc); }
  const gripping = (t) => ARMS.filter((a) => a.grip && a.t1 <= t);
  const group = (t0, dir, speed, size0, life, n, hue) => {
    for (let k = 0; k < n; k++) {
      dropDefs.push({ t0, dir, speed, size: Math.max(size0 * (1 - 0.1 * k), 0.006), life, delay: k * 0.016 + (rng() - 0.5) * 0.004, hue, jit: randUnit(rng) });
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
      dir = nrm(add(a.grip.u, scl(randUnit(rng), 0.6)));
    } else {
      dir = randUnit(rng);
      dir[1] = Math.abs(dir[1]) * 0.8 + 0.1;
      dir = nrm(dir);
    }
    const S = struggle(t0);
    const hr = rng();
    group(t0, dir, 0.7 + 2.6 * rng() + 3 * S, 0.016 + 0.045 * Math.pow(rng(), 1.5) * (0.6 + S), 0.35 + 0.6 * rng(),
          2 + Math.floor(rng() * 7), hr < 0.4 ? 0 : hr < 0.7 ? 1 : 2);
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
    const depth = size * (0.3 + 0.65 * k * k);
    pInfo[i * 4 + 3] = (0.72 + 0.28 * rng()) * (1 - 0.62 * sat((depth / size - 0.3) / 0.6));
    return depth;
  };
  ARMS.forEach((arm, ai) => {
    const pl = plan[ai];
    arm.start = i;
    const S = arm.S, sc = S / 2;
    for (let k = 0; k < pl.hand; k++, i++) {
      const smp = sampleHandSurface(rng);
      const fingerK = smp.bone === 0 ? 1.0 : 0.58;
      const size = common(0.016 * sc * fingerK, 0.068 * sc * fingerK, 1.9);
      const off = (-inset(size) + (rng() < 0.06 ? 0.03 * rng() : 0)) / S;
      kind[i] = 0; bone[i] = smp.bone;
      lp.set(add(smp.p, scl(smp.n, off)), i * 3);
      ln.set(smp.n, i * 3);
      uu[i] = 0.35 * (1 - sat(smp.p[1] / 0.95));
    }
    for (let k = 0; k < pl.fore; k++, i++) {
      const s = -0.06 + 1.1 * rng();
      const size = common(0.024 * sc * arm.foreK, (0.08 + 0.035 * sat(s)) * sc * arm.foreK, 1.6);
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
      const td = early ? arm.t0 + 0.25 + 1.1 * rng() : mix(arm.tr, TE - 0.3, Math.sqrt(rng()));
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
  let Qp = fg.thumb ? I3 : rotAxis([0, 0, 1], -spreadAng);
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
  if (!arm.grip) return t < arm.tr ? 0 : 0.15 + 0.5 * struggle(t);
  if (t < arm.t1) return 0.06 * sstep(arm.tr, arm.tr + 1, t);
  return ssm(arm.t1, arm.t1 + 0.8, t) * (0.3 + 0.7 * struggle(t));
}

const HANDTEST = DBG.includes('handtest');
function poseArm(arm, t, sph) {
  if (HANDTEST && !arm.hero) { arm.active = false; return; }
  if (t < arm.t0 && !HANDTEST) { arm.active = false; return; }
  arm.active = true;
  const tt = Math.min(t, TE);
  const tens = armTension(arm, tt);
  const mir = arm.mir, R = arm.reach, G = arm.grip;
  let W, q, curl, spread, cl = [0, 0, 50], Rh = 0.1, approach = 0;
  const claw = -0.1 + 0.25 * (0.5 + 0.5 * Math.sin(tt * 1.5 + arm.phase)) + 0.2 * tens;
  const sway = scl([Math.sin(tt * 0.7 + arm.phase), 0.5 * Math.sin(tt * 0.9 + arm.phase * 2), Math.sin(tt * 0.6 + arm.phase * 3)], arm.hero ? 0.03 : 0.1);
  const stance = arm.hero ? -0.2 : claw;
  if (tt < arm.tm) {
    const e = ssm(arm.t0, arm.tr, tt);
    W = add(lerp3(R.Wstart, R.Wr, e), scl(sway, e));
    q = R.q;
    curl = mix(-0.5, stance, ssm(arm.t0 + 0.4 * (arm.tr - arm.t0), arm.tr, tt));
    spread = 0.3;
    arm.tau = 0;
  } else {
    const tau = sat((tt - arm.tm) / (arm.t1 - arm.tm));
    const e = ssm(0, 1, tau);
    approach = Math.max(e, 1e-3);
    const Wg = add(add(sph.C, G.wOff), scl(G.u, (sph.R - R0) * 0.9));
    const Wr = add(R.Wr, sway);
    W = bezier(Wr, add(Wr, scl(R.fup, 0.6)), add(Wg, G.hover), Wg, e);
    q = new THREE.Quaternion().slerpQuaternions(R.q, G.qg, ssm(0.1, 0.8, tau));
    curl = tau < 1 ? mix(mix(stance, -0.6, ssm(0, 0.35, tau)), 1.0, ssm(0.78, 1.0, tau)) : 1.0;
    spread = mix(0.3, 0.06, ssm(0.75, 1.0, tau));
    arm.tau = tau;
  }
  let B = basisFromQuat(q);
  if (HANDTEST) {
    W = [0, 1, 0]; B = { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] };
    curl = +(Q.get('curl') || 0); spread = +(Q.get('spread') || 0.3); approach = 0;
  }
  if (approach > 0) {
    const { j } = joltAt(tt);
    W = add(W, scl(G.u, 0.05 * j * sat(arm.tau * 4 - 3)));
    W = add(W, scl(B.X, tens * 0.05 * Math.sin(tt * 13 + arm.phase)));
  }
  arm.W = W; arm.B = B; arm.tension = HANDTEST ? 0 : tens;
  const Xm = scl(B.X, mir);
  const Bm = [Xm[0], B.Y[0], B.Z[0], Xm[1], B.Y[1], B.Z[1], Xm[2], B.Y[2], B.Z[2]];
  arm.Bm = Bm;
  if (approach > 0) {
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
  const Estr = sub(W, scl(B.Y, arm.L2));
  if (approach === 0) {
    arm.E = Estr;
    arm.Sh = sub(Estr, scl(R.fup, 2.0));
  } else {
    const Sh = lerp3(sub(sub(R.Wr, scl(R.Y, arm.L2)), scl(R.fup, 2.0)), G.Sh, approach);
    const d0 = sub(W, Sh);
    let dl = len(d0);
    const dir = scl(d0, 1 / dl);
    let Eik;
    const L1 = G.L1, L2 = arm.L2;
    if (dl >= L1 + L2 - 1e-3) Eik = add(Sh, scl(dir, (dl * L1) / (L1 + L2)));
    else {
      dl = Math.max(dl, Math.abs(L1 - L2) + 1e-3);
      const a = (L1 * L1 - L2 * L2 + dl * dl) / (2 * dl);
      const h = Math.sqrt(Math.max(L1 * L1 - a * a, 0));
      const pp = nrm(sub(G.pole, scl(dir, dot(G.pole, dir))));
      Eik = add(add(Sh, scl(dir, a)), scl(pp, h));
    }
    const bl = ssm(0.3, 0.95, arm.tau);
    const Ed = nrm(lerp3(sub(Estr, W), sub(Eik, W), bl));
    arm.E = add(W, scl(Ed, L2));
    arm.Sh = Sh;
  }
  arm.tip = add(W, scl(B.Y, arm.S * 0.9));
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
  const dX = cr ? cr.X : [arm.Xe[0], 0, arm.Xe[2]];
  const dDir = cr ? cr.dir : [0, 1, 0];
  const dR = cr ? cr.r : 0.2 * S;
  const db1 = nrm(cross(dDir, [0, 0, 1])), db2 = cross(dDir, db1);
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
      const restC = arm.grip && td >= arm.tm ? arm.grip.X0 : arm.Xe;
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
      const rx = S * arm.foreK * mix(0.145, 0.205, sp) * (1 + 0.08 * Math.sin(Math.PI * sat(s))), rz = S * arm.foreK * mix(0.088, 0.17, sp);
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
    if (sb < (arm.hero ? 0.035 : 0.07) + 0.12 * tens && !HANDTEST) {
      const loose = (0.04 + tens * 0.35 + 0.12 * emerging) * (0.2 + sa) * (0.6 + 0.4 * Math.sin(t * 2.1 + sa * 40)) * (S / 2);
      px += nx * loose; py += ny * loose + loose * 0.3 * Math.sin(t * 1.3 + sb * 30); pz += nz * loose;
    }
    px += jitA * Math.sin(t * 47 + sa * 91);
    py += jitA * Math.sin(t * 53 + sb * 57);
    pz += jitA * Math.sin(t * 59 + sa * 23 + sb * 11);
    if (inh > 0 && arm.grip) {
      const f = 1 - 0.07 * inh;
      px = C[0] + (px - C[0]) * f; py = C[1] + (py - C[1]) * f; pz = C[2] + (pz - C[2]) * f;
    }
    // the limb crumbles where it leaves the liquid
    let sizeMul = 1;
    const crumble = 0.35 + 0.3 * S;
    if (py < sleeveTop + crumble) {
      const a = Math.pow(1 - sat((py - sleeveTop * 0.5) / crumble), 2) * floorAct * 0.8;
      const hx = Math.sin(sa * 71.3 + t * 0.7), hz = Math.sin(sb * 53.1 - t * 0.6);
      px += (hx * 0.3 + nx * 0.5) * a * 0.32 * (S / 2);
      pz += (hz * 0.3 + nz * 0.5) * a * 0.32 * (S / 2);
      py -= a * 0.05 * (0.5 + 0.5 * Math.sin(t * 2 + sa * 10));
      sizeMul = 1 + 0.5 * a * sb;
      if (py < 0) sizeMul *= sstep(-0.25, 0.05, py);
    }
    const dx = C[0] - px, dy = C[1] - py, dz = C[2] - pz;
    const dl = Math.hypot(dx, dy, dz);
    const facing = sat(((nx * dx + ny * dy + nz * dz) / dl) * 0.6 + 0.45);
    const surf = Math.max(dl - sph.R, 0);
    const energy = !arm.grip ? 0 : tens * (0.45 * Math.exp(-surf * 5) + 0.2 * Math.exp(-u * 3)) + inh * 0.8 * Math.exp(-surf * 2);
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
// The camera never stops: a drone glide over the white void, circling the well
// as it forms, craning up with the bulb, spinning around the newborn sphere,
// diving to the floor beside the first hand, sliding through the reference
// angle, whipping through the clutching hands, then thrown back by the blast.
// Orbit angles are in degrees relative to the hero camera and keep unwrapping
// (one long continuous spiral). aperture = depth-of-field blur in px at 720p.
function orbitKey(t, dAz, dist, h, ty, fov, aper) {
  const a = HERO.az + (dAz * Math.PI) / 180;
  return { t, pos: [C0[0] + Math.sin(a) * dist, h, C0[2] + Math.cos(a) * dist], tgt: [C0[0], ty, C0[2]], fov, aper };
}
function heroKey(t, dolly, side, rise, aper) {
  const d = add(add(scl(HERO.B.f, dolly), scl(HERO.B.r, side)), [0, rise, 0]);
  return { t, pos: add(HERO.pos, d), tgt: add(HERO.tgt, scl(d, 0.6)), fov: HERO.fov, aper };
}
// low along the floor beside the first hand as it rises out of the liquid
function diveKey(t) {
  const h1 = ARMS[0];
  const out = nrm([h1.Xe[0] - C0[0], 0, h1.Xe[2] - C0[2]]);
  const side = cross([0, 1, 0], out);
  return { t, pos: add(add(h1.Xe, scl(out, 2.4)), add(scl(side, -1.3), [0, 0.5, 0])), tgt: add(h1.reach.Wr, [0, 0.5, 0]), fov: 38, aper: 5 };
}
const CAM_KEYS = [
  orbitKey(0.0, 25, 17.0, 5.2, 0.0, 46, 0),
  orbitKey(1.6, 12, 13.0, 2.6, 0.0, 46, 0),
  orbitKey(3.0, -8, 9.0, 1.5, -0.2, 44, 1),
  orbitKey(4.3, -45, 5.6, 2.3, -0.5, 42, 2),
  orbitKey(5.5, -95, 4.4, 3.3, -0.3, 40, 2),
  orbitKey(6.7, -145, 4.0, 1.9, 1.0, 38, 3),
  orbitKey(7.8, -195, 4.4, 2.3, 2.0, 38, 3),
  orbitKey(8.8, -245, 3.4, 2.9, 2.4, 36, 4),
  orbitKey(9.8, -295, 3.6, 2.2, 2.3, 36, 4),
  diveKey(11.0),
  orbitKey(12.2, -345, 5.2, 0.85, 1.9, 39, 4),
  heroKey(TL.hero[0], -0.45, -0.35, 0.0, 3),
  heroKey(TL.heroFrame, 0, 0, 0, 3),
  heroKey(TL.hero[1], 0.3, 0.45, 0.12, 3.5),
  orbitKey(18.2, -385, 5.0, 2.0, 2.2, 40, 4),
  orbitKey(19.0, -425, 4.1, 2.9, 2.4, 40, 5),
  orbitKey(19.8, -470, 3.3, 1.5, 2.3, 40, 6),
  orbitKey(20.6, -515, 4.0, 3.4, 2.4, 40, 5),
  orbitKey(21.4, -560, 5.6, 4.4, 2.3, 42, 4),
  orbitKey(22.5, -600, 4.6, 5.2, 2.3, 42, 4),
  orbitKey(23.7, -640, 4.2, 4.6, 2.4, 40, 4),
  orbitKey(24.2, -650, 4.1, 4.4, 2.4, 40, 4),
  orbitKey(25.1, -690, 8.6, 3.3, 2.3, 44, 4),
  orbitKey(26.6, -712, 7.0, 1.6, 2.2, 42, 4),
  orbitKey(28.2, -735, 6.4, 2.4, 2.4, 40, 3),
  orbitKey(30.0, -760, 7.6, 3.3, 2.5, 40, 2),
];
function hermite(keys, t, sel) {
  const n = keys.length;
  if (t <= keys[0].t) return sel(keys[0]);
  if (t >= keys[n - 1].t) return sel(keys[n - 1]);
  let i = 0;
  while (t > keys[i + 1].t) i++;
  const t0 = keys[i].t, t1 = keys[i + 1].t, h = t1 - t0, s = (t - t0) / h;
  const P = (j) => sel(keys[clamp(j, 0, n - 1)]);
  const T = (j) => keys[clamp(j, 0, n - 1)].t;
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
const camPath = (t) => hermite(CAM_KEYS, t, (k) => k.pos);
function cameraAt(t) {
  let pos = camPath(t);
  let tgt = hermite(CAM_KEYS, t, (k) => k.tgt);
  const fov = hermite(CAM_KEYS, t, (k) => k.fov);
  const aper = Math.max(0, hermite(CAM_KEYS, t, (k) => k.aper));
  const S = struggle(t);
  // slower and steadier while passing through the reference angle
  const calm = 1 - 0.8 * (ssm(TL.hero[0] - 0.6, TL.heroFrame - 0.3, t) - ssm(TL.heroFrame + 0.3, TL.hero[1] + 0.4, t));
  // bank into the turns like a drone, plus a slow breathing roll
  const az = (p) => Math.atan2(p[0] - C0[0], p[2] - C0[2]);
  let dAz = az(camPath(t + 0.05)) - az(camPath(t - 0.05));
  dAz = Math.atan2(Math.sin(dAz), Math.cos(dAz)) / 0.1;
  let roll = clamp(0.07 * dAz, -0.2, 0.2) + 0.04 * Math.sin(0.47 * t) + 0.025 * Math.sin(1.13 * t + 1.0);
  roll *= mix(0.25, 1, calm);
  // floating drift (the camera "breathes" through the world)
  const drift = mix(0.25, 1, calm);
  pos = add(pos, scl([0.14 * Math.sin(0.61 * t), 0.09 * Math.sin(0.83 * t + 1.1), 0.14 * Math.sin(0.53 * t + 2.3)], drift));
  tgt = add(tgt, scl([0.08 * Math.sin(0.71 * t + 0.5), 0.06 * Math.sin(0.97 * t + 2.0), 0.08 * Math.sin(0.66 * t + 4.1)], drift));
  let amp = (0.003 + 0.03 * S * S + (t > TL.climax ? 0.035 * ssm(TL.climax, TL.inhale, t) : 0)) * calm;
  if (t >= TE) {
    const te = t - TE;
    amp = 0.004 + 0.3 * Math.exp(-3.5 * te);
    const back = nrm(sub(pos, tgt));
    pos = add(pos, scl(back, 1.6 * (1 - Math.exp(-7 * te)) * Math.exp(-0.7 * te)));
    roll += 0.25 * Math.exp(-2.5 * te) * Math.sin(te * 9);
  }
  const { f } = joltAt(Math.min(t, TE));
  amp += 0.02 * f * (t > TL.dimStart ? 1 : 0) * calm;
  const sh = [wob(t * 13, 0.3), wob(t * 11.7, 2.1), wob(t * 12.3, 4.4)];
  const sh2 = [wob(t * 9.1, 5.3), wob(t * 10.3, 6.7), wob(t * 8.7, 8.9)];
  pos = add(pos, scl(sh, amp));
  tgt = add(tgt, scl(sh2, amp * 0.6));
  // never inside the sphere, never under the liquid
  const C = sphCR(t)[0];
  const dc = sub(pos, C), dl = len(dc);
  if (dl < 1.9) pos = add(C, scl(dc, 1.9 / dl));
  if (pos[1] < 0.4) pos[1] = 0.4;
  const focus = len(sub(tgt, pos));
  return { pos, tgt, fov, aper, focus, roll };
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

const v4s = (n) => Array.from({ length: n }, () => new THREE.Vector4(0, 0, 0, 0));
const worldMat = new THREE.ShaderMaterial({
  vertexShader: quadVert,
  fragmentShader: worldFrag,
  defines: Object.fromEntries((Q.get('wdef') || '').split(',').filter(Boolean).map((k) => [k, ''])),
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
    uSun: { value: new THREE.Vector3(...SUN) }, uKey: { value: new THREE.Vector3(...KEY) }, uDune: { value: new THREE.Vector2() }, uSphEmis: { value: 1 }, uLipNear: { value: 0.55 }, uSunCol: { value: new THREE.Vector3() }, uZen: { value: new THREE.Vector3() }, uHor: { value: new THREE.Vector3() },
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
    tDiffuse: { value: null }, uSrcRes: { value: new THREE.Vector2(IW, IH) }, uExposure: { value: 1.0 }, uFlash: { value: 0 },
    uFade: { value: 0 }, uVig: { value: 0.2 }, uCA: { value: 0.001 }, uGrain: { value: 0.02 }, uTime: { value: 0 },
    uShock: { value: new THREE.Vector4(0.5, 0.5, 0, 0) }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uContrast: { value: 1.14 },
  },
  vertexShader: passVert,
  fragmentShader: gradeFrag,
});
const fsq = new FullScreenQuad(null);
const bloom = new UnrealBloomPass(new THREE.Vector2(IW, IH), 0.3, 0.6, 1.2);

// ---------------------------------------------------------------- frame
const _v = new THREE.Vector3();
function setFrame(t) {
  const sph = sphereState(t);
  if (HANDTEST) sph.C = [0, -30, 0];
  const fl = floorState(t);
  const mood = moodAt(t);
  const env = mood.env;
  const S = struggle(t);
  const cam = cameraAt(t);
  const dc = Q.get('dbgcam');
  if (dc) { const v = dc.split(',').map(Number); cam.pos = v.slice(0, 3); cam.tgt = v.slice(3, 6); cam.fov = v[6] || 40; cam.aper = 0; }
  camera.fov = cam.fov;
  camera.position.set(...cam.pos);
  const fwd = nrm(sub(cam.tgt, cam.pos));
  const r0 = nrm(cross(fwd, [0, 1, 0])), u0 = cross(r0, fwd);
  const rl = cam.roll || 0;
  camera.up.set(...add(scl(u0, Math.cos(rl)), scl(r0, Math.sin(rl))));
  camera.lookAt(...cam.tgt);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  // colours
  const strange = t < TL.dimStart ? mix(0.12, 0.35, ssm(TL.pinch, TL.dimStart, t)) : mix(0.35, 0.9, ssm(TL.dimStart, TL.hero[0], t));
  let c1 = palette(sph.phi);
  let c2 = palette(sph.phi + 1.0);
  let c3 = palette(sph.phi + 2.0);
  const preColor = t < TL.pinch ? ssm(TL.riseStart + 1.2, TL.pinch, t) : 1;
  c1 = lerp3([1, 1, 1], c1, preColor);
  c2 = lerp3([1, 1, 1], c2, preColor);
  c3 = lerp3([1, 1, 1], c3, preColor);
  const avg = lerp3(c1, lerp3(c2, c3, 0.5), strange * 0.5);
  let lightCol = scl(avg, sph.glow * 0.05);
  lightCol = lerp3(lightCol, scl([1, 1, 1], sph.glow * 0.05), sph.white);
  const darkTint = scl(avg, sat(1 - env) * 0.03 * (t < TE ? 1 : 0));
  const zen = add(mood.zen, darkTint);
  const hor = add(mood.hor, darkTint);
  const sunCol = mood.sun;
  const fogD = t >= TE ? mix(0.05, 0.02, ssm(TE, TE + 2, t)) : mix(mix(0.02, 0.028, ssm(9.6, 13.4, t)), 0.05, ssm(TL.hero[1], TL.climax, t));
  const { f: jf0 } = joltAt(Math.min(t, TE));
  let sphEmis = 0.9 + 0.9 * S * S + 0.45 * jf0;
  if (t >= TL.inhale && t < TE) sphEmis = mix(sphEmis, 3.2, ssm(TL.inhale, TE, t));
  if (t >= TE) sphEmis = 1.0 + 5 * Math.exp(-5 * (t - TE));

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
  u.uDune.value.set(t >= TE ? 1 : ssm(8.0, 12.5, t), t);
  u.uSphEmis.value = sphEmis;
  // the steep gravity well needs careful steps; afterwards the floor is gentle
  u.uLipNear.value = t < 10.5 || (t >= TE && t < TE + 2.5) ? 0.55 : 0.88;

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
        const big = arm.hero ? 1.9 : 1.0;
        cr.r *= arm.foreK;
        const hs = cr.r * (1.5 + 0.3 * Math.sin(t * 1.1 + arm.phase)) * big * cr.str * rise + 0.05;
        const A = sub(cr.X, scl(cr.dir, 0.6)), Bp = add(cr.X, scl(cr.dir, hs));
        const rr = cr.r * 0.88 * cr.str, kk = (0.3 + 0.95 * cr.r) * big * cr.str;
        slA[ai].set(A[0], A[1], A[2], rr);
        slB[ai].set(Bp[0], Bp[1], Bp[2], kk);
        arm.sleeveAtTE = [A, Bp, rr, kk];
      } else { slA[ai].set(0, 0, 0, 0); slB[ai].set(0, 0, 0, 0); arm.sleeveAtTE = null; }
      if (arm.active) {
        const handC = add(arm.W, scl(arm.B.Y, arm.S * 0.35));
        if (arm.grip) { capA[ci].set(...arm.Sh, 0.22 * arm.S); capB[ci].set(...arm.E, 1); ci++; }
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
  if (DBG.includes('nosleeve')) for (let i = 0; i < 18; i++) u.uSlA.value[i].w = 0;
  if (DBG.includes('nocap')) for (let i = 0; i < 48; i++) u.uCapB.value[i].w = 0;
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
    m.uniforms.uAper.value = cam.aper * (IH / 720);
    m.uniforms.uMaxCoc.value = Math.max(cam.aper * 1.35, 2) * (IH / 720);
  }

  // post
  const te = t - TE;
  const jf = joltAt(Math.min(t, TE)).f;
  const voidW = t >= TE ? ssm(TE + 0.3, TE + 2.0, t) : 1 - ssm(9.6, 13.4, t);
  bloom.threshold = mix(mix(0.85, 0.5, ssm(TL.hero[1], TL.climax, t)), 2.2, voidW);
  bloom.strength = (t < TE ? 0.3 + 0.22 * S + 0.15 * jf : 0.4 + 2.0 * Math.exp(-2 * te));
  bloom.radius = 0.5 + 0.3 * S;
  const g = gradeMat.uniforms;
  g.uTime.value = t;
  g.uExposure.value = 1.0 * (t >= TL.inhale && t < TE ? 1 - 0.2 * ssm(TL.inhale, TE, t) : 1);
  g.uFlash.value = t >= TE ? 2.5 * Math.exp(-te * 4.5) : 0;
  g.uFade.value = ssm(TL.fadeStart, TL.duration, t);
  g.uVig.value = mix(0.3, 0.6, sat(1 - env)) * (1 - 0.6 * voidW);
  g.uCA.value = 0.0015 + 0.006 * S * S + 0.004 * jf + (t >= TE ? 0.03 * Math.exp(-te * 3) : 0);
  g.uGrain.value = 0.022 + 0.012 * sat(1 - env);
  if (t >= TE) {
    _v.set(...sphCR(TE)[0]).project(camera);
    g.uShock.value.set(_v.x * 0.5 + 0.5, _v.y * 0.5 + 0.5, 0.05 + 1.25 * (1 - Math.exp(-1.6 * te)), 1.4 * Math.exp(-2.2 * te));
  } else g.uShock.value.set(0.5, 0.5, 0, 0);
  const cool = sat(1 - env);
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
  if (DBG.includes('prof')) { const b = new Uint16Array(4); renderer.readRenderTargetPixels(sceneRT, 0, 0, 1, 1, b); T.push(performance.now()); }
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

window.debugPoints = (t) => {
  setFrame(t);
  const P = (p) => { _v.set(...p).project(camera); return [Math.round((_v.x * 0.5 + 0.5) * REF_W), Math.round((0.5 - _v.y * 0.5) * REF_H)]; };
  const h = ARMS[0];
  const sl = worldMat.uniforms.uSlA.value.map((v, i) => [i, ARMS[i] ? ARMS[i].type : '-', v.toArray().map((x) => +x.toFixed(2)), worldMat.uniforms.uSlB.value[i].toArray().map((x) => +x.toFixed(2))]).filter((x) => x[2][3] > 0);
  const pal = (o) => o.map((x) => +x.toFixed(2));
  const look = add(h.W, scl(h.B.Y, h.S * 0.45));
  const eye = add(look, scl(h.B.Z, -2.6 * (h.S / 1.6)));
  const knuck = P(add(h.W, mv(h.Bm, [0, 0.45 * h.S, 0])));
  return { knuck, handcam: [...pal(eye), ...pal(look)], sl, hero: { W: h.W.map((x) => +x.toFixed(2)), E: h.E.map((x) => +x.toFixed(2)), Sh: h.Sh.map((x) => +x.toFixed(2)), cam: camera.position.toArray().map((x) => +x.toFixed(2)) }, sphere: P(sphereState(t).C), wrist: P(h.W), tip: P(h.tip), elbow: P(h.E), cross: h.cross ? P(h.cross.X) : null,
           arms: ARMS.map((a) => (a.active ? [a.type, P(a.W), a.S.toFixed(2)] : [a.type, 'off'])) };
};
window.camTrack = () => Array.from({ length: 901 }, (_, f) => { const c = cameraAt(f / 30); return [...c.pos, ...c.tgt, c.roll, c.fov]; });
window.renderFrame = (t) => { renderAt(t); return toB64(readRGB()); };
window.renderStill = (t) => { renderAt(t); return canvas.toDataURL('image/png'); };
window.timeline = TL;
window.ready = true;
