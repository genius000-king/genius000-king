import {Gauge} from 'lucide-react';
import {toVcd} from '../../engines/instruments/capture.js';
import {saveFile, slugOf} from '../common/save-file.js';
import {fmtNum} from './format.js';

export function LogicView({sim, project}) {
  const las = project.components.filter(c => c.type === 'logic');
  if (!las.length)
    return (
      <div className="empty-inline">
        <Gauge size={22} />
        <span>
          No logic analyzer in the workspace.
          <small>Add Instruments → Logic analyzer and connect D0–D7 and GND.</small>
        </span>
      </div>
    );
  return (
    <div className="logic-view">
      {las.map(c => {
        const s = sim.scope?.[c.id];
        if (!s || !s.t.length)
          return (
            <div key={c.id} className="empty-inline">
              <span>{c.name}: waiting for samples.</span>
            </div>
          );
        const t = Array.from(s.t),
          n = t.length,
          t0 = t[0],
          span = t.at(-1) - t0 || 1;
        return (
          <div key={c.id}>
            <div className="eyebrow capture-head">
              {c.name.toUpperCase()} · {fmtNum(span, 0)} ms · threshold {c.params.threshold} V
              <button
                className="small-action"
                title="Value Change Dump for PulseView, GTKWave or sigrok"
                onClick={() => saveFile(`${slugOf(c.name)}.vcd`, toVcd(s), 'text/plain')}
              >
                Export VCD
              </button>
            </div>
            <svg viewBox="0 0 1000 200" preserveAspectRatio="none" className="logic-plot">
              {Array.from({length: 8}, (_, ch) => {
                let d = '';
                for (let i = 0; i < n; i++) {
                  const x = (((t[i] - t0) / span) * 1000).toFixed(1),
                    y = ch * 25 + ((s.v[i][0] >> ch) & 1 ? 4 : 20);
                  d += (i ? 'L' : 'M') + x + ',' + y;
                }
                return (
                  <g key={ch}>
                    <text x="4" y={ch * 25 + 15}>
                      D{ch}
                    </text>
                    <path d={d} />
                  </g>
                );
              })}
            </svg>
          </div>
        );
      })}
    </div>
  );
}
