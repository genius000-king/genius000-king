// about — بلاطة تعريف + بلاطة أرقام بعدّاد تصاعدي.
import { el } from '../core/dom.js';
import { content } from '../core/store.js';
import { applyEditable } from '../components/editable.js';

/** يبني الأرقام من مفاتيح stat_N_* — بلا عدد ثابت. */
function stats() {
  const out = [];
  for (let i = 1; ; i++) {
    const value = content(`stat_${i}_value`);
    if (!value) break;
    out.push(el('div', { class: 'stat', 'data-edit-id': `about.stat.${i}` }, [
      el('span', { class: 'stat__value', 'data-fx': 'counter',
        'data-fx-to': String(value).replace(/\D/g, ''), 'data-fx-suffix': '+' }, [value]),
      el('span', { class: 'stat__label' }, [content(`stat_${i}_label`)]),
    ]));
  }
  return out;
}

export function mount(root, opts = {}) {
  const text = content('about_text');
  if (!text && !content('about_title')) { root.replaceChildren(); return; }

  const list = stats();

  root.replaceChildren(
    el('div', { class: 'bento bento--flow', 'data-fx': 'reveal', 'data-fx-children': '.card' }, [
      el('article', { class: `card about glass glass--lift ${list.length ? 't--wide' : 't--full'}`,
        'data-fx': 'shine glass', 'data-edit-id': 'about.card' }, [
        content('about_label')
          ? el('span', { class: 'card__label' }, [content('about_label')]) : null,
        el('h2', { class: 'about__title', 'data-edit-id': 'about.title' }, [content('about_title')]),
        el('p', { class: 'about__text', 'data-edit-id': 'about.text' }, [text]),
      ]),
      list.length
        ? el('article', { class: 'card stats glass glass--lift t--wide',
            'data-fx': 'shine glass', 'data-edit-id': 'about.stats' }, list)
        : null,
    ]),
  );

  applyEditable(root, opts);
}
