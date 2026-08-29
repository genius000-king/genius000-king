// لوحة تفاصيل العمل — تُحمَّل بـ import() عند أول فتح فقط.
import { el } from '../core/dom.js';
import { get } from '../core/store.js';
import { openLightbox } from '../core/lightbox.js';

export default function render({ id }) {
  const work = get('works').find((w) => w.id === id);
  if (!work) return el('p', { class: 'glass-panel__error' }, ['العمل غير موجود.']);

  const collection = get('collections').find((c) => c.id === work.collection_id);
  const images = [work.image_url, work.image_hover_url].filter(Boolean)
    .map((url, i) => ({ type: 'image', url, caption: i ? 'النسخة الثانية' : work.title }));

  return el('div', { class: 'work-detail' }, [
    collection ? el('span', { class: 'card__label' }, [collection.name]) : null,
    el('h2', { class: 'work-detail__title' }, [work.title || '']),
    el('div', { class: 'work-detail__grid' }, images.map((im, i) =>
      el('button', {
        class: 'work-detail__shot', type: 'button', 'data-cursor': 'كبّر',
        'aria-label': `تكبير ${im.caption || 'الصورة'}`,
        onclick: () => openLightbox(images, i),
      }, [
        el('img', { src: im.url, alt: im.caption || '', loading: 'lazy', decoding: 'async' }),
      ]))),
  ]);
}
