# video-studio — محرّك مونتاج برمجي

المونتاج هنا **كود** (Remotion + React). لا تسحب ملفات على تايملاين: تكتب مشهداً،
والمحرّك يعطي كل نص خطّه وحركته وصوته، ويضع كل مؤثر صوتي على الفريم الذي يخصّه.

## المبادئ الثلاثة

1. **كل نص له شخصية**: خط + حركة + صوت، معرّفة معاً في `src/text/Kinetic.tsx`.
   لا يمكن أن تظهر كلمة بلا صوتها أو بصوت لا علاقة له بها.
2. **الصوت يُولد من الحركة**: كل مؤثر يعرف أين ذروته (نهاية الرايزر، منتصف الووش،
   بداية الضربة). المحرّك يضع الذروة على فريم الحدث البصري بالضبط — `src/sfx/library.tsx`.
3. **البي-رول حقيقي**: شعارات رسمية تُجلب آلياً، وتسجيلات شاشة حقيقية داخل نافذة
   macOS، مع أصوات النقر والكتابة والتمرير في لحظاتها الحقيقية.

## التشغيل

```bash
npm install
npm run sfx:fetch            # حزم Kenney (CC0)
npm run sfx:synth            # المؤثرات السينمائية المصنوعة رياضياً
node tools/index-sfx.mjs     # فهرسة أطوال الأصوات
npm run studio               # معاينة حيّة في المتصفح
npx remotion render src/index.ts Showcase out/showcase.mp4
bash tools/master.sh out/showcase.mp4   # ماستر الصوت إلى -14 LUFS (معيار يوتيوب)
```

## البي-رول

```bash
node tools/fetch-logo.mjs youtube netflix "OpenAI"        # شعار رسمي + لون العلامة
node tools/record-web.mjs youtube "fluid dynamics" yt-fluids  # بحث يوتيوب + تمرير → mp4 + أحداث
node tools/record-web.mjs google "navier stokes"
node tools/record-web.mjs url https://example.com
```

- الشعارات: Simple Icons (أكثر من 3000 علامة، SVG متجهي) ثم ويكيبيديا كاحتياط.
- التسجيل: متصفح حقيقي بلا حساب، مؤشر فأرة مرئي، كتابة بإيقاع بشري، تمرير ناعم.
  ملف `.json` بجانب الفيديو فيه توقيت كل نقرة وحرف وتمرير → المحرّك يضع الصوت عليها.

## أنماط النص (`src/text/Kinetic.tsx`)

| النمط | الخط | الحركة | الصوت |
|---|---|---|---|
| `LiquidFill` | Lalezar | قلم يرسم الحدود ← سائل يرتفع بموجة وفقاعات ← يستقرّ حبراً | خربشة قلم + جريان + فقاعات + بريق |
| `Slam` | Noto Kufi 900 | يسقط من فوق الكاميرا ← ارتطام، موجة صدمة، غبار، انفصال لوني | سحب معكوس + ضربة سينمائية + معدن |
| `WordCascade` | Rakkas | كلمة كلمة تصعد من الضباب وتدور في العمق، وقلم تحديد خلف الكلمات المفتاحية | نقرة لكل كلمة + احتكاك القلم |
| `Typewriter` | Handjet / Mono | حرف بحرف بإيقاع بشري غير منتظم + مؤشّر | مفتاح لكل حرف (8 تنويعات) + Enter |
| `GlitchText` | Reem Kufi | شرائح منزاحة + فصل RGB + دفقات ارتعاش | غلتش رقمي |
| `InkReveal` | Aref Ruqaa | قناع حبر ينساب من اليمين | قلم + كشف أنيق |
| `BilingualSplit` | Lalezar + Crimson | عربي وإنجليزي من جهتين متعاكستين + خط يُرسم | ووش + نغمة زجاج |
| `CountUp` | Noto Kufi 900 | عدّاد مسافات حقيقي: كل خانة تدور مستقلة | نقرة لكل تغيّر + نغمة وصول |

ملاحظة عربية: الحروف العربية متصلة، فلا نحرّكها حرفاً حرفاً (يكسر الوصل). نحرّكها
بالكلمة أو بالقناع. اللاتيني يُحرَّك بالحرف.

## قاموس الأصوات (`GRAMMAR`)

`title.slam`، `word.pop`، `word.key`، `write.pen`، `type.key`، `glitch`، `reveal.elegant`،
`mark.highlight`، `count.tick`، `fluid.fill`، `fluid.bubble`، `transition.whoosh|whip|paper`،
`build.riser`، `drop`، `logo.reveal`، `window.open|close`، `screen.click|scroll|zoom`،
`camera.shutter`، `bed.drone`…

```tsx
<Sfx event="title.slam" at={45} />          // ذروة الضربة على الفريم 45
<SfxTrain event="type.key" frames={[..]} /> // سلسلة، كل واحدة بتنويعة مختلفة
```

المصادر: Kenney (CC0، حرّة للاستخدام التجاري) + مؤثرات مصنوعة في `tools/synth_sfx.py`
(ووش، رايزر، صب-بوم، ضربة سينمائية، سحب معكوس، بريق، فقاعات، جريان، غلتش، توقّف شريط،
غالق كاميرا، بساط صوتي) — طولها وذروتها محسوبان بالعيّنة.
