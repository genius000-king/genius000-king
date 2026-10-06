# بروتوكول المحركات

كل محرك ملف تنفيذي يشتغل كعملية مستقلة، وكلهم يتكلمون نفس الشكل. هذا الشكل هو نفسه اللي يستخدمه `bmoe-cli --session` من BigMoeOnEdge، فما احتجنا محوّل.

## الاتجاهات

| الاتجاه | الشكل |
|---|---|
| **stdin** (التطبيق → المحرك) | كائن JSON واحد في كل سطر |
| **stdout** (المحرك → التطبيق) | `<PREFIX>_<EVENT> {json}` في كل سطر. أي سطر غير هذا يُعتبر سجلًّا (log) |
| **stderr** | سجلات حرة. التطبيق يحتفظ بآخر 200 سطر ويعرضها لو المحرك مات |

البادئة `BMOE` لمحرك النص، و`IMQ` لمحركاتنا اللي بنكتبها. المحلل واحد: `RunnerLineParser(prefix)` في `engine:api`.

البيانات الكبيرة (صوت أو صورة) ما تمر عبر الأنابيب. تنكتب ملفًا في `cacheDir`، والـ JSON يحمل المسار بس.

## الأوامر المشتركة

```json
{"cmd":"cancel"}            // يوقف الطلب الحالي والنموذج يبقى محمّلًا
{"cmd":"close"}             // يخرج بهدوء ويرجّع الذاكرة
```

## الأحداث المشتركة

| الحدث | متى | أهم الحقول |
|---|---|---|
| `READY` | بعد تحميل النموذج | `load_s` ومعلومات النموذج |
| `BEGIN` | بداية طلب | `id` |
| `PROGRESS` | أثناء الطلب | حسب المحرك |
| `DONE` | نهاية طلب | النتيجة، `id`، `cancelled` |
| `ERROR` | خطأ | `id` (0 = أثناء التحميل)، `fatal`، `msg` |

## النص (`BMOE`) — bmoe-cli

```json
→ {"cmd":"generate","id":1,"n_predict":1024,"think":true,"clear_kv":false,"prompt":"..."}
← BMOE_READY {"load_s":4.1,"arch":"qwen3moe","n_ctx":4096,"think_ctl":"...","n_expert_used":8}
← BMOE_BEGIN {"id":1}
← BMOE_PROGRESS {"step":12,"wall_ms":510,"io_ms":300,"compute_ms":190,"read_mb":88.5,
                 "cache_hit_pct":71,"delta_reasoning":"","delta_text":"..."}
← BMOE_DONE {"id":1,"cancelled":false,"tokens":40,"tok_s":1.9,"prefill_s":3.2,"text":"...","reasoning":"..."}
```

- `delta_text` و`delta_reasoning` هي النص **الجديد** فقط. لو جاء `"reset":1` فمعناه **استبدل** المخزّن بدل ما تضيف عليه (يصير لما يتضح أن نصًا ظهر كإجابة كان تفكيرًا).
- المرجع الكامل: `third_party/bigmoeonedge/docs/telemetry.md`.

## الصوت ← نص (`IMQ`) — المرحلة 3، whisper.cpp

```json
→ {"cmd":"transcribe","id":1,"audio":"/cache/in.wav","language":"ar"}
← IMQ_PROGRESS {"id":1,"pct":40}
← IMQ_DONE {"id":1,"text":"...","language":"ar"}
```

## نص ← صوت (`IMQ`) — المرحلة 3، sherpa-onnx

```json
→ {"cmd":"synthesize","id":1,"text":"...","voice":"...","out":"/cache/out.wav"}
← IMQ_DONE {"id":1,"out":"/cache/out.wav","seconds":3.4}
```

## توليد الصور (`IMQ`) — المرحلة 4، stable-diffusion.cpp

```json
→ {"cmd":"generate","id":1,"prompt":"...","negative":"","width":512,"height":512,"steps":20,"seed":-1,"out":"/cache/img.png"}
← IMQ_PROGRESS {"id":1,"step":5,"steps":20}
← IMQ_DONE {"id":1,"out":"/cache/img.png"}
```
