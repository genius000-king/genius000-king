// order — بلاطة الدعوة للطلب. الزر يفتح المعالج في لوحة زجاجية.
import { el, on } from '../core/dom.js';
import { content } from '../core/store.js';
import { openPanel } from '../core/panel.js';
import { icon } from '../components/icon.js';
import { applyEditable } from '../components/editable.js';

/** يفتح معالج الطلب. `preset` يملأ بنداً مسبقاً (من لوحة البكج مثلاً). */
export function openOrder(preset) {
  return openPanel('order', () => import('../panels/order-wizard.js'), { preset });
}

export function mount(root, opts = {}) {
  root.replaceChildren(
    el('div', { class: 'bento bento--flow' }, [
      el('div', { class: 'card order glass glass--strong t--full', 'data-edit-id': 'order.band',
        'data-fx': 'reveal3d glow' }, [
        el('h2', { class: 'order__title', 'data-edit-id': 'order.title' },
          [content('order_title', 'جاهز نبدأ؟')]),
        el('p', { class: 'order__sub', 'data-edit-id': 'order.sub' },
          [content('order_sub', 'أرسل طلبك وخلّ الباقي علينا.')]),
        el('button', { class: 'btn btn--primary btn--lg', type: 'button',
          'data-edit-id': 'order.cta', 'data-fx': 'magnetic',
          onclick: () => openOrder() },
          [content('order_cta', 'اطلب الآن'), icon('arrow', { size: 18 })]),
      ]),
    ]),
  );

  // أزرار الناف والهيرو تنادي المعالج عبر هذا الحدث
  if (!root.__orderBound) {
    root.__orderBound = on(document, 'order:open', (e) => openOrder(e.detail?.preset));
  }

  applyEditable(root, opts);
}
