// services — بطاقات الخدمات فوق شبكة متموّجة. `price` حقل نصي حر (لا أسعار).
import { el, published } from '../core/dom.js';
import { get, content } from '../core/store.js';
import { iconOr } from '../components/icon.js';
import { sectionHead } from '../components/head.js';
import { applyEditable } from '../components/editable.js';

function card(s) {
  return el('article', {
    class: 'card service', 'data-edit-id': `service.card.${s.id}`,
    'data-fx': 'tilt shine',
  }, [
    el('span', { class: 'service__icon' }, [iconOr(s.icon, '✦')]),
    el('h3', { class: 'card__title' }, [s.name]),
    el('p', { class: 'card__text' }, [s.description || '']),
    s.price ? el('span', { class: 'service__meta' }, [s.price]) : null,
  ]);
}

export function mount(root, opts = {}) {
  const list = published(get('services'));
  root.replaceChildren(
    el('canvas', { class: 'fx-canvas', 'data-fx': 'grid-ripple', 'aria-hidden': 'true' }),
    sectionHead('services', content('services_title'), content('services_sub')),
    el('div', { class: 'bento grid services__grid', style: { '--cols': '2' },
      'data-fx': 'reveal', 'data-fx-children': '.service' }, list.map(card)),
  );

  applyEditable(root, opts);
}
