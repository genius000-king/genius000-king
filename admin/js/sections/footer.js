// footer — النص وروابط التواصل. الروابط الغائبة لا تُرسم أصلاً (لا فراغ).
import { el } from '../core/dom.js';
import { content } from '../core/store.js';
import { icon } from '../components/icon.js';
import { applyEditable } from '../components/editable.js';

const SOCIAL = [
  { key: 'whatsapp', label: 'whatsapp_label', href: (v) => `https://wa.me/${v}`, name: 'واتساب' },
  { key: 'instagram', label: 'instagram_label', href: (v) => `https://instagram.com/${v}`, name: 'انستقرام' },
  { key: 'x', label: null, href: (v) => `https://x.com/${v}`, name: 'X' },
  { key: 'email', label: null, href: (v) => `mailto:${v}`, name: 'البريد' },
];

export function mount(root, opts = {}) {
  const links = SOCIAL
    .map((s) => ({ ...s, value: content(s.key) }))
    .filter((s) => s.value)
    .map((s) => el('a', {
      class: 'card social', href: s.href(s.value),
      target: '_blank', rel: 'noopener', 'data-fx': 'shine magnetic',
      'aria-label': s.name,
    }, [
      el('span', { class: 'social__icon' }, [icon(s.key) || icon('arrow')]),
      el('span', { class: 'social__name' }, [s.name]),
      s.label ? el('span', { class: 'social__note' }, [content(s.label)]) : null,
    ]));

  root.replaceChildren(
    el('div', { class: 'bento footer__inner', 'data-fx': 'reveal', 'data-fx-children': '.card' }, [
      ...(links.length ? [el('div', { class: 'footer__social', 'data-edit-id': 'footer.social' }, links)] : []),
      el('div', { class: 'card footer__note' }, [
        el('strong', { class: 'footer__brand' }, [content('brand')]),
        el('p', { class: 'card__text', 'data-edit-id': 'footer.text' }, [content('footer_text')]),
      ]),
    ]),
  );

  applyEditable(root, opts);
}
