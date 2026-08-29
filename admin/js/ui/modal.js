// modal.js — مودال تأكيد. يُغلق بـ Escape وبالنقر على الخلفية، ويحبس التركيز.
import { el, on, qsa } from '../core/dom.js';

const FOCUSABLE = 'button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';

/** @returns {Promise<boolean>} */
export function confirmModal(o = {}) {
  return new Promise((resolve) => {
    const opener = document.activeElement;
    let done = false;

    const okBtn = el('button', {
      class: `btn ${o.danger ? 'btn--danger' : 'btn--primary'}`, type: 'button',
      disabled: !!o.typeToConfirm,
      onclick: () => finish(true),
    }, [o.confirm || 'تأكيد']);

    const typed = o.typeToConfirm
      ? el('input', { class: 'field mono', type: 'text', autocomplete: 'off',
          'aria-label': `اكتب ${o.typeToConfirm} للتأكيد`,
          oninput: (e) => { okBtn.disabled = e.target.value.trim() !== o.typeToConfirm; } })
      : null;

    const box = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, [
      el('h3', { class: 'modal__title' }, [o.title || 'تأكيد']),
      o.body ? el('p', { class: 'modal__body' }, [o.body]) : null,
      typed ? el('div', { class: 'fld' }, [
        el('span', { class: 'fld__hint' }, [`اكتب «${o.typeToConfirm}» للمتابعة`]), typed,
      ]) : null,
      el('div', { class: 'modal__foot' }, [
        okBtn,
        el('button', { class: 'btn', type: 'button', onclick: () => finish(false) }, [o.cancel || 'إلغاء']),
      ]),
    ]);

    const scrim = el('div', { class: 'modal-scrim',
      onclick: (e) => { if (e.target === scrim) finish(false); } }, [box]);

    const off = on(document, 'keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); finish(false); }
      else if (e.key === 'Tab') {
        const f = qsa(FOCUSABLE, box).filter((n) => !n.disabled);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    function finish(v) {
      if (done) return;
      done = true;
      off();
      scrim.classList.remove('is-on');
      setTimeout(() => scrim.remove(), 200);
      opener?.focus?.();
      resolve(v);
    }

    document.body.append(scrim);
    requestAnimationFrame(() => scrim.classList.add('is-on'));
    (typed || okBtn).focus();
  });
}

/** حذف عنصر يحمل أبناءً: يتطلّب كتابة الاسم. */
export function confirmDelete(name, childrenNote) {
  return confirmModal({
    title: `حذف «${name}»؟`,
    body: childrenNote ? `${childrenNote} لا يمكن التراجع بعد إغلاق اللوحة.` : 'لا يمكن التراجع بعد إغلاق اللوحة.',
    confirm: 'حذف', danger: true,
    typeToConfirm: childrenNote ? name : null,
  });
}
