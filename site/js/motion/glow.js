// glow — بقعة ضوء تتبع المؤشر داخل الزجاج. الجزء الذي يجعله يبدو مادة.
import prefs from './prefs.js';
import { el, on } from '../core/dom.js';

export default {
  name: 'glow',
  init(node) {
    if (prefs.touch) return;
    node.classList.add('glass--glow');
    let layer = node.querySelector(':scope > .glass__glow');
    if (!layer) { layer = el('span', { class: 'glass__glow', 'aria-hidden': 'true' }); node.prepend(layer); }

    let raf = 0;
    const move = (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = node.getBoundingClientRect();
        node.style.setProperty('--gx', `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`);
        node.style.setProperty('--gy', `${((e.clientY - r.top) / r.height * 100).toFixed(1)}%`);
      });
    };
    const off = on(node, 'pointermove', move, { passive: true });
    node.__glow = { off, layer, raf: () => cancelAnimationFrame(raf) };
  },
  destroy(node) {
    node.__glow?.off();
    node.__glow?.raf();
    node.__glow?.layer.remove();
    node.classList.remove('glass--glow');
    delete node.__glow;
  },
};
