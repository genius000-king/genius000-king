// Lists identifiers that are used but defined nowhere (not even as browser globals): the mistakes a
// mechanical move between modules makes. Usage: node tools/check-unbound.mjs $(git ls-files "*.js" "*.jsx")
import fs from 'node:fs';
import {parse} from '@babel/parser';
import tm from '@babel/traverse';
const traverse = tm.default ?? tm;
const globals = new Set(
  Object.getOwnPropertyNames(globalThis).concat([
    'document',
    'window',
    'navigator',
    'performance',
    'location',
    'localStorage',
    'sessionStorage',
    'requestAnimationFrame',
    'devicePixelRatio',
    'HTMLCanvasElement',
    'OffscreenCanvas',
    'Image',
    'self',
    'postMessage',
    'onmessage',
    'undefined',
    'structuredClone',
    'getComputedStyle',
    'ResizeObserver',
    'AudioContext',
    'alert',
    'confirm',
    'Worker',
    'process',
  ])
);
for (const f of process.argv.slice(2)) {
  const ast = parse(fs.readFileSync(f, 'utf8'), {sourceType: 'module', plugins: ['jsx']});
  traverse(ast, {
    Identifier(p) {
      if (p.isReferencedIdentifier() && !p.scope.hasBinding(p.node.name) && !globals.has(p.node.name))
        console.log(f + ':' + p.node.loc.start.line, p.node.name);
    },
    JSXIdentifier(p) {
      if (/^[A-Z]/.test(p.node.name) && p.isReferencedIdentifier() && !p.scope.hasBinding(p.node.name))
        console.log(f + ':' + p.node.loc.start.line, p.node.name);
    },
  });
}
