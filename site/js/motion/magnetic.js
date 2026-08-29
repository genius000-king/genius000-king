// 2 — الانجذاب المغناطيسي: العنصر يُزاح نحو المؤشر ويرجع بنابض.
import loop from './loop.js';
import prefs from './prefs.js';
import { on } from '../core/dom.js';

const REACH = 90;      // نطاق التأثير بالبكسل خارج حدود العنصر
const PULL = 0.34;     // نسبة الإزاحة من المسافة

export default {
  name: 'magnetic',
  noTouch: true,
  init(node, o = {}) {
    if (prefs.touch || prefs.reduced) return;

    const pull = PULL * (o.intensity ?? 1);
    const s = { tx: 0, ty: 0, x: 0, y: 0, active: false };

    const move = (e) => {
      const r = node.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = e.clientX - cx, dy = e.clientY - cy;
      const near = Math.abs(dx) < r.width / 2 + REACH && Math.abs(dy) < r.height / 2 + REACH;
      s.active = near;
      s.tx = near ? dx * pull : 0;
      s.ty = near ? dy * pull : 0;
    };

    const tick = () => {
      s.x += (s.tx - s.x) * 0.18;      // تخميد نابضي
      s.y += (s.ty - s.y) * 0.18;
      if (Math.abs(s.x) < 0.05 && Math.abs(s.y) < 0.05 && !s.active) {
        node.style.removeProperty('--dx'); node.style.removeProperty('--dy');
        return;
      }
      node.style.setProperty('--dx', `${s.x.toFixed(2)}px`);
      node.style.setProperty('--dy', `${s.y.toFixed(2)}px`);
    };

    node.__magnetic = [on(window, 'pointermove', move, { passive: true }), loop.add(tick)];
  },
  destroy(node) {
    (node.__magnetic || []).forEach((f) => f());
    node.style.removeProperty('--dx');
    node.style.removeProperty('--dy');
    delete node.__magnetic;
  },
};
