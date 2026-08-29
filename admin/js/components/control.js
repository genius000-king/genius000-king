// control.js — عناصر التحكم المشتركة بين لوح الثيم ولوح التنسيق ولوح التخطيط.
// ❌ لا حقول رقمية نصية إطلاقاً: منزلق للأرقام، ومنتقي للألوان (قرار المواصفات).
import { el } from '../core/dom.js';

/** منزلق بقيمة ظاهرة. onChange يستقبل القيمة مع الوحدة. */
export function slider(label, { min = 0, max = 100, step = 1, value = 0, unit = '', onChange }) {
  const out = el('output', { class: 'ctrl__value' }, [`${value}${unit}`]);
  const input = el('input', {
    type: 'range', class: 'ctrl__range', min, max, step, value,
    'aria-label': label,
    oninput: (e) => { out.textContent = `${e.target.value}${unit}`; onChange?.(`${e.target.value}${unit}`, Number(e.target.value)); },
  });
  return el('label', { class: 'ctrl' }, [
    el('span', { class: 'ctrl__head' }, [el('span', {}, [label]), out]),
    input,
  ]);
}

/** منتقي لون + معاينة. */
export function colorField(label, value, onChange) {
  const input = el('input', {
    type: 'color', class: 'ctrl__color', value: normalize(value),
    'aria-label': label,
    oninput: (e) => onChange?.(e.target.value),
  });
  return el('label', { class: 'ctrl ctrl--row' }, [
    el('span', {}, [label]),
    input,
  ]);
}

/** قائمة اختيار من قيم معدّة (الظلال، أنواع الخلفية، المحاذاة). */
export function choice(label, options, value, onChange) {
  return el('label', { class: 'ctrl' }, [
    el('span', { class: 'ctrl__head' }, [el('span', {}, [label])]),
    el('div', { class: 'ctrl__choices' }, options.map(([val, text]) =>
      el('button', {
        class: 'ctrl__choice', type: 'button', 'aria-pressed': String(val === value),
        onclick: (e) => {
          [...e.currentTarget.parentElement.children]
            .forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
          onChange?.(val);
        },
      }, [text]))),
  ]);
}

/** مفتاح إظهار/إخفاء. */
export function toggle(label, checked, onChange) {
  return el('label', { class: 'ctrl ctrl--row' }, [
    el('span', {}, [label]),
    el('input', { type: 'checkbox', class: 'ctrl__toggle', checked: !!checked,
      'aria-label': label, onchange: (e) => onChange?.(e.target.checked) }),
  ]);
}

/** زر إرجاع صغير — يظهر فقط حين يوجد تجاوز. */
export function revertButton(onClick) {
  return el('button', { class: 'ctrl__revert', type: 'button',
    title: 'إرجاع للثيم', 'aria-label': 'إرجاع للثيم', onclick: onClick }, ['⟲']);
}

function normalize(v) {
  if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim())) return v.trim();
  return '#2563EB';
}
