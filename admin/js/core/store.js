// store.js — يجلب كل محتوى الصفحة بطلبات متوازية مرة واحدة ويكيّشه.
import * as api from './api.js';
import { published } from './dom.js';

export const TABLES = [
  'site_content', 'theme', 'overrides', 'layout',
  'collections', 'works', 'packages', 'package_blocks',
  'services', 'process_steps', 'payment_methods', 'testimonials', 'order_items',
];

const cache = {};
const failed = new Set();
let contentMap = null;

/** يجلب كل الجداول بالتوازي. يعيد { ok, failed } — لا يرمي أبداً. */
export async function loadAll(extra = []) {
  const tables = [...TABLES, ...extra];
  failed.clear();
  const results = await Promise.all(tables.map((t) =>
    api.select(t).catch((e) => { failed.add(t); console.error(`[store] ${t}`, e); return []; })));
  tables.forEach((t, i) => { cache[t] = results[i]; });
  contentMap = null;
  return { ok: failed.size === 0, failed: [...failed], cache };
}

/** أعاد جلب جدول واحد — بعد تعديل من اللوحة. */
export async function reload(table) {
  try {
    cache[table] = await api.select(table);
    failed.delete(table);
    if (table === 'site_content') contentMap = null;
    return cache[table];
  } catch (e) {
    failed.add(table);
    throw e;
  }
}

export function get(table) { return cache[table] || []; }
export function rows(table) { return published(get(table)); }
export function didFail(table) { return failed.has(table); }
export function anyFailed() { return failed.size > 0; }

export function setAll(table, list) {
  cache[table] = list;
  if (table === 'site_content') contentMap = null;
}

/** قيمة نصية من `site_content`؛ فراغ إن لم توجد — لا ترمي أبداً. */
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
