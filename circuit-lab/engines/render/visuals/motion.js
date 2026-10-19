// Things that move: shafts, cones, horns, armatures, magnets, knobs, and a blown fuse wire.
// Each updater gets the model's userData, the part's simulated state, the component and a context
// whose set() changes a material value only when it moved (and marks the frame dirty).

export function stepShaft(ud, c, comp, ctx) {
  const a = (-(c?.angle ?? 0) * Math.PI) / 180;
  if (ud.stepShaft.rotation.y !== a) {
    ud.stepShaft.rotation.y = a;
    ctx.changed = true;
  }
}

export function cone(ud, c, comp, ctx) {
  ud.coneY ??= ud.cone.position.y;
  const y = ud.coneY + Math.max(-1, Math.min(1, (c?.voltage ?? 0) / 2.8)) * 0.6;
  if (ud.cone.position.y !== y) {
    ud.cone.position.y = y;
    ctx.changed = true;
  }
}

export function fuseOk(ud, c, comp, ctx) {
  const blown = !!c?.blown;
  if (ud.fuseOk.visible === blown) {
    ud.fuseOk.visible = !blown;
    if (ud.fuseBlown) ud.fuseBlown.visible = blown;
    ctx.changed = true;
  }
}

export function reedMagnet(ud, c, comp, ctx) {
  const z = -(3.25 + (comp.params.distance ?? 30));
  if (ud.reedMagnet.position.z !== z) {
    ud.reedMagnet.position.z = z;
    ctx.changed = true;
  }
}

export function slideKnob(ud, c, comp, ctx) {
  const x = ((comp.params.value ?? 0.5) - 0.5) * 60;
  if (ud.slideKnob.position.x !== x) {
    ud.slideKnob.position.x = x;
    ctx.changed = true;
  }
}

export function acKnob(ud, c, comp, ctx) {
  const r = (-(comp.params.vrms ?? 0) / 250) * Math.PI * 1.5;
  if (ud.acKnob.rotation.z !== r) {
    ud.acKnob.rotation.z = r;
    ctx.changed = true;
  }
}

export function horn(ud, c, comp, ctx) {
  if (!(c?.angle !== undefined)) return;

  const r = (-(c.angle - 90) * Math.PI) / 180;
  if (Math.abs(ud.horn.rotation.y - r) > 0.002) {
    ud.horn.rotation.y = r;
    ctx.changed = true;
  }
}

export function motorShaft(ud, c, comp, ctx) {
  if (!(c?.angle !== undefined)) return;

  if (Math.abs(ud.motorShaft.rotation.x - c.angle) > 0.002) {
    ud.motorShaft.rotation.x = c.angle;
    ctx.changed = true;
  }
}

export function armature(ud, c, comp, ctx) {
  if (!c) return;

  const r = c.closed ? -0.12 : 0;
  if (ud.armature.rotation.x !== r) {
    ud.armature.rotation.x = r;
    ctx.changed = true;
  }
}

export function plunger(ud, c, comp, ctx) {
  // pulled into the coil by the stroke; the spring between frame and washer compresses with it
  const x = -(c?.stroke ?? 0),
    {plunger: rod, spring} = ud.plunger;
  if (Math.abs(rod.position.x - x) > 0.01) {
    rod.position.x = x;
    spring.scale.x = Math.max(0.15, (10 + x) / 10);
    ctx.changed = true;
  }
}
