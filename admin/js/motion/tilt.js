// 4 — الميلان ثلاثي الأبعاد حسب موضع المؤشر داخل العنصر.
import prefs from './prefs.js';
import { on } from '../core/dom.js';

const MAX_DEG = 9;

export default {
  name: 'tilt',
  init(node, o = {}) {
    if (prefs.touch || prefs.reduced) return;
    const max = prefs.scale(MAX_DEG, o.intensity ?? 1);

    const move = (e) => {
      const r = node.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      node.style.setProperty('--ry', `${(px * max).toFixed(2)}deg`);
      node.style.setProperty('--rx', `${(-py * max).toFixed(2)}deg`);
    };
    const reset = () => {
      node.style.setProperty('--rx', '0deg');
      node.style.setProperty('--ry', '0deg');
    };

    node.__tilt = [on(node, 'pointermove', move, { passive: true }),
                   on(node, 'pointerleave', reset)];
  },
  destroy(node) {
    (node.__tilt || []).forEach((f) => f());
    node.style.removeProperty('--rx');
    node.style.removeProperty('--ry');
    delete node.__tilt;
  },
};
