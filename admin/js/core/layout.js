// layout.js — يطبّق صفوف جدول `layout` على أقسام الصفحة.
// 🔑 الترتيب يُطبَّق بخاصية `order` على أبناء `#page` — لا يُعاد ترتيب الـ DOM أبداً،
//    لأن ذلك يهدم المؤثرات المركّبة ويكسر ترتيب التنقل بلوحة المفاتيح (Spec AD-5).
import { el, qs } from './dom.js';
import * as api from './api.js';
import { get, setAll, layoutOf } from './store.js';

// كل ما يمكن أن يهرب من قيمة CSS إلى قاعدة أو وسم أو سكربت.
const UNSAFE = /[}<;]|javascript:/i;
const GAP = /^var\(--s-[1-8]\)$/;
const ALIGN = new Set(['start', 'center', 'end', 'stretch']);

/**
 * قاعدة التقلّص المسؤولة عن حماية الجوال — دالة خالصة وغير قابلة للتجاوز.
 * سطح المكتب = العدد كما هو · لوحي = min(n, 2) · جوال = 1 دائماً.
 */
export function colsFor(n, breakpoint) {
  const cols = Math.min(Math.max(Math.trunc(Number(n)) || 1, 1), 4);
  if (breakpoint === 'mobile') return 1;
  if (breakpoint === 'tablet') return Math.min(cols, 2);
  return cols;
}

/** يصفّي قيمة الخلفية القادمة من القاعدة قبل حقنها في CSS؛ فراغ إن كانت خطرة. */
export function safeBg(value) {
  const v = String(value ?? '').trim();
  return v && !UNSAFE.test(v) ? v : '';
}

function safeGap(v) { return GAP.test(String(v ?? '').trim()) ? String(v).trim() : 'var(--s-4)'; }
function safeAlign(v) { return ALIGN.has(String(v ?? '').trim()) ? String(v).trim() : 'stretch'; }

/** عنصر القسم؛ ينشئ حاوية للأقسام المخصّصة إن لم تكن موجودة. */
function sectionEl(key) {
  const k = String(key ?? '').trim();
  if (!k || /["\\]/.test(k)) return null;
  const found = qs(`[data-section="${k}"]`);
  if (found) return found;
  const page = document.getElementById('page');
  if (!page || !k.startsWith('custom-')) return null;
  const node = el('section', { class: 'section', 'data-section': k, id: k });
  page.append(node);
  return node;
}

/** يزرع أو يزيل طبقة فيديو خلفية داخل القسم. */
function videoLayer(node, url) {
  let v = qs(':scope > .sec-bg-video', node);
  if (!url) { v?.remove(); return; }
  if (!v) {
    v = el('video', { class: 'sec-bg-video', muted: true, loop: true, playsinline: true,
      preload: 'metadata', 'aria-hidden': 'true', tabindex: '-1' });
    node.prepend(v);
  }
  if (v.getAttribute('src') !== url) v.setAttribute('src', url);
}

/** يطبّق الخلفية حسب نوعها. القيم مصفّاة مسبقاً. */
function applyBackground(node, type, rawValue) {
  const value = safeBg(rawValue);
  node.style.removeProperty('background-color');
  node.style.removeProperty('background-image');
  node.dataset.bg = type || 'none';
  videoLayer(node, type === 'video' ? value : '');
  if (!value) return;
  if (type === 'color') node.style.setProperty('background-color', value);
  else if (type === 'gradient') node.style.setProperty('background-image', value);
  else if (type === 'image') node.style.setProperty('background-image', `url("${encodeURI(value)}")`);
}

/**
 * يطبّق صفوف التخطيط على الصفحة.
 * @param {Array} rows صفوف `{section_key, sort, columns, align, gap, bg_type, bg_value, visible}`
 */
export function applyLayout(rows = get('layout')) {
  for (const row of rows || []) {
    const node = sectionEl(row.section_key);
    if (!node) continue;
    node.style.setProperty('--cols', String(colsFor(row.columns, 'desktop')));
    node.style.setProperty('--align', safeAlign(row.align));
    node.style.setProperty('--gap', safeGap(row.gap));
    node.style.setProperty('order', String(Math.trunc(Number(row.sort)) || 0));
    node.style.setProperty('display', row.visible === false ? 'none' : '');
    node.dataset.sectionSort = String(row.sort ?? 0);
    applyBackground(node, row.bg_type, row.bg_value);
  }
  return rows;
}

/** يدمج الصف الجديد في المخزن ويعيد القائمة المحدَّثة. */
function merge(sectionKey, row) {
  const list = get('layout');
  const i = list.findIndex((r) => r.section_key === sectionKey);
  const next = i === -1 ? [...list, row] : list.map((r, j) => (j === i ? row : r));
  setAll('layout', next);
  return next;
}

/** يعدّل صف تخطيط قسم، يطبّقه فوراً، ثم يكتبه عبر `api.js`. */
export async function setLayout(sectionKey, patch = {}) {
  const row = { ...layoutOf(sectionKey), ...patch };
  applyLayout(merge(sectionKey, row));
  if (row.id) await api.update('layout', row.id, patch);
  else {
    const saved = await api.insert('layout', row);
    if (saved && saved.id) applyLayout(merge(sectionKey, { ...row, ...saved }));
  }
  return row;
}

/** يعيد ترتيب الأقسام حسب ترتيب المفاتيح الممرَّر، يكتب `sort`، ثم يعيد التطبيق. */
export async function reorderSections(keys = []) {
  const order = new Map(keys.map((k, i) => [k, i + 1]));
  const next = get('layout').map((r) =>
    (order.has(r.section_key) ? { ...r, sort: order.get(r.section_key) } : r));
  setAll('layout', next);
  applyLayout(next);
  await Promise.all(next
    .filter((r) => r.id && order.has(r.section_key))
    .map((r) => api.update('layout', r.id, { sort: r.sort })));
  return next;
}

/** ينشئ قسماً مخصّصاً جديداً في نهاية الصفحة. */
export async function addCustomSection() {
  const key = 'custom-' + crypto.randomUUID();
  const sort = get('layout').reduce((m, r) => Math.max(m, Number(r.sort) || 0), 0) + 1;
  await setLayout(key, {
    section_key: key, sort, columns: 1, align: 'stretch',
    gap: 'var(--s-4)', bg_type: 'none', bg_value: '', visible: true,
  });
  return key;
}
