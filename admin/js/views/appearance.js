// appearance.js — الألوان والخط والمسافات والحركة، بمعاينة حيّة داخل iframe.
import { el, throttle } from '../core/dom.js';
import { get, setAll } from '../core/store.js';
import { THEME_KEYS, setThemeKey, resetThemeKey } from '../core/theme.js';
import { upsert } from '../core/api.js';
import { fld, color, slider, tabs, toggle } from '../ui/fields.js';
import { icon } from '../ui/icon.js';
import { toast } from '../core/toast.js';
import { confirmModal } from '../ui/modal.js';
import { imageField } from '../ui/media.js';
import { makeLightStudio3D } from '../ui/light-studio3d.js';
import { previewFrame, pushTheme } from './preview.js';

/** ما يظهر للمشرف — القائمة المغلقة نفسها، مع تسميات عربية. */
const COLORS = [
  ['c-accent', 'اللون الأساسي', '#3B6EF6'],
  ['c-accent-2', 'اللون الثانوي', '#7C5CFF'],
  ['c-accent-text', 'لون النص الملوّن', '#7FA6FF'],
  ['c-brand', 'لون الشعار', '#0E86B4'],
  ['c-bg', 'خلفية الصفحة', '#060912'],
  ['c-surface-1', 'سطح البلاطة', '#0C1220'],
  ['c-surface-2', 'سطح مرتفع', '#121A2B'],
  ['c-line', 'لون الحدود', '#24314E'],
  ['c-text', 'لون النص', '#EAF0FF'],
  ['c-warm', 'اللون الدافئ', '#FF8A4C'],
];

const SCALES = [
  ['fs-scale', 'حجم الخط', 0.85, 1.25, 0.05, ''],
  ['s-scale', 'المسافات', 0.85, 1.25, 0.05, ''],
  ['fx-intensity', 'شدّة الحركة', 0, 1, 0.1, ''],
];

const GLASS = [
  ['glass-blur', 'قوة تمويه الزجاج', 8, 48, 2, 'px'],
  ['glass-sat', 'تشبّع الزجاج', 100, 220, 10, '%'],
  /* glass-tint مفهوماً هو تراكب أبيض شبه-شفاف فوق الزجاج، لكنّنا نخزّنه هنا
     كرقم شفافية (0 إلى 0.4) لا كقيمة rgba كاملة: حقل color() الموجود
     مبنيّ على <input type="color"> الذي لا يحمل قناة ألفا أصلاً (يقبل
     #RRGGBB فقط)، فتمثيل rgba(...) الحقيقي يحتاج عنصر تحكّم جديدًا خارج
     أدوات fields.js المُعاد استعمالها هنا. رقم الشفافية وحده يكفي عملياً
     ويمر بسهولة على فحص isSafeValue في theme.js (نمط NUM). */
  ['glass-tint', 'شفافية الزجاج', 0, 0.4, 0.01, ''],
];

/* إضاءة الشعار المجسّم — استوديو تصوير مصغّر بثلاثة أضواء بدل شريط
   مزالق: مفتاحيٌّ يرسم الشكل، وملءٌ يفتح ظلّه، وحافٌّ من الخلف يفصل
   الجسم عن الخلفية. القيم هنا هي نفس افتراضات logo-key، logo-fill،
   logo-rim المخزَّنة في theme.js — مكرَّرة هنا فقط لأنّ اللوحة تحتاجها
   كنقطة بداية قبل أوّل حفظ، ولأنّ زرّ «رجّع الإضاءة للأصل» يستعملها محلياً. */
const STUDIO_LIGHTS = [
  ['key', 'مفتاحيّ', { x: -0.55, y: 0.70, z: 1.00, power: 2.10, color: '#ffffff', angle: 1.10, soft: 0.55 }],
  ['fill', 'ملء', { x: 0.60, y: 0.87, z: 1.00, power: 0.34, color: '#ffffff', angle: 1.10, soft: 0.55 }],
  /* الحافّ زاويةً ماسّة لا خلفاً تماماً — كما في محرّك الشعار حرفاً
     بحرف. الخلف التامّ قِيس فوُجد تحت أرضية الضوضاء: لا يضيء شيئاً
     تراه الكاميرا. وأيّ خلافٍ بين هذه القيم وقيم المحرّك يعني بقعةً
     تقف في غير موضع ضوئها قبل أوّل حفظ. */
  ['rim', 'حافّ', { x: 2.40, y: -0.90, z: 0.15, power: 0.55, color: '#8fdcf7', angle: 1.10, soft: 0.55 }],
];

/* كل مفاتيح الاستوديو — تُستعمل لزرّ الإرجاع الجماعي وحده؛ لكل مفتاح
   أيضاً زرّ إرجاعٍ فردي عبر sliderRow/colorRow كبقيّة اللوحة. */
const STUDIO_KEYS = STUDIO_LIGHTS
  .flatMap(([id]) => [`logo-${id}-x`, `logo-${id}-y`, `logo-${id}-z`, `logo-${id}-power`,
    `logo-${id}-color`, `logo-${id}-angle`, `logo-${id}-soft`])
  .concat(['logo-ambient']);

/* مشتركة بين الأضواء الثلاثة — تبقى بمفاتيحها القديمة كما هي. */
const STUDIO_SHARED = [
  ['logo-ambient', 'الإضاءة المحيطة', 0, 2, 0.02, '', 0.34],
  ['logo-env-power', 'قوّة الانعكاس', 0, 4, 0.05, '', 1.15],
  ['logo-gloss', 'لمعان الجسم (أصغر = ألمع)', 0.01, 0.8, 0.01, '', 0.14],
];

/* ── الشعار ──
   الأولان مقاسه وموضعه، والباقي فيزياء تفاعله المجسّم. كلّها مفاتيح
   ثيم عادية: تُحفظ في جدول theme وتُكتب متغيّراتِ CSS على الجذر،
   ويقرؤها site/js/motion/logo-3d.js عند التركيب. */
const LOGO = [
  ['logo-size', 'حجم الشعار', 140, 620, 10, 'px'],
  ['logo-shift-x', 'إزاحة أفقية', -160, 160, 5, 'px'],
  ['logo-shift-y', 'إزاحة رأسية', -160, 160, 5, 'px'],
];

/* ── ترتيب الجوال، مستقلّ ──
   المحتوى والألوان والخطّ مشتركة بين الأجهزة، أما المواضع فلا:
   إزاحةٌ تُضبط لشاشة عريضة تدفع الشعار خارج شاشة الجوال. لذلك
   تبدأ إزاحة الجوال من الصفر ولا ترث شيئاً، والمقاس يرث ما لم
   يُضبط لأنه لا يُخرج شيئاً من الإطار. */
const LOGO_M = [
  ['logo-size-m', 'حجم الشعار — جوال', 140, 620, 10, 'px'],
  ['logo-shift-x-m', 'إزاحة أفقية — جوال', -160, 160, 5, 'px'],
  ['logo-shift-y-m', 'إزاحة رأسية — جوال', -160, 160, 5, 'px'],
];

const LOGO_FX = [
  ['logo-fx-r', 'قُطر التفكّك تحت المؤشّر', 0.05, 0.9, 0.01, ''],
  ['logo-fx-push', 'قوة تطاير الجسيمات', 0, 4000, 50, ''],
  ['logo-fx-lift', 'ارتفاعها عن السطح', 0, 2500, 20, ''],
  ['logo-fx-rise', 'سرعة التفكّك', 0.01, 0.4, 0.005, ''],
  ['logo-fx-fall', 'بطء العودة خلف المؤشّر', 0.05, 1.5, 0.05, ''],
  ['logo-grain', 'خشونة حافّة التفكّك', 0.2, 3, 0.05, ''],
  ['logo-track', 'سرعة ملاحقة المؤشّر', 0.02, 0.5, 0.01, ''],
  ['logo-tilt', 'مدى الميلان', 0, 1.4, 0.02, ''],
  ['logo-spin', 'التمايل الخامل', 0, 0.8, 0.01, ''],
  ['logo-particles', 'عدد الجسيمات', 1500, 20000, 500, ''],
];

const SHAPE = [
  ['r-md', 'استدارة البلاطات', 8, 40, 2, 'px'],
  ['r-lg', 'استدارة الكبيرة', 12, 52, 2, 'px'],
  ['bento-gap', 'المسافة بين البلاطات', 6, 32, 2, 'px'],
  ['bento-unit', 'ارتفاع صف البينتو', 70, 180, 5, 'px'],
  ['container', 'أقصى عرض للمحتوى', 1000, 1600, 20, 'px'],
];

const valueOf = (key, fallback) => get('theme').find((r) => r.key === key)?.value ?? fallback;

async function set(key, value) {
  try {
    await setThemeKey(key, value);
    pushTheme(get('theme'));
  } catch (e) { toast(e.message, 'error'); }
}

/** يحفظ x وy لضوءٍ واحد بطلبٍ واحد — سحبٌ يحرّك محورين لا يجوز أن
    يكتب مرّتين على القاعدة، وupsert PostgREST يقبل مصفوفة صفوف. */
/** صفوف الثيم بعد استبدال محاور ضوءٍ واحد — بلا تكرار مفتاح. */
function rowsWithXYZ(id, x, y, z) {
  const keys = [`logo-${id}-x`, `logo-${id}-y`, `logo-${id}-z`];
  const next = [{ key: keys[0], value: String(x) },
    { key: keys[1], value: String(y) }, { key: keys[2], value: String(z) }];
  return get('theme').filter((r) => !keys.includes(r.key)).concat(next);
}

/** يحفظ محاور ضوءٍ واحد بطلبٍ واحد — سحبةٌ تحرّك ثلاثة محاور لا يجوز
    أن تكتب ثلاث مرّات، وupsert PostgREST يقبل مصفوفة صفوف. */
async function commitLightXYZ(id, x, y, z) {
  const rows = rowsWithXYZ(id, x, y, z);
  const keys = [`logo-${id}-x`, `logo-${id}-y`, `logo-${id}-z`];
  try {
    await upsert('theme', rows.filter((r) => keys.includes(r.key)));
    setAll('theme', rows);
    pushTheme(rows);
  } catch (e) { toast(e.message, 'error'); }
}

/** أثناء السحب وحده — لا حفظ، فقط بثّ حيّ رخيص لإطار المعاينة. */
const pushLiveXYZ = throttle((id, x, y, z) => pushTheme(rowsWithXYZ(id, x, y, z)), 60);

export function render(host, { query } = {}) {
  const GROUPS = [['colors', 'الألوان'], ['type', 'الخط والمسافات'],
                  ['glass', 'الزجاج'], ['shape', 'الأشكال'],
                  ['logo', 'الشعار'], ['logofx', 'تفاعل الشعار'],
                  ['light', 'إضاءة الشعار'], ['bg', 'الخلفية'],
                  ['logom', 'ترتيب الجوال']];
  let active = GROUPS.some(([k]) => k === query?.g) ? query.g : 'colors';
  let selectedLight = 'key';
  let stopStage = null; // المسرح يُعاد بناؤه في كل draw()، فيوقَف القديم قبل التالي — كما grid-canvas.js في layout.js
  const body = el('div');

  const t = tabs(GROUPS, active, (k) => {
    active = k;
    history.replaceState(null, '', `#/appearance?g=${k}`);
    draw();
  });

  /* العنصر السابع اختياريّ: القيمة التي يعمل بها الموقع فعلاً حين لا
     يوجد صفٌّ محفوظ. بلا هذا تعرض المسطرة منتصفَ مداها — رقماً لا
     علاقة له بما يراه الزائر، فتقفز الإضاءة عند أوّل لمسة. */
  const sliderRow = ([key, label, min, max, step, unit, dflt]) => {
    const raw = String(valueOf(key, '')).replace(/[a-z%]+$/i, '');
    const n = Number(raw);
    const cur = Number.isFinite(n) && raw !== ''
      ? n
      : (Number.isFinite(dflt) ? dflt : (min + max) / 2);
    return el('div', { class: 'card', style: { padding: 'var(--a-4)' } }, [
      slider(cur, (v) => set(key, unit ? `${v}${unit}` : String(v)), { label, min, max, step, unit }),
      el('button', { class: 'btn btn--sm btn--ghost', type: 'button',
        onclick: async () => { await resetThemeKey(key); pushTheme(get('theme')); draw(); } },
        [icon('undo', { size: 13 }), 'الافتراضي']),
    ]);
  };

  /** بطاقة لون واحدة — نفس هيكل سطر colors تماماً، معاد استعمالها هنا
      لتبويبَي «إضاءة الشعار» و«الخلفية» وحدّ الزجاج بدل تكرارها. */
  const colorRow = (key, label, dflt) =>
    el('div', { class: 'card', style: { padding: 'var(--a-4)' } }, [
      fld(label, color(valueOf(key, dflt), (v) => set(key, v), { label, fallback: dflt })),
      el('button', { class: 'btn btn--sm btn--ghost', type: 'button',
        onclick: async () => { await resetThemeKey(key); draw(); pushTheme(get('theme')); } },
        [icon('undo', { size: 13 }), 'الافتراضي']),
    ]);

  /** تبويب «إضاءة الشعار» — استوديو ثلاثيّ: مصابيح تُمسك وتُحرّك. */
  function drawLightTab() {
    stopStage?.();

    const hexOr = (v, d) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v : d);
    /* ‎Number(v) || d‎ يبتلع الصفر المشروع: ضوءٌ أُطفئ أو وُضع في
       المنتصف يعود للافتراض من تلقائه. الفحص على الانتهاء لا الصدق. */
    const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
    const lightsData = STUDIO_LIGHTS.map(([id, label, d]) => ({
      id, label,
      x: num(valueOf(`logo-${id}-x`, d.x), d.x),
      y: num(valueOf(`logo-${id}-y`, d.y), d.y),
      z: num(valueOf(`logo-${id}-z`, d.z), d.z),
      power: num(valueOf(`logo-${id}-power`, d.power), d.power),
      angle: num(valueOf(`logo-${id}-angle`, d.angle), d.angle),
      soft: num(valueOf(`logo-${id}-soft`, d.soft), d.soft),
      color: hexOr(valueOf(`logo-${id}-color`, d.color), d.color),
    }));

    const studio = makeLightStudio3D({
      lights: lightsData, selected: selectedLight,
      onSelect: (id) => { selectedLight = id; lightTabs.select(id); drawSelected(); },
      onMove: (id, x, y, z) => pushLiveXYZ(id, x, y, z),
      onCommit: (id, x, y, z) => commitLightXYZ(id, x, y, z),
    });
    stopStage = studio.stop;

    const lightTabs = tabs(STUDIO_LIGHTS.map(([id, label]) => [id, label]), selectedLight, (id) => {
      selectedLight = id;
      studio.select(id);
      drawSelected();
    });

    const selectedBox = el('div', { class: 'fld-grid' });
    function drawSelected() {
      const [id, label, d] = STUDIO_LIGHTS.find(([lid]) => lid === selectedLight);
      selectedBox.replaceChildren(
        colorRow(`logo-${id}-color`, `لون ${label}`, d.color),
        sliderRow([`logo-${id}-power`, 'الشدّة', 0, 8, 0.1, '', d.power]),
        sliderRow([`logo-${id}-angle`, 'التركيز (ضيّق ← واسع)', 0.05, 1.4, 0.01, '', d.angle]),
        sliderRow([`logo-${id}-soft`, 'نعومة حافّة الضوء', 0, 1, 0.05, '', d.soft]),
      );
    }
    drawSelected();

    body.replaceChildren(
      el('p', { class: 'view__sub', style: { marginBlockEnd: 'var(--a-3)' } }, [
        'استوديو ثلاثيّ الأبعاد: اسحب الخلفية لتدوير الكاميرا حول الشعار، واسحب أيّ مصباح لتحريكه '
        + 'في الفراغ. العمق يتغيّر بحسب الجهة التي تنظر منها — أدِر الكاميرا ثمّ اسحب.',
      ]),
      studio.node,
      lightTabs.node,
      selectedBox,
      el('div', { class: 'fld-grid' }, STUDIO_SHARED.map(sliderRow)),
      el('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: async () => {
        try {
          for (const k of STUDIO_KEYS) await resetThemeKey(k);
          pushTheme(get('theme'));
          drawLightTab();
          toast('رجعت الإضاءة للأصل', 'success');
        } catch (e) { toast(e.message, 'error'); }
      } }, [icon('undo', { size: 13 }), 'رجّع الإضاءة للأصل']),
    );
  }

  function draw() {
    // مغادرة تبويب الإضاءة يجب أن توقف مستمعي المسرح — منها مستمعٌ على
    // window لا يزول بمجرّد نزع عقدته من DOM.
    if (active !== 'light') { stopStage?.(); stopStage = null; }

    if (active === 'colors') {
      body.replaceChildren(el('div', { class: 'fld-grid' },
        COLORS.map(([key, label, dflt]) => colorRow(key, label, dflt))));
    } else if (active === 'type') {
      body.replaceChildren(el('div', { class: 'fld-grid' }, SCALES.map(sliderRow)));
    } else if (active === 'glass') {
      body.replaceChildren(el('div', { class: 'fld-grid' }, [
        ...GLASS.map(sliderRow),
        colorRow('glass-border', 'لون حدّ الزجاج', '#2A3A5C'),
      ]));
    } else if (active === 'logo') {
      body.replaceChildren(
        el('p', { class: 'view__sub', style: { marginBlockEnd: 'var(--a-3)' } }, [
          'هذه قيم سطح المكتب. ترتيب الجوال في تبويب منفصل — فإزاحةٌ هنا لا تكسر الشاشة الصغيرة.',
        ]),
        el('div', { class: 'fld-grid' }, LOGO.map(sliderRow)),
      );
    } else if (active === 'logom') {
      body.replaceChildren(
        el('p', { class: 'view__sub', style: { marginBlockEnd: 'var(--a-3)' } }, [
          'مستقلّة تماماً عن سطح المكتب. الإزاحة تبدأ من الصفر؛ والحجم يرث قيمة سطح المكتب ما لم تحرّكه هنا.',
        ]),
        el('div', { class: 'fld-grid' }, LOGO_M.map(sliderRow)),
      );
    } else if (active === 'logofx') {
      body.replaceChildren(
        el('p', { class: 'view__sub', style: { marginBlockEnd: 'var(--a-3)' } }, [
          'حرّك المؤشّر فوق الشعار في المعاينة لترى الأثر. التغيير يُطبَّق عند إعادة رسم المعاينة.',
        ]),
        el('div', { class: 'fld-grid' }, LOGO_FX.map(sliderRow)),
      );
    } else if (active === 'light') {
      drawLightTab();
    } else if (active === 'bg') {
      body.replaceChildren(el('div', { class: 'fld-grid' }, [
        colorRow('page-bg', 'لون خلفية الصفحة', '#060912'),
        el('div', { class: 'card', style: { padding: 'var(--a-4)' } }, [
          fld('صورة الخلفية', imageField(valueOf('page-bg-image', ''), 'site',
            (v) => set('page-bg-image', v), 'صورة الخلفية')),
          el('button', { class: 'btn btn--sm btn--ghost', type: 'button',
            onclick: async () => { await resetThemeKey('page-bg-image'); draw(); } },
            [icon('undo', { size: 13 }), 'إزالة الصورة']),
        ]),
        sliderRow(['page-bg-dim', 'تعتيم الصورة', 0, 1, 0.05, '']),
      ]));
    } else {
      body.replaceChildren(el('div', { class: 'fld-grid' }, SHAPE.map(sliderRow)));
    }
  }

  draw();

  host.replaceChildren(el('div', { class: 'view' }, [
    el('div', { class: 'view__head' }, [
      el('div', {}, [
        el('h1', { class: 'view__title' }, ['المظهر']),
        /* السطر يسمّي ما في التبويبات: تسعةُ تبويبات بأسماء قصيرة
           لا تدلّ وحدها، والزجاج والخلفية كانا يُبحث عنهما فلا يُوجدان. */
        el('p', { class: 'view__sub' }, [
          'الألوان · الخطّ · الزجاج وشفافيته · خلفية الصفحة · الشعار وإضاءته وتفاعله. '
          + 'كل تغيير يظهر في المعاينة فوراً ويُحفظ تلقائياً.',
        ]),
      ]),
      el('div', { class: 'view__actions' }, [
        el('button', { class: 'btn btn--danger', type: 'button', onclick: async () => {
          if (!await confirmModal({ title: 'إرجاع كل المظهر؟',
            body: 'تعود كل الألوان والمقاسات لقيمها الأصلية.', confirm: 'إرجاع', danger: true })) return;
          for (const k of THEME_KEYS) await resetThemeKey(k).catch(() => {});
          setAll('theme', []);
          pushTheme({});
          draw();
          toast('رجع المظهر للأصل', 'success');
        } }, [icon('undo', { size: 15 }), 'إرجاع الكل']),
      ]),
    ]),
    t.node,
    el('div', { class: 'appear' }, [
      el('div', { class: 'appear__controls' }, [body]),
      el('div', { class: 'appear__preview' }, [previewFrame({ compact: true })]),
    ]),
  ]));
}
