// draw-line — يرسم خط الخطوات مع التمرير.
import prefs from './prefs.js';
import { on, throttle } from '../core/dom.js';

export default {
  name: 'draw-line',
  init(node) {
    const path = node.querySelector('path');
    if (!path) return;
    const len = path.getTotalLength ? path.getTotalLength() : 1000;
    path.style.setProperty('--len', len);

    if (prefs.reduced) { path.style.setProperty('--off', 0); return; }
    path.style.setProperty('--off', len);

    const update = throttle(() => {
      const r = node.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height || 1)));
      path.style.setProperty('--off', String(len * (1 - p)));
    }, 60);

    const off = on(window, 'scroll', update, { passive: true });
    update();
    node.__draw = off;
  },
  destroy(node) { node.__draw?.(); delete node.__draw; },
};
