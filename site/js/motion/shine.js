// 25 — بريق زجاجي: ضوء يتبع المؤشر داخل البطاقة (التنفيذ البصري في cards.css).
import { on } from '../core/dom.js';
import prefs from './prefs.js';

export default {
  name: 'shine',
  init(node) {
    if (prefs.touch) return;
    const move = (e) => {
      const r = node.getBoundingClientRect();
      node.style.setProperty('--mx', `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`);
      node.style.setProperty('--my', `${((e.clientY - r.top) / r.height * 100).toFixed(1)}%`);
    };
    node.__shine = [on(node, 'pointermove', move, { passive: true })];
  },
  destroy(node) {
    (node.__shine || []).forEach((f) => f());
    node.style.removeProperty('--mx');
    node.style.removeProperty('--my');
    delete node.__shine;
  },
};
