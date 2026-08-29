// 15 — تفكيك النص: كل وحدة تدخل منفردة بتأخير متتابع.
// ⚠️ العربية متصلة الحروف — تفكيكها حرفاً حرفاً يكسر الشكل.
//    لذلك: العربية تُفكَّك بالكلمة، واللاتينية بالحرف.
import prefs from './prefs.js';

const ARABIC = /[؀-ۿ]/;
const STEP = 55;

export default {
  name: 'split-text',
  init(node, o = {}) {
    const text = node.textContent.trim();
    if (!text || node.__splitDone) return;

    const byWord = ARABIC.test(text);
    const units = byWord ? text.split(/(\s+)/) : [...text];
    node.__splitOriginal = text;
    node.setAttribute('aria-label', text);            // القارئ الصوتي يقرأ النص كاملاً
    node.textContent = '';

    const step = prefs.reduced ? 0 : prefs.scale(STEP, o.intensity ?? 1);
    let i = 0;
    for (const unit of units) {
      if (/^\s+$/.test(unit)) { node.append(unit); continue; }
      const span = document.createElement('span');
      span.className = 'fx-split__unit';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = unit;
      span.style.setProperty('--split-delay', `${Math.round(i++ * step)}ms`);
      node.append(span);
    }
    node.classList.add('fx-split');
    node.__splitDone = true;

    if (prefs.reduced) { node.classList.add('is-in'); return; }
    const io = new IntersectionObserver((e) => {
      if (!e[0].isIntersecting) return;
      node.classList.add('is-in');
      io.disconnect();
    }, { threshold: 0.2 });
    io.observe(node);
    node.__split = io;
  },
  destroy(node) {
    node.__split?.disconnect();
    if (node.__splitOriginal) node.textContent = node.__splitOriginal;
    node.classList.remove('fx-split', 'is-in');
    node.removeAttribute('aria-label');
    delete node.__split; delete node.__splitDone; delete node.__splitOriginal;
  },
};
