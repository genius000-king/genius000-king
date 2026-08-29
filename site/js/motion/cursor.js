// 7 + 9 — المؤشر المخصص: نقطة فورية + حلقة متأخرة بتخميد، وتقرأ ما تحتها.
// أي عنصر يحمل data-cursor="نص" يحوّل الحلقة إلى كلمة.
import loop from './loop.js';
import prefs from './prefs.js';
import { el, on } from '../core/dom.js';

const DAMP = 0.18;          // معامل تخميد الحلقة — كلما صغُر تأخّرت أكثر

export default {
  name: 'cursor',
  init(host, o = {}) {
    if (prefs.touch || prefs.reduced) return;    // بلا معنى على اللمس

    const dot = el('div', { class: 'cursor__dot', 'aria-hidden': 'true' });
    const ring = el('div', { class: 'cursor__ring', 'aria-hidden': 'true' },
      [el('span', { class: 'cursor__label' })]);
    document.body.append(dot, ring);
    document.body.classList.add('has-cursor');

    const label = ring.firstChild;
    const s = { x: innerWidth / 2, y: innerHeight / 2, rx: innerWidth / 2, ry: innerHeight / 2 };
    const damp = DAMP * (o.intensity ?? 1);

    const move = (e) => { s.x = e.clientX; s.y = e.clientY; };

    const over = (e) => {
      const target = e.target.closest?.('[data-cursor], a, button, .card, input, textarea, select');
      const text = target?.dataset?.cursor || '';
      ring.classList.toggle('is-hot', !!target);
      ring.classList.toggle('is-labelled', !!text);
      label.textContent = text;
    };

    const tick = () => {
      s.rx += (s.x - s.rx) * damp;
      s.ry += (s.y - s.ry) * damp;
      dot.style.translate = `${s.x}px ${s.y}px`;
      ring.style.translate = `${s.rx}px ${s.ry}px`;
    };

    host.__cursor = {
      nodes: [dot, ring],
      off: [on(window, 'pointermove', move, { passive: true }),
            on(document, 'pointerover', over, { passive: true }),
            on(document, 'pointerleave', () => { dot.style.opacity = ring.style.opacity = '0'; }),
            on(document, 'pointerenter', () => { dot.style.opacity = ring.style.opacity = ''; }),
            loop.add(tick)],
    };
  },
  destroy(host) {
    const c = host.__cursor;
    if (!c) return;
    c.off.forEach((f) => f());
    c.nodes.forEach((n) => n.remove());
    document.body.classList.remove('has-cursor');
    delete host.__cursor;
  },
};
