import {LabWorld} from './world.js';

export let sim = null;

export let accumulator = 0;

export let last = performance.now();

export let lastSend = 0;

/** How often a running simulation sends a snapshot to the UI (set by the UI per device and visibility). */
export let stateMs = 50;

/** Whether the current debugger halt has been reported to the UI. */
export let haltReported = false;

export const send = () => {
  if (sim) postMessage({type: 'state', state: sim.snapshot()});
};

onmessage = ({data}) => {
  try {
    switch (data.type) {
      case 'init':
        sim = new LabWorld(data.project);
        send();
        break;
      case 'project':
        sim?.update(data.project);
        send();
        break;
      case 'compile':
        sim.compile(data.source);
        postMessage({
          type: 'compiled',
          size: sim.program.size,
          memory: sim.program.memory,
          board: sim.active?.boardId,
        });
        send();
        break;
      case 'run':
        if (data.project) sim.update(data.project);
        sim.start();
        last = performance.now();
        accumulator = 0;
        postMessage({
          type: 'compiled',
          size: sim.program?.size ?? 0,
          memory: sim.program?.memory,
          board: sim.active?.boardId,
        });
        send();
        break;
      case 'pause':
        // while the debugger holds the bench, Run/Pause means continue
        if (sim.halted) {
          sim.debugAction('continue');
          haltReported = false;
        } else sim.running = !sim.running;
        last = performance.now();
        send();
        break;
      case 'stop':
        sim.stop();
        send();
        break;
      case 'reset':
        sim.reset();
        send();
        break;
      case 'step':
        sim.running = false;
        if (!sim.vm && sim.program) sim.reset();
        sim.tick(data.ms ?? 1);
        send();
        break;
      case 'serial':
        sim.serial(data.text);
        send();
        break;
      case 'breakpoints':
        sim?.setBreakpoints(data.board, data.lines);
        break;
      case 'debug':
        if (sim?.debugAction(data.action)) {
          haltReported = false;
          last = performance.now();
          accumulator = 0;
        }
        send();
        break;
      case 'inspect':
        postMessage({type: 'debug', info: sim?.inspect(data.board) ?? null});
        break;
      case 'config':
        if (data.stateMs >= 16) stateMs = data.stateMs;
        break;
      case 'clear':
        sim.clear();
        send();
        break;
    }
  } catch (e) {
    postMessage({type: 'error', message: e.message, line: e.line, board: e.board});
  }
};

setInterval(() => {
  const now = performance.now(),
    delta = now - last;
  last = now;
  if (sim?.running) {
    accumulator += Math.min(100, delta);
    const ticks = Math.min(30, Math.floor(accumulator)),
      deadline = performance.now() + 8;
    let advanced = 0;
    while (advanced < ticks && sim.running) {
      sim.tick(1);
      advanced++;
      if (performance.now() >= deadline) break;
    }
    accumulator -= advanced;
    if (accumulator > 200) accumulator = 200;
  }
  if (sim && !sim.running && !haltReported && sim.halted) {
    haltReported = true;
    postMessage({type: 'debug', info: sim.inspect()});
    send();
  }
  if (now - lastSend > stateMs && sim) {
    if (sim.running) send();
    lastSend = now;
  }
}, 8);
