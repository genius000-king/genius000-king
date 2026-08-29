// about — بطاقة تعريفية + بطاقة أرقام بعدّاد تصاعدي.
import { el } from '../core/dom.js';
import { content } from '../core/store.js';
import { applyEditable } from '../components/editable.js';

/** يبني بطاقات الأرقام من مفاتيح stat_N_* — بلا عدد ثابت. */
function stats() {
  const out = [];
  for (let i = 1; ; i++) {
    const value = content(`stat_${i}_value`);
    if (!value) break;
    out.push(el('div', { class: 'stat', 'data-edit-id': `about.stat.${i}` }, [
      el('span', { class: 'stat__value', 'data-fx': 'counter',
        'data-fx-to': value, 'data-fx-suffix': '+' }, [value]),
      el('span', { class: 'stat__label' }, [content(`stat_${i}_label`)]),
    ]));
  }
  return out;
}

export function mount(root, opts = {}) {
  root.replaceChildren(
    el('div', { class: 'bento', 'data-fx': 'reveal', 'data-fx-children': '.card' }, [
      el('article', { class: 'card about', 'data-fx': 'shine gravity',
        'data-edit-id': 'about.card' }, [
        el('span', { class: 'card__label' }, [content('about_label')]),
        el('h2', { class: 'about__title', 'data-edit-id': 'about.title' }, [content('about_title')]),
        el('p', { class: 'card__text', 'data-edit-id': 'about.text' }, [content('about_text')]),
      ]),
      el('article', { class: 'card stats', 'data-fx': 'shine', 'data-edit-id': 'about.stats' },
        stats()),
    ]),
  );

  applyEditable(root, opts);
}
