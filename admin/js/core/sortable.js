// sortable.js — إعادة الترتيب بالسحب، بلا أي مكتبة.
// نظام «خانات» فقط: العناصر تتبادل مواقعها داخل القائمة. ❌ لا تموضع حر
// (position:absolute مع إزاحات) — التموضع الحر ينكسر على بقية المقاسات.
// الفأرة: السحب الأصلي في HTML5. اللمس: بديل عبر Pointer Events.
import { qsa, on } from './dom.js';
import { axisOf, slotAt, mark, unmark, createGhost } from './drag-visual.js';

/** ينقل عنصراً من موقع لآخر. دالة خالصة: تعيد مصفوفة جديدة ولا تمسّ المدخل. */
export function reorderArray(arr, from, to) {
  const out = Array.isArray(arr) ? arr.slice() : [];
  if (out.length < 2) return out;
  const f = Math.trunc(Number(from));
  const t = Math.trunc(Number(to));
  if (!Number.isFinite(f) || !Number.isFinite(t)) return out;
  if (f < 0 || f >= out.length) return out;
  const dest = Math.min(Math.max(t, 0), out.length - 1);
  if (dest === f) return out;
  const [moved] = out.splice(f, 1);
  out.splice(dest, 0, moved);
  return out;
}

const HOLD_MS = 220;   // ضغطة مطوّلة تبدأ السحب باللمس

/**
 * يفعّل السحب والإفلات على أبناء `container` المباشرين.
 * كل ابن يحمل `data-sort-id` (أو `data-id`). المقبض اختياري: `[data-drag-handle]`.
 * `onReorder(ids, from, to)` تُنادى مرة واحدة عند الإفلات.
 * يعيد دالة تنظيف تزيل كل مستمع وكل عنصر مُحقَن.
 */
export function makeSortable(container, onReorder) {
  if (!container) return () => {};
  container.classList.add('sortable');

  const offs = [];
  let items = [];
  let from = -1;      // موقع العنصر المسحوب
  let slot = -1;      // الخانة المستهدفة (0..n) — الإدراج قبل items[slot]
  let ghost = null;
  let hold = 0;
  let live = false;

  const list = () => qsa(':scope > *', container).filter((n) => !n.hasAttribute('data-no-sort'));
  const idOf = (n, i) => n.dataset.sortId || n.dataset.id || n.id || String(i);

  function itemOf(target, needHandle = false) {
    const row = target?.closest?.('.sortable__item');
    if (!row || row.parentElement !== container) return null;
    const handle = row.querySelector('[data-drag-handle]');
    if (needHandle && handle && !target.closest('[data-drag-handle]')) return null;
    return row;
  }

  function place(x, y) {
    const idx = slotAt(items, x, y);
    if (idx === slot) return;
    slot = idx;
    mark(items, idx);
  }

  function begin(node) {
    items = list();
    from = items.indexOf(node);
    if (from < 0) return false;
    live = true; slot = -1;
    node.classList.add('is-dragging');
    container.classList.add('is-sorting');
    container.dataset.axis = axisOf(items).row ? 'row' : 'column';
    return true;
  }

  function finish(commit) {
    clearTimeout(hold);
    const start = from, target = slot;
    ghost?.remove(); ghost = null;
    unmark(items);
    items.forEach((n) => n.classList.remove('is-dragging'));
    container.classList.remove('is-sorting');
    live = false; from = -1; slot = -1;
    if (!commit || start < 0 || target < 0) return;
    const to = target > start ? target - 1 : target;
    if (to === start) return;
    onReorder?.(reorderArray(items.map(idOf), start, to), start, to);
  }

  /* --- المسار الأصلي: الفأرة (HTML5 Drag & Drop) --- */
  offs.push(on(container, 'dragstart', (e) => {
    const node = itemOf(e.target);
    if (!node || !begin(node)) return;
    e.dataTransfer?.setData('text/plain', idOf(node, from));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }));
  offs.push(on(container, 'dragover', (e) => {
    if (!live) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    place(e.clientX, e.clientY);
  }));
  offs.push(on(container, 'drop', (e) => { if (!live) return; e.preventDefault(); finish(true); }));
  offs.push(on(container, 'dragend', () => finish(false)));

  /* --- البديل باللمس: Pointer Events --- */
  offs.push(on(container, 'pointerdown', (e) => {
    if (e.pointerType === 'mouse' || e.button > 0) return;
    const node = itemOf(e.target, true);
    if (!node) return;
    const { clientX: x, clientY: y, pointerId } = e;
    hold = setTimeout(() => {
      if (!begin(node)) return;
      ghost = createGhost(node, x, y);
      try { container.setPointerCapture(pointerId); } catch { /* غير مدعوم */ }
    }, HOLD_MS);
  }));
  offs.push(on(container, 'pointermove', (e) => {
    if (!live) { clearTimeout(hold); return; }
    e.preventDefault();
    ghost?.move(e.clientX, e.clientY);
    place(e.clientX, e.clientY);
  }, { passive: false }));
  const end = (e) => {
    clearTimeout(hold);
    if (!live) return;
    try { container.releasePointerCapture(e.pointerId); } catch { /* تجاهل */ }
    finish(e.type === 'pointerup');
  };
  offs.push(on(container, 'pointerup', end));
  offs.push(on(container, 'pointercancel', end));

  /* --- بديل لوحة المفاتيح: سهما أعلى/أسفل مع تركيز العنصر (وصول) --- */
  offs.push(on(container, 'keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const node = itemOf(e.target);
    if (!node) return;
    items = list();
    const i = items.indexOf(node);
    const to = e.key === 'ArrowUp' ? i - 1 : i + 1;
    if (i < 0 || to < 0 || to >= items.length) return;
    e.preventDefault();
    onReorder?.(reorderArray(items.map(idOf), i, to), i, to);
  }));

  /* --- تهيئة الأبناء، وإعادة تهيئتهم بعد أي إعادة بناء --- */
  const prepare = () => list().forEach((n) => {
    n.classList.add('sortable__item');
    n.setAttribute('draggable', 'true');
  });
  prepare();
  const mo = new MutationObserver(prepare);
  mo.observe(container, { childList: true });

  return function destroy() {
    mo.disconnect();
    offs.forEach((f) => f());
    clearTimeout(hold);
    ghost?.remove(); ghost = null;
    for (const n of list()) {
      n.classList.remove('sortable__item', 'is-dragging', 'is-drop-start', 'is-drop-end');
      n.removeAttribute('draggable');
    }
    container.classList.remove('sortable', 'is-sorting');
    delete container.dataset.axis;
  };
}

export default makeSortable;
