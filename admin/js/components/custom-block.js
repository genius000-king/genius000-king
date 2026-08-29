// custom-block.js — الكتل التي يضيفها المشرف داخل أي قسم (جدول `custom_blocks`).
// كل كتلة تحمل `data-edit-id="block.<id>"` فتقبل التحرير الموضعي والتجاوزات
// تماماً كأي عنصر مدمج. نوع غير معروف = لا شيء + تحذير، ولا يرمي أبداً.
import { el } from '../core/dom.js';
import { slider, choice } from './control.js';
import { mediaField } from './media-field.js';

const TYPES = [
  ['text', 'نص'], ['image', 'صورة'], ['video', 'فيديو'],
  ['button', 'زر'], ['divider', 'فاصل'], ['spacer', 'مسافة'],
];

const STEP = /^var\(--s-[1-8]\)$/;
const SAFE_HREF = /^(https?:|mailto:|tel:|#|\/)/i;

/** محتوى الكتلة ككائن — الصف قد يخزّنه نصاً JSON. */
export function contentOf(block) {
  const c = block?.content;
  if (c && typeof c === 'object') return c;
  try { return JSON.parse(c || '{}'); } catch { return {}; }
}

const editId = (block) => `block.${block?.id ?? ''}`;
const step = (v, fallback = 'var(--s-6)') => (STEP.test(String(v ?? '').trim()) ? String(v).trim() : fallback);
const href = (v) => (SAFE_HREF.test(String(v ?? '').trim()) ? String(v).trim() : '#');

/** صورة بأبعاد صريحة ‏— الأبعاد سمات HTML لحجز النسبة ومنع القفز، لا قيم تصميم. */
function image(c, cls) {
  return el('figure', { class: `cblock__figure ${cls}` }, [
    el('img', {
      class: 'cblock__img', src: c.url || '', alt: c.caption || '',
      loading: 'lazy', decoding: 'async',
      width: Number(c.width) || 1600, height: Number(c.height) || 900,
    }),
    c.caption ? el('figcaption', { class: 'cblock__cap' }, [c.caption]) : null,
  ]);
}

function video(c, cls) {
  return el('figure', { class: `cblock__figure ${cls}` }, [
    el('video', {
      class: 'cblock__video', src: c.url || '', poster: c.poster || '',
      muted: true, loop: true, playsinline: true, preload: 'metadata',
      width: Number(c.width) || 1600, height: Number(c.height) || 900,
    }),
    c.caption ? el('figcaption', { class: 'cblock__cap' }, [c.caption]) : null,
  ]);
}

/**
 * يرسم كتلة مخصّصة واحدة.
 * @returns {Node|null} عقدة، أو `null` لنوع غير معروف.
 */
export function renderCustomBlock(block) {
  const c = contentOf(block);
  const id = editId(block);
  const attrs = { class: 'cblock', 'data-edit-id': id, 'data-block-type': block?.type };
  switch (block?.type) {
    case 'text':
      return el('p', { ...attrs, class: 'cblock cblock--text' }, [c.text || '']);
    case 'image':
      return el('div', attrs, [image(c, 'cblock--image')]);
    case 'video':
      return el('div', attrs, [video(c, 'cblock--video')]);
    case 'button':
      return el('a', { ...attrs, class: 'cblock cblock--button btn btn--primary',
        href: href(c.href), 'data-fx': 'magnetic' }, [c.label || 'زر']);
    case 'divider':
      return el('hr', { ...attrs, class: 'cblock cblock--divider' });
    case 'spacer':
      return el('div', { ...attrs, class: 'cblock cblock--spacer', 'aria-hidden': 'true',
        style: { '--cblock-h': step(c.height) } });
    default:
      console.warn('[custom-block] نوع كتلة غير معروف:', block?.type);
      return null;
  }
}

/** حقل نصي بسيط (لا أرقام — الأرقام منزلقات فقط). */
function textField(label, value, onInput, multiline = false) {
  const input = el(multiline ? 'textarea' : 'input', {
    class: 'field',
    rows: multiline ? 3 : null, value: value || '', 'aria-label': label,
    oninput: (e) => onInput(e.target.value),
  });
  if (multiline) input.value = value || '';
  return el('label', { class: 'ctrl' }, [el('span', { class: 'ctrl__head' }, [label]), input]);
}

/** حقول النوع الواحد. `patch` يدمج في المحتوى ويبثّ التغيير. */
function fieldsFor(type, c, patch) {
  if (type === 'text') return [textField('النص', c.text, (v) => patch({ text: v }), true)];
  if (type === 'image' || type === 'video') {
    return [mediaField({ type, url: c.url || '', poster: c.poster || '', caption: c.caption || '' },
      (v) => patch({ url: v?.url || '', poster: v?.poster || '', caption: v?.caption || '' }))];
  }
  if (type === 'button') {
    return [
      textField('نص الزر', c.label, (v) => patch({ label: v })),
      textField('الرابط', c.href, (v) => patch({ href: v })),
    ];
  }
  if (type === 'spacer') {
    return [slider('الارتفاع', {
      min: 1, max: 8, step: 1, value: Number(String(c.height || '').match(/--s-(\d)/)?.[1]) || 6,
      onChange: (_, n) => patch({ height: `var(--s-${n})` }),
    })];
  }
  return [];   // فاصل: لا حقول
}

/**
 * محرّر كتلة. يعيد عقدة تحتوي منتقي النوع وحقوله.
 * @param {Function} onChange يستقبل الكتلة بعد التعديل `{...block, type, content}`
 */
export function blockEditor(block, onChange) {
  const state = { type: block?.type || 'text', content: contentOf(block) };
  const body = el('div', { class: 'cblock-edit__body' });

  const patch = (part) => {
    state.content = { ...state.content, ...part };
    onChange?.({ ...block, type: state.type, content: state.content });
  };

  const draw = () => body.replaceChildren(...fieldsFor(state.type, state.content, patch));
  draw();

  return el('div', { class: 'cblock-edit', 'data-block-edit': editId(block) }, [
    choice('النوع', TYPES, state.type, (v) => { state.type = v; draw(); patch({}); }),
    body,
  ]);
}
