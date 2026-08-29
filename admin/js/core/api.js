// طبقة REST فوق PostgREST — بلا `supabase-js`، عبر `fetch` مباشرة (Spec AD-1).
import { SUPABASE_URL, SUPABASE_ANON_KEY, USE_MOCK } from './config.js';
import * as mock from './mock-data.js';

/** يبني سلسلة استعلام PostgREST من كائن خيارات. دالة خالصة. */
export function buildQuery(opts = {}) {
  const parts = [];
  for (const [col, val] of Object.entries(opts.eq || {})) parts.push(`${col}=eq.${val}`);
  for (const [col, val] of Object.entries(opts.in || {})) parts.push(`${col}=in.(${val.join(',')})`);
  if (opts.order) parts.push(`order=${opts.order}`);
  if (opts.limit) parts.push(`limit=${opts.limit}`);
  if (opts.select) parts.push(`select=${opts.select}`);
  return parts.join('&');
}

let token = null;
/** يضبط رمز الجلسة المصادَقة (لوحة المشرف فقط). */
export function setToken(t) { token = t; }

function headers(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function request(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: headers(init.headers) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${text}`);
  return text ? JSON.parse(text) : [];
}

export async function select(table, opts = {}) {
  if (USE_MOCK) return mock.select(table, opts);
  const q = buildQuery(opts);
  return request(`${table}${q ? '?' + q : ''}`);
}

export async function insert(table, row) {
  if (USE_MOCK) return mock.insert(table, row);
  const out = await request(table, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  return Array.isArray(out) ? out[0] : out;
}

export async function update(table, id, patch) {
  if (USE_MOCK) return mock.update(table, id, patch);
  const key = table === 'site_content' || table === 'theme' ? 'key' : 'id';
  const out = await request(`${table}?${key}=eq.${id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  return Array.isArray(out) ? out[0] : out;
}

/** إدراج أو تحديث حسب المفتاح الأساسي (يُستعمل مع `site_content` و `theme`). */
export async function upsert(table, row) {
  if (USE_MOCK) return mock.upsert(table, row);
  const out = await request(table, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(row),
  });
  return Array.isArray(out) ? out[0] : out;
}

export async function remove(table, id) {
  if (USE_MOCK) return mock.remove(table, id);
  const key = table === 'site_content' || table === 'theme' ? 'key' : 'id';
  await request(`${table}?${key}=eq.${id}`, { method: 'DELETE' });
  return true;
}

export async function count(table, opts = {}) {
  if (USE_MOCK) return mock.count(table, opts);
  const q = buildQuery({ ...opts, select: 'id', limit: 1 });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${q}`, {
    headers: headers({ Prefer: 'count=exact', Range: '0-0' }),
  });
  const range = res.headers.get('content-range') || '/0';
  return Number(range.split('/')[1]) || 0;
}
