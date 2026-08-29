// modal.js — مودال تأكيد. كل حذف يمرّ من هنا (لا حذف صامت أبداً).
import { el, qs, on } from './dom.js';

/** يعرض سؤالاً ويعيد Promise<boolean>. */
export function confirmModal({ title, body = '', confirm = 'حذف', cancel = 'إلغاء' }) {
  return new Promise((resolve) => {
    const close = (answer) => { root.remove(); offEsc(); resolve(answer); };

    const root = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, [
      el('div', { class: 'modal__backdrop', onclick: () => close(false) }),
      el('div', { class: 'modal__box' }, [
        el('h3', { class: 'modal__title' }, [title]),
        body ? el('p', { class: 'modal__body' }, [body]) : null,
        el('div', { class: 'modal__nav' }, [
          el('button', { class: 'btn', type: 'button', onclick: () => close(false) }, [cancel]),
          el('button', { class: 'btn btn--danger', type: 'button', onclick: () => close(true) }, [confirm]),
        ]),
      ]),
    ]);

    const offEsc = on(document, 'keydown', (e) => { if (e.key === 'Escape') close(false); });
    (document.getElementById('modalRoot') || document.body).append(root);
    qs('.btn--danger', root).focus();
  });
}
