import {CheckCircle2, Wifi, ExternalLink} from 'lucide-react';
import {profileOf} from '../../engines/catalog/boards.js';

export function BoardInfo({c, sim, update}) {
  const prof = profileOf(c),
    state = sim.boards?.[c.id];
  const boot = state?.boot ?? sim.boot;
  const running = sim.running && boot === 'running';
  return (
    <>
      <div className="data-row">
        <span>Manufacturer</span>
        <b>
          {prof.vendor} <CheckCircle2 size={11} />
        </b>
      </div>
      <div className="data-row">
        <span>MCU</span>
        <b>{prof.mcu}</b>
      </div>
      <div className="data-row">
        <span>Memory</span>
        <b>{prof.memory}</b>
      </div>
      <div className="data-row">
        <span>Logic level</span>
        <b>
          {prof.logic} V{prof.tolerant ? ' · some 5 V tolerant' : ''}
        </b>
      </div>
      <div className="data-row">
        <span>PCB outline</span>
        <b>
          {prof.size[0]} × {prof.size[1]} mm
        </b>
      </div>
      <div className="data-row">
        <span>Header pins</span>
        <b>{prof.pins.length} · 2.54 mm</b>
      </div>
      <div className="data-row">
        <span>ADC</span>
        <b>
          {prof.adc.pins.length} ch · {prof.adc.bits}-bit default
        </b>
      </div>
      <div className="data-row">
        <span>Wireless</span>
        <b>
          {prof.wifi ? (
            <>
              <Wifi size={11} /> Wi-Fi (virtual)
            </>
          ) : (
            'None'
          )}
        </b>
      </div>
      <div className="chip-status">
        <span className={running ? 'pulse-dot' : 'status-dot'} />
        <span>{running ? 'Firmware executing' : boot === 'idle' ? 'Ready to bring to life' : boot}</span>
        <b>{running ? 'LIVE' : 'IDLE'}</b>
      </div>
      <div className="board-buttons">
        <button
          className="small-action"
          onPointerDown={e => {
            e.currentTarget.setPointerCapture(e.pointerId);
            update(c.id, {enPressed: true}, true, false);
          }}
          onPointerUp={() => update(c.id, {enPressed: false}, true, false)}
        >
          Hold {prof.reset}
        </button>
        {prof.strap && (
          <button
            className="small-action"
            onPointerDown={e => {
              e.currentTarget.setPointerCapture(e.pointerId);
              update(c.id, {bootPressed: true}, true, false);
            }}
            onPointerUp={() => update(c.id, {bootPressed: false}, true, false)}
          >
            Hold {prof.family === 'esp8266' ? 'FLASH' : 'BOOT'}
          </button>
        )}
      </div>
      <div className="reference-links compact">
        {prof.sources.map(s => (
          <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
            {s.title}
            <ExternalLink size={11} />
          </a>
        ))}
      </div>
    </>
  );
}
