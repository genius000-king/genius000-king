// layout-panel.js — لوح التخطيط الجانبي: ترتيب الأقسام وإعداداتها.
// الترتيب بالسحب إلى خانة (slot) فقط — لا مواضع حرّة، ولا إعادة ترتيب للـ DOM
// في الصفحة نفسها: `reorderSections` تكتب `sort` وتترك CSS `order` يتكفّل بالعرض.
import { el, qs, on } from '../core/dom.js';
import { get } from '../core/store.js';
import { applyLayout, reorderSections, addCustomSection } from '../core/layout.js';
import { sectionRow } from './layout-row.js';
import { saveNow as autosave } from '../core/autosave.js';

let root = null;
let offEsc = null;

const ordered = () => get('layout').slice()
  .sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0));

const keysOf = (list) => [...list.querySelectorAll('.lt-row')].map((li) => li.dataset.key);

/** الصف الذي يجب أن تسبقه الخانة الهدف، حسب موضع المؤشّر. */
function rowAfter(list, y, dragged) {
  return [...list.querySelectorAll('.lt-row')]
    .filter((li) => li !== dragged)
    .find((li) => { const r = li.getBoundingClientRect(); return y < r.top + r.height / 2; }) || null;
}

/** يربط السحب والإفلات على القائمة مع خط الإفلات المتوهّج. */
function bindDrag(list, onDrop) {
  const line = el('li', { class: 'lt-drop', 'aria-hidden': 'true' });
  let dragged = null;
  const end = () => { line.remove(); dragged?.classList.remove('is-dragging'); dragged = null; };

  on(list, 'dragstart', (e) => {
    const li = e.target.closest?.('.lt-row');
    if (!li) return;
    dragged = li;
    li.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', li.dataset.key || '');
  });
  on(list, 'dragover', (e) => {
    if (!dragged) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const after = rowAfter(list, e.clientY, dragged);
    after ? list.insertBefore(line, after) : list.append(line);
  });
  on(list, 'drop', (e) => {
    if (!dragged) return;
    e.preventDefault();
    if (line.parentNode === list) list.insertBefore(dragged, line);
    const keys = (line.remove(), keysOf(list));
    dragged.classList.remove('is-dragging');
    dragged = null;
    onDrop(keys);
  });
  on(list, 'dragend', end);
}

function build() {
  const list = el('ul', { class: 'lt-list' });
  const draw = () => list.replaceChildren(...ordered().map((r) => sectionRow(r)));
  draw();
  bindDrag(list, (keys) => autosave(() => reorderSections(keys)));

  const addBtn = el('button', { class: 'btn lt__add', type: 'button',
    onclick: () => autosave(async () => { await addCustomSection(); draw(); }) },
  ['أضف قسماً مخصصاً']);

  return el('aside', { class: 'side', 'data-panel': 'layout', role: 'dialog',
    'aria-label': 'لوح التخطيط' }, [
    el('div', { class: 'side__head' }, [
      el('span', { class: 'side__title' }, ['التخطيط']),
      el('span', { class: 'side__sub' }, ['الترتيب والأعمدة والخلفيات']),
      el('button', { class: 'side__close btn', type: 'button', 'aria-label': 'إغلاق',
        onclick: () => closeLayoutPanel() }, ['×']),
    ]),
    el('div', { class: 'side__body' }, [list, addBtn]),
  ]);
}

/** يفتح لوح التخطيط (ويبنيه عند أول فتح). */
export function openLayoutPanel() {
  if (root) return root;
  applyLayout();
  root = build();
  (document.getElementById('panelRoot') || document.body).append(root);
  requestAnimationFrame(() => root?.classList.add('is-open'));
  offEsc = on(document, 'keydown', (e) => { if (e.key === 'Escape') closeLayoutPanel(); });
  return root;
}

/** يغلق اللوح ويزيله. */
export function closeLayoutPanel() {
  if (!root) return;
  offEsc?.();
  offEsc = null;
  root.classList.remove('is-open');
  const node = root;
  root = null;
  setTimeout(() => node.remove(), 350);
}

export function isLayoutPanelOpen() { return !!root; }

// الشريط العلوي يبثّ `leader:layout` — لا اقتران مباشر بينه وبين هذا الملف.
on(document, 'leader:layout', () => (root ? closeLayoutPanel() : openLayoutPanel()));
