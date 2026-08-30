// ============================================================
// bento-layout.js — توزيع صور كتلة على بلاطات بينتو.
//
// دوال خالصة بلا DOM — قابلة للاختبار وحدها، ويستعملها الموقع ولوحة
// المشرف معاً فيكون ما تراه في اللوحة هو نفسه ما يراه الزبون تماماً.
//
// كل بلاطة تحمل مقاسها في متغيّرين:  --cs (أعمدة) و --rs (صفوف)
// ونسختهما للجوال:                   --cs-m و --rs-m
// لوحة المشرف تكتب هذه الأرقام فيتغيّر التقسيم مباشرة بلا كود.
// ============================================================

/** الشبكة: 12 عموداً على سطح المكتب · 4 على الجوال. */
export const COLS = 12;
export const COLS_M = 4;

/** المقاسات المسمّاة — الاسم يُحفظ في القاعدة، لا الأرقام. */
export const PRESETS = {
  hero:    { cs: 8, rs: 2, csM: 4, rsM: 2, label: 'بطل' },
  banner:  { cs: 12, rs: 1, csM: 4, rsM: 1, label: 'شريط' },
  wide:    { cs: 6, rs: 1, csM: 4, rsM: 1, label: 'عريضة' },
  bigwide: { cs: 6, rs: 2, csM: 4, rsM: 2, label: 'عريضة طويلة' },
  tall:    { cs: 3, rs: 2, csM: 2, rsM: 2, label: 'طويلة' },
  box:     { cs: 3, rs: 1, csM: 2, rsM: 1, label: 'مربّعة' },
  third:   { cs: 4, rs: 1, csM: 2, rsM: 1, label: 'ثلث' },
  thirdTall: { cs: 4, rs: 2, csM: 2, rsM: 2, label: 'ثلث طويل' },
  mini:    { cs: 2, rs: 1, csM: 2, rsM: 1, label: 'صغيرة' },
};

/* ── شبكات منتظمة ──
   البينتو فوق يعطي أحجاماً متفاوتة، وأحياناً يُراد العكس: صفوف
   مرتّبة بخلايا متساوية مربّعة. هنا الأعداد التي تقسم ١٢ بالتساوي.

   الارتفاع: الخلية تصير مربّعة حين يساوي ارتفاعُها عرضَها. عرض
   الخلية = (عرض الحاوية × cs / 12)، وارتفاعها = rs × unit. فلا
   يمكن ضمان التربيع بأرقام ثابتة — لذلك يحمل كل نمط `square: true`
   ويطبّقه CSS بـ aspect-ratio على الخلية بدل حساب rs. */
export const GRIDS = {
  grid2: { per: 2, cs: 6, csM: 2, label: 'شبكة ثنائية — صورتان في الصف' },
  grid3: { per: 3, cs: 4, csM: 2, label: 'شبكة ثلاثية — ثلاث في الصف' },
  grid4: { per: 4, cs: 3, csM: 2, label: 'شبكة رباعية — أربع في الصف' },
  grid6: { per: 6, cs: 2, csM: 2, label: 'شبكة سداسية — ستّ في الصف' },
};

/* ٥ في الصفّ لا يقسم ١٢. نعطيه شبكةً من عشرة أعمدة بدل اثني عشر:
   الخليّة تشغل عمودين من عشرة. هذا يتطلّب تغيير cols للكتلة كلها،
   ولذلك يحمل النمط `cols` صريحاً تقرؤه اللوحة والموقع معاً. */
export const GRID_COLS = { grid5: 10 };
GRIDS.grid5 = { per: 5, cs: 2, csM: 2, cols: 10, label: 'شبكة خماسية — خمس في الصف' };

/* ── معرض أفقي ──
   ليس شبكة أصلاً: شريط واحد يمشي أفقياً بلا نهاية، يتحرّك وحده
   ويُسحب باليد. يتولّاه motion/marquee.js — والمخطِّط هنا يكتفي
   بالإشارة إليه فلا يحسب صفوفاً ولا أعمدة. */
export const isGallery = (mode) => mode === 'gallery';

export const GRID_KEYS = Object.keys(GRIDS);
export const isGrid = (mode) => Object.prototype.hasOwnProperty.call(GRIDS, mode);
/** عدد أعمدة الشبكة لنمط ما — ١٢ ما لم يُذكر خلافه. */
export const colsFor = (mode) => (isGrid(mode) && GRIDS[mode].cols) || COLS;

export const PRESET_KEYS = Object.keys(PRESETS);

/** يحوّل اسم مقاس (أو مقاساً مخصّصاً) إلى أرقام آمنة. */
export function resolveSpan(span) {
  if (span && typeof span === 'object') {
    return {
      cs:  clamp(span.cs,  1, COLS,   3),
      rs:  clamp(span.rs,  1, 4,      1),
      csM: clamp(span.csM, 1, COLS_M, 2),
      rsM: clamp(span.rsM, 1, 4,      1),
    };
  }
  const p = PRESETS[span];
  return p ? { cs: p.cs, rs: p.rs, csM: p.csM, rsM: p.rsM } : { ...PRESETS.box };
}

function clamp(v, lo, hi, dflt) {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

/** يستنتج مقاساً من نسبة الصورة وموضعها. */
export function spanFor(image, index) {
  if (image && image.span) return image.span;             // اختيار المشرف يسبق كل شيء
  const ar = ratioOf(image);
  if (index === 0) return 'hero';
  if (ar === null) return 'box';
  if (ar < 0.82) return 'tall';                            // طولية
  if (ar > 1.4) return 'wide';                             // عرضية (3:2 فأعرض)
  return 'box';
}

function ratioOf(image) {
  if (!image) return null;
  const w = Number(image.w || image.width);
  const h = Number(image.h || image.height);
  if (w > 0 && h > 0) return w / h;
  if (Number.isFinite(Number(image.ratio))) return Number(image.ratio);
  return null;
}

/**
 * يخطّط جدار البينتو لكتلة.
 *
 * @param {Array}  images صور الكتلة — كل صورة قد تحمل span و w/h
 * @param {string} mode   auto · mosaic · hero · strip · pair · trio · manual
 * @param {object} opts   { fillGaps: boolean }
 * @returns {{ cells: Array, rows: number }}
 */
export function planBento(images = [], mode = 'auto', opts = {}) {
  const list = (Array.isArray(images) ? images : []).filter(Boolean);
  if (!list.length) return { cells: [], rows: 0 };

  // المعرض لا يُخطَّط: الشريط يرتّب نفسه أفقياً
  if (isGallery(mode)) {
    return {
      cells: list.map((im, i) => ({ kind: 'media', image: im, index: i })),
      rows: 1, cols: COLS, square: false, gallery: true,
    };
  }

  // الشبكة المنتظمة تتجاوز كل حساب: خلايا متطابقة، بلا ملء فجوات
  // (الفجوة في آخر صفّ مقصودة هنا — ملؤها يكسر انتظام الشبكة)
  if (isGrid(mode)) {
    const g = GRIDS[mode];
    const cells = list.map((im, i) => ({
      kind: 'media', image: im, index: i, square: true,
      cs: g.cs, rs: 1, csM: g.csM, rsM: 1,
    }));
    return { cells, rows: Math.ceil(list.length / g.per), cols: g.cols || COLS, square: true };
  }

  const cells = list.map((im, i) => {
    const span = resolveSpan(pickSpan(im, i, mode, list.length));
    return { kind: 'media', image: im, index: i, ...span };
  });

  if (opts.fillGaps !== false) fillGaps(cells);
  return { cells, rows: rowsNeeded(cells), cols: COLS, square: false };
}

function pickSpan(im, i, mode, total) {
  if (im.span) return im.span;                             // اختيار يدوي من اللوحة
  switch (mode) {
    case 'manual': return im.span || 'box';
    case 'mosaic': return ['tall', 'box', 'wide', 'box', 'tall', 'box'][i % 6];
    case 'hero':   return i === 0 ? 'hero' : 'box';
    case 'strip':  return 'wide';
    case 'pair':   return 'wide';
    case 'trio':   return 'third';
    case 'auto':
    default:       return spanFor(im, total > 1 ? i : 1);  // صورة واحدة لا تصير «بطلاً» ناقصاً
  }
}

/**
 * يملأ فجوات آخر صف ببلاطات لون مصمتة — كما في المرجع البصري.
 * بلا هذا تُترك فراغات سوداء غير مقصودة في نهاية الجدار.
 */
export const MAX_FILL = 2;

export function fillGaps(cells) {
  // المساحة لا عدد الأعمدة: البلاطة الطويلة تشغل cs×rs وحدة
  let area = 0;
  for (const c of cells) area += c.cs * c.rs;
  const rem = area % COLS;
  if (rem === 0) return cells;

  let gap = COLS - rem;
  let added = 0;
  while (gap > 0 && added < MAX_FILL) {
    const cs = Math.min(gap, gap >= 6 ? 6 : gap >= 3 ? 3 : gap);
    cells.push({ kind: 'fill', cs, rs: 1, csM: 2, rsM: 1, index: cells.length });
    gap -= cs;
    added++;
  }
  return cells;
}

function rowsNeeded(cells) {
  let units = 0;
  for (const c of cells) units += c.cs * c.rs;
  return Math.ceil(units / COLS);
}

/** الأنماط المتاحة للمشرف — البينتو الحرّ أولاً ثم الشبكات المنتظمة. */
export const MODES = [
  ['auto',   'تلقائي — حسب نسبة كل صورة'],
  ['mosaic', 'فسيفساء — أحجام متناوبة'],
  ['hero',   'بطل — أولى كبيرة والباقي مربّعات'],
  ['strip',  'شريط — كلها عريضة'],
  ['pair',   'ثنائي — صورتان في الصف'],
  ['trio',   'ثلاثي — ثلاث في الصف'],
  ['grid2',  GRIDS.grid2.label],
  ['grid3',  GRIDS.grid3.label],
  ['grid4',  GRIDS.grid4.label],
  ['grid5',  GRIDS.grid5.label],
  ['grid6',  GRIDS.grid6.label],
  ['gallery', 'معرض — شريط أفقي يمشي وحده ويُسحب باليد'],
  ['manual', 'يدوي — تختار مقاس كل صورة'],
];
