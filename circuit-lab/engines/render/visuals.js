import {UPDATERS} from './visuals/index.js';

// LabScene methods: state
export const visualsMethods = {
  /** Applies a simulation snapshot to the 3D models; renders a frame only if something visibly changed. */
  state(state) {
    const ctx = {
      state,
      changed: false,
      set(m, v, key = 'emissiveIntensity') {
        if (m && Math.abs(m[key] - v) > 0.005) {
          m[key] = v;
          ctx.changed = true;
        }
      },
    };
    const components = new Map(this.project?.components.map(c => [c.id, c]));
    for (const [id, g] of this.objects) {
      const comp = components.get(id);
      if (!comp) continue;
      const ud = g.userData,
        c = state.components?.[id];
      for (const [part, update] of UPDATERS) if (ud[part]) update(ud, c, comp, ctx);
    }
    if (ctx.changed) this.dirty = true;
  },
};
