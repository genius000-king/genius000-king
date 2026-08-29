// lightbox.js — عارض الصور. يتبع نمط `panel.js` في السجل: الرابط لا يتغيّر.
import { el, qs, on } from './dom.js';
import * as overlay from './overlay.js';

let state = null;   // { items, index, root, opener, pushed }
let unbind = [];

export function isLightboxOpen() { return !!state; }
export function lightboxIndex() { return state ? state.index : -1; }

function host() {
  let h = document.getElementById('lightbox');
  if (!h) { h = el('div', { id: 'lightbox' }); document.body.append(h); }
  return h;
}

function media(item) {
  if (item.type === 'video') {
    return el('video', { src: item.url, poster: item.poster || '', class: 'lightbox__media',
      controls: true, playsinline: true, loop: true, muted: true });
  }
  return el('img', { src: item.url, alt: item.caption || '', class: 'lightbox__media', decoding: 'async' });
}

function draw() {
  const item = state.items[state.index];
  const stage = qs('.lightbox__stage', state.root);
  stage.replaceChildren(media(item));
  qs('.lightbox__caption', state.root).textContent = item.caption || '';
  qs('.lightbox__counter', state.root).textContent =
    state.items.length > 1 ? `${state.index + 1} / ${state.items.length}` : '';
}

export function go(step) {
  if (!state || state.items.length < 2) return;
  state.index = (state.index + step + state.items.length) % state.items.length;
  draw();
}

function onKey(e) {
  if (e.key === 'Escape') closeLightbox();
  else if (e.key === 'ArrowLeft') go(1);      // RTL: يسار = التالي
  else if (e.key === 'ArrowRight') go(-1);
}

function bindSwipe(node) {
  let x0 = null;
  const down = (e) => { x0 = e.clientX; };
  const up = (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 45) go(dx > 0 ? -1 : 1);
  };
  return [on(node, 'pointerdown', down), on(node, 'pointerup', up)];
}

/** يفتح العارض على مجموعة عناصر `{type,url,poster,caption}` أو روابط نصية. */
export function openLightbox(images, index = 0) {
  const items = (images || []).map((i) => (typeof i === 'string' ? { type: 'image', url: i } : i));
  if (!items.length) return;
  if (state) closeLightbox({ silent: true });

  const root = el('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'عارض الصور' }, [
    el('button', { class: 'lightbox__close', type: 'button', 'aria-label': 'إغلاق', onclick: () => closeLightbox() }, ['×']),
    el('button', { class: 'lightbox__nav lightbox__nav--prev', type: 'button', 'aria-label': 'السابق', onclick: () => go(-1) }, ['‹']),
    el('div', { class: 'lightbox__stage' }),
    el('button', { class: 'lightbox__nav lightbox__nav--next', type: 'button', 'aria-label': 'التالي', onclick: () => go(1) }, ['›']),
    el('p', { class: 'lightbox__caption' }),
    el('p', { class: 'lightbox__counter' }),
  ]);
  host().replaceChildren(root);
  document.body.style.overflow = 'hidden';
  const onPop = () => closeLightbox({ fromPop: true });
  overlay.push(onPop);
  state = { items, index: Math.max(0, Math.min(index, items.length - 1)), root, opener: document.activeElement, onPop };
  unbind = [on(document, 'keydown', onKey), ...bindSwipe(root),
            on(qs('.lightbox__stage', root), 'click', () => go(1))];
  draw();
  requestAnimationFrame(() => root.classList.add('is-open'));
  qs('.lightbox__close', root).focus();
}

export function closeLightbox({ fromPop = false, silent = false } = {}) {
  if (!state) return;
  const { root, opener, onPop } = state;
  unbind.forEach((f) => f()); unbind = [];
  root.remove();
  state = null;
  document.body.style.overflow = '';
  if (opener && typeof opener.focus === 'function') opener.focus();
  if (fromPop || silent) overlay.drop(onPop);
  else overlay.pop(onPop);
}
