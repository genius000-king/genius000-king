// upload.js — رفع الملفات إلى Supabase Storage عبر REST مباشرة.
import { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_BUCKET, publicUrl, isConfigured } from './config.js';
import { getToken } from './api.js';

/** اسم ملف آمن: بلا مسافات ولا محارف تكسر المسار. */
export function safeName(name = 'file') {
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, '') : '';
  const stem = (dot > 0 ? name.slice(0, dot) : name)
    .replace(/[^\w؀-ۿ-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48) || 'file';
  const rand = Math.random().toString(36).slice(2, 8);
  return `${Date.now().toString(36)}-${rand}-${stem}${ext}`;
}

/** يرفع ملفاً واحداً ويعيد رابطه العام. */
export async function upload(file, folder = 'uploads', onProgress) {
  if (!isConfigured) throw new Error('التخزين غير مضبوط');
  const path = `${folder.replace(/^\/+|\/+$/g, '')}/${safeName(file.name)}`;
  const url = `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`;
  const token = getToken() || SUPABASE_ANON_KEY;

  // XHR لا fetch — لأن fetch لا يعطي تقدّم الرفع
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('x-upsert', 'true');
    if (file.type) xhr.setRequestHeader('Content-Type', file.type);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve({ path, url: publicUrl(path) });
      else reject(new Error(`رفع فاشل ${xhr.status}: ${xhr.responseText.slice(0, 160)}`));
    };
    xhr.onerror = () => reject(new Error('انقطع الاتصال أثناء الرفع'));
    xhr.send(file);
  });
}

/** يرفع عدة ملفات بالتوازي ويعيد الروابط بترتيبها. */
export async function uploadMany(files, folder = 'uploads', onProgress) {
  const list = [...files];
  const done = new Array(list.length).fill(0);
  const results = await Promise.all(list.map((f, i) =>
    upload(f, folder, (p) => {
      done[i] = p;
      onProgress?.(done.reduce((a, b) => a + b, 0) / list.length, i, p);
    })));
  return results.map((r) => r.url);
}

/** يحذف ملفاً من التخزين (لوحة المشرف فقط). */
export async function removeFile(path) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${getToken() || SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`حذف فاشل ${res.status}`);
  return true;
}
