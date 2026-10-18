import {reseat} from '../../../engines/workspace/snap.js';

/** What the 3D scene reports back: picks, drags, hovers, camera moves and hand controls. */
export function useSceneCallbacks(wb) {
  const {
    callbacks,
    change,
    choose,
    current,
    handStart,
    notify,
    setBackend,
    setError,
    setGraphicsGeneration,
    setHover,
    setPinInfo,
    setResolution,
    simRef,
    terminalClick,
    updateComponent,
  } = wb;
  callbacks.current = {
    onPin: pin => {
      choose([pin.node.split(':')[0]]);
      setPinInfo(pin);
    },
    onSelect: choose,
    onMove: items =>
      change(p => {
        for (const item of items) {
          const c = p.components.find(c => c.id === item.id);
          if (c) c.position = item.position;
        }
        return reseat(
          p,
          items.map(i => i.id)
        );
      }),
    onTransform: (id, position, rotation) => updateComponent(id, {position, rotation}),
    onTerminal: terminalClick,
    onHover: setHover,
    onBackend: setBackend,
    onResolution: setResolution,
    onRecover: message => {
      notify(message);
      setGraphicsGeneration(n => n + 1);
    },
    onError: message => {
      notify(message);
      setError({message});
    },
    onCamera: camera => change(p => ({...p, camera}), false),
    onAction: ({id, action, dx = 0, dy = 0}, pressed) => {
      const c = current.current.components.find(c => c.id === id);
      if (!c) return;
      const clamp = v => Math.min(1, Math.max(0, v)),
        start = handStart.current;
      if (action === 'turn') {
        if (pressed === true) handStart.current = {value: c.params.value, moved: false};
        else if (pressed === 'drag' && start && (start.moved || Math.hypot(dx, dy) > 4)) {
          start.moved = true;
          updateComponent(
            id,
            {value: Math.round(clamp(start.value + (dx - dy) * 0.0035) * 100) / 100},
            true,
            false
          );
        } else if (pressed === false) {
          /* a tap without turning selects the part */ if (!start?.moved) choose([id]);
          handStart.current = null;
        }
        return;
      }
      if (action === 'stick' || action === 'encoder') {
        const moved = Math.hypot(dx, dy) > 6;
        if (pressed === true) {
          handStart.current = {target: c.params.target ?? 0};
          updateComponent(id, {pressed: true, lastChange: simRef.current.time}, true, false);
        } else if (pressed === 'drag' && moved) {
          if (c.params.pressed)
            updateComponent(id, {pressed: false, lastChange: simRef.current.time}, true, false);
          if (action === 'stick')
            updateComponent(
              id,
              {
                x: Math.round(clamp(0.5 + dx * 0.006) * 100) / 100,
                y: Math.round(clamp(0.5 - dy * 0.006) * 100) / 100,
              },
              true,
              false
            );
          else if (start) updateComponent(id, {target: start.target + Math.round(dx / 14)}, true, false);
        } else if (pressed === false) {
          /* the KY-023 gimbal is spring-centred */ updateComponent(
            id,
            action === 'stick' ? {pressed: false, x: 0.5, y: 0.5} : {pressed: false},
            true,
            false
          );
          handStart.current = null;
        }
        return;
      }
      if (action === 'dial') {
        if (pressed === true) {
          const modes = ['V', 'A', 'Ω', 'continuity'];
          updateComponent(id, {mode: modes[(modes.indexOf(c.params.mode) + 1) % modes.length]}, true);
        }
        return;
      }
      if (action === 'tilt') {
        if (pressed === true) updateComponent(id, {tilted: !c.params.tilted}, true);
        return;
      }
      if (action === 'press') updateComponent(id, {pressed, lastChange: simRef.current.time}, true, false);
      else if (action === 'en') updateComponent(id, {enPressed: pressed}, true, false);
      else if (action === 'toggle' && pressed)
        updateComponent(id, {position: c.params.position ? 0 : 1}, true);
      else if (action === 'boot') updateComponent(id, {bootPressed: pressed}, true, false);
      else if (action.startsWith('key:'))
        updateComponent(id, {key: pressed ? action.slice(4) : ''}, true, false);
    },
    onWireRoute: (id, value) =>
      change(p => {
        Object.assign(
          p.wires.find(w => w.id === id),
          value
        );
        return p;
      }, false),
  };
  return {};
}
