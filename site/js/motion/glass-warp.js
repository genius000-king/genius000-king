// 22 — تموّج الزجاج: نبضة قصيرة على اللوحة لحظة فتحها.
import prefs from './prefs.js';

const DURATION = 620;

export default {
  name: 'glass-warp',
  init(node, o = {}) {
    if (prefs.reduced) return;
    node.style.setProperty('--warp', String(o.intensity ?? 1));
    node.classList.add('is-warping');
    node.__warp = setTimeout(() => node.classList.remove('is-warping'), DURATION);
  },
  destroy(node) {
    clearTimeout(node.__warp);
    node.classList.remove('is-warping');
    node.style.removeProperty('--warp');
    delete node.__warp;
  },
};
