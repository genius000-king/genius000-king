// Moves JSX blocks out of one big component into their own component files.
// Every identifier a block uses that belongs to the host component's scope is read from a shared React
// context instead, and every module import it uses is copied to the new file. Imports the host no longer
// uses are removed. Usage: node tools/extract-jsx.mjs tools/workbench-extract-plan.mjs
import fs from 'node:fs';
import path from 'node:path';
import {parse} from '@babel/parser';
import traverseModule from '@babel/traverse';
const traverse = traverseModule.default ?? traverseModule;

const plan = (await import(path.resolve(process.argv[2]))).default;
const hostFile = path.resolve(plan.host),
  dir = path.dirname(hostFile);
const parseJsx = src => parse(src, {sourceType: 'module', plugins: ['jsx']});
let src = fs.readFileSync(hostFile, 'utf8');
const ast = parseJsx(src);

// ---------------------------------------------------------------- locate the host and the blocks
let host;
traverse(ast, {
  FunctionDeclaration(p) {
    if (p.node.id?.name === plan.component) host = p;
  },
});
if (!host) throw Error(`No function ${plan.component}`);
const hostScope = host.scope,
  programScope = host.scope.getProgramParent();

const className = el => {
  const attr = el.openingElement?.attributes.find(a => a.name?.name === 'className');
  const v = attr?.value;
  if (!v) return '';
  if (v.type === 'StringLiteral') return v.value;
  const e = v.expression;
  if (e?.type === 'TemplateLiteral') return e.quasis[0].value.cooked;
  return '';
};
const matches = (p, sel) => {
  if (sel.cls) return p.isJSXElement() && className(p.node).split(' ')[0] === sel.cls;
  const parent = p.parentPath;
  return (
    parent.isLogicalExpression({operator: '&&'}) &&
    parent.node.right === p.node &&
    parent.get('left').isIdentifier({name: sel.cond}) &&
    parent.parentPath.isJSXExpressionContainer()
  );
};
const found = new Map();
host.traverse({
  'JSXElement|JSXFragment'(p) {
    for (const sel of plan.blocks)
      if (matches(p, sel)) {
        if (found.has(sel.name)) throw Error(`${sel.name} matches more than one block`);
        found.set(sel.name, p);
      }
  },
});
for (const sel of plan.blocks) if (!found.has(sel.name)) throw Error(`${sel.name} not found`);
const ranges = [...found.values()].map(p => [p.node.start, p.node.end]);
for (const [a, b] of ranges)
  for (const [c, d] of ranges)
    if (a < c && d <= b) throw Error('Nested blocks are not supported; extract the inner one separately');

// ---------------------------------------------------------------- free names of each block
const importLine = (binding, name, target) => {
  const decl = binding.path.parentPath.node,
    spec = binding.path.node;
  let source = decl.source.value;
  if (source.startsWith('.')) {
    source = path.relative(path.dirname(target), path.resolve(dir, source)).split(path.sep).join('/');
    if (!source.startsWith('.')) source = './' + source;
  }
  if (spec.type === 'ImportDefaultSpecifier') return {source, def: name};
  if (spec.type === 'ImportNamespaceSpecifier') return {source, ns: name};
  const imported = spec.imported.name ?? spec.imported.value;
  return {source, named: imported === name ? name : `${imported} as ${name}`};
};
const shared = new Set(),
  edits = [],
  outputs = [];
for (const sel of plan.blocks) {
  const p = found.get(sel.name),
    target = path.resolve(dir, sel.file ?? `${sel.name}.jsx`);
  const fromHost = new Set(),
    imports = new Map();
  const use = (q, name) => {
    const b = q.scope.getBinding(name);
    if (!b) return;
    if (b.scope === hostScope) fromHost.add(name);
    else if (b.scope === programScope) {
      if (b.kind !== 'module') throw Error(`${sel.name} uses module-level ${name}; move it to a module first`);
      const line = importLine(b, name, target);
      if (!imports.has(line.source)) imports.set(line.source, []);
      imports.get(line.source).push(line);
    }
  };
  const visitor = {
    'Identifier|JSXIdentifier'(q) {
      if (q.isReferencedIdentifier()) use(q, q.node.name);
      const b = q.scope.getBinding(q.node.name);
      if (b?.scope === hostScope && b.constantViolations.some(v => v.isDescendant(p)))
        throw Error(`${sel.name} assigns ${q.node.name}; it would only change its own copy`);
    },
  };
  if (p.isJSXElement()) {
    const name = p.get('openingElement.name');
    if (name.isJSXIdentifier()) use(name, name.node.name);
  }
  p.traverse(visitor);

  // a key on the root stays at the call site, where React needs it
  let text = src.slice(p.node.start, p.node.end),
    keyText = '';
  const key = p.node.openingElement?.attributes.find(a => a.name?.name === 'key');
  if (key) {
    keyText = ' ' + src.slice(key.start, key.end);
    text = src.slice(p.node.start, key.start) + src.slice(key.end, p.node.end);
  }
  edits.push({start: p.node.start, end: p.node.end, text: `<${sel.name}${keyText} />`});
  for (const n of fromHost) shared.add(n);

  const lines = [...imports]
    .sort(([a], [b]) => a.startsWith('.') - b.startsWith('.') || a.localeCompare(b))
    .map(([source, list]) => {
      const def = list.find(l => l.def)?.def,
        ns = list.find(l => l.ns)?.ns,
        named = [...new Set(list.filter(l => l.named).map(l => l.named))];
      const parts = [def, ns && `* as ${ns}`, named.length && `{${named.join(', ')}}`].filter(Boolean);
      return `import ${parts.join(', ')} from '${source}';`;
    });
  const ctx = path.relative(path.dirname(target), path.resolve(dir, plan.context)).split(path.sep).join('/');
  lines.push(`import {useWorkbench} from '${ctx.startsWith('.') ? ctx : './' + ctx}';`);
  const names = [...fromHost].sort();
  outputs.push({
    target,
    text:
      (sel.doc ? `/** ${sel.doc} */\n` : '') +
      lines.join('\n') +
      `\n\nexport default function ${sel.name}() {\n` +
      (names.length ? `  const {${names.join(', ')}} = useWorkbench();\n` : '') +
      `  return (\n${text}\n  );\n}\n`,
  });
}

// ---------------------------------------------------------------- rewrite the host
let ret;
host.get('body').traverse({
  ReturnStatement(p) {
    if (p.getFunctionParent() === host) ret = p;
  },
});
const root = ret.node.argument,
  value = [...shared].sort();
edits.push({start: root.start, end: root.start, text: `<WorkbenchContext.Provider value={workbench}>`});
edits.push({start: root.end, end: root.end, text: `</WorkbenchContext.Provider>`});
edits.push({
  start: ret.node.start,
  end: ret.node.start,
  text: `/* Everything the extracted panels read; see ${plan.context} */\nconst workbench = {${value.join(', ')}};\n`,
});
edits.sort((a, b) => b.start - a.start || b.end - a.end);
for (const e of edits) src = src.slice(0, e.start) + e.text + src.slice(e.end);
const own = plan.blocks
  .map(sel => {
    let r = path.relative(dir, path.resolve(dir, sel.file ?? `${sel.name}.jsx`)).split(path.sep).join('/');
    return `import ${sel.name} from '${r.startsWith('.') ? r : './' + r}';`;
  })
  .join('\n');
const lastImport = [...src.matchAll(/^import .*;$/gm)].pop();
src =
  src.slice(0, lastImport.index + lastImport[0].length) +
  `\nimport {WorkbenchContext} from './${path.relative(dir, path.resolve(dir, plan.context))}';\n` +
  own +
  src.slice(lastImport.index + lastImport[0].length);

// ---------------------------------------------------------------- drop imports nobody uses any more
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
            named = keep.filter(s => s.type === 'ImportSpecifier').map(s => text.slice(s.start, s.end)),
            ns = keep.find(s => s.type === 'ImportNamespaceSpecifier');
          const parts = [
            def && def.local.name,
            ns && `* as ${ns.local.name}`,
            named.length && `{${named.join(', ')}}`,
          ].filter(Boolean);
          line = `import ${parts.join(', ')} from '${decl.node.source.value}';`;
        }
        cuts.push({start: decl.node.start, end: decl.node.end, text: line});
      }
    },
  });
  for (const c of cuts.sort((a, b) => b.start - a.start)) text = text.slice(0, c.start) + c.text + text.slice(c.end);
  return text.replace(/\n{3,}/g, '\n\n');
}
fs.writeFileSync(hostFile, prune(src));
const contextFile = path.resolve(dir, plan.context);
if (!fs.existsSync(contextFile))
  fs.writeFileSync(
    contextFile,
    `// The workbench's state and actions, shared with the panels that render them.\nimport {createContext, useContext} from 'react';\n\nexport const WorkbenchContext = createContext(null);\nexport const useWorkbench = () => useContext(WorkbenchContext);\n`
  );
for (const o of outputs) {
  fs.mkdirSync(path.dirname(o.target), {recursive: true});
  fs.writeFileSync(o.target, prune(o.text));
}
console.log(`extracted ${outputs.length} blocks; the context carries ${value.length} names`);
