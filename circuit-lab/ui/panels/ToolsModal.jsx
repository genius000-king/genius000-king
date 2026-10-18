import {Calculator, X} from 'lucide-react';
import {useState} from 'react';
import {resistorBands} from '../../engines/render/geo.js';
import {nearestE12, ohms} from './format.js';

export function Field({label, unit, value, onChange}) {
  return (
    <label className="parameter-row">
      {label}
      <div>
        <input
          type="number"
          aria-label={label}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
        />
        <span>{unit}</span>
      </div>
    </label>
  );
}

export function ToolsModal({onClose}) {
  const [tab, setTab] = useState('led');
  const [s, setS] = useState({
    vs: 5,
    vf: 2,
    ifm: 15,
    v: 5,
    i: 10,
    r: 220,
    vin: 9,
    r1: 10000,
    r2: 4700,
    rc_r: 1000,
    rc_c: 100,
    t1: 1000,
    t2: 10000,
    tc: 47,
    band: 4700,
    vac: 12,
    drops: 2,
    iload: 100,
    cap: 1000,
    line: 50,
    tvp: 230,
    tvs: 12,
    zl: 8,
    lmh: 10,
    cuf: 1,
    fhz: 1000,
  });
  const u = k => v => setS(o => ({...o, [k]: v}));
  const tabs = [
    ['led', 'LED resistor'],
    ['ohm', 'Ohm’s law'],
    ['div', 'Voltage divider'],
    ['rc', 'RC / filter'],
    ['555', '555 astable'],
    ['psu', 'Rectifier & ripple'],
    ['xfmr', 'Transformer'],
    ['lc', 'Inductor / LC'],
    ['code', 'Color code'],
  ];
  let body;
  if (tab === 'led') {
    const r = (s.vs - s.vf) / (s.ifm / 1000),
      e = nearestE12(r),
      i = e ? (s.vs - s.vf) / e : 0;
    body = (
      <>
        <Field label="Supply" unit="V" value={s.vs} onChange={u('vs')} />
        <Field label="LED forward voltage" unit="V" value={s.vf} onChange={u('vf')} />
        <Field label="LED current" unit="mA" value={s.ifm} onChange={u('ifm')} />
        <div className="calc-result">
          <b>{ohms(r)}</b>
          <span>
            Nearest E12: {ohms(e)} → {(i * 1000).toFixed(1)} mA, {(i * i * e * 1000).toFixed(1)} mW in the
            resistor
          </span>
        </div>
      </>
    );
  }
  if (tab === 'ohm') {
    body = (
      <>
        <Field label="Voltage" unit="V" value={s.v} onChange={u('v')} />
        <Field label="Current" unit="mA" value={s.i} onChange={u('i')} />
        <Field label="Resistance" unit="Ω" value={s.r} onChange={u('r')} />
        <div className="calc-result">
          <b>R = V / I = {ohms(s.v / (s.i / 1000))}</b>
          <span>
            I = V / R = {((s.v / s.r) * 1000).toFixed(3)} mA · V = I·R = {((s.i / 1000) * s.r).toFixed(3)} V ·
            P = V·I = {(s.v * s.i).toFixed(1)} mW
          </span>
        </div>
      </>
    );
  }
  if (tab === 'div') {
    const out = (s.vin * s.r2) / (s.r1 + s.r2);
    body = (
      <>
        <Field label="Input" unit="V" value={s.vin} onChange={u('vin')} />
        <Field label="R1 (top)" unit="Ω" value={s.r1} onChange={u('r1')} />
        <Field label="R2 (bottom)" unit="Ω" value={s.r2} onChange={u('r2')} />
        <div className="calc-result">
          <b>Vout = {out.toFixed(3)} V</b>
          <span>
            Divider current {((s.vin / (s.r1 + s.r2)) * 1000).toFixed(3)} mA · Thevenin resistance{' '}
            {ohms((s.r1 * s.r2) / (s.r1 + s.r2))}
          </span>
        </div>
      </>
    );
  }
  if (tab === 'rc') {
    const tau = s.rc_r * s.rc_c * 1e-6;
    body = (
      <>
        <Field label="Resistance" unit="Ω" value={s.rc_r} onChange={u('rc_r')} />
        <Field label="Capacitance" unit="µF" value={s.rc_c} onChange={u('rc_c')} />
        <div className="calc-result">
          <b>τ = RC = {(tau * 1000).toFixed(3)} ms</b>
          <span>
            −3 dB cutoff fc = 1/(2πRC) = {(1 / (2 * Math.PI * tau)).toFixed(3)} Hz · 99 % settled after 5τ ={' '}
            {(tau * 5000).toFixed(1)} ms
          </span>
        </div>
      </>
    );
  }
  if (tab === '555') {
    const c = s.tc * 1e-6,
      f = 1.44 / ((s.t1 + 2 * s.t2) * c),
      duty = (s.t1 + s.t2) / (s.t1 + 2 * s.t2);
    body = (
      <>
        <Field label="R1" unit="Ω" value={s.t1} onChange={u('t1')} />
        <Field label="R2" unit="Ω" value={s.t2} onChange={u('t2')} />
        <Field label="C" unit="µF" value={s.tc} onChange={u('tc')} />
        <div className="calc-result">
          <b>f = {f.toFixed(3)} Hz</b>
          <span>
            Period {(1000 / f).toFixed(1)} ms · high {(693 * (s.t1 + s.t2) * c).toFixed(1)} ms · low{' '}
            {(693 * s.t2 * c).toFixed(1)} ms · duty {(duty * 100).toFixed(1)} %
          </span>
        </div>
      </>
    );
  }

  if (tab === 'psu') {
    const vpk = s.vac * Math.SQRT2 - s.drops * 0.8,
      rip = s.iload / 1000 / (2 * s.line * s.cap * 1e-6),
      vmin = vpk - rip;
    body = (
      <>
        <Field label="Transformer secondary (RMS)" unit="V" value={s.vac} onChange={u('vac')} />
        <Field
          label="Diode drops in the path (bridge 2, center tap 1)"
          unit=""
          value={s.drops}
          onChange={u('drops')}
        />
        <Field label="Load current" unit="mA" value={s.iload} onChange={u('iload')} />
        <Field label="Reservoir capacitor" unit="µF" value={s.cap} onChange={u('cap')} />
        <Field label="Mains frequency" unit="Hz" value={s.line} onChange={u('line')} />
        <div className="calc-result">
          <b>
            Peak {vpk.toFixed(2)} V · ripple {rip.toFixed(2)} V p-p
          </b>
          <span>
            Valley {vmin.toFixed(2)} V. A 7805 needs at least 7 V at the valley
            {vmin < 7 ? ' (not met: use a larger capacitor or a higher secondary)' : ' ✓'} · capacitor rating
            ≥ {(vpk * 1.25).toFixed(0)} V · ripple = I / (2·f·C) for full-wave rectification.
          </span>
        </div>
      </>
    );
  }
  if (tab === 'xfmr') {
    const n = s.tvp / s.tvs;
    body = (
      <>
        <Field label="Primary voltage" unit="V" value={s.tvp} onChange={u('tvp')} />
        <Field label="Secondary voltage" unit="V" value={s.tvs} onChange={u('tvs')} />
        <Field label="Load on the secondary" unit="Ω" value={s.zl} onChange={u('zl')} />
        <div className="calc-result">
          <b>Turns ratio {n.toFixed(2)} : 1</b>
          <span>
            Secondary current {((s.tvs / s.zl) * 1000).toFixed(0)} mA → primary{' '}
            {((s.tvs / s.zl / n) * 1000).toFixed(1)} mA · the load looks like {ohms(s.zl * n * n)} from the
            primary (Z × n²) · power {((s.tvs * s.tvs) / s.zl).toFixed(2)} W.
          </span>
        </div>
      </>
    );
  }
  if (tab === 'lc') {
    const L = s.lmh / 1000,
      C = s.cuf * 1e-6,
      xl = 2 * Math.PI * s.fhz * L,
      f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
    body = (
      <>
        <Field label="Inductance" unit="mH" value={s.lmh} onChange={u('lmh')} />
        <Field label="Capacitance" unit="µF" value={s.cuf} onChange={u('cuf')} />
        <Field label="Frequency" unit="Hz" value={s.fhz} onChange={u('fhz')} />
        <div className="calc-result">
          <b>
            X_L = {ohms(xl)} · resonance{' '}
            {f0 >= 1000 ? (f0 / 1000).toFixed(3) + ' kHz' : f0.toFixed(2) + ' Hz'}
          </b>
          <span>
            X_C at {s.fhz} Hz = {ohms(1 / (2 * Math.PI * s.fhz * C))} · characteristic impedance √(L/C) ={' '}
            {ohms(Math.sqrt(L / C))} · L/R time constant with 100 Ω: {((L / 100) * 1000).toFixed(3)} ms.
          </span>
        </div>
      </>
    );
  }
  if (tab === 'code') {
    const bands = resistorBands(s.band);
    body = (
      <>
        <Field label="Resistance" unit="Ω" value={s.band} onChange={u('band')} />
        <div className="color-code">
          {bands.map((b, i) => (
            <span key={i} style={{background: b}} />
          ))}
        </div>
        <div className="calc-result">
          <span>Four-band code (gold = ±5 %). Bands read left to right from the end nearest a lead.</span>
        </div>
      </>
    );
  }
  return (
    <div className="modal-backdrop" onPointerDown={onClose}>
      <div className="modal tools-modal glass" onPointerDown={e => e.stopPropagation()}>
        <div className="modal-heading">
          <span className="modal-icon">
            <Calculator size={22} />
          </span>
          <button className="icon-button" onClick={onClose} aria-label="Close tools">
            <X size={17} />
          </button>
        </div>
        <h2>Engineering tools</h2>
        <div className="category-tabs scroll-chips">
          {tabs.map(([k, l]) => (
            <button key={k} className={tab === k ? 'selected' : ''} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>
        <div className="tool-body">{body}</div>
      </div>
    </div>
  );
}
