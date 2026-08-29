// payments — لوجو فقط لكل طريقة (قرار المالك). عرض بحت: صفر منطق دفع.
import { el, published } from '../core/dom.js';
import { get, content } from '../core/store.js';
import { sectionHead } from '../components/head.js';
import { applyEditable } from '../components/editable.js';

function tile(m) {
  return el('div', { class: 'card pay', 'data-edit-id': `payment.card.${m.id}`,
    'data-fx': 'shine' }, [
    m.logo_url
      ? el('img', { class: 'pay__logo', src: m.logo_url, alt: m.name || '',
          loading: 'lazy', decoding: 'async', width: '120', height: '48' })
      : el('span', { class: 'pay__empty', 'aria-label': m.name || 'طريقة دفع' }, ['—']),
  ]);
}

export function mount(root, opts = {}) {
  const list = published(get('payment_methods'));
  root.replaceChildren(
    sectionHead('payments', content('payments_title'), content('payments_sub')),
    el('div', { class: 'bento grid pay__grid', style: { '--cols': '4' },
      'data-fx': 'reveal', 'data-fx-children': '.pay' }, list.map(tile)),
  );

  applyEditable(root, opts);
}
