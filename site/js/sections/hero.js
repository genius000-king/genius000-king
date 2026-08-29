// hero — الشاشة الأولى. تخطيط مفتوح: شعار ونصّ وزرّان.
// ❌ بلا بطاقات زجاجية وبلا أرقام — الفراغ نفسه جزء من التصميم.
import { el, setKids } from '../core/dom.js';
import { content } from '../core/store.js';
import { icon } from '../components/icon.js';
import { logoMark } from '../components/logo.js';
import { applyEditable } from '../components/editable.js';

export function mount(root, opts = {}) {
  const t1 = content('hero_title_1');
  const hl = content('hero_title_hl');
  const t2 = content('hero_title_2');
  const badge = content('status_badge');

  const title = el('h1', { class: 'hero__title', 'data-edit-id': 'hero.title' }, [
    t1 ? el('span', { class: 'hero__word', 'data-fx': 'split-text' }, [t1]) : null,
    t1 && hl ? ' ' : null,
    hl ? el('span', { class: 'hero__word hero__word--hl', 'data-fx': 'split-text' }, [hl]) : null,
    (t1 || hl) && t2 ? ' ' : null,
    t2 ? el('span', { class: 'hero__word', 'data-fx': 'split-text' }, [t2]) : null,
  ]);

  setKids(root,
    el('div', { class: 'hero' }, [
      el('div', { class: 'hero__copy' }, [
        badge ? el('span', { class: 'pill hero__badge', 'data-edit-id': 'hero.badge' }, [
          el('i', { class: 'pill__dot' }),
          el('span', {}, [badge]),
        ]) : null,
        title,
        el('p', { class: 'hero__sub', 'data-edit-id': 'hero.subtitle' }, [content('hero_subtitle')]),
        el('div', { class: 'hero__actions' }, [
          el('button', { class: 'btn btn--primary btn--lg', type: 'button',
            'data-edit-id': 'hero.cta',
            onclick: () => document.dispatchEvent(new CustomEvent('order:open')) },
            [content('hero_cta', 'اطلب تصميمك'), icon('arrow', { size: 18 })]),
          el('button', { class: 'btn btn--lg', type: 'button', 'data-edit-id': 'hero.cta_alt',
            onclick: () => document.getElementById('works')?.scrollIntoView({ behavior: 'smooth' }) },
            [content('hero_cta_alt', 'شوف الشغل')]),
        ]),
      ]),
      el('div', { class: 'hero__mark' }, [logoMark()]),
    ]),
  );

  applyEditable(root, opts);
}
