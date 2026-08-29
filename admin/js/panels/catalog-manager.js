// مدير كتالوج بنود الطلب — إضافة وحذف وترتيب ونشر. بلا أسعار (قرار المالك).
import { el, qs, on } from '../core/dom.js';
import { get, setAll } from '../core/store.js';
import { insert, update, remove } from '../core/api.js';
import { confirmModal } from '../core/modal.js';
import { toast } from '../core/toast.js';
import { icon } from '../components/icon.js';
import { makeSortable } from '../core/sortable.js';

let side = null;

function save(id, patch) {
  document.dispatchEvent(new CustomEvent('autosave:state', { detail: { state: 'saving' } }));
  update('order_items', id, patch)
    .then(() => document.dispatchEvent(new CustomEvent('autosave:state', { detail: { state: 'saved' } })))
    .catch(() => document.dispatchEvent(new CustomEvent('autosave:state', { detail: { state: 'error' } })));
}

function draw(list) {
  const rows = get('order_items').slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  list.replaceChildren(...rows.map((it) => el('div', { class: 'mgr__row', 'data-id': it.id }, [
    el('span', { class: 'mgr__handle', 'aria-hidden': 'true' }, ['⠿']),
    el('input', { type: 'text', class: 'field', value: it.name || '', 'aria-label': 'اسم البند',
      oninput: (e) => save(it.id, { name: e.target.value }) }),
    el('input', { type: 'text', class: 'field', value: it.description || '',
      'aria-label': 'وصف البند', placeholder: 'وصف قصير',
      oninput: (e) => save(it.id, { description: e.target.value }) }),
    el('label', { class: 'ctrl--row' }, [
      el('span', { class: 'sr-only' }, ['منشور']),
      el('input', { type: 'checkbox', class: 'ctrl__toggle', checked: it.published !== false,
        'aria-label': `نشر ${it.name}`,
        onchange: (e) => save(it.id, { published: e.target.checked }) }),
    ]),
    el('button', { class: 'btn btn--icon', type: 'button', 'aria-label': `حذف ${it.name}`,
      onclick: async () => {
        if (!await confirmModal({ title: 'حذف البند؟', body: `سيُحذف «${it.name}» من الكتالوج.` })) return;
        await remove('order_items', it.id);
        setAll('order_items', get('order_items').filter((x) => x.id !== it.id));
        toast('حُذف البند', 'success');
        draw(list);
      } }, [icon('close', { size: 16 })]),
  ])));

  makeSortable(list, (ids) => ids.forEach((id, i) => save(id, { sort: i + 1 })));
}

export function openCatalog() {
  if (!side) {
    side = el('div', { class: 'side side--wide', role: 'dialog', 'aria-label': 'كتالوج بنود الطلب' }, [
      el('div', { class: 'side__head' }, [
        el('span', { class: 'side__title' }, ['كتالوج بنود الطلب']),
        el('button', { class: 'btn btn--icon side__close', type: 'button', 'aria-label': 'إغلاق',
          onclick: () => side.classList.remove('is-open') }, [icon('close')]),
      ]),
      el('div', { class: 'side__body' }),
    ]);
    document.body.append(side);
  }

  const list = el('div', { class: 'mgr__list' });
  qs('.side__body', side).replaceChildren(
    el('p', { class: 'side__sub' }, ['هذه البنود تظهر في الخطوة الأولى من معالج الطلب.']),
    el('button', { class: 'btn btn--primary', type: 'button', onclick: async () => {
      const row = await insert('order_items', { name: 'بند جديد', description: '',
        unit_price: '', icon: '', sort: get('order_items').length + 1, published: false });
      setAll('order_items', [...get('order_items'), row]);
      draw(list);
    } }, [icon('plus', { size: 16 }), 'أضف بنداً']),
    list,
  );
  draw(list);
  requestAnimationFrame(() => side.classList.add('is-open'));
}

on(document, 'leader:catalog', openCatalog);
