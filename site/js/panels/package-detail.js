// لوحة البكج — الكتل تُرسم بحلقة على `package_blocks`.
// ❌ صفر عنوان مكتوب في الكود: كل عنوان كتلة يأتي من البيانات.
import { el } from '../core/dom.js';
import { get, blocksOf } from '../core/store.js';
import { openLightbox } from '../core/lightbox.js';

function media(item) {
  if (item.type === 'video') {
    return el('video', { src: item.url, poster: item.poster || '',
      muted: true, loop: true, playsinline: true, preload: 'metadata' });
  }
  return el('img', { src: item.url, alt: item.caption || '',
    loading: 'lazy', decoding: 'async' });
}

function block(b) {
  const items = Array.isArray(b.images) ? b.images : [];
  return el('section', { class: 'pkg-block', 'data-edit-id': `package.block.${b.id}` }, [
    el('h3', { class: 'pkg-block__title' }, [b.title || '']),
    el('div', { class: 'pkg-block__grid' }, items.map((im, i) =>
      el('button', {
        class: 'pkg-block__cell', type: 'button', 'data-cursor': 'كبّر',
        'aria-label': `تكبير ${im.caption || 'الصورة'}`,
        onclick: () => openLightbox(items, i),
      }, [media(im)]))),
  ]);
}

export default function render({ id }) {
  const pkg = get('packages').find((p) => p.id === id);
  if (!pkg) return el('p', { class: 'glass-panel__error' }, ['البكج غير موجود.']);

  const blocks = blocksOf(id);
  return el('div', { class: 'pkg-detail' }, [
    el('h2', { class: 'pkg-detail__title' }, [pkg.name]),
    ...(blocks.length ? blocks.map(block)
      : [el('p', { class: 'card__text' }, ['لا توجد كتل في هذا البكج بعد.'])]),
  ]);
}
