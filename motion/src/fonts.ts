// Fonts are self-hosted in public/fonts (see scripts/fetch-fonts.sh), so renders work offline and are reproducible.
import {continueRender, delayRender, staticFile} from 'remotion';

export const F = {
  amiri: 'Amiri',
  archivo: 'Archivo Black',
  cairo: 'Cairo',
  cormorant: 'Cormorant Garamond',
  cormorantItalic: 'Cormorant Garamond',
  inter: 'Inter',
  mono: 'JetBrains Mono',
  lalezar: 'Lalezar',
  script: 'Mr Dafoe',
  orbitron: 'Orbitron',
  pixel: '"Press Start 2P"',
  kufi: 'Reem Kufi',
  grotesk: 'Space Grotesk',
  vt: 'VT323',
};

const FACES = [
  'normal 400 1em Amiri', 'normal 700 1em Amiri', 'normal 400 1em "Archivo Black"', 'normal 400 1em Cairo',
  'normal 700 1em Cairo', 'normal 900 1em Cairo', 'normal 300 1em "Cormorant Garamond"', 'normal 500 1em "Cormorant Garamond"',
  'italic 300 1em "Cormorant Garamond"', 'normal 300 1em Inter', 'normal 500 1em Inter', 'normal 800 1em Inter',
  'normal 400 1em "JetBrains Mono"', 'normal 700 1em "JetBrains Mono"', 'normal 400 1em Lalezar', 'normal 400 1em "Mr Dafoe"',
  'normal 900 1em Orbitron', 'normal 400 1em "Press Start 2P"', 'normal 700 1em "Reem Kufi"', 'normal 400 1em "Space Grotesk"',
  'normal 700 1em "Space Grotesk"', 'normal 400 1em VT323',
];

if (typeof document !== 'undefined' && !document.getElementById('local-fonts')) {
  const handle = delayRender('Loading local fonts');
  const link = document.createElement('link');
  link.id = 'local-fonts';
  link.rel = 'stylesheet';
  link.href = staticFile('fonts/fonts.css');
  link.onload = () =>
    Promise.all(FACES.map((f) => document.fonts.load(f, 'Aa0 عربي'))).then(
      () => continueRender(handle),
      () => continueRender(handle),
    );
  link.onerror = () => continueRender(handle);
  document.head.appendChild(link);
}
