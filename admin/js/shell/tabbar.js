// tabbar.js — شريط تبويب سفلي للجوال. نفس خريطة التنقّل.
import { el, on } from '../core/dom.js';
import { icon } from '../ui/icon.js';
import { go } from '../core/router.js';
import { TABS } from './nav-map.js';

let tabs = [];

export function mountTabbar(root) {
  tabs = TABS.map((item) => {
    const badge = el('span', { class: 'tab__badge' });
    if (item.badge) on(document, 'badge:' + item.badge,
      (e) => { badge.textContent = e.detail.count ? String(e.detail.count) : ''; });
    return el('a', {
      class: 'tab', href: `#${item.path}`, 'data-path': item.path,
      onclick: (e) => { e.preventDefault(); go(item.path); },
    }, [icon(item.icon, { size: 19 }), el('span', {}, [item.label]), badge]);
  });
  root.replaceChildren(...tabs);
}

export function setActiveTab(path) {
  tabs.forEach((a) => {
    const on = a.dataset.path === path || (path.startsWith(a.dataset.path) && a.dataset.path !== '/');
    a.setAttribute('aria-current', on ? 'page' : 'false');
  });
}
