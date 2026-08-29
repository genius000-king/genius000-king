// 12 — الخط الذي يرسم نفسه مع التمرير (stroke-dashoffset على مسار SVG).
import loop from './loop.js';
import prefs from './prefs.js';

export default {
  name: 'draw-line',
  init(node, o = {}) {
    const path = node.tagName === 'path' ? node : node.querySelector('path');
    if (!path) return;
    const len = path.getTotalLength();
    path.style.strokeDasharray = String(len);

    if (prefs.reduced) { path.style.strokeDashoffset = '0'; return; }
    path.style.strokeDashoffset = String(len);

    const tick = () => {
      const r = node.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      // التقدّم: من دخول أعلى القسم حتى وصوله منتصف الشاشة
      const p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.3)));
      path.style.strokeDashoffset = String(len * (1 - p * (o.intensity ?? 1)));
    };

    node.__draw = loop.add(tick);
  },
  destroy(node) {
    node.__draw?.();
    delete node.__draw;
  },
};
