// Pre-render illustrations to PNG for the 3D phone screens: node scripts/render-art.mjs
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';

const NAMES = ['desert-boy', 'concert', 'neon', 'skate-smoke', 'sneakers-jump', 'skate-stairs'];
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const browserExecutable = process.env.REMOTION_BROWSER ?? null;
fs.mkdirSync('public/art', {recursive: true});
for (const name of NAMES) {
  const inputProps = {name};
  const composition = await selectComposition({serveUrl, id: 'ArtGallery', inputProps, browserExecutable});
  await renderStill({serveUrl, composition, inputProps, output: `public/art/${name}.png`, frame: 0, imageFormat: 'png', browserExecutable, overwrite: true});
  console.log('art', name);
}
