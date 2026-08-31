// logo.js — الشعار في كل مكان. مصدر واحد للمسار والنسب.
import { el } from '../core/dom.js';

export const LOGO_SRC = 'assets/img/logo.png';

export function logoImg({ size = 34, cls = '', alt = 'aboal3z.dzn', eager = false } = {}) {
  return el('img', {
    class: cls, src: LOGO_SRC, alt,
    // صندوق مربّع مع contain — الشعار غير مربّع فيتوسّط بلا تشوّه
    style: 'object-fit:contain',
    width: size, height: size,
    loading: eager ? 'eager' : 'lazy',
    fetchpriority: eager ? 'high' : null,
    decoding: 'async',
    draggable: 'false',
  });
}

/**
 * علامة الشعار الكبيرة.
 *
 * الصورة هي الحالة الطبيعية، والجسيمات *انتقال* لا شكل دائم — و
 * الانتقال بينهما متدرّج تماماً (انظر motion/logo-mark.js).
 * لوحة الرسم أوسع من الصورة عمداً حتى تخرج الجسيمات بلا قصّ.
 */
export function logoMark() {
  return el('div', {
    class: 'logo-mark', 'data-fx': 'logo-mark',
    role: 'img', 'aria-label': 'شعار aboal3z.dzn — يتفاعل مع السحب',
  }, [
    el('img', {
      class: 'logo-mark__img', src: LOGO_SRC, alt: '',
      width: '922', height: '614',
      loading: 'eager', fetchpriority: 'high', decoding: 'async', draggable: 'false',
    }),
    el('canvas', { class: 'logo-mark__fx', 'aria-hidden': 'true' }),
  ]);
}
