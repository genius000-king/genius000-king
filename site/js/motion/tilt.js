// tilt — إمالة ثلاثية الأبعاد تتبع المؤشر، مع عمق للطبقات الداخلية.
import prefs from './prefs.js';
import { on } from '../core/dom.js';

const MAX_DEG = 9;

export default {
  name: 'tilt',
  init(node, o = {}) {
    if (prefs.reduced || prefs.touch) return;   // بلا معنى على شاشة لمس
    const max = MAX_DEG * (o.intensity ?? 1);
    let raf = 0;

    const apply = (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = node.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - .5;
        const py = (e.clientY - r.top) / r.height - .5;
        node.style.transform =
          `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) translateZ(0)`;
      });
    };
    const reset = () => {
      cancelAnimationFrame(raf);
      node.classList.remove('is-tilting');
      node.style.transform = '';
    };

    const offs = [
      on(node, 'pointerenter', () => node.classList.add('is-tilting')),
      on(node, 'pointermove', apply, { passive: true }),
      on(node, 'pointerleave', reset),
      on(node, 'blur', reset, true),
    ];
    node.__tilt = { offs, reset };
  },
  destroy(node) {
    node.__tilt?.offs.forEach((f) => f());
    node.__tilt?.reset();
    delete node.__tilt;
  },
};
