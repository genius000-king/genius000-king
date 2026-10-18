import {isBoard} from '../../../engines/catalog/boards.js';
import {TYPES, makeComponent} from '../../../engines/catalog/types.js';
import {filesForBoard} from '../../../engines/workspace/project.js';
import {reseat} from '../../../engines/workspace/snap.js';

/** Selecting, adding, duplicating, rotating and deleting parts; connecting terminals with wires. */
export function useEditing(wb) {
  const {
    change,
    editingWire,
    notify,
    pending,
    project,
    scene,
    selected,
    setConnect,
    setEditingWire,
    setInspectorTab,
    setLibrary,
    setPending,
    setPinInfo,
    setSelected,
    setWireId,
    wireId,
  } = wb;
  const choose = (ids, wire = null) => {
    setPinInfo(null);
    scene.current?.traceNet(null);
    if (ids.length || wire) setLibrary(false);
    setSelected(ids);
    setWireId(wire);
    setInspectorTab('properties');
  };
  const deleteSelection = () => {
    if (wireId) {
      change(p => {
        p.wires = p.wires.filter(w => w.id !== wireId);
        return p;
      });
      setWireId(null);
      notify('Wire disconnected');
    } else if (selected.length) {
      change(p => {
        const oldTarget = p.activeBoard ?? p.components.find(c => isBoard(c))?.id;
        const remaining = p.components.filter(c => !selected.includes(c.id));
        if (selected.includes(oldTarget)) {
          p.firmware ??= {};
          p.firmware[oldTarget] = {files: structuredClone(p.files), activeFile: p.activeFile};
          const next = remaining.find(c => isBoard(c));
          if (next) {
            p.files = structuredClone(filesForBoard(p, next.id));
            p.activeFile = p.firmware[next.id]?.activeFile ?? Object.keys(p.files)[0];
          }
          p.activeBoard = next?.id ?? null;
        }
        for (const id of selected) if (p.firmware) delete p.firmware[id];
        p.components = remaining;
        p.wires = p.wires.filter(
          w => ![w.a.split(':')[0], w.b.split(':')[0]].some(id => selected.includes(id))
        );
        return p;
      });
      setSelected([]);
    }
  };
  const duplicate = () => {
    if (project.components.length + selected.length > 200) {
      notify('The workspace supports up to 200 components.');
      return;
    }
    const ids = [];
    change(p => {
      for (const c of p.components.filter(c => selected.includes(c.id))) {
        const n = structuredClone(c);
        n.id = crypto.randomUUID();
        if (c.type === 'board') {
          p.firmware ??= {};
          p.firmware[n.id] = {files: structuredClone(filesForBoard(p, c.id)), activeFile: 'main.ino'};
        }
        n.position[0] += 10;
        n.position[2] += 10;
        p.components.push(n);
        ids.push(n.id);
      }
      return p;
    });
    setSelected(ids);
    notify('Components duplicated');
  };
  const rotate = (axis, deg) =>
    change(p => {
      p.components.forEach(c => {
        if (selected.includes(c.id)) {
          c.rotation[axis] += (deg * Math.PI) / 180;
          if (axis !== 1 && Math.abs(c.rotation[axis] % (2 * Math.PI)) > 0.1)
            c.position[1] = Math.max(c.position[1], isBoard(c) ? 8 : 5);
        }
      });
      return p;
    });
  const add = (type, pos) => {
    if (project.components.length >= 200) {
      notify('The workspace supports up to 200 components.');
      return;
    }
    const c = makeComponent(type, pos ?? [(Math.random() - 0.5) * 30, 0, 42]);
    change(p => {
      p.components.push(c);
      return reseat(p, [c.id]);
    });
    setSelected([c.id]);
    setWireId(null);
    setLibrary(false);
    notify(`${TYPES[type].name} added`);
  };
  const connectNodes = (a, b) => {
    if (!editingWire && project.wires.length >= 2000) {
      notify('The workspace supports up to 2,000 wires.');
      return;
    }
    if (!a || !b || a === b) {
      notify('Choose two different terminals.');
      return;
    }
    if (
      project.wires.some(w => w.id !== editingWire && ((w.a === a && w.b === b) || (w.a === b && w.b === a)))
    ) {
      notify('Those terminals are already connected.');
      return;
    }
    const gnd = a.includes('GND') || b.includes('GND');
    change(p => {
      if (editingWire) {
        Object.assign(
          p.wires.find(w => w.id === editingWire),
          {a, b}
        );
      } else
        p.wires.push({
          id: crypto.randomUUID(),
          a,
          b,
          color: gnd ? '#344d4b' : a.includes('3V3') || a.includes('5V') ? '#c76a53' : '#ba9453',
          lift: 10,
        });
      return p;
    });
    setPending(null);
    setConnect(false);
    setEditingWire(null);
    notify('Connection made');
  };
  const terminalClick = node => {
    if (!pending) {
      setPending(node);
      notify('Select a second terminal to connect.');
    } else connectNodes(pending, node);
  };
  return {choose, deleteSelection, duplicate, rotate, add, connectNodes, terminalClick};
}
