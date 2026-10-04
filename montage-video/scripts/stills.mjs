// Render many stills with one bundle: node scripts/stills.mjs out/name.jpg 3.2 10.5 ...
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const [sheet, ...times] = process.argv.slice(2);
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const browserExecutable = process.env.REMOTION_BROWSER ?? null;
const composition = await selectComposition({serveUrl, id: 'Montage', browserExecutable});
fs.mkdirSync('out/stills', {recursive: true});
const files = [];
for (const t of times) {
  const output = `out/stills/${t}.jpg`;
  await renderStill({serveUrl, composition, output, frame: Math.round(Number(t) * 30), imageFormat: 'jpeg', scale: 0.5, browserExecutable, overwrite: true});
  files.push(output);
}
execFileSync('python3', ['scripts/sheet.py', sheet, ...files]);
console.log('wrote', sheet);
