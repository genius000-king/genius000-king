# بسّطها — الواجهة الأمامية (Frontend)

واجهة كاملة لمنصة إنشاء العروض التفاعلية بالذكاء الاصطناعي.
**HTML + CSS + JavaScript خام** بلا أي إطار أو أداة بناء — افتح أي ملف في المتصفح ويشتغل.
عربية (RTL)، متجاوبة للجوال والتابلت والكمبيوتر، بهوية كرتونية (ريترو) مأخوذة من تصميمك.

## الصفحات

| الملف | الوظيفة |
|---|---|
| `index.html` | الصفحة الرئيسية: صندوق الفكرة، المميزات، المعرض، الأسئلة |
| `auth.html` | تسجيل الدخول / إنشاء حساب (`?mode=signup`) / استعادة كلمة المرور (`?mode=reset`) + Google/Apple |
| `dashboard.html` | «عروضي»: البحث والتصفية، قائمة لكل عرض، الإعدادات (`#settings`)، وترحيب المستخدم الجديد (`?welcome=1`) |
| `create.html` | إنشاء عرض: الفكرة ← الملفات (سحب وإفلات) ← الأسلوب ← الإعدادات ← شاشة البناء الحيّة |
| `editor.html` | المحرر: الشرائح، التحديد/السحب/تغيير الحجم، الخصائص، المساعد بالمحادثة، تراجع/إعادة |
| `present.html` | المشغّل بملء الشاشة: لوحة المفاتيح، السحب على الجوال، نظرة عامة على الشرائح |
| `billing.html` | الاشتراك داخل التطبيق: الخطة، الرصيد واستهلاكه، طريقة الدفع، الفواتير، سجل الكريدت، إلغاء/إيقاف مؤقت |
| `gallery.html` | المعرض والأساليب: عروض مختارة تُستخدم كقوالب + مكتبة الأساليب (`#styles`) |
| `404.html` | صفحة غير موجودة |
| `pricing.html` | الخطط (شهري/سنوي) + باقات الكريدت + جدول التكلفة |
| `checkout.html` | الدفع: مدى/فيزا/ماستركارد، Apple Pay، STC Pay، تقسيط، كود خصم، ضريبة 15% |
| `admin.html` | الإدارة: نظرة عامة، المستخدمون، المدفوعات، الخطط، المهام، مزوّدو الذكاء، الأساليب، الأخطاء، الإعدادات |

## الهيكل

```
assets/
  css/core.css      ← نظام التصميم (كل الألوان والمسافات كـ Tokens)
  css/landing.css   css/app.css   css/create.css   css/editor.css
  js/core.js        ← الأيقونات، الشخصيات، النوافذ، القوائم، الإشعارات
  js/api.js         ← ⭐ نقطة الربط الوحيدة مع الباك إند
  js/shell.js       ← الشريط الجانبي/السفلي لصفحات التطبيق
  js/covers.js      ← أغلفة احتياطية + مكتبة الأساليب
  js/deck.js        ← حاوية الشرائح (فارغة) — هنا تضيف شرائحك
  img/              ← الشخصيات (مقصوصة من تصميمك) + motif.svg شريط الأشكال (مرسوم بالكود)
```

## إضافة شرائحك

لا توجد شرائح جاهزة. المحرر والمشغّل يقرآن من `assets/js/deck.js`.
عرّف `window.BSSATHA_DECK` قبل تحميل `deck.js` (أو أرجعه من `GET /decks/:id`):

```html
<script>
  window.BSSATHA_DECK = {
    title: "اسم العرض",
    css: ".my-box { background: #fff; }",
    slides: [
      { title: "الغلاف",
        html: '<div class="slide"><h1 data-el="t" class="t-display" style="right:80px;top:260px;font-size:80px">عنوان</h1></div>',
        init(root) { /* تفاعلات اختيارية، وترجع دالة تنظيف إن احتجت */ } },
    ],
  };
</script>
<script src="assets/js/deck.js"></script>
```

- كل شريحة لوحة 1280×720 تتكبّر تلقائياً لأي شاشة.
- العنصر القابل للتحرير في المحرر يحمل `data-el` ويكون `position:absolute`.
- بدون شرائح: المحرر يفتح بشريحة فارغة، والمشغّل يعرض «لا توجد شرائح بعد».

## الربط مع الباك إند

كل الاتصال يمر عبر `assets/js/api.js`. حالياً `MOCK: true` (بيانات وهمية).
عند الربط: `MOCK: false` وعدّل `BASE_URL` — **ولا شيء آخر في الواجهة يتغير.**

| الدالة | الطلب | ملاحظات |
|---|---|---|
| `me()` | `GET /me` | `{ id, name, email, plan, credits, creditsMax, role }` |
| `login(b)` / `signup(b)` | `POST /auth/login` · `/auth/signup` | الجلسة عبر Cookie `HttpOnly` |
| OAuth | `GET /auth/oauth/:provider` | موضع الربط معلّم بتعليق في `auth.html` |
| `listDecks()` | `GET /decks` | `[{ id, title, slides, status: ready|draft|generating, progress, updated, cover }]` |
| `deleteDeck(id)` / `duplicateDeck(id)` | `DELETE /decks/:id` · `POST /decks/:id/duplicate` | |
| `uploadFile(file, onProgress)` | `POST /files` (multipart) | يدعم شريط التقدّم |
| `estimate(b)` | `POST /decks/estimate` | التكلفة بالكريدت قبل الإنشاء |
| `generate(b)` | `POST /decks/generate` | يرجع `{ jobId, deckId }` |
| `streamJob(jobId, cb)` | `GET /jobs/:id/events` (SSE) | أحداث: `stage`، `slide`، `done`، `error` |
| `chatEdit(b)` | `POST /decks/:id/chat` | `{ reply, changes[], creditsUsed }` |
| `plans()` | `GET /plans` | تُعدَّل من لوحة الإدارة |
| `checkout(b)` | `POST /billing/checkout` | يرجع رابط 3-D Secure أو تأكيد المحفظة |

### ملاحظات أمان مهمة
1. **بيانات البطاقة لا تمر على سيرفرك أبداً.** استبدل حقول البطاقة في `checkout.html` بالحقول المستضافة من مزوّد الدفع (Moyasar / Tap / HyperPay) — هذا شرط PCI-DSS.
2. **العرض المولّد يُشغَّل داخل `<iframe sandbox>`** على نطاق منفصل، لأن الذكاء يكتب JavaScript حقيقياً.
3. **مفاتيح API للذكاء** تُرسل مرة واحدة وتُخزّن مشفّرة على السيرفر، ولا تُعاد للواجهة كاملة.
4. الكريدت يُخصم في السيرفر فقط، والواجهة تعرض التقدير لا أكثر.

## التشغيل محلياً

```bash
npx http-server bssatha-ui -p 8080
# ثم افتح http://localhost:8080
```
