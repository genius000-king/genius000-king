// api.js — طبقة REST فوق PostgREST مباشرة بـ fetch. بلا supabase-js.
import { SUPABASE_URL, SUPABASE_ANON_KEY, isConfigured } from './config.js';

/** يبني سلسلة استعلام PostgREST من كائن خيارات. دالة خالصة. */
export function buildQuery(opts = {}) {
  const parts = [];
  for (const [col, val] of Object.entries(opts.eq || {})) parts.push(`${col}=eq.${encodeURIComponent(val)}`);
  for (const [col, val] of Object.entries(opts.in || {})) parts.push(`${col}=in.(${val.map(encodeURIComponent).join(',')})`);
  if (opts.order) parts.push(`order=${opts.order}`);
  if (opts.limit) parts.push(`limit=${opts.limit}`);
  if (opts.select) parts.push(`select=${opts.select}`);
  return parts.join('&');
}

let token = null;
export function setToken(t) { token = t; }
export function getToken() { return token; }

function headers(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

class ApiError extends Error {
  constructor(status, body) {
    super(`${status} — ${body}`.slice(0, 300));
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function request(path, init = {}) {
  if (!isConfigured) throw new ApiError(0, 'الاتصال بقاعدة البيانات غير مضبوط');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: headers(init.headers) });
  const text = await res.text();
  if (!res.ok) throw new ApiError(res.status, text);
  return text ? JSON.parse(text) : [];
}

// المفتاح الأساسي يختلف بين الجداول
const PK = { site_content: 'key', theme: 'key' };
const keyOf = (table) => PK[table] || 'id';

export async function select(table, opts = {}) {
  const q = buildQuery(opts);
  return request(`${table}${q ? '?' + q : ''}`);
}

export async function insert(table, row) {
  const out = await request(table, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  return Array.isArray(out) ? out[0] : out;
}

export async function update(table, id, patch) {
  const out = await request(`${table}?${keyOf(table)}=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  return Array.isArray(out) ? out[0] : out;
}

/** إدراج أو تحديث حسب المفتاح الأساسي. */
export async function upsert(table, row) {
  const out = await request(table, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(row),
  });
  return Array.isArray(out) ? out[0] : out;
}

export async function remove(table, id) {
  await request(`${table}?${keyOf(table)}=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  return true;
}

export async function count(table, opts = {}) {
  const q = buildQuery({ ...opts, select: 'id', limit: 1 });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${q}`, {
    headers: headers({ Prefer: 'count=exact', Range: '0-0' }),
  });
  const range = res.headers.get('content-range') || '/0';
  return Number(range.split('/')[1]) || 0;
}

export { ApiError };
