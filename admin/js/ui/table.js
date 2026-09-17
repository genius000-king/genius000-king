// table.js — جدول يتحوّل بطاقات تحت 640px. عمود واحد يُعرَّف مرة ويعمل في الوضعين.
import { el } from '../core/dom.js';

const MOBILE = '(max-width: 640px)';

/**
 * @param {Array} cols [{key, label, render(row), mobile:boolean, cls}]
 * @param {Array} rows
 * @param {object} o {onRow, rowClass, empty}
 */
export function table(cols, rows, o = {}) {
  if (!rows.length) return o.empty || el('p', { class: 'empty' }, ['لا توجد بيانات.']);

  const isMobile = matchMedia(MOBILE).matches;
  return isMobile ? cards(cols, rows, o) : grid(cols, rows, o);
}

function grid(cols, rows, o) {
  return el('div', { class: 'tbl-wrap' }, [
    el('table', { class: 'tbl' }, [
      el('thead', {}, [el('tr', {}, cols.map((c) => el('th', { class: c.cls || '' }, [c.label])))]),
      el('tbody', {}, rows.map((r) => {
        const tr = el('tr', { class: o.rowClass?.(r) || '' },
          cols.map((c) => el('td', { class: c.cls || '' }, [c.render(r)])));
        if (o.onRow) { tr.style.cursor = 'pointer'; tr.addEventListener('click', (e) => {
          if (!e.target.closest('button, select, a, input')) o.onRow(r);
        }); }
        return tr;
      })),
    ]),
  ]);
}

function cards(cols, rows, o) {
  const head = cols.filter((c) => c.primary);
  const rest = cols.filter((c) => !c.primary && c.mobile !== false);
  return el('div', { class: 'rec-list' }, rows.map((r) => {
    const box = el('div', { class: `rec ${o.rowClass?.(r) || ''}` }, [
      el('div', { class: 'rec__top' }, head.map((c) => el('span', { class: 'grow' }, [c.render(r)]))),
      el('dl', { class: 'stack', style: { gap: '4px' } }, rest.flatMap((c) => [
        el('div', { class: 'rec__row' }, [
          el('dt', {}, [c.label]),
          el('dd', {}, [c.render(r)]),
        ]),
      ])),
    ]);
    if (o.onRow) box.addEventListener('click', (e) => {
      if (!e.target.closest('button, select, a, input')) o.onRow(r);
    });
    return box;
  }));
}

/** يعيد الجدول لبناء نفسه عند تغيّر المقاس. */
export function responsiveTable(host, build) {
  const mq = matchMedia(MOBILE);
  const paint = () => host.replaceChildren(build());
  mq.addEventListener('change', paint);
  paint();
  return () => mq.removeEventListener('change', paint);
}
