// ============================================================
// sortable.js — سحب وإفلات بمؤشّر واحد (فأرة ولمس معاً).
//
// لماذا لا HTML5 Drag & Drop: لا يعمل على اللمس، ولا يمكن تنسيق شبحه.
// Pointer Events يعطي سلوكاً واحداً متسقاً على كل الأجهزة.
//
// الأداء — لماذا لا «يعلّق»:
//   · مواضع الصفوف تُقاس مرة واحدة عند بدء السحب، لا في كل حركة.
//   · الشبح يتحرّك بـ transform فقط — صفر إعادة تخطيط أثناء السحب.
//   · الحركة تمرّ عبر requestAnimationFrame — إطار واحد لكل رسم.
// ============================================================
import { on } from '../core/dom.js';

const HOLD_MS = 130;      // ضغطة مطوّلة على اللمس قبل خطف التمرير
const MOVE_TOL = 6;       // تحمّل اهتزاز الإصبع قبل اعتبارها سحباً
const EDGE = 64;          // منطقة التمرير التلقائي عند حافّة الحاوية
const EDGE_SPEED = 12;

/**
 * @param {HTMLElement} list الحاوية — أبناؤها المباشرون [data-id] هم الصفوف
 * @param {Function} onReorder يُستدعى بمصفوفة المعرّفات بالترتيب الجديد
 * @param {object} o {handle}
 * @returns {Function} دالة إيقاف
 */
export function makeSortable(list, onReorder, o = {}) {
  const handleSel = o.handle || '.grip';
  let st = null;
  let raf = 0;

  const rows = () => [...list.children].filter((n) => n.dataset && n.dataset.id);
  const scroller = () => list.closest('#main, .drawer__body') || document.scrollingElement;

  function down(e) {
    if (e.button != null && e.button !== 0) return;
    const handle = e.target.closest(handleSel);
    if (!handle || !list.contains(handle)) return;
    const row = handle.closest('[data-id]');
    if (!row || row.parentElement !== list) return;

    st = {
      row, startY: e.clientY, moved: 0, active: false,
      touch: e.pointerType === 'touch', startAt: Date.now(),
      pointerId: e.pointerId, y: e.clientY,
    };
    if (!st.touch) begin(e);
    e.preventDefault();
  }

  function begin(e) {
    if (!st || st.active) return;
    const { row } = st;
    const rect = row.getBoundingClientRect();

    // القياس مرة واحدة — لا قياس داخل حلقة الحركة
    st.rects = rows().map((n) => {
      const r = n.getBoundingClientRect();
      return { node: n, mid: r.top + r.height / 2 };
    });
    st.from = st.rects.findIndex((r) => r.node === row);

    const ghost = row.cloneNode(true);
    ghost.classList.add('sort-ghost');
    // ⚠️ إحداثيات getBoundingClientRect فيزيائية (left/top دائماً).
    //    استعمال inset-inline-start معها يقلب الشبح إلى الجهة المقابلة
    //    في صفحة RTL — فيقفز بعيداً عن الصفّ الذي تسحبه.
    Object.assign(ghost.style, {
      position: 'fixed', margin: '0', insetInlineStart: 'auto', insetInlineEnd: 'auto',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    document.body.append(ghost);

    const slot = document.createElement('div');
    slot.className = 'sort-slot';
    slot.style.blockSize = `${rect.height}px`;
    row.after(slot);
    row.classList.add('is-dragging');
    row.style.display = 'none';

    Object.assign(st, {
      ghost, slot, active: true,
      offsetY: e.clientY - rect.top,
      baseTop: rect.top,
    });
    list.classList.add('is-sorting');
    document.body.style.userSelect = 'none';
    try { list.setPointerCapture(st.pointerId); } catch { /* */ }
    raf = requestAnimationFrame(paint);
  }

  function move(e) {
    if (!st) return;
    st.y = e.clientY;
    st.moved = Math.max(st.moved, Math.abs(e.clientY - st.startY));

    if (!st.active) {
      if (st.touch && Date.now() - st.startAt < HOLD_MS) return;
      if (st.moved < MOVE_TOL) return;
      begin(e);
      return;
    }
    e.preventDefault();
  }

  /** الرسم كله هنا — إطار واحد لكل تحديث. */
  function paint() {
    if (!st || !st.active) { raf = 0; return; }

    st.ghost.style.transform = `translate3d(0, ${st.y - st.offsetY - st.baseTop}px, 0)`;

    // تمرير تلقائي عند الحافّة حتى تصل لقوائم أطول من الشاشة
    const sc = scroller();
    if (sc) {
      const r = sc === document.scrollingElement
        ? { top: 0, bottom: innerHeight }
        : sc.getBoundingClientRect();
      if (st.y < r.top + EDGE) sc.scrollTop -= EDGE_SPEED;
      else if (st.y > r.bottom - EDGE) sc.scrollTop += EDGE_SPEED;
    }

    // أي صف يقع المؤشر فوقه؟ بحث خطّي على قياسات محفوظة — رخيص جداً
    let target = null;
    for (const r of st.rects) {
      if (r.node === st.row) continue;
      if (st.y < r.mid) { target = r.node; break; }
    }
    if (target) { if (st.slot.nextSibling !== target) list.insertBefore(st.slot, target); }
    else if (list.lastElementChild !== st.slot) list.append(st.slot);

    raf = requestAnimationFrame(paint);
  }

  function up() {
    if (!st) return;
    const s = st;
    st = null;
    cancelAnimationFrame(raf);
    raf = 0;
    if (!s.active) return;

    try { list.releasePointerCapture(s.pointerId); } catch { /* */ }
    s.ghost.remove();
    s.row.style.display = '';
    s.row.classList.remove('is-dragging');
    s.slot.replaceWith(s.row);
    list.classList.remove('is-sorting');
    document.body.style.userSelect = '';

    const ids = rows().map((n) => n.dataset.id);
    const to = ids.indexOf(s.row.dataset.id);
    if (to !== s.from) onReorder?.(ids, { from: s.from, to });
  }

  const offs = [
    on(list, 'pointerdown', down),
    on(list, 'pointermove', move, { passive: false }),
    on(list, 'pointerup', up),
    on(list, 'pointercancel', up),
    on(window, 'blur', up),
  ];

  return () => { up(); offs.forEach((f) => f()); };
}
