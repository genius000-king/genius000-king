// logo.js — مصدر واحد لشعار اللوحة.
import { el } from '../core/dom.js';
export const LOGO_SRC = 'assets/img/logo.png';
export function logoImg(size = 32, cls = '') {
  // صندوق مربّع مع contain — الشعار غير مربّع فيتوسّط بلا تشوّه
  return el('img', { class: cls, src: LOGO_SRC, alt: 'aboal3z.dzn',
    style: 'object-fit:contain',
    width: size, height: size, decoding: 'async' });
}
