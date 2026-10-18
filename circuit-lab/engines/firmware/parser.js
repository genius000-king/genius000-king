import {CompileError} from './errors.js';
import {TYPE_WORDS, QUALIFIERS, CLASSES} from './language.js';
import {normalizeType} from './types.js';

export class Parser {
  constructor(tokens) {
    this.t = tokens;
    this.i = 0;
  }
  get cur() {
    return this.t[this.i];
  }
  peek(n = 1) {
    return this.t[this.i + n];
  }
  is(v) {
    return this.cur.kind !== 'str' && this.cur.value === v;
  }
  take(v) {
    if (this.is(v)) return this.t[this.i++];
    return null;
  }
  need(v) {
    if (!this.take(v)) this.err(`Expected “${v}”, found “${this.cur.value}”`);
  }
  err(s, line = this.cur.line) {
    throw new CompileError(s, line);
  }
  id() {
    if (this.cur.kind !== 'id') this.err('Expected an identifier');
    return this.t[this.i++].value;
  }
  isTypeStart(at = 0) {
    const t = this.t[this.i + at];
    return t.kind === 'id' && (TYPE_WORDS.has(t.value) || QUALIFIERS.has(t.value));
  }
  typeSpec() {
    const words = [];
    while (this.cur.kind === 'id' && (TYPE_WORDS.has(this.cur.value) || QUALIFIERS.has(this.cur.value)))
      words.push(this.t[this.i++].value);
    if (!words.some(w => TYPE_WORDS.has(w) || w === 'unsigned' || w === 'signed'))
      this.err('Expected a supported value type');
    let type = normalizeType(words, this.cur.line);
    if (this.is('*')) {
      if (type !== 'char' && type !== 'byte') this.err('Pointers are unsupported. Use arrays or String.');
      while (this.take('*') || this.take('const'));
      type = 'String';
    }
    if (this.is('&')) this.err('References are unsupported. Pass values or use a global variable.');
    return {
      type,
      static: words.includes('static'),
      const: words.includes('const') || words.includes('constexpr'),
    };
  }
  program() {
    const items = [];
    while (this.cur.kind !== 'eof') {
      const line = this.cur.line;
      if (this.take(';')) continue;
      if (
        ['struct', 'class', 'typedef', 'enum', 'template', 'namespace', 'union', 'using'].includes(
          this.cur.value
        )
      )
        this.err(`“${this.cur.value}” declarations are outside the Lab subset.`);
      if (this.cur.kind === 'id' && CLASSES[this.cur.value]) {
        items.push(this.objectDecl());
        continue;
      }
      const spec = this.typeSpec(),
        name = this.id();
      if (this.take('(')) {
        const params = [];
        if (!this.is(')') && !(this.is('void') && this.peek().value === ')')) {
          do {
            const p = this.typeSpec(),
              pname = this.id();
            let array = false;
            while (this.take('[')) {
              array = true;
              if (!this.is(']')) this.expr();
              this.need(']');
            }
            params.push({name: pname, type: p.type, array});
          } while (this.take(','));
        } else this.take('void');
        this.need(')');
        if (this.take(';')) {
          items.push({type: 'prototype', name, line});
          continue;
        }
        items.push({type: 'function', name, ret: spec.type, params, body: this.block(), line});
      } else items.push(...this.declRest(spec, name, line));
    }
    return items;
  }
  objectDecl() {
    const line = this.cur.line,
      cls = this.id(),
      name = this.id();
    let args = [];
    if (this.take('(')) {
      if (!this.is(')'))
        do {
          args.push(this.expr());
        } while (this.take(','));
      this.need(')');
    } else if (this.take('=')) {
      const c2 = this.id();
      if (c2 !== cls) this.err(`Expected ${cls}(…) initializer`);
      this.need('(');
      if (!this.is(')'))
        do {
          args.push(this.expr());
        } while (this.take(','));
      this.need(')');
    }
    this.need(';');
    return {type: 'object', cls, name, args, line};
  }
  declRest(spec, name, line) {
    const out = [];
    for (;;) {
      const dims = [];
      while (this.take('[')) {
        dims.push(this.is(']') ? null : this.expr());
        this.need(']');
      }
      let init = null;
      if (this.take('=')) init = this.is('{') ? this.initList() : this.expr();
      else if (this.is('{')) init = this.initList();
      out.push({
        type: 'declare',
        name,
        vtype: spec.type,
        dims,
        init,
        static: spec.static,
        const: spec.const,
        line,
      });
      if (!this.take(',')) break;
      name = this.id();
    }
    this.need(';');
    return out;
  }
  initList() {
    this.need('{');
    const items = [];
    if (!this.is('}'))
      do {
        if (this.is('}')) break;
        items.push(this.is('{') ? this.initList() : this.expr());
      } while (this.take(','));
    this.need('}');
    return {type: 'list', items};
  }
  block() {
    this.need('{');
    const body = [];
    while (!this.is('}')) {
      if (this.cur.kind === 'eof') this.err('Missing closing }');
      body.push(...this.stmtList());
    }
    this.need('}');
    return {type: 'block', body};
  }
  stmtList() {
    const line = this.cur.line;
    if (
      this.isTypeStart() &&
      !(this.peek().value === '(' && !QUALIFIERS.has(this.cur.value) && this.t[this.i + 2]?.kind !== 'id')
    ) {
      const spec = this.typeSpec();
      return this.declRest(spec, this.id(), line);
    }
    if (this.cur.kind === 'id' && CLASSES[this.cur.value] && this.peek().kind === 'id')
      return [this.objectDecl()];
    return [this.stmt()];
  }
  stmt() {
    const line = this.cur.line;
    if (this.is('{')) return this.block();
    if (this.take(';')) return {type: 'empty'};
    if (this.take('if')) {
      this.need('(');
      const test = this.expr();
      this.need(')');
      const yes = this.body(),
        no = this.take('else') ? this.body() : null;
      return {type: 'if', test, yes, no, line};
    }
    if (this.take('while')) {
      this.need('(');
      const test = this.expr();
      this.need(')');
      return {type: 'while', test, body: this.body(), line};
    }
    if (this.take('do')) {
      const body = this.body();
      this.need('while');
      this.need('(');
      const test = this.expr();
      this.need(')');
      this.need(';');
      return {type: 'do', test, body, line};
    }
    if (this.take('for')) {
      this.need('(');
      let init = null;
      if (!this.take(';')) {
        init = this.stmtList();
      }
      const test = this.is(';') ? {type: 'literal', value: 1, vtype: 'int'} : this.expr();
      this.need(';');
      const steps = [];
      if (!this.is(')'))
        do {
          steps.push(this.expr());
        } while (this.take(','));
      this.need(')');
      return {type: 'for', init, test, steps, body: this.body(), line};
    }
    if (this.take('switch')) {
      this.need('(');
      const test = this.expr();
      this.need(')');
      this.need('{');
      const cases = [];
      let current = null;
      while (!this.take('}')) {
        if (this.cur.kind === 'eof') this.err('Missing closing } for switch');
        const l = this.cur.line;
        if (this.take('case')) {
          const value = this.expr();
          this.need(':');
          current = {value, body: [], line: l};
          cases.push(current);
          continue;
        }
        if (this.take('default')) {
          this.need(':');
          current = {value: null, body: [], line: l};
          cases.push(current);
          continue;
        }
        if (!current) this.err('Statement before the first case label');
        current.body.push(...this.stmtList());
      }
      return {type: 'switch', test, cases, line};
    }
    if (this.take('return')) {
      const value = this.is(';') ? null : this.expr();
      this.need(';');
      return {type: 'return', value, line};
    }
    if (this.take('break')) {
      this.need(';');
      return {type: 'break', line};
    }
    if (this.take('continue')) {
      this.need(';');
      return {type: 'continue', line};
    }
    if (this.is('goto')) this.err('goto is unsupported');
    const value = this.expr();
    this.need(';');
    return {type: 'expression', value, line};
  }
  body() {
    const line = this.cur.line;
    const list = this.stmtList();
    return list.length === 1 ? list[0] : {type: 'block', body: list, line};
  }
  expr() {
    let e = this.assign();
    while (this.is(',') && this.inParens) {
      this.i++;
      e = {type: 'comma', left: e, right: this.assign()};
    }
    return e;
  }
  assign() {
    const left = this.ternary();
    if (
      ['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='].includes(this.cur.value) &&
      this.cur.kind === 'op'
    ) {
      const op = this.t[this.i++].value,
        line = this.cur.line;
      if (!['variable', 'index'].includes(left.type))
        this.err('Assignment requires a variable or array element', line);
      return {type: 'assign', target: left, op, value: this.assign(), line: left.line ?? line};
    }
    return left;
  }
  ternary() {
    const test = this.binary(0);
    if (this.take('?')) {
      const yes = this.assign();
      this.need(':');
      return {type: 'ternary', test, yes, no: this.assign(), line: test.line};
    }
    return test;
  }
  binary(level) {
    const levels = [
      ['||'],
      ['&&'],
      ['|'],
      ['^'],
      ['&'],
      ['==', '!='],
      ['<', '>', '<=', '>='],
      ['<<', '>>'],
      ['+', '-'],
      ['*', '/', '%'],
    ];
    if (level === levels.length) return this.unary();
    let left = this.binary(level + 1);
    while (this.cur.kind === 'op' && levels[level].includes(this.cur.value)) {
      const op = this.t[this.i++].value;
      left = {type: 'binary', op, left, right: this.binary(level + 1), line: left.line};
    }
    return left;
  }
  unary() {
    const line = this.cur.line;
    if (this.cur.kind === 'op' && ['!', '-', '+', '~'].includes(this.cur.value)) {
      const op = this.t[this.i++].value;
      return {type: 'unary', op, value: this.unary(), line};
    }
    if (this.cur.kind === 'op' && ['++', '--'].includes(this.cur.value)) {
      const op = this.t[this.i++].value,
        target = this.unary();
      if (!['variable', 'index'].includes(target.type)) this.err('++/-- requires a variable');
      return {
        type: 'assign',
        target,
        op: op === '++' ? '+=' : '-=',
        value: {type: 'literal', value: 1, vtype: 'int'},
        line,
      };
    }
    if (this.is('&')) {
      this.i++;
      const name = this.id();
      return {type: 'literal', value: 0, vtype: 'int', ref: name, line};
    }
    if (this.is('*')) this.err('Pointer dereference is unsupported');
    if (this.take('sizeof')) {
      this.need('(');
      let n;
      if (this.isTypeStart()) {
        n = {type: 'sizeofType', vtype: this.typeSpec().type, line};
      } else n = {type: 'sizeof', value: this.expr(), line};
      this.need(')');
      return n;
    }
    if (this.is('(') && this.isTypeStart(1)) {
      let j = this.i + 1;
      while (this.t[j].kind === 'id' && (TYPE_WORDS.has(this.t[j].value) || QUALIFIERS.has(this.t[j].value)))
        j++;
      while (this.t[j].value === '*') j++;
      if (this.t[j].value === ')') {
        this.i++;
        const {type} = this.typeSpec();
        this.need(')');
        return {type: 'cast', vtype: type, value: this.unary(), line};
      }
    }
    return this.postfix();
  }
  postfix() {
    let e = this.primary();
    for (;;) {
      const line = this.cur.line;
      if (this.take('[')) {
        const index = this.expr();
        this.need(']');
        e = {type: 'index', base: e, index, line};
        continue;
      }
      if (this.is('.') && e.type !== 'variable') {
        this.i++;
        const method = this.id();
        this.need('(');
        const args = this.args();
        e = {type: 'method', target: e, method, args, line};
        continue;
      }
      if (this.take('++'))
        e = {
          type: 'assign',
          target: e,
          postfix: true,
          op: '+=',
          value: {type: 'literal', value: 1, vtype: 'int'},
          line,
        };
      else if (this.take('--'))
        e = {
          type: 'assign',
          target: e,
          postfix: true,
          op: '-=',
          value: {type: 'literal', value: 1, vtype: 'int'},
          line,
        };
      else break;
    }
    return e;
  }
  args() {
    const a = [];
    const prev = this.inParens;
    this.inParens = false;
    if (!this.is(')'))
      do {
        a.push(this.assign());
      } while (this.take(','));
    this.need(')');
    this.inParens = prev;
    return a;
  }
  primary() {
    const t = this.cur;
    if (this.take('(')) {
      const prev = this.inParens;
      this.inParens = true;
      const v = this.expr();
      this.inParens = prev;
      this.need(')');
      return v;
    }
    if (t.kind === 'num') {
      this.i++;
      return {
        type: 'literal',
        value: t.value,
        vtype: t.float
          ? t.suffix?.includes('f')
            ? 'float'
            : 'double'
          : t.suffix?.includes('u')
            ? t.suffix.includes('l')
              ? 'ulong'
              : 'uint'
            : t.suffix?.includes('l')
              ? 'long'
              : 'int?',
        line: t.line,
      };
    }
    if (t.kind === 'str') {
      this.i++;
      return {type: 'literal', value: t.value, vtype: 'String', line: t.line};
    }
    if (t.kind === 'chr') {
      this.i++;
      return {type: 'literal', value: t.value, vtype: 'char', line: t.line};
    }
    if (t.kind === 'id') {
      if (TYPE_WORDS.has(t.value) && this.peek().value === '(') {
        const {type} = this.typeSpec();
        this.need('(');
        const args = this.args();
        if (type === 'String') return {type: 'call', name: 'String', args, line: t.line};
        if (args.length !== 1) this.err('A function-style cast takes one value');
        return {type: 'cast', vtype: type, value: args[0], line: t.line};
      }
      let name = this.id();
      while (this.is('.') && this.peek().kind === 'id') {
        this.i++;
        name += '.' + this.id();
      }
      if (this.take('(')) {
        return {type: 'call', name, args: this.args(), line: t.line};
      }
      return {type: 'variable', name, line: t.line};
    }
    this.err(`Unexpected token “${t.value}”. Pointers, structs, classes and lambdas are unsupported.`);
  }
}
