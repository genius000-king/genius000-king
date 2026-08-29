/* mock-data.js — محرّك استعلام في الذاكرة يحاكي PostgREST.
   البيانات نفسها في `mock-seed.js` (AD-3: ملف = مسؤولية).
   نسخة قابلة للتعديل حتى تعمل لوحة المشرف على الوهمي كما على الحقيقي. */
import * as seed from './mock-seed.js';

const db = {};
for (const [table, rows] of Object.entries(seed)) db[table] = structuredClone(rows);

const pk = (table) => (table === 'site_content' || table === 'theme' ? 'key' : 'id');
const uid = () => 'm' + Math.random().toString(36).slice(2, 10);

function rowsOf(table) {
  if (!db[table]) db[table] = [];
  return db[table];
}

function match(row, opts) {
  for (const [col, val] of Object.entries(opts.eq || {})) {
    if (String(row[col]) !== String(val)) return false;
  }
  for (const [col, vals] of Object.entries(opts.in || {})) {
    if (!vals.map(String).includes(String(row[col]))) return false;
  }
  return true;
}

export async function select(table, opts = {}) {
  let out = rowsOf(table).filter((r) => match(r, opts));
  if (opts.order) {
    const [col, dir = 'asc'] = opts.order.split('.');
    out = out.slice().sort((a, b) => {
      const x = a[col], y = b[col];
      const c = x === y ? 0 : (x > y ? 1 : -1);
      return dir === 'desc' ? -c : c;
    });
  }
  if (opts.limit) out = out.slice(0, opts.limit);
  return structuredClone(out);
}

export async function insert(table, row) {
  const created = { [pk(table)]: row[pk(table)] || uid(), created_at: new Date().toISOString(), ...row };
  rowsOf(table).push(created);
  return structuredClone(created);
}

export async function update(table, id, patch) {
  const row = rowsOf(table).find((r) => String(r[pk(table)]) === String(id));
  if (!row) return null;
  Object.assign(row, patch);
  return structuredClone(row);
}

export async function upsert(table, row) {
  const key = row[pk(table)];
  const found = rowsOf(table).find((r) => String(r[pk(table)]) === String(key));
  return found ? update(table, key, row) : insert(table, row);
}

export async function remove(table, id) {
  const list = rowsOf(table);
  const i = list.findIndex((r) => String(r[pk(table)]) === String(id));
  if (i > -1) list.splice(i, 1);
  return true;
}

export async function count(table, opts = {}) {
  return rowsOf(table).filter((r) => match(r, opts)).length;
}
