# عملاق

تطبيق أندرويد (Kotlin) يشغّل أكبر نماذج الذكاء الاصطناعي على الجوال، **بدون إنترنت**.

النموذج ما يدخل الرام كله. الجزء اللي يشتغل مع كل توكن يبقى في الذاكرة، والباقي ينقرا من التخزين وقت الحاجة، وجزء من الرام محجوز للجوال دائمًا عشان ما يعلّق. على نماذج MoE هذا يعني نموذج 120B على جوال رامه 12 جيجا.

- **الخطة الكاملة والمراحل:** [`docs/PLAN.md`](docs/PLAN.md)
- **البنية والقرارات:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **بروتوكول المحركات:** [`docs/PROTOCOL.md`](docs/PROTOCOL.md)

## البناء

تحتاج: JDK 21، Android SDK، Android NDK r29، cmake، ninja.

```bash
git submodule update --init --recursive   # المحرك (BigMoeOnEdge + llama.cpp)
./scripts/build-native.sh                 # يبني المحرك لـ arm64 ويضمّنه في الـ APK
./gradlew test                            # كل الاختبارات
./gradlew assembleDebug                   # app/build/outputs/apk/debug/app-debug.apk
```

بدون جهاز كمبيوتر؟ كل push يشغّل GitHub Actions، وتنزّل الـ APK من صفحة الـ run (Artifacts) مباشرة على جوالك.

اختبار التطبيق مع المحرك **الحقيقي** على الكمبيوتر (نسخة Linux من bmoe-cli ونموذج MoE صغير):

```bash
cmake -S third_party/bigmoeonedge -B build-native/host -G Ninja -DCMAKE_BUILD_TYPE=Release \
      -DBMOE_BUILD_TESTS=OFF -DLLAMA_CURL=OFF && cmake --build build-native/host --target bmoe-cli
python third_party/bigmoeonedge/scripts/make-tiny-moe.py --arch qwen3moe --out /tmp/tiny-moe.gguf
IMLAQ_HOST_ENGINE=$PWD/build-native/host/cli/bmoe-cli IMLAQ_TINY_MOE=/tmp/tiny-moe.gguf \
  ./gradlew :engine:host:testDebugUnitTest --tests '*IntegrationTest*'
```

صورة للواجهة بدون جوال ولا محاكي:

```bash
./gradlew :app:testDebugUnitTest --tests '*ScreensScreenshotTest*'
# ← app/build/screenshots/: models-dark.png و chat-dark.png وغيرها
```

## الهيكل

```
app/                 الواجهة والربط
core/common          Bytes
core/designsystem    الثيم والمكوّنات
core/device          فحص الجهاز ومراقبة الذاكرة
core/memory          مخطط الذاكرة
core/models          قارئ GGUF ومتنبئ السرعة ومخزن النماذج
engine/api           عقود المحركات والبروتوكول
engine/host          تشغيل المحركات كعمليات منفصلة
scripts/             بناء المحركات الأصلية
third_party/         BigMoeOnEdge (submodule)
```

## شكر وتراخيص

- [BigMoeOnEdge](https://github.com/Helldez/BigMoeOnEdge): استريمنج خبراء MoE من الفلاش، Apache-2.0
- [llama.cpp](https://github.com/ggml-org/llama.cpp): MIT
- [IBM Plex Sans Arabic](https://github.com/IBM/plex): SIL OFL 1.1

التفاصيل في [`NOTICE`](NOTICE).
