// Renders every composition to out/<id>.mp4 and a still preview to out/stills/<id>.jpg.
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';

const only = process.argv.slice(2);
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), publicDir: path.resolve('public')});
const ids = ['01-Euler', '02-Fourier', '03-Terminal', '04-Neural', '05-Lorenz', '06-Manifesto', '07-Pendulums', '08-Synthwave', '09-Life', '10-Golden'];

for (const id of ids.filter((i) => !only.length || only.some((o) => i.startsWith(o)))) {
  const composition = await selectComposition({serveUrl, id});
  const t0 = Date.now();
  await renderMedia({composition, serveUrl, codec: 'h264', crf: 18, outputLocation: `out/${id}.mp4`, concurrency: 4, imageFormat: 'jpeg', jpegQuality: 92});
  console.log(`${id}: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
