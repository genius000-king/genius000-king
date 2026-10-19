// Things that glow: LEDs and their halos, segment and bar displays, lamps, board indicator LEDs.
// Each updater gets the model's userData, the part's simulated state, the component and a context
// whose set() changes a material value only when it moved (and marks the frame dirty).
import * as THREE from 'three';

export function powerMaterial(ud, c, comp, ctx) {
  ctx.set(ud.powerMaterial, (c?.powerCurrent ?? 0) * 500);
}

export function ledMaterial(ud, c, comp, ctx) {
  const b = c?.brightness ?? 0,
    base = new THREE.Color(comp.params.color);
  ctx.set(ud.ledMaterial, b * 1.25);
  const col = base.clone().multiplyScalar(0.35 + 0.65 * Math.min(1, b * 1.5));
  if (!ud.ledMaterial.color.equals(col)) {
    ud.ledMaterial.color.copy(col);
    ctx.changed = true;
  }
}

export function halo(ud, c, comp, ctx) {
  const lvl =
    comp.type === 'rgbled'
      ? Math.max(c?.redLevel ?? 0, c?.greenLevel ?? 0, c?.blueLevel ?? 0)
      : comp.type === 'lamp'
        ? Math.min(1, c?.glow ?? 0)
        : (c?.brightness ?? 0);
  if (comp.type === 'rgbled' && lvl > 0) ud.halo.material.color.setRGB(c.redLevel, c.greenLevel, c.blueLevel);
  if (Math.abs(ud.halo.material.opacity - lvl * 0.85) > 0.01) {
    ud.halo.material.opacity = lvl * 0.85;
    ctx.changed = true;
  }
}

export function segments(ud, c, comp, ctx) {
  for (const [key, material] of Object.entries(ud.segments)) ctx.set(material, (c?.segments?.[key] ?? 0) * 3);
}

export function rgbMaterial(ud, c, comp, ctx) {
  const r = c?.redLevel ?? 0,
    gg = c?.greenLevel ?? 0,
    b = c?.blueLevel ?? 0;
  const col = new THREE.Color(r, gg, b);
  if (!ud.rgbMaterial.emissive.equals(col)) {
    ud.rgbMaterial.emissive.copy(col).multiplyScalar(2.2);
    ctx.changed = true;
  }
}

export function bars(ud, c, comp, ctx) {
  ud.bars.forEach((m, i) => ctx.set(m, (c?.levels?.[i] ?? 0) * 3));
}

export function tlLeds(ud, c, comp, ctx) {
  for (const l of ud.tlLeds) {
    const lvl = c?.[l.key + 'Level'] ?? 0;
    ctx.set(l.material, lvl * 2.6);
    if (l.halo && Math.abs(l.halo.material.opacity - lvl * 0.85) > 0.01) {
      l.halo.material.opacity = lvl * 0.85;
      ctx.changed = true;
    }
  }
}

export function acLamp(ud, c, comp, ctx) {
  const hot = comp.params.on && comp.params.vrms > 50;
  ctx.set(ud.acLamp, hot ? 2.2 : 0);
  if (ud.acHalo && Math.abs(ud.acHalo.material.opacity - (hot ? 0.7 : 0)) > 0.01) {
    ud.acHalo.material.opacity = hot ? 0.7 : 0;
    ctx.changed = true;
  }
}

export function buckLed(ud, c, comp, ctx) {
  ctx.set(ud.buckLed, c?.powered ? 2 : 0);
}

export function irLeds(ud, c, comp, ctx) {
  ctx.set(ud.irLeds.pwr, c?.powered ? 2 : 0);
  ctx.set(ud.irLeds.obs, c?.detected ? 2.4 : 0);
}

export function pixels(ud, c, comp, ctx) {
  const cols = c?.colors ?? [];
  ud.pixels.forEach((m, i) => {
    const p = cols[i] ?? [0, 0, 0],
      lvl = Math.max(p[0], p[1], p[2]) / 255,
      col = lvl
        ? new THREE.Color(p[0] / 255 / lvl, p[1] / 255 / lvl, p[2] / 255 / lvl)
        : new THREE.Color(0, 0, 0);
    /* A dimmed WS2812B still shows its hue — only the intensity drops */ if (!m.emissive.equals(col)) {
      m.emissive.copy(col);
      m.color.copy(lvl ? col.clone().multiplyScalar(0.08) : new THREE.Color('#f2f2ee'));
      ctx.changed = true;
    }
    ctx.set(m, lvl > 0 ? 0.5 + 0.6 * Math.sqrt(lvl) : 0);
  });
}

export function lamp(ud, c, comp, ctx) {
  ctx.set(ud.lamp.fil, (c?.glow ?? 0) * 4);
  ctx.set(ud.lamp.glass, (c?.glow ?? 0) * 1.5);
}

export function boardLeds(ud, c, comp, ctx) {
  const leds = c?.leds ?? [];
  for (const l of ud.boardLeds) {
    const s = leds.find(x => x.label === l.label);
    ctx.set(l.material, (s?.on ?? 0) * 2.5);
  }
}

export function pirLed(ud, c, comp, ctx) {
  ctx.set(ud.pirLed, c?.detecting ? 2 : 0);
}

export function mqLeds(ud, c, comp, ctx) {
  ctx.set(ud.mqLeds[0], (c?.current ?? 0) > 0.05 ? 2 : 0);
  ctx.set(ud.mqLeds[1], (c?.ao ?? 0) > comp.params.threshold * 5 ? 2 : 0);
}

export function relayLed(ud, c, comp, ctx) {
  ctx.set(ud.relayLed, c?.led ? 2.2 : 0);
}
