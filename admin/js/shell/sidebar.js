// sidebar.js — التنقّل الرئيسي. يُغلق تلقائياً بعد الاختيار على الجوال.
import { el, on } from '../core/dom.js';
import { icon } from '../ui/icon.js';
import { go } from '../core/router.js';
import { NAV } from './nav-map.js';
import { signOut, currentUser } from '../core/auth.js';
import { forget } from '../core/store.js';
import { logoImg } from './logo.js';

let links = [];
let badges = {};
let scrim = null;

export function mountSidebar(root) {
  links = [];
  const groups = NAV.map((g) => el('div', { class: 'side__group' }, [
    el('div', { class: 'side__group-title' }, [g.group]),
    ...g.items.map((item) => {
      const badge = el('span', { class: 'side__badge' });
      if (item.badge) badges[item.badge] = [...(badges[item.badge] || []), badge];
      const a = el('a', {
        class: 'side__link', href: `#${item.path}`, 'data-path': item.path,
        onclick: (e) => { e.preventDefault(); go(item.path); closeSidebar(); },
      }, [icon(item.icon, { size: 18 }), el('span', { class: 'grow' }, [item.label]), badge]);
      links.push(a);
      return a;
    }),
  ]));

  root.replaceChildren(
    el('div', { class: 'side__brand' }, [
      logoImg(32, 'side__logo'),
      el('div', { class: 'grow' }, [
        el('div', { class: 'side__name' }, ['aboal3z.dzn']),
        el('div', { class: 'side__role' }, [currentUser()?.email || 'لوحة التحكم']),
      ]),
    ]),
    ...groups,
    el('div', { style: { marginBlockStart: 'auto', paddingBlockStart: 'var(--a-4)' } }, [
      // على الجوال يختفي زرّ «الموقع» من الشريط العلوي الضيّق، فيبقى هنا
      el('a', { class: 'side__link', href: '../', target: '_blank', rel: 'noopener' },
        [icon('external', { size: 18 }), el('span', {}, ['فتح الموقع'])]),
      el('button', { class: 'side__link', type: 'button', style: { inlineSize: '100%' },
        onclick: () => { forget(); signOut(); location.reload(); } },
        [icon('logout', { size: 18 }), el('span', {}, ['تسجيل الخروج'])]),
    ]),
  );

  scrim = el('div', { class: 'side-scrim', onclick: closeSidebar });
  document.body.append(scrim);
  on(document, 'keydown', (e) => { if (e.key === 'Escape') closeSidebar(); });
}

export function setActive(path) {
  links.forEach((a) => {
    const on = a.dataset.path === path || (path.startsWith(a.dataset.path) && a.dataset.path !== '/');
    a.setAttribute('aria-current', on ? 'page' : 'false');
  });
}

export function setBadge(key, n) {
  (badges[key] || []).forEach((b) => { b.textContent = n ? String(n) : ''; });
  document.dispatchEvent(new CustomEvent('badge:' + key, { detail: { count: n } }));
}

export function toggleSidebar() {
  const s = document.getElementById('sidebar');
  const open = !s.classList.contains('is-open');
  s.classList.toggle('is-open', open);
  scrim?.classList.toggle('is-on', open);
}

export function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('is-open');
  scrim?.classList.remove('is-on');
}
