// Build report in the spirit of the Arduino IDE: how much RAM the sketch's global variables take on the
// selected board. Only the sketch's own globals are counted exactly; on AVR boards the core and the
// libraries' fixed buffers are added as well (they decide whether a Uno sketch fits in 2 KB). Flash is
// not estimated: this simulator runs bytecode, not machine code, so any byte count would be invented.

// Static RAM that the AVR core and common libraries reserve (avr-gcc, Arduino AVR core 1.8):
// empty sketch 9 B; HardwareSerial 2 × 64 B ring buffers + object ≈ 175 B; Wire/TWI five 32 B buffers +
// state ≈ 200 B. Rounded; the IDE's exact figure depends on the core version.
export const AVR_RESERVED = {core: 9, Serial: 175, Wire: 200};

/** program (from compile) + board profile → {used, max, percent, items, reserved, warning}. */
export function memoryReport(program, profile) {
  const items = (program.memory?.items ?? []).slice().sort((a, b) => b.bytes - a.bytes);
  let used = items.reduce((s, i) => s + i.bytes, 0);
  const reserved = [];
  if (profile.family === 'avr') {
    reserved.push({name: 'Arduino core', bytes: AVR_RESERVED.core});
    if (program.memory?.uses?.includes('Serial'))
      reserved.push({name: 'Serial buffers', bytes: AVR_RESERVED.Serial});
    if (program.memory?.uses?.includes('Wire'))
      reserved.push({name: 'Wire (I²C) buffers', bytes: AVR_RESERVED.Wire});
    used += reserved.reduce((s, r) => s + r.bytes, 0);
  }
  const max = profile.ramBytes,
    percent = max ? Math.round((used / max) * 100) : null;
  return {
    used,
    max,
    percent,
    items,
    reserved,
    // the Arduino IDE warns above 75 %: the stack grows into the globals and the sketch misbehaves
    warning: percent !== null && percent > 75 ? 'Low memory available, stability problems may occur.' : null,
  };
}
