import {CompileError} from './errors.js';
import {LIBRARIES} from './language.js';

export function lex(source, {defines = {}} = {}) {
  let i = 0,
    line = 1,
    lineStart = true;
  const out = [],
    macros = new Map(
      Object.entries(defines).map(([k, v]) => [
        k,
        [{kind: 'num', value: v, line: 0, float: !Number.isInteger(v)}],
      ])
    ),
    cond = [];
  const skipping = () => cond.some(c => !c.active);
  const push = (t, depth = 0) => {
    if (t.kind === 'id' && macros.has(t.value) && depth < 20) {
      for (const m of macros.get(t.value)) push({...m, line: t.line}, depth + 1);
      return;
    }
    out.push(t);
  };
  const lexLine = text => {
    const sub = lex(text, {});
    sub.pop();
    return sub;
  };
  while (i < source.length) {
    let c = source[i];
    if (c === '\n') {
      line++;
      i++;
      lineStart = true;
      continue;
    }
    if (c === '\\' && source[i + 1] === '\n') {
      i += 2;
      line++;
      continue;
    }
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (source.startsWith('//', i)) {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (source.startsWith('/*', i)) {
      const start = line;
      i += 2;
      while (i < source.length && !source.startsWith('*/', i)) {
        if (source[i++] === '\n') line++;
      }
      if (i >= source.length) throw new CompileError('Unterminated comment', start);
      i += 2;
      continue;
    }
    if (c === '#' && lineStart) {
      let d = '';
      while (i < source.length && source[i] !== '\n') {
        if (source[i] === '\\' && source[i + 1] === '\n') {
          i += 2;
          line++;
          continue;
        }
        d += source[i++];
      }
      d = d
        .replace(/\/\/.*$/, '')
        .replace(/\/\*.*?\*\//g, '')
        .trim();
      const [, word = '', rest = ''] = /^#\s*(\w*)\s*(.*)$/.exec(d) ?? [];
      if (['ifdef', 'ifndef'].includes(word)) {
        const has = macros.has(rest.trim());
        cond.push({active: word === 'ifdef' ? has : !has, taken: false});
        cond.at(-1).taken = cond.at(-1).active;
        continue;
      }
      if (word === 'if') {
        const v = rest.trim().replace(/defined\s*\(?\s*(\w+)\s*\)?/g, (_, n) => (macros.has(n) ? '1' : '0'));
        const val = /^\d+$/.test(v)
          ? Number(v) !== 0
          : macros.has(v)
            ? Number(macros.get(v)[0]?.value) !== 0
            : false;
        cond.push({active: val, taken: val});
        continue;
      }
      if (word === 'else' || word === 'elif') {
        const top = cond.at(-1);
        if (!top) throw new CompileError('#else without #if', line);
        top.active = !top.taken;
        top.taken = true;
        continue;
      }
      if (word === 'endif') {
        if (!cond.pop()) throw new CompileError('#endif without #if', line);
        continue;
      }
      if (skipping()) continue;
      if (word === 'include') {
        const h = /[<"]([^>"]+)[>"]/.exec(rest)?.[1];
        if (!h || !LIBRARIES.includes(h))
          throw new CompileError(
            `Library “${h ?? rest}” is not installed in Circuit Lab. Available: ${LIBRARIES.join(', ')}.`,
            line
          );
        continue;
      }
      if (word === 'define') {
        const m = /^([A-Za-z_]\w*)(\()?\s*(.*)$/.exec(rest);
        if (!m) throw new CompileError('Malformed #define', line);
        if (m[2])
          throw new CompileError(
            `Function-like macro ${m[1]}() is unsupported. Write a function instead.`,
            line
          );
        macros.set(m[1], m[3] ? lexLine(m[3]) : []);
        continue;
      }
      if (word === 'undef') {
        macros.delete(rest.trim());
        continue;
      }
      if (word === 'pragma') continue;
      if (word === 'error') throw new CompileError('#error ' + rest, line);
      throw new CompileError(`Unsupported preprocessor directive #${word}`, line);
    }
    lineStart = false;
    if (skipping()) {
      i++;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let s = '';
      while (i < source.length && /\w/.test(source[i])) s += source[i++];
      if (/^B[01]{1,8}$/.test(s) && !macros.has(s)) {
        push({kind: 'num', value: parseInt(s.slice(1), 2), line});
        continue;
      }
      push({kind: 'id', value: s, line});
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(source[i + 1]))) {
      let s = '',
        float = false;
      if (/^0[xX]/.test(source.slice(i, i + 2))) {
        s = source.slice(i, i + 2);
        i += 2;
        while (/[0-9a-fA-F']/.test(source[i] ?? '')) s += source[i++];
      } else if (/^0[bB][01]/.test(source.slice(i, i + 3))) {
        i += 2;
        let b = '';
        while (/[01']/.test(source[i] ?? '')) b += source[i++];
        s = String(parseInt(b.replace(/'/g, ''), 2));
      } else {
        while (/[0-9.']/.test(source[i] ?? '')) s += source[i++];
        if (/[eE]/.test(source[i] ?? '') && /[-+0-9]/.test(source[i + 1] ?? '')) {
          s += source[i++];
          if (/[-+]/.test(source[i])) s += source[i++];
          while (/[0-9]/.test(source[i] ?? '')) s += source[i++];
          float = true;
        }
        if (s.includes('.')) float = true;
      }
      let suffix = '';
      while (/[uUlLfF]/.test(source[i] ?? '')) suffix += source[i++].toLowerCase();
      if (suffix.includes('f')) float = true;
      s = s.replace(/'/g, '');
      const value = Number(s);
      if (!Number.isFinite(value)) throw new CompileError('Invalid number ' + s, line);
      push({kind: 'num', value, line, float, suffix});
      continue;
    }
    if (c === '"') {
      const start = line;
      let s = '';
      i++;
      while (i < source.length && source[i] !== '"') {
        if (source[i] === '\n') throw new CompileError('Unterminated string', start);
        if (source[i] === '\\') {
          i++;
          const e = source[i++];
          if (e === 'x') {
            let h = '';
            while (/[0-9a-fA-F]/.test(source[i] ?? '') && h.length < 2) h += source[i++];
            s += String.fromCharCode(parseInt(h, 16));
          } else s += {n: '\n', t: '\t', r: '\r', 0: '\0'}[e] ?? e;
        } else s += source[i++];
      }
      if (i >= source.length) throw new CompileError('Unterminated string', start);
      i++;
      const last = out.at(-1);
      if (last?.kind === 'str') last.value += s;
      else push({kind: 'str', value: s, line});
      continue;
    }
    if (c === "'") {
      i++;
      let ch = source[i++];
      if (ch === '\\') {
        const e = source[i++];
        ch = {n: '\n', t: '\t', r: '\r', 0: '\0'}[e] ?? e;
      }
      if (source[i] !== "'") throw new CompileError('Character literal must contain one character', line);
      i++;
      push({kind: 'chr', value: ch.charCodeAt(0), line});
      continue;
    }
    const three = source.slice(i, i + 3);
    if (['<<=', '>>='].includes(three)) {
      push({kind: 'op', value: three, line});
      i += 3;
      continue;
    }
    const two = source.slice(i, i + 2);
    if (
      [
        '==',
        '!=',
        '<=',
        '>=',
        '&&',
        '||',
        '++',
        '--',
        '+=',
        '-=',
        '*=',
        '/=',
        '%=',
        '&=',
        '|=',
        '^=',
        '<<',
        '>>',
        '->',
        '::',
      ].includes(two)
    ) {
      if (two === '->' || two === '::')
        throw new CompileError(
          `“${two}” is unsupported: pointers, namespaces and classes are outside the Lab subset.`,
          line
        );
      push({kind: 'op', value: two, line});
      i += 2;
      continue;
    }
    if ('{}()[],;.+-*/%!=<>?:&|^~'.includes(c)) {
      push({kind: 'op', value: c, line});
      i++;
      continue;
    }
    throw new CompileError(`Unexpected character ${c}`, line);
  }
  if (cond.length) throw new CompileError('Missing #endif', line);
  out.push({kind: 'eof', value: 'EOF', line});
  return out;
}
