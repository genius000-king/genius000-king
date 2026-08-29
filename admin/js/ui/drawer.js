// drawer.js — درج جانبي. 🔒 درج واحد فقط في المرة، يُغلق بـ Escape وبالخلفية.
import { el, on, qsa } from '../core/dom.js';
import { icon } from './icon.js';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
let open = null;

export function isOpen() { return !!open; }

export function openDrawer(o = {}) {
  closeDrawer({ silent: true });
  const opener = document.activeElement;

  const body = el('div', { class: 'drawer__body' }, [o.body || '']);
  const title = el('div', { class: 'drawer__title' }, [o.title || '']);
  const sub = el('div', { class: 'drawer__sub' }, [o.sub || '']);

  const box = el('div', {
    class: `drawer ${o.wide ? 'drawer--wide' : ''}`,
    role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || 'لوحة', tabindex: '-1',
  }, [
    el('div', { class: 'drawer__head' }, [
      o.back ? el('button', { class: 'btn btn--icon btn--ghost', type: 'button',
        'aria-label': 'رجوع', onclick: o.back }, [icon('arrow')]) : null,
      el('div', { class: 'grow' }, [title, o.sub ? sub : null]),
      el('button', { class: 'btn btn--icon btn--ghost', type: 'button',
        'aria-label': 'إغلاق', onclick: () => closeDrawer() }, [icon('close')]),
    ]),
    body,
    o.foot ? el('div', { class: 'drawer__foot' }, [o.foot]) : null,
  ]);

  const scrim = el('div', { class: 'drawer-scrim', onclick: () => closeDrawer() });

  const off = on(document, 'keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); closeDrawer(); }
    else if (e.key === 'Tab') {
      const f = qsa(FOCUSABLE, box).filter((n) => n.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  document.body.append(scrim, box);
  requestAnimationFrame(() => { scrim.classList.add('is-on'); box.classList.add('is-open'); });
  open = { box, body, title, sub, scrim, off, opener, onClose: o.onClose };
  (qsa(FOCUSABLE, body)[0] || box).focus();

  return {
    box, body,
    close: closeDrawer,
    setBody: (n) => body.replaceChildren(n),
    setTitle: (t, s) => { title.textContent = t; if (s !== undefined) sub.textContent = s; },
  };
}

export function closeDrawer({ silent = false } = {}) {
  if (!open) return;
  const { box, scrim, off, opener, onClose } = open;
  open = null;
  off();
  box.classList.remove('is-open');
  scrim.classList.remove('is-on');
  setTimeout(() => { box.remove(); scrim.remove(); }, 240);
  if (!silent) { opener?.focus?.(); onClose?.(); }
}

export function setDrawerBody(node) { open?.body.replaceChildren(node); }
