// 11 — بارالاكس بالعمق: الطبقة تتحرك بنسبة من التمرير.
import loop from './loop.js';
import prefs from './prefs.js';

export default {
  name: 'parallax',
  init(node, o = {}) {
    if (prefs.reduced) return;
    const depth = prefs.scale(Number(o.depth ?? 0.18), o.intensity ?? 1);
    let last = null;

    const tick = () => {
      const r = node.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;      // خارج الشاشة — لا حساب
      const progress = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
      const y = -(progress * depth * 100);
      if (y === last) return;
      last = y;
      node.style.setProperty('--py', `${y.toFixed(2)}px`);
    };

    node.__parallax = loop.add(tick);
  },
  destroy(node) {
    node.__parallax?.();
    node.style.removeProperty('--py');
    delete node.__parallax;
  },
};
