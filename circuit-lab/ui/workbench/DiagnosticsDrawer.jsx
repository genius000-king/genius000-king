/** Serial monitor, oscilloscope, logic analyser, network and diagnostics. */
import {
  Terminal,
  Waves,
  Gauge,
  Activity,
  Grid2X2,
  Link2,
  Wifi,
  AlertTriangle,
  Bug,
  LineChart,
  SkipForward,
  X,
  ChevronRight,
  ArrowRight,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import {isBoard} from '../../engines/catalog/boards.js';
import {terminals, ref} from '../../engines/catalog/types.js';
import {IconButton} from '../common/IconButton.jsx';
import {DebugView, LogicView, PlotterView, ScopeView} from './lazy.jsx';
import {useWorkbench} from './context.js';

export default function DiagnosticsDrawer() {
  const {
    breakpoints,
    clearBreakpoints,
    debug,
    debugAction,
    inspect,
    removeBreakpoint,
    compiled,
    diagnostics,
    drawer,
    project,
    send,
    serialBottom,
    serialInput,
    setDrawer,
    setSerialInput,
    sim,
  } = useWorkbench();
  return (
    <section className="diagnostics-drawer glass">
      <div className="drawer-head">
        <div className="drawer-tabs">
          {[
            [Terminal, 'serial', 'Serial monitor'],
            [LineChart, 'plotter', 'Plotter'],
            [Waves, 'scope', 'Oscilloscope'],
            [Gauge, 'logic', 'Logic'],
            [Activity, 'signals', 'Signals'],
            [Grid2X2, 'gpio', 'GPIO'],
            [Link2, 'i2c', 'I²C bus'],
            [Wifi, 'network', 'Wi-Fi'],
            [Bug, 'debug', 'Debugger'],
            [AlertTriangle, 'diagnostics', 'Diagnostics'],
          ].map(([Icon, key, label]) => (
            <button key={key} className={drawer === key ? 'selected' : ''} onClick={() => setDrawer(key)}>
              <Icon size={13} />
              {label}
              {key === 'diagnostics' && diagnostics.length > 0 && <b>{diagnostics.length}</b>}
            </button>
          ))}
        </div>
        <div>
          <span className="clock-readout">{(sim.time / 1000).toFixed(3)} s</span>
          <IconButton
            icon={SkipForward}
            label="Step 1 ms"
            disabled={!compiled}
            onClick={() => send('step', {ms: 1})}
          />
          <IconButton icon={X} label="Close instruments" onClick={() => setDrawer(null)} />
        </div>
      </div>
      <div className="drawer-content">
        {drawer === 'debug' ? (
          <DebugView
            debug={debug}
            sim={sim}
            breakpoints={breakpoints}
            boardNames={Object.fromEntries(project.components.filter(isBoard).map(c => [c.id, c.name]))}
            onAction={debugAction}
            onInspect={inspect}
            onClearBreakpoints={clearBreakpoints}
            onRemoveBreakpoint={removeBreakpoint}
          />
        ) : drawer === 'plotter' ? (
          <PlotterView sim={sim} onClear={() => send('clear')} />
        ) : drawer === 'scope' ? (
          <ScopeView sim={sim} project={project} />
        ) : drawer === 'logic' ? (
          <LogicView sim={sim} project={project} />
        ) : drawer === 'serial' ? (
          <>
            <div className="serial-lines">
              {sim.logs.length === 0 ? (
                <div className="empty-inline">
                  <Terminal size={22} />
                  <span>
                    Your circuit has something to say.
                    <small>Run a sketch with Serial.println() to see its output here.</small>
                  </span>
                </div>
              ) : (
                sim.logs.map((l, i) => (
                  <div className={'log-line ' + l.kind} key={i}>
                    <time>{(l.time / 1000).toFixed(3).padStart(8, '0')}</time>
                    <span>{l.text}</span>
                  </div>
                ))
              )}
              <div ref={serialBottom} />
            </div>
            <form
              className="serial-input"
              onSubmit={e => {
                e.preventDefault();
                send('serial', {text: serialInput});
                setSerialInput('');
              }}
            >
              <ChevronRight size={13} />
              <input
                aria-label="Send serial input"
                value={serialInput}
                onChange={e => setSerialInput(e.target.value)}
                placeholder="Send to virtual UART…"
              />
              <button type="submit">
                Send <ArrowRight size={12} />
              </button>
              <button type="button" onClick={() => send('clear')} title="Clear serial monitor">
                <Trash2 size={13} />
              </button>
            </form>
          </>
        ) : drawer === 'signals' ? (
          <div className="signal-view">
            <div>
              <span className="eyebrow">LED_BUILTIN · VOLTAGE TRACE</span>
              <strong>
                {(sim.trace.at(-1)?.v ?? 0).toFixed(2)} <small>V</small>
              </strong>
              <span className="inline-note">10 ms sample interval · last 2 seconds</span>
              {false && (
                <span className="inline-note">
                  PWM {(sim.gpio[2].duty * 100).toFixed(1)}% · {sim.gpio[2].frequency} Hz · averaged voltage
                </span>
              )}
            </div>
            <svg
              className="signal-plot"
              viewBox="0 0 700 130"
              preserveAspectRatio="none"
              aria-label="Live measured GPIO voltage"
            >
              {[10, 45, 80, 115].map(y => (
                <line key={y} x1="0" x2="700" y1={y} y2={y} stroke="#d9e1d4" strokeDasharray="3 5" />
              ))}
              <polyline
                points={sim.trace
                  .map(
                    (s, i) => `${(i / Math.max(199, sim.trace.length - 1)) * 700},${115 - (s.v / 5) * 100}`
                  )
                  .join(' ')}
                stroke="#6f8d54"
                strokeWidth="2"
                fill="none"
              />
            </svg>
          </div>
        ) : drawer === 'gpio' ? (
          <div className="gpio-grid">
            {project.components
              .filter(c => isBoard(c))
              .flatMap(c =>
                terminals(c)
                  .filter(t => t.gpio !== undefined)
                  .map(t => {
                    const pin = t.gpio,
                      state = sim.boards?.[c.id]?.gpio?.[pin] ?? sim.gpio[pin],
                      v = sim.voltages[ref(c, t.id)] ?? 0;
                    return (
                      <div className={v > 2.475 ? 'gpio high' : 'gpio'} key={c.id + t.id}>
                        <b>
                          {t.label || t.id}
                          {project.components.filter(isBoard).length > 1 && <i> · {c.name}</i>}
                        </b>
                        <span>
                          {state?.mode === 1
                            ? 'OUT'
                            : state?.mode === 2
                              ? 'PULL ↑'
                              : state?.mode === 3
                                ? 'PULL ↓'
                                : 'Hi-Z'}
                        </span>
                        <strong>{v.toFixed(2)} V</strong>
                        {state?.duty !== undefined && <small>{Math.round(state.duty * 100)}% PWM</small>}
                      </div>
                    );
                  })
              )}
          </div>
        ) : drawer === 'network' ? (
          <div className="network-monitor">
            <div className="network-nodes">
              {(sim.network?.nodes ?? []).map(n => (
                <div className="network-node" key={n.id}>
                  <Wifi size={16} />
                  <strong>{project.components.find(c => c.id === n.id)?.name}</strong>
                  <span>
                    {n.mode === 'ap' ? 'Access point' : n.status === 3 ? 'Connected' : 'Connecting'}
                  </span>
                  <code>
                    {n.ip}:{n.port}
                  </code>
                  <small>
                    {n.ssid} · channel {n.channel || 'auto'}
                  </small>
                </div>
              ))}
            </div>
            <div className="network-events">
              {(sim.network?.events ?? [])
                .slice(-30)
                .reverse()
                .map((event, i) => (
                  <div key={i}>
                    <time>{(event.time / 1000).toFixed(3)} s</time>
                    <b>{event.type}</b>
                    <span>
                      {project.components.find(c => c.id === event.board)?.name} · {event.message}
                    </span>
                  </div>
                ))}
            </div>
            <p className="scope-note">
              Virtual association + UDP · 100 ms association, 2 ms packet latency. RF propagation, encryption,
              TCP, internet and ESP-IDF drivers are not emulated.
            </p>
          </div>
        ) : drawer === 'i2c' ? (
          <div className="transaction-list">
            {sim.transactions.length ? (
              sim.transactions.map((t, i) => (
                <div key={i}>
                  <time>{(t.time / 1000).toFixed(3)} s</time>
                  <b>0x{t.address.toString(16)}</b>
                  <span>
                    {t.description} · {t.bytes.length} bytes
                  </span>
                  <strong className={t.ack ? 'ack' : 'nack'}>{t.ack ? 'ACK' : 'NACK'}</strong>
                </div>
              ))
            ) : (
              <div className="empty-inline">
                <Link2 size={22} />
                <span>
                  Waiting for a bus transaction.
                  <small>Wire an OLED to GPIO 21 / 22 and use the Hello, world example.</small>
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="diagnostic-list">
            {diagnostics.length ? (
              diagnostics.map((d, i) => (
                <div className={'diagnostic ' + d.level} key={i}>
                  <AlertTriangle size={15} />
                  <span>{d.message}</span>
                </div>
              ))
            ) : (
              <div className="empty-inline">
                <CheckCircle2 size={25} />
                <span>
                  No electrical errors detected.
                  <small>
                    {project.wires.length} explicit connections · {sim.nets} nets ·{' '}
                    {project.components.length} components. Unused pins may remain floating.
                  </small>
                </span>
              </div>
            )}
            <p className="scope-note">
              1 ms DC electrical steps · piecewise-linear LED · averaged PWM · ideal ADC. RF, parasitics,
              thermal damage and cycle-accurate ESP32 execution are outside this model.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
