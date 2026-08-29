// head.js — ترويسة قسم موحّدة: عنوان بمسح لوني ووصف. تُعاد في كل قسم.
import { el } from '../core/dom.js';

export function sectionHead(key, title, sub) {
  return el('header', { class: 'bento section__head', 'data-fx': 'reveal' }, [
    el('h2', { class: 'section__title', 'data-edit-id': `${key}.title`, 'data-fx': 'sweep' },
      [title]),
    sub ? el('p', { class: 'section__sub', 'data-edit-id': `${key}.sub` }, [sub]) : null,
  ]);
}
