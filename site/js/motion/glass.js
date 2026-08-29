// ============================================================
// glass.js — الطبقة الحيّة من الزجاج.
//
// شيئان لا يستطيع CSS وحده فعلهما:
//   1. بقعة ضوء تتبع المؤشر داخل البلاطة.
//   2. زاوية البريق تدور مع موضع البلاطة من «مصدر الضوء».
//      المصدر ثابت أعلى نافذة العرض؛ فحين تصعد البلاطة مع التمرير
//      تتغيّر زاويتها منه — تماماً كلوح زجاج تحرّكه تحت مصباح.
//
// وتُحقن مرشّحة SVG للانكسار الحقيقي حيث يدعمها المتصفح.
// ============================================================
import prefs from './prefs.js';
import { el, on, throttle } from '../core/dom.js';
import liquid from './liquid-glass.js';

/** زاوية تدرّج CSS من مركز العنصر إلى مصدر ضوء ثابت في نافذة العرض. */
export function rimAngle(rect, vw = innerWidth, vh = innerHeight) {
  const lx = vw * 0.5;
  const ly = -vh * 0.25;                       // المصدر فوق الشاشة بقليل
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const deg = Math.atan2(cy - ly, cx - lx) * (180 / Math.PI);
  // 0deg في CSS = نحو الأعلى؛ نضيف 90 لتحويل زاوية الرياضيات
  return Math.round((deg + 90 + 360) % 360);
}

export default {
  name: 'glass',

  init(node, o = {}) {
    // الانكسار الحقيقي — يتولّاه liquid-glass حيث يدعمه المتصفح
    if (o.lens !== 0 && !prefs.reduced) liquid.init(node, { bezel: o.bezel, blur: o.blur });

    const state = { off: [], unsub: null, raf: 0 };

    /* ── بقعة الضوء ── */
    if (!prefs.touch) {
      node.classList.add('glass--glow');
      let layer = node.querySelector(':scope > .glass__glow');
      if (!layer) {
        layer = el('span', { class: 'glass__glow', 'aria-hidden': 'true' });
        node.prepend(layer);
      }
      state.layer = layer;
      state.off.push(on(node, 'pointermove', (e) => {
        cancelAnimationFrame(state.raf);
        state.raf = requestAnimationFrame(() => {
          const r = node.getBoundingClientRect();
          node.style.setProperty('--gx', `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`);
          node.style.setProperty('--gy', `${((e.clientY - r.top) / r.height * 100).toFixed(1)}%`);
        });
      }, { passive: true }));
    }

    /* ── زاوية البريق مع التمرير ── */
    if (!prefs.reduced) {
      let last = -1;
      const update = throttle(() => {
        const r = node.getBoundingClientRect();
        if (r.bottom < -80 || r.top > innerHeight + 80) return;   // خارج الشاشة
        const a = rimAngle(r);
        if (a === last) return;
        last = a;
        node.style.setProperty('--rim-angle', `${a}deg`);
      }, 90);
      state.off.push(on(window, 'scroll', update, { passive: true }));
      state.off.push(on(window, 'resize', update, { passive: true }));
      update();
      state.update = update;
    }

    node.__glass = state;
  },

  destroy(node) {
    const s = node.__glass;
    if (!s) return;
    cancelAnimationFrame(s.raf);
    liquid.destroy(node);
    s.off.forEach((f) => f());
    s.layer?.remove();
    node.classList.remove('glass--glow');
    node.style.removeProperty('--rim-angle');
    node.style.removeProperty('--gx');
    node.style.removeProperty('--gy');
    delete node.__glass;
  },
};
