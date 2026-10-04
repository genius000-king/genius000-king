import {continueRender, delayRender, staticFile} from 'remotion';
import list from './font-list.json';

export const F = {
  cairo: 'Cairo',
  amiri: 'Amiri',
  lalezar: 'Lalezar',
  plex: 'IBM Plex Sans Arabic',
  readex: 'Readex Pro',
  mono: 'Space Mono',
  type: 'Special Elite',
  serif: 'Cormorant Garamond',
} as const;

const handle = delayRender('Loading fonts');
Promise.all(
  list.map((f) =>
    new FontFace(f.family, `url(${staticFile(f.file)})`, {weight: f.weight})
      .load()
      .then((face) => document.fonts.add(face)),
  ),
)
  .then(() => continueRender(handle))
  .catch((err) => {
    console.error(err);
    continueRender(handle);
  });
