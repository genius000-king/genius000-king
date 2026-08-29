// logo.js — الشعار في كل مكان. مصدر واحد للمسار والنسب.
import { el } from '../core/dom.js';

export const LOGO_SRC = 'assets/img/logo.png';

export function logoImg({ size = 34, cls = '', alt = 'aboal3z.dzn', eager = false } = {}) {
  return el('img', {
    class: cls, src: LOGO_SRC, alt,
    width: size, height: size,
    loading: eager ? 'eager' : 'lazy',
    fetchpriority: eager ? 'high' : null,
    decoding: 'async',
  });
}

/**
 * علامة الشعار الكبيرة: صورة حادّة في السكون، وجسيمات عند التفاعل.
 * الصورة هي الحالة الطبيعية — الجسيمات انتقال لا شكل دائم.
 */
export function logoMark() {
  return el('div', { class: 'logo-mark', 'data-fx': 'logo-mark' }, [
    el('img', {
      class: 'logo-mark__img', src: LOGO_SRC, alt: 'شعار aboal3z.dzn',
      width: '577', height: '571',
      loading: 'eager', fetchpriority: 'high', decoding: 'async',
    }),
    el('canvas', { class: 'logo-mark__fx', 'aria-hidden': 'true' }),
  ]);
}
