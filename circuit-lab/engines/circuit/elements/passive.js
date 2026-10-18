import {TRANSFORMER_MODELS, CT_TRANSFORMER_MODELS} from '../../catalog/device-models.js';
import {ELEMENTS} from './index.js';
import {windings} from './magnetics.js';

export const passiveElements = {
  resistor(k) {
    k.R('A', 'B', k.p.resistance);
    k.result(() => {
      const v = k.v('A') - k.v('B'),
        i = v / k.p.resistance,
        power = i * i * k.p.resistance;
      if (power > 0.25)
        k.diag('warning', `${k.c.name}: ${(power * 1000).toFixed(0)} mW exceeds the modeled ¼ W rating.`);
      return {voltage: v, current: i, power};
    });
  },
  capacitor(k) {
    const C = k.p.capacitance,
      v0 = k.s.v ?? 0;
    k.S('A', 'B', v0, k.h / C, 'capacitor');
    k.post(() => {
      k.next.v = k.v('A') - k.v('B');
    });
    k.result(() => {
      const v = k.v('A') - k.v('B'),
        i = (C * (v - v0)) / k.h;
      if (Math.abs(v) > k.p.rating)
        k.diag('error', `${k.c.name}: ${Math.abs(v).toFixed(1)} V exceeds its ${k.p.rating} V rating.`);
      return {voltage: v, current: i, charge: C * v};
    });
  },
  electrolytic(k) {
    const C = k.p.capacitance,
      v0 = k.s.v ?? 0;
    k.S('+', '-', v0, k.h / C, 'capacitor');
    k.post(() => {
      k.next.v = k.v('+') - k.v('-');
    });
    k.result(() => {
      const v = k.v('+') - k.v('-'),
        i = (C * (v - v0)) / k.h;
      if (Math.abs(v) > k.p.rating)
        k.diag('error', `${k.c.name}: ${Math.abs(v).toFixed(1)} V exceeds its ${k.p.rating} V rating.`);
      if (v < -1)
        k.diag(
          'error',
          `${k.c.name}: reverse polarity (${v.toFixed(2)} V). An electrolytic capacitor can fail or vent.`
        );
      return {voltage: v, current: i, charge: C * v};
    });
  },
  inductor(k) {
    const L = k.p.inductance,
      R = Math.max(1e-3, k.p.dcr),
      i0 = k.s.i ?? 0,
      g = 1 / (R + L / k.h);
    k.S('A', 'B', -(L / k.h) * i0, 1 / g, 'inductor');
    k.R('A', 'B', 1e6);
    const d = k.digital;
    k.post(() => {
      const vl = k.v('A') - k.v('B');
      k.next.i = g * vl + g * (L / k.h) * i0;
      if (Math.abs(vl) > 30) {
        d.kickV = Math.max(Math.abs(vl), d.kickAt > k.t - 100 ? d.kickV : 0);
        d.kickAt = k.t;
      }
    });
    k.result(() => {
      const v = k.v('A') - k.v('B'),
        i = g * v + g * (L / k.h) * i0;
      if (Math.abs(i) * 1000 > k.p.maxCurrent)
        k.diag(
          'warning',
          `${k.c.name}: ${(i * 1000).toFixed(0)} mA exceeds ${k.p.maxCurrent} mA; a real core would saturate.`
        );
      if (d.kickAt !== undefined && k.t - d.kickAt < 500)
        k.diag(
          'warning',
          `${k.c.name}: ${d.kickV.toFixed(0)} V inductive kick. Add a flyback diode across the coil.`
        );
      return {voltage: v, current: i, energy: 0.5 * L * i * i};
    });
  },
  transformer(k) {
    const m = TRANSFORMER_MODELS[k.p.model] ?? Object.values(TRANSFORMER_MODELS)[0],
      n =
        m.vp /
        (m.vs *
          1.08); /* real transformers are wound ≈8 % high so they reach the rated voltage at full load */
    windings(
      k,
      [
        ['P1', 'P2', m.lp, m.rp],
        ['S1', 'S2', m.lp / (n * n), m.rs],
      ],
      m.vp ? m.va / m.vp : 1,
      (i, v) => ({vp: v[0], vs: v[1], ip: i[0], is: i[1]})
    );
  },
  transformerct(k) {
    const m = CT_TRANSFORMER_MODELS[k.p.model] ?? Object.values(CT_TRANSFORMER_MODELS)[0],
      n = m.vp / (m.vs * 1.08);
    windings(
      k,
      [
        ['P1', 'P2', m.lp, m.rp],
        ['S1', 'CT', m.lp / (n * n), m.rs],
        ['CT', 'S2', m.lp / (n * n), m.rs],
      ],
      m.va / m.vp,
      (i, v) => ({vp: v[0], vs: v[1], ip: i[0], is: i[1]})
    );
  },
  toroid(k) {
    ELEMENTS.inductor(k);
  },
  choke(k) {
    ELEMENTS.inductor(k);
  },
};
