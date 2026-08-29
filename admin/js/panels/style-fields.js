// style-fields.js — تعريف صفوف لوح التنسيق. لا شيء هنا غير بناء عناصر التحكم.
// ❌ لا حقول رقمية نصية: منزلقات ومنتقيات ألوان وقوائم اختيار فقط.
import { el } from '../core/dom.js';
import { slider, colorField, choice, revertButton } from '../components/control.js';

// ظلال جاهزة — كلها توكنات من tokens.css، فلا قيمة خام في القاعدة.
const SHADOWS = [
  ['none', 'بلا'],
  ['var(--sh-sm)', 'خفيف'],
  ['var(--sh-md)', 'متوسط'],
  ['var(--sh-lg)', 'عميق'],
  ['var(--sh-glow)', 'وهج'],
];

/** يقرأ رقماً من قيمة CSS مخزّنة («18px» → 18)، أو الافتراضي. */
function num(value, fallback) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function hex(value, fallback) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : fallback;
}

/** صف واحد: عنصر تحكم + زر إرجاع يظهر فقط حين يوجد تجاوز لهذه الخاصية. */
function row(prop, ctx, build) {
  const rev = revertButton(() => { rev.hidden = true; ctx.revert(prop); });
  rev.hidden = ctx.get(prop) === undefined;
  const set = (value) => { rev.hidden = false; ctx.set(prop, value); };
  return el('div', { class: 'style-row' }, [build(set), rev]);
}

function group(title, rows) {
  return el('section', { class: 'side__group' }, [
    el('h3', { class: 'side__group-title' }, [title]),
    ...rows,
  ]);
}

/**
 * يبني كل مجموعات اللوح.
 * @param {{get:Function, set:Function, revert:Function}} ctx جسر مع مخزن التجاوزات
 */
export function buildGroups(ctx) {
  const g = (prop) => ctx.get(prop);
  return [
    group('اللون', [
      row('color', ctx, (set) => colorField('لون النص', hex(g('color'), '#F2F6FF'), set)),
      row('background', ctx, (set) => colorField('لون الخلفية', hex(g('background'), '#0A1220'), set)),
    ]),
    group('النص', [
      row('font-size', ctx, (set) => slider('حجم الخط',
        { min: 10, max: 80, step: 1, value: num(g('font-size'), 16), unit: 'px', onChange: set })),
      row('font-weight', ctx, (set) => slider('سماكة الخط',
        { min: 100, max: 900, step: 100, value: num(g('font-weight'), 400), onChange: set })),
    ]),
    group('الشكل', [
      row('border-radius', ctx, (set) => slider('استدارة الحواف',
        { min: 0, max: 60, step: 1, value: num(g('border-radius'), 0), unit: 'px', onChange: set })),
      row('opacity', ctx, (set) => slider('الشفافية',
        { min: 0, max: 1, step: 0.05, value: num(g('opacity'), 1), onChange: set })),
      row('box-shadow', ctx, (set) => choice('الظل', SHADOWS, g('box-shadow'), set)),
    ]),
    group('المسافات', [
      row('padding', ctx, (set) => slider('الحشو الداخلي',
        { min: 0, max: 80, step: 2, value: num(g('padding'), 0), unit: 'px', onChange: set })),
      row('margin', ctx, (set) => slider('الهامش الخارجي',
        { min: 0, max: 80, step: 2, value: num(g('margin'), 0), unit: 'px', onChange: set })),
    ]),
  ];
}
