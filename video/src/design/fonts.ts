import {staticFile, continueRender, delayRender} from 'remotion';

/**
 * Fonts are loaded from `public/` rather than a CDN: a render that reaches out
 * to the network mid-frame is a render that can silently fall back to a system
 * font on frame 9,412 and ruin a three-hour job.
 */
const WEIGHTS = [400, 500, 600, 700] as const;

let started = false;

export const loadFonts = () => {
  if (started || typeof document === 'undefined') return;
  started = true;

  const handle = delayRender('Loading IBM Plex Sans Arabic');

  Promise.all(
    WEIGHTS.map((weight) => {
      const face = new FontFace(
        'IBM Plex Sans Arabic',
        `url(${staticFile(`fonts/plex-arabic-${weight}.woff2`)}) format('woff2')`,
        {weight: String(weight), style: 'normal', display: 'block'}
      );
      return face.load().then((loaded) => {
        (document.fonts as unknown as {add: (f: FontFace) => void}).add(loaded);
      });
    })
  )
    .then(() => continueRender(handle))
    .catch((err) => {
      // Never leave the renderer hanging on a font; a wrong glyph beats a hang.
      console.error('Font load failed', err);
      continueRender(handle);
    });
};
