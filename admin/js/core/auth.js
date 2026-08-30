// auth.js — مصادقة Supabase عبر REST مباشرة.
//
// ⛔ لا كلمة مرور مكتوبة في الكود — الحساب يُنشأ من لوحة Supabase،
//    والتحقّق يقع على الخادم لا في المتصفّح.
//
// البريد ثابت في config.local.js (ADMIN_EMAIL) فلا يُكتب في كل دخول،
// لكن الجلسة تبقى جلسة Supabase حقيقية: بلا رمزها لا تكتب سياسات
// RLS حرفاً واحداً في القاعدة. إخفاء الحقل لم يُضعف الحماية.
import { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL, isConfigured } from './config.js';
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
  if (!session?.expires_at) return;
  const ms = session.expires_at * 1000 - Date.now() - 60_000;   // قبل الانتهاء بدقيقة
  timer = setTimeout(refresh, Math.max(5_000, ms));
}

async function post(path, body) {
  if (!isConfigured) throw new Error('الاتصال بقاعدة البيانات غير مضبوط');
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error_description || data.msg || data.message || '';
    throw new Error(/invalid/i.test(msg) ? 'كلمة المرور غير صحيحة' : (msg || 'تعذّر تسجيل الدخول'));
  }
  return data;
}

export function restore() {
  if (session) return session;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      // جلسة منتهية لا تُستعاد
      if (!s.expires_at || s.expires_at * 1000 > Date.now()) persist(s);
      else localStorage.removeItem(KEY);
    }
  } catch { /* تجاهل */ }
  return session;
}

export function isAuthed() { return !!session?.access_token; }
export function accessToken() { return session?.access_token || null; }
export function currentUser() { return session?.user || null; }

/**
 * دخول بكلمة المرور. البريد من الإعدادات، ويُقبل تمريره لحالة
 * لم يُضبط فيها ADMIN_EMAIL بعد.
 */
export async function signIn(password, email = ADMIN_EMAIL) {
  const mail = String(email || '').trim();
  if (!mail) throw new Error('بريد المشرف غير مضبوط في config.local.js');
  persist(await post('token?grant_type=password', { email: mail, password }));
  return session;
}

/** هل يكفي إدخال كلمة المرور وحدها؟ */
export const hasAdminEmail = () => Boolean(ADMIN_EMAIL);

export async function refresh() {
  if (!session?.refresh_token) return session;
  try { persist(await post('token?grant_type=refresh_token', { refresh_token: session.refresh_token })); }
  catch { signOut(); }
  return session;
}

export function signOut() { persist(null); }
