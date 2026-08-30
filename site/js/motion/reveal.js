// reveal — الظهور بموجات، ثنائي أو ثلاثي الأبعاد، مع غبار يتجمّع.
//
// ثلاثة إصلاحات جوهرية عن النسخة السابقة:
//   1. threshold: 0  — العنصر الأطول من نافذة العرض كان لا يبلغ 8% أبداً.
//   2. مؤقّت أمان    — أي عنصر لم يُلاحَظ خلال 1200ms يظهر رغماً عن المراقب.
//   3. فحص فوري      — ما هو ظاهر أصلاً عند التهيئة يظهر بلا انتظار تمرير.
import prefs from './prefs.js';
import { assemble } from './assemble.js';

const STEP = 64;
const SAFETY_MS = 1200;
const observers = new WeakMap();

function make(name, cls) {
  return {
    name,
    init(node, o = {}) {
      const kids = node.dataset.fxChildren
        ? [...node.querySelectorAll(node.dataset.fxChildren)] : [node];
      if (!kids.length) return;

      if (prefs.reduced) { kids.forEach((k) => k.classList.add(cls, 'is-in')); return; }

      const step = prefs.scale(STEP, o.intensity ?? 1);
      kids.forEach((k, i) => {
        k.classList.add(cls);
        k.style.setProperty('--reveal-delay', `${Math.round(i * step)}ms`);
      });

      // الظهور نفسه لم يتغيّر — أُضيف فوقه غبارٌ يتجمّع على موضع
      // البلاطة في اللحظة ذاتها، فتُقرأ كأنها تتشكّل لا كأنها تُكشف.
      // assemble تتولّى بنفسها: تقليل الحركة، السقف، وخارج الشاشة.
      const show = (k) => { k.classList.add('is-in'); assemble(k); };

      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          show(e.target);
          io.unobserve(e.target);
        }
      }, { rootMargin: '0px 0px -6% 0px', threshold: 0 });

      kids.forEach((k) => io.observe(k));

      // شبكة الأمان: لا يبقى محتوى مخفياً لأن المراقب لم يُطلق
      const timer = setTimeout(() => kids.forEach(show), SAFETY_MS);

      observers.set(node, { io, kids, timer });
    },
    destroy(node) {
      const rec = observers.get(node);
      if (!rec) return;
      clearTimeout(rec.timer);
      rec.io.disconnect();
      rec.kids.forEach((k) => {
        k.classList.remove(cls, 'is-in');
        k.style.removeProperty('--reveal-delay');
      });
      observers.delete(node);
    },
  };
}

export const reveal = make('reveal', 'fx-reveal');
export const reveal3d = make('reveal3d', 'fx-reveal3d');
export default reveal;
