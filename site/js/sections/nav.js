// nav — شريط علوي زجاجي + قائمة جوال + شريط تقدّم التمرير.
// كل الروابط داخلية بتمرير سلس — لا تغيّر الرابط إطلاقاً.
import { el, qs, on } from '../core/dom.js';
import { content } from '../core/store.js';
import { icon } from '../components/icon.js';
import { applyEditable } from '../components/editable.js';

const LINKS = [
  ['works', 'works_title'], ['packages', 'packages_title'],
  ['services', 'services_title'], ['process', 'process_title'],
  ['testimonials', 'testimonials_title'],
];

function goTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function mount(root, opts = {}) {
  const links = LINKS.map(([id, key]) =>
    el('button', { class: 'nav__link', type: 'button', onclick: () => goTo(id) }, [content(key)]));

  const menu = el('div', { class: 'nav__menu', id: 'navMenu', hidden: true },
    LINKS.map(([id, key]) =>
      el('button', { class: 'nav__menu-link', type: 'button',
        onclick: () => { toggle(false); goTo(id); } }, [content(key)])));

  const burger = el('button', {
    class: 'btn btn--icon nav__burger', type: 'button',
    'aria-label': 'القائمة', 'aria-expanded': 'false', 'aria-controls': 'navMenu',
    onclick: () => toggle(menu.hidden),
  }, [icon('menu')]);

  function toggle(open) {
    menu.hidden = !open;
    burger.setAttribute('aria-expanded', String(open));
    burger.replaceChildren(icon(open ? 'close' : 'menu'));
    document.body.style.overflow = open ? 'hidden' : '';
  }

  root.replaceChildren(
    el('div', { class: 'nav__bar container', 'data-edit-id': 'nav.bar' }, [
      el('button', { class: 'nav__brand', type: 'button', 'data-edit-id': 'nav.brand',
        'data-fx': 'scramble', onclick: () => scrollTo({ top: 0, behavior: 'smooth' }) },
        [content('brand')]),
      el('nav', { class: 'nav__links', 'aria-label': 'أقسام الصفحة' }, links),
      el('button', { class: 'btn btn--primary nav__cta', type: 'button',
        'data-edit-id': 'nav.cta', 'data-fx': 'magnetic',
        onclick: () => document.dispatchEvent(new CustomEvent('order:open')) },
        [content('hero_cta')]),
      burger,
    ]),
    menu,
  );

  // شريط التقدّم + إظهار زر «للأعلى»
  const bar = document.getElementById('scrollProgress');
  const toTop = document.getElementById('toTop');
  if (toTop && !toTop.firstChild) {
    toTop.append(icon('up'));
    toTop.className = 'btn btn--icon to-top';
    on(toTop, 'click', () => scrollTo({ top: 0, behavior: 'smooth' }));
  }
  on(window, 'scroll', () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? scrollY / max : 0;
    if (bar) bar.style.setProperty('--progress', String(p));
    root.classList.toggle('is-stuck', scrollY > 12);
    if (toTop) toTop.hidden = scrollY < innerHeight * 0.8;
  }, { passive: true });

  applyEditable(root, opts);
}
