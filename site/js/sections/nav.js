// nav — شريط علوي زجاجي، قائمة جوال ملء الشاشة، شريط تقدّم، تتبّع القسم النشط.
import { el, on, qsa, throttle } from '../core/dom.js';
import { content, get } from '../core/store.js';
import { icon } from '../components/icon.js';
import { logoImg } from '../components/logo.js';
import { applyEditable } from '../components/editable.js';

const LINKS = [
  ['works', 'works_title', 'الأعمال'],
  ['packages', 'packages_title', 'البكجات'],
  ['services', 'services_title', 'الخدمات'],
  ['process', 'process_title', 'كيف نشتغل'],
  ['testimonials', 'testimonials_title', 'آراء'],
];

function goTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** الأقسام المرئية فقط تظهر في القائمة — يقرأها من جدول layout. */
function visibleLinks() {
  const layout = get('layout');
  return LINKS.filter(([id]) => {
    const row = layout.find((l) => l.section_key === id);
    return !row || row.visible !== false;
  });
}

export function mount(root, opts = {}) {
  const links = visibleLinks();

  const linkBtns = links.map(([id, key, fb]) =>
    el('button', { class: 'nav__link', type: 'button', 'data-link': id,
      onclick: () => goTo(id) }, [content(key, fb)]));

  const menu = el('div', { class: 'nav__menu', id: 'navMenu', hidden: true }, [
    ...links.map(([id, key, fb], i) =>
      el('button', { class: 'nav__menu-link', type: 'button', style: { '--i': i },
        onclick: () => { toggle(false); goTo(id); } }, [content(key, fb)])),
    el('button', { class: 'btn btn--primary btn--lg btn--block', type: 'button',
      style: { '--i': links.length },
      onclick: () => { toggle(false); document.dispatchEvent(new CustomEvent('order:open')); } },
      [content('hero_cta', 'اطلب تصميمك'), icon('arrow', { size: 18 })]),
  ]);

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
    if (open) menu.querySelector('button')?.focus();
  }

  root.replaceChildren(
    el('div', { class: 'nav__bar glass glass--soft container', 'data-edit-id': 'nav.bar' }, [
      el('button', { class: 'nav__brand', type: 'button', 'data-edit-id': 'nav.brand',
        'aria-label': 'العودة لأعلى الصفحة',
        onclick: () => scrollTo({ top: 0, behavior: 'smooth' }) }, [
        logoImg({ size: 34, cls: 'nav__logo' }),
        el('span', { class: 'nav__brand-text' }, [content('brand', 'aboal3z.dzn')]),
      ]),
      el('nav', { class: 'nav__links', 'aria-label': 'أقسام الصفحة' }, linkBtns),
      el('button', { class: 'btn btn--primary nav__cta', type: 'button',
        'data-edit-id': 'nav.cta', 'data-fx': 'magnetic',
        onclick: () => document.dispatchEvent(new CustomEvent('order:open')) },
        [content('hero_cta', 'اطلب تصميمك')]),
      burger,
    ]),
    menu,
  );

  on(document, 'keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) toggle(false); });

  // ── شريط التقدّم + زر الأعلى + القسم النشط ──
  const bar = document.getElementById('scrollProgress');
  const toTop = document.getElementById('toTop');
  if (toTop && !toTop.firstChild) {
    toTop.append(icon('up'));
    toTop.className = 'btn btn--icon to-top';
    toTop.hidden = false;
    on(toTop, 'click', () => scrollTo({ top: 0, behavior: 'smooth' }));
  }

  const sections = links.map(([id]) => document.getElementById(id)).filter(Boolean);
  const spy = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      qsa('.nav__link', root).forEach((b) =>
        b.classList.toggle('is-active', b.dataset.link === e.target.id));
    }
  }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
  sections.forEach((s) => spy.observe(s));

  const onScroll = throttle(() => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, scrollY / max) : 0;
    if (bar) bar.style.setProperty('--progress', String(p));
    root.classList.toggle('is-stuck', scrollY > 12);
    if (toTop) toTop.classList.toggle('is-on', scrollY > innerHeight * 0.8);
  }, 80);
  on(window, 'scroll', onScroll, { passive: true });
  onScroll();

  applyEditable(root, opts);
}
