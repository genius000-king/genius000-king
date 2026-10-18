import {BJT_MODELS} from '../../catalog/device-models.js';

export const VT = 0.025852;

export const ex = v => Math.exp(Math.min(v, 80));

export function pnjlim(vnew, vold, vt, vcrit) {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / vt;
      vnew = arg > 0 ? vold + vt * Math.log(arg) : vcrit;
    } else vnew = vt * Math.log(vnew / vt);
  }
  return vnew;
}

export const vcrit = (is, nvt) => nvt * Math.log(nvt / (Math.SQRT2 * is));

export const softplus = (x, s) => (x / s > 30 ? x : s * Math.log1p(Math.exp(x / s)));

export const sigmoid = (x, s) => 1 / (1 + Math.exp(-Math.max(-60, Math.min(60, x / s))));

export function diodeIV(v, m) {
  const nvt = m.n * VT;
  const e = ex(v / nvt);
  let i = m.is * (e - 1),
    g = (m.is * e) / nvt;
  if (m.bv) {
    const u = -v - (m.bv - m.izt * m.rz);
    i -= softplus(u, 0.02) / m.rz;
    g += sigmoid(u, 0.02) / m.rz;
  }
  return {i, g: g + 1e-12};
}

export function diodeStamp(k, a, b, m, tag) {
  let vold = 0;
  const nvt = m.n * VT,
    vc = vcrit(m.is, nvt);
  k.nl((x, st) => {
    let v = (x[a] ?? 0) - (x[b] ?? 0);
    v = pnjlim(v, vold, nvt, vc);
    vold = v;
    const {i, g} = diodeIV(v, m);
    st.G(a, b, g);
    st.I(a, b, i - g * v);
    return Math.round(v * 1e5);
  });
  return () => {
    const v = k.vn(a) - k.vn(b);
    return {v, i: diodeIV(v, m).i};
  };
}

export function bjt(k, npn) {
  const m = BJT_MODELS[k.p.model] ?? BJT_MODELS[npn ? '2N2222A' : '2N2907A'],
    pol = m.npn ? 1 : -1,
    nf = m.darlington ? 2 : 1,
    C = k.n('C'),
    B = k.n('B'),
    E = k.n('E');
  const vtf = nf * VT,
    vc = vcrit(m.is, vtf);
  let be0 = 0,
    bc0 = 0;
  const ev = (vbe, vbc) => {
    const ebe = ex(vbe / vtf),
      ebc = ex(vbc / VT),
      If = m.is * (ebe - 1),
      Ir = m.is * (ebc - 1),
      gf = (m.is * ebe) / vtf,
      gr = (m.is * ebc) / VT;
    return {
      ic: If - Ir - Ir / m.br,
      ib: If / m.bf + Ir / m.br,
      ic_be: gf,
      ic_bc: -gr - gr / m.br,
      ib_be: gf / m.bf,
      ib_bc: gr / m.br,
    };
  };
  k.nl((x, st) => {
    let vbe = pol * ((x[B] ?? 0) - (x[E] ?? 0)),
      vbc = pol * ((x[B] ?? 0) - (x[C] ?? 0));
    vbe = pnjlim(vbe, be0, vtf, vc);
    vbc = pnjlim(vbc, bc0, VT, vcrit(m.is, VT));
    be0 = vbe;
    bc0 = vbc;
    const r = ev(vbe, vbc);
    const rowStamp = (T, F, dbe, dbc) => {
      st.M(T, B, dbe + dbc);
      st.M(T, E, -dbe);
      st.M(T, C, -dbc);
      st.rhs(T, -pol * (F - dbe * vbe - dbc * vbc));
    };
    rowStamp(C, r.ic, r.ic_be, r.ic_bc);
    rowStamp(B, r.ib, r.ib_be, r.ib_bc);
    rowStamp(E, -(r.ic + r.ib), -(r.ic_be + r.ib_be), -(r.ic_bc + r.ib_bc));
    st.G(B, E, 1e-12);
    st.G(B, C, 1e-12);
    st.G(C, E, 1e-10);
    return Math.round(vbe * 1e5) + ':' + Math.round(vbc * 1e5);
  });
  k.result(() => {
    const vbe = pol * (k.v('B') - k.v('E')),
      vbc = pol * (k.v('B') - k.v('C')),
      vce = vbe - vbc,
      r = ev(vbe, vbc);
    const region = r.ib < 1e-7 ? 'cutoff' : vce < 0.3 * nf ? 'saturation' : 'active';
    if (Math.abs(r.ic) > m.icmax)
      k.diag(
        'error',
        `${k.c.name} (${k.p.model}): collector current ${(r.ic * 1000).toFixed(0)} mA exceeds ${m.icmax * 1000} mA.`
      );
    if (vce > m.vceo)
      k.diag('error', `${k.c.name}: V CE ${vce.toFixed(0)} V exceeds the ${m.vceo} V breakdown rating.`);
    if (r.ib > 0.05)
      k.diag('warning', `${k.c.name}: base current ${(r.ib * 1000).toFixed(0)} mA. Add a base resistor.`);
    return {vbe, vce, ib: r.ib, ic: r.ic, region, current: r.ic, power: Math.abs(r.ic * vce)};
  });
}
