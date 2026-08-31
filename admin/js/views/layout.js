// layout.js — ترتيب الأقسام وإظهارها وخلفياتها. السحب هو التفاعل الرئيسي.
import { el } from '../core/dom.js';
import { get, setAll } from '../core/store.js';
import { insert } from '../core/api.js';
import { save } from '../core/autosave.js';
import { toast } from '../core/toast.js';
import { icon } from '../ui/icon.js';
import { makeSortable } from '../ui/sortable.js';
import { fld, toggle, select, slider, color, tabs } from '../ui/fields.js';
import { openDrawer, closeDrawer } from '../ui/drawer.js';
import { reloadPreview } from './preview.js';

const SECTIONS = [
  ['hero', 'الصفحة الرئيسية'], ['about', 'من أنا'], ['works', 'الأعمال'],
  ['packages', 'البكجات'], ['services', 'الخدمات'], ['process', 'كيف نشتغل'],
  ['testimonials', 'الآراء'], ['payments', 'طرق الدفع'], ['order', 'الطلب'],
];
const LABEL = Object.fromEntries(SECTIONS);

const BG_TYPES = [['none', 'بلا خلفية'], ['color', 'لون'], ['gradient', 'تدرّج'], ['image', 'صورة']];

/* ── العروض المتاحة ──
   الصفحة اثنا عشر عموداً. هذه القسمة وحدها تعطي صفوفاً تُملأ تماماً:
   ١٢ وحده، أو ٦+٦، أو ٤+٤+٤، أو ٣+٣+٣+٣. أي عرض آخر يترك فجوة. */
const SPANS = [[12, 'كامل'], [6, 'نصف'], [4, 'ثلث'], [3, 'ربع']];

/** مربّعات صغيرة ترسم العرض — يُرى بالعين لا يُقرأ رقماً. */
function spanPicker(value, onPick) {
  const box = el('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } });
  const draw = () => box.replaceChildren(...SPANS.map(([n, label]) => el('button', {
    class: `btn btn--sm ${Number(value) === n ? 'btn--primary' : ''}`,
    type: 'button', title: `${label} — ${n} من ١٢`,
    onclick: () => { value = n; onPick(n); draw(); },
  }, [
    el('span', { style: {
      display: 'inline-block', inlineSize: `${n * 3.2}px`, blockSize: '10px',
      borderRadius: '2px', background: 'currentColor', opacity: '.85',
      marginInlineEnd: '6px', verticalAlign: 'middle',
    } }),
    label,
  ])));
  draw();
  return box;
}

/** يضمن وجود صفّ لكل قسم — الجدول قد يكون ناقصاً. */
async function ensureRows() {
  const have = new Set(get('layout').map((l) => l.section_key));
  const missing = SECTIONS.filter(([k]) => !have.has(k));
  if (!missing.length) return;
  const created = [];
  for (let i = 0; i < missing.length; i++) {
    const row = await insert('layout', {
      section_key: missing[i][0],
      sort: get('layout').length + i + 1,
      sort_m: get('layout').length + i + 1,     // الجوال يبدأ بنفس الترتيب
      span: 12, span_m: 12,                     // وبعرض كامل — السلوك السابق
      columns: 2, align: 'stretch', gap: '', bg_type: 'none', bg_value: '',
      visible: true, visible_m: true,
    }).catch(() => null);
    if (row) created.push(row);
  }
  if (created.length) setAll('layout', [...get('layout'), ...created]);
}

function editSection(row, done) {
  const patch = (k, v) => {
    row[k] = v;
    save('layout', row.id, { [k]: v }).catch((e) => toast(`تعذّر الحفظ: ${e.message}`, 'error'));
    reloadPreview();
  };
  const bgHost = el('div');
  const drawBg = () => {
    bgHost.replaceChildren(
      row.bg_type === 'color'
        ? fld('اللون', color(row.bg_value, (v) => patch('bg_value', v), { label: 'خلفية القسم' }))
        : row.bg_type === 'gradient'
          ? fld('التدرّج', el('input', { class: 'field mono', value: row.bg_value || '',
              placeholder: 'linear-gradient(180deg, #0b1220, #060912)',
              oninput: (e) => patch('bg_value', e.target.value) }), 'صيغة CSS كاملة')
          : row.bg_type === 'image'
            ? fld('رابط الصورة', el('input', { class: 'field mono', value: row.bg_value || '',
                placeholder: 'https://…', oninput: (e) => patch('bg_value', e.target.value) }),
                'تُضاف طبقة تعتيم تلقائياً حتى يبقى النص مقروءاً')
            : null,
    );
  };
  drawBg();

  openDrawer({
    title: LABEL[row.section_key] || row.section_key, sub: 'الحفظ تلقائي',
    body: el('div', { class: 'stack stack--lg' }, [
      toggle(row.visible !== false, (v) => patch('visible', v), 'ظاهر في الموقع'),
      slider(Number(row.columns) || 2, (v) => patch('columns', Number(v)),
        { label: 'عدد الأعمدة على سطح المكتب', min: 1, max: 4, step: 1 }),
      fld('محاذاة البلاطات', select(row.align || 'stretch',
        [['stretch', 'تمدُّد'], ['start', 'أعلى'], ['center', 'وسط'], ['end', 'أسفل']],
        (v) => patch('align', v), { label: 'المحاذاة' })),
      fld('نوع خلفية القسم', select(row.bg_type || 'none', BG_TYPES,
        (v) => { patch('bg_type', v); drawBg(); }, { label: 'نوع الخلفية' })),
      bgHost,
    ]),
    foot: el('button', { class: 'btn btn--block', type: 'button', onclick: () => closeDrawer() }, ['تم']),
    onClose: done,
  });
}

export async function render(host) {
  await ensureRows();
  const wrap = el('div');

  /* الجهاز الذي نحرّره الآن. الترتيب والعرض والإظهار لكلٍّ منهما
     عمودٌ خاصّ في القاعدة — فما يُضبط هنا لا يمسّ الآخر إطلاقاً.
     أما الخلفية والمسافة فمشتركة: ليست تخطيطاً. */
  let dev = 'd';
  const K = () => (dev === 'm'
    ? { sort: 'sort_m', span: 'span_m', vis: 'visible_m' }
    : { sort: 'sort',   span: 'span',   vis: 'visible' });

  const draw = () => {
    const k = K();
    const rows = get('layout')
      .filter((l) => LABEL[l.section_key])
      .sort((a, b) => (a[k.sort] ?? 99) - (b[k.sort] ?? 99));
    const list = el('div', { class: 'sortable' });

    list.replaceChildren(...rows.map((r, i) => el('div', {
      class: `sort-row ${r[k.vis] === false ? 'is-off' : ''}`, 'data-id': r.id,
    }, [
      el('span', { class: 'grip', 'aria-hidden': 'true' }, [icon('drag', { size: 15 })]),
      el('span', { class: 'mono fld__hint', style: { inlineSize: '22px' } }, [String(i + 1)]),
      el('button', { class: 'link grow', type: 'button', style: { textAlign: 'start' },
        onclick: () => editSection(r, draw) }, [LABEL[r.section_key]]),
      spanPicker(r[k.span] ?? 12, (v) => {
        r[k.span] = v;
        save('layout', r.id, { [k.span]: v }).catch((e) => toast(e.message, 'error'));
        reloadPreview();
      }),
      toggle(r[k.vis] !== false, (v) => {
        r[k.vis] = v;
        save('layout', r.id, { [k.vis]: v }).catch((e) => toast(e.message, 'error'));
        draw();
        reloadPreview();
      }),
    ])));

    makeSortable(list, (ids) => {
      ids.forEach((id, i) => save('layout', id, { [k.sort]: i + 1 })
        .catch((e) => toast(e.message, 'error')));
      setAll('layout', get('layout').map((l) =>
        ids.includes(l.id) ? { ...l, [k.sort]: ids.indexOf(l.id) + 1 } : l));
      draw();
      reloadPreview();
      toast('حُفظ الترتيب', 'success');
    });

    const dt = tabs([['d', 'سطح المكتب'], ['m', 'الجوال']], dev, (v) => { dev = v; draw(); });

    wrap.replaceChildren(el('div', { class: 'view' }, [
      el('div', { class: 'view__head' }, [
        el('div', {}, [
          el('h1', { class: 'view__title' }, ['تخطيط الصفحة']),
          el('p', { class: 'view__sub' }, [
            'اسحب لتغيير الترتيب، واختر عرض كل قسم. قسمان بنصف عرض يقفان جنب بعض.',
          ]),
        ]),
      ]),
      dt.node,
      el('p', { class: 'view__sub', style: { marginBlock: 'var(--a-3)' } }, [
        dev === 'm'
          ? 'ترتيب الجوال وعرضه مستقلّان تماماً عن سطح المكتب — فما تضبطه هنا لا يمسّ الشاشة الكبيرة.'
          : 'هذه قيم سطح المكتب. للجوال تبويب منفصل، فعرضٌ يناسب شاشة عريضة لا يصير شريطاً على الصغيرة.',
      ]),
      list,
    ]));
  };

  draw();
  host.replaceChildren(wrap);
}
