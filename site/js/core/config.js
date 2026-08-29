// ============================================================
// config.js — إعدادات الاتصال.
//
// القيم الحقيقية تُوضع في ملف `config.local.js` بجانب index.html
// (انظر config.example.js). هذا الملف يقرأها ولا يحملها، حتى لا
// تدخل المفاتيح إلى المستودع.
//
//   <script src="config.local.js"></script>   ← قبل js/main.js
//
// ❌ لا بيانات وهمية · ❌ لا مفاتيح مكتوبة هنا.
// ============================================================

const cfg = (typeof window !== 'undefined' && window.APP_CONFIG) || {};

export const SUPABASE_URL = String(cfg.SUPABASE_URL || '').replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = String(cfg.SUPABASE_ANON_KEY || '');
export const STORAGE_BUCKET = String(cfg.STORAGE_BUCKET || 'media');

/** هل الاتصال مضبوط؟ الموقع لا يقلع بدونه ويعرض شاشة إعداد واضحة. */
export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** رابط عام لملف في التخزين. */
export function publicUrl(path) {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${String(path).replace(/^\/+/, '')}`;
}
