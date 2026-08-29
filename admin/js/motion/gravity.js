// 5 — الجاذبية والارتداد: العنصر يسقط ويرتد عند أول ظهور.
import loop from './loop.js';
import prefs from './prefs.js';

const G = 2600;          // بكسل/ث²
const BOUNCE = 0.42;     // معامل الارتداد
const STOP = 22;         // سرعة نعتبر عندها الحركة انتهت

export default {
  name: 'gravity',
  init(node, o = {}) {
    if (prefs.reduced) return;
    const drop = prefs.scale(70, o.intensity ?? 1);
    if (!drop) return;

    node.style.setProperty('--gy', `${-drop}px`);
    let stop = null;

    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      let y = -drop, v = 0;
      stop = loop.add((dt) => {
        v += G * dt;
        y += v * dt;
        if (y >= 0) {                       // لمس الأرض
          y = 0; v = -v * BOUNCE;
          if (Math.abs(v) < STOP) { node.style.setProperty('--gy', '0px'); stop(); stop = null; return; }
        }
        node.style.setProperty('--gy', `${y.toFixed(2)}px`);
      });
    }, { threshold: 0.2 });

    io.observe(node);
    node.__gravity = () => { io.disconnect(); stop?.(); };
  },
  destroy(node) {
    node.__gravity?.();
    node.style.removeProperty('--gy');
    delete node.__gravity;
  },
};
