// layout-row.js — صف قسم واحد داخل لوح التخطيط: أعمدة، محاذاة، فجوة، خلفية،
// إظهار، وكتل مخصّصة. كل تغيير يُحفظ فوراً عبر `setLayout` داخل `autosave`.
import { el } from '../core/dom.js';
import { choice, slider, toggle, colorField } from '../components/control.js';
import { mediaField } from '../components/media-field.js';
import { colsFor, setLayout } from '../core/layout.js';
import { saveNow as autosave } from '../core/autosave.js';
import { blockList } from './block-list.js';

const NAMES = {
  nav: 'الشريط العلوي', hero: 'الهيرو', about: 'البطاقة التعريفية', works: 'الأعمال',
  packages: 'البكجات', services: 'الخدمات', process: 'مراحل العمل',
  testimonials: 'الآراء', payments: 'طرق الدفع', order: 'الطلب', footer: 'الفوتر',
};

const COLS = [[1, '1'], [2, '2'], [3, '3'], [4, '4']];
const ALIGNS = [['start', 'بداية'], ['center', 'وسط'], ['end', 'نهاية']];
const BG = [['none', 'بلا'], ['color', 'لون'], ['gradient', 'تدرّج'], ['image', 'صورة'], ['video', 'فيديو']];
const GRADIENTS = [
  ['linear-gradient(180deg, var(--c-bg), var(--c-surface))', 'هبوط'],
  ['linear-gradient(180deg, var(--c-surface), var(--c-bg))', 'صعود'],
  ['radial-gradient(circle at 50% 0, var(--c-accent-soft), var(--c-bg))', 'وهج'],
];

const label = (key) => NAMES[key] || 'قسم مخصّص';
const stepOf = (v) => Number(String(v ?? '').match(/--s-(\d)/)?.[1]) || 4;

/** يشرح للمشرف ما ستصير إليه الأعمدة على الشاشات الأصغر — فلا مفاجأة. */
function shrinkHint(n) {
  return el('p', { class: 'lt__hint' },
    [`على اللوحي: ${colsFor(n, 'tablet')} · على الجوال: ${colsFor(n, 'mobile')}`]);
}

/** حقل الخلفية المطابق للنوع المختار. */
function bgField(row, save) {
  if (row.bg_type === 'color') {
    return colorField('اللون', row.bg_value, (v) => save({ bg_value: v }));
  }
  if (row.bg_type === 'gradient') {
    return choice('التدرّج', GRADIENTS, row.bg_value, (v) => save({ bg_value: v }));
  }
  if (row.bg_type === 'image' || row.bg_type === 'video') {
    return mediaField({ type: row.bg_type, url: row.bg_value || '', poster: '', caption: '' },
      (v) => save({ bg_value: v?.url || '' }));
  }
  return null;
}

/**
 * يبني صف قسم.
 * @param {object} row صف `layout`
 * @param {Function} onDirty يُستدعى بعد أي حفظ ناجح (لإعادة رسم اللوح)
 */
export function sectionRow(row, onDirty) {
  const key = row.section_key;
  const save = (patch) => autosave(async () => {
    Object.assign(row, patch);
    await setLayout(key, patch);
    onDirty?.(key, patch);
  });

  const hint = shrinkHint(row.columns);
  const bgSlot = el('div', { class: 'lt__bg-slot' }, [bgField(row, save)]);
  const body = el('div', { class: 'lt-row__body', hidden: true }, [
    choice('▦ الأعمدة', COLS, Number(row.columns) || 1, (v) => {
      hint.replaceChildren(...shrinkHint(v).childNodes);
      save({ columns: v });
    }),
    hint,
    choice('⬍ المحاذاة', ALIGNS, row.align || 'stretch', (v) => save({ align: v })),
    slider('⬍ الفجوة', { min: 1, max: 8, step: 1, value: stepOf(row.gap),
      onChange: (_, n) => save({ gap: `var(--s-${n})` }) }),
    choice('🖼 الخلفية', BG, row.bg_type || 'none', (v) => {
      save({ bg_type: v, bg_value: '' });
      row.bg_value = '';
      bgSlot.replaceChildren(...[bgField(row, save)].filter(Boolean));
    }),
    bgSlot,
    blockList(key),
  ]);

  const more = el('button', { class: 'lt__icon', type: 'button', 'aria-expanded': 'false',
    title: 'خيارات القسم', onclick: (e) => {
      body.hidden = !body.hidden;
      e.currentTarget.setAttribute('aria-expanded', String(!body.hidden));
    } }, ['⋯']);

  return el('li', { class: 'lt-row', 'data-key': key, draggable: 'true' }, [
    el('div', { class: 'lt-row__head' }, [
      el('span', { class: 'lt__grip', title: 'اسحب لإعادة الترتيب', 'aria-hidden': 'true' }, ['⠿']),
      el('span', { class: 'lt-row__name' }, [label(key)]),
      toggle('👁', row.visible !== false, (v) => save({ visible: v })),
      more,
    ]),
    body,
  ]);
}
