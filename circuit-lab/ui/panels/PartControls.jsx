import {Volume2, VolumeX, RotateCcw, RotateCw} from 'lucide-react';
import React from 'react';
import {KEYPAD} from '../../engines/catalog/keypad.js';
import {TYPES} from '../../engines/catalog/types.js';
import {fmtNum} from './format.js';

export function Readouts({def, live}) {
  if (!def.readouts?.length) return null;
  return (
    <div className="readouts">
      {def.readouts.map(r => {
        const v = live?.[r.key];
        return (
          <div className="data-row" key={r.key}>
            <span>{r.label}</span>
            <b>
              {typeof v === 'number' ? `${fmtNum(v * (r.scale ?? 1), r.digits)} ${r.unit}` : `${v ?? '—'}`}
            </b>
          </div>
        );
      })}
    </div>
  );
}

export function PartControls({c, live, update, time, audioEnabled, onAudio, display}) {
  const def = TYPES[c.type],
    p = c.params;
  const set = (values, record = true) => update(c.id, values, true, record);
  return (
    <>
      {c.type === 'multimeter' && (
        <div className="dmm-readout">
          <small>{{V: 'DC VOLTS', A: 'DC AMPS', Ω: 'OHMS', continuity: 'CONTINUITY'}[p.mode]}</small>
          <strong>{live?.display ?? '—'}</strong>
          {live?.beep && <span>BEEP</span>}
        </div>
      )}
      <Readouts def={def} live={live} />
      {(def.controls ?? []).map((ctl, i) => {
        const label = ctl.label,
          aria = ctl.aria ?? label,
          scale = ctl.scale ?? 1,
          val = p[ctl.key];
        switch (ctl.type) {
          case 'number':
            return (
              <label key={i} className="parameter-row">
                {label}
                <div>
                  <input
                    aria-label={aria}
                    type="number"
                    list={ctl.presets ? `presets-${c.id}-${ctl.key}` : undefined}
                    min={ctl.min}
                    max={ctl.max}
                    step={ctl.step}
                    value={Number((val * scale).toPrecision(6))}
                    onChange={e => {
                      const n = Number(e.target.value);
                      if (e.target.value !== '' && Number.isFinite(n))
                        set({[ctl.key]: Math.max(ctl.min, Math.min(ctl.max, n)) / scale});
                    }}
                  />
                  {ctl.presets && (
                    <datalist id={`presets-${c.id}-${ctl.key}`}>
                      {ctl.presets.map(v => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                  )}
                  <span>{ctl.unit}</span>
                </div>
              </label>
            );
          case 'range':
            return (
              <React.Fragment key={i}>
                <label className="slider-label">
                  {label}
                  <b>
                    {fmtNum(val * scale, ctl.step * scale < 1 ? (ctl.step * scale < 0.1 ? 2 : 1) : 0)}{' '}
                    {ctl.unit}
                  </b>
                </label>
                <input
                  className="range"
                  aria-label={aria}
                  type="range"
                  min={ctl.min}
                  max={ctl.max}
                  step={ctl.step}
                  value={val}
                  onChange={e => set({[ctl.key]: Number(e.target.value)}, false)}
                />
              </React.Fragment>
            );
          case 'select':
            return (
              <label key={i} className="parameter-row">
                {label}
                <select
                  aria-label={aria}
                  value={String(val)}
                  onChange={e => {
                    const o = ctl.options.find(o => String(o[0]) === e.target.value);
                    set({[ctl.key]: o[0]});
                  }}
                >
                  {ctl.options.map(([v, l]) => (
                    <option key={String(v)} value={String(v)}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            );
          case 'toggle':
            return (
              <button
                key={i}
                className={`press-button ${val ? 'pressed' : ''}`}
                onClick={() => set({[ctl.key]: !val})}
              >
                {label}
                <span>{val ? 'On' : 'Off'}</span>
              </button>
            );
          case 'momentary':
            return (
              <button
                key={i}
                className={`press-button ${val ? 'pressed' : ''}`}
                onPointerDown={e => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  set({[ctl.key]: true, lastChange: time}, false);
                }}
                onPointerUp={() => set({[ctl.key]: false, lastChange: time}, false)}
                onPointerCancel={() => set({[ctl.key]: false}, false)}
              >
                {val ? 'Contact closed' : label}
                <span>Hold</span>
              </button>
            );
          case 'color':
            return (
              <label key={i} className="parameter-row">
                {label}
                <input
                  type="color"
                  aria-label={aria}
                  value={val}
                  onChange={e => set({[ctl.key]: e.target.value})}
                />
              </label>
            );
          case 'text':
            return (
              <label key={i} className="parameter-row">
                {label}
                <input
                  aria-label={aria}
                  className="text-param"
                  value={val}
                  onChange={e => set({[ctl.key]: e.target.value})}
                />
              </label>
            );
          case 'audio':
            return (
              <button key={i} className="small-action" onClick={onAudio}>
                {audioEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}{' '}
                {audioEnabled ? 'Mute audio' : 'Enable audio'}
              </button>
            );
          case 'encoder':
            return (
              <div key={i} className="encoder-row">
                <button
                  className="small-action"
                  aria-label="Rotate counter-clockwise"
                  onClick={() => set({target: (p.target ?? 0) - 1}, false)}
                >
                  <RotateCcw size={13} />
                  CCW
                </button>
                <b>{live?.position ?? 0}</b>
                <button
                  className="small-action"
                  aria-label="Rotate clockwise"
                  onClick={() => set({target: (p.target ?? 0) + 1}, false)}
                >
                  CW
                  <RotateCw size={13} />
                </button>
              </div>
            );
          case 'keypad':
            return (
              <div key={i} className="keypad-grid">
                {KEYPAD.map(k => (
                  <button
                    key={k}
                    className={p.key === k ? 'pressed' : ''}
                    onPointerDown={e => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      set({key: k}, false);
                    }}
                    onPointerUp={() => set({key: ''}, false)}
                    onPointerCancel={() => set({key: ''}, false)}
                  >
                    {k}
                  </button>
                ))}
              </div>
            );
          default:
            return null;
        }
      })}
      {c.type === 'led' && (
        <div className="brightness-meter">
          <span style={{width: `${(live?.brightness ?? 0) * 100}%`, background: p.color}} />
        </div>
      )}
      {def.display && (
        <div className="oled-preview">
          {live?.powered ? display || 'Waiting for I²C data…' : 'Display unpowered'}
        </div>
      )}
      {def.note && <p className="inline-note">{def.note}</p>}
    </>
  );
}
