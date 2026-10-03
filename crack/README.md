# «الشق» — فيلم ثلاثي الأبعاد، ٦٠ ثانية

من اللاشيء الأبيض إلى كل شيء، ثم العودة. كل لقطة دالّة في الزمن `t` فقط (نفس الإطار يُرسم دائماً بنفس النتيجة)،
والموسيقى مكتوبة من نفس الأرقام (cues.json) فلا يوجد أي انحراف بين الصوت والصورة.

## البنية
- `js/world.js` — العالم: سماء/أرضية استوديو رمادية، ظلال تلامس، مكعبات (ray-cast في الـfragment shader)، حالة المكعبات على الـGPU.
- `js/forms.js`, `dragon.js`, `castle.js`, `armies.js` — الأشكال التي تتحول إليها ٣٢٧٦٨ مكعباً (أفكار، تنين، قلعة، جيشان).
- `js/shot_*.js` — اللقطات الثماني. `js/director.js` يوزّعها على الزمن.
- `music.py` — الموسيقى والمؤثرات (numpy/scipy)، مقام حجاز على D، ١٢٨ BPM، وتُبطَّأ بنفس منحنى الزمن (bullet time) الذي تعتمده الصورة.
- `export_cues.js` ينتج `cues.json`؛ `render.js` يرسم الإطارات (Playwright + SwiftShader)؛ `build.sh` يدمج الصورة والصوت.

## التشغيل
```
node export_cues.js && python3 music.py            # → cues.json, audio.wav
for w in 0 1 2; do node render.js frames $w 3 1 60 0 3600 & done; wait
FFMPEG=/path/to/ffmpeg ./build.sh frames out/crack.mp4
```
