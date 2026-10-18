// Splits LabScene.state() (one long loop of `if (ud.part) {...}` blocks) into one updater function
// per part, grouped in modules under engines/render/visuals/. Each updater gets (ud, c, comp, ctx);
// `set(...)` becomes `ctx.set(...)`, `changed = true` becomes `ctx.changed = true` and the whole
// simulation state is `ctx.state`.
// Usage: node tools/split-updaters.mjs
import fs from 'node:fs';
import path from 'node:path';
import {parse} from '@babel/parser';
import traverseModule from '@babel/traverse';
const traverse = traverseModule.default ?? traverseModule;

const host = path.resolve('engines/render/visuals.js'),
  dir = path.resolve('engines/render/visuals'),
  src = fs.readFileSync(host, 'utf8'),
  ast = parse(src, {sourceType: 'module'});
const groups = {
  lights: {
    doc: 'Things that glow: LEDs and their halos, segment and bar displays, lamps, board indicator LEDs.',
    parts: [
      'powerMaterial',
      'ledMaterial',
      'halo',
      'segments',
      'rgbMaterial',
      'bars',
      'tlLeds',
      'buckLed',
      'irLeds',
      'pixels',
      'lamp',
      'boardLeds',
      'pirLed',
      'mqLeds',
      'acLamp',
    ],
  },
  motion: {
    doc: 'Things that move: shafts, cones, horns, armatures, magnets, knobs, and a blown fuse wire.',
    parts: [
      'stepShaft',
      'cone',
      'fuseOk',
      'reedMagnet',
      'slideKnob',
      'acKnob',
      'horn',
      'motorShaft',
      'armature',
    ],
  },
  screens: {
    doc: 'Canvas-textured screens: character LCD, OLED and the instruments’ readouts.',
    parts: ['display'],
  },
};
const groupOf = part => Object.keys(groups).find(g => groups[g].parts.includes(part));

let loop, method;
traverse(ast, {
  ObjectMethod(p) {
    if (p.node.key.name === 'state') method = p;
  },
});
method.traverse({
  ForOfStatement(p) {
    loop ??= p;
  },
});
const hostScope = method.scope;
const out = new Map(),
  order = [],
  cuts = [];
for (const stmt of loop.get('body.body')) {
  if (!stmt.isIfStatement()) continue;
  const test = stmt.get('test');
  const head = test.isLogicalExpression({operator: '&&'}) ? test.get('left') : test;
  if (!head.isMemberExpression() || !head.get('object').isIdentifier({name: 'ud'})) continue;
  const part = head.node.property.name,
    extra = head === test ? null : src.slice(test.node.right.start, test.node.right.end);
  const group = groupOf(part);
  if (!group) throw Error(`no group for ${part}`);
  const edits = [];
  const cons = stmt.get('consequent');
  cons.traverse({
    ThisExpression(q) {
      throw Error(`${part} uses this`);
    },
    Identifier(q) {
      const b = q.scope.getBinding(q.node.name);
      if (!b || b.scope !== hostScope) return;
      if (q.node.name === 'set' && q.isReferencedIdentifier())
        edits.push([q.node.start, q.node.end, 'ctx.set']);
      else if (q.node.name === 'changed') edits.push([q.node.start, q.node.end, 'ctx.changed']);
      else if (q.node.name === 'state' && q.isReferencedIdentifier())
        edits.push([q.node.start, q.node.end, 'ctx.state']);
      else if (q.isReferencedIdentifier()) throw Error(`${part} uses ${q.node.name}`);
    },
  });
  if (cons.isIdentifier() || cons.isExpressionStatement()) {
    /* single statement */
  }
  let body = src.slice(cons.node.start, cons.node.end);
  for (const [s, e, t] of edits.sort((a, b) => b[0] - a[0]))
    body = body.slice(0, s - cons.node.start) + t + body.slice(e - cons.node.start);
  if (cons.isBlockStatement()) body = body.slice(1, -1);
  const uses = name => new RegExp(`\\b${name}\\b`).test(body + (extra ?? ''));
  const args = ['ud', 'c', 'comp', 'ctx'],
    last = Math.max(0, ...args.map((a, i) => (uses(a) ? i : -1)));
  const fn =
    `export function ${part}(${args.slice(0, last + 1).join(', ')}) {\n` +
    (extra ? `if (!(${extra})) return;\n` : '') +
    body +
    `\n}`;
  if (!out.has(group)) out.set(group, []);
  out.get(group).push(fn);
  order.push([part, group]);
  cuts.push([stmt.node.start, stmt.node.end]);
}

// module imports the moved code needs
const imports = [];
for (const [name, b] of Object.entries(method.scope.getProgramParent().bindings))
  if (b.kind === 'module') imports.push([name, b.path.parentPath.node.source.value, b.path.node]);
fs.mkdirSync(dir, {recursive: true});
for (const [group, fns] of out) {
  const text = fns.join('\n\n');
  const lines = imports
    .filter(([name]) => new RegExp(`\\b${name}\\b`).test(text))
    .map(([name, source, spec]) => {
      const from = source.startsWith('.') ? '../' + source.replace(/^\.\//, '') : source;
      return spec.type === 'ImportNamespaceSpecifier'
        ? `import * as ${name} from '${from}';`
        : `import {${name}} from '${from}';`;
    });
  fs.writeFileSync(
    path.join(dir, `${group}.js`),
    `// ${groups[group].doc}\n// Each updater gets the model's userData, the part's simulated state, the component and a context\n// whose set() changes a material value only when it moved (and marks the frame dirty).\n` +
      (lines.length ? lines.join('\n') + '\n\n' : '\n') +
      text +
      '\n'
  );
}
fs.writeFileSync(
  path.join(dir, 'index.js'),
  `// The order is the order the scene applies them in.\n` +
    [...out.keys()].map(g => `import * as ${g} from './${g}.js';`).join('\n') +
    `\n\nexport const UPDATERS = [\n${order.map(([part, g]) => `  ['${part}', ${g}.${part}],`).join('\n')}\n];\n`
);

// the host: drop the blocks, apply the table instead
let text = src;
for (const [s, e] of cuts.sort((a, b) => b[0] - a[0])) text = text.slice(0, s) + text.slice(e);
fs.writeFileSync(host, text);
console.log(`${order.length} updaters in ${out.size} modules`);
