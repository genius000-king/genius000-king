import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {terminals, isBreadboard, ref} from '../catalog/types.js';
import {boardModel, breadboardModel} from './board-models.js';
import {box, mat, cyl, silver, dark, pcb, gold, text, line} from './geo.js';
import {
  unoModel,
  nanoModel,
  picoModel,
  nodemcuModel,
  bluepillModel,
  largeBreadboard,
} from './models/boards.js';
import {PART_MODELS} from './models/index.js';

export const DYNAMIC_KEYS = [
  'knob',
  'horn',
  'motorShaft',
  'stick',
  'encoderKnob',
  'armature',
  'dial',
  'button',
  'slider',
  'stepShaft',
  'cone',
  'slideKnob',
  'reedMagnet',
  'reedContacts',
  'acKnob',
  'fuseOk',
  'fuseBlown',
];

export function mergeStaticMeshes(g) {
  const ud = g.userData,
    protectedMaterials = new Set(
      [
        ud.powerMaterial,
        ud.ledMaterial,
        ud.rgbMaterial,
        ...Object.values(ud.segments ?? {}),
        ...(ud.bars ?? []),
        ...(ud.pixels ?? []),
        ...(ud.boardLeds ?? []).map(l => l.material),
        ud.lamp?.glass,
        ud.lamp?.fil,
        ud.pirLed,
        ...(ud.mqLeds ?? []),
        ud.buckLed,
        ud.irLeds?.pwr,
        ud.irLeds?.obs,
        ud.acLamp,
        ...(ud.tlLeds ?? []).map(l => l.material),
      ].filter(Boolean)
    );
  const dynamic = new Set();
  for (const k of DYNAMIC_KEYS) {
    let o = ud[k];
    while (o && o !== g) {
      dynamic.add(o);
      o = o.parent;
    }
  }
  const isDynamic = o => {
    let p = o;
    while (p && p !== g) {
      if (dynamic.has(p) || p.userData.action) return true;
      p = p.parent;
    }
    return false;
  };
  const buckets = new Map();
  g.updateMatrixWorld(true);
  g.traverse(o => {
    if (
      !o.isMesh ||
      o.isInstancedMesh ||
      o.userData.terminal ||
      o.userData.action ||
      o.material.transparent ||
      o.material.map ||
      protectedMaterials.has(o.material) ||
      isDynamic(o)
    )
      return;
    const list = buckets.get(o.material) ?? [];
    list.push(o);
    buckets.set(o.material, list);
  });
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  for (const [material, meshes] of buckets) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map(m => {
        const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        for (const k of Object.keys(geo.attributes))
          if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
        if (!geo.attributes.uv)
          geo.setAttribute(
            'uv',
            new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2)
          );
        return geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      }),
      combined = mergeGeometries(geometries);
    geometries.forEach(geo => geo.dispose());
    if (!combined) continue;
    for (const m of meshes) {
      m.parent.remove(m);
      m.geometry.dispose();
    }
    const mesh = new THREE.Mesh(combined, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
}

export const GEOMETRY_PARAMS = {
  resistor: ['resistance'],
  capacitor: ['capacitance'],
  electrolytic: ['capacitance', 'rating'],
  inductor: ['inductance'],
  diode: ['model'],
  npn: ['model'],
  pnp: ['model'],
  mosfet: ['model'],
  regulator: ['model'],
  aapack: ['cells'],
  buzzer: ['active'],
  neopixel: ['count'],
  ledbar: ['color'],
};

export const geometryKey = c => JSON.stringify((GEOMETRY_PARAMS[c.type] ?? []).map(k => c.params[k]));

export function componentModel(c) {
  const g = new THREE.Group();
  g.userData.component = c.id;
  switch (c.type) {
    case 'board':
      boardModel(g, c);
      break;
    case 'uno':
      unoModel(g, c);
      break;
    case 'mega':
      unoModel(g, c, true);
      break;
    case 'nano':
      nanoModel(g, c);
      break;
    case 'pico':
      picoModel(g, c);
      break;
    case 'esp8266':
      nodemcuModel(g, c);
      break;
    case 'bluepill':
      bluepillModel(g, c);
      break;
    case 'breadboard':
      breadboardModel(g);
      break;
    case 'bbhalf':
      largeBreadboard(g, 'half');
      break;
    case 'bbfull':
      largeBreadboard(g, 'full');
      break;
    case 'mic':
      box(g, 12, 1.5, 20, 0, 1.5, 0, mat('#287f7a'));
      cyl(g, 4.8, 5, 0, 4.8, -4, silver());
      cyl(g, 3.7, 0.1, 0, 7.35, -4, mat('#474d47'));
      for (let i = 0; i < 8; i++)
        cyl(g, 0.22, 0.12, Math.cos(i * 0.8) * 2.5, 7.45, -4 + Math.sin(i * 0.8) * 2.5, mat('#19201c'), 8);
      box(g, 4, 1, 4, 0, 2.8, 4, dark());
      break;

    case 'lcd':
      box(g, 80, 1.6, 36, 0, 1.5, 0, pcb());
      box(g, 71, 5, 25, 0, 4, 0, mat('#303633', 0.7, 0.35));
      box(g, 65, 0.4, 19, 0, 6.6, 0, mat('#8b9d47', 0.05, 0.46));
      for (const x of [-37, 37])
        for (const z of [-15, 15]) {
          cyl(g, 1.6, 0.2, x, 2.4, z, gold());
          cyl(g, 0.9, 0.3, x, 2.55, z, mat('#202922'));
        }
      for (let i = 0; i < 16; i++) cyl(g, 0.55, 0.2, -36 + i * 2.54, 2.4, -15, gold());
      const lcdCanvas = document.createElement('canvas');
      lcdCanvas.width = 512;
      lcdCanvas.height = 128;
      const lcdTexture = new THREE.CanvasTexture(lcdCanvas);
      const lcdScreen = new THREE.Mesh(
        new THREE.PlaneGeometry(61, 15),
        new THREE.MeshBasicMaterial({map: lcdTexture})
      );
      lcdScreen.rotation.x = -Math.PI / 2;
      lcdScreen.position.y = 6.9;
      g.add(lcdScreen);
      g.userData.display = {canvas: lcdCanvas, texture: lcdTexture, last: null, lcd: true};
      text(g, '1602 · 3.3V I²C', 0, 2.4, 16, 22, 1.2);
      box(g, 38, 1, 16, -15, -0.1, 0, pcb());
      box(g, 7, 1.2, 5, -14, -1.1, 0, dark());
      for (let i = 0; i < 8; i++)
        for (const side of [-1, 1]) box(g, 0.45, 0.15, 1.5, -17 + i * 0.85, -0.8, side * 3.2, silver());
      box(g, 5, 2, 5, -28, -1.5, 0, mat('#285d88'));
      cyl(g, 1.6, 0.3, -28, -2.6, 0, mat('#b7bdab', 0.4, 0.5));
      break;

    case 'ldr':
    case 'thermistor':
      for (const t of terminals(c)) line(g, [t.p, [t.p[0], 5, 0]], silver(), 0.22);
      if (c.type === 'ldr') {
        const disc = cyl(g, 2.5, 0.8, 0, 5, 0, mat('#bd9b68'));
        for (let i = -2; i <= 2; i++)
          line(
            g,
            [
              [i * 0.75, 5.45, -1.5],
              [i * 0.75 + 0.35, 5.45, 1.5],
            ],
            mat('#6f4b3d'),
            0.14
          );
      } else {
        const bead = new THREE.Mesh(new THREE.SphereGeometry(2, 20, 12), mat('#664637', 0.12, 0.25));
        bead.scale.set(1, 0.9, 0.6);
        bead.position.y = 5;
        g.add(bead);
      }
      break;

    case 'switch':
      box(g, 8.5, 3.5, 4, 0, 2.2, 0, silver());
      box(g, 6, 0.2, 2.6, 0, 4, 0, mat('#161d18'));
      const slider = box(g, 2.2, 2.5, 2.4, -1.8, 5, 0, dark());
      slider.userData.action = 'toggle';
      g.userData.slider = slider;
      for (const t of terminals(c)) box(g, 0.7, 1, 3, t.p[0], 1, 2.3, silver());
      break;

    case 'oled':
      box(g, 27, 1.5, 27, 0, 1.5, 0, mat('#1f6073'));
      for (const x of [-11.5, 11.5])
        for (const z of [-11.5, 11.5]) {
          const mount = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.28, 8, 16), silver());
          mount.rotation.x = Math.PI / 2;
          mount.position.set(x, 2.3, z);
          g.add(mount);
          cyl(g, 0.65, 0.1, x, 2.3, z, mat('#102a25'));
        }
      for (const x of [-8, -5, -2, 1]) {
        box(g, 1, 0.7, 2.2, x, 2.6, 8, mat('#a58d68'));
        box(g, 1.1, 0.75, 0.35, x, 2.6, 7, silver());
        box(g, 1.1, 0.75, 0.35, x, 2.6, 9, silver());
      }
      box(g, 25, 1, 18, 0, 2.8, -2, mat('#111b1c', 0.1, 0.25));
      const cvs = document.createElement('canvas');
      cvs.width = 256;
      cvs.height = 128;
      const tex = new THREE.CanvasTexture(cvs);
      const display = new THREE.Mesh(
        new THREE.PlaneGeometry(22, 11),
        new THREE.MeshBasicMaterial({map: tex})
      );
      display.rotation.x = -Math.PI / 2;
      display.position.set(0, 3.4, -2);
      g.add(display);
      g.userData.display = {canvas: cvs, texture: tex, last: null};
      for (const t of terminals(c)) text(g, t.id, t.p[0], 2.4, 9, 2.3, 1);
      break;
    default:
      PART_MODELS[c.type]?.(g, c);
  }
  const ts = terminals(c);
  if (['oled', 'lcd', 'mic'].includes(c.type))
    for (const t of ts) {
      cyl(g, 0.7, 0.15, t.p[0], t.p[1] - 0.1, t.p[2], gold(), 12);
      box(g, 0.64, 2, 0.64, t.p[0], t.p[1] - 0.8, t.p[2], gold());
    }
  g.userData.termLocal = {};
  g.userData.terminals = {};
  for (const t of ts) g.userData.termLocal[t.id] = new THREE.Vector3(...t.p);
  if (isBreadboard(c)) {
    const inst = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.66, 8, 6),
        new THREE.MeshBasicMaterial({color: '#d6b47b', transparent: true, opacity: 0.16}),
        ts.length
      ),
      m4 = new THREE.Matrix4();
    ts.forEach((t, i) => {
      m4.makeTranslation(t.p[0], t.p[1] + 0.05, t.p[2]);
      inst.setMatrixAt(i, m4);
    });
    inst.visible = false;
    inst.userData.terminalList = ts.map(t => ({
      node: ref(c, t.id),
      info: t.rail ? `${t.label} · power rail` : `${t.label} · strip ${t.strip.replace('-', ' ')}`,
    }));
    g.add(inst);
    g.userData.terminalMesh = inst;
  } else
    for (const t of ts) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.78, 8, 6),
        new THREE.MeshBasicMaterial({color: '#d6b47b', transparent: true, opacity: 0.65})
      );
      m.position.set(...t.p);
      m.visible = false;
      m.userData.terminal = ref(c, t.id);
      m.userData.info = t.info || t.label;
      g.add(m);
      g.userData.terminals[t.id] = m;
    }
  {
    /* Controls you operate by hand in 3D: knobs turn, the stick tilts, the dial clicks round, the tilt switch tips over */ const tag =
        (o, a) =>
          o?.traverse(m => {
            if (m.isMesh && !m.userData.action) m.userData.action = a;
          }),
      ud = g.userData;
    tag(ud.knob, 'turn');
    tag(ud.stick, 'stick');
    tag(ud.encoderKnob, 'encoder');
    tag(ud.dial, 'dial');
    if (c.type === 'tilt')
      g.traverse(m => {
        if (m.isMesh && !m.userData.terminal) m.userData.action = 'tilt';
      });
  }
  mergeStaticMeshes(g);
  g.userData.localBounds = new THREE.Box3();
  g.traverse(o => {
    if (o.isMesh && !o.userData.terminal && !o.isInstancedMesh) {
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrix);
      let p = o.parent;
      while (p && p !== g) {
        b.applyMatrix4(p.matrix);
        p = p.parent;
      }
      g.userData.localBounds.union(b);
    }
  });
  if (isBreadboard(c)) g.userData.localBounds.expandByPoint(new THREE.Vector3(0, 9, 0));
  g.userData.geomKey = geometryKey(c);
  return g;
}

export const termOf = hit => {
  if (!hit) return null;
  const o = hit.object;
  if (o.userData.terminal) return {node: o.userData.terminal, info: o.userData.info};
  if (o.userData.terminalList && hit.instanceId !== undefined) return o.userData.terminalList[hit.instanceId];
  return null;
};

export const AXIAL = new Set([
  'led',
  'rgbled',
  'resistor',
  'capacitor',
  'electrolytic',
  'inductor',
  'diode',
  'ldr',
  'thermistor',
  'tilt',
  'lamp',
  'buzzer',
  'button',
]);

export const FRONT = new Set([
  'pot',
  'mic',
  'switch',
  'npn',
  'pnp',
  'mosfet',
  'regulator',
  'relay',
  'psu',
  'fgen',
  'scope',
  'servo',
  'aapack',
  'lipo',
  'keypad',
  'logic',
  'multimeter',
]);

export const DIPS = new Set(['sevenseg', 'opamp', 'ne555', 'hc595', 'ledbar']);
