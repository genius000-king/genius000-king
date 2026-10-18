// Lists the members of each top-level class with their size.
import fs from 'node:fs';
import {parse} from '@babel/parser';
const [file, ...names] = process.argv.slice(2),
  src = fs.readFileSync(file, 'utf8'),
  ast = parse(src, {sourceType: 'module', plugins: ['jsx']});
for (const n of ast.program.body) {
  const d = n.declaration ?? n;
  if (d.type !== 'ClassDeclaration' || (names.length && !names.includes(d.id.name))) continue;
  console.log('class', d.id.name);
  console.log(
    '  ' +
      d.body.body
        .map(m => `${m.kind === 'get' ? 'get ' : ''}${m.key.name ?? m.key.value}:${m.end - m.start}`)
        .join('  ')
  );
}
