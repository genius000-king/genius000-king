# TV Control Hub

تحكّم بتلفزيون Google TV (Xiaomi TV Box S 3rd Gen) من الجوال عبر نفس شبكة Wi-Fi.
المشروع تطبيقان بلغة Kotlin يشتركان في بروتوكول واحد، ومنظّمان في محركات مستقلة.

- **apps/mobile** — تطبيق الجوال: الشاشة المباشرة، الريموت، الجهاز، الأدوات، الإعدادات.
- **apps/tv** — تطبيق التلفزيون: يلتقط الشاشة، وينفّذ الأوامر المصرّح بها، ويدير الإقران.

## الحالة

| المرحلة | الحالة |
|---|---|
| P0 — الأساس | ✅ مكتملة: بنية Gradle، الوحدات الأساسية، التطبيقان، خريطة التنقل، detekt، APK debug |
| P1 — إثبات الجدوى على الجهاز | 🧪 تطبيق الإثبات مكتوب ومُجمَّع ومُختبَر بالبناء. ينتظر التحقق على التلفزيون الحقيقي (انظر ROADMAP) |

التفاصيل في [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) و[docs/ROADMAP.md](docs/ROADMAP.md).

## البنية

```
core/common      منطق مشترك بلا Android (نتائج مُصنَّفة الأخطاء)
core/protocol    عقد الرسائل بين التطبيقين، وترميزه، وإصداراته (بلا Android)
core/design      هوية بصرية: ألوان، زجاج، خلفية، ثيم فاتح/داكن
apps/mobile      جذر تركيب الجوال + خريطة التنقل (5 أقسام)
apps/tv          جذر تركيب التلفزيون + الشاشات الست
```

المحركات (`engines/*`): `input` و`transport` و`stream` و`monitor` مكتوبة في P1. يُضاف `api` للمحرك عندما يكون له منطق نقي يُختبر، وتنفيذ لكل جهاز.

## البناء

المتطلبات: JDK 17 أو أحدث، وAndroid SDK مع `platforms;android-37.2` و`build-tools;37.0.0`.

```bash
export ANDROID_HOME=/path/to/android-sdk
./gradlew detekt test assembleDebug
```

الناتج:
- `apps/mobile/build/outputs/apk/debug/mobile-debug.apk`
- `apps/tv/build/outputs/apk/debug/tv-debug.apk`

## الاختبار

| النوع | الأمر | الغطاء الحالي |
|---|---|---|
| وحدات (JVM) | `./gradlew test` | 41 اختبارًا: ترميز البروتوكول، الإصدارات، النتائج، تحويل النقرات، ثوابت الهوية، خريطتا التنقل |
| تحليل ساكن | `./gradlew detekt` | الأسلوب، والتعليمات المكررة، وأسماء الملفات |

اختبارات الجهاز (`connectedAndroidTest`) وتقرير الـ Probe تبدأ في P1، ويجريها المالك على التلفزيون الفعلي.
