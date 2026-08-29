// hero — بينتو: عنوان ضخم + بلاطة الشعار بالجسيمات + بلاطات أرقام.
import { el } from '../core/dom.js';
import { content, get } from '../core/store.js';
import { icon } from '../components/icon.js';
import { logoParticleTile } from '../components/logo.js';
import { applyEditable } from '../components/editable.js';

/** بلاطتان صغيرتان من مفاتيح stat_1 و stat_2 — تُحذفان إن لم توجدا. */
function miniTiles() {
  const out = [];
  for (let i = 1; i <= 3; i++) {
    const v = content(`stat_${i}_value`);
    if (!v) continue;
    out.push(el('div', { class: 'hero__mini glass glass--soft t--third' }, [
      el('span', { class: 'hero__mini-value', 'data-fx': 'counter',
        'data-fx-to': String(v).replace(/\D/g, ''), 'data-fx-suffix': '+' }, [v]),
      el('span', { class: 'hero__mini-label' }, [content(`stat_${i}_label`)]),
    ]));
  }
  return out;
}

export function mount(root, opts = {}) {
  const t1 = content('hero_title_1');
  const hl = content('hero_title_hl');
  const t2 = content('hero_title_2');

  const title = el('h1', { class: 'hero__title', 'data-edit-id': 'hero.title' }, [
    t1 ? el('span', { class: 'hero__word', 'data-fx': 'split-text' }, [t1]) : null,
    t1 && hl ? ' ' : null,
    hl ? el('span', { class: 'hero__word hero__word--hl', 'data-fx': 'split-text' }, [hl]) : null,
    (t1 || hl) && t2 ? ' ' : null,
    t2 ? el('span', { class: 'hero__word', 'data-fx': 'split-text' }, [t2]) : null,
  ]);

  const badge = content('status_badge');

  root.replaceChildren(
    el('div', { class: 'bento' }, [
      el('div', { class: 'hero__main glass glass--strong t--hero', 'data-fx': 'reveal3d glass' }, [
        badge ? el('span', { class: 'pill glass glass--soft', 'data-edit-id': 'hero.badge' }, [
          el('i', { class: 'pill__dot' }),
          el('span', {}, [badge]),
        ]) : null,
        title,
        el('p', { class: 'hero__sub', 'data-edit-id': 'hero.subtitle' }, [content('hero_subtitle')]),
        el('div', { class: 'hero__actions' }, [
          el('button', { class: 'btn btn--primary btn--lg', type: 'button',
            'data-edit-id': 'hero.cta', 'data-fx': 'magnetic',
            onclick: () => document.dispatchEvent(new CustomEvent('order:open')) },
            [content('hero_cta', 'اطلب تصميمك'), icon('arrow', { size: 18 })]),
          el('button', { class: 'btn btn--lg', type: 'button', 'data-edit-id': 'hero.cta_alt',
            'data-fx': 'magnetic',
            onclick: () => document.getElementById('works')?.scrollIntoView({ behavior: 'smooth' }) },
            [content('hero_cta_alt', 'شوف الشغل')]),
        ]),
      ]),
      logoParticleTile(),
      ...miniTiles(),
      el('div', { class: 'hero__scroll glass glass--soft' }, [
        icon('arrowDown', { size: 16 }),
        el('span', {}, ['مرّر لتشوف الشغل']),
      ]),
    ]),
  );

  applyEditable(root, opts);
}
