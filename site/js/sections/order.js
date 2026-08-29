// order — شريط الدعوة للطلب. الزر يفتح المعالج في لوحة زجاجية.
import { el, on } from '../core/dom.js';
import { content } from '../core/store.js';
import { openPanel } from '../core/panel.js';
import { icon } from '../components/icon.js';
import { applyEditable } from '../components/editable.js';

export function openOrder() {
  return openPanel('order', () => import('../panels/order-wizard.js'));
}

export function mount(root, opts = {}) {
  root.replaceChildren(
    el('div', { class: 'bento' }, [
      el('div', { class: 'card order', 'data-edit-id': 'order.band',
        'data-fx': 'shine reveal' }, [
        el('h2', { class: 'order__title', 'data-edit-id': 'order.title' }, [content('order_title')]),
        el('p', { class: 'card__text', 'data-edit-id': 'order.sub' }, [content('order_sub')]),
        el('button', { class: 'btn btn--primary btn--block', type: 'button',
          'data-edit-id': 'order.cta', 'data-fx': 'magnetic', onclick: openOrder },
          [content('order_cta'), icon('arrow', { size: 18 })]),
      ]),
    ]),
  );

  // الأزرار في الناف والهيرو تنادي المعالج عبر هذا الحدث
  on(document, 'order:open', openOrder);

  applyEditable(root, opts);
}
