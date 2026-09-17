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
  home:     'M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z',
  inbox:    'M3 13h5l1 3h6l1-3h5M3 13l2.5-8h13L21 13v6a1 1 0 01-1 1H4a1 1 0 01-1-1z',
  package:  'M3 7.5L12 3l9 4.5v9L12 21l-9-4.5zM3 7.5L12 12m0 0l9-4.5M12 12v9',
  list:     'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  palette:  'M12 3a9 9 0 100 18c1.1 0 1.5-.8 1.5-1.5 0-1.3-1-1.6-1-2.5 0-.8.7-1.5 1.5-1.5H16a5 5 0 005-5c0-4-4-7.5-9-7.5zM7.5 12h.01M10 8h.01M15 8h.01',
  layout:   'M3 4h18v16H3zM3 9h18M9 9v11',
  eye:      'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 14a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V20a2 2 0 11-4 0v-.1A1.6 1.6 0 007.9 18l-.1.1A2 2 0 115 15.3l.1-.1A1.6 1.6 0 004 12.6H4a2 2 0 110-4h.1A1.6 1.6 0 005.2 6l-.1-.1A2 2 0 117.9 3.1L8 3.2a1.6 1.6 0 002.7-1.1V2a2 2 0 114 0v.1A1.6 1.6 0 0016.1 3.2l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 001.1 2.7H20a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z',
  logout:   'M9 21H5a1 1 0 01-1-1V4a1 1 0 011-1h4M16 17l5-5-5-5M21 12H9',
  search:   'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
  filter:   'M3 5h18l-7 8v6l-4 2v-8z',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  undo:     'M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-4',
  moon:     'M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z',
  sun:      'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  grid:     'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  refresh:  'M20 11a8 8 0 10-2.3 6.3M20 6v5h-5',
  send:     'M21 3L3 10.5l7 3 3 7z',
  info:     'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8h.01',
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
