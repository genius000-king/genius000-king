import {
  CONSTANTS,
  apiProblem,
  FLOAT_CONSTANTS,
  STRING_METHODS,
  RET,
  METHODS,
  SERIAL_PORT,
  API,
} from './api.js';
import {CompileError} from './errors.js';
import {lex} from './lexer.js';
import {Parser} from './parser.js';
import {typeInfo, isFloatT, arith, isIntT} from './types.js';

export function compile(source, options = {}) {
  const profile = options.profile ?? null,
    intBits = profile?.intBits ?? 32,
    doubleBits = profile?.doubleBits ?? 64;
  const consts = {
    ...CONSTANTS,
    ...(profile?.pulldown !== false ? {INPUT_PULLDOWN: 3} : {}),
    ...(profile?.constants ?? {LED_BUILTIN: 2, A0: 36}),
  };
  const items = new Parser(lex(source)).program(),
    funcs = {},
    varTypes = {}, // slot -> declared type, for the debugger's variable view
    memory = [], // statically allocated variables and their size on this board
    code = [],
    globalVars = new Map(),
    objects = new Map(),
    fnDefs = new Map();
  for (const it of items)
    if (it.type === 'function') {
      if (fnDefs.has(it.name)) throw new CompileError(`Duplicate function ${it.name}`, it.line);
      fnDefs.set(it.name, it);
    }
  if (!fnDefs.has('setup') || !fnDefs.has('loop'))
    throw new CompileError('Define both void setup() and void loop()', items[0]?.line ?? 1);
  let locals = null,
    loops = [],
    currentFn = null;
  const ti = t => typeInfo(t, intBits, doubleBits);
  const emit = (op, a, b, line) => {
    code.push({op, a, b, line});
    return code.length - 1;
  };
  const lookup = name => locals?.get(name) ?? globalVars.get(name);
  const elemSize = t =>
    ({
      char: 1,
      byte: 1,
      s8: 1,
      bool: 1,
      short: 2,
      s16: 2,
      u16: 2,
      int: intBits / 8,
      uint: intBits / 8,
      long: 4,
      ulong: 4,
      s32: 4,
      u32: 4,
      float: 4,
      double: doubleBits / 8,
      String: intBits === 16 ? 6 : 12,
    })[t] ?? 4;
  const castTo = (t, line) => {
    const info = ti(t);
    if (info.k !== 'any') emit('cast', info, null, line);
  };
  const fixLiteralType = n => {
    if (n.vtype !== 'int?') return n.vtype;
    const v = n.value;
    if (v >= -(2 ** (intBits - 1)) && v < 2 ** (intBits - 1)) return 'int';
    if (v < 2 ** 31) return 'long';
    return 'ulong';
  };
  const check = (name, line) => {
    const p = apiProblem(name, profile);
    if (p) throw new CompileError(p, line);
  };
  // Returns the static type of the compiled expression.
  const expr = n => {
    switch (n.type) {
      case 'literal': {
        if (n.ref && n.ref !== 'Wire')
          throw new CompileError('Address-of is only supported as &Wire in display constructors', n.line);
        emit('push', n.value);
        return fixLiteralType(n);
      }
      case 'variable': {
        const v = lookup(n.name);
        if (v) {
          emit('load', v.slot ?? n.name);
          return v.array ? 'array:' + v.type : v.obj ? 'obj:' + v.obj : v.type;
        }
        if (objects.has(n.name)) {
          emit('load', n.name);
          return 'obj:' + objects.get(n.name);
        }
        if (Object.hasOwn(consts, n.name)) {
          emit('push', consts[n.name]);
          return FLOAT_CONSTANTS.has(n.name) ? 'double' : 'int';
        }
        if (fnDefs.has(n.name)) {
          emit('push', n.name);
          return 'fn';
        }
        throw new CompileError(
          `Unknown variable “${n.name}”${/^(A\d+|D\d+|P[ABC]\d+|INPUT_PULLDOWN)$/.test(n.name) && profile ? ` on ${profile.name}` : ''}`,
          n.line
        );
      }
      case 'index': {
        const base = n.base.type === 'index' ? null : lookup(n.base.name);
        const {arr, flat} = indexInfo(n);
        emit('load', arr.slot ?? arr.name);
        expr(flat);
        emit('aload', null, null, n.line);
        return arr.type;
      }
      case 'assign':
        return assign(n);
      case 'comma':
        expr(n.left);
        emit('pop');
        return expr(n.right);
      case 'unary': {
        const t = expr(n.value);
        emit('unary', n.op);
        if (n.op === '!') return 'bool';
        if (n.op === '~' || n.op === '-') {
          const r = isFloatT(t) ? t : arith(t, 'int', intBits);
          if (isIntT(r)) castTo(r, n.line);
          return r;
        }
        return t;
      }
      case 'cast': {
        const from = expr(n.value);
        if (n.vtype === 'String') {
          emit('call', 'String', 1);
          return 'String';
        }
        castTo(n.vtype, n.line);
        return n.vtype;
      }
      case 'sizeof': {
        if (n.value.type === 'variable') {
          const v = lookup(n.value.name);
          if (v?.array) {
            emit('load', v.slot ?? n.value.name);
            emit('alen');
            emit('push', (elemSize(v.type) * (v.stride ?? 1)) / (v.stride ?? 1));
            emit('binary', '*');
            return 'uint';
          }
          if (v) {
            emit('push', elemSize(v.type));
            return 'uint';
          }
        }
        if (n.value.type === 'index') {
          const {arr} = indexInfo(n.value, true);
          emit(
            'push',
            elemSize(arr.type) * (n.value.base.type === 'variable' && arr.dims?.length > 1 ? arr.stride : 1)
          );
          return 'uint';
        }
        throw new CompileError('sizeof needs a variable, array or type', n.line);
      }
      case 'sizeofType':
        emit('push', elemSize(n.vtype));
        return 'uint';
      case 'binary': {
        if (n.op === '&&' || n.op === '||') {
          expr(n.left);
          emit('truthy');
          emit('dup');
          const j = emit(n.op === '&&' ? 'jz' : 'jnz', 0);
          emit('pop');
          expr(n.right);
          emit('truthy');
          code[j].a = code.length;
          return 'bool';
        }
        const lt = expr(n.left),
          rt = expr(n.right);
        if (['==', '!=', '<', '>', '<=', '>='].includes(n.op)) {
          emit('binary', n.op);
          return 'bool';
        }
        const r = n.op === '<<' || n.op === '>>' ? arith(lt, 'int', intBits) : arith(lt, rt, intBits);
        if (r === 'String') {
          if (isFloatT(lt))
            throw new CompileError('Convert floats with String(value) before concatenating', n.line);
          if (lt === 'char' || rt === 'char') {
            emit('strchar', lt === 'char' ? 1 : 0, rt === 'char' ? 1 : 0);
          }
          if (isFloatT(rt)) {
            emit('fmtf');
          }
          emit('binary', '+');
          return 'String';
        }
        if (n.op === '/' && isIntT(r)) {
          emit('binary', 'i/');
          castTo(r, n.line);
          return r;
        }
        if (n.op === '%' && isFloatT(r))
          throw new CompileError('% needs integer operands. Use fmod() for floating-point values.', n.line);
        emit('binary', n.op === '>>' && ['uint', 'ulong', 'u32'].includes(r) ? '>>>' : n.op);
        if (isIntT(r)) castTo(r, n.line);
        else if (r === 'float' && doubleBits === 32) castTo('float', n.line);
        return r;
      }
      case 'ternary': {
        expr(n.test);
        const j = emit('jz', 0);
        const a = expr(n.yes);
        const end = emit('jump', 0);
        code[j].a = code.length;
        const b = expr(n.no);
        code[end].a = code.length;
        return a === b ? a : arith(a, b, intBits);
      }
      case 'method': {
        const t = expr(n.target);
        if (t === 'String' || t === 'int' || t.startsWith?.('array') === false) {
          return stringMethod(n.method, n.args, n.line, null, t);
        }
        throw new CompileError(`Method ${n.method}() is not available on this value`, n.line);
      }
      case 'call':
        return call(n);
      default:
        throw new CompileError('Unsupported expression', n.line);
    }
  };
  const indexInfo = (n, typeOnly = false) => {
    const idx = [];
    let b = n;
    while (b.type === 'index') {
      idx.unshift(b.index);
      b = b.base;
    }
    if (b.type !== 'variable') throw new CompileError('Only named arrays can be indexed', n.line);
    const v = lookup(b.name);
    if (!v?.array) {
      if (v?.type === 'String' && idx.length === 1) {
        return {arr: {...v, name: b.name, type: 'char', stringIndex: true}, flat: idx[0]};
      }
      throw new CompileError(`“${b.name}” is not an array`, n.line);
    }
    if (typeOnly) return {arr: {...v, name: b.name}};
    let flat = idx[0];
    if (v.dims.length === 2 && idx.length === 2)
      flat = {
        type: 'binary',
        op: '+',
        left: {
          type: 'binary',
          op: '*',
          left: idx[0],
          right: {type: 'literal', value: v.dims[1], vtype: 'int'},
        },
        right: idx[1],
      };
    else if (idx.length !== v.dims.length && !(v.dims.length === 1 && idx.length === 1))
      throw new CompileError(
        `Array “${b.name}” needs ${v.dims.length} index value${v.dims.length > 1 ? 's' : ''}`,
        n.line
      );
    return {arr: {...v, name: b.name}, flat};
  };
  const stringMethod = (method, args, line, targetVar, t) => {
    if (!(method in STRING_METHODS)) throw new CompileError(`String method ${method}() is unsupported`, line);
    args.forEach(expr);
    emit('call', 'String.' + method, args.length + 1, line);
    if (STRING_METHODS[method] && targetVar) {
      emit('store', targetVar.slot ?? targetVar.name);
    }
    return RET['String.' + method] ?? (method === 'charAt' ? 'char' : 'int');
  };
  const assign = n => {
    const tgt = n.target;
    if (tgt.type === 'index') {
      const {arr, flat} = indexInfo(tgt);
      if (arr.const) throw new CompileError(`Cannot modify const array “${arr.name}”`, n.line);
      emit('load', arr.slot ?? arr.name);
      expr(flat);
      if (n.op === '=') {
        expr(n.value);
        castTo(arr.type, n.line);
        emit('astore', null, null, n.line);
      } else {
        expr(n.value);
        emit('aupd', n.op.slice(0, -1), {post: !!n.postfix, t: ti(arr.type), div: isIntT(arr.type)}, n.line);
      }
      return arr.type;
    }
    const v = lookup(tgt.name);
    if (!v) {
      if (Object.hasOwn(consts, tgt.name)) throw new CompileError(`“${tgt.name}” is a constant`, n.line);
      throw new CompileError(`Unknown variable “${tgt.name}”`, n.line);
    }
    if (v.const) throw new CompileError(`Cannot assign to const “${tgt.name}”`, n.line);
    if (v.array) throw new CompileError(`Cannot assign to whole array “${tgt.name}”`, n.line);
    const slot = v.slot ?? tgt.name;
    if (n.op === '=') {
      const rt = expr(n.value);
      if (v.type === 'String' && rt === 'char') emit('call', 'String.fromChar', 1);
      else if (v.type === 'String' && isFloatT(rt)) emit('fmtf');
      castTo(v.type, n.line);
      emit('store', slot);
      return v.type;
    }
    const rt = expr(n.value);
    if (v.type === 'String') {
      if (n.op !== '+=') throw new CompileError('Only += is valid on String', n.line);
      if (rt === 'char') emit('call', 'String.fromChar', 1);
      else if (isFloatT(rt)) emit('fmtf');
    }
    emit(
      'vupd',
      slot,
      {op: n.op.slice(0, -1), post: !!n.postfix, t: ti(v.type), div: isIntT(v.type) && isIntT(rt)},
      n.line
    );
    return v.type;
  };
  const printTag = t =>
    t === 'char'
      ? 'c'
      : isFloatT(t)
        ? 'f'
        : t === 'String'
          ? 's'
          : ['uint', 'ulong', 'u32', 'u16', 'byte'].includes(t)
            ? 'u'
            : 'i';
  const call = n => {
    let name = n.name;
    const parts = name.split('.');
    if (parts.length === 2 && objects.has(parts[0])) {
      const cls = objects.get(parts[0]);
      if (!METHODS[cls].includes(parts[1]))
        throw new CompileError(`${cls}.${parts[1]}() is unsupported in Circuit Lab`, n.line);
      const full = cls + '.' + parts[1];
      check(full, n.line);
      emit('load', parts[0]);
      return hostCall(full, n.args, n.line, 1);
    }
    if (parts.length === 2 && lookup(parts[0])) {
      const v = lookup(parts[0]);
      if (v.type === 'String' || isIntT(v.type)) {
        emit('load', v.slot ?? parts[0]);
        return stringMethod(parts[1], n.args, n.line, v, v.type);
      }
    }
    if (parts.length > 2) throw new CompileError(`Chained call ${name}() is unsupported`, n.line);
    if (fnDefs.has(name)) {
      const f = fnDefs.get(name);
      if (n.args.length !== f.params.length)
        throw new CompileError(`Incorrect argument count for ${name}()`, n.line);
      n.args.forEach((a, i) => {
        const t = expr(a);
        if (!f.params[i].array) castTo(f.params[i].type, n.line);
      });
      emit('call', name, n.args.length, n.line);
      return f.ret;
    }
    const port = SERIAL_PORT.exec(name);
    let lookupName = name;
    if (port) {
      if (profile && !profile.uarts[port[1]])
        throw new CompileError(`${port[1]} does not exist on ${profile.name}`, n.line);
      lookupName = 'Serial.' + port[2];
    }
    if (name === 'fmod') {
      n.args.forEach(expr);
      emit('binary', '%');
      return 'double';
    }
    if (!API.has(lookupName))
      throw new CompileError(`Unsupported API “${name}”. See the supported firmware reference.`, n.line);
    check(lookupName, n.line);
    return hostCall(name, n.args, n.line, 0, lookupName);
  };
  const hostCall = (name, args, line, extra, lookupName = name) => {
    const types = args.map(a => expr(a));
    if (['attachInterrupt', 'timerEvery'].includes(name)) {
      const cb = args[1];
      if (cb?.type !== 'variable' || !fnDefs.has(cb.name))
        throw new CompileError(`${name} needs the name of a void function as its callback`, line);
    }
    let argc = args.length + extra;
    if (/\.(print|println)$/.test(lookupName)) {
      emit('push', args.length ? printTag(types[0]) : '');
      argc++;
    }
    if (name === 'Serial.printf' || /^Serial\d\.printf$/.test(name)) {
      emit('push', types.map(printTag).join(''));
      argc++;
    }
    emit('call', name, argc, line);
    const r = RET[lookupName];
    if (r === '*') return types.reduce((a, b) => arith(a, b, intBits), types[0] ?? 'int');
    return (
      r ??
      (lookupName.startsWith('Serial.') && ['available', 'read', 'peek'].some(s => lookupName.endsWith(s))
        ? 'int'
        : 'int')
    );
  };
  const declare = (d, isGlobal) => {
    const scope = isGlobal ? globalVars : locals;
    if (d.vtype === 'void') throw new CompileError('Variables cannot be void', d.line);
    let slot = d.name;
    if (d.static && !isGlobal) {
      slot = currentFn + '::' + d.name;
    }
    varTypes[slot] = d.dims.length ? `${d.vtype}[]` : d.vtype;
    // static RAM: globals and static locals (a const scalar with a literal value is folded away by the compiler)
    const ram = bytes => {
      if (isGlobal || d.static) memory.push({name: d.name, type: varTypes[slot], bytes});
    };
    if (d.dims.length) {
      if (d.dims.length > 2) throw new CompileError('Arrays support at most two dimensions', d.line);
      if (
        d.vtype === 'char' &&
        d.dims.length === 1 &&
        d.init?.type === 'literal' &&
        typeof d.init.value === 'string'
      ) {
        scope.set(d.name, {type: 'String', slot});
        ram(d.init.value.length + 1);
        if (d.static && !isGlobal)
          staticInit.push(() => {
            emit('push', d.init.value);
            emit('declare', slot);
          });
        else {
          emit('push', d.init.value);
          emit('declare', slot);
        }
        return;
      }
      const dims = d.dims.map((x, i) => {
        if (x === null) return null;
        if (x.type === 'literal') return x.value;
        if (x.type === 'variable' && lookup(x.name)?.constValue !== undefined)
          return lookup(x.name).constValue;
        if (x.type === 'variable' && Object.hasOwn(consts, x.name)) return consts[x.name];
        throw new CompileError('Array sizes must be constant', d.line);
      });
      const flat = [];
      const walk = (node, depth) => {
        for (const it of node.items) {
          if (it.type === 'list') {
            if (depth + 1 >= dims.length) throw new CompileError('Too many braces in initializer', d.line);
            const start = flat.length;
            walk(it, depth + 1);
            while (flat.length < start + (dims[1] ?? 0)) flat.push(null);
          } else flat.push(it);
        }
      };
      if (d.init) {
        if (d.init.type !== 'list') {
          if (d.vtype === 'char' && typeof d.init.value === 'string') {
            d.init = {
              type: 'list',
              items: [...d.init.value, '\0'].map(ch => ({
                type: 'literal',
                value: ch.charCodeAt(0),
                vtype: 'char',
              })),
            };
          } else throw new CompileError('Arrays need a { … } initializer', d.line);
        }
        walk(d.init, 0);
      }
      if (dims[0] === null) dims[0] = dims.length === 2 ? Math.ceil(flat.length / dims[1]) : flat.length;
      if (dims.some(x => !Number.isInteger(x) || x < 1 || x > 4096))
        throw new CompileError('Array size must be 1–4096', d.line);
      const total = dims.reduce((a, b) => a * b, 1);
      if (flat.length > total) throw new CompileError(`Too many initializers for “${d.name}”`, d.line);
      scope.set(d.name, {type: d.vtype, array: true, dims, stride: dims[1] ?? 1, const: d.const, slot});
      ram(elemSize(d.vtype) * total);
      const build = () => {
        for (const it of flat) {
          if (it) {
            expr(it);
            castTo(d.vtype, d.line);
          } else emit('push', 0);
        }
        emit('mkarr', flat.length, {total, fill: ti(d.vtype).k === 's' ? '' : 0});
        emit('declare', slot);
      };
      if (d.static && !isGlobal) staticInit.push(build);
      else build();
      return;
    }
    const info = {type: d.vtype, const: d.const, slot};
    if (d.const && d.init?.type === 'literal' && typeof d.init.value === 'number')
      info.constValue = d.init.value;
    else ram(elemSize(d.vtype));
    const build = () => {
      if (d.init) {
        if (d.init.type === 'list') throw new CompileError('Only arrays use { } initializers', d.line);
        const t = expr(d.init);
        if (d.vtype === 'String' && t === 'char') emit('call', 'String.fromChar', 1);
        else if (d.vtype === 'String' && isFloatT(t)) emit('fmtf');
      } else emit('push', d.vtype === 'String' ? '' : 0);
      castTo(d.vtype, d.line);
      emit('declare', slot);
    };
    scope.set(d.name, info);
    if (d.static && !isGlobal) staticInit.push(build);
    else build();
  };
  const staticInit = [];
  // The first instruction of every statement carries its source line (`s`): the debugger stops there.
  const stmt = n => {
    if (!n) return;
    const start = code.length;
    statement(n);
    if (n.type !== 'block' && n.line && code.length > start && code[start].s === undefined)
      code[start].s = n.line;
  };
  const statement = n => {
    switch (n.type) {
      case 'block':
        n.body.forEach(stmt);
        break;
      case 'empty':
        break;
      case 'declare':
        declare(n, false);
        break;
      case 'object':
        throw new CompileError(`Declare ${n.cls} objects globally, outside functions`, n.line);
      case 'expression':
        expr(n.value);
        emit('pop');
        break;
      case 'if': {
        expr(n.test);
        const j = emit('jz', 0);
        stmt(n.yes);
        if (n.no) {
          const e = emit('jump', 0);
          code[j].a = code.length;
          stmt(n.no);
          code[e].a = code.length;
        } else code[j].a = code.length;
        break;
      }
      case 'while':
      case 'for': {
        if (n.type === 'for' && n.init) n.init.forEach(stmt);
        const start = code.length;
        expr(n.test);
        const stop = emit('jz', 0);
        loops.push({breaks: [], continues: [], loop: true});
        stmt(n.body);
        const cont = code.length;
        if (n.steps)
          for (const s of n.steps) {
            expr(s);
            emit('pop');
          }
        emit('jump', start);
        code[stop].a = code.length;
        const l = loops.pop();
        l.breaks.forEach(k => (code[k].a = code.length));
        l.continues.forEach(k => (code[k].a = cont));
        break;
      }
      case 'do': {
        const start = code.length;
        loops.push({breaks: [], continues: [], loop: true});
        stmt(n.body);
        const cont = code.length;
        expr(n.test);
        emit('jnz', start);
        const l = loops.pop();
        l.breaks.forEach(k => (code[k].a = code.length));
        l.continues.forEach(k => (code[k].a = cont));
        break;
      }
      case 'switch': {
        expr(n.test);
        const jumps = [];
        let def = null;
        for (const c of n.cases) {
          if (c.value === null) {
            def = c;
            continue;
          }
          emit('dup');
          expr(c.value);
          emit('binary', '==');
          jumps.push([emit('jnz', 0), c]);
        }
        const toDefault = emit('jump', 0);
        loops.push({breaks: [], switch: true});
        const starts = new Map();
        for (const c of n.cases) {
          starts.set(c, code.length);
          c.body.forEach(stmt);
        }
        const end = code.length;
        for (const [j, c] of jumps) code[j].a = starts.get(c);
        code[toDefault].a = def ? starts.get(def) : end;
        const l = loops.pop();
        l.breaks.forEach(k => (code[k].a = end));
        emit('pop');
        // Break jumps land on the pop that removes the switch value.
        break;
      }
      case 'break': {
        if (!loops.length) throw new CompileError('break outside a loop or switch', n.line);
        loops.at(-1).breaks.push(emit('jump', 0));
        break;
      }
      case 'continue': {
        const l = [...loops].reverse().find(l => l.loop);
        if (!l) throw new CompileError('continue outside a loop', n.line);
        let pops = 0;
        for (let i = loops.length - 1; loops[i] !== l; i--) if (loops[i].switch) pops++;
        for (let i = 0; i < pops; i++) emit('pop');
        l.continues.push(emit('jump', 0));
        break;
      }
      case 'return': {
        if (n.value) {
          const t = expr(n.value);
          const f = fnDefs.get(currentFn);
          if (f.ret === 'void') throw new CompileError('A void function cannot return a value', n.line);
          castTo(f.ret, n.line);
        } else emit('push', 0);
        let pops = loops.filter(l => l.switch).length;
        emit('return', pops);
        break;
      }
      default:
        throw new CompileError('Unsupported statement', n.line);
    }
  };
  // Switch break targets must also drop the switch value: place breaks before the final pop.
  for (const it of items) {
    if (it.type === 'declare') declare(it, true);
    else if (it.type === 'object') {
      if (objects.has(it.name) || globalVars.has(it.name))
        throw new CompileError(`Duplicate name ${it.name}`, it.line);
      objects.set(it.name, it.cls);
      it.args.forEach(a => expr(a));
      emit('call', 'new.' + it.cls, it.args.length, it.line);
      emit('declare', it.name);
    }
  }
  const staticAt = code.length;
  emit('nop');
  emit('call', 'setup', 0);
  emit('pop');
  const repeat = code.length;
  emit('call', 'loop', 0);
  emit('pop');
  emit('yield');
  emit('jump', repeat);
  for (const [name, f] of fnDefs) {
    funcs[name] = {pc: code.length, params: f.params.map(p => p.name)};
    for (const p of f.params) varTypes[name + '::' + p.name] = p.array ? `${p.type}[]` : p.type;
    currentFn = name;
    locals = new Map(
      f.params.map(p => [p.name, {type: p.type, array: p.array, dims: p.array ? [0] : undefined}])
    );
    loops = [];
    stmt(f.body);
    emit('push', 0);
    emit('return', 0);
  }
  locals = null;
  if (staticInit.length) {
    const jump = code.length;
    code[staticAt] = {op: 'jump', a: jump};
    staticInit.forEach(b => b());
    emit('jump', staticAt + 1);
  }
  return {
    code,
    funcs,
    globals: [...globalVars.keys()],
    varTypes,
    memory: {
      items: memory,
      // libraries whose fixed buffers count on small boards
      uses: ['Serial', 'Wire']
        .filter(lib =>
          code.some(
            c =>
              c.op === 'call' &&
              typeof c.a === 'string' &&
              (c.a.startsWith(lib) || (lib === 'Wire' && /^(LCD|OLED)\./.test(c.a)))
          )
        )
        .concat(
          Object.values(objects).some(o => /LiquidCrystal_I2C|SSD1306/.test(o.cls ?? o)) ? ['Wire'] : []
        ),
    },
    objects: Object.fromEntries(objects),
    size: code.length,
    profile: profile?.key ?? null,
  };
}

export const BIN = {
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '*': (a, b) => a * b,
  '/': (a, b) => a / b,
  'i/': (a, b) => Math.trunc(a / b),
  '%': (a, b) => a % b,
  '<': (a, b) => +(a < b),
  '>': (a, b) => +(a > b),
  '<=': (a, b) => +(a <= b),
  '>=': (a, b) => +(a >= b),
  '==': (a, b) => +(a == b),
  '!=': (a, b) => +(a != b),
  '&': (a, b) => a & b,
  '|': (a, b) => a | b,
  '^': (a, b) => a ^ b,
  '<<': (a, b) => a << b,
  '>>': (a, b) => a >> b,
  '>>>': (a, b) => a >>> b,
};
