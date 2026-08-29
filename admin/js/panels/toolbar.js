// شريط الأدوات العلوي — الوضع، مبدّل العرض، الألواح، مؤشر الحفظ، خروج.
// كل زر يبثّ حدثاً على `document` ويستمع له من يعنيه — لا اقتران مباشر.
import { el, on } from '../core/dom.js';
import { icon } from '../components/icon.js';
import { signOut } from '../core/auth.js';

const VIEWS = [
  ['mobile', 'جوال', '390px'],
  ['tablet', 'لوحي', '768px'],
  ['desktop', 'سطح مكتب', '100%'],
];

function emit(name, detail) { document.dispatchEvent(new CustomEvent(name, { detail })); }

export function mountToolbar(root, { onReload } = {}) {
  const stage = document.getElementById('stage');

  /* --- الوضع: معاينة | تحرير --- */
  const modeBtns = ['preview', 'edit'].map((mode) =>
    el('button', { class: 'tb__btn', type: 'button', 'aria-pressed': String(mode === 'preview'),
      onclick: () => setMode(mode) }, [mode === 'preview' ? 'معاينة' : 'تحرير']));

  function setMode(mode) {
    modeBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === (mode === 'edit' ? 1 : 0))));
    document.body.dataset.mode = mode;
    emit('leader:mode', { mode });
  }

  /* --- مبدّل العرض --- */
  const viewBtns = VIEWS.map(([key, label, width]) =>
    el('button', { class: 'tb__btn', type: 'button', 'aria-pressed': String(key === 'desktop'),
      title: label, onclick: () => setView(key, width) }, [label]));

  function setView(key, width) {
    viewBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(VIEWS[i][0] === key)));
    stage.dataset.view = key;
    stage.style.setProperty('--preview-w', width);
    emit('leader:breakpoint', { breakpoint: key });
  }

  /* --- مؤشر الحفظ التلقائي --- */
  const save = el('span', { class: 'tb__save', 'data-state': 'idle', role: 'status' }, ['']);
  on(document, 'autosave:state', (e) => {
    const s = e.detail.state;
    save.dataset.state = s;
    save.textContent = { saving: 'يحفظ…', saved: 'تم الحفظ ✓', error: 'تعذّر الحفظ' }[s] || '';
  });

  /* --- شارة الطلبات غير المقروءة --- */
  const badge = el('span', { class: 'tb__badge' });
  on(document, 'orders:unread', (e) => {
    const n = Number(e.detail?.count || 0);
    badge.textContent = n ? String(n) : '';
  });

  const panelBtn = (label, event) =>
    el('button', { class: 'tb__btn', type: 'button', onclick: () => emit(event) }, [label]);

  root.replaceChildren(
    el('div', { class: 'tb__group' }, modeBtns),
    el('div', { class: 'tb__group' }, viewBtns),
    panelBtn('الثيم', 'leader:theme'),
    panelBtn('التخطيط', 'leader:layout'),
    el('button', { class: 'tb__btn', type: 'button', onclick: () => emit('leader:orders') },
      ['الطلبات', badge]),
    panelBtn('الكتالوج', 'leader:catalog'),
    panelBtn('مسح التجاوزات', 'leader:clear-overrides'),
    el('span', { class: 'tb__spacer' }),
    save,
    el('button', { class: 'tb__btn', type: 'button', title: 'تحديث المعاينة',
      onclick: () => onReload?.() }, [icon('arrow', { size: 16 })]),
    el('button', { class: 'tb__btn', type: 'button',
      onclick: () => { signOut(); location.reload(); } }, ['خروج']),
  );

  setMode('preview');
  setView('desktop', '100%');
}
