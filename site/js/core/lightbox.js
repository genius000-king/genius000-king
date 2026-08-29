// lightbox.js — عارض الصور: أسهم، لمس، Escape، وحبس تركيز.
import { el, on, qsa } from './dom.js';
import { icon } from '../components/icon.js';
import * as overlay from './overlay.js';

let state = null;

function mediaNode(item) {
  if (item.type === 'video') {
    return el('video', { src: item.url, controls: true, autoplay: true,
      playsinline: true, poster: item.poster || '' });
  }
  return el('img', { src: item.url, alt: item.caption || '', decoding: 'async' });
}

export function openLightbox(items = [], index = 0) {
  const list = items.filter((i) => i && i.url);
  if (!list.length) return null;
  if (state) closeLightbox({ silent: true });

  const root = document.getElementById('lightbox') || document.body;
  let i = Math.min(list.length - 1, Math.max(0, index));

  const stage = el('div', { class: 'lb__stage' });
  const caption = el('span', { class: 'lb__caption' });
  const counter = el('span', { class: 'lb__count' });

  const prev = el('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'السابق',
    onclick: () => step(-1) }, [icon('arrow', { size: 18 })]);
  const nextBtn = el('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'التالي',
    onclick: () => step(1) }, [icon('arrow', { size: 18 })]);
  nextBtn.style.transform = 'scaleX(-1)';

  const box = el('div', { class: 'lb', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'عارض الصور' }, [
    el('div', { class: 'lb__head' }, [
      counter,
      el('button', { class: 'btn btn--icon lb__close', type: 'button', 'aria-label': 'إغلاق',
        onclick: () => closeLightbox() }, [icon('close')]),
    ]),
    stage,
    el('div', { class: 'lb__foot' }, [prev, caption, nextBtn]),
  ]);

  function paint() {
    const item = list[i];
    stage.replaceChildren(mediaNode(item));
    caption.textContent = item.caption || '';
    counter.textContent = `${i + 1} / ${list.length}`;
    prev.disabled = nextBtn.disabled = list.length < 2;
  }
  function step(d) { i = (i + d + list.length) % list.length; paint(); }

  const onKey = (e) => {
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowRight') step(-1);      // RTL: يمين = السابق
    else if (e.key === 'ArrowLeft') step(1);
    else if (e.key === 'Tab') {
      const f = qsa('button:not([disabled])', box);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  // سحب أفقي على اللمس
  let sx = 0, sy = 0;
  const offs = [
    on(document, 'keydown', onKey),
    on(stage, 'pointerdown', (e) => { sx = e.clientX; sy = e.clientY; }),
    on(stage, 'pointerup', (e) => {
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 56 && Math.abs(e.clientY - sy) < 80) step(dx > 0 ? -1 : 1);
    }),
    on(box, 'click', (e) => { if (e.target === box) closeLightbox(); }),
  ];

  root.replaceChildren(box);
  document.body.style.overflow = 'hidden';
  paint();
  requestAnimationFrame(() => box.classList.add('is-open'));

  const onPop = () => closeLightbox({ fromPop: true });
  overlay.push(onPop);
  state = { box, offs, root, onPop, opener: document.activeElement };
  nextBtn.focus();
  return box;
}

export function closeLightbox({ fromPop = false, silent = false } = {}) {
  if (!state) return;
  const { box, offs, root, onPop, opener } = state;
  offs.forEach((f) => f());
  box.classList.remove('is-open');
  root.replaceChildren();
  document.body.style.overflow = '';
  state = null;
  opener?.focus?.();
  if (fromPop || silent) overlay.drop(onPop); else overlay.pop(onPop);
}

export function isOpen() { return !!state; }
