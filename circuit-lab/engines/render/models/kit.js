import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {box, tin, polyline, mat, cyl, silver, gold, text} from '../geo.js';

export let haloTexture = null;

export function halo(g, color, x, y, z, size) {
  if (!haloTexture) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d'),
      gr = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.18, 'rgba(255,255,255,.55)');
    gr.addColorStop(0.5, 'rgba(255,255,255,.12)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 128, 128);
    haloTexture = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: haloTexture,
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  s.position.set(x, y, z);
  s.scale.setScalar(size);
  s.raycast = () => {};
  g.add(s);
  return s;
}

export const lead = (g, x, z, y0, y1) => box(g, 0.5, y1 - y0, 0.5, x, (y0 + y1) / 2, z, tin());

export const roundLead = (g, pts) => polyline(g, pts, tin(), 0.25);

export const IN = 25.4;

export function instrumentBox(g, w, h, d, color) {
  box(g, w, h, d, 0, h / 2, 0, mat(color, 0.25, 0.45));
  box(g, w - 6, h - 6, 1, 0, h / 2, d / 2 + 0.3, mat('#1d1f24', 0.1, 0.5));
  for (const s of [-1, 1])
    box(g, 4, h * 0.5, d - 10, s * (w / 2 + 1), h * 0.45, 0, mat('#1a1a1c', 0.05, 0.7));
}

export function placeOnFront(mesh, x, y, z) {
  mesh.rotation.set(0, 0, 0);
  mesh.position.set(x, y, z + 0.85);
}

export function knob(g, x, y, z) {
  const k = cyl(g, 4, 5, x, y, z + 2.5, mat('#1a1a1c', 0.05, 0.5), 24);
  k.rotation.x = Math.PI / 2;
  const m = box(g, 0.8, 0.3, 3, x, y + 2, z + 5.1, mat('#e8e8ee'));
  m.rotation.x = Math.PI / 2;
}

export function post(g, x, y, z, col, bnc = false) {
  if (bnc) {
    const r = cyl(g, 4.5, 4, x, y, z + 2, silver(), 24);
    r.rotation.x = Math.PI / 2;
    const i = cyl(g, 1.2, 4.2, x, y, z + 2.1, mat('#d9c48a', 0.8, 0.3), 12);
    i.rotation.x = Math.PI / 2;
    const ring = cyl(g, 5.4, 1, x, y, z + 0.5, mat(col, 0.1, 0.5), 24);
    ring.rotation.x = Math.PI / 2;
    return;
  }
  const b = cyl(g, 4, 5, x, y, z + 2.5, mat(col, 0.1, 0.45), 24);
  b.rotation.x = Math.PI / 2;
  const t = cyl(g, 1.6, 2, x, y, z + 5.5, gold(), 12);
  t.rotation.x = Math.PI / 2;
}

export function frontLabel(g, s, x, y, z, w, h) {
  const t = text(g, s, x, y, z, w, h, '#c9cbd2');
  t.rotation.set(0, 0, 0);
}

export function to92(g, c, m) {
  const order = m.order;
  for (const [i] of order.entries()) lead(g, (i - 1) * 2.54, 0, 1, 3);
  const s = new THREE.Shape();
  s.absarc(0, 0, 2.4, 0, Math.PI, false);
  s.lineTo(-2.4, 0);
  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(s, {depth: 4.6, bevelEnabled: false, curveSegments: 16}),
    mat('#1b1b1d', 0.05, 0.5)
  );
  body.rotation.x = -Math.PI / 2;
  body.position.set(0, 3, 1.2);
  body.rotation.z = Math.PI;
  g.add(body);
  body.castShadow = true;
  const t = text(g, c.params.model.replace(/ \(P\)$/, ''), 0, 5.3, 1.25, 4.4, 1.2, '#b0b0b8');
  t.rotation.set(0, 0, 0);
  const o = text(g, order.join(' '), 0, 3.6, 1.25, 4, 1, '#8a8a92');
  o.rotation.set(0, 0, 0);
}

export function to220(g, label) {
  for (let i = 0; i < 3; i++) lead(g, (i - 1) * 2.54, 0, 1, 4.5);
  box(g, 10, 9, 4.5, 0, 9, 0, mat('#1b1b1d', 0.05, 0.5));
  const tab = box(g, 10, 6.5, 1.3, 0, 16.6, -1.6, mat('#c9ccd0', 0.85, 0.3));
  const hole = cyl(g, 1.8, 1.4, 0, 17, -1.6, mat('#0a0a0c'), 20);
  hole.rotation.x = Math.PI / 2;
  const t = text(g, label, 0, 10, 2.3, 8.5, 1.8, '#c4c4cc');
  t.rotation.set(0, 0, 0);
}

export const INK = '#c9c9cf';

export const standing = t => {
  t.rotation.set(0, 0, 0);
  return t;
};

export function rbox(g, w, h, d, x, y, z, m, r) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

export function lathe(g, pts, m, seg = 48) {
  const mesh = new THREE.Mesh(
    new THREE.LatheGeometry(
      pts.map(([r, y]) => new THREE.Vector2(r, y)),
      seg
    ),
    m
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

export function pad(g, x, z, top, r = 1, hole = 0.5) {
  const m = new THREE.Mesh(new THREE.RingGeometry(hole, r, 20), tin());
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, top + 0.012, z);
  g.add(m);
}

export const pinUp = (g, x, z, h) => box(g, 0.64, h, 0.64, x, h / 2, z, gold());

export function dipIC(
  g,
  n,
  len,
  lines,
  {w = 6.35, h = 3.3, pitch = 2.54, color = '#161618', y0 = 1.15, notch = true, dot = true, rot = 0} = {}
) {
  const half = n / 2,
    top = y0 + h,
    leadM = tin();
  box(g, len, h, w, 0, y0 + h / 2, 0, mat(color, 0.05, 0.62));
  if (notch) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 0.16, 18, 1, false, 0, Math.PI),
      mat('#09090b', 0.05, 0.8)
    );
    m.position.set(-len / 2, top - 0.07, 0);
    g.add(m);
  }
  if (dot) cyl(g, 0.42, 0.05, -len / 2 + 1.3, top + 0.012, w / 2 - 1.15, mat('#0c0c0e', 0.05, 0.25), 16);
  for (const [s, size, dz, wf = 0.8] of lines)
    text(g, s, 0, top + 0.02, dz, (rot ? w : len) * wf, size, INK, 36, rot, 600);
  const ye = y0 + 0.95,
    out = 3.81 + 0.13,
    inner = w / 2 - 0.2;
  for (let i = 0; i < half; i++) {
    const x = (-(half - 1) / 2 + i) * pitch;
    for (const s of [-1, 1]) {
      box(g, 1.15, 0.25, out - inner, x, ye, (s * (inner + out)) / 2, leadM);
      box(g, 1.15, ye - 1.05, 0.25, x, (ye + 1.05) / 2, s * 3.81, leadM);
      box(g, 0.46, 1.08, 0.25, x, 0.54, s * 3.81, leadM);
    }
  }
  return top;
}

export const gate = code => g =>
  dipIC(g, 14, 19.3, [
    [`74HC${code}N`, 1.6, -0.75],
    ['NXP  2216', 1, 1.4, 0.5],
  ]);

export function trimmer3296(g, x, y, z, {rot = 0, code = '103'} = {}) {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.rotation.y = rot;
  g.add(grp);
  box(grp, 9.53, 10.03, 4.83, 0, 10.03 / 2, 0, mat('#2457b9', 0.05, 0.42));
  const screw = new THREE.Group();
  screw.position.set(-3.1, 10.03, 0);
  cyl(screw, 1.1, 0.75, 0, 0.37, 0, mat('#c9a14c', 0.9, 0.28), 20);
  box(screw, 2.3, 0.3, 0.38, 0, 0.66, 0, mat('#3b2f14', 0.3, 0.7));
  grp.add(screw);
  standing(text(grp, '3296W', 0.4, 7.2, 2.43, 7, 1.6, '#eef2ff', 36, 0, 700));
  standing(text(grp, code, 0.4, 4.8, 2.43, 4, 1.6, '#eef2ff', 36, 0, 700));
  for (const dx of [-2.54, 0, 2.54]) box(grp, 0.5, y + 0.6, 0.5, dx, -y / 2 + 0.3, 0, tin());
  return {grp, screw};
}

export const ohmCode = r => {
  const e = Math.max(0, Math.floor(Math.log10(r)) - 1);
  return `${Math.round(r / 10 ** e)}`.slice(0, 2) + e;
};

export let lamTex = null;

export function laminations() {
  if (!lamTex) {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 4;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(40,44,48,.55)';
    x.fillRect(0, 0, 2, 4);
    x.fillStyle = 'rgba(255,255,255,.12)';
    x.fillRect(8, 0, 1, 4);
    lamTex = new THREE.CanvasTexture(c);
    lamTex.wrapS = lamTex.wrapT = THREE.RepeatWrapping;
    lamTex.repeat.set(48, 1);
    lamTex.colorSpace = THREE.SRGBColorSpace;
  }
  return lamTex;
}

export let solarTex = null;

export function solarTexture() {
  if (solarTex) return solarTex;
  const W = 1060,
    H = 560,
    cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const x = cv.getContext('2d');
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  x.fillStyle = '#1a1c21';
  x.fillRect(0, 0, W, H);
  const m = 12,
    gap = 9,
    cw = (W - 2 * m - 5 * gap) / 6,
    ch = (H - 2 * m - gap) / 2;
  for (let r = 0; r < 2; r++)
    for (let k = 0; k < 6; k++) {
      const x0 = m + k * (cw + gap),
        y0 = m + r * (ch + gap);
      x.save();
      x.beginPath();
      x.rect(x0, y0, cw, ch);
      x.clip();
      x.fillStyle = '#1d3b7a';
      x.fillRect(x0, y0, cw, ch);
      for (let i = 0; i < 90; i++) {
        const cx = x0 + rnd() * cw,
          cy = y0 + rnd() * ch,
          rad = 10 + rnd() * 28,
          n = 5 + Math.floor(rnd() * 3),
          a0 = rnd() * 6;
        x.fillStyle = `hsl(${216 + rnd() * 12},${50 + rnd() * 20}%,${19 + rnd() * 15}%)`;
        x.beginPath();
        for (let j = 0; j < n; j++) {
          const a = a0 + (j / n) * Math.PI * 2,
            rr = rad * (0.55 + rnd() * 0.7);
          j
            ? x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
            : x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        }
        x.closePath();
        x.fill();
      }
      x.fillStyle = 'rgba(200,206,214,.55)';
      for (let yy = y0 + 5; yy < y0 + ch; yy += 11) x.fillRect(x0, yy, cw, 1.3);
      x.fillStyle = '#cdd2d8';
      for (const f of [0.27, 0.73]) x.fillRect(x0 + cw * f - 3, y0, 6, ch);
      x.restore();
      x.fillStyle = '#b9bec4';
      for (const f of [0.27, 0.73]) x.fillRect(x0 + cw * f - 2.5, r ? y0 - gap : y0 + ch, 5, gap);
    }
  solarTex = new THREE.CanvasTexture(cv);
  solarTex.colorSpace = THREE.SRGBColorSpace;
  solarTex.anisotropy = 4;
  return solarTex;
}

export function transformerLabel(m) {
  if (!m.includes('→')) return m.split('·').map(s => s.trim());
  const u = v => v.trim().replace(/(\d) (V|VA)\b/g, '$1$2'),
    [p, rest] = m.split('→'),
    [s, ...more] = rest.split('·'),
    out = [`PRI ${u(p)}~`, `SEC ${u(s)}~`];
  for (const x of more) {
    const ei = x.match(/\((EI-\d+)\)/);
    out.push(u(x.replace(/\(.*\)/, '')));
    if (ei) out.push(ei[1]);
  }
  return out;
}

export function eiTransformer(g, c, ct) {
  const steel = mat('#8c9196', 0.6, 0.42),
    bob = mat('#17171a', 0.05, 0.55),
    tape = mat('#e0bc2c', 0.05, 0.32);
  const E = new THREE.Shape();
  E.moveTo(-20, 7.75);
  for (const [u, v] of [
    [-20, 39],
    [20, 39],
    [20, 7.75],
    [13.33, 7.75],
    [13.33, 32.33],
    [6.67, 32.33],
    [6.67, 7.75],
    [-6.67, 7.75],
    [-6.67, 32.33],
    [-13.33, 32.33],
    [-13.33, 7.75],
  ])
    E.lineTo(u, v);
  E.closePath();
  const core = new THREE.Mesh(new THREE.ExtrudeGeometry(E, {depth: 24, bevelEnabled: false}), steel);
  core.rotation.y = Math.PI / 2;
  core.position.x = -12;
  core.castShadow = core.receiveShadow = true;
  g.add(core);
  box(g, 24, 6.6, 40, 0, 4.35, 0, steel);
  const stripes = new THREE.MeshStandardMaterial({
    map: laminations(),
    transparent: true,
    depthWrite: false,
    metalness: 0.5,
    roughness: 0.5,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(24, 38), stripes);
    p.position.set(0, 20, s * 20.02);
    if (s < 0) p.rotation.y = Math.PI;
    g.add(p);
  }
  const tp = new THREE.Mesh(new THREE.PlaneGeometry(24, 40), stripes);
  tp.rotation.x = -Math.PI / 2;
  tp.position.y = 39.02;
  g.add(tp);
  for (const s of [-1, 1]) box(g, 24.1, 0.18, 0.5, 0, 7.68, s * 19.8, mat('#3c4044', 0.4, 0.6));
  rbox(g, 39, 24, 26.4, 0, 20.2, 0, tape, 3.2);
  for (const s of [-1, 1]) {
    box(g, 1, 23.6, 26.6, s * 12.6, 20.2, 0, mat('#c9a523', 0.05, 0.4));
  }
  box(g, 41, 0.9, 28.5, 0, 32.75, 0, bob);
  box(g, 41, 0.9, 28.5, 0, 8.4, 0, bob);
  for (const s of [-1, 1]) {
    box(g, 12, 7.2, 25, s * 18, 4.6, 0, bob);
    for (const z of ct && s > 0 ? [-7.62, 0, 7.62] : [-7.62, 7.62])
      box(g, 0.9, 1.9, 0.6, s * 17.78, 0.95, z, tin());
    standing(text(g, s < 0 ? 'PRI' : 'SEC', s * 18, 4.6, 12.52, 6, 2, '#d6d6dc', 36, 0, 700, 'sans-serif'));
  }
  box(g, 20, 0.1, 34, 0, 39.06, 0, mat('#f1eee4', 0, 0.75));
  const lines = [...transformerLabel(c.params.model ?? ''), 'Ta 40°C  50/60Hz'];
  lines.forEach((l, i) =>
    text(
      g,
      l,
      0,
      39.12,
      -12 + (i * 24) / (lines.length - 1),
      18,
      i === lines.length - 1 ? 2 : 3,
      '#1d1d22',
      36,
      0,
      i < 2 ? 700 : 500,
      'sans-serif'
    )
  );
}
