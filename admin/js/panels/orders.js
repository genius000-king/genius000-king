// درج الطلبات — بحث وفلترة وتصدير CSV وتفاصيل وتغيير حالة.
// قسم لا يظهر في المعاينة لأنه ليس جزءاً من موقع العملاء.
import { el, qs, on, debounce } from '../core/dom.js';
import { get, setAll } from '../core/store.js';
import { update } from '../core/api.js';
import { toast } from '../core/toast.js';
import { icon } from '../components/icon.js';
import { toCSV, download } from './orders-export.js';

const STATUS = [
  ['', 'الكل'], ['new', 'جديد'], ['in_progress', 'قيد التنفيذ'],
  ['done', 'منجز'], ['cancelled', 'ملغي'],
];

let drawer = null;
let filter = { q: '', status: '' };

/** يبثّ عدد غير المقروء ليظهر في شارة شريط الأدوات. */
export function refreshBadge() {
  const count = get('orders').filter((o) => !o.read).length;
  document.dispatchEvent(new CustomEvent('orders:unread', { detail: { count } }));
}

function match(o) {
  if (filter.status && o.status !== filter.status) return false;
  if (!filter.q) return true;
  const hay = `${o.order_number} ${o.name} ${o.contact} ${o.service}`.toLowerCase();
  return hay.includes(filter.q.toLowerCase());
}

function statusPill(o, onChange) {
  return el('select', {
    class: 'pill-select', 'aria-label': `حالة الطلب ${o.order_number}`,
    'data-status': o.status,
    onchange: (e) => onChange(e.target.value),
  }, STATUS.filter(([v]) => v).map(([v, t]) =>
    el('option', { value: v, selected: v === o.status }, [t])));
}

function row(o, rerender) {
  const setStatus = async (status) => {
    try {
      await update('orders', o.id, { status });
      o.status = status;
      setAll('orders', get('orders'));
      toast('تم تحديث الحالة', 'success');
    } catch { toast('تعذّر تحديث الحالة', 'error'); }
  };

  const markRead = async () => {
    if (o.read) return;
    o.read = true;
    await update('orders', o.id, { read: true }).catch(() => {});
    refreshBadge();
    rerender();
  };

  return el('tr', { class: o.read ? '' : 'is-unread' }, [
    el('td', {}, [el('button', { class: 'link', type: 'button',
      onclick: () => { markRead(); openDetail(o); } }, [o.order_number])]),
    el('td', {}, [o.name || '']),
    el('td', {}, [summary(o)]),
    el('td', { class: 'nowrap' }, [new Date(o.created_at || Date.now()).toLocaleDateString('ar')]),
    el('td', {}, [statusPill(o, setStatus)]),
  ]);
}

function summary(o) {
  const items = o.items_json?.items || [];
  const custom = o.items_json?.custom || [];
  const n = [...items, ...custom].reduce((s, i) => s + Number(i.qty || 0), 0);
  return n ? `${items.length + custom.length} بنود · ${n} قطعة` : (o.service || '—');
}

function openDetail(o) {
  const wa = o.contact ? `https://wa.me/${String(o.contact).replace(/\D/g, '')}` : null;
  const box = el('div', { class: 'order-detail' }, [
    el('h3', { class: 'side__title' }, [o.order_number]),
    el('dl', { class: 'review-meta' }, [
      el('dt', {}, ['الاسم']), el('dd', {}, [o.name || '']),
      el('dt', {}, ['التواصل']), el('dd', {}, [`${o.platform || ''} — ${o.contact || ''}`]),
      el('dt', {}, ['الاستخدام']), el('dd', {}, [o.usage || '']),
      el('dt', {}, ['الوصف']), el('dd', {}, [o.description || '']),
    ]),
    el('ul', { class: 'review-list' }, [
      ...(o.items_json?.items || []).map((i) =>
        el('li', {}, [el('span', {}, [i.name]), el('b', {}, [`×${i.qty}`])])),
      ...(o.items_json?.custom || []).map((c) =>
        el('li', {}, [el('span', {}, [`${c.text} (يدوي)`]), el('b', {}, [`×${c.qty}`])])),
    ]),
    o.file_url ? el('a', { class: 'btn', href: o.file_url, target: '_blank', rel: 'noopener' },
      ['فتح الملف المرفق']) : null,
    wa ? el('a', { class: 'btn btn--primary', href: wa, target: '_blank', rel: 'noopener' },
      ['فتح واتساب']) : null,
  ]);
  qs('.side__body', drawer).replaceChildren(
    el('button', { class: 'btn', type: 'button', onclick: () => render() }, ['رجوع للقائمة']),
    box);
}

function render() {
  const rows = get('orders').filter(match);
  const body = qs('.side__body', drawer);

  const search = el('input', { type: 'search', class: 'field', placeholder: 'ابحث…',
    'aria-label': 'بحث في الطلبات', value: filter.q,
    oninput: debounce((e) => { filter.q = e.target.value; render(); }, 250) });

  const filters = el('div', { class: 'ctrl__choices' }, STATUS.map(([v, t]) =>
    el('button', { class: 'ctrl__choice', type: 'button',
      'aria-pressed': String(v === filter.status),
      onclick: () => { filter.status = v; render(); } }, [t])));

  body.replaceChildren(
    el('div', { class: 'orders__tools' }, [
      search, filters,
      el('button', { class: 'btn', type: 'button',
        onclick: () => download('orders.csv', toCSV(rows)) }, ['تصدير CSV']),
    ]),
    rows.length
      ? el('table', { class: 'table' }, [
          el('thead', {}, [el('tr', {}, ['الرقم', 'الاسم', 'الملخص', 'التاريخ', 'الحالة']
            .map((h) => el('th', {}, [h])))]),
          el('tbody', {}, rows.map((o) => row(o, render))),
        ])
      : el('p', { class: 'empty' }, ['لا توجد طلبات مطابقة.']),
  );
}

export function openOrders() {
  if (!drawer) {
    drawer = el('div', { class: 'side side--wide', role: 'dialog', 'aria-label': 'الطلبات' }, [
      el('div', { class: 'side__head' }, [
        el('span', { class: 'side__title' }, ['الطلبات']),
        el('button', { class: 'btn btn--icon side__close', type: 'button',
          'aria-label': 'إغلاق', onclick: closeOrders }, [icon('close')]),
      ]),
      el('div', { class: 'side__body' }),
    ]);
    document.body.append(drawer);
  }
  render();
  requestAnimationFrame(() => drawer.classList.add('is-open'));
}

export function closeOrders() { drawer?.classList.remove('is-open'); }

on(document, 'leader:orders', openOrders);
