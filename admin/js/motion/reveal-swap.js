// 24 — كشف بالمرور: البطاقة تبدّل صورتها الأولى بالثانية.
// إن لم توجد صورة ثانية، لا يفعل شيئاً ولا يكسر شيئاً.
import prefs from './prefs.js';
import { on } from '../core/dom.js';

export default {
  name: 'reveal-swap',
  init(node) {
    if (!node.querySelector('[data-swap]')) return;
    node.classList.add('fx-swap');
    if (prefs.touch) {
      // على اللمس: تبديل عند النقر الأول بدل المرور
      node.__swap = [on(node, 'pointerdown', () => node.classList.toggle('is-swapped'))];
      return;
    }
    node.__swap = [
      on(node, 'pointerenter', () => node.classList.add('is-swapped')),
      on(node, 'pointerleave', () => node.classList.remove('is-swapped')),
      on(node, 'focusin', () => node.classList.add('is-swapped')),
      on(node, 'focusout', () => node.classList.remove('is-swapped')),
    ];
  },
  destroy(node) {
    (node.__swap || []).forEach((f) => f());
    node.classList.remove('fx-swap', 'is-swapped');
    delete node.__swap;
  },
};
