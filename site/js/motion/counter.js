// 13 — عدّاد تصاعدي: الرقم يعدّ من صفر عند دخوله الشاشة.
import loop from './loop.js';
import prefs from './prefs.js';

const DURATION = 1.4;   // ثانية

export default {
  name: 'counter',
  init(node, o = {}) {
    const target = Number(node.dataset.fxTo ?? node.textContent.replace(/\D/g, '')) || 0;
    const suffix = node.dataset.fxSuffix || '';
    if (prefs.reduced) { node.textContent = target + suffix; return; }

    node.textContent = '0' + suffix;
    let stop = null;

    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      let t = 0;
      const dur = DURATION / Math.max(0.2, o.intensity ?? 1);
      stop = loop.add((dt) => {
        t += dt;
        const p = Math.min(1, t / dur);
        const eased = 1 - Math.pow(1 - p, 3);          // easeOutCubic
        node.textContent = Math.round(target * eased) + suffix;
        if (p === 1) { stop(); stop = null; }
      });
    }, { threshold: 0.4 });

    io.observe(node);
    node.__counter = () => { io.disconnect(); stop?.(); };
  },
  destroy(node) { node.__counter?.(); delete node.__counter; },
};
