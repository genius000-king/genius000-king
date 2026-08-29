// لوحة تفاصيل العمل — الصور بحجمها الكامل مع لايتبوكس.
import { el } from '../core/dom.js';
import { get } from '../core/store.js';
import { openLightbox } from '../core/lightbox.js';

export default function render({ id }) {
  const work = get('works').find((w) => w.id === id);
  if (!work) return el('p', { class: 'glass-panel__error' }, ['العمل غير موجود.']);

  const shots = [
    { url: work.image_url, caption: work.title },
    ...(work.image_hover_url ? [{ url: work.image_hover_url, caption: '' }] : []),
    ...((Array.isArray(work.gallery) ? work.gallery : []).filter((g) => g && g.url)),
  ];

  return el('div', { class: 'work-detail' }, [
    el('h2', { class: 'work-detail__title' }, [work.title || '']),
    work.description ? el('p', { class: 'work-detail__meta' }, [work.description]) : null,
    el('div', { class: 'work-detail__grid' }, shots.map((s, i) =>
      el('button', {
        class: 'work-detail__shot', type: 'button', 'data-cursor': 'كبّر',
        'aria-label': `تكبير ${s.caption || 'الصورة'}`,
        onclick: () => openLightbox(shots, i),
      }, [el('img', { src: s.url, alt: s.caption || '', loading: 'lazy', decoding: 'async' })]))),
  ]);
}
