// autosave.js — حفظ مؤجَّل مع بثّ الحالة إلى الشريط العلوي.
import { debounce } from './dom.js';
import * as api from './api.js';

const emit = (state, detail = {}) =>
  document.dispatchEvent(new CustomEvent('save:state', { detail: { state, ...detail } }));

let pending = 0;

/** يحفظ فوراً ويبثّ الحالة. يعيد true عند النجاح. */
export async function save(table, id, patch) {
  pending++;
  emit('saving');
  try {
    const out = await api.update(table, id, patch);
    if (--pending === 0) emit('saved');
    return out;
  } catch (e) {
    pending = Math.max(0, pending - 1);
    console.error('[autosave]', table, id, patch, e);
    emit('error', { message: e.message });
    throw e;
  }
}

export async function saveContent(key, value) {
  pending++;
  emit('saving');
  try {
    const out = await api.upsert('site_content', { key, value: String(value ?? '') });
    if (--pending === 0) emit('saved');
    return out;
  } catch (e) {
    pending = Math.max(0, pending - 1);
    emit('error', { message: e.message });
    throw e;
  }
}

/** غلاف مؤجَّل — للحقول التي يكتب فيها المستخدم حرفاً حرفاً. */
export function debouncedSave(ms = 600) {
  const map = new Map();
  return (table, id, patch) => {
    const k = `${table}:${id}`;
    if (!map.has(k)) {
      map.set(k, { patch: {}, fn: debounce(() => {
        const acc = map.get(k).patch;
        map.get(k).patch = {};
        save(table, id, acc).catch(() => {});
      }, ms) });
    }
    const rec = map.get(k);
    Object.assign(rec.patch, patch);
    rec.fn();
  };
}
