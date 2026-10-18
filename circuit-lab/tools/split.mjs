// Splits the legacy flat modules in src/ into the engine layout described by a plan file.
// Every top-level declaration (or class method group / object property group) is moved verbatim;
// imports are recomputed from scope analysis, so each new file imports exactly what it uses.
// Usage: node tools/split.mjs tools/split-plan.mjs
import fs from 'node:fs';
import path from 'node:path';
import {parse} from '@babel/parser';
import traverseModule from '@babel/traverse';
const traverse = traverseModule.default ?? traverseModule;

const root = process.cwd();
const plan = (await import(path.resolve(process.argv[2]))).default;
const rel = (from, to) => {let r = path.relative(path.dirname(from), to).split(path.sep).join('/');return r.startsWith('.') ? r : './' + r;};
const abs = p => path.resolve(root, p);

// ---------------------------------------------------------------- 1. parse every planned file
const files = new Map(); // abs src -> {src, ast, imports, units}
for (const [srcFile, spec] of Object.entries(plan.files)) {
 const file = abs(srcFile), src = fs.readFileSync(file, 'utf8');
 const ast = parse(src, {sourceType: 'module', plugins: ['jsx']});
 files.set(file, {file, src, ast, spec, imports: new Map(), reexports: new Map(), sideEffects: [], units: []});
}

// ---------------------------------------------------------------- 2. units and symbol table
const symbols = new Map(); // `${absSrc}#${name}` -> target abs path (or {alias})
const symKey = (f, n) => `${f}#${n}`;
for (const info of files.values()) {
 const {ast, src, spec, file} = info, target = name => abs(spec.targets?.[name] ?? spec.default);
 for (const node of ast.program.body) {
  if (node.type === 'ImportDeclaration') {
   if (!node.specifiers.length) {info.sideEffects.push(node.source.value);continue;}
   for (const s of node.specifiers) info.imports.set(s.local.name, {source: node.source.value, imported: s.type === 'ImportDefaultSpecifier' ? 'default' : s.type === 'ImportNamespaceSpecifier' ? '*' : s.imported.name ?? s.imported.value});
   continue;
  }
  if (node.type === 'ExportNamedDeclaration' && !node.declaration) { // export {a} [from 'x']
   for (const s of node.specifiers) {const exported = s.exported.name, local = s.local.name;
    if (node.source) info.reexports.set(exported, {source: node.source.value, imported: local});
    else if (local !== exported) info.reexports.set(exported, {local});}
   continue;
  }
  const decl = node.type.startsWith('Export') && node.declaration ? node.declaration : node;
  const isDefault = node.type === 'ExportDefaultDeclaration';
  if (decl.type === 'VariableDeclaration') {
   for (const d of decl.declarations) {
    const name = d.id.name, cls = spec.objects?.[name];
    if (cls) {info.units.push({kind: 'object', name, node: d, decl, spec: cls});continue;}
    info.units.push({kind: 'var', name, node: d, keyword: decl.kind, target: target(name), names: [name]});
   }
  } else if (decl.type === 'ClassDeclaration' && spec.classes?.[decl.id.name]) {
   info.units.push({kind: 'class', name: decl.id.name, node: decl, spec: spec.classes[decl.id.name]});
  } else if (decl.id) {
   const name = decl.id.name;info.units.push({kind: 'decl', name, node: decl, target: target(name), names: [name], isDefault});
  } else if (isDefault) {
   info.units.push({kind: 'default', name: 'default', node: decl, target: target('default'), names: ['default'], isDefault: true});
  } else {
   info.units.push({kind: 'stmt', name: null, node, names: []}); // target decided after refs
  }
 }
 for (const u of info.units) {
  if (u.kind === 'class') {
   symbols.set(symKey(file, u.name), abs(u.spec.core));
  } else if (u.kind === 'object') {
   symbols.set(symKey(file, u.name), abs(u.spec.index));
  } else for (const n of u.names) symbols.set(symKey(file, n), u.target);
 }
}
for (const info of files.values()) for (const [exp, r] of info.reexports) {
 if (r.source) symbols.set(symKey(info.file, exp), {alias: {from: info.file, source: r.source, imported: r.imported}});
}

// ---------------------------------------------------------------- 3. references per unit (scope aware)
const unitAt = (info, pos) => info.units.find(u => pos >= u.node.start && pos < u.node.end) ?? info.units.find(u => u.decl && pos >= u.decl.start && pos < u.decl.end);
for (const info of files.values()) {
 for (const u of info.units) u.refs = new Map(); // subunit key -> Set(names)
 traverse(info.ast, {
  'Identifier|JSXIdentifier'(p) {
   if (!p.isReferencedIdentifier() && !(p.isJSXIdentifier() && p.parentPath.isJSXOpeningElement() || p.isJSXIdentifier() && p.parentPath.isJSXClosingElement() || p.isJSXIdentifier() && p.parentPath.isJSXMemberExpression() && p.parent.object === p.node)) return;
   const name = p.node.name, binding = p.scope.getBinding(name);
   if (!binding || binding.scope.block.type !== 'Program') return;
   const u = unitAt(info, p.node.start);if (!u) return;
   let sub = '';
   if (u.kind === 'class') {const m = u.node.body.body.find(m => p.node.start >= m.start && p.node.start < m.end);sub = m ? memberGroup(u, m) : u.spec.core;}
   if (u.kind === 'object') {const prop = u.node.init.properties.find(q => p.node.start >= q.start && p.node.start < q.end);sub = prop ? propGroup(u, prop) : u.spec.index;}
   if (!u.refs.has(sub)) u.refs.set(sub, new Set());
   u.refs.get(sub).add(name);
   // writes to top-level bindings must stay in the defining module (ESM imports are read-only)
   if (binding.kind !== 'module' && (p.parentPath.isAssignmentExpression({left: p.node}) || p.parentPath.isUpdateExpression())) {u.writes ??= new Set();u.writes.add(name);}
  }
 });
 for (const u of info.units) if (u.kind === 'stmt') { // statements follow the binding they touch first
  const names = [...(u.refs.get('') ?? [])].filter(n => !info.imports.has(n));
  const owner = names.map(n => symbols.get(symKey(info.file, n))).find(Boolean);
  u.target = typeof owner === 'string' ? owner : abs(info.spec.default);
 }
}
function memberName(m) {return m.key.name ?? m.key.value;}
function memberGroup(u, m) {const name = memberName(m);for (const [file, list] of Object.entries(u.spec.groups ?? {})) if (list.includes(name)) return file;return u.spec.core;}
function propName(q) {return q.type === 'SpreadElement' ? '...' : q.key.name ?? q.key.value;}
function propGroup(u, q) {const name = propName(q);for (const [file, list] of Object.entries(u.spec.groups ?? {})) if (list === '*' || list.includes(name)) return file;return u.spec.rest ?? Object.keys(u.spec.groups)[0];}

// ---------------------------------------------------------------- 4. emit target files
const out = new Map(); // abs target -> {chunks:[], needs:Map(name->src file), defines:Set, sideEffects:Set}
const bucket = t => {if (!out.has(t)) out.set(t, {chunks: [], needs: new Map(), defines: new Set(), sideEffects: new Set(), imports: []});return out.get(t);};
const groupVar = (file, suffix) => path.basename(file, '.js').replace(/[-.](\w)/g, (_, c) => c.toUpperCase()) + suffix;
for (const info of files.values()) {
 const text = n => info.src.slice(n.start, n.end);
 for (const s of info.sideEffects) if (info.spec.sideEffects !== false) bucket(abs(info.spec.default)).sideEffects.add(resolveSource(info.file, s, abs(info.spec.default)));
 for (const u of info.units) {
  const need = (b, sub) => {for (const n of u.refs.get(sub) ?? []) b.needs.set(n, info.file);};
  if (u.kind === 'var') {const b = bucket(u.target);b.chunks.push(`export ${u.keyword} ${text(u.node)};`);b.defines.add(u.name);need(b, '');}
  else if (u.kind === 'decl' || u.kind === 'default') {const b = bucket(u.target);b.chunks.push((u.isDefault ? 'export default ' : 'export ') + text(u.node));b.defines.add(u.isDefault ? 'default' : u.name);need(b, '');}
  else if (u.kind === 'stmt') {const b = bucket(u.target);b.chunks.push(text(u.node));need(b, '');}
  else if (u.kind === 'class') {
   const core = abs(u.spec.core), b = bucket(core), groups = Object.keys(u.spec.groups ?? {});
   const coreMembers = u.node.body.body.filter(m => memberGroup(u, m) === u.spec.core).map(text);
   const sup = u.node.superClass ? ` extends ${text(u.node.superClass)}` : '';
   b.chunks.push(`export class ${u.name}${sup} {\n${coreMembers.join('\n')}\n}`);b.defines.add(u.name);need(b, u.spec.core);need(b, '');
   if (groups.length) {
    const vars = groups.map(g => groupVar(g, 'Methods'));
    b.chunks.push(`mixin(${u.name}, ${vars.join(', ')});`);
    b.needs.set('mixin', '@mixin');
    groups.forEach((g, i) => {
     const gb = bucket(abs(g)), members = u.node.body.body.filter(m => memberGroup(u, m) === g).map(text);
     gb.chunks.push(`// ${u.name} methods: ${u.node.body.body.filter(m => memberGroup(u, m) === g).map(memberName).join(', ')}\nexport const ${vars[i]} = {\n${members.join(',\n')}\n};`);
     gb.defines.add(vars[i]);need(gb, g);
     b.needs.set(vars[i], '@local:' + abs(g));
    });
   }
  } else if (u.kind === 'object') {
   const idx = abs(u.spec.index), b = bucket(idx), props = u.node.init.properties, groups = [...new Set(props.map(q => propGroup(u, q)))];
   const vars = groups.map(g => u.spec.names?.[g] ?? groupVar(g, ''));
   groups.forEach((g, i) => {
    const gb = bucket(abs(g)), mine = props.filter(q => propGroup(u, q) === g);
    gb.chunks.push(`export const ${vars[i]} = {\n${mine.map(text).join(',\n')}\n};`);gb.defines.add(vars[i]);need(gb, g);
    if (!u.spec.lazy) b.needs.set(vars[i], '@local:' + abs(g));
   });
   if (!u.spec.lazy) {b.chunks.push(`export const ${u.name} = {${vars.map(v => '...' + v).join(', ')}};`);b.defines.add(u.name);}
   need(b, u.spec.index);
  }
 }
}

// ---------------------------------------------------------------- 5. resolve imports
function resolveSource(fromSrc, source, target) {
 if (!source.startsWith('.')) return source;
 const absSource = path.resolve(path.dirname(fromSrc), source);
 const moved = plan.moved?.[path.relative(root, absSource)];
 return rel(target, moved ? abs(moved) : absSource);
}
function locate(srcFile, name) { // -> {module (abs or package), imported}
 const info = files.get(srcFile);
 const imp = info?.imports.get(name);
 if (imp) {
  if (!imp.source.startsWith('.')) return {module: imp.source, imported: imp.imported};
  const from = path.resolve(path.dirname(srcFile), imp.source);
  if (files.has(from) && imp.imported !== 'default' && imp.imported !== '*') return locate(from, imp.imported);
  if (files.has(from) && imp.imported === 'default') {const d = symbols.get(symKey(from, 'default'));if (d) return {module: d, imported: 'default'};}
  const moved = plan.moved?.[path.relative(root, from)];
  return {module: moved ? abs(moved) : from, imported: imp.imported, raw: true};
 }
 const s = symbols.get(symKey(srcFile, name));
 if (typeof s === 'string') return {module: s, imported: name};
 if (s?.alias) {const from = path.resolve(path.dirname(s.alias.from), s.alias.source);return files.has(from) ? locate(from, s.alias.imported) : {module: from, imported: s.alias.imported};}
 throw Error(`Cannot locate ${name} from ${path.relative(root, srcFile)}`);
}
for (const [target, b] of out) {
 const byModule = new Map();
 for (const [name, origin] of b.needs) {
  if (b.defines.has(name)) continue;
  let loc;
  if (origin === '@mixin') loc = {module: abs(plan.mixin), imported: 'mixin'};
  else if (origin.startsWith('@local:')) loc = {module: origin.slice(7), imported: name};
  else loc = locate(origin, name);
  if (loc.module === target) continue;
  const spec = loc.module.startsWith('/') ? rel(target, loc.module) : loc.module;
  if (!byModule.has(spec)) byModule.set(spec, []);
  byModule.get(spec).push(loc.imported === name ? name : loc.imported === 'default' ? {default: name} : loc.imported === '*' ? {ns: name} : `${loc.imported} as ${name}`);
 }
 const lines = [];
 for (const [spec, names] of [...byModule].sort(([a], [b]) => (a.startsWith('.') - b.startsWith('.')) || a.localeCompare(b))) {
  const def = names.find(n => n.default), ns = names.find(n => n.ns), named = names.filter(n => typeof n === 'string');
  const parts = [def?.default, ns && `* as ${ns.ns}`, named.length && `{${[...new Set(named)].join(', ')}}`].filter(Boolean);
  lines.push(`import ${parts.join(', ')} from '${spec}';`);
 }
 for (const s of b.sideEffects) lines.push(`import '${s}';`);
 const header = plan.headers?.[path.relative(root, target)] ?? '';
 fs.mkdirSync(path.dirname(target), {recursive: true});
 fs.writeFileSync(target, (header ? header.trim() + '\n' : '') + lines.join('\n') + (lines.length ? '\n\n' : '') + b.chunks.join('\n\n') + '\n');
}

// ---------------------------------------------------------------- 6. read-only import check
for (const info of files.values()) for (const u of info.units) for (const w of u.writes ?? []) {
 const owner = symbols.get(symKey(info.file, w)), here = u.target ?? abs(u.spec?.core ?? u.spec?.index ?? '');
 if (typeof owner === 'string' && owner !== here && u.kind !== 'class' && u.kind !== 'object') console.warn(`WARNING: ${u.name} writes ${w}, which lives in ${path.relative(root, owner)}`);
}
console.log([...out.keys()].map(t => path.relative(root, t)).sort().join('\n'));
