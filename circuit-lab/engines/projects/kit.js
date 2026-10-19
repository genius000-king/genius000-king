// Building blocks for project definitions: placing parts, seating them on breadboards, wiring, firmware.
import {isBoard, profileOf} from '../catalog/boards.js';
import {makeComponent, terminals, breadboardTop} from '../catalog/types.js';
import {EXAMPLES} from '../workspace/examples.js';
import {newProject, wirelessProject} from '../workspace/project.js';
import {reseat} from '../workspace/snap.js';

export const C = {
  red: '#c8463a',
  black: '#2b2b30',
  yellow: '#d7b23a',
  green: '#3f9a52',
  blue: '#3a6fd0',
  orange: '#d9822b',
  white: '#d9d9de',
  purple: '#8a5ad0',
  gray: '#8d93a1',
  brown: '#7a4a2a',
};

export function base(name) {
  const p = newProject();
  p.name = name;
  p.components = [];
  p.wires = [];
  p.files = {'main.ino': ''};
  delete p.activeBoard;
  delete p.firmware;
  p.camera = null;
  return p;
}

export function add(p, type, id, pos = [0, 0, 0], params = {}, ry = 0) {
  const c = makeComponent(type, pos, id);
  Object.assign(c.params, params);
  c.rotation = [0, ry, 0];
  p.components.push(c);
  return c;
}

export function hole(p, bbId, h) {
  const bb = p.components.find(c => c.id === bbId),
    t = terminals(bb).find(t => t.id === h);
  if (!t) throw Error(`No hole ${h} on ${bbId}`);
  return [bb.position[0] + t.p[0], bb.position[2] + t.p[2], bb.position[1] + breadboardTop(bb)];
}

export function on(p, type, id, bbId, h, params = {}, ry = 0) {
  const c = add(p, type, id, [0, 0, 0], params, ry),
    t0 = terminals(c)[0],
    [x, z, top] = hole(p, bbId, h),
    ox = t0.p[0] * Math.cos(ry) + t0.p[2] * Math.sin(ry),
    oz = -t0.p[0] * Math.sin(ry) + t0.p[2] * Math.cos(ry);
  c.position = [x - ox, top - (isBoard(c) ? profileOf(c).seat : 1), z - oz];
  return c;
}

export const get = (p, id) => p.components.find(c => c.id === id);

export function at(p, bbId, partId, pinId, row) {
  const bb = get(p, bbId),
    c = get(p, partId),
    t = terminals(c).find(t => t.id === pinId),
    a = c.rotation[1],
    x = c.position[0] + t.p[0] * Math.cos(a) + t.p[2] * Math.sin(a) - bb.position[0],
    cols = bb.type === 'bbfull' ? 63 : bb.type === 'bbhalf' ? 30 : 17;
  return `${bbId}:${row}${Math.round(x / 2.54 + (cols - 1) / 2) + 1}`;
}

export function rail(p, bbId, prefix, col) {
  const bb = get(p, bbId),
    ts = terminals(bb),
    x = ts.find(t => t.id === 'A' + col).p[0];
  let best = null;
  for (const t of ts)
    if (
      t.id.startsWith(prefix) &&
      /^\d+$/.test(t.id.slice(2)) &&
      (!best || Math.abs(t.p[0] - x) < Math.abs(best.p[0] - x))
    )
      best = t;
  return `${bbId}:${best.id}`;
}

export function w(p, a, b, color = 'yellow') {
  p.wires.push({id: 'w' + (p.wires.length + 1), a, b, color: C[color] ?? color, lift: 10});
}

export function code(p, id, src) {
  if (!p.activeBoard) {
    p.activeBoard = id;
    p.files = {'main.ino': src};
    p.activeFile = 'main.ino';
  } else {
    p.firmware ??= {};
    p.firmware[id] = {files: {'main.ino': src}, activeFile: 'main.ino'};
  }
}

export function done(p, camera) {
  reseat(
    p,
    p.components.map(c => c.id)
  );
  p.camera = camera ?? null;
  return p;
}

export const legacy = (key, name) => () => {
  if (key === 'wifi') return wirelessProject();
  const p = newProject();
  p.files['main.ino'] = EXAMPLES[key];
  p.name = name;
  if (key === 'button') {
    p.components.push(makeComponent('button', [22, 0, 45], 'button'));
    p.wires.push(
      {id: 'button1', a: 'esp32:IO4', b: 'button:1', color: '#8d93a1', lift: 12},
      {id: 'button2', a: 'esp32:GND1', b: 'button:2', color: '#344d4b', lift: 14}
    );
  }
  if (key === 'analog') {
    p.components.push(makeComponent('pot', [22, 0, 45], 'pot'));
    p.wires.push(
      ...[
        ['3V3', 'VCC'],
        ['GND1', 'GND'],
        ['VP', 'W'],
      ].map(([a, b], i) => ({
        id: 'pot' + i,
        a: 'esp32:' + a,
        b: 'pot:' + b,
        color: i === 1 ? '#344d4b' : '#ba9453',
        lift: 10 + i * 3,
      }))
    );
  }
  if (key === 'oled' || key === 'lcd') {
    p.components.push(makeComponent(key, key === 'lcd' ? [25, 0, -48] : [21, 0, -31], key));
    p.wires.push(
      ...[
        ['3V3', 'VCC'],
        ['GND1', 'GND'],
        ['IO21', 'SDA'],
        ['IO22', 'SCL'],
      ].map(([a, b], i) => ({
        id: key + i,
        a: 'esp32:' + a,
        b: key + ':' + b,
        color: ['#c76a53', '#344d4b', '#ba9453', '#8d93a1'][i],
        lift: 8 + i * 2,
      }))
    );
  }
  return p;
};
