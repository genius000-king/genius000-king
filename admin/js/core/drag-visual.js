// drag-visual.js — هندسة الخانات ومؤثّرات السحب المرئية، مفصولة عن منطق الترتيب.
// كلها تعمل على المواقع الفعلية للعناصر، فتصحّ في RTL وLTR بلا فرع خاص.

/** يستنتج محور القائمة واتجاهها من موقعَي أول عنصرين. */
export function axisOf(items) {
  if (items.length < 2) return { row: false, rtl: false };
  const a = items[0].getBoundingClientRect(), b = items[1].getBoundingClientRect();
  const row = Math.abs(b.top - a.top) < Math.abs(b.left - a.left);
  return { row, rtl: row && b.left < a.left };
}

/** يعيد رقم الخانة (0..items.length) التي يقع فيها المؤشّر — الإدراج قبل items[i]. */
export function slotAt(items, x, y) {
  const { row, rtl } = axisOf(items);
  for (let i = 0; i < items.length; i++) {
    const r = items[i].getBoundingClientRect();
    const mid = row ? r.left + r.width / 2 : r.top + r.height / 2;
    const p = row ? x : y;
    if (rtl ? p > mid : p < mid) return i;
  }
  return items.length;
}

/** يمسح مؤشّر الإفلات عن كل العناصر. */
export function unmark(items) {
  items.forEach((n) => n.classList.remove('is-drop-start', 'is-drop-end'));
}

/** يرسم خط الإفلات المتوهّج على حافة الخانة — عنصر زائف، بلا إزاحة تخطيط. */
export function mark(items, idx) {
  unmark(items);
  if (idx < 0 || !items.length) return;
  if (items[idx]) items[idx].classList.add('is-drop-start');
  else items[items.length - 1].classList.add('is-drop-end');
}

/**
 * ينشئ شبحاً شبه شفاف يتبع الإصبع (بديل اللمس — الفأرة تستعمل صورة السحب الأصلية).
 * يعيد `{ move, remove }`.
 */
export function createGhost(node, x, y) {
  const r = node.getBoundingClientRect();
  const el = node.cloneNode(true);
  el.removeAttribute('id');
  el.classList.add('sortable__ghost');
  el.classList.remove('is-dragging', 'is-drop-start', 'is-drop-end');
  el.setAttribute('aria-hidden', 'true');
  el.style.setProperty('inline-size', `${r.width}px`);
  el.style.setProperty('block-size', `${r.height}px`);
  document.body.append(el);

  let gx = 0, gy = 0;
  function move(px, py) {
    const g = el.getBoundingClientRect();   // تصحيح ذاتي من الموقع الفعلي
    gx += px - (g.left + g.width / 2);
    gy += py - (g.top + g.height / 2);
    el.style.translate = `${gx}px ${gy}px`;
  }
  move(x, y);
  return { move, remove: () => el.remove() };
}
