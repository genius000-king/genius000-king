// Turns the big `switch (name)` of a method into handler tables, one module per family.
// Each case group becomes a method `(a, name)` of its family's table, with `this` unchanged; local
// variables of the host method that a case uses (`prof`, `pin`) are recomputed inside that handler.
// Imports are copied from the host module as needed. Usage: node tools/switch-to-table.mjs <plan.mjs>
import fs from 'node:fs';
import path from 'node:path';
import {parse} from '@babel/parser';
import traverseModule from '@babel/traverse';
const traverse = traverseModule.default ?? traverseModule;

const plan = (await import(path.resolve(process.argv[2]))).default;
const params = plan.params ?? ['a', plan.discriminant], // handler parameters, in order
  key = plan.key ?? plan.discriminant,
  table = plan.table ?? 'API',
  suffix = plan.suffix ?? 'Api';
const hostFile = path.resolve(plan.host),
  src = fs.readFileSync(hostFile, 'utf8'),
  ast = parse(src, {sourceType: 'module'});

let method, sw;
traverse(ast, {
  ObjectMethod(p) {
    if (p.node.key.name === plan.method) method = p;
  },
});
method.traverse({
  SwitchStatement(p) {
    if (!sw && src.slice(p.node.discriminant.start, p.node.discriminant.end) === key) sw = p;
  },
});
if (!sw) throw Error('switch not found');
const hostScope = method.scope;

// ---------------------------------------------------------------- case groups
const groups = [];
let labels = [];
for (const c of sw.get('cases')) {
  if (!c.node.test) continue; // default stays in the dispatcher
  labels.push(c.node.test.value);
  if (!c.node.consequent.length) continue;
  groups.push({labels, cons: c.get('consequent')});
  labels = [];
}
if (labels.length) throw Error(`labels without a body: ${labels}`);

// ---------------------------------------------------------------- per group: free names, imports, text
const local = new Map(); // host-scope variable -> its initialiser text, e.g. prof -> this.profile
for (const [name, b] of Object.entries(hostScope.bindings))
  if (b.kind === 'const' || b.kind === 'let')
    local.set(name, src.slice(b.path.node.init.start, b.path.node.init.end));
const families = new Map();
for (const g of groups) {
  const family = plan.family(g.labels[0]);
  if (!family) throw Error(`no family for ${g.labels[0]}`);
  const uses = new Set(),
    imports = new Map();
  const usedParams = new Set([params[0]]);
  for (const stmt of g.cons) {
    const visit = q => {
      if (!q.isReferencedIdentifier()) return;
      const b = q.scope.getBinding(q.node.name);
      if (!b) return;
      if (b.scope === hostScope) {
        // host locals listed in plan.passLocals travel as arguments; other locals are recomputed
        if (b.kind === 'param' || plan.passLocals?.includes(q.node.name)) usedParams.add(q.node.name);
        else uses.add(q.node.name);
      } else if (b.kind === 'module') {
        const decl = b.path.parentPath.node;
        imports.set(q.node.name, decl.source.value);
      } else if (b.scope.path === sw || b.scope === sw.scope)
        throw Error(`${g.labels[0]} shares ${q.node.name}`);
    };
    if (stmt.isIdentifier()) visit(stmt);
    stmt.traverse({Identifier: visit});
    stmt.traverse({
      BreakStatement(q) {
        if (q.node.label) throw Error(`${g.labels[0]} uses a labelled break`);
        if (q.findParent(p => p.isLoop() || p.isSwitchStatement())?.node === sw.node)
          throw Error(`${g.labels[0]} breaks out of the switch`);
      },
    });
  }
  // a single block statement is unwrapped; anything else is the body as written
  let body =
    g.cons.length === 1 && g.cons[0].isBlockStatement()
      ? src.slice(g.cons[0].node.start + 1, g.cons[0].node.end - 1)
      : g.cons.map(s => src.slice(s.node.start, s.node.end)).join('\n');
  const needs = [...local.keys()].filter(n => uses.has(n));
  for (const n of needs)
    for (const p of params) if (new RegExp(`\\b${p}\\b`).test(local.get(n))) usedParams.add(p);
  const last = Math.max(...[...usedParams].map(p => params.indexOf(p)));
  if (last < 0 || [...usedParams].some(p => !params.includes(p)))
    throw Error(`unknown parameter in ${g.labels[0]}`);
  const head = needs.length
    ? `const ${needs.map(n => `${n} = ${local.get(n).replace(/\ba\b/g, 'a')}`).join(', ')};\n`
    : '';
  const prop = /^[A-Za-z_$][\w$]*$/.test(g.labels[0]) ? g.labels[0] : `'${g.labels[0]}'`;
  if (!families.has(family)) families.set(family, {methods: [], aliases: [], imports: new Map()});
  const f = families.get(family);
  f.methods.push(`${prop}(${params.slice(0, last + 1).join(', ')}) {\n${head}${body}\n}`);
  for (const alias of g.labels.slice(1)) f.aliases.push([alias, g.labels[0]]);
  for (const [n, s] of imports) f.imports.set(n, s);
}

// ---------------------------------------------------------------- write the family modules
const dir = path.resolve(path.dirname(hostFile), plan.dir);
fs.mkdirSync(dir, {recursive: true});
const tableName = f => `${f.replace(/-(\w)/g, (_, c) => c.toUpperCase())}${suffix}`;
const q = s => (/^[A-Za-z_$][\w$]*$/.test(s) ? s : `'${s}'`);
for (const [family, f] of families) {
  const bySource = new Map();
  for (const [n, s] of f.imports) {
    const abs = s.startsWith('.') ? path.resolve(path.dirname(hostFile), s) : s;
    let rel = s.startsWith('.') ? path.relative(dir, abs).split(path.sep).join('/') : s;
    if (s.startsWith('.') && !rel.startsWith('.')) rel = './' + rel;
    (bySource.get(rel) ?? bySource.set(rel, []).get(rel)).push(n);
  }
  const lines = [...bySource].map(([s, ns]) => `import {${ns.sort().join(', ')}} from '${s}';`);
  const doc = plan.docs[family] ?? '';
  let text =
    (lines.length ? lines.join('\n') + '\n\n' : '') +
    `/** ${doc} Called as handler.call(simulator, ${params.join(', ')}). */\n` +
    `export const ${tableName(family)} = {\n${f.methods.join(',\n')}\n};\n`;
  if (f.aliases.length)
    text += `\n// same behaviour, other names\nObject.assign(${tableName(family)}, {${f.aliases
      .map(([alias, of]) => `${q(alias)}: ${tableName(family)}[${JSON.stringify(of)}]`)
      .join(', ')}});\n`;
  fs.writeFileSync(path.join(dir, `${family}.js`), text);
}
const index =
  `// ${plan.title ?? 'Handler tables'}, one module per family. Every handler runs with \`this\` = the Simulator.\n` +
  [...families.keys()].map(f => `import {${tableName(f)}} from './${f}.js';`).join('\n') +
  `\n\nexport const ${table} = {\n${[...families.keys()].map(f => `  ...${tableName(f)},`).join('\n')}\n};\n`;
fs.writeFileSync(path.join(dir, 'index.js'), index);

// ---------------------------------------------------------------- the host keeps only the dispatcher
const def = sw.node.cases.find(c => !c.test);
const fallback = def ? def.consequent.map(s => src.slice(s.start, s.end)).join('\n') : 'return undefined;';
let host =
  src.slice(0, sw.node.start) +
  `const handler = ${table}[${key}];\nif (handler) return handler.call(this, ${params.join(', ')});\n${fallback}` +
  src.slice(sw.node.end);
// drop host-scope variables nobody uses any more and imports that moved away
const rel = path.relative(path.dirname(hostFile), path.join(dir, 'index.js')).split(path.sep).join('/');
host = host.replace(/(\nimport [^\n]*;\n)(?![\s\S]*\nimport )/, `$1import {${table}} from './${rel}';\n`);
fs.writeFileSync(hostFile, host);
console.log(`${groups.length} handlers in ${families.size} families`);
