# TV Control Hub — المعمارية

> قرارات، لا محاضرات. كل قرار معه سببه وثمنه.

## 0. الجهاز المستهدف (حقائق تحكم التصميم)

| | Xiaomi TV Box S (3rd Gen) |
|---|---|
| النظام | Google TV على **Android 14** (API 34) |
| المعالج | Amlogic S905X5M، 4 أنوية، GPU Mali‑G310 V2 |
| الذاكرة | **2 GB RAM** — أهم قيد في المشروع |
| الشاشة | 4K، لكن الواجهة المنطقية عادةً 1920×1080 |

النتيجة: خدمة التلفزيون بلا مكتبات native ثقيلة، عملية واحدة، والترميز يبدأ بـ 720p.

## 1. القرارات الكبرى

### 1.1 APK واحد، دوران
تطبيق واحد يُثبَّت على الجوال والتلفزيون. `RoleDetector` يقرأ `FEATURE_LEANBACK`/`UiModeManager` ويوجّه إلى واجهة **الجوال** أو **التلفزيون**. يمكن تجاوز الاكتشاف من الإعدادات.
- لماذا: ملف واحد للتوزيع والتحديث، وبروتوكول واحد لا يختلف إصداره بين الطرفين.
- الثمن: حجم أكبر قليلًا لكل جهاز (كود الطرف الآخر) — مقبول (< 1 MB).

### 1.2 البث: H.264 عبر WebSocket مشفّر — **وليس WebRTC** (الآن)
`MediaProjection → VirtualDisplay → MediaCodec (H.264, low‑latency) → WebSocket ثنائي مشفّر → MediaCodec decoder → SurfaceView`.
- لماذا: على شبكة محلية، فوائد WebRTC (اختراق NAT، jitter buffer عبر الإنترنت) لا تلزم. هذا نفس نهج **scrcpy** وتأخيره ≈ 40–90ms على Wi‑Fi جيد.
- WebRTC يضيف ~10–20MB مكتبات native لكل ABI وذاكرة إضافية على جهاز 2GB، ويصعّب الاختبار.
- البث خلف واجهة `VideoTransport`؛ إن احتجنا WebRTC لاحقًا للتحكم عبر الإنترنت يُضاف كـ implementation بديل دون لمس المُرمِّز أو الواجهة.
- **Tailscale/WireGuard** يجعلان الأجهزة البعيدة "محلية" — غالبًا يغني عن WebRTC كليًا.

### 1.3 التحكم بلا Root: AccessibilityService
| الوظيفة | الآلية | ملاحظة |
|---|---|---|
| لمس/سحب على الشاشة | `dispatchGesture` | API 24+ |
| أسهم D‑pad + OK | `GLOBAL_ACTION_DPAD_*` | **API 33+** — متاح على Android 14 |
| رجوع/رئيسية/الأخيرة/الإشعارات | `performGlobalAction` | |
| الصوت | `AudioManager.adjustStreamVolume` | لا يحتاج حقن |
| تشغيل/إيقاف وسائط | `AudioManager.dispatchMediaKeyEvent` | يعمل مع جلسات الوسائط |
| كتابة نص | `ACTION_SET_TEXT` على الحقل المركّز + `ACTION_IME_ENTER` | |
| مؤشر ماوس | نافذة `TYPE_ACCESSIBILITY_OVERLAY` + نقر بـ `dispatchGesture` | لا يحتاج إذن overlay |
| ماوس من الريموت الفعلي | `onKeyEvent` (فلترة مفاتيح) | ضغطة مطوّلة على OK تبدّل الوضع |

ما **لا** يمكن بلا Root: حقن KeyEvent خام لأي مفتاح، التحكم بالطاقة الكاملة، تجاوز `FLAG_SECURE`. لن نحاول.

### 1.4 الإقران: أسهل من QR، ومرة واحدة فقط
1. التلفزيون يعلن عن نفسه عبر **mDNS/NSD** (`_tvhub._tcp`) مع بصمة مفتاحه.
2. الجوال يكتشفه تلقائيًا ← ضغطة "اتصال".
3. التلفزيون يعرض نافذة: «جوال عبدالله يريد التحكم» + رمز 6 أرقام للمقارنة (اختياري للعين) ← **OK بالريموت**.
4. يحفظ كل طرف مفتاح الآخر العام (TOFU pinning). **كل اتصال لاحق تلقائي وصامت**، بلا QR ولا رموز.

لا كاميرا، لا كتابة IP، لا تكرار. احتياطي فقط: إدخال IP يدويًا (للشبكات التي تحجب multicast أو عبر Tailscale).

### 1.5 الأمان: Station‑to‑Station فوق WebSocket
- هوية كل جهاز: مفتاح **EC P‑256** داخل **AndroidKeyStore** (المفتاح الخاص غير قابل للاستخراج).
- لكل اتصال: ECDH مؤقت + توقيع الطرفين على الـ transcript ← HKDF‑SHA256 ← مفتاحا **AES‑256‑GCM** (لكل اتجاه)، nonce = عدّاد صارم (يمنع إعادة الإرسال).
- رمز المقارنة SAS مشتق من الـ transcript: أي هجوم وسيط يغيّر الرقم.
- الصلاحيات **لكل جهاز**: شاشة، إدخال، ملفات (قراءة/كتابة)، تطبيقات، معلومات، طرفية، خدمات. الطرفية والخدمات **مغلقة افتراضيًا**.
- لماذا ليس TLS؟ TLS بشهادات ذاتية + client auth + pinning على Android يحتاج BouncyCastle وتعقيدًا أكبر لنفس النتيجة. البروتوكول هنا ~300 سطر Kotlin نقي **مختبر بالكامل على JVM**.

### 1.6 ثلاث قنوات منفصلة لكل جلسة
| القناة | المحتوى | لماذا منفصلة |
|---|---|---|
| `control` | RPC + أحداث (ريموت، معلومات، أوامر) | يجب أن تبقى سريعة دائمًا |
| `video` | حزم H.264 باتجاه واحد | لا تحجب الأوامر (head‑of‑line) |
| `bulk` | رفع/تنزيل الملفات، نقل APK | نقل 2GB لا يجمّد الريموت |

كل قناة تجري نفس المصافحة — مسار كود واحد.

### 1.7 المراقبة: ما يتيحه Android فعلًا — بلا اختلاق
كل قراءة تحمل `Availability`: **متاح** / **يحتاج ADB** / **غير مدعوم** مع السبب.
- ✅ RAM، التخزين، الشبكة وعناوين IP، معدل النقل، مدة التشغيل، حالة الحرارة (`PowerManager`)، طراز SoC، عدد الأنوية، GPU renderer.
- ⚠️ ترددات الأنوية: من `/sys` إن سمح المصنع.
- ❌ نسبة استخدام CPU الكلية: `/proc/stat` محجوب منذ Android 8. ❌ استخدام GPU: لا API. تُعرض «غير متاح» مع السبب، لا أرقام وهمية.

### 1.8 السيرفرات والخدمات: عبر Termux، بصدق
تطبيقنا لا يستطيع تشغيل `node`/`python` الخاصين بـ Termux مباشرة (UID و SELinux مختلفان). الحل الرسمي: **Termux `RUN_COMMAND` intent** + سكربت مدير صغير (`svc.sh`) نثبّته داخل Termux يدير PID وملفات Logs لكل خدمة. بالإضافة إلى **Shell محلي محدود** بصلاحيات التطبيق نفسه (toybox).

### 1.9 النظام هو الأساس — الإجابة على مشكلة التطبيقات التي "لا تعمل"
المشكلة الحقيقية ليست أن Google TV "زبالة": تطبيقات الجوال (المتصفحات مثلًا) **تُثبَّت فعلًا** لكن:
1. واجهة Google TV **تُخفي** أي تطبيق لا يعلن `LEANBACK_LAUNCHER`.
2. هي مصممة للّمس، والريموت لا يملك مؤشرًا.

الحل في ثلاث قطع تعمل معًا:
- **مشغّل نظيف بهوية عملاق** يعرض *كل* التطبيقات (تلفزيون + جوال) كشبكة أيقونات مثل الجوال، مع تبويبات: الكل · للتلفزيون · للجوال.
- **ماوس من الريموت** (ضغطة مطوّلة على OK) أو من الجوال — يجعل تطبيقات اللمس قابلة للاستخدام.
- **«انقل تطبيقًا من جوالي»**: تختار أي تطبيق مثبت على جوالك (Chrome، Brave، Firefox…) فيُستخرج الـ APK (مع الـ splits) ويُثبَّت على التلفزيون بضغطة. لا متجر، لا Downloader.
- اختياري: زر Home يفتح مشغّلنا بدل مشغّل Google (عبر Accessibility).

## 2. الوحدات (المحركات)

```
:app                         APK واحد، RoleRouter، رسم DI، النشاطات
:core:common                 Kotlin نقي: Logger، Clock، أدوات
:core:model                  Kotlin نقي: نماذج المجال المشتركة
:core:protocol               Kotlin نقي: رسائل البروتوكول + الترميز (CBOR) + حزم الفيديو
:core:security               Kotlin نقي: الهوية، المصافحة، AES‑GCM، SAS
:core:transport              Ktor WebSocket: Server/Client، RPC، Backoff
:core:discovery              NSD/mDNS إعلان واكتشاف
:core:data                   Room + DataStore + مفتاح الهوية في AndroidKeyStore
:core:designsystem           مواد عملاق (الحجر، الزجاج، الألوان، الخط) + LivingBackground
:engine:input                keys · gesture · cursor · text · service (Accessibility)
:engine:stream               quality · capture · encode · decode
:engine:monitor              parse · collect
:engine:files                guard · ops · transfer · roots
:engine:shell                sandbox · termux · services (svc.sh)
:engine:apps                 catalog · icons · launch · install (session · staged · abi) · beam
:engine:adb                  link (dadb loopback) · agent (app_process injector) · screen (screenrecord → Annex-B) · setup
:runtime:host                (تلفزيون) HostCore نقي، CallRouter، HostService
:runtime:client              (جوال) HubClient + واجهات بعيدة مطبوعة
:feature:tv:launcher         النظام: الشاشة الرئيسية وكل التطبيقات
:feature:tv:system           الإعدادات + نافذة الإقران
:feature:phone:{remote,screen,device,apps,files,services,settings}
:testing:e2e                 تلفزيون حقيقي (منطقيًا) ↔ جوال حقيقي على مقابس حقيقية
```

### قواعد الاعتماد (تمنع "تعديل شيء يخرب شيئًا آخر")
```
feature ──► runtime ──► engine ──► core
   │                       ▲
   └──► core:designsystem  └── المحركات لا تعرف بعضها أبدًا
```
- **المحرك لا يعتمد على محرك آخر.** التنسيق يتم في `runtime`.
- كل محرك يكشف واجهة صغيرة `api/` ويخفي التنفيذ `internal`.
- كل جزء من المحرك قابل للاستبدال: مثلًا `VideoEncoder` واجهة، و`MediaCodecEncoder` تنفيذها.
- المنطق النقي (تحويل الإحداثيات، الحزم، الحماية من `..`، سياسة إعادة الاتصال) مفصول عن Android ليُختبر على JVM.

## 3. البروتوكول

```
Frame = Request(id, Call) | Response(id, Reply) | Event(Push)
Call  = Input.* | Monitor.* | Files.* | Apps.* | Shell.* | Services.* | Stream.* | Session.*
```
- ترميز CBOR (kotlinx.serialization)، `PROTOCOL_VERSION` في المصافحة؛ عدم التطابق ← رسالة واضحة "حدّث التطبيق".
- RPC: مهلة لكل طلب، أخطاء مطبوعة (`Denied`, `Unavailable`, `InvalidPath`, …).
- الأحداث المكلفة (المقاييس كل ثانية) **لا تُرسل إلا عند وجود مشترك** — توفير RAM/CPU على التلفزيون.

## 4. دورة حياة التلفزيون
- `HostService`: Foreground Service بنوع `connectedDevice`، يُضاف نوع `mediaProjection` فقط أثناء البث (قاعدة Android 14).
- موافقة MediaProjection مطلوبة **مرة لكل تشغيل للخدمة** (قيد Android 14). نُبقي الـ projection حيًّا ونفصل/نوصل المُرمِّز عبر `VirtualDisplay.setSurface` — فتح وإغلاق البث من الجوال لا يطلب موافقة جديدة.
- يمكن تخطي نافذة الموافقة بأمر ADB لمرة واحدة (`appops PROJECT_MEDIA allow`) — سكربت `tools/tv-setup.sh`.
- الإقلاع: `BOOT_COMPLETED` يشغّل الخدمة (نوع connectedDevice مسموح من الإقلاع).

## 5. الإعداد لمرة واحدة على التلفزيون
Android 13+ يحجب تفعيل Accessibility للتطبيقات المثبتة من خارج المتجر ("Restricted settings")، وواجهة Google TV قد لا تُظهر خيار السماح. لذلك:
- **الطريق السهل**: `tools/tv-setup.sh <TV_IP>` — أمر واحد عبر ADB اللاسلكي يمنح: Accessibility، تثبيت التطبيقات، الوصول للملفات، تخطي موافقة البث.
- **بلا ADB**: صفحة «الحالة» على التلفزيون تعرض قائمة تحقق بخطوات مختصرة وزر يفتح الإعداد المناسب مباشرة.

## 6. الاختبارات (أكثر من طريقة)
| الطبقة | الأداة | ماذا تغطي |
|---|---|---|
| وحدات JVM | JUnit + Truth + Turbine | الأمان، البروتوكول، المنطق النقي لكل محرك |
| تكامل الشبكة | Ktor حقيقي على localhost | مصافحة + RPC + إعادة اتصال + قنوات |
| End‑to‑End | Host وهمي ↔ Client حقيقي | إقران ← موافقة ← اتصال صامت ← ريموت ← ملفات ← مقاييس ← فيديو |
| Android بلا جهاز | Robolectric | Room، DataStore، كتالوج التطبيقات، نظام الملفات |
| واجهات | Compose UI tests | التفاعل في الشاشات الأساسية |
| لقطات | Roborazzi | صورة لكل شاشة: داكن/فاتح × عربي/إنجليزي |
| سكربتات | bash | `svc.sh` يُشغَّل فعليًا ويدير عملية حقيقية |
| ثابت | Android Lint | |
| CI | GitHub Actions | كل ما سبق + بناء APK |
| الجهاز الحقيقي | صفحة «التشخيص» | تفحص قدرات الجهاز الفعلي وتُبلغ بما يعمل |
