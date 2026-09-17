// 14 — تكبير عند الدخول: الصورة تدخل بمقياس أكبر وترتاح على 1.
import prefs from './prefs.js';

export default {
  name: 'zoom-in',
  init(node, o = {}) {
    if (prefs.reduced) return;
    const from = 1 + prefs.scale(0.16, o.intensity ?? 1);
    node.style.setProperty('--zoom-from', String(from));
    node.classList.add('fx-zoom');

    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      node.classList.add('is-in');
      io.disconnect();
    }, { threshold: 0.15 });
    io.observe(node);
    node.__zoom = io;
  },
  destroy(node) {
    node.__zoom?.disconnect();
    node.classList.remove('fx-zoom', 'is-in');
    node.style.removeProperty('--zoom-from');
    delete node.__zoom;
  },
};
