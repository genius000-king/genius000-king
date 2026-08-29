// uploader.js — رفع إلى Supabase Storage عبر REST مباشرة (بلا supabase-js).
// يستعمل XMLHttpRequest لا fetch لأن fetch لا يعطي تقدّم الرفع.
import { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_BUCKET, USE_MOCK } from './config.js';
import { accessToken } from './auth.js';

const MAX_BYTES = 10 * 1024 * 1024;      // 10MB
const TYPES = [/^image\//, /^video\//, /^application\/pdf$/];

/** يحوّل اسم الملف إلى اسم آمن للمسار: بلا مسافات ولا محارف مسار. */
export function safeName(name = 'file') {
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin';
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${stamp}-${rand}.${ext}`;
}

/** يستنتج نوع الوسيط من نوع MIME أو الامتداد. */
export function mediaTypeOf(file) {
  const mime = file?.type || '';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  return /\.(mp4|webm|mov|m4v)$/i.test(file?.name || '') ? 'video' : 'image';
}

function validate(file) {
  if (!file) return 'لم يُختَر أي ملف';
  if (file.size > MAX_BYTES) return 'الملف أكبر من 10 ميجابايت';
  if (!TYPES.some((re) => re.test(file.type || ''))) return 'الصيغة غير مدعومة — صور أو فيديو أو PDF فقط';
  return null;
}

/**
 * يرفع ملفاً ويعيد رابطه العام.
 * @param {File} file
 * @param {string} folder مجلد داخل الحاوية (packages, works, payments …)
 * @param {(percent:number)=>void} [onProgress]
 */
export function uploadFile(file, folder = 'misc', onProgress) {
  const problem = validate(file);
  if (problem) return Promise.reject(new Error(problem));

  // في الوضع الوهمي: رابط محلي فوري، بلا شبكة إطلاقاً
  if (USE_MOCK) {
    onProgress?.(100);
    return Promise.resolve(URL.createObjectURL(file));
  }

  const path = `${folder}/${safeName(file.name)}`;
  const url = `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken() || SUPABASE_ANON_KEY}`);
    xhr.setRequestHeader('x-upsert', 'true');
    if (file.type) xhr.setRequestHeader('Content-Type', file.type);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(`${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`);
      } else {
        reject(new Error(`تعذّر الرفع (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('تعذّر الاتصال أثناء الرفع'));
    xhr.send(file);
  });
}
