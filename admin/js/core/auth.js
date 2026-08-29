// auth.js — مصادقة Supabase عبر REST مباشرة (بلا supabase-js).
// ⛔ لا كلمة مرور مكتوبة في الكود إطلاقاً — الحساب يُنشأ يدوياً من لوحة Supabase.
import { SUPABASE_URL, SUPABASE_ANON_KEY, USE_MOCK } from './config.js';
import { setToken } from './api.js';

const KEY = 'aboal3z:session';
let session = null;
let timer = null;

function persist(s) {
  session = s;
  setToken(s?.access_token || null);
  try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); }
  catch { /* وضع خاص */ }
  scheduleRefresh();
}

function scheduleRefresh() {
  clearTimeout(timer);
  if (!session?.expires_at || USE_MOCK) return;
  // التجديد قبل الانتهاء بدقيقة
  const ms = session.expires_at * 1000 - Date.now() - 60_000;
  timer = setTimeout(refresh, Math.max(5_000, ms));
}

async function post(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.msg || 'تعذّر تسجيل الدخول');
  return data;
}

/** يستعيد الجلسة المحفوظة عند الإقلاع. */
export function restore() {
  if (session) return session;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) persist(JSON.parse(raw));
  } catch { /* تجاهل */ }
  return session;
}

export function isAuthed() { return !!session?.access_token; }
/** رمز الجلسة الخام — يحتاجه الرفع إلى التخزين (خارج نطاق `api.js`). */
export function accessToken() { return session?.access_token || null; }
export function currentUser() { return session?.user || null; }

export async function signIn(email, password) {
  if (USE_MOCK) {
    persist({ access_token: 'mock', refresh_token: 'mock', user: { email: email || 'demo' } });
    return session;
  }
  persist(await post('token?grant_type=password', { email, password }));
  return session;
}

export async function refresh() {
  if (!session?.refresh_token || USE_MOCK) return session;
  try { persist(await post('token?grant_type=refresh_token', { refresh_token: session.refresh_token })); }
  catch { signOut(); }
  return session;
}

export function signOut() {
  persist(null);
}
