// dashboard.js — نظرة أولى: أرقام، آخر الطلبات، إجراءات سريعة، صحّة المحتوى.
import { el } from '../core/dom.js';
import { get } from '../core/store.js';
import { go } from '../core/router.js';
import { icon } from '../ui/icon.js';
import { ago, num } from '../core/format.js';
import { badge } from '../ui/fields.js';
import { STATUS_LABEL } from './orders.js';

function kpi(label, value, foot, kind) {
  return el('button', { class: `kpi ${kind ? 'kpi--' + kind : ''}`, type: 'button',
    onclick: () => go('/orders') }, [
    el('span', { class: 'kpi__label' }, [label]),
    el('span', { class: 'kpi__value' }, [num(value)]),
    foot ? el('span', { class: 'kpi__foot' }, [foot]) : null,
  ]);
}

function quick(label, iconName, path) {
  return el('button', { class: 'btn', type: 'button', onclick: () => go(path) },
    [icon(iconName, { size: 16 }), label]);
}

/** فحوص جودة المحتوى — تقول للمالك ما ينقصه بالضبط. */
function healthChecks() {
  const c = Object.fromEntries(get('site_content').map((r) => [r.key, r.value]));
  const out = [];
  const need = (ok, msg, path) => out.push({ ok, msg, path });

  need(!!c.whatsapp, 'رقم واتساب مضبوط', '/settings');
  need(get('works').some((w) => w.published !== false), 'يوجد عمل منشور واحد على الأقل', '/works');
  need(get('packages').some((p) => p.published !== false), 'يوجد بكج منشور واحد على الأقل', '/packages');
  need(get('order_items').some((i) => i.published !== false), 'كتالوج الطلب فيه بنود', '/catalog');
  need(!!c.hero_title_1 || !!c.hero_title_hl, 'عنوان الصفحة الرئيسية مكتوب', '/content');
  need(!!c.about_text, 'نبذة «من أنا» مكتوبة', '/content');
  return out;
}

export function render(host) {
  const orders = get('orders');
  const nw = orders.filter((o) => o.status === 'new').length;
  const prog = orders.filter((o) => o.status === 'in_progress').length;
  const unread = orders.filter((o) => !o.read).length;
  const recent = [...orders]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 6);

  const checks = healthChecks();
  const failing = checks.filter((c) => !c.ok);

  host.replaceChildren(el('div', { class: 'view' }, [
    el('div', { class: 'view__head' }, [
      el('div', {}, [
        el('h1', { class: 'view__title' }, ['لوحة القيادة']),
        el('p', { class: 'view__sub' }, ['نظرة سريعة على الموقع والطلبات']),
      ]),
      el('div', { class: 'view__actions' }, [
        quick('نصوص الموقع', 'pencil', '/content'),
        quick('معاينة', 'eye', '/preview'),
      ]),
    ]),

    el('div', { class: 'kpis' }, [
      kpi('طلبات جديدة', nw, unread ? `${num(unread)} غير مقروء` : 'كلها مقروءة', nw ? 'accent' : null),
      kpi('قيد التنفيذ', prog, 'جارٍ العمل عليها', prog ? 'warn' : null),
      kpi('أعمال منشورة', get('works').filter((w) => w.published !== false).length,
        `من ${num(get('works').length)} عملاً`),
      kpi('بكجات منشورة', get('packages').filter((p) => p.published !== false).length,
        `من ${num(get('packages').length)} بكجاً`),
    ]),

    el('div', { class: 'dash-cols' }, [
      /* ── آخر الطلبات ── */
      el('div', { class: 'card' }, [
        el('div', { class: 'card__head' }, [
          el('span', { class: 'card__title grow' }, ['آخر الطلبات']),
          el('button', { class: 'btn btn--sm btn--ghost', type: 'button',
            onclick: () => go('/orders') }, ['عرض الكل', icon('arrow', { size: 14 })]),
        ]),
        recent.length
          ? el('div', { class: 'stack', style: { gap: 'var(--a-2)' } }, recent.map((o) =>
              el('button', { class: `dash-row ${o.read ? '' : 'is-unread'}`, type: 'button',
                onclick: () => go(`/orders/${o.order_number}`) }, [
                el('span', { class: 'mono dash-row__id' }, [o.order_number]),
                el('span', { class: 'grow' }, [o.name || '—']),
                badge(o.status || 'new', STATUS_LABEL[o.status] || 'جديد'),
                el('span', { class: 'dash-row__time' }, [ago(o.created_at)]),
              ])))
          : el('p', { class: 'fld__hint' }, ['لا توجد طلبات بعد.']),
      ]),

      /* ── جاهزية الموقع ── */
      el('div', { class: 'card' }, [
        el('div', { class: 'card__head' }, [
          el('span', { class: 'card__title grow' }, ['جاهزية الموقع']),
          el('span', { class: 'card__hint' },
            [`${checks.length - failing.length} / ${checks.length}`]),
        ]),
        el('div', { class: 'stack', style: { gap: 'var(--a-2)' } }, checks.map((c) =>
          el('button', { class: `check ${c.ok ? 'is-ok' : ''}`, type: 'button',
            onclick: () => go(c.path) }, [
            el('span', { class: 'check__mark' }, [icon(c.ok ? 'check' : 'info', { size: 13 })]),
            el('span', { class: 'grow' }, [c.msg]),
            c.ok ? null : el('span', { class: 'check__go' }, [icon('arrow', { size: 14 })]),
          ]))),
      ]),
    ]),
  ]));
}
