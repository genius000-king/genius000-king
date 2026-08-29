// works — شريط لكل معرض. عدد المعارض والأعمال يأتي من القاعدة، بلا رقم ثابت.
import { el, published } from '../core/dom.js';
import { get, byCollection, content } from '../core/store.js';
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

function card(work) {
  const media = el('div', { class: 'work__media fx-zoom', 'data-fx': 'zoom-in' }, [
    el('img', { src: work.image_url, alt: work.alt || work.title || '',
      loading: 'lazy', decoding: 'async', width: '300', height: '400' }),
    work.image_hover_url
      ? el('img', { src: work.image_hover_url, alt: '', 'data-swap': '',
          loading: 'lazy', decoding: 'async', width: '300', height: '400' })
      : null,
  ]);

  return el('button', {
    class: 'work', type: 'button',
    'data-edit-id': `work.card.${work.id}`,
    'data-fx': work.image_hover_url ? 'reveal-swap' : '',
    'data-cursor': 'شاهد',
    'aria-label': work.title || 'عمل',
    onclick: () => openPanel(`work-${work.id}`,
      () => import('../panels/work-detail.js'), { id: work.id }),
  }, [media, el('span', { class: 'work__title' }, [work.title || ''])]);
}

export function mount(root, opts = {}) {
  const strips = buildStrips(get('collections'), get('works'));

  root.replaceChildren(
    sectionHead('works', content('works_title'), content('works_sub')),
    el('div', { class: 'bleed works__strips' }, strips.map((s, i) =>
      el('div', { class: 'works__strip', 'data-edit-id': `works.strip.${s.id}` }, [
        el('h3', { class: 'works__strip-name container' }, [s.name]),
        el('div', { class: 'marquee', 'data-fx': 'marquee', 'data-fx-dir': i % 2 ? '-1' : '1',
          'data-cursor': 'اسحب' },
          [el('div', { class: 'marquee__track' }, s.items.map(card))]),
      ]))),
  );

  applyEditable(root, opts);
}
