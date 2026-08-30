// theme.js — يحقن قيم جدول `theme` كمتغيّرات CSS على :root.
// كل مفتاح في الجدول هو اسم توكن بلا الشرطتين: مثلاً c-accent ← --c-accent.
import * as api from './api.js';
import { get, setAll } from './store.js';

// 🔒 قائمة مغلقة: ما يجوز للمشرف تغييره من الثيم.
export const THEME_KEYS = [
  'c-bg', 'c-surface-1', 'c-surface-2', 'c-surface-3', 'c-line',
  'c-text', 'c-accent', 'c-accent-text', 'c-accent-2', 'c-warm', 'c-brand',
  'fs-scale', 's-scale', 'fx-intensity',
  'r-sm', 'r-md', 'r-lg', 'r-xl',
  'container', 'bento-gap', 'bento-unit',
  'glass-blur', 'glass-sat',

  /* ── الشعار: مقاسه وموضعه في الشاشة الأولى ── */
  'logo-size', 'logo-shift-x', 'logo-shift-y', 'hero-split',

  /* ── تفاعل المجسّم ──
     تُكتب متغيّرات CSS كبقيّة الثيم، ويقرؤها motion/logo-3d.js من
     الجذر عند التركيب. فمسار الحفظ والمعاينة واحد لا اثنان. */
  'logo-fx-r', 'logo-fx-push', 'logo-fx-lift', 'logo-fx-rise', 'logo-fx-fall',
  'logo-track', 'logo-tilt', 'logo-spin', 'logo-grain', 'logo-particles',
];

const HEX = /^#[0-9a-f]{3,8}$/i;
const NUM = /^-?\d*\.?\d+(px|rem|em|%|vw|vh|deg|s|ms)?$/i;

/** يتحقق من القيمة قبل حقنها — لا نحقن أي شيء يكسر CSS. */
export function isSafeValue(v) {
  const s = String(v ?? '').trim();
  if (!s || s.length > 64) return false;
  if (/[{}<>;]/.test(s)) return false;
  return HEX.test(s) || NUM.test(s) || /^[a-z0-9(),.%\s#/-]+$/i.test(s);
}

/** يحوّل #RRGGBB إلى "r, g, b" — تحتاجه توكنات الشفافية. */
export function hexToRgb(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length < 6) return null;
  const n = parseInt(h.slice(0, 6), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** دالة خالصة: تبني خريطة المتغيّرات من صفوف الجدول. */
export function varsFor(rows = []) {
  const out = {};
  for (const row of rows) {
    if (!row || !THEME_KEYS.includes(row.key)) continue;
    if (!isSafeValue(row.value)) { console.warn('[theme] قيمة مرفوضة', row.key, row.value); continue; }
    out[`--${row.key}`] = String(row.value).trim();
    // الألوان الرئيسية تحتاج نسخة RGB للشفافيات
    if (HEX.test(row.value) && /^c-(accent|accent-2|brand)$/.test(row.key)) {
      const rgb = hexToRgb(row.value);
      if (rgb) out[`--${row.key}-rgb`] = rgb;
    }
  }
  return out;
}

/** يطبّق الثيم على الصفحة. */
export function applyTheme(rows = get('theme'), target = document.documentElement) {
  const vars = varsFor(rows);
  for (const [k, v] of Object.entries(vars)) target.style.setProperty(k, v);
  return vars;
}

/** يجلب الثيم ويطبّقه. */
export async function loadTheme() {
  try {
    const rows = await api.select('theme');
    setAll('theme', rows);
    return applyTheme(rows);
  } catch (e) {
    console.warn('[theme] تعذّر الجلب — نستعمل القيم الافتراضية', e);
    return {};
  }
}

/** يحفظ مفتاحاً ويطبّقه فوراً. */
export async function setThemeKey(key, value) {
  if (!THEME_KEYS.includes(key)) throw new Error(`مفتاح ثيم غير مسموح: ${key}`);
  if (!isSafeValue(value)) throw new Error('قيمة غير صالحة');
  await api.upsert('theme', { key, value: String(value).trim() });
  const rows = get('theme').filter((r) => r.key !== key).concat([{ key, value }]);
  setAll('theme', rows);
  applyTheme(rows);
}

/** يعيد مفتاحاً لقيمته الافتراضية. */
export async function resetThemeKey(key) {
  await api.remove('theme', key).catch(() => {});
  document.documentElement.style.removeProperty(`--${key}`);
  setAll('theme', get('theme').filter((r) => r.key !== key));
}
