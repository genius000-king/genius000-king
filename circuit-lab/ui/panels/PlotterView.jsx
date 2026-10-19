import {LineChart, Pause, Play, Trash2} from 'lucide-react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {plotSeries} from '../../engines/instruments/plotter.js';

const COLOURS = ['#f2d235', '#3ac0e8', '#e86ad0', '#7bd88f', '#f28c3a', '#9b8cf2', '#e0483e', '#c8c8d0'];

/** Serial Plotter: numbers printed on the serial port, drawn over simulated time (Arduino IDE format). */
export function PlotterView({sim, onClear}) {
  const canvas = useRef(null),
    [frozen, setFrozen] = useState(null),
    [hidden, setHidden] = useState({});
  const live = useMemo(() => plotSeries(sim.logs), [sim.logs]),
    data = frozen ?? live,
    labels = Object.keys(data.series);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = Math.min(2, devicePixelRatio || 1),
      W = c.clientWidth,
      H = c.clientHeight;
    c.width = W * dpr;
    c.height = H * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.clearRect(0, 0, W, H);
    const shown = labels.filter(l => !hidden[l]),
      values = shown.flatMap(l => data.series[l].filter(v => v !== null));
    if (!values.length || data.times.length < 2) return;
    let lo = Math.min(...values),
      hi = Math.max(...values);
    if (hi === lo) {
      hi += 1;
      lo -= 1;
    }
    const pad = (hi - lo) * 0.08;
    lo -= pad;
    hi += pad;
    const left = 52,
      t0 = data.times[0],
      span = data.times.at(-1) - t0 || 1;
    const x = t => left + ((t - t0) / span) * (W - left - 10),
      y = v => 8 + (1 - (v - lo) / (hi - lo)) * (H - 26);
    // grid and value axis
    g.font = '10px "SFMono-Regular", Consolas, monospace';
    g.fillStyle = 'rgba(200,200,210,.7)';
    g.strokeStyle = 'rgba(200,200,210,.12)';
    for (let i = 0; i <= 4; i++) {
      const v = lo + ((hi - lo) * i) / 4,
        yy = y(v);
      g.beginPath();
      g.moveTo(left, yy);
      g.lineTo(W - 10, yy);
      g.stroke();
      g.fillText(Math.abs(v) >= 1000 || Number.isInteger(v) ? v.toFixed(0) : v.toPrecision(3), 4, yy + 3);
    }
    g.fillText(`${(t0 / 1000).toFixed(2)} s`, left, H - 4);
    g.fillText(`${(data.times.at(-1) / 1000).toFixed(2)} s`, W - 60, H - 4);
    shown.forEach(label => {
      g.strokeStyle = COLOURS[labels.indexOf(label) % COLOURS.length];
      g.lineWidth = 1.6;
      g.beginPath();
      let pen = false;
      data.series[label].forEach((v, i) => {
        if (v === null) return void (pen = false);
        const px = x(data.times[i]),
          py = y(v);
        pen ? g.lineTo(px, py) : g.moveTo(px, py);
        pen = true;
      });
      g.stroke();
    });
  }, [data, hidden]);
  return (
    <div className="plotter-view">
      <div className="plotter-bar">
        {labels.map((l, i) => (
          <button
            key={l}
            className={`plot-legend ${hidden[l] ? 'off' : ''}`}
            onClick={() => setHidden(h => ({...h, [l]: !h[l]}))}
            title="Show or hide this series"
          >
            <i style={{background: COLOURS[i % COLOURS.length]}} />
            {l}
            <b>{data.series[l].findLast(v => v !== null) ?? '—'}</b>
          </button>
        ))}
        <span />
        <button
          onClick={() => setFrozen(f => (f ? null : live))}
          title={frozen ? 'Follow live data' : 'Freeze the plot'}
        >
          {frozen ? <Play size={13} /> : <Pause size={13} />}
          {frozen ? 'Live' : 'Freeze'}
        </button>
        <button onClick={onClear} title="Clear the serial log (and this plot)">
          <Trash2 size={13} />
        </button>
      </div>
      {labels.length ? (
        <canvas ref={canvas} className="plotter-canvas" />
      ) : (
        <div className="empty-inline">
          <LineChart size={22} />
          <span>
            Print numbers to plot them, one sample per line, as in the Arduino IDE:
            <small>
              Serial.println(analogRead(A0)); · or labelled: Serial.print("temp:"); Serial.print(t);
              Serial.print(" hum:"); Serial.println(h);
            </small>
          </span>
        </div>
      )}
    </div>
  );
}
