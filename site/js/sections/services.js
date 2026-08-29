// services — بلاطات الخدمات: أوّل اثنتين بارزتان، والباقي مربّعات.
import { el, published, emptyState } from '../core/dom.js';
import { get, content, didFail, reload } from '../core/store.js';
import { iconOr } from '../components/icon.js';
import { sectionHead } from '../components/head.js';
import { errorState } from '../core/dom.js';
import { applyEditable } from '../components/editable.js';

function card(s, feature) {
  return el('article', {
    class: `card service glass glass--lift ${feature ? 'service--feature t--wide' : 't--third'}`,
    'data-edit-id': `service.card.${s.id}`,
    'data-fx': 'tilt glow shine',
  }, [
    el('span', { class: 'service__icon' }, [iconOr(s.icon, '✦')]),
    el('h3', { class: 'card__title' }, [s.name]),
    s.description ? el('p', { class: 'card__text' }, [s.description]) : null,
    s.price ? el('span', { class: 'service__meta' }, [s.price]) : null,
  ]);
}

export function mount(root, opts = {}) {
  const head = sectionHead('services', content('services_title'), content('services_sub'), 'ما نقدّمه');

  if (didFail('services')) {
    root.replaceChildren(head, el('div', { class: 'bento bento--flow' }, [
      errorState('تعذّر تحميل الخدمات.', async () => { await reload('services').catch(() => {}); mount(root, opts); }),
    ]));
    return;
  }

  const list = published(get('services'));

  root.replaceChildren(
    head,
    list.length
      ? el('div', { class: 'bento', 'data-fx': 'reveal', 'data-fx-children': '.service' },
          list.map((s, i) => card(s, i < 2)))
      : el('div', { class: 'bento bento--flow' }, [emptyState('لا توجد خدمات منشورة بعد')]),
  );

  applyEditable(root, opts);
}
