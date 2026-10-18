import {isBoard, profileOf} from '../catalog/boards.js';
import {isBreadboard, terminals, breadboardTop, ref} from '../catalog/types.js';

export const rot = ([x, z], a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];

export const flat = c =>
  Math.abs(Math.sin(c.rotation[0])) < 1e-6 &&
  Math.abs(Math.sin(c.rotation[2])) < 1e-6 &&
  Math.cos(c.rotation[0]) > 0;

export const seatDepth = c => (isBoard(c) ? profileOf(c).seat : 1);

export const canSeat = c =>
  !isBreadboard(c) &&
  (isBoard(c)
    ? !!profileOf(c).seat
    : ![
        'battery',
        'psu',
        'fgen',
        'scope',
        'multimeter',
        'logic',
        'aapack',
        'lipo',
        'keypad',
        'soil',
        'motor',
        'servo',
        'lcd',
        'relay',
      ].includes(c.type));

export function holesOf(bb) {
  const a = bb.rotation[1];
  return terminals(bb).map(t => {
    const [x, z] = rot([t.p[0], t.p[2]], a);
    return {id: t.id, x: bb.position[0] + x, z: bb.position[2] + z};
  });
}

export function seat(c, project) {
  if (!canSeat(c) || !flat(c)) return null;
  const ts = terminals(c);
  if (!ts.length) return null;
  const a = c.rotation[1];
  for (const bb of project.components.filter(isBreadboard)) {
    if (!flat(bb)) continue;
    const top = bb.position[1] + breadboardTop(bb),
      seatY = top - seatDepth(c);
    if (c.position[1] > seatY + 14 || c.position[1] < seatY - 4) continue;
    const holes = holesOf(bb);
    const world = ts.map(t => {
      const [x, z] = rot([t.p[0], t.p[2]], a);
      return [c.position[0] + x, c.position[2] + z];
    });
    let best = null;
    for (const [px, pz] of world.slice(0, 1))
      for (const h of holes) {
        const d = Math.hypot(h.x - px, h.z - pz);
        if (!best || d < best.d) best = {d, dx: h.x - px, dz: h.z - pz};
      }
    if (!best || best.d > 2.6) continue;
    const contacts = [];
    for (const [i, [px, pz]] of world.entries()) {
      const x = px + best.dx,
        z = pz + best.dz;
      const h = holes.find(h => Math.abs(h.x - x) < 0.45 && Math.abs(h.z - z) < 0.45);
      if (h)
        contacts.push({
          id: `contact:${c.id}:${ts[i].id}`,
          a: ref(c, ts[i].id),
          b: ref(bb, h.id),
          kind: 'contact',
        });
    }
    if (contacts.length)
      return {position: [c.position[0] + best.dx, seatY, c.position[2] + best.dz], contacts};
  }
  return null;
}

export function reseat(project, ids) {
  const moving = new Set(ids);
  project.wires = project.wires.filter(
    w => !(w.kind === 'contact' && moving.has(w.a.slice(0, w.a.indexOf(':'))))
  );
  for (const id of ids) {
    const c = project.components.find(c => c.id === id);
    if (!c || isBreadboard(c)) continue;
    const s = seat(c, project);
    if (!s) continue;
    c.position = s.position;
    for (const w of s.contacts)
      if (!project.wires.some(x => x.a === w.a && x.b === w.b)) project.wires.push(w);
  }
  return project;
}
