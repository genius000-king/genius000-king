// logo.js — مصدر واحد لشعار اللوحة.
import { el } from '../core/dom.js';

export const LOGO_SRC = 'assets/img/logo.png';

export function logoImg(size = 32, cls = '') {
  // صندوق مربّع مع contain — الشعار غير مربّع فيتوسّط بلا تشوّه
  return el('img', {
    class: cls, src: LOGO_SRC, alt: 'aboal3z.dzn',
    style: 'object-fit:contain',
    width: size, height: size, decoding: 'async', draggable: 'false',
  });
}

/**
 * علامة الشعار التفاعلية — نفس محرّك الموقع.
 * تُستعمل في شاشة الدخول: هي أول ما يراه المالك، فتحمل نفس الهوية.
 */
export function logoMark() {
  return el('div', {
    class: 'logo-mark', 'data-fx': 'logo-mark',
    role: 'img', 'aria-label': 'شعار aboal3z.dzn',
  }, [
    el('img', {
      class: 'logo-mark__img', src: LOGO_SRC, alt: '',
      width: '540', height: '448', decoding: 'async', draggable: 'false',
    }),
    el('canvas', { class: 'logo-mark__fx', 'aria-hidden': 'true' }),
  ]);
}
