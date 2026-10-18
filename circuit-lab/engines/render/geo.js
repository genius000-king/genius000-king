import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

export const materials = new Map();

export function mat(color, metalness = 0, roughness = 0.5, extra) {
  const key = `${color}/${metalness}/${roughness}/${extra ? JSON.stringify(extra) : ''}`;
  if (!materials.has(key))
    materials.set(
      key,
      extra
        ? new THREE.MeshPhysicalMaterial({color, metalness, roughness, ...extra})
        : new THREE.MeshStandardMaterial({color, metalness, roughness})
    );
  return materials.get(key);
}

export const gold = () => mat('#c5a25b', 0.9, 0.23);

export const silver = () => mat('#c0c6c5', 0.92, 0.27);

export const tin = () => mat('#d4d7d6', 0.85, 0.35);

export const dark = () => mat('#18251f', 0.05, 0.48);

export const black = () => mat('#141416', 0.05, 0.42);

export const pcb = () => mat('#123b2c', 0.12, 0.38);

export const copper = () => mat('#b87333', 0.85, 0.3);

export function glow(color, intensity = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.35,
  });
}

export function box(g, w, h, d, x, y, z, m) {
  const mesh = new THREE.Mesh(
    Math.min(w, h, d) > 1.4
      ? new RoundedBoxGeometry(w, h, d, 2, Math.min(0.22, Math.min(w, h, d) * 0.08))
      : new THREE.BoxGeometry(w, h, d),
    m
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

export function cyl(g, r, h, x, y, z, m, segments = 24, r2 = r) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, h, segments), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  g.add(mesh);
  return mesh;
}

export function sphere(g, r, x, y, z, m, ws = 20, hs = 14) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  g.add(mesh);
  return mesh;
}

export function line(g, points, m, r = 0.12, closed = false) {
  const curve = new THREE.CatmullRomCurve3(
    points.map(p => new THREE.Vector3(...p)),
    closed,
    'catmullrom',
    0.1
  );
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, points.length * 4), r, 6, closed), m);
  mesh.castShadow = true;
  g.add(mesh);
  return mesh;
}

export function polyline(g, points, m, r = 0.12) {
  for (let i = 1; i < points.length; i++) {
    const a = new THREE.Vector3(...points[i - 1]),
      b = new THREE.Vector3(...points[i]),
      len = a.distanceTo(b);
    if (len < 1e-6) continue;
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), m);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.add(mesh);
  }
}

export const textCache = new Map();

export function text(
  g,
  value,
  x,
  y,
  z,
  w,
  h,
  color = '#d0d7bd',
  size = 36,
  rotate = 0,
  weight = 500,
  family = 'monospace'
) {
  const key = [value, color, w, h, weight, family].join('|');
  let texture = textCache.get(key);
  if (!texture) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(128, Math.ceil(w * 30));
    canvas.height = Math.max(64, Math.ceil(h * 30));
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${weight} ${Math.min(canvas.height * 0.75, canvas.width / (Math.max(1, value.length) * 0.62))}px ${family}`;
    ctx.fillText(value, canvas.width / 2, canvas.height / 2);
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textCache.set(key, texture);
  }
  const m = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = rotate;
  mesh.position.set(x, y, z);
  g.add(mesh);
  return mesh;
}

export function plate(g, w, d, h, y, material, r = 1, holes = [], x = 0, z = 0) {
  const s = new THREE.Shape();
  r = Math.min(r, w / 2 - 0.01, d / 2 - 0.01);
  s.moveTo(-w / 2 + r, -d / 2);
  s.lineTo(w / 2 - r, -d / 2);
  s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  s.lineTo(w / 2, d / 2 - r);
  s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
  s.lineTo(-w / 2 + r, d / 2);
  s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
  s.lineTo(-w / 2, -d / 2 + r);
  s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  for (const [hx, hz, hr] of holes) {
    const p = new THREE.Path();
    p.absarc(hx, -hz, hr, 0, Math.PI * 2, true);
    s.holes.push(p);
  }
  const mesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(s, {depth: h, bevelEnabled: false, curveSegments: 6}),
    material
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

export function pcbBoard(g, w, d, color, {y = 0.8, thick = 1.6, r = 1, holes = []} = {}) {
  plate(g, w, d, thick, y, mat(color, 0.12, 0.42), r, holes);
  plate(g, w - 0.02, d - 0.02, 0.06, y + thick, mat(color, 0.18, 0.32), r, holes);
  return y + thick + 0.06;
}

export function maleHeader(g, pins, top, {above = 3.2, below = 6, plastic = 2.5} = {}) {
  const rows = new Map();
  for (const [x, z] of pins) {
    const key = x.toFixed(2);
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(z);
  }
  for (const [key, zs] of rows) {
    const x = Number(key);
    zs.sort((a, b) => a - b);
    let start = zs[0],
      prev = zs[0];
    const flush = end => {
      box(g, 2.5, plastic, end - start + 2.5, x, top + plastic / 2, (start + end) / 2, black());
    };
    for (const z of zs.slice(1)) {
      if (z - prev > 2.6) {
        flush(prev);
        start = z;
      }
      prev = z;
    }
    flush(prev);
  }
  for (const [x, z] of pins) {
    box(
      g,
      0.64,
      plastic + above + below + 1.6,
      0.64,
      x,
      top + (plastic + above - below - 1.6) / 2,
      z,
      gold()
    );
  }
}

export function femaleHeader(g, pins, top, height = 8.5) {
  const rows = new Map();
  for (const [x, z] of pins) {
    const key = z.toFixed(2);
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(x);
  }
  for (const [key, xs] of rows) {
    const z = Number(key);
    xs.sort((a, b) => a - b);
    let start = xs[0],
      prev = xs[0];
    const flush = end =>
      box(g, end - start + 2.5, height, 2.5, (start + end) / 2, top + height / 2, z, black());
    for (const x of xs.slice(1)) {
      if (x - prev > 2.6) {
        flush(prev);
        start = x;
      }
      prev = x;
    }
    flush(prev);
  }
  for (const [x, z] of pins) box(g, 1, 0.05, 1, x, top + height + 0.03, z, mat('#050506', 0, 0.9));
}

export function chip(
  g,
  w,
  d,
  h,
  x,
  y,
  z,
  label,
  {legs = 0, legSide = 'x', color = '#1a1a1c', rot = 0, textColor = '#9a9aa2', pitch = 0.5, dot = true} = {}
) {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.rotation.y = rot;
  g.add(grp);
  box(grp, w, h, d, 0, h / 2, 0, mat(color, 0.1, 0.55));
  if (label) text(grp, label, 0, h + 0.02, 0, w * 0.85, Math.min(d * 0.3, 1.6), textColor);
  if (dot)
    cyl(
      grp,
      Math.min(w, d) * 0.06,
      0.03,
      -w / 2 + Math.min(w, d) * 0.15,
      h + 0.01,
      -d / 2 + Math.min(w, d) * 0.15,
      mat('#2a2a2e'),
      10
    );
  if (legs) {
    const n = legs,
      span = (n - 1) * pitch;
    for (let i = 0; i < n; i++) {
      const t = -span / 2 + i * pitch;
      for (const s of [-1, 1]) {
        if (legSide === 'x' || legSide === 'all')
          box(grp, 0.25, 0.15, 0.55, t, 0.1, s * (d / 2 + 0.25), tin());
        if (legSide === 'z' || legSide === 'all')
          box(grp, 0.55, 0.15, 0.25, s * (w / 2 + 0.25), 0.1, t, tin());
      }
    }
  }
  return grp;
}

export function dip(g, n, x, y, z, label, {w, rot = 0} = {}) {
  const half = n / 2,
    len = half * 2.54 + 0.6,
    grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.rotation.y = rot;
  g.add(grp);
  const body = w ?? 6.4;
  box(grp, len, 3.3, body, 0, 2.5, 0, mat('#18181a', 0.05, 0.6));
  cyl(grp, 0.6, 0.1, -len / 2 + 1.2, 4.16, body / 2 - 1.2, mat('#2a2a2c'), 12);
  const notch = cyl(grp, 0.9, 0.1, -len / 2, 4.16, 0, mat('#0e0e10'), 12);
  notch.scale.z = 1;
  if (label) text(grp, label, 0, 4.2, 0, len * 0.8, 1.4, '#b9b9c0');
  for (let i = 0; i < half; i++) {
    const px = (-(half - 1) / 2 + i) * 2.54;
    for (const s of [-1, 1]) {
      box(grp, 0.5, 0.25, 1.2, px, 2.0, s * (body / 2 + 0.5), tin());
      box(grp, 0.5, 2.6, 0.25, px, 0.9, s * 3.81, tin());
    }
  }
  return grp;
}

export function smdR(g, x, y, z, rot = 0, color = '#1d1d1f') {
  const m = box(g, 1.6, 0.45, 0.8, x, y + 0.22, z, mat(color, 0.1, 0.5));
  m.rotation.y = rot;
  for (const s of [-1, 1]) {
    const e = box(
      g,
      0.3,
      0.47,
      0.82,
      x + Math.cos(rot) * s * 0.7,
      y + 0.23,
      z - Math.sin(rot) * s * 0.7,
      tin()
    );
    e.rotation.y = rot;
  }
}

export function smdC(g, x, y, z, rot = 0) {
  smdR(g, x, y, z, rot, '#b8935e');
}

export function usbMicro(g, x, y, z, rot = 0) {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.rotation.y = rot;
  g.add(grp);
  box(grp, 7.5, 2.6, 5.5, 0, 1.3, 0, silver());
  box(grp, 6.4, 1.8, 0.2, 0, 1.3, 2.8, mat('#0b0b0c'));
  box(grp, 5, 0.5, 3, 0, 1.4, 1.3, mat('#202022'));
  return grp;
}

export function usbMini(g, x, y, z, rot = 0) {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.rotation.y = rot;
  g.add(grp);
  box(grp, 7.7, 3.9, 9.2, 0, 1.95, 0, silver());
  box(grp, 6.8, 3, 0.2, 0, 1.95, 4.62, mat('#0b0b0c'));
  return grp;
}

export function usbB(g, x, y, z, rot = 0) {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.rotation.y = rot;
  g.add(grp);
  box(grp, 16.4, 11, 12, 0, 5.5, 0, silver());
  box(grp, 0.2, 8.6, 8.6, -8.25, 5.5, 0, mat('#0b0b0c'));
  box(grp, 1, 5.2, 4.6, -7.6, 5.5, 0, mat('#e8e8e8', 0.05, 0.6));
  return grp;
}

export function barrelJack(g, x, y, z, rot = 0) {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.rotation.y = rot;
  g.add(grp);
  box(grp, 14, 11, 9, 0, 5.5, 0, mat('#121214', 0.05, 0.5));
  const hole = cyl(grp, 3.2, 0.3, -7, 5.5, 0, mat('#050505'), 20);
  hole.rotation.z = Math.PI / 2;
  const pinM = cyl(grp, 1, 2, -6.2, 5.5, 0, silver(), 12);
  pinM.rotation.z = Math.PI / 2;
  return grp;
}

export function tactile(g, x, y, z, size = 6, cap = '#2b2b2e') {
  box(g, size, 1.6, size, x, y + 0.8, z, silver());
  const b = cyl(g, size * 0.28, 1.4, x, y + 2.2, z, mat(cap, 0.05, 0.5), 20);
  return b;
}

export function ledSmd(g, x, y, z, color, size = 1.6) {
  box(g, size, 0.5, size * 0.55, x, y + 0.25, z, mat('#e8e2d0', 0.05, 0.5));
  const m = glow(color, 0);
  box(g, size * 0.7, 0.12, size * 0.4, x, y + 0.56, z, m);
  return m;
}

export function crystal(g, x, y, z, rot = 0, label = '16.000') {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.rotation.y = rot;
  g.add(grp);
  const s = new THREE.Shape();
  const w = 11,
    d = 4.6,
    r = 2.3;
  s.moveTo(-w / 2 + r, -d / 2);
  s.lineTo(w / 2 - r, -d / 2);
  s.absarc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2);
  s.lineTo(-w / 2 + r, d / 2);
  s.absarc(-w / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5);
  const m = new THREE.Mesh(
    new THREE.ExtrudeGeometry(s, {
      depth: 3.6,
      bevelEnabled: true,
      bevelThickness: 0.2,
      bevelSize: 0.2,
      bevelSegments: 2,
    }),
    silver()
  );
  m.rotation.x = -Math.PI / 2;
  m.castShadow = true;
  grp.add(m);
  text(grp, label, 0, 3.85, 0, 7, 1.3, '#5d6266');
  return grp;
}

export function elcap(g, x, y, z, r, h, sleeve = '#1b2a4a', label = '', rot = 0) {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.rotation.y = rot;
  g.add(grp);
  cyl(grp, r, h, 0, h / 2, 0, mat(sleeve, 0.15, 0.45), 28);
  cyl(grp, r * 0.94, 0.15, 0, h + 0.05, 0, mat('#c9ccce', 0.85, 0.3), 28);
  for (const a of [0, Math.PI / 2]) {
    const v = box(grp, r * 1.5, 0.06, 0.12, 0, h + 0.15, 0, mat('#8d9195', 0.8, 0.35));
    v.rotation.y = a;
  }
  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(r + 0.01, r + 0.01, h * 0.92, 24, 1, true, -0.5, 1),
    mat('#b8bcc4', 0.1, 0.5)
  );
  stripe.position.y = h / 2;
  grp.add(stripe);
  if (label) {
    const t = text(grp, label, 0, h / 2, r + 0.02, h * 0.8, r * 0.7, '#e6e6ea');
    t.rotation.set(0, 0, Math.PI / 2);
  }
  return grp;
}

export function mountingHoles(g, top, list) {
  for (const [x, z, r] of list) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.9, 24), tin());
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, top + 0.01, z);
    g.add(ring);
  }
}

export function screenTexture(w = 256, h = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return {canvas, texture};
}

export function screen(g, w, d, x, y, z, pw = 256, ph = 128, rot = 0) {
  const {canvas, texture} = screenTexture(pw, ph);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({map: texture, toneMapped: false})
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = rot;
  mesh.position.set(x, y, z);
  g.add(mesh);
  return {canvas, texture, mesh, last: null};
}

export const resistorBands = ohms => {
  const colors = [
    '#1a1a1a',
    '#7a4a24',
    '#d4322a',
    '#f07a24',
    '#f2d235',
    '#3a9a3a',
    '#2a5ad0',
    '#8a3ac0',
    '#8a8a8a',
    '#f2f2f2',
  ];
  let exp = 0,
    v = Math.round(ohms);
  if (v < 10) {
    const d = Math.round(ohms * 10);
    return [colors[Math.floor(d / 10) % 10], colors[d % 10], '#c8a830', '#c8a830'];
  }
  while (v >= 100) {
    v = Math.round(v / 10);
    exp++;
  }
  return [colors[Math.floor(v / 10)], colors[v % 10], colors[Math.min(9, exp)], '#c8a830'];
};
