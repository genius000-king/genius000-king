// ============================================================
// grid-canvas.js — لوحة مربّعات على شبكة اثني عشر عموداً:
// تُمسك المربّعة فتُنقل، وتُسحب حافّتها فتكبر وتصغر.
//
// لماذا ليست sortable.js: تلك رأسيّة بحتة — تقارن clientY بمنتصف كل
// صفّ. هنا مربّعتان تقفان جنب بعض في صفٍّ واحد، فالمقارنة الرأسية
// وحدها تخلط بينهما. الاختبار هنا ثنائيّ البعد: أيّ مربّعة تحت
// المؤشّر، وهل تجاوزها المؤشّر أفقياً أم لا.
//
// ولماذا بلا شبح: في الشبكة يعيد المتصفّح التدفّق مجاناً، فتحريك
// العنصر نفسه يُظهر النتيجة الحقيقية أثناء السحب لا تقريباً لها.
//
// ⚠️ الاتجاه: اللوحة عربية RTL، وإحداثيات getBoundingClientRect
// فيزيائية دائماً (left هو اليسار مهما كان الاتجاه). فحافّة البداية
// في RTL هي right لا left — وخلطُهما يقلب التكبير إلى تصغير.
// ============================================================
import { on } from '../core/dom.js';

const COLS = 12;
const MOVE_TOL = 6;    // تحمّل اهتزاز الإصبع قبل اعتبارها سحباً
const HOLD_MS = 130;   // ضغطة مطوّلة على اللمس قبل خطف التمرير

/**
 * @param {HTMLElement} canvas الحاوية — أبناؤها [data-id] هي المربّعات
 * @param {object} o
 *   @param {Function} o.onReorder (ids) => void — بعد إفلات نقلة
 *   @param {Function} o.onResize  (id, span) => void — بعد إفلات تكبير
 *   @param {Function} o.onSpanLive (id, span) => void — أثناء السحب، للتسمية
 * @returns {Function} دالة إيقاف
 */
export function makeGridCanvas(canvas, o = {}) {
  let st = null;

  const blocks = () => [...canvas.children].filter((n) => n.dataset && n.dataset.id);
  const isRtl = () => getComputedStyle(canvas).direction === 'rtl';

  /** عرض العمود الواحد بالبكسل، شاملاً فجوةً واحدة. */
  function colWidth() {
    const r = canvas.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(canvas).columnGap) || 0;
    return (r.width + gap) / COLS;
  }

  const clampSpan = (n) => Math.min(COLS, Math.max(1, Math.round(n)));

  // ── بدء ──
  function down(e) {
    if (e.button != null && e.button !== 0) return;

    const grow = e.target.closest('[data-resize]');
    // المفتاح والزرّ داخل المربّعة ينتظران نقرةً، والسحب يبتلعها
    // بـ preventDefault. فما كان تفاعلياً فليس مقبضاً.
    if (!grow && e.target.closest('button, input, label, select, textarea, a')) return;
    const grip = e.target.closest('[data-grip]');
    const handle = grow || grip;
    if (!handle || !canvas.contains(handle)) return;

    const block = handle.closest('[data-id]');
    if (!block || block.parentElement !== canvas) return;

    const rect = block.getBoundingClientRect();
    st = {
      mode: grow ? 'resize' : 'move',
      block, rect, active: false,
      startX: e.clientX, startY: e.clientY, moved: 0,
      touch: e.pointerType === 'touch', startAt: Date.now(),
      pointerId: e.pointerId,
      // الحافّة الثابتة: يبقى القسم معلَّقاً بها والسحب يغيّر الطرف الآخر
      anchor: isRtl() ? rect.right : rect.left,
      span0: Number(block.dataset.span) || COLS,
      span: Number(block.dataset.span) || COLS,
    };
    if (!st.touch) begin();
    e.preventDefault();
  }

  function begin() {
    if (!st || st.active) return;
    st.active = true;
    st.block.classList.add(st.mode === 'resize' ? 'is-resizing' : 'is-dragging');
    canvas.classList.add('is-editing');
    document.body.style.userSelect = 'none';
    try { canvas.setPointerCapture(st.pointerId); } catch { /* لا يهمّ */ }
  }

  // ── الحركة ──
  function move(e) {
    if (!st) return;
    st.moved = Math.max(st.moved,
      Math.abs(e.clientX - st.startX) + Math.abs(e.clientY - st.startY));

    if (!st.active) {
      if (st.touch && Date.now() - st.startAt < HOLD_MS) return;
      if (st.moved < MOVE_TOL) return;
      begin();
    }
    e.preventDefault();

    if (st.mode === 'resize') resizeTo(e.clientX);
    else moveTo(e.clientX, e.clientY);
  }

  /** التكبير: المسافة بين الحافّة الثابتة والمؤشّر، مقيسةً بالأعمدة. */
  function resizeTo(x) {
    const w = isRtl() ? st.anchor - x : x - st.anchor;
    const gap = parseFloat(getComputedStyle(canvas).columnGap) || 0;
    const span = clampSpan((w + gap) / colWidth());
    if (span === st.span) return;
    st.span = span;
    st.block.dataset.span = String(span);
    st.block.style.setProperty('--span', String(span));
    o.onSpanLive?.(st.block.dataset.id, span);
  }

  /** النقل: أيّ مربّعة تحت المؤشّر، وقبلها أم بعدها. */
  function moveTo(x, y) {
    const over = blocks().find((n) => {
      if (n === st.block) return false;
      const r = n.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    });
    if (!over) return;

    const r = over.getBoundingClientRect();
    // في صفٍّ واحد يفصل المنتصف الأفقي؛ وبين صفَّين يفصل الرأسي.
    const sameRow = Math.abs(r.top - st.block.getBoundingClientRect().top) < r.height / 2;
    const after = sameRow
      ? (isRtl() ? x < r.left + r.width / 2 : x > r.left + r.width / 2)
      : y > r.top + r.height / 2;

    if (after) { if (over.nextSibling !== st.block) over.after(st.block); }
    else if (over.previousSibling !== st.block) over.before(st.block);
  }

  // ── الإفلات ──
  function up() {
    if (!st) return;
    const s = st;
    st = null;
    try { canvas.releasePointerCapture(s.pointerId); } catch { /* لا يهمّ */ }
    if (!s.active) return;

    s.block.classList.remove('is-dragging', 'is-resizing');
    canvas.classList.remove('is-editing');
    document.body.style.userSelect = '';

    if (s.mode === 'resize') {
      if (s.span !== s.span0) o.onResize?.(s.block.dataset.id, s.span);
    } else {
      o.onReorder?.(blocks().map((n) => n.dataset.id));
    }
  }

  const offs = [
    on(canvas, 'pointerdown', down),
    on(canvas, 'pointermove', move, { passive: false }),
    on(canvas, 'pointerup', up),
    on(canvas, 'pointercancel', up),
    on(window, 'blur', up),
  ];

  return () => { up(); offs.forEach((f) => f()); };
}
