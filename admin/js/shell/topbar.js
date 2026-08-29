// topbar.js — المسار الحالي، حالة الحفظ، التراجع، الوضع الفاتح/الداكن.
import { el, on } from '../core/dom.js';
import { icon } from '../ui/icon.js';
import { toggleSidebar } from './sidebar.js';
import { undo, depth } from '../core/history.js';
import { toast } from '../core/toast.js';
import { titleOf } from './nav-map.js';

const THEME_KEY = 'aboal3z:admin-theme';

export function mountTopbar(root) {
  const crumb = el('div', { class: 'top__crumb' }, [el('b', {}, ['لوحة القيادة'])]);

  const save = el('span', { class: 'save-state', 'data-state': 'idle', role: 'status' });
  on(document, 'save:state', (e) => {
    const s = e.detail.state;
    save.dataset.state = s;
    save.textContent = { saving: 'يحفظ…', saved: 'تم الحفظ', error: 'تعذّر الحفظ' }[s] || '';
    if (s === 'error' && e.detail.message) toast(`تعذّر الحفظ: ${e.detail.message}`, 'error', 6000);
  });

  const undoBtn = el('button', {
    class: 'btn btn--icon btn--ghost', type: 'button', hidden: true,
    title: 'تراجع', 'aria-label': 'تراجع',
    onclick: async () => { const l = await undo(); if (l) toast(`تراجعنا عن: ${l}`, 'success'); },
  }, [icon('undo', { size: 17 })]);
  on(document, 'history:change', (e) => {
    undoBtn.hidden = e.detail.depth === 0;
    undoBtn.title = e.detail.label ? `تراجع عن: ${e.detail.label}` : 'تراجع';
  });

  /* ── الوضع الفاتح/الداكن ── */
  const stored = (() => { try { return localStorage.getItem(THEME_KEY); } catch { return null; } })();
  let mode = stored || 'dark';
  const themeBtn = el('button', {
    class: 'btn btn--icon btn--ghost', type: 'button',
    title: 'تبديل الوضع', 'aria-label': 'تبديل الوضع الفاتح والداكن',
    onclick: () => setTheme(mode === 'dark' ? 'light' : 'dark'),
  });
  function setTheme(m) {
    mode = m;
    document.documentElement.dataset.theme = m;
    themeBtn.replaceChildren(icon(m === 'dark' ? 'sun' : 'moon', { size: 17 }));
    try { localStorage.setItem(THEME_KEY, m); } catch { /* */ }
  }
  setTheme(mode);

  root.replaceChildren(
    el('button', { class: 'btn btn--icon btn--ghost top__menu', type: 'button',
      'aria-label': 'القائمة', onclick: toggleSidebar }, [icon('menu')]),
    crumb,
    el('span', { class: 'spacer' }),
    save,
    undoBtn,
    themeBtn,
    el('a', { class: 'btn btn--sm top__site', href: '../', target: '_blank', rel: 'noopener',
      title: 'فتح الموقع في تبويب جديد' }, [icon('external', { size: 15 }), 'الموقع']),
  );

  return {
    setCrumb(path, extra) {
      const base = '/' + (path.split('/')[1] || '');
      const parts = [el('b', {}, [titleOf(base) || 'لوحة القيادة'])];
      if (extra) parts.push(el('span', {}, ['/']), el('span', { class: 'mono' }, [extra]));
      crumb.replaceChildren(...parts);
    },
  };
}
