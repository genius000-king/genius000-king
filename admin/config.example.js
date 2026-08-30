/* ============================================================
   config.example.js

   انسخ هذا الملف باسم `config.local.js` في نفس المجلد، واملأ القيم
   من لوحة Supabase:  Project Settings ← API

   ثم أضف قبل وسم js/main.js في index.html و admin/index.html:
       <script src="config.local.js"></script>

   ⚠️ `config.local.js` مستبعد من Git عمداً — لا ترفعه.
   المفتاح anon مفتاح عام مصمَّم للمتصفح، وحمايته الحقيقية من RLS
   في قاعدة البيانات (انظر db/rls.sql) لا من إخفائه.
   ============================================================ */

window.APP_CONFIG = {
  SUPABASE_URL: 'https://xxxxxxxxxxxxxxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOi...',
  STORAGE_BUCKET: 'media',

  /* بريد حساب المشرف — به تصير شاشة الدخول كلمةَ مرور فقط.
     ❌ لا تضع كلمة المرور هنا أبداً: هذا الملف يصل إلى متصفّح كل
        زائر. كلمة المرور تُضبط في Supabase ← Authentication ← Users. */
  ADMIN_EMAIL: 'you@example.com',
};
