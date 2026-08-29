// 10 — الظهور بموجات: العناصر تطلع وتتلاشى داخلة بتأخير متتابع.
import prefs from './prefs.js';

const STEP = 70;    // ميلي ثانية بين عنصر وآخر
const observers = new WeakMap();

export default {
  name: 'reveal',
  init(node, o = {}) {
    if (prefs.reduced) { node.classList.add('is-in'); return; }

    const step = prefs.scale(STEP, o.intensity ?? 1);
    const kids = node.dataset.fxChildren
      ? [...node.querySelectorAll(node.dataset.fxChildren)] : [node];
    kids.forEach((k, i) => {
      k.classList.add('fx-reveal');
      k.style.setProperty('--reveal-delay', `${Math.round(i * step)}ms`);
    });

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    kids.forEach((k) => io.observe(k));
    observers.set(node, { io, kids });
  },
  destroy(node) {
    const rec = observers.get(node);
    if (!rec) return;
    rec.io.disconnect();
    rec.kids.forEach((k) => { k.classList.remove('fx-reveal', 'is-in'); k.style.removeProperty('--reveal-delay'); });
    observers.delete(node);
  },
};
