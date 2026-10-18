// Splits the body of a large React component into custom hooks, one file each.
// All hooks share one object `wb` (the workbench): every hook receives it and returns the names it
// defines, which the component merges into it. Inside a hook, a name defined by a hook called earlier is
// destructured from `wb`; a name defined by a hook called later is read as `wb.name` when the callback
// runs (the tool refuses if such a name would be read during render). Names used by the returned JSX are
// destructured once in the component. Imports are copied per file and pruned in the host.
// Usage: node tools/extract-hooks.mjs tools/workbench-hooks-plan.mjs
import fs from 'node:fs';
import path from 'node:path';
import {parse} from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
const traverse = traverseModule.default ?? traverseModule;

const plan = (await import(path.resolve(process.argv[2]))).default;
const hostFile = path.resolve(plan.host),
  dir = path.dirname(hostFile),
  src = fs.readFileSync(hostFile, 'utf8');
const parseJsx = text => parse(text, {sourceType: 'module', plugins: ['jsx']});
const ast = parseJsx(src);

let host;
traverse(ast, {
  FunctionDeclaration(p) {
    if (p.node.id?.name === plan.component) host = p;
  },
});
const hostScope = host.scope,
  body = host.get('body.body');

// ---------------------------------------------------------------- statements → groups
const groupOfStmt = new Map();
plan.groups.forEach((g, gi) => g.statements.forEach(i => groupOfStmt.set(i, gi)));
const dropped = new Set(plan.drop ?? []),
  ret = body.findIndex(s => s.isReturnStatement());
body.forEach((s, i) => {
  if (i !== ret && !dropped.has(i) && !groupOfStmt.has(i))
    throw Error(`statement ${i} (line ${s.node.loc.start.line}) belongs to no group`);
});
const owner = new Map(); // name -> group index
body.forEach((s, i) => {
  if (!groupOfStmt.has(i)) return;
  for (const name of Object.keys(t.getBindingIdentifiers(s.node, false, true)))
    if (hostScope.getOwnBinding(name)) owner.set(name, groupOfStmt.get(i));
});

const relImport = (source, target) => {
  if (!source.startsWith('.')) return source;
  let r = path.relative(path.dirname(target), path.resolve(dir, source)).split(path.sep).join('/');
  return r.startsWith('.') ? r : './' + r;
};

// ---------------------------------------------------------------- one file per group
const outputs = [];
plan.groups.forEach((g, gi) => {
  const target = path.resolve(dir, g.file),
    early = new Set(),
    imports = new Map(),
    edits = [];
  const stmts = g.statements.map(i => body[i]);
  for (const s of stmts) {
    const visit = q => {
      if (!q.isReferencedIdentifier() && !(q.parentPath.isAssignmentExpression() && q.key === 'left')) return;
      const name = q.node.name,
        b = q.scope.getBinding(name);
      if (!b) return;
      if (b.kind === 'module') {
        const decl = b.path.parentPath.node,
          spec = b.path.node;
        const source = relImport(decl.source.value, target);
        if (!imports.has(source)) imports.set(source, new Set());
        imports
          .get(source)
          .add(
            spec.type === 'ImportDefaultSpecifier'
              ? `default as ${name}`
              : spec.type === 'ImportNamespaceSpecifier'
                ? `* as ${name}`
                : (spec.imported.name ?? spec.imported.value) === name
                  ? name
                  : `${spec.imported.name} as ${name}`
          );
        return;
      }
      if (b.scope !== hostScope) return;
      if (b.kind === 'module' || !owner.has(name))
        throw Error(`${g.name}: ${name} is not owned by any group`);
      const og = owner.get(name);
      if (og === gi) return;
      if (b.constantViolations.some(v => stmts.some(s => v.isDescendant(s))))
        throw Error(`${g.name} assigns ${name}, which ${plan.groups[og].name} owns`);
      if (og < gi) early.add(name);
      else {
        if (q.getFunctionParent() === host)
          throw Error(`${g.name} reads ${name} during render, but ${plan.groups[og].name} runs later`);
        // shorthand {name} must keep its key
        if (q.parentPath.isObjectProperty({shorthand: true}) && q.key === 'value')
          edits.push([q.parent.start, q.parent.end, `${name}: wb.${name}`]);
        else edits.push([q.node.start, q.node.end, `wb.${name}`]);
      }
    };
    s.traverse({Identifier: visit, JSXIdentifier: visit});
  }
  let text = stmts
    .map(s => {
      let piece = src.slice(s.node.start, s.node.end);
      const mine = edits.filter(([a, b]) => a >= s.node.start && b <= s.node.end).sort((x, y) => y[0] - x[0]);
      for (const [a, b, r] of mine)
        piece = piece.slice(0, a - s.node.start) + r + piece.slice(b - s.node.start);
      return piece;
    })
    .join('\n');
  const defined = [...owner].filter(([, o]) => o === gi).map(([n]) => n);
  const lines = [...imports]
    .sort(([a], [b]) => a.startsWith('.') - b.startsWith('.') || a.localeCompare(b))
    .map(([source, set]) => {
      const list = [...set],
        def = list.find(x => x.startsWith('default as '))?.slice(11),
        ns = list.find(x => x.startsWith('* as ')),
        named = list.filter(x => !x.startsWith('default as ') && !x.startsWith('* as '));
      return `import ${[def, ns, named.length && `{${named.sort().join(', ')}}`].filter(Boolean).join(', ')} from '${source}';`;
    });
  const params = g.root ? '' : 'wb';
  const usesWb = /\bwb\./.test(text) || early.size;
  outputs.push({
    target,
    defined,
    text:
      (lines.length ? lines.join('\n') + '\n\n' : '') +
      `/** ${g.doc} */\nexport function ${g.name}(${usesWb && !g.root ? params : ''}) {\n` +
      (early.size ? `  const {${[...early].sort().join(', ')}} = wb;\n` : '') +
      text +
      `\n  return {${defined.join(', ')}};\n}\n`,
  });
});

// ---------------------------------------------------------------- the component itself
const retStmt = body[ret],
  jsxNames = new Set();
retStmt.traverse({
  'Identifier|JSXIdentifier'(q) {
    if (!q.isReferencedIdentifier()) return;
    const b = q.scope.getBinding(q.node.name);
    if (b?.scope === hostScope && owner.has(q.node.name)) jsxNames.add(q.node.name);
  },
});
let retText = src
  .slice(retStmt.node.start, retStmt.node.end)
  .replace(`value={${plan.contextValue}}`, 'value={wb}');
const calls = plan.groups.map((g, gi) => {
  const rel = './' + path.relative(dir, path.resolve(dir, g.file)).split(path.sep).join('/');
  return {g, rel, line: gi === 0 ? `  const wb = ${g.name}();` : `  Object.assign(wb, ${g.name}(wb));`};
});
const newBody =
  `{\n${calls.map(c => c.line).join('\n')}\n` +
  (jsxNames.size ? `  const {${[...jsxNames].sort().join(', ')}} = wb;\n` : '') +
  `  ${retText}\n}`;
let hostText = src.slice(0, host.node.body.start) + newBody + src.slice(host.node.body.end);
const lastImport = [...hostText.matchAll(/^import .*;$/gm)].pop();
hostText =
  hostText.slice(0, lastImport.index + lastImport[0].length) +
  '\n' +
  calls.map(c => `import {${c.g.name}} from '${c.rel.replace(/\.jsx?$/, m => m)}';`).join('\n') +
  hostText.slice(lastImport.index + lastImport[0].length);

function prune(text) {
  const tree = parseJsx(text),
    cuts = [];
  traverse(tree, {
    Program(p) {
      for (const decl of p.get('body')) {
        if (!decl.isImportDeclaration() || !decl.node.specifiers.length) continue;
        const keep = decl.node.specifiers.filter(s => p.scope.getBinding(s.local.name)?.referenced);
        if (keep.length === decl.node.specifiers.length) continue;
        let line = '';
        if (keep.length) {
          const def = keep.find(s => s.type === 'ImportDefaultSpecifier'),
            named = keep.filter(s => s.type === 'ImportSpecifier').map(s => text.slice(s.start, s.end));
          line = `import ${[def?.local.name, named.length && `{${named.join(', ')}}`].filter(Boolean).join(', ')} from '${decl.node.source.value}';`;
        }
        cuts.push([decl.node.start, decl.node.end, line]);
      }
    },
  });
  for (const [a, b, r] of cuts.sort((x, y) => y[0] - x[0])) text = text.slice(0, a) + r + text.slice(b);
  return text.replace(/\n{3,}/g, '\n\n');
}
fs.writeFileSync(hostFile, prune(hostText));
for (const o of outputs) {
  fs.mkdirSync(path.dirname(o.target), {recursive: true});
  fs.writeFileSync(o.target, prune(o.text));
}
console.log(outputs.map(o => `${path.relative(dir, o.target)}: ${o.defined.length} names`).join('\n'));
