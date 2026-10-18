// One-off: folds `Object.assign(PART_MODELS, {...})` blocks into the PART_MODELS literal so the
// splitter sees one object whose properties it can distribute by category.
import fs from 'node:fs';
import {parse} from '@babel/parser';
const file = process.argv[2];
let src = fs.readFileSync(file, 'utf8');
const ast = parse(src, {sourceType: 'module', plugins: ['jsx']});
let literal,
  assigns = [];
for (const n of ast.program.body) {
  const d = n.declaration ?? n;
  if (d.type === 'VariableDeclaration')
    for (const x of d.declarations) if (x.id.name === 'PART_MODELS') literal = x.init;
  if (
    n.type === 'ExpressionStatement' &&
    n.expression.callee?.object?.name === 'Object' &&
    n.expression.arguments[0]?.name === 'PART_MODELS'
  )
    assigns.push(n);
}
const extra = assigns
  .map(a => a.expression.arguments[1].properties.map(p => src.slice(p.start, p.end)).join(',\n'))
  .join(',\n');
for (const a of [...assigns].sort((x, y) => y.start - x.start))
  src = src.slice(0, a.start) + src.slice(a.end);
const close = literal.end - 1,
  last = literal.properties.at(-1).end;
src = src.slice(0, last) + ',\n' + extra + src.slice(last, close) + src.slice(close);
fs.writeFileSync(file, src);
console.log('merged', assigns.length, 'block(s)');
