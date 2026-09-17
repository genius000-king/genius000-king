// orders.js — الطلبات: بحث، فلترة، تفاصيل، تغيير حالة، رد واتساب، تصدير.
import { el, on, debounce } from '../core/dom.js';
import { get, setAll, reload } from '../core/store.js';
import { update } from '../core/api.js';
import { toast } from '../core/toast.js';
import { icon } from '../ui/icon.js';
import { table, responsiveTable } from '../ui/table.js';
import { openDrawer } from '../ui/drawer.js';
import { badge, tabs, emptyState } from '../ui/fields.js';
import { dateTime, ago, num } from '../core/format.js';
import { go } from '../core/router.js';
import { setBadge } from '../shell/sidebar.js';
import { buildWhatsAppUrl, normalizePhone } from '../core/whatsapp.js';

export const STATUS = [
  ['', 'الكل'], ['new', 'جديد'], ['in_progress', 'قيد التنفيذ'],
  ['done', 'منجز'], ['cancelled', 'ملغي'],
];
export const STATUS_LABEL = Object.fromEntries(STATUS.filter(([v]) => v));

let filter = { q: '', status: '' };
let teardown = null;

export function refreshBadge() {
  setBadge('orders', get('orders').filter((o) => !o.read).length);
}

function match(o) {
  if (filter.status && o.status !== filter.status) return false;
  if (!filter.q) return true;
  const hay = `${o.order_number} ${o.name} ${o.contact} ${o.service} ${o.description}`.toLowerCase();
  return hay.includes(filter.q.toLowerCase());
}

function summary(o) {
  const items = o.items_json?.items || [];
  const custom = o.items_json?.custom || [];
  const n = [...items, ...custom].reduce((s, i) => s + Number(i.qty || 0), 0);
  return n ? `${items.length + custom.length} بنود · ${n} قطعة` : (o.service || '—');
}

async function setStatus(o, status, rerender) {
  const prev = o.status;
  o.status = status;
  rerender();
  try {
    await update('orders', o.id, { status });
    toast('تم تحديث الحالة', 'success');
  } catch (e) {
    o.status = prev;
    rerender();
    toast('تعذّر تحديث الحالة', 'error');
  }
}

async function markRead(o) {
  if (o.read) return;
  o.read = true;
  refreshBadge();
  await update('orders', o.id, { read: true }).catch(() => {});
}

/* ── درج التفاصيل ── */
export function openOrder(o, rerender) {
  markRead(o);
  const phone = normalizePhone(o.contact_normalized || o.contact);
  const items = o.items_json?.items || [];
  const custom = o.items_json?.custom || [];
  const files = Array.isArray(o.attachments) ? o.attachments : [];

  const statusSel = el('select', { class: 'field', 'aria-label': 'حالة الطلب',
    onchange: (e) => setStatus(o, e.target.value, rerender) },
    STATUS.filter(([v]) => v).map(([v, t]) =>
      el('option', { value: v, selected: v === o.status }, [t])));

  const body = el('div', { class: 'stack stack--lg' }, [
    el('div', { class: 'fld' }, [
      el('span', { class: 'fld__label' }, ['الحالة']), statusSel,
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'card__head' }, [el('span', { class: 'card__title' }, ['بيانات العميل'])]),
      el('dl', { class: 'kv' }, [
        el('dt', {}, ['الاسم']),     el('dd', {}, [o.name || '—']),
        el('dt', {}, ['التواصل']),   el('dd', { class: 'mono' }, [o.contact || '—']),
        el('dt', {}, ['المنصة']),    el('dd', {}, [o.platform || '—']),
        el('dt', {}, ['الاستخدام']), el('dd', {}, [o.usage || '—']),
        el('dt', {}, ['التاريخ']),   el('dd', {}, [dateTime(o.created_at)]),
      ]),
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'card__head' }, [el('span', { class: 'card__title' }, ['البنود'])]),
      el('ul', { class: 'stack', style: { gap: '6px' } }, [
        ...items.filter((i) => i.qty > 0).map((i) =>
          el('li', { class: 'kv-row' }, [el('span', { class: 'grow' }, [i.name]), el('b', { class: 'mono' }, [`×${i.qty}`])])),
        ...custom.map((c) =>
          el('li', { class: 'kv-row' }, [el('span', { class: 'grow' }, [`${c.text} (طلب خاص)`]), el('b', { class: 'mono' }, [`×${c.qty}`])])),
      ]),
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'card__head' }, [el('span', { class: 'card__title' }, ['وصف الفكرة'])]),
      el('p', { style: { fontSize: 'var(--a-fs-sm)', color: 'var(--a-text-2)', lineHeight: '1.7' } },
        [o.description || '—']),
    ]),

    files.length ? el('div', { class: 'card' }, [
      el('div', { class: 'card__head' }, [
        el('span', { class: 'card__title grow' }, ['المرفقات']),
        el('span', { class: 'card__hint' }, [num(files.length)]),
      ]),
      el('div', { class: 'media-grid' }, files.map((u) =>
        el('a', { class: 'media', href: u, target: '_blank', rel: 'noopener' },
          [el('img', { src: u, alt: '', loading: 'lazy' })]))),
    ]) : null,
  ]);

  const foot = el('div', { class: 'row grow' }, [
    phone ? el('a', {
      class: 'btn btn--primary grow', target: '_blank', rel: 'noopener',
      href: buildWhatsAppUrl(phone, `مرحباً ${o.name || ''}، بخصوص طلبك ${o.order_number}:`),
    }, [icon('whatsapp', { size: 16 }), 'رد على واتساب']) : null,
    el('button', { class: 'btn', type: 'button',
      onclick: () => { navigator.clipboard?.writeText(o.order_number); toast('نُسخ رقم الطلب', 'success'); } },
      [icon('copy', { size: 15 }), 'نسخ الرقم']),
  ]);

  openDrawer({
    title: o.order_number, sub: `${o.name || ''} · ${ago(o.created_at)}`,
    wide: true, body, foot,
    onClose: () => { go('/orders'); rerender(); },
  });
}

/* ── التصدير ── */
export function toCSV(rows) {
  const cols = ['order_number', 'name', 'contact', 'platform', 'usage', 'status', 'total_units', 'created_at', 'description'];
  const head = ['الرقم', 'الاسم', 'التواصل', 'المنصة', 'الاستخدام', 'الحالة', 'القطع', 'التاريخ', 'الوصف'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  return [head.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n');
}

export function download(name, text) {
  // BOM ضروري وإلا يتشوّه العربي في Excel
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ── العرض ── */
export function render(host, { id } = {}) {
  teardown?.();
  const wrap = el('div');
  const rerender = () => build();

  function build() {
    const rows = get('orders').filter(match)
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    const cols = [
      { key: 'n', label: 'الرقم', primary: true, cls: 'nowrap',
        render: (o) => el('button', { class: 'link', type: 'button',
          onclick: () => go(`/orders/${o.order_number}`) }, [o.order_number]) },
      { key: 'name', label: 'الاسم', render: (o) => el('span', {}, [o.name || '—']) },
      { key: 'sum', label: 'الملخّص', render: (o) => el('span', {}, [summary(o)]) },
      { key: 'date', label: 'التاريخ', cls: 'nowrap', render: (o) => el('span', {}, [ago(o.created_at)]) },
      { key: 'st', label: 'الحالة', cls: 'nowrap',
        render: (o) => badge(o.status || 'new', STATUS_LABEL[o.status] || 'جديد') },
    ];

    const search = el('input', { type: 'search', class: 'field', placeholder: 'ابحث برقم أو اسم أو وصف…',
      'aria-label': 'بحث في الطلبات', value: filter.q,
      oninput: debounce((e) => { filter.q = e.target.value; build(); }, 250) });

    const t = tabs(STATUS, filter.status, (k) => { filter.status = k; build(); });
    const tableHost = el('div');

    wrap.replaceChildren(el('div', { class: 'view' }, [
      el('div', { class: 'view__head' }, [
        el('div', {}, [
          el('h1', { class: 'view__title' }, ['الطلبات']),
          el('p', { class: 'view__sub' }, [`${num(rows.length)} من ${num(get('orders').length)}`]),
        ]),
        el('div', { class: 'view__actions' }, [
          el('button', { class: 'btn', type: 'button',
            onclick: async () => { await reload('orders'); refreshBadge(); build(); toast('حُدِّثت الطلبات', 'success'); } },
            [icon('refresh', { size: 15 }), 'تحديث']),
          el('button', { class: 'btn', type: 'button', disabled: !rows.length,
            onclick: () => download(`orders-${Date.now()}.csv`, toCSV(rows)) },
            [icon('download', { size: 15 }), 'تصدير CSV']),
        ]),
      ]),
      el('div', { class: 'row row--wrap' }, [el('div', { class: 'grow' }, [search]), t.node]),
      tableHost,
    ]));

    teardown = responsiveTable(tableHost, () => rows.length
      ? table(cols, rows, {
          rowClass: (o) => (o.read ? '' : 'is-unread'),
          onRow: (o) => go(`/orders/${o.order_number}`),
        })
      : emptyState(
          filter.q || filter.status ? 'لا طلبات مطابقة' : 'لا توجد طلبات بعد',
          filter.q || filter.status ? 'جرّب بحثاً آخر أو أزل الفلتر.' : 'الطلبات القادمة من الموقع تظهر هنا.',
          (filter.q || filter.status)
            ? el('button', { class: 'btn btn--sm', type: 'button',
                onclick: () => { filter = { q: '', status: '' }; build(); } }, ['إزالة الفلاتر'])
            : null));
  }

  build();
  host.replaceChildren(wrap);
  refreshBadge();

  // فتح تفاصيل طلب مباشرة من المسار
  if (id) {
    const o = get('orders').find((x) => x.order_number === id || x.id === id);
    if (o) openOrder(o, rerender);
    else toast('الطلب غير موجود', 'warn');
  }
}
