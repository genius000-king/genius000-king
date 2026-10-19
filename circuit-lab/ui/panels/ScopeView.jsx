import {Waves} from 'lucide-react';
import {useState} from 'react';
import {toCsv} from '../../engines/instruments/capture.js';
import {saveFile, slugOf} from '../common/save-file.js';
import {stats, frequency, fmtNum} from './format.js';

export function ScopeView({sim, project}) {
  const scopes = project.components.filter(c => c.type === 'scope');
  const [win, setWin] = useState(500),
    [hold, setHold] = useState(null);
  if (!scopes.length)
    return (
      <div className="empty-inline">
        <Waves size={22} />
        <span>
          No oscilloscope in the workspace.
          <small>Add Instruments → Oscilloscope and clip CH1/CH2 and GND onto your circuit.</small>
        </span>
      </div>
    );
  return (
    <div className="scope-view">
      {scopes.map(c => {
        const s = (hold ?? sim.scope)?.[c.id];
        if (!s || !s.t.length)
          return (
            <div key={c.id} className="empty-inline">
              <Waves size={20} />
              <span>
                {c.name}: waiting for samples.<small>Press Run, or connect a powered circuit.</small>
              </span>
            </div>
          );
        const t = Array.from(s.t),
          end = t.at(-1),
          startIdx = t.findIndex(x => x >= end - win),
          tt = t.slice(Math.max(0, startIdx)),
          vv = s.v.slice(Math.max(0, startIdx));
        const chans = [0, 1].map(ch => vv.map(x => x[ch]));
        const all = chans.flat(),
          lo = Math.min(0, ...all),
          hi = Math.max(1, ...all),
          span = hi - lo || 1;
        const path = ch =>
          chans[ch]
            .map(
              (v, i) =>
                `${i ? 'L' : 'M'}${(((tt[i] - tt[0]) / (win || 1)) * 1000).toFixed(1)},${(260 - ((v - lo) / span) * 240 - 10).toFixed(1)}`
            )
            .join('');
        return (
          <div key={c.id} className="scope-panel">
            <svg
              viewBox="0 0 1000 260"
              preserveAspectRatio="none"
              className="scope-plot"
              aria-label={`${c.name} traces`}
            >
              {Array.from({length: 9}, (_, i) => (
                <line key={'v' + i} x1={(i + 1) * 100} x2={(i + 1) * 100} y1="0" y2="260" />
              ))}
              {Array.from({length: 7}, (_, i) => (
                <line key={'h' + i} x1="0" x2="1000" y1={(i + 1) * 32.5} y2={(i + 1) * 32.5} />
              ))}
              <path d={path(0)} className="ch1" />
              <path d={path(1)} className="ch2" />
            </svg>
            <div className="scope-side">
              <div className="eyebrow capture-head">
                {c.name.toUpperCase()}
                <button
                  className="small-action"
                  title="Both channels as CSV (time in ms, volts)"
                  onClick={() => saveFile(`${slugOf(c.name)}.csv`, toCsv(s), 'text/csv')}
                >
                  CSV
                </button>
              </div>
              {[0, 1].map(ch => {
                const st = stats(chans[ch]),
                  f = frequency(tt, chans[ch]);
                return (
                  <div key={ch} className={'scope-meas ch' + (ch + 1)}>
                    <b>CH{ch + 1}</b>
                    <span>Vpp {fmtNum(st?.pp)} V</span>
                    <span>Mean {fmtNum(st?.mean)} V</span>
                    <span>Max {fmtNum(st?.max)} V</span>
                    <span>Freq {f ? `${fmtNum(f, f < 10 ? 2 : 1)} Hz` : '—'}</span>
                  </div>
                );
              })}
              <label className="parameter-row">
                Window
                <select
                  aria-label="Scope time window"
                  value={win}
                  onChange={e => setWin(Number(e.target.value))}
                >
                  {[20, 50, 100, 200, 500, 1000, 2000, 5000].map(w => (
                    <option key={w} value={w}>
                      {w} ms
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="small-action"
                onClick={() => setHold(hold ? null : structuredClone(sim.scope))}
              >
                {hold ? 'Run' : 'Hold'}
              </button>
              <span className="inline-note">
                {fmtNum(lo)}–{fmtNum(hi)} V vertical · sample = solver sub-step
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
