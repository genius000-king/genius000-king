// icon.js — أيقونات SVG مضمّنة. ❌ لا إيموجي كأيقونات.
import { el, svgEl } from '../core/dom.js';

const PATHS = {
  poster:   'M4 3h16v18H4zM8 8h8M8 12h8M8 16h4',
  logo:     'M12 3l2.6 5.6L21 9.3l-4.5 4.3 1.1 6.2L12 16.9 6.4 19.8l1.1-6.2L3 9.3l6.4-.7z',
  identity: 'M3 5h18v14H3zM7 9h4v6H7zM14 10h4M14 14h4',
  social:   'M4 5h16v11H8l-4 4z',
  banner:   'M3 7h18v10H3zM3 12h18',
  book:     'M4 4h11a3 3 0 013 3v13H7a3 3 0 01-3-3zM7 4v13',
  brush:    'M4 20s1-4 4-4 3 2 5 0 3-6 3-6M14 10l6-6 2 2-6 6',
  sparkle:  'M12 3l1.8 4.4L18 9l-4.2 1.6L12 15l-1.8-4.4L6 9l4.2-1.6z',
  arrow:    'M5 12h14M13 6l6 6-6 6',
  arrowDown:'M12 5v14M6 13l6 6 6-6',
  check:    'M4 12.5l5 5L20 6.5',
  whatsapp: 'M20 12a8 8 0 01-11.9 7L4 20l1-4.1A8 8 0 1120 12zM9 9.5c0 3 2.5 5.5 5.5 5.5l1-1-1.8-1-.9.9a4.6 4.6 0 01-2.7-2.7l.9-.9-1-1.8z',
  instagram:'M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4zM12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM17.5 6.5h.01',
  x:        'M4 4l16 16M20 4L4 20',
  email:    'M3 6h18v12H3zM3 7l9 6 9-6',
  star:     'M12 3.5l2.5 5.3 5.5.7-4 3.9 1 5.6-5-2.8-5 2.8 1-5.6-4-3.9 5.5-.7z',
  menu:     'M4 7h16M4 12h16M4 17h16',
  close:    'M6 6l12 12M18 6L6 18',
  plus:     'M12 5v14M5 12h14',
  minus:    'M5 12h14',
  up:       'M12 19V5M6 11l6-6 6 6',
  upload:   'M12 16V4M7 9l5-5 5 5M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2',
  image:    'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6',
  trash:    'M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13',
  pencil:   'M4 20l4-1 11-11-3-3L5 16z',
  drag:     'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
  copy:     'M8 8h11v11H8zM5 16V5h11',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5',
};

export function icon(name, { size = 20, filled = false, stroke = 1.6 } = {}) {
  const d = PATHS[name];
  if (!d) return null;
  return svgEl('svg', {
    viewBox: '0 0 24 24', width: size, height: size,
    fill: filled ? 'currentColor' : 'none',
    stroke: filled ? 'none' : 'currentColor',
    'stroke-width': stroke, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    'aria-hidden': 'true', focusable: 'false',
  }, [svgEl('path', { d })]);
}

export function iconOr(name, fallback = '✦') {
  return icon(name) || el('span', { 'aria-hidden': 'true' }, [fallback]);
}

export function hasIcon(name) { return Boolean(PATHS[name]); }
export function iconNames() { return Object.keys(PATHS); }
