// testimonials — شريط آراء متحرك. ⚠️ النصوص الحالية تجريبية وتُستبدل من اللوحة.
import { el, published } from '../core/dom.js';
import { get, content } from '../core/store.js';
import { icon } from '../components/icon.js';
import { sectionHead } from '../components/head.js';
import { applyEditable } from '../components/editable.js';

function stars(rating = 5) {
  const n = Math.max(1, Math.min(5, Number(rating) || 5));
  return el('span', { class: 'stars', role: 'img', 'aria-label': `تقييم ${n} من 5` },
    Array.from({ length: 5 }, (_, i) => {
      const s = icon('star', { size: 15, filled: i < n });
      s.classList.add(i < n ? 'star--on' : 'star--off');
      return s;
    }));
}

function card(t) {
  return el('article', {
    class: 'card review', 'data-edit-id': `testimonial.card.${t.id}`,
    'data-fx': 'tilt shine',
  }, [
    stars(t.rating),
    el('p', { class: 'review__text' }, [t.text || '']),
    el('footer', { class: 'review__by' }, [
      el('strong', {}, [t.name || '']),
      t.role ? el('span', { class: 'review__role' }, [t.role]) : null,
    ]),
  ]);
}

export function mount(root, opts = {}) {
  const list = published(get('testimonials'));
  root.replaceChildren(
    sectionHead('testimonials', content('testimonials_title'), content('testimonials_sub')),
    el('div', { class: 'bleed' }, [
      el('div', { class: 'marquee', 'data-fx': 'marquee', 'data-fx-speed': '18',
        'data-fx-dir': '-1', 'data-cursor': 'اسحب' },
        [el('div', { class: 'marquee__track' }, list.map(card))]),
    ]),
  );

  applyEditable(root, opts);
}
