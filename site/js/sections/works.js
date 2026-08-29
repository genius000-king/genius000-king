// works — جدار بينتو للأعمال المميّزة + شريط أفقي لكل معرض.
import { el, published, emptyState, errorState } from '../core/dom.js';
import { get, content, didFail, reload } from '../core/store.js';
import { openPanel } from '../core/panel.js';
import { sectionHead } from '../components/head.js';
import { applyEditable } from '../components/editable.js';

/** دالة خالصة قابلة للاختبار: تبني وصف الشرائح من المعارض والأعمال. */
export function buildStrips(collections, works) {
  return published(collections).map((c) => ({
    id: c.id,
    name: c.name,
    items: published(works.filter((w) => w.collection_id === c.id)),
  })).filter((s) => s.items.length);
}

/** يوزّع الأعمال المميّزة على مقاسات بينتو متناوبة. */
export function featuredSpans(n) {
  const pattern = ['t--wide-tall', 't--tall', 't--box', 't--box', 't--tall', 't--wide'];
  return Array.from({ length: n }, (_, i) => pattern[i % pattern.length]);
}

function card(work, span = '') {
  return el('button', {
    class: `work ${span}`, type: 'button',
    'data-edit-id': `work.card.${work.id}`,
    'data-fx': work.image_hover_url ? 'swap zoom-in' : 'zoom-in',
    'data-cursor': 'شاهد',
    'aria-label': work.title || 'عمل',
    onclick: () => openPanel(`work-${work.id}`,
      () => import('../panels/work-detail.js'), { id: work.id }),
  }, [
    el('div', { class: 'work__media' }, [
      el('img', { src: work.image_url, alt: work.alt || work.title || '',
        loading: 'lazy', decoding: 'async', width: '600', height: '800' }),
      work.image_hover_url
        ? el('img', { src: work.image_hover_url, alt: '', 'data-swap': '',
            loading: 'lazy', decoding: 'async', width: '600', height: '800' })
        : null,
    ]),
    el('span', { class: 'work__veil' }, [
      el('span', { class: 'work__title' }, [work.title || '']),
      work.subtitle ? el('span', { class: 'work__meta' }, [work.subtitle]) : null,
    ]),
  ]);
}

export function mount(root, opts = {}) {
  const head = sectionHead('works', content('works_title'), content('works_sub'), 'المعرض');

  if (didFail('works') || didFail('collections')) {
    root.replaceChildren(head, el('div', { class: 'bento bento--flow' }, [
      errorState('تعذّر تحميل الأعمال.', async () => {
        await Promise.all([reload('works'), reload('collections')]).catch(() => {});
        mount(root, opts);
      }),
    ]));
    return;
  }

  const all = published(get('works'));
  if (!all.length) {
    root.replaceChildren(head, el('div', { class: 'bento bento--flow' }, [
      emptyState('لا توجد أعمال منشورة بعد', 'أضِف أعمالك من لوحة التحكم لتظهر هنا.'),
    ]));
    applyEditable(root, opts);
    return;
  }

  const featured = all.filter((w) => w.featured).slice(0, 6);
  const spans = featuredSpans(featured.length);
  const strips = buildStrips(get('collections'), get('works'));

  root.replaceChildren(
    head,
    featured.length
      ? el('div', { class: 'bento works__wall', 'data-fx': 'reveal', 'data-fx-children': '.work' },
          featured.map((w, i) => card(w, spans[i])))
      : null,
    strips.length
      ? el('div', { class: 'bleed works__strips' }, strips.map((s, i) =>
          el('div', { class: 'works__strip', 'data-edit-id': `works.strip.${s.id}` }, [
            el('div', { class: 'works__strip-head' }, [
              el('h3', { class: 'works__strip-name' }, [s.name]),
              el('span', { class: 'works__strip-count' }, [`${s.items.length}`]),
            ]),
            el('div', { class: 'marquee', 'data-fx': 'marquee',
              'data-fx-dir': i % 2 ? '-1' : '1', 'data-fx-speed': '22', 'data-cursor': 'اسحب' },
              [el('div', { class: 'marquee__track' }, s.items.map((w) => card(w)))]),
          ])))
      : null,
  );

  applyEditable(root, opts);
}
