// hero — الشارة، العنوان المفكَّك بكلمة مميزة، الوصف، زرّان، ولوحة الجسيمات.
import { el } from '../core/dom.js';
import { content } from '../core/store.js';
import { icon } from '../components/icon.js';
import { applyEditable } from '../components/editable.js';

export function mount(root, opts = {}) {
  const title = el('h1', { class: 'hero__title', 'data-edit-id': 'hero.title' }, [
    el('span', { class: 'hero__word', 'data-fx': 'split-text' }, [content('hero_title_1')]),
    ' ',
    el('span', { class: 'hero__word hero__word--hl', 'data-fx': 'split-text sweep' },
      [content('hero_title_hl')]),
    ' ',
    el('span', { class: 'hero__word', 'data-fx': 'split-text' }, [content('hero_title_2')]),
  ]);

  root.replaceChildren(
    el('canvas', { class: 'hero__canvas', 'data-fx': 'particles', 'aria-hidden': 'true' }),
    el('div', { class: 'bento hero__inner', 'data-fx': 'parallax', 'data-fx-depth': '0.12' }, [
      el('span', { class: 'pill', 'data-edit-id': 'hero.badge' }, [
        el('i', { class: 'pill__dot' }),
        el('span', { 'data-fx': 'scramble' }, [content('status_badge')]),
      ]),
      title,
      el('p', { class: 'hero__sub', 'data-edit-id': 'hero.subtitle' }, [content('hero_subtitle')]),
      el('div', { class: 'hero__actions' }, [
        el('button', { class: 'btn btn--primary', type: 'button', 'data-edit-id': 'hero.cta',
          'data-fx': 'magnetic',
          onclick: () => document.dispatchEvent(new CustomEvent('order:open')) },
          [content('hero_cta'), icon('arrow', { size: 18 })]),
        el('button', { class: 'btn', type: 'button', 'data-edit-id': 'hero.cta_alt',
          'data-fx': 'magnetic',
          onclick: () => document.getElementById('works')?.scrollIntoView({ behavior: 'smooth' }) },
          [content('hero_cta_alt')]),
      ]),
    ]),
  );

  applyEditable(root, opts);
}
