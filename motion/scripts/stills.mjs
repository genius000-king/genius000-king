// Quick visual QA: node scripts/stills.mjs 01-Euler:60,200,430 06-Manifesto:40
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';

const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), publicDir: path.resolve('public')});
for (const arg of process.argv.slice(2)) {
  const [id, frames] = arg.split(':');
  const composition = await selectComposition({serveUrl, id});
  for (const frame of frames.split(',').map(Number)) {
    await renderStill({composition, serveUrl, frame, output: `out/stills/${id}-${frame}.jpg`, imageFormat: 'jpeg', jpegQuality: 80});
  }
}
console.log('ok');
