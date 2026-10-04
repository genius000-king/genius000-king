import {continueRender, delayRender, staticFile} from 'remotion';
import list from './font-list.json';

// Arabic: Thmanyah Sans everywhere (weights carry each style's character).
const THM = 'Thmanyah Sans';
export const F = {
  cairo: THM,
  amiri: THM,
  lalezar: 'Thmanyah Display',
  plex: THM,
  readex: THM,
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
