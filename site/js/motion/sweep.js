// 17 — مسح لوني: ضوء يمرّ عبر النص مرة واحدة عند ظهوره.
// يقرأ لون النص الفعلي ويمرّره للـ CSS، ثم ينظّف نفسه عند انتهاء الحركة —
// حتى لا يبقى النص شفافاً لو تغيّر اللون أو انقطعت الحركة.
import prefs from './prefs.js';
import { on } from '../core/dom.js';

export default {
  name: 'sweep',
  init(node) {
    if (prefs.reduced) return;

    const base = getComputedStyle(node).color;
    node.style.setProperty('--sweep-base', base);

    const done = on(node, 'animationend', (e) => {
      if (e.animationName !== 'sweep') return;
      node.classList.remove('fx-sweep', 'is-sweeping');
    });

    const io = new IntersectionObserver((e) => {
      if (!e[0].isIntersecting) return;
      node.classList.add('fx-sweep', 'is-sweeping');
      io.disconnect();
    }, { threshold: 0.5 });
    io.observe(node);

    node.__sweep = () => { io.disconnect(); done(); };
  },
  destroy(node) {
    node.__sweep?.();
    node.classList.remove('fx-sweep', 'is-sweeping');
    node.style.removeProperty('--sweep-base');
    delete node.__sweep;
  },
};
