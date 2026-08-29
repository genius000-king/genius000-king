// 16 — خلط الحروف ثم استقرارها. يستبدل النص كاملاً كل إطار،
// فلا يمسّ وصل الحروف العربية إطلاقاً.
import loop from './loop.js';
import prefs from './prefs.js';

const POOL = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي0123456789';
const RATE = 22;         // حرف يستقر كل هذا العدد من الإطارات ÷ الشدة

export default {
  name: 'scramble',
  init(node, o = {}) {
    const text = node.textContent.trim();
    if (!text) return;
    node.setAttribute('aria-label', text);
    if (prefs.reduced) return;

    node.__scrambleText = text;
    let stop = null;

    const run = () => {
      let frame = 0, settled = 0;
      const speed = RATE / Math.max(0.2, o.intensity ?? 1);
      stop = loop.add(() => {
        frame++;
        if (frame % Math.max(1, Math.round(speed / 8)) === 0) settled++;
        if (settled >= text.length) {
          node.textContent = text;
          stop(); stop = null;
          return;
        }
        let out = text.slice(0, settled);
        for (let i = settled; i < text.length; i++) {
          out += text[i] === ' ' ? ' ' : POOL[(Math.random() * POOL.length) | 0];
        }
        node.textContent = out;
      });
    };

    const io = new IntersectionObserver((e) => {
      if (!e[0].isIntersecting) return;
      io.disconnect(); run();
    }, { threshold: 0.4 });
    io.observe(node);
    node.__scramble = () => { io.disconnect(); stop?.(); };
  },
  destroy(node) {
    node.__scramble?.();
    if (node.__scrambleText) node.textContent = node.__scrambleText;
    node.removeAttribute('aria-label');
    delete node.__scramble; delete node.__scrambleText;
  },
};
