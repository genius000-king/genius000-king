// theme.js — الثيم العام: يحقن صفوف جدول `theme` كمتغيّرات CSS على :root.
// ❌ لا قائمة توكنات ثابتة هنا إطلاقاً — توكن جديد = صف جديد في القاعدة، بلا كود.
// القيمة تأتي من صف في القاعدة، فتُنقّى قبل الحقن حتى لا تكسر التصريح.
import { select, upsert, remove } from './api.js';
import { get as storeGet } from './store.js';

const TABLE = 'theme';
const root = () => document.documentElement;

const applied = new Map();   // ما حقنّاه نحن فقط — الإرجاع لا يمسّ غيره
const stored = new Set();    // مفاتيح موجودة في القاعدة — مصدرها الصفوف لا الكود

const UNSAFE = /[<>{};]|javascript\s*:|expression\s*\(/i;
const KEY_RE = /^[a-zA-Z0-9-]+$/;

/** هل القيمة صالحة للحقن؟ */
export function isSafeValue(v) {
  if (typeof v !== 'string' && typeof v !== 'number') return false;
  const s = String(v).trim();
  return s.length > 0 && s.length <= 240 && !UNSAFE.test(s);
}

function cleanKey(key) {
  const k = String(key ?? '').trim().replace(/^--/, '');
  return KEY_RE.test(k) ? k : null;
}

/** يحقن صفوف [{key, value}] على :root. يعيد المفاتيح المطبَّقة فعلاً. */
export function applyTheme(rows = []) {
  const done = [];
  for (const row of [].concat(rows)) {
    const key = cleanKey(row && row.key);
    if (!key || !isSafeValue(row && row.value)) continue;
    const value = String(row.value).trim();
    root().style.setProperty('--' + key, value);
    applied.set(key, value);
    done.push(key);
  }
  return done;
}

/** القيمة السارية للتوكن — المحقونة أو افتراضي tokens.css. */
export function getToken(key) {
  const k = cleanKey(key);
  if (!k) return '';
  return getComputedStyle(root()).getPropertyValue('--' + k).trim();
}

/** يزيل ما حقنّاه نحن فقط، فترجع قيم tokens.css. يعيد المفاتيح المُزالة. */
export function resetTheme() {
  const keys = [...applied.keys()];
  keys.forEach((k) => root().style.removeProperty('--' + k));
  applied.clear();
  return keys;
}

/** يحذف صفوف الثيم من القاعدة — إرجاع دائم لا يعود بعد تحديث الصفحة. */
export async function clearStoredTheme() {
  const keys = [...stored];
  stored.clear();
  await Promise.all(keys.map((k) => remove(TABLE, k).catch(() => null)));
  return keys;
}

/** يطبّق القيمة فوراً ويحفظها في جدول `theme`. يعيد false للقيمة المرفوضة. */
export async function setToken(key, value) {
  const k = cleanKey(key);
  if (!k || !isSafeValue(value)) return false;
  const v = String(value).trim();
  applyTheme([{ key: k, value: v }]);
  await upsert(TABLE, { key: k, value: v });
  stored.add(k);
  return true;
}

/** يقرأ صفوف الثيم من المخزن (أو القاعدة) ويطبّقها. */
export async function loadTheme() {
  let rows = storeGet(TABLE);
  if (!rows || !rows.length) rows = await select(TABLE).catch(() => []);
  rows.forEach((r) => { const k = cleanKey(r && r.key); if (k) stored.add(k); });
  applyTheme(rows);
  return rows;
}

/* ---------- اشتقاق مشتقّات اللون المميز ---------- */

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** '#rgb' أو '#rrggbb' → [r,g,b]، وإلا null. */
export function toRgb(hex) {
  const m = String(hex ?? '').trim();
  if (!HEX.test(m)) return null;
  const h = m.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
}

const clamp = (c) => Math.round(Math.min(255, Math.max(0, c)));
const toHex = (rgb) => '#' + rgb.map((c) => clamp(c).toString(16).padStart(2, '0')).join('');
const chan = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (rgb) => 0.2126 * chan(rgb[0]) + 0.7152 * chan(rgb[1]) + 0.0722 * chan(rgb[2]);

/** نسبة التباين بين لونين وفق WCAG. */
export function contrast(a, b) {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** يمزج اللون بالأبيض تدريجياً حتى يبلغ التباين المطلوب على الخلفية. */
export function lightenTo(rgb, bg, target = 4.5) {
  let out = rgb.map(clamp);
  for (let t = 0.02; t <= 1 && contrast(out, bg) < target; t += 0.02) {
    out = rgb.map((c) => clamp(c + (255 - c) * t));
  }
  return out;
}

const bgRgb = () => toRgb(getToken('c-bg')) || [0, 0, 0];

/**
 * صفوف اللون المميز الثلاثة المشتقّة من لون واحد:
 * `c-accent` للتعبئة، `c-accent-rgb` لصيغة rgba()، و`c-accent-text`
 * نسخة أفتح للنص لأن الأساس لا يبلغ 4.5:1 على الخلفية الداكنة.
 */
export function accentTokens(hex) {
  const rgb = toRgb(hex);
  if (!rgb) return [];
  return [
    { key: 'c-accent', value: toHex(rgb) },
    { key: 'c-accent-rgb', value: rgb.join(', ') },
    { key: 'c-accent-text', value: toHex(lightenTo(rgb, bgRgb(), 4.5)) },
  ];
}

/** يضبط اللون المميز ومشتقّاته ويحفظها كلها. */
export async function setAccent(hex) {
  const rows = accentTokens(hex);
  if (!rows.length) return false;
  applyTheme(rows);
  const outs = await Promise.all(rows.map((r) => setToken(r.key, r.value)));
  return outs.every(Boolean);
}
