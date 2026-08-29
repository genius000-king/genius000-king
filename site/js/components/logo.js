// logo.js — الشعار في كل مكان. مصدر واحد للمسار والنسب.
import { el } from '../core/dom.js';

export const LOGO_SRC = 'assets/img/logo.png';

export function logoImg({ size = 34, cls = '', alt = 'aboal3z.dzn' } = {}) {
  return el('img', {
    class: cls, src: LOGO_SRC, alt,
    width: size, height: size,
    loading: 'eager', decoding: 'async',
  });
}

/**
 * بلاطة الشعار بالجسيمات: لوحة رسم تتجمّع فيها النقاط لتكوّن الشعار،
 * وخلفها صورة عادية تظهر إن تعذّر تشغيل المؤثر.
 */
export function logoParticleTile() {
  return el('div', { class: 'hero__logo-tile glass glass--tinted t--third-tall' }, [
    el('canvas', {
      class: 'hero__logo-canvas',
      'data-fx': 'logo-particles',
      'data-fx-src': LOGO_SRC,
      'aria-hidden': 'true',
    }),
    el('img', { class: 'hero__logo-img', src: LOGO_SRC, alt: 'شعار aboal3z.dzn',
      width: '190', height: '190', decoding: 'async' }),
  ]);
}
