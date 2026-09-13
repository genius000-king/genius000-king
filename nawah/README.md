<div align="center">
  <img src="brand/nawah-logo.png" width="140" alt="Nawah">
  <h1>نواة · Nawah</h1>
  <p><strong>لينكس كامل بسطح مكتب رسومي على جوالك — تطبيق واحد، بلا روت، وبلا أي تطبيق مساعد.</strong></p>
  <p><em>A full Linux desktop on Android. One APK, no root, no Termux.</em></p>
</div>

---

## بالعربية

### ما هذا؟

تطبيق أندرويد واحد يثبّت **دبيان** ويشغّلها عبر `proot` (بلا صلاحية جذر)،
ويعرض سطح مكتب **XFCE 4** عبر خادم **X11** مدمج داخل التطبيق نفسه.

لا تحتاج Termux، ولا Termux:X11، ولا أي تطبيق آخر. تفتح التطبيق، تختار
التوزيعة وسطح المكتب والموارد والصلاحيات، تضغط "تثبيت"، ثم تضغط "تشغيل".

### ما الذي يعمل فعلًا

- تثبيت **دبيان 12/13** أو **أوبنتو 22.04/24.04**، تُسحب صورتها من سجلّ الحاويات ويُتحقق من بصمتها أثناء التنزيل
- **سبعة أسطح مكتب**: XFCE · LXQt · MATE · i3 · Openbox · KDE · جنوم — لكلٍّ وزن معلن، لأن كل شيء يُرسم برمجيًا هنا
- **منفذ USB حقيقي**: لوحة أردوينو أو ESP تظهر داخل لينكس كـ `/dev/ttyUSB0`، فتعمل `screen` و`avrdude` و`arduino-cli` بلا تعديل
- **برامج اختيارية**: متصفح ومترجم وأدوات عتاد تُختار عند الإنشاء أو تُضاف لاحقًا
- اللمس ولوحة المفاتيح والفأرة
- الصوت والميكروفون: خادم PulseAudio داخل النظام يصبّ في مصرف صامت، والتطبيق يقرأ مراقبه عبر loopback ويشغّله
- الوصول إلى `/sdcard` داخل النظام
- أكثر من نظام بأسماء مختلفة، لكل واحد إعداداته
- واجهة عربية وإنجليزية، تُبدَّل من داخل التطبيق

### ما الذي لا يعمل — وهذا مقصود قوله بصراحة

| ما قد تتوقعه | الحقيقة |
|---|---|
| **تحديد الذاكرة (RAM)** | مستحيل. `proot` بلا cgroups، وتحديد الذاكرة يحتاج صلاحية جذر. "ملف الموارد" في التطبيق يغيّر مجموعة الحزم ومؤثرات النوافذ ودقة الشاشة — أشياء تغيّر الاستهلاك فعلًا — ولا يدّعي حدًّا وهميًّا. |
| **تحديد المساحة** | الـ rootfs مجلد عادي لا صورة قرص. الأرقام المعروضة **تقدير وتحذير**، لا حصّة مفروضة. |
| **الكاميرا** | `/dev/video*` غير متاح لتطبيقات أندرويد أصلًا. غير ممكن. |
| **قطع الشبكة عن نظام** | يحتاج فضاء أسماء شبكة، وهذا يحتاج روت. كان في التطبيق مفتاح لهذا لا يفعل شيئًا، وقد حُذف. |
| **الأداء** | `proot` يعترض نداءات النظام عبر `ptrace`، وهذا يكلّف ~1.5–3× في الأحمال الثقيلة. XFCE على `llvmpipe` في جهاز متوسط ≈ 15–30 إطارًا/ث. |
| **متجر Google Play** | الرفض شبه مؤكد: التطبيق ينزّل كودًا وينفّذه (سابقة حذف Termux). التوزيع عبر GitHub Releases أو F-Droid أو APK مباشر. |

### المتطلبات

أندرويد 7 (API 24) فأحدث · معالج **arm64** · ‏3 جيجابايت مساحة حرة على الأقل ·
إنترنت عند التثبيت الأول (~50 ميجابايت للصورة، ثم حزم سطح المكتب)

### التثبيت

نزّل ملف APK من صفحة [Releases](../../releases) وثبّته. لا حاجة لأي شيء آخر.

---

## In English

### What it is

A single Android app that installs **Debian** and runs it under `proot` with no
root, then draws an **XFCE 4** desktop through an **X11** server embedded in the
app itself.

No Termux, no Termux:X11, nothing else to install. Open it, pick a
distribution, a desktop, resources and permissions, press Install, then Run.

### What actually works

Debian 12/13 and Ubuntu 22.04/24.04, installed from a digest-verified system
image · seven desktops, each with its weight stated · a real serial port:
an Arduino or ESP board appears inside Linux as `/dev/ttyUSB0` · optional
software picked at install or added later · touch, keyboard and mouse · sound and
microphone, through a PulseAudio server inside the system whose null-sink
monitor the app reads over loopback · `/sdcard` access · several named systems
side by side · Arabic and English, switchable in the app.

### What does not, and why

- **RAM limits** — impossible. `proot` has no cgroups, and capping memory needs
  root. The resource profile changes the package set, compositing and
  resolution, which are things that genuinely change memory use. It does not
  pretend to enforce a limit.
- **Disk quotas** — the rootfs is a directory, not an image. The figures shown
  are estimates and warnings.
- **Camera** — `/dev/video*` is not exposed to Android apps at all.
- **Cutting a system off the network** — needs a network namespace, which needs
  root. There was a switch for this that did nothing; it has been removed.
- **Performance** — `proot` intercepts syscalls with `ptrace`, costing roughly
  1.5–3× on syscall-heavy work. XFCE on `llvmpipe` runs about 15–30 fps on a
  mid-range device.
- **Google Play** — almost certainly rejected: the app downloads and executes
  code, and Termux's own removal is the precedent. Distribute via GitHub
  Releases, F-Droid, or a direct APK.

### Requirements

Android 7 (API 24)+ · **arm64** · at least 3 GB free · internet for the first
install.

---

## How it works

```
┌────────────────────────── one APK ──────────────────────────┐
│                                                             │
│  Compose UI ──► SessionService ──┬──► X server (app_process) │
│                                  │         │                │
│                                  │         ▼                │
│                                  │   <rootfs>/tmp/.X11-unix │
│                                  │         ▲                │
│                                  └──► proot ──► Debian      │
│                                            nawah-session    │
│         com.termux.x11.MainActivity ◄── Binder + fd         │
└─────────────────────────────────────────────────────────────┘
```

The X server runs on the **Android** side, not inside the container, and binds
its socket in the machine's own `/tmp` — so the desktop finds it as an ordinary
`/tmp/.X11-unix/X0` with nothing mounted or forwarded. The rendering surface is
`com.termux.x11.MainActivity`, which receives the connection as a file
descriptor over Binder. `docs/x11-bridge.md` explains the whole handshake, and
the three ways it was got wrong.

| Module | What it is |
|---|---|
| `:app` | Compose M3 UI, services, orchestration |
| `:core` | model, device probe, proot runtime, install pipeline, OCI client |
| `:lorie` | the X server — vendored from termux-x11, unmodified |

## Building from source

```sh
git clone --recurse-submodules <this repo>
cd nawah
./gradlew :app:assembleDebug
```

`--recurse-submodules` is not optional: the X server is sixteen nested
submodules and the build fails confusingly without them. You also need
`bison`, `cmake`, `ninja` and `python3` on the build machine — the X server is
compiled from source.

```sh
./gradlew :core:test          # unit tests
python3 tools/native/verify.py  # bundled binary integrity
```

Note that a green build means "it compiles and its logic is correct", not "the
desktop works" — see `docs/testing.md`.

## Documentation

| | |
|---|---|
| [`docs/x11-bridge.md`](docs/x11-bridge.md) | how the desktop reaches the screen, and how it breaks |
| [`docs/native-binaries.md`](docs/native-binaries.md) | why executables are named `lib*.so` |
| [`docs/CONTRACTS.md`](docs/CONTRACTS.md) | the module contracts |
| [`docs/testing.md`](docs/testing.md) | what CI can and cannot prove |
| [`docs/device-testing-checklist.md`](docs/device-testing-checklist.md) | the on-device test pass |
| [`docs/adding-a-distro.md`](docs/adding-a-distro.md) | adding Ubuntu, Arch, KDE, LXQt |
| [`docs/release.md`](docs/release.md) | signing and publishing |

## Credit

The hard parts of this are not ours. **proot**, the Android package builds, and
the **lorie** X server are the work of the [Termux](https://github.com/termux)
project and its contributors — years of it. This app integrates that work; it
did not invent it.

## Licence

GPL-3.0. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE) — the licence follows
from the components bundled, it is not a preference.
