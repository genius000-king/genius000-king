import {REG_MODELS, FUSE_MODELS} from '../../catalog/device-models.js';
import {diodeStamp, diodeIV} from './junctions.js';
import {battery, ALKALINE, LIION} from './sources.js';

export const powerElements = {
  regulator(k) {
    const m = REG_MODELS[k.p.model] ?? REG_MODELS.LM7805,
      IN = k.n('IN'),
      OUT = k.n('OUT'),
      GND = k.n('GND'),
      g = 20;
    k.R('IN', 'GND', 9 / m.iq);
    k.nl((x, st) => {
      const vin = (x[IN] ?? 0) - (x[GND] ?? 0),
        vout = (x[OUT] ?? 0) - (x[GND] ?? 0);
      if (vin - m.dropout >= m.vout) {
        const i = g * (m.vout - vout);
        if (i < 0) return 'off';
        st.M(OUT, OUT, g);
        st.M(OUT, GND, -g);
        st.rhs(OUT, g * m.vout);
        st.M(IN, OUT, -g);
        st.M(IN, GND, g);
        st.rhs(IN, -g * m.vout);
        return 'reg';
      }
      const i = g * (vin - m.dropout - vout);
      if (i < 0) return 'off';
      st.G(IN, OUT, g);
      st.I(IN, OUT, g * m.dropout * -1);
      return 'drop';
    });
    k.result(() => {
      const vin = k.v('IN') - k.v('GND'),
        vout = k.v('OUT') - k.v('GND');
      const iout = Math.max(
        0,
        vin - m.dropout >= m.vout ? g * (m.vout - vout) : g * (vin - m.dropout - vout)
      );
      const dissipation = (vin - vout) * iout + vin * m.iq;
      if (vin > 0.5 && vin < m.vout + m.dropout)
        k.diag(
          'warning',
          `${k.c.name}: input ${vin.toFixed(2)} V is below ${(m.vout + m.dropout).toFixed(1)} V; the ${k.p.model} is in dropout.`
        );
      if (dissipation > 1.5)
        k.diag(
          'warning',
          `${k.c.name}: dissipates ${dissipation.toFixed(2)} W. Without a heatsink it would overheat and shut down.`
        );
      if (iout > m.imax) k.diag('error', `${k.c.name}: load ${iout.toFixed(2)} A exceeds ${m.imax} A.`);
      if (vin > m.vinmax) k.diag('error', `${k.c.name}: input exceeds ${m.vinmax} V maximum.`);
      return {vin, vout, iout, dissipation};
    });
  },
  battery(k) {
    battery(
      k,
      soc => k.p.voltage * (0.8 + 0.2 * Math.sqrt(Math.max(0, soc))),
      k.p.internalResistance,
      k.p.capacity ?? 550,
      k.p.maxCurrent
    );
  },
  aapack(k) {
    battery(k, soc => (k.p.cells * 1.5 * ALKALINE(soc)) / ALKALINE(1), 0.15 * k.p.cells, k.p.capacity, 2000);
  },
  lipo(k) {
    k.s.soc ??= k.p.soc;
    battery(k, LIION, 0.05, k.p.capacity, 5000);
  },
  lm317(k) {
    const IN = k.n('IN'),
      OUT = k.n('OUT'),
      ADJ = k.n('ADJ'),
      g = 20,
      vref = 1.25,
      drop = 2;
    k.nl((x, st) => {
      const vin = x[IN] ?? 0,
        vout = x[OUT] ?? 0,
        vadj = x[ADJ] ?? 0;
      if (vin - drop >= vadj + vref) {
        const i = g * (vadj + vref - vout);
        if (i < 0) return 'off';
        st.M(OUT, OUT, g);
        st.M(OUT, ADJ, -g);
        st.rhs(OUT, g * vref);
        st.M(IN, OUT, -g);
        st.M(IN, ADJ, g);
        st.rhs(IN, -g * vref);
        return 'reg';
      }
      const i = g * (vin - drop - vout);
      if (i < 0) return 'off';
      st.G(IN, OUT, g);
      st.I(IN, OUT, -g * drop);
      return 'drop';
    });
    k.result(() => {
      const vin = k.v('IN'),
        vout = k.v('OUT'),
        vadj = k.v('ADJ'),
        reg = vin - drop >= vadj + vref,
        iout = Math.max(0, reg ? g * (vadj + vref - vout) : g * (vin - drop - vout)),
        dissipation = (vin - vout) * iout;
      if (vin > 0.5 && !reg)
        k.diag(
          'warning',
          `${k.c.name}: input ${vin.toFixed(2)} V is less than 2 V above the ${(vadj + vref).toFixed(2)} V target; the LM317 is in dropout.`
        );
      if (iout > 0 && iout < 0.0035)
        k.diag(
          'warning',
          `${k.c.name}: only ${(iout * 1000).toFixed(1)} mA flows; the LM317 needs ≈3.5 mA minimum load (use 240 Ω from OUT to ADJ).`
        );
      if (dissipation > 1.5)
        k.diag('warning', `${k.c.name}: dissipates ${dissipation.toFixed(2)} W; it needs a heatsink.`);
      if (iout > 1.5) k.diag('error', `${k.c.name}: ${iout.toFixed(2)} A exceeds 1.5 A.`);
      if (vin - vout > 40) k.diag('error', `${k.c.name}: input–output difference exceeds 40 V.`);
      return {vin, vout, iout, dissipation};
    });
  },
  buck(k) {
    const p = k.p,
      vin = k.vprev('IN+') - k.vprev('IN-'),
      on = vin >= 4.5,
      target = Math.max(0, Math.min(p.vout, vin - 1.5)),
      pout = k.s.pout ?? 0;
    if (on) {
      k.S('OUT+', 'OUT-', target, 0.04, 'buck output', {max: 3});
      k.R(
        'IN+',
        'IN-',
        Math.max(0.5, Math.min(1e6, (vin * vin) / (Math.max(1e-4, pout / p.efficiency) + vin * 0.005)))
      );
    } else {
      k.R('OUT+', 'OUT-', 1e6);
      k.R('IN+', 'IN-', 1e5);
    }
    k.post(() => {
      const vo = k.v('OUT+') - k.v('OUT-'),
        io = on ? Math.max(0, (target - vo) / 0.04) : 0;
      k.next.pout = vo * io;
    });
    k.result(() => {
      const vi = k.v('IN+') - k.v('IN-'),
        vo = k.v('OUT+') - k.v('OUT-'),
        io = on ? Math.max(0, (target - vo) / 0.04) : 0,
        iin = on ? ((vo * io) / p.efficiency + vi * 0.005) / Math.max(0.1, vi) : 0;
      if (on && p.vout > vi - 1.5)
        k.diag(
          'warning',
          `${k.c.name}: a buck converter can only step down; input ${vi.toFixed(1)} V cannot give ${p.vout.toFixed(1)} V.`
        );
      if (vi > 40) k.diag('error', `${k.c.name}: input exceeds 40 V.`);
      if (io > 3) k.diag('error', `${k.c.name}: ${io.toFixed(1)} A exceeds 3 A.`);
      return {vin: vi, vout: vo, iout: io, iin, powered: on};
    });
  },
  solar(k) {
    const iph = (0.2 * Math.max(0, k.p.irradiance)) / 1000,
      P = k.n('+'),
      N = k.n('-'),
      m = {is: 3.5e-9, n: 1.3 * 12};
    diodeStamp(k, P, N, m);
    k.R('+', '-', 300);
    k.nl((x, st) => {
      st.I(N, P, iph);
      return 'pv';
    });
    k.ref('-');
    k.result(() => {
      const v = k.v('+') - k.v('-'),
        i = iph - diodeIV(v, m).i - v / 300;
      return {voltage: v, current: i, power: v * i};
    });
  },
  fuse(k) {
    const m = FUSE_MODELS[k.p.model] ?? Object.values(FUSE_MODELS)[0],
      d = k.digital;
    if (k.p.replace) {
      d.blown = false;
      d.tripped = false;
      d.H = 0;
    }
    if (d.model !== k.p.model) {
      d.model = k.p.model;
      d.blown = false;
      d.tripped = false;
      d.H = 0;
    }
    d.H ??= 0;
    const R = d.blown ? 1e9 : m.ptc ? (d.tripped ? 150 : 0.6) : m.tau > 1 ? 0.1 : 0.05;
    k.R('A', 'B', R);
    k.post(() => {
      const i = (k.v('A') - k.v('B')) / R,
        x = (i * i) / (m.rating * m.rating);
      d.H += (x - d.H) * Math.min(1, k.h / m.tau);
      d.peak = Math.max(d.peak ?? 0, Math.abs(i));
      if (!m.ptc && !d.blown && d.H > m.blow) {
        d.blown = true;
        d.blownAt = Math.abs(i);
      }
      if (m.ptc) {
        if (!d.tripped && d.H > m.blow) d.tripped = true;
        else if (d.tripped && i * i * R < 0.05) d.tripped = false;
      }
    });
    k.result(() => {
      const i = (k.v('A') - k.v('B')) / R;
      if (d.blown)
        k.diag(
          'error',
          `${k.c.name}: the ${m.rating * 1000 < 1000 ? m.rating * 1000 + ' mA' : m.rating + ' A'} fuse blew at ${(d.blownAt ?? 0).toFixed(2)} A. Find the fault, then press “Replace fuse”.`
        );
      if (d.tripped)
        k.diag(
          'warning',
          `${k.c.name}: PTC tripped to high resistance. Remove power to let it cool and reset.`
        );
      return {
        current: i,
        blown: !!d.blown,
        tripped: !!d.tripped,
        state: d.blown ? 'blown · open circuit' : d.tripped ? 'tripped · high resistance' : 'intact',
      };
    });
  },
};
