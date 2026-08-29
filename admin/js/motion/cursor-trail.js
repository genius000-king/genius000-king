// 8 — ذيل الضوء: نقاط متلاشية خلف المؤشر.
import loop from './loop.js';
import prefs from './prefs.js';
import { el, on } from '../core/dom.js';

const MAX = 14;

export default {
  name: 'cursor-trail',
  init(host, o = {}) {
    if (prefs.touch || prefs.reduced) return;

    const wrap = el('div', { class: 'cursor__trail', 'aria-hidden': 'true' });
    const dots = Array.from({ length: Math.round(prefs.scale(MAX, o.intensity ?? 1)) || 1 },
      () => { const d = el('i'); wrap.append(d); return { node: d, x: 0, y: 0 }; });
    document.body.append(wrap);

    let px = innerWidth / 2, py = innerHeight / 2;
    const move = (e) => { px = e.clientX; py = e.clientY; };

    const tick = () => {
      let x = px, y = py;
      dots.forEach((d, i) => {
        d.x += (x - d.x) * 0.32;
        d.y += (y - d.y) * 0.32;
        d.node.style.translate = `${d.x}px ${d.y}px`;
        d.node.style.opacity = String(1 - i / dots.length);
        d.node.style.scale = String(1 - (i / dots.length) * 0.7);
        x = d.x; y = d.y;
      });
    };

    host.__trail = { wrap, off: [on(window, 'pointermove', move, { passive: true }), loop.add(tick)] };
  },
  destroy(host) {
    const t = host.__trail;
    if (!t) return;
    t.off.forEach((f) => f());
    t.wrap.remove();
    delete host.__trail;
  },
};
