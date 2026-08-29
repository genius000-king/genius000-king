// icon.js — أيقونات SVG مضمّنة. ❌ لا إيموجي كأيقونات (يختلف شكله بين الأنظمة).
// إضافة أيقونة = مدخل واحد في PATHS.
import { el } from '../core/dom.js';

const PATHS = {
  poster: 'M4 3h16v18H4zM8 8h8M8 12h8M8 16h4',
  logo: 'M12 3l2.6 5.6L21 9.3l-4.5 4.3 1.1 6.2L12 16.9 6.4 19.8l1.1-6.2L3 9.3l6.4-.7z',
  identity: 'M3 5h18v14H3zM7 9h4v6H7zM14 10h4M14 14h4',
  social: 'M4 5h16v11H8l-4 4z',
  banner: 'M3 7h18v10H3zM3 12h18',
  book: 'M4 4h11a3 3 0 013 3v13H7a3 3 0 01-3-3zM7 4v13',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  whatsapp: 'M20 12a8 8 0 01-11.9 7L4 20l1-4.1A8 8 0 1120 12zM9 9.5c0 3 2.5 5.5 5.5 5.5l1-1-1.8-1-.9.9a4.6 4.6 0 01-2.7-2.7l.9-.9-1-1.8z',
  instagram: 'M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4zM12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM17.5 6.5h.01',
  star: 'M12 3.5l2.5 5.3 5.5.7-4 3.9 1 5.6-5-2.8-5 2.8 1-5.6-4-3.9 5.5-.7z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  up: 'M12 19V5M6 11l6-6 6 6',
};

/** يعيد عنصر <svg> للأيقونة، أو null إن لم تكن مسجَّلة. */
export function icon(name, { size = 20, filled = false } = {}) {
  const d = PATHS[name];
  if (!d) return null;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', filled ? 'currentColor' : 'none');
  svg.setAttribute('stroke', filled ? 'none' : 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}

/** غلاف يعيد عنصراً دائماً — أيقونة أو حرفاً بديلاً — فلا يترك فراغاً. */
export function iconOr(name, fallback = '') {
  return icon(name) || el('span', { 'aria-hidden': 'true' }, [fallback]);
}
