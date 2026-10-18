export const instrumentsElements = {
  psu(k) {
    if (!k.p.on) {
      k.R('+', '-', 1e7);
      k.ref('-');
      k.result(() => ({voltage: k.v('+') - k.v('-'), current: 0, mode: 'output off'}));
      return;
    }
    const P = k.n('+'),
      N = k.n('-'),
      g = 100;
    k.ref('-');
    let mode = k.digital.mode ?? 'CV',
      calls = 0;
    k.nl((x, st) => {
      const v = (x[P] ?? 0) - (x[N] ?? 0),
        i = g * (k.p.voltage - v);
      if (calls++ >= 1)
        mode =
          mode === 'CV' ? (i > k.p.limit * 1.01 ? 'CC' : 'CV') : v > k.p.voltage * 1.001 + 1e-4 ? 'CV' : 'CC';
      k.digital.mode = mode;
      if (mode === 'CC') {
        st.G(P, N, 1e-6);
        st.I(P, N, -k.p.limit);
        return 'CC';
      }
      st.G(P, N, g);
      st.I(P, N, -g * k.p.voltage);
      return 'CV';
    });
    k.result(() => {
      const v = k.v('+') - k.v('-'),
        i = Math.min(k.p.limit, g * (k.p.voltage - v));
      return {
        voltage: v,
        current: i,
        mode: i >= k.p.limit - 1e-6 ? 'CC · current limited' : 'CV · constant voltage',
      };
    });
  },
  fgen(k) {
    const f = k.p.frequency,
      ph = ((k.t / 1000) * f) % 1;
    const w =
      {
        sine: Math.sin(2 * Math.PI * ph),
        square: ph < 0.5 ? 1 : -1,
        triangle: ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph,
        saw: 2 * ph - 1,
      }[k.p.wave] ?? 0;
    k.S('OUT', 'GND', k.p.offset + k.p.amplitude * w, 50, 'function generator');
    k.ref('GND');
    k.result(() => ({voltage: k.v('OUT') - k.v('GND')}));
  },
  multimeter(k) {
    const mode = k.p.mode;
    if (mode === 'V') k.R('VΩ', 'COM', 1e7);
    else if (mode === 'A') k.R('A', 'COM', 0.1);
    else k.S('VΩ', 'COM', 2, 10000, 'ohmmeter test source');
    k.result(() => {
      const fmt = (v, u) => {
        const a = Math.abs(v);
        return a >= 1e6
          ? (v / 1e6).toFixed(3) + ' M' + u
          : a >= 1e3
            ? (v / 1e3).toFixed(3) + ' k' + u
            : a >= 1 || a === 0
              ? v.toFixed(3) + ' ' + u
              : a >= 1e-3
                ? (v * 1e3).toFixed(2) + ' m' + u
                : (v * 1e6).toFixed(1) + ' µ' + u;
      };
      if (mode === 'V') {
        const v = k.v('VΩ') - k.v('COM');
        return {reading: v, display: fmt(v, 'V')};
      }
      if (mode === 'A') {
        const i = (k.v('A') - k.v('COM')) / 0.1;
        if (Math.abs(i) > 10)
          k.diag('error', `${k.c.name}: ${i.toFixed(1)} A exceeds the 10 A input; the fuse would blow.`);
        return {reading: i, display: fmt(i, 'A')};
      }
      const vm = k.v('VΩ') - k.v('COM'),
        r = (vm * 10000) / Math.max(1e-12, 2 - vm);
      const ol = vm >= 1.999 || r > 4e7 || r < 0;
      const beep = mode === 'continuity' && !ol && r < 50;
      return {reading: ol ? Infinity : r, display: ol ? 'O.L' : fmt(r, 'Ω'), beep};
    });
  },
  scope(k) {
    k.R('CH1', 'GND', 1e6);
    k.R('CH2', 'GND', 1e6);
    k.ref('GND');
    k.post(() => k.sample([k.v('CH1') - k.v('GND'), k.v('CH2') - k.v('GND')]));
    k.result(() => ({ch1: k.v('CH1') - k.v('GND'), ch2: k.v('CH2') - k.v('GND')}));
  },
  logic(k) {
    for (let i = 0; i < 8; i++) k.R('D' + i, 'GND', 1e6);
    k.ref('GND');
    k.post(() => {
      const g = k.v('GND');
      let bits = 0;
      for (let i = 0; i < 8; i++) if (k.v('D' + i) - g > k.p.threshold) bits |= 1 << i;
      k.sample([bits]);
    });
    k.result(() => ({}));
  },
  acsource(k) {
    const p = k.p,
      vpk = p.vrms * Math.SQRT2,
      v = p.on ? vpk * Math.sin((2 * Math.PI * p.frequency * k.t) / 1000) : 0;
    k.S('L', 'N', v, 0.5, 'AC source', {max: 3});
    k.ref('N');
    k.result(() => {
      const vt = k.v('L') - k.v('N'),
        i = (v - vt) / 0.5;
      if (p.on && p.vrms > 50)
        k.diag(
          'warning',
          `${k.c.name}: ${p.vrms.toFixed(0)} V AC. On a real bench this is lethal; use an isolation transformer and insulated probes.`
        );
      if (Math.abs(i) > 3)
        k.diag('error', `${k.c.name}: ${Math.abs(i).toFixed(1)} A peak exceeds the 3 A output rating.`);
      return {voltage: vt, current: i, vrms: p.on ? p.vrms : 0, frequency: p.frequency};
    });
  },
  pwmgen(k) {
    const p = k.p,
      vin = k.vprev('VIN+') - k.vprev('VIN-'),
      on = vin >= 3.3,
      period = 1000 / Math.max(0.001, p.frequency),
      hMs = k.h * 1000,
      avg = period < 4 * hMs;
    const high = ((k.t % period) + period) % period < p.duty * period;
    const v = on ? (avg ? vin * p.duty : high ? vin : 0) : 0;
    k.S('PWM', 'GND', v, 47, 'PWM generator output', {max: 0.03});
    k.R('VIN+', 'VIN-', on ? vin / 0.015 : 1e5);
    k.result(() => ({
      out: k.v('PWM') - k.v('GND'),
      frequency: p.frequency,
      duty: p.duty,
      powered: on,
      averaged: on && avg,
    }));
  },
};
