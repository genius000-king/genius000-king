// head.js — ترويسة قسم موحّدة: تسمية صغيرة + عنوان + وصف.
import { el } from '../core/dom.js';

export function sectionHead(key, title, sub, label) {
  if (!title && !sub) return null;
  return el('header', { class: 'section__head', 'data-fx': 'reveal' }, [
    label ? el('span', { class: 'section__label' }, [label]) : null,
    title ? el('h2', { class: 'section__title', 'data-edit-id': `${key}.title`, 'data-fx': 'sweep' }, [title]) : null,
    sub ? el('p', { class: 'section__sub', 'data-edit-id': `${key}.sub` }, [sub]) : null,
  ]);
}
