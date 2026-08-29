// footer — بلاطات التواصل + بلاطة العلامة. الروابط الغائبة لا تُرسم.
import { el } from '../core/dom.js';
import { content } from '../core/store.js';
import { icon } from '../components/icon.js';
import { logoImg } from '../components/logo.js';
import { applyEditable } from '../components/editable.js';

const SOCIAL = [
  { key: 'whatsapp',  label: 'whatsapp_label',  name: 'واتساب',
    href: (v) => `https://wa.me/${String(v).replace(/\D/g, '')}` },
  { key: 'instagram', label: 'instagram_label', name: 'انستقرام',
    href: (v) => `https://instagram.com/${String(v).replace(/^@/, '')}` },
  { key: 'x',         label: null, name: 'X',
    href: (v) => `https://x.com/${String(v).replace(/^@/, '')}` },
  { key: 'email',     label: null, name: 'البريد', href: (v) => `mailto:${v}` },
];

export function mount(root, opts = {}) {
  const links = SOCIAL
    .map((s) => ({ ...s, value: content(s.key) }))
    .filter((s) => s.value)
    .map((s) => el('a', {
      class: 'card social glass glass--soft t--quarter', href: s.href(s.value),
      target: s.key === 'email' ? null : '_blank',
      rel: 'noopener noreferrer', 'data-fx': 'magnetic shine',
      'aria-label': s.name,
    }, [
      el('span', { class: 'social__icon' }, [icon(s.key) || icon('arrow')]),
      el('span', { class: 'social__name' }, [s.name]),
      s.label && content(s.label) ? el('span', { class: 'social__note' }, [content(s.label)]) : null,
    ]));

  const year = new Date().getFullYear();

  root.replaceChildren(
    el('div', { class: 'bento bento--flow', 'data-fx': 'reveal', 'data-fx-children': '.card' }, [
      el('div', { class: 'card footer__brand-tile glass glass--tinted t--third' }, [
        logoImg({ size: 54, cls: 'footer__logo' }),
        el('strong', { class: 'footer__brand' }, [content('brand', 'aboal3z.dzn')]),
        el('p', { class: 'card__text', 'data-edit-id': 'footer.text' }, [content('footer_text')]),
      ]),
      ...links,
      el('div', { class: 'footer__legal' }, [
        el('span', {}, [`© ${year} ${content('brand', 'aboal3z.dzn')}`]),
        el('span', {}, [content('footer_legal', 'كل الحقوق محفوظة.')]),
      ]),
    ]),
  );

  applyEditable(root, opts);
}
