// Breakpoints and stepping for the firmware VM, like a hardware debugger halting the CPU.
// The compiler marks the first instruction of every statement with its source line (`s`); the VM asks
// shouldPause() only at those instructions and only while a breakpoint or a step is armed, so a
// program without breakpoints runs at full speed.

/** Lines that have code, in order (a breakpoint on any other line moves to the next of these). */
export function codeLines(program) {
  return [...new Set(program.code.filter(c => c.s !== undefined).map(c => c.s))].sort((a, b) => a - b);
}

/** The function whose code contains pc. */
export function functionAt(program, pc) {
  let best = null;
  for (const [name, f] of Object.entries(program.funcs))
    if (f.pc <= pc && (!best || f.pc > best.pc)) best = {name, pc: f.pc};
  return best?.name ?? null;
}

/** The source line of the statement that contains pc. */
export function lineAt(program, pc) {
  for (let i = Math.min(pc, program.code.length - 1); i >= 0; i--)
    if (program.code[i].s !== undefined) return program.code[i].s;
  return null;
}

const show = v => {
  if (Array.isArray(v))
    return `{${v.slice(0, 16).map(show).join(', ')}${v.length > 16 ? `, … ${v.length} items` : ''}}`;
  if (typeof v === 'string') return JSON.stringify(v.length > 80 ? v.slice(0, 80) + '…' : v);
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);
  return String(v);
};

export class Debugger {
  constructor() {
    this.requested = new Set(); // lines the user clicked
    this.lines = new Set(); // the same lines moved onto code
    this.program = null;
    this.step = null; // {mode: 'into' | 'over' | 'out', depth}
    this.skipPc = -1; // the instruction we are resuming from must not stop us again
    this.paused = null; // {line, reason}
  }
  get armed() {
    return this.lines.size > 0 || this.step !== null;
  }
  setBreakpoints(lines) {
    this.requested = new Set(lines);
    this.bind(this.program);
  }
  /** A new program (compile or reset): breakpoints move onto its code lines; any pause is forgotten. */
  bind(program) {
    this.program = program;
    this.step = null;
    this.skipPc = -1;
    this.paused = null;
    this.lines = new Set();
    if (!program) return;
    const code = codeLines(program);
    for (const l of this.requested) {
      const at = code.find(c => c >= l);
      if (at !== undefined) this.lines.add(at);
    }
  }
  shouldPause(vm, pc, line) {
    if (pc === this.skipPc) {
      this.skipPc = -1;
      return false;
    }
    const depth = vm.frames.length;
    let reason = null;
    if (this.step?.mode === 'into') reason = 'step';
    else if (this.step?.mode === 'over' && depth <= this.step.depth) reason = 'step';
    else if (this.step?.mode === 'out' && depth < this.step.depth) reason = 'step';
    if (!reason && this.lines.has(line)) reason = 'breakpoint';
    if (!reason) return false;
    this.step = null;
    this.paused = {line, reason};
    return true;
  }
  /** Leave a pause: continue (mode null) or run to the next statement ('into'), the next one at this
   *  depth ('over'), or the first one after this function returns ('out'). */
  resume(vm, mode = null) {
    this.paused = null;
    this.skipPc = vm.pc;
    this.step = mode ? {mode, depth: vm.frames.length} : null;
  }
  /** Where the program stands and what its variables hold (the active function's locals and all globals). */
  inspect(vm) {
    const program = vm.program,
      types = program.varTypes ?? {},
      fn = functionAt(program, vm.pc);
    const frames = [{fn, line: lineAt(program, vm.pc)}];
    for (let i = vm.frames.length - 1; i >= 0; i--) {
      const f = vm.frames[i];
      const caller = functionAt(program, f.pc - 1);
      if (caller) frames.push({fn: caller, line: lineAt(program, f.pc - 1), isr: !!f.isr});
    }
    const local = Object.entries(vm.locals ?? {}).map(([slot, v]) => {
      const name = slot.includes('::') ? slot.split('::')[1] : slot;
      return {name, type: types[slot] ?? types[`${fn}::${name}`] ?? '', value: show(v)};
    });
    const globals = program.globals
      .filter(n => Object.hasOwn(vm.globals, n))
      .map(n => ({name: n, type: types[n] ?? '', value: show(vm.globals[n])}));
    return {
      line: this.paused?.line ?? frames[0].line,
      reason: this.paused?.reason ?? 'paused',
      frames,
      locals: local,
      globals,
    };
  }
}
