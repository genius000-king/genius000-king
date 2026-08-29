// ============================================================
// store.js — الإصدار الثاني · «حمّل مرّة واحدة»
//
// اللوحة في v1 كانت تفتح على شاشة فارغة وتنتظر أربعة عشر طلباً في
// كل مرّة — حتى عند التنقّل السريع بين الأقسام بعد إغلاقها وفتحها.
//
// الآن: نسخة على الجهاز تُرسم فوراً، والشبكة تُسأل بعدها في الخلفية
// وتُصحّح الفرق إن وُجد. الحفظ والتعديل لا يمرّان من هنا إطلاقاً —
// يذهبان للقاعدة مباشرة ثم يُحدّثان الذاكرة، فلا تظهر بيانات قديمة
// بعد تعديل.
// ============================================================
import * as api from './api.js';
import { published } from './dom.js';

export const TABLES = [
  'site_content', 'theme', 'overrides', 'layout',
  'collections', 'works', 'packages', 'package_blocks',
  'services', 'process_steps', 'payment_methods', 'testimonials', 'order_items',
];

const CACHE_KEY = 'aboal3z:admin-data:v2';
const MAX_AGE = 3 * 24 * 60 * 60 * 1000;   // ثلاثة أيام

const cache = {};
const failed = new Set();
let contentMap = null;
let signature = '';

function signOf(obj) {
  try { return JSON.stringify(obj).length + ':' + Object.keys(obj).length; }
  catch { return ''; }
}

function fill(obj) {
  for (const k of Object.keys(obj)) cache[k] = obj[k] || [];
  contentMap = null;
}

/** يقرأ نسخة الجهاز. متزامن — يعمل قبل أول رسمة. */
export function hydrate() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return false;
    const box = JSON.parse(raw);
    if (!box || !box.at || Date.now() - box.at > MAX_AGE || !box.data) return false;
    fill(box.data);
    signature = signOf(box.data);
    return true;
  } catch { return false; }
}

/** يكتب نسخة الجهاز. آمن دائماً — امتلاء الحصّة لا يكسر شيئاً. */
export function persist() {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: cache })); }
  catch { try { localStorage.removeItem(CACHE_KEY); } catch { /* تجاهل */ } }
}

export function forget() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* تجاهل */ }
  signature = '';
}

/** يجلب كل الجداول بالتوازي. يعيد { ok, failed, changed } — لا يرمي أبداً. */
export async function loadAll(extra = []) {
  const tables = [...TABLES, ...extra];
  failed.clear();
  const results = await Promise.all(tables.map((t) =>
    api.select(t).catch((e) => { failed.add(t); console.error(`[store] ${t}`, e); return null; })));

  const next = {};
  tables.forEach((t, i) => { next[t] = results[i] === null ? (cache[t] || []) : results[i]; });

  const sig = signOf(next);
  const changed = sig !== signature;
  fill(next);
  signature = sig;
  if (!failed.size) persist();

  return { ok: failed.size === 0, failed: [...failed], changed, cache };
}

/** أعاد جلب جدول واحد — بعد تعديل من اللوحة. */
export async function reload(table) {
  try {
    cache[table] = await api.select(table);
    failed.delete(table);
    if (table === 'site_content') contentMap = null;
    signature = signOf(cache);
    persist();
    return cache[table];
  } catch (e) {
    failed.add(table);
    throw e;
  }
}

export function isHydrated() { return Boolean(signature); }
export function get(table) { return cache[table] || []; }
export function rows(table) { return published(get(table)); }
export function didFail(table) { return failed.has(table); }
export function anyFailed() { return failed.size > 0; }

export function setAll(table, list) {
  cache[table] = list;
  if (table === 'site_content') contentMap = null;
}

export function content(key, fallback = '') {
  if (!contentMap) {
    contentMap = Object.fromEntries(get('site_content').map((r) => [r.key, r.value]));
  }
  const v = contentMap[key];
  return v === undefined || v === null || v === '' ? fallback : v;
}

export function hasContent(key) {
  if (!contentMap) contentMap = Object.fromEntries(get('site_content').map((r) => [r.key, r.value]));
  return Boolean(contentMap[key]);
}

export function byCollection(collectionId) {
  return published(get('works').filter((w) => w.collection_id === collectionId));
}

export function blocksOf(packageId) {
  return get('package_blocks')
    .filter((b) => b.package_id === packageId)
    .slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}

export function layoutOf(sectionKey) {
  return get('layout').find((l) => l.section_key === sectionKey)
    || { section_key: sectionKey, sort: 99, columns: 1, align: 'stretch',
         gap: '', bg_type: 'none', bg_value: '', visible: true };
}

/* عند إغلاق التبويب نحفظ آخر حالة في الذاكرة — بهذا لا تظهر قيمة
   قديمة لثانية بعد تعديل ثم تحديث الصفحة. */
if (typeof addEventListener === 'function') {
  addEventListener('pagehide', () => { if (signature) persist(); });
}
