import {BIN} from './codegen.js';
import {castValue} from './types.js';

export class VM {
  constructor(program, host) {
    this.program = program;
    this.host = host;
    this.pc = 0;
    this.stack = [];
    this.frames = [];
    this.globals = {};
    this.locals = null;
    this.sleepUntil = 0;
    this.instructions = 0;
    this.halted = false;
    this.noYield = 0;
    this.pending = [];
    this.waiting = null;
  }
  callback(name) {
    if (this.program.funcs[name] && this.pending.length < 32) this.pending.push(name);
  }
  call(name, args, now) {
    const f = this.program.funcs[name];
    if (f) {
      if (this.frames.length >= 48) throw Error('Maximum call depth exceeded (stack overflow)');
      this.frames.push({pc: this.pc, locals: this.locals, stack: this.stack.length});
      this.locals = Object.fromEntries(f.params.map((n, i) => [n, args[i] ?? 0]));
      this.pc = f.pc;
      return;
    }
    const result = this.host.call(name, args);
    if (result && typeof result === 'object' && result.wait) {
      this.waiting = result;
      return 'wait';
    }
    this.stack.push(result ?? 0);
  }
  get(name) {
    return this.locals && Object.hasOwn(this.locals, name) ? this.locals[name] : this.globals[name];
  }
  set(name, v) {
    if (this.locals && Object.hasOwn(this.locals, name)) this.locals[name] = v;
    else this.globals[name] = v;
  }
  run(now, budget = 4000) {
    if (this.halted) return;
    if (this.waiting) {
      if (!this.waiting.done) return;
      this.stack.push(this.waiting.result ?? 0);
      this.waiting = null;
    }
    if (this.pending.length && !this.frames.some(f => f.isr)) {
      const name = this.pending.shift(),
        savedSleep = this.sleepUntil;
      this.call(name, []);
      this.frames.at(-1).restoreSleep = savedSleep;
      this.frames.at(-1).isr = true;
      this.sleepUntil = now;
    }
    if (now < this.sleepUntil) return;
    let spent = 0;
    const st = this.stack,
      pop = () => st.pop() ?? 0;
    while (spent++ < budget) {
      const c = this.program.code[this.pc++];
      if (!c) throw Error('Invalid program counter');
      this.instructions++;
      switch (c.op) {
        case 'push':
          st.push(c.a);
          break;
        case 'load':
          st.push(this.get(c.a));
          break;
        case 'declare':
          (this.locals ?? this.globals)[c.a] = pop();
          break;
        case 'store': {
          const v = pop();
          this.set(c.a, v);
          st.push(v);
          break;
        }
        case 'pop':
          pop();
          break;
        case 'dup':
          st.push(st.at(-1));
          break;
        case 'nop':
          break;
        case 'truthy':
          st.push(pop() ? 1 : 0);
          break;
        case 'unary': {
          const u = pop();
          st.push(c.a === '!' ? (!u ? 1 : 0) : c.a === '-' ? -u : c.a === '~' ? ~u : +u);
          break;
        }
        case 'binary': {
          const b = pop(),
            a = pop();
          if (
            (c.a === 'i/' || c.a === '%') &&
            b === 0 &&
            typeof a === 'number' &&
            !(c.a === '%' && !Number.isInteger(a))
          )
            throw Error('Division by zero');
          st.push(BIN[c.a](a, b));
          break;
        }
        case 'cast':
          st.push(castValue(pop(), c.a));
          break;
        case 'fmtf': {
          const v = pop();
          st.push(Number.isFinite(v) ? v.toFixed(2) : Number.isNaN(v) ? 'nan' : 'inf');
          break;
        }
        case 'strchar': {
          const b = pop(),
            a = pop();
          st.push(c.a ? String.fromCharCode(a) : a);
          st.push(c.b ? String.fromCharCode(b) : b);
          break;
        }
        case 'mkarr': {
          const n = c.a,
            arr = st.splice(st.length - n, n);
          while (arr.length < c.b.total) arr.push(c.b.fill);
          st.push(arr);
          break;
        }
        case 'aload': {
          const i = pop(),
            a = pop();
          if (typeof a === 'string') {
            st.push(i >= 0 && i < a.length ? a.charCodeAt(i) : 0);
            break;
          }
          if (!Array.isArray(a)) throw Error('Indexing a value that is not an array');
          if (!Number.isInteger(i) || i < 0 || i >= a.length)
            throw Error(
              `Array index ${i} is out of bounds (size ${a.length}). Real hardware would read unrelated memory.`
            );
          st.push(a[i]);
          break;
        }
        case 'astore': {
          const v = pop(),
            i = pop(),
            a = pop();
          if (!Array.isArray(a)) throw Error('Writing an element of a value that is not an array');
          if (!Number.isInteger(i) || i < 0 || i >= a.length)
            throw Error(
              `Array index ${i} is out of bounds (size ${a.length}). Real hardware would corrupt memory.`
            );
          a[i] = v;
          st.push(v);
          break;
        }
        case 'aupd': {
          const rhs = pop(),
            i = pop(),
            a = pop();
          if (!Array.isArray(a) || !Number.isInteger(i) || i < 0 || i >= a.length)
            throw Error(`Array index ${i} is out of bounds`);
          const old = a[i];
          const op = c.a === '/' && c.b.div ? 'i/' : c.a;
          if ((op === 'i/' || op === '%') && rhs === 0) throw Error('Division by zero');
          const v = castValue(BIN[op](old, rhs), c.b.t);
          a[i] = v;
          st.push(c.b.post ? old : v);
          break;
        }
        case 'vupd': {
          const rhs = pop(),
            old = this.get(c.a);
          const op = c.b.op === '/' && c.b.div ? 'i/' : c.b.op;
          if ((op === 'i/' || op === '%') && rhs === 0) throw Error('Division by zero');
          const v = castValue(BIN[op](old, rhs), c.b.t);
          this.set(c.a, v);
          st.push(c.b.post ? old : v);
          break;
        }
        case 'alen': {
          const a = pop();
          st.push(Array.isArray(a) || typeof a === 'string' ? a.length : 0);
          break;
        }
        case 'jump':
          this.pc = c.a;
          break;
        case 'jz':
          if (!pop()) this.pc = c.a;
          break;
        case 'jnz':
          if (pop()) this.pc = c.a;
          break;
        case 'call': {
          const args = st.splice(st.length - c.b, c.b);
          if (c.a === 'delay' || c.a === 'delayMicroseconds') {
            const ms = c.a === 'delay' ? Number(args[0]) : Number(args[0]) / 1000;
            if (!(ms >= 0)) throw Error(`${c.a} needs a non-negative duration`);
            this.sleepUntil = now + Math.max(c.a === 'delay' ? 1 : 0.001, ms);
            st.push(0);
            this.noYield = 0;
            return;
          }
          if (this.call(c.a, args, now) === 'wait') {
            this.noYield = 0;
            return;
          }
          break;
        }
        case 'return': {
          let result = pop();
          for (let k = 0; k < c.a; k++) pop();
          const frame = this.frames.pop();
          if (!frame) throw Error('Return outside a function');
          st.length = frame.stack;
          st.push(result);
          this.pc = frame.pc;
          this.locals = frame.locals;
          if (frame.restoreSleep !== undefined) {
            this.sleepUntil = frame.restoreSleep;
            pop();
            if (now < this.sleepUntil) return;
          }
          break;
        }
        case 'yield':
          this.noYield = 0;
          return;
      }
      if (st.length > 4096) throw Error('Firmware stack overflow');
    }
    this.noYield++;
    if (this.noYield > 250)
      throw Error('Firmware did not yield for 1,000,000 instructions. Add delay() to a long-running loop.');
  }
}
