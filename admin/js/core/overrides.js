// overrides.js — تجاوزات بصرية محدودة لكل عنصر (`data-edit-id`) ولكل نقطة توقف.
// 🔒 القائمة `ALLOWED_PROPS` مغلقة عمداً: هي التي تحمي التخطيط المتجاوب من العبث.
//    أي خاصية خارجها تُرفض بصمت مع تحذير في الطرفية — لا استثناءات.
import * as api from './api.js';

export const ALLOWED_PROPS = [
  'color', 'background', 'font-size', 'font-weight',
  'border-radius', 'padding', 'margin', 'box-shadow', 'opacity',
];

// نقاط التوقف الثلاث + `all` بلا استعلام وسائط (تطابق tokens.css: 640 / 1024).
const MEDIA = {
  all: '',
  mobile: '@media (max-width:640px)',
  tablet: '@media (max-width:1024px)',
  desktop: '@media (min-width:1025px)',
};

const TABLE = 'overrides';
const BAD_VALUE = /[{}<>;\\]/;                 // ما يكسر القاعدة أو يخرج منها
const BAD_URL = /url\(\s*['"]?\s*javascript:/i; // رابط سكربت داخل url()
const BAD_TARGET = /["'\\\]<>{};\s]/;           // ما يكسر محدّد السمة

/** هل الخاصية ضمن القائمة المغلقة؟ ترفض ما عداها مع تحذير. */
export function isAllowed(prop) {
  if (ALLOWED_PROPS.includes(prop)) return true;
  console.warn(`[overrides] خاصية مرفوضة — خارج القائمة المغلقة: ${prop}`);
  return false;
}

/** يعيد القيمة نظيفة أو `null` إن كانت خطرة. القيمة تأتي من صف قاعدة بيانات. */
function cleanValue(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const v = String(value).trim();
  if (!v || v.length > 200) return null;
  if (BAD_VALUE.test(v) || BAD_URL.test(v)) return null;
  return v;
}

function cleanTarget(target) {
  if (typeof target !== 'string') return null;
  const t = target.trim();
  return t && !BAD_TARGET.test(t) ? t : null;
}

/**
 * دالة خالصة: تبني نص CSS من صفوف التجاوز.
 * الخصائص المتعدّدة على نفس الهدف ونفس نقطة التوقف تندمج في كتلة واحدة.
 */
export function cssFor(rows = []) {
  const groups = new Map();                     // نقطة التوقف → (هدف → إعلانات)
  for (const row of [].concat(rows)) {
    if (!row || !isAllowed(row.prop)) continue;
    const bp = row.breakpoint || 'all';
    if (!(bp in MEDIA)) { console.warn(`[overrides] نقطة توقف مجهولة: ${bp}`); continue; }
    const target = cleanTarget(row.target);
    const value = cleanValue(row.value);
    if (!target || value === null) {
      console.warn('[overrides] صف مرفوض — هدف أو قيمة غير صالحة:', row.target, row.value);
      continue;
    }
    if (!groups.has(bp)) groups.set(bp, new Map());
    const byTarget = groups.get(bp);
    if (!byTarget.has(target)) byTarget.set(target, []);
    byTarget.get(target).push(`${row.prop}:${value}`);
  }

  const out = [];
  for (const [bp, byTarget] of groups) {
    const blocks = [...byTarget].map(([t, decls]) => `[data-edit-id="${t}"]{${decls.join(';')}}`).join('');
    out.push(MEDIA[bp] ? `${MEDIA[bp]}{${blocks}}` : blocks);
  }
  return out.join('\n');
}

/* --- الحالة في الذاكرة + الحقن --- */

let list = [];

/** يحقن نتيجة `cssFor` في وسم `<style id="overrides">` واحد، ويحدّث الذاكرة. */
export function applyOverrides(rows = list) {
  list = [].concat(rows);
  if (typeof document === 'undefined') return '';
  let tag = document.getElementById('overrides');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'overrides';
    document.head.append(tag);
  }
  tag.textContent = cssFor(list);
  return tag.textContent;
}

const same = (r, target, bp, prop) =>
  r.target === target && (r.breakpoint || 'all') === bp && r.prop === prop;

/** قيمة تجاوز بعينه، أو `undefined` إن لم يوجد. */
export function getOverride(target, bp = 'all', prop) {
  const row = list.find((r) => same(r, target, bp, prop));
  return row ? row.value : undefined;
}

/** هل على الهدف تجاوز؟ `bp` اختيارية — بدونها تفحص كل نقاط التوقف. */
export function hasOverride(target, bp) {
  return list.some((r) => r.target === target && (!bp || (r.breakpoint || 'all') === bp));
}

/** كل الصفوف الحالية (نسخة). */
export function allOverrides() { return list.slice(); }

/**
 * يضبط تجاوزاً: يطبّقه فوراً، ثم يحفظه في القاعدة.
 * `persist: false` للتطبيق اللحظي أثناء سحب المنزلق (الحفظ يؤجَّل في اللوح).
 */
export async function setOverride(target, bp, prop, value, { persist = true } = {}) {
  if (!isAllowed(prop)) return null;
  const t = cleanTarget(target);
  const v = cleanValue(value);
  if (!t || v === null) { console.warn('[overrides] قيمة أو هدف مرفوض:', target, value); return null; }

  const breakpoint = bp || 'all';
  let row = list.find((r) => same(r, t, breakpoint, prop));
  if (row) row.value = v;
  else { row = { target: t, breakpoint, prop, value: v }; list.push(row); }
  applyOverrides(list);
  if (!persist) return row;

  if (row.id) await api.update(TABLE, row.id, { value: v });
  else {
    const saved = await api.insert(TABLE, { target: t, breakpoint, prop, value: v });
    if (saved && saved.id) row.id = saved.id;
  }
  return row;
}

/** يحذف تجاوزات هدف عند نقطة توقف — كلها، أو خاصية واحدة إن مُرِّرت `prop`. */
export async function clearOverride(target, bp = 'all', prop) {
  const doomed = list.filter((r) => r.target === target
    && (r.breakpoint || 'all') === bp && (!prop || r.prop === prop));
  if (!doomed.length) return 0;
  list = list.filter((r) => !doomed.includes(r));
  applyOverrides(list);
  await Promise.all(doomed.filter((r) => r.id).map((r) => api.remove(TABLE, r.id)));
  return doomed.length;
}

/** يمسح كل التجاوزات (زر «مسح التجاوزات» في شريط الأدوات). */
export async function clearAll() {
  const doomed = list;
  list = [];
  applyOverrides(list);
  await Promise.all(doomed.filter((r) => r.id).map((r) => api.remove(TABLE, r.id)));
  return doomed.length;
}
