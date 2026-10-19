import {Bug, Play, ArrowDownToLine, ArrowRight, ArrowUpRight, RefreshCw, X} from 'lucide-react';
import {useEffect} from 'react';

const Vars = ({title, list}) => (
  <div className="debug-vars">
    <div className="section-label">{title}</div>
    {list.length === 0 ? (
      <div className="inline-note">none</div>
    ) : (
      list.map(v => (
        <div key={v.name} className="debug-var">
          <span>{v.name}</span>
          <i>{v.type}</i>
          <b title={v.value}>{v.value}</b>
        </div>
      ))
    )}
  </div>
);

/** The firmware debugger: where the board stopped, its variables and call stack, and the breakpoints. */
export function DebugView({
  debug,
  sim,
  breakpoints,
  boardNames,
  onAction,
  onInspect,
  onClearBreakpoints,
  onRemoveBreakpoint,
}) {
  const halted = !!debug?.halted,
    paused = !sim.running && sim.boot === 'running';
  // a manual pause shows the variables too
  useEffect(() => {
    if (paused && !halted) onInspect();
  }, [paused, sim.time]);
  const list = Object.entries(breakpoints).flatMap(([board, files]) =>
    Object.entries(files).flatMap(([file, lines]) => lines.map(line => ({board, file, line})))
  );
  return (
    <div className="debug-view">
      <div className="debug-main">
        <div className="debug-bar">
          <span className={`debug-state ${halted ? 'halted' : ''}`}>
            <Bug size={14} />
            {halted
              ? `${debug.reason === 'breakpoint' ? 'Breakpoint' : 'Stepped'} · line ${debug.line} · ${debug.frames[0]?.fn ?? ''}()`
              : sim.running
                ? 'Running'
                : paused
                  ? 'Paused'
                  : 'Not running'}
          </span>
          <button disabled={!halted} onClick={() => onAction('continue')} title="Continue (F8)">
            <Play size={13} />
            Continue
          </button>
          <button disabled={!halted} onClick={() => onAction('over')} title="Step over (F10)">
            <ArrowRight size={13} />
            Over
          </button>
          <button disabled={!halted} onClick={() => onAction('into')} title="Step into (F11)">
            <ArrowDownToLine size={13} />
            Into
          </button>
          <button disabled={!halted} onClick={() => onAction('out')} title="Step out (Shift+F11)">
            <ArrowUpRight size={13} />
            Out
          </button>
          <button disabled={!paused && !halted} onClick={onInspect} title="Read the variables again">
            <RefreshCw size={13} />
          </button>
        </div>
        {debug ? (
          <div className="debug-columns">
            <Vars title={`LOCALS · ${debug.frames[0]?.fn ?? ''}()`} list={debug.locals} />
            <Vars title="GLOBALS" list={debug.globals} />
          </div>
        ) : (
          <div className="empty-inline">
            <Bug size={22} />
            <span>
              Click left of a line number to set a breakpoint, then Run. The whole bench halts there, like a
              hardware debugger halting the chip; step through the code and read its variables.
            </span>
          </div>
        )}
      </div>
      <div className="debug-side">
        <div className="section-label">CALL STACK</div>
        {(debug?.frames ?? []).map((f, i) => (
          <div key={i} className={`debug-frame ${i === 0 ? 'top' : ''}`}>
            {f.fn}()<span>line {f.line}</span>
          </div>
        ))}
        <div className="section-label">
          BREAKPOINTS
          {list.length > 0 && (
            <button className="small-action" onClick={onClearBreakpoints}>
              Clear all
            </button>
          )}
        </div>
        {list.length === 0 && <div className="inline-note">none</div>}
        {list.map(b => (
          <div key={`${b.board}:${b.file}:${b.line}`} className="debug-frame">
            {Object.keys(boardNames).length > 1 ? `${boardNames[b.board]} · ` : ''}
            {b.file}
            <span>line {b.line}</span>
            <button aria-label="Remove breakpoint" onClick={() => onRemoveBreakpoint(b)}>
              <X size={11} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
