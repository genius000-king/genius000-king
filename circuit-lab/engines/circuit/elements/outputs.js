import {display} from './sensing.js';

export const outputsElements = {
  led(k) {
    k.led('A', 'K', k.p.vf ?? 1.9, 15);
    k.result(() => {
      const voltage = k.v('A') - k.v('K'),
        current = k.avg('A', Math.max(0, (voltage - k.p.vf) / 15));
      if (current * 1000 > k.p.maxCurrent)
        k.diag(
          'error',
          `${k.c.name}: ${(current * 1000).toFixed(1)} mA exceeds ${k.p.maxCurrent} mA. Add a series resistor.`
        );
      if (voltage < -5) k.diag('error', `${k.c.name}: reverse voltage exceeds 5 V.`);
      return {voltage, current, brightness: Math.min(1, current / 0.012)};
    });
  },
  rgbled(k) {
    const vf = {R: 2, G: 3, B: 3};
    for (const ch of ['R', 'G', 'B']) k.led(ch, 'K', vf[ch], 15);
    k.result(() => {
      const r = {};
      for (const [ch, key] of [
        ['R', 'red'],
        ['G', 'green'],
        ['B', 'blue'],
      ]) {
        const i = Math.max(0, (k.v(ch) - k.v('K') - vf[ch]) / 15);
        r[key] = i;
        r[key + 'Level'] = Math.min(1, k.avg(ch, i) / 0.012);
        if (i * 1000 > k.p.maxCurrent)
          k.diag(
            'error',
            `${k.c.name} ${key}: ${(i * 1000).toFixed(1)} mA. Add a series resistor per color.`
          );
      }
      return r;
    });
  },
  ledbar(k) {
    for (let i = 1; i <= 10; i++) k.led('A' + i, 'K' + i, k.p.vf, 15);
    k.result(() => {
      const levels = [];
      for (let i = 1; i <= 10; i++) {
        const c = Math.max(0, (k.v('A' + i) - k.v('K' + i) - k.p.vf) / 15);
        levels.push(Math.min(1, k.avg('A' + i, c) / 0.012));
        if (c * 1000 > k.p.maxCurrent)
          k.diag('error', `${k.c.name} segment ${i}: ${(c * 1000).toFixed(1)} mA. Add a series resistor.`);
      }
      return {levels};
    });
  },
  sevenseg(k) {
    const segs = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP'];
    for (const s of segs) k.led(s, 'COM1', k.p.vf ?? 1.9, 15);
    k.result(() => {
      const r = {voltage: k.v('A') - k.v('COM1'), segments: {}, current: 0};
      for (const s of segs) {
        const i = Math.max(0, (k.v(s) - k.v('COM1') - k.p.vf) / 15);
        r.segments[s] = Math.min(1, k.avg(s, i) / 0.012);
        r.current += i;
        if (i * 1000 > k.p.maxCurrent)
          k.diag(
            'error',
            `${k.c.name} segment ${s}: ${(i * 1000).toFixed(1)} mA. Add a series resistor per segment.`
          );
      }
      return r;
    });
  },
  relay(k) {
    const d = k.digital,
      R = k.p.coilResistance,
      L = k.p.inductance,
      i0 = k.s.i ?? 0,
      g = 1 / (R + L / k.h),
      inom = k.p.coilVoltage / R;
    k.S('C1', 'C2', -(L / k.h) * i0, 1 / g, 'relay coil');
    k.R('C1', 'C2', 20000);
    d.closed ??= false;
    k.R('COM', d.closed ? 'NO' : 'NC', 0.05);
    k.post(() => {
      const vc = k.v('C1') - k.v('C2'),
        i = g * vc + g * (L / k.h) * i0;
      k.next.i = i;
      if (Math.abs(vc) > 30) {
        d.kickV = Math.max(Math.abs(vc), d.kickAt > k.t - 100 ? d.kickV : 0);
        d.kickAt = k.t;
      }
      const a = Math.abs(i);
      if (!d.closed && a > 0.75 * inom) {
        d.at ??= k.t + 8;
        if (k.t >= d.at) {
          d.closed = true;
          d.at = null;
        }
      } else if (d.closed && a < 0.1 * inom) {
        d.at ??= k.t + 4;
        if (k.t >= d.at) {
          d.closed = false;
          d.at = null;
        }
      } else d.at = null;
    });
    k.result(() => {
      const v = k.v('C1') - k.v('C2'),
        i = g * v + g * (L / k.h) * i0;
      if (d.kickAt !== undefined && k.t - d.kickAt < 500)
        k.diag(
          'warning',
          `${k.c.name}: ${d.kickV.toFixed(0)} V inductive kick when the coil current was interrupted. Add a flyback diode (cathode to +) across the coil.`
        );
      if (Math.abs(i) > 1.5 * inom)
        k.diag(
          'warning',
          `${k.c.name}: coil current ${(i * 1000).toFixed(0)} mA exceeds nominal ${(inom * 1000).toFixed(0)} mA.`
        );
      return {coil: i, state: d.closed ? 'COM → NO (energized)' : 'COM → NC (released)', closed: d.closed};
    });
  },
  // KY-019: the signal pin drives an S8050 through 1 kΩ; when the transistor saturates the coil sees the
  // module's supply. A 1N4007 across the coil carries its current after switch-off (no kick reaches the
  // pins, the relay just releases a little later). A red LED with 1 kΩ sits in parallel with the coil.
  relaymodule(k) {
    k.led('S', '-', 0.7, 1000); // base-emitter junction behind the 1 kΩ resistor
    const d = k.digital,
      R = k.p.coilResistance,
      L = k.p.inductance,
      Rsat = 3, // V CE(sat) ≈ 0.2 V at 70 mA
      i0 = k.s.i ?? 0,
      vcc = k.vprev('+') - k.vprev('-'),
      ib = Math.max(0, (k.vprev('S') - k.vprev('-') - 0.7) / 1000),
      inom = 5 / R,
      on = vcc > 1 && ib * k.p.hfe > (0.9 * vcc) / R,
      g = 1 / (R + Rsat + L / k.h);
    if (on) {
      k.S('+', '-', -(L / k.h) * i0, 1 / g, 'relay module coil');
      k.R('+', '-', 1800); // indicator LED and its resistor (≈ 2.8 mA at 5 V)
    }
    d.closed ??= false;
    k.R('COM', d.closed ? 'NO' : 'NC', 0.05);
    k.post(() => {
      const vc = k.v('+') - k.v('-');
      // energized: the coil follows the supply; released: its current decays through the diode (0.7 V)
      const i = on ? g * vc + g * (L / k.h) * i0 : Math.max(0, ((L / k.h) * i0 - 0.7) / (R + L / k.h));
      k.next.i = i;
      // SRD-05VDC-SL-C: operate ≤ 10 ms, release ≤ 5 ms (plus the diode's slower decay)
      if (!d.closed && i > 0.75 * inom) {
        d.at ??= k.t + 6;
        if (k.t >= d.at) {
          d.closed = true;
          d.at = null;
        }
      } else if (d.closed && i < 0.1 * inom) {
        d.at ??= k.t + 4;
        if (k.t >= d.at) {
          d.closed = false;
          d.at = null;
        }
      } else d.at = null;
    });
    k.result(() => {
      const vs = k.v('S') - k.v('-'),
        supply = k.v('+') - k.v('-'),
        input = Math.max(0, (vs - 0.7) / 1000),
        i = k.s.i ?? 0;
      if (input > 0 && supply < 1)
        k.diag(
          'warning',
          `${k.c.name}: the signal is HIGH but + has no supply. Connect + to 5 V and − to GND.`
        );
      else if (on && supply < 3.75)
        k.diag(
          'warning',
          `${k.c.name}: ${supply.toFixed(2)} V on +; the 5 V relay needs at least 3.75 V to pull in.`
        );
      if (supply > 6.5)
        k.diag('warning', `${k.c.name}: ${supply.toFixed(1)} V on + is above the 5 V coil rating.`);
      return {
        input,
        coil: i,
        led: on && supply > 2,
        closed: d.closed,
        state: d.closed ? 'COM → NO (energized)' : 'COM → NC (released)',
      };
    });
  },
  // JF-0530B: the coil is an R-L; the plunger pulls in once the magnetic force (∝ i²) beats the spring.
  solenoid(k) {
    const d = k.digital,
      R = k.p.coilResistance,
      L = k.p.inductance,
      i0 = k.s.i ?? 0,
      g = 1 / (R + L / k.h);
    k.S('+', '-', -(L / k.h) * i0, 1 / g, 'solenoid coil');
    k.R('+', '-', 1e6);
    d.x ??= 0;
    k.post(() => {
      const v = k.v('+') - k.v('-'),
        i = g * v + g * (L / k.h) * i0;
      k.next.i = i;
      // Interrupting the coil current with nothing to carry it (no diode) makes the coil reverse its
      // voltage to keep the current flowing. The real spike is far shorter than a simulation step, so a
      // reversal of more than a diode drop counts, and its size is estimated from L·di/dt.
      const reversed = Math.abs(i0) > 0.02 && -v * Math.sign(i0) > 3,
        spike = reversed ? Math.max(Math.abs(v), (L * Math.abs(i0 - i)) / k.h) : Math.abs(v);
      if (reversed || spike > 30) {
        d.kickV = Math.max(spike, d.kickAt > k.t - 100 ? d.kickV : 0);
        d.kickAt = k.t;
      }
      // about 5 N at the rated 300 mA; the return spring holds about 0.6 N
      const force = 5 * (i / k.p.ratedCurrent) ** 2,
        target = force > 0.6 ? 10 : 0,
        tau = target ? 12 : 25; // ms: pull-in is quicker than the spring return
      d.x += (target - d.x) * Math.min(1, (k.h * 1000) / tau);
      d.force = force;
      if (Math.abs(i) > 0.5 * k.p.ratedCurrent) d.onSince ??= k.t;
      else d.onSince = null;
    });
    k.result(() => {
      const v = k.v('+') - k.v('-'),
        i = g * v + g * (L / k.h) * i0;
      if (d.kickAt !== undefined && k.t - d.kickAt < 500)
        k.diag(
          'warning',
          `${k.c.name}: inductive kick when the coil was switched off${d.kickV > 30 ? ` (≈ ${d.kickV.toFixed(0)} V here)` : ''}. On real hardware the spike lasts microseconds and reaches tens to hundreds of volts, enough to destroy the transistor. Put a flyback diode across the coil (cathode to +).`
        );
      if (d.onSince !== null && d.onSince !== undefined && k.t - d.onSince > 2000)
        k.diag(
          'warning',
          `${k.c.name}: energized for ${((k.t - d.onSince) / 1000).toFixed(1)} s. The JF-0530B is made for short pulses (about 1 s on, 1 s off); held on it overheats.`
        );
      if (Math.abs(i) > 1.6 * k.p.ratedCurrent)
        k.diag('warning', `${k.c.name}: ${(i * 1000).toFixed(0)} mA is far above the 300 mA rating.`);
      return {voltage: v, current: i, stroke: d.x, force: d.force ?? 0};
    });
  },
  motor(k) {
    const Ke = 0.005,
      R = 8,
      J = 2e-7,
      b = 4.2e-7,
      stall = Ke * (6 / R),
      w = k.s.w ?? 0,
      th = k.s.theta ?? 0;
    k.S('+', '-', Ke * w, R, 'motor back-EMF');
    k.post(() => {
      const i = (k.v('+') - k.v('-') - Ke * w) / R;
      let tq = Ke * i - b * w;
      const load = k.p.load * stall;
      if (Math.abs(w) > 1) tq -= Math.sign(w) * load;
      else if (Math.abs(tq) <= load) tq = 0;
      else tq -= Math.sign(tq) * load;
      const nw = w + (k.h * tq) / J;
      k.next.w = nw;
      k.next.theta = (th + nw * k.h) % (Math.PI * 2000);
    });
    k.result(() => {
      const v = k.v('+') - k.v('-'),
        i = (v - Ke * w) / R;
      return {voltage: v, current: i, rpm: (w * 60) / (2 * Math.PI), angle: th};
    });
  },
  servo(k) {
    const a = k.s.angle ?? 90,
      vcc = k.vprev('VCC') - k.vprev('GND'),
      moving = k.s.moving ?? 0;
    k.R('VCC', 'GND', vcc > 0.5 ? Math.max(5, vcc / (0.006 + 0.25 * moving)) : 1000);
    const sig = k.drive('SIG');
    k.post(() => {
      const vc = k.v('VCC') - k.v('GND');
      let pulse = k.s.pulse ?? null;
      if (sig?.servo) pulse = sig.servo;
      else if (sig?.freq >= 40 && sig.freq <= 400 && sig.duty > 0) pulse = (sig.duty / sig.freq) * 1e6;
      let na = a,
        mv = 0;
      if (pulse && vc > 3.2) {
        const target = Math.max(0, Math.min(180, ((pulse - 544) / (2400 - 544)) * 180)),
          rate = 600 * Math.min(1, vc / 4.8) * k.h;
        na = Math.abs(target - a) <= rate ? target : a + Math.sign(target - a) * rate;
        mv = Math.abs(na - a) > 1e-6 ? 1 : 0;
      }
      k.next.angle = na;
      k.next.pulse = pulse;
      k.next.moving = mv;
    });
    k.result(() => {
      const vc = k.v('VCC') - k.v('GND');
      if (vc > 0.5 && vc < 4.5)
        k.diag(
          'warning',
          `${k.c.name}: SG90 supply is ${vc.toFixed(2)} V; it needs 4.8–6 V and may jitter or brown out.`
        );
      if (vc > 6.5) k.diag('error', `${k.c.name}: ${vc.toFixed(1)} V exceeds the SG90 6 V maximum.`);
      return {angle: a, pulse: k.s.pulse ?? 0, current: vc / Math.max(5, vc / (0.006 + 0.25 * moving))};
    });
  },
  buzzer(k) {
    k.R('+', '-', k.p.active ? 150 : 1000);
    const drv = k.drive('+');
    k.result(() => {
      const voltage = k.v('+') - k.v('-');
      const pwm = drv && drv.freq > 0 && drv.duty > 0 && drv.duty < 1;
      return {
        voltage,
        frequency: pwm ? drv.freq : (k.p.frequency ?? 1000),
        active: k.p.active ? voltage > 1.5 : !!pwm && voltage > 0.1,
        current: voltage / (k.p.active ? 150 : 1000),
      };
    });
  },
  lamp(k) {
    const Rh = k.p.ratedVoltage / k.p.ratedCurrent,
      Rc = Rh / 10,
      T = k.s.T ?? 0,
      R = Rc + (Rh - Rc) * Math.min(1, T);
    k.R('A', 'B', R);
    k.post(() => {
      const v = k.v('A') - k.v('B'),
        P = (v * v) / R,
        Pr = k.p.ratedVoltage * k.p.ratedCurrent;
      k.next.T = T + (Math.pow(Math.max(0, P / Pr), 0.45) - T) * Math.min(1, k.h / 0.06);
    });
    k.result(() => {
      const v = k.v('A') - k.v('B'),
        i = v / R,
        P = v * i,
        Pr = k.p.ratedVoltage * k.p.ratedCurrent;
      if (P > 1.6 * Pr)
        k.diag(
          'error',
          `${k.c.name}: ${(P * 1000).toFixed(0)} mW is far above rating; the filament would burn out.`
        );
      return {voltage: v, current: i, resistance: R, glow: Math.min(1.4, Math.pow(Math.max(0, P / Pr), 1.6))};
    });
  },
  neopixel(k) {
    const d = k.digital,
      colors = d.colors ?? [];
    let load = 0.0006 * k.p.count;
    for (const c of colors) if (c) load += ((c[0] + c[1] + c[2]) / 255) * 0.016;
    const vcc = k.vprev('VCC') - k.vprev('GND');
    k.R('VCC', 'GND', vcc > 0.5 ? Math.max(1, vcc / load) : 5 / load);
    k.result(() => {
      const v = k.v('VCC') - k.v('GND');
      if (v > 0.5 && v < 3.5)
        k.diag('warning', `${k.c.name}: WS2812B supply ${v.toFixed(2)} V is below 3.5 V.`);
      if (v > 5.5) k.diag('error', `${k.c.name}: ${v.toFixed(1)} V exceeds 5.5 V.`);
      return {voltage: v, current: v / Math.max(1, v / load), colors: v > 3 ? colors : []};
    });
  },
  oled(k) {
    display(k);
  },
  lcd(k) {
    display(k);
  },
  stepper(k) {
    const d = k.digital,
      W = ['BLUE', 'PINK', 'YELLOW', 'ORANGE'];
    d.p ??= 0;
    d.next ??= 0;
    for (const w of W) k.R('RED', w, 50);
    k.post(() => {
      const on = W.map(w => (k.v('RED') - k.v(w)) / 50 > 0.04);
      let target = null;
      const n = on.filter(Boolean).length;
      if (n === 1) target = 2 * on.indexOf(true);
      else if (n === 2) {
        for (let i = 0; i < 4; i++) if (on[i] && on[(i + 1) % 4]) target = (2 * i + 1) % 8;
      }
      if (target !== null && k.t >= d.next) {
        const e = ((d.p % 8) + 8) % 8,
          diff = ((target - e + 12) % 8) - 4;
        if (diff !== 0 && diff !== -4) {
          d.p += Math.sign(diff);
          d.next = k.t + 0.9;
        }
      }
      if (d.rt === undefined || k.t - d.rt >= 200) {
        d.rpm = d.rt === undefined ? 0 : (d.p - d.rp) / 4096 / ((k.t - d.rt) / 60000);
        d.rt = k.t;
        d.rp = d.p;
      }
    });
    k.result(() => {
      const i = W.reduce((a, w) => a + Math.max(0, (k.v('RED') - k.v(w)) / 50), 0);
      return {angle: ((((d.p * 360) / 4096) % 360) + 360) % 360, steps: d.p, rpm: d.rpm ?? 0, current: i};
    });
  },
  speaker(k) {
    k.R('+', '-', 8);
    const d = k.digital;
    /* the cone only knows the voltage across it, so the pitch is measured from its rising edges */ k.post(
      () => {
        const on = Math.abs(k.v('+') - k.v('-')) > 0.2;
        if (on && !d.on) {
          if (d.rise !== undefined) {
            const f = 1000 / (k.t - d.rise);
            d.freq = d.freq ? d.freq * 0.6 + f * 0.4 : f;
          }
          d.rise = k.t;
        }
        d.on = on;
      }
    );
    k.result(() => {
      const v = k.v('+') - k.v('-'),
        i = v / 8,
        power = (v * v) / 8,
        pwm = d.rise !== undefined && k.t - d.rise < 30 && d.freq > 15;
      if (power > 0.5)
        k.diag(
          'warning',
          `${k.c.name}: ${(power * 1000).toFixed(0)} mW exceeds the 0.5 W rating; the voice coil would overheat.`
        );
      return {voltage: v, current: i, power, frequency: pwm ? Math.round(d.freq) : 0, active: pwm};
    });
  },
  trafficlight(k) {
    const L = [
      ['R', 2, 'red'],
      ['Y', 2.1, 'yellow'],
      ['G', 2.2, 'green'],
    ];
    for (const [pin, vf] of L) k.led(pin, 'GND', vf, 235);
    k.result(() => {
      const r = {};
      for (const [pin, vf, key] of L) {
        const i = Math.max(0, (k.v(pin) - k.v('GND') - vf) / 235);
        r[key] = i;
        r[key + 'Level'] = Math.min(1, k.avg(pin, i) / 0.012);
      }
      return r;
    });
  },
  panelmeter(k) {
    k.R('V+', 'GND', 300);
    k.R('VIN', 'GND', 1e5);
    k.result(() => {
      const vs = k.v('V+') - k.v('GND'),
        r = k.v('VIN') - k.v('GND'),
        powered = vs >= 4.5;
      if (vs > 30) k.diag('error', `${k.c.name}: supply exceeds 30 V.`);
      if (r > 100) k.diag('warning', `${k.c.name}: ${r.toFixed(0)} V is beyond the 0–100 V range.`);
      const display = !powered
        ? ''
        : r >= 99.95
          ? 'HHH'
          : r < 0
            ? '0.00'
            : r < 9.995
              ? r.toFixed(2)
              : r.toFixed(1);
      return {display, powered, reading: r};
    });
  },
};
