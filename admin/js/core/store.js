// store.js — يجلب كل محتوى الصفحة بطلبات متوازية مرة واحدة ويكيّشه (Spec §7).
import * as api from './api.js';
import { published } from './dom.js';

// الجداول التي يحتاجها موقع العملاء عند الإقلاع.
export const TABLES = [
  'site_content', 'theme', 'overrides', 'layout', 'custom_blocks',
  'collections', 'works', 'packages', 'package_blocks',
  'services', 'process_steps', 'payment_methods', 'testimonials', 'order_items',
];

const cache = {};
let contentMap = null;

/** يجلب كل الجداول بالتوازي. `extra` لجداول تخص لوحة المشرف (مثل `orders`). */
export async function loadAll(extra = []) {
  const tables = [...TABLES, ...extra];
  const results = await Promise.all(tables.map((t) => api.select(t).catch(() => [])));
  tables.forEach((t, i) => { cache[t] = results[i]; });
  contentMap = null;
  return cache;
}

/** صفوف جدول كما جاءت من القاعدة. */
export function get(table) { return cache[table] || []; }

/** صفوف منشورة ومرتبة بـ `sort` — ما تستعمله ملفات الأقسام. */
export function rows(table) { return published(get(table)); }

/** يستبدل جدولاً في المخزن (بعد تعديل من لوحة المشرف). */
export function setAll(table, list) {
  cache[table] = list;
  if (table === 'site_content') contentMap = null;
}

/** قيمة نصية من `site_content`؛ فراغ إن لم توجد — لا ترمي أبداً. */
export function content(key) {
  if (!contentMap) {
    contentMap = Object.fromEntries(get('site_content').map((r) => [r.key, r.value]));
  }
  return contentMap[key] ?? '';
}

/** أعمال معرض بعينه، منشورة ومرتبة. */
export function byCollection(collectionId) {
  return published(get('works').filter((w) => w.collection_id === collectionId));
}

/** كتل بكج بعينه، مرتبة بـ `sort` (لا حقل `published` عليها). */
export function blocksOf(packageId) {
  return get('package_blocks')
    .filter((b) => b.package_id === packageId)
    .slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}

/** كتل مخصصة داخل قسم، مرتبة ومرئية. */
export function blocksIn(sectionKey) {
  return get('custom_blocks')
    .filter((b) => b.section_key === sectionKey && b.visible !== false)
    .slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}

/** صف التخطيط لقسم، بقيم افتراضية آمنة. */
export function layoutOf(sectionKey) {
  return get('layout').find((l) => l.section_key === sectionKey)
    || { section_key: sectionKey, sort: 99, columns: 1, align: 'stretch', gap: 'var(--s-5)', bg_type: 'none', bg_value: '', visible: true };
}
