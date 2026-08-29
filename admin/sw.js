/* ============================================================
   sw.js — عامل الخدمة للوحة · «حمّل مرّة واحدة»

   هذا هو الجزء الذي يجعل الفتحة الثانية فورية: ملفات اللوحة
   (CSS، JS، الخطوط، الصور) تُحفظ على القرص عند أول زيارة، ثم
   تُقدَّم منه بلا شبكة إطلاقاً.

   السياسات ثلاث، وكلٌّ مقصودة:

     · الصفحة (HTML)      الشبكة أولاً — نشر جديد يظهر فوراً،
                          وإن انقطعت الشبكة تُقدَّم النسخة المحفوظة.
     · الملفات الثابتة    القرص أولاً، ثم تحديث صامت في الخلفية.
     · صور التخزين        القرص أولاً — صورة رُفعت لا تتغيّر أبداً.

   ❌ لا نخزّن طلبات قاعدة البيانات هنا عمداً: للمحتوى ذاكرته الخاصة
      في js/core/store.js، وتخزينه مرّتين يجعل تعديلات اللوحة تتأخّر
      زيارةً كاملة قبل أن تظهر.

   لإبطال كل ما هو محفوظ على أجهزة الزوّار: غيّر VERSION.
   ============================================================ */

const VERSION = 'v2.0.0';
const CACHE = `aboal3z-admin-${VERSION}`;

/* ما نريده جاهزاً قبل أول استخدام — الباقي يُحفظ وهو يُطلب */
const CORE = [
  './',
  './index.html',
  './css/app.css',
  './assets/fonts/cairo-arabic.woff2',
  './assets/fonts/cairo-latin.woff2',
  './assets/fonts/mono-latin.woff2',
  './assets/img/logo.png',
  './js/main.js',
];

/* ❌ ولا نخزّن شيئاً من مسار /auth/ إطلاقاً — الجلسات لا تُكيَّش. */

const isStatic = (url) =>
  /\.(css|js|mjs|woff2?|png|jpe?g|webp|avif|svg|gif|mp4|webm|ico)$/i.test(url.pathname);

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE).catch(() => { /* ملف مفقود لا يمنع التثبيت */ }))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** القرص أولاً، مع تحديث صامت للمرّة القادمة. */
async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const net = fetch(req)
    .then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; })
    .catch(() => null);
  return hit || net || fetch(req);
}

/** الشبكة أولاً، والقرص شبكة أمان عند الانقطاع. */
async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req) || await cache.match('./index.html');
    if (hit) return hit;
    throw e;
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // صور ووسائط التخزين على Supabase: محتواها ثابت بعد رفعه
  if (/\/storage\/v1\/object\/public\//.test(url.pathname)) {
    e.respondWith(staleWhileRevalidate(req));
    return;
  }

  // قاعدة البيانات والمصادقة: تمرّ كما هي — لا تخزين إطلاقاً
  if (url.origin !== location.origin) return;

  if (req.mode === 'navigate' || /\.html?$/.test(url.pathname) || url.pathname.endsWith('/')) {
    e.respondWith(networkFirst(req));
    return;
  }

  if (isStatic(url)) e.respondWith(staleWhileRevalidate(req));
});
