// fields.js — مصنع الحقول. كل حقل يحفظ نفسه ويبثّ حالة الحفظ.
import { el, debounce } from '../core/dom.js';
import { icon } from './icon.js';

/** غلاف موحّد: تسمية + حقل + تلميح. */
export function fld(label, node, hint) {
  return el('label', { class: 'fld' }, [
    label ? el('span', { class: 'fld__label' }, [label]) : null,
    node,
    hint ? el('span', { class: 'fld__hint' }, [hint]) : null,
  ]);
}

export function text(value, onChange, o = {}) {
  const n = el('input', {
    type: o.type || 'text', class: `field ${o.mono ? 'mono' : ''}`,
    value: value ?? '', placeholder: o.placeholder || '',
    autocomplete: o.autocomplete || 'off', inputmode: o.inputmode || null,
    'aria-label': o.label || null,
    oninput: debounce((e) => onChange(e.target.value), o.debounce ?? 500),
  });
  return n;
}

export function textarea(value, onChange, o = {}) {
  return el('textarea', {
    class: `field ${o.mono ? 'mono' : ''}`, rows: String(o.rows || 4),
    placeholder: o.placeholder || '', 'aria-label': o.label || null,
    oninput: debounce((e) => onChange(e.target.value), o.debounce ?? 600),
  }, [value ?? '']);
}

export function select(value, options, onChange, o = {}) {
  return el('select', { class: 'field', 'aria-label': o.label || null,
    onchange: (e) => onChange(e.target.value) },
    options.map(([v, t]) => el('option', { value: v, selected: String(v) === String(value) }, [t])));
}

export function toggle(checked, onChange, label) {
  return el('label', { class: 'switch' }, [
    el('input', { type: 'checkbox', checked: !!checked,
      onchange: (e) => onChange(e.target.checked) }),
    el('span', { class: 'switch__track' }),
    label ? el('span', { class: 'switch__label' }, [label]) : null,
  ]);
}

export function slider(value, onChange, o = {}) {
  const out = el('span', { class: 'slider__val mono' }, [`${value}${o.unit || ''}`]);
  return el('div', { class: 'slider' }, [
    el('div', { class: 'slider__top' }, [
      el('span', {}, [o.label || '']), out,
    ]),
    el('input', {
      type: 'range', min: String(o.min ?? 0), max: String(o.max ?? 100),
      step: String(o.step ?? 1), value: String(value),
      'aria-label': o.label || null,
      oninput: (e) => { out.textContent = `${e.target.value}${o.unit || ''}`; },
      onchange: (e) => onChange(e.target.value),
    }),
  ]);
}

export function color(value, onChange, o = {}) {
  const hex = /^#[0-9a-f]{6}$/i.test(value || '') ? value : (o.fallback || '#3B6EF6');
  const picker = el('input', { type: 'color', value: hex, 'aria-label': o.label || 'اللون',
    oninput: (e) => { field.value = e.target.value; onChange(e.target.value); } });
  const field = el('input', { type: 'text', class: 'field mono', value: value ?? '',
    placeholder: '#3B6EF6', 'aria-label': `${o.label || 'اللون'} بصيغة hex`,
    oninput: debounce((e) => {
      const v = e.target.value.trim();
      if (/^#[0-9a-f]{3,8}$/i.test(v)) { picker.value = v.length === 7 ? v : picker.value; onChange(v); }
    }, 400) });
  return el('div', { class: 'color-row' }, [picker, field]);
}

/** تبويبات — تعيد { node, select(key) }. */
export function tabs(items, active, onSelect) {
  const btns = items.map(([key, label]) =>
    el('button', { class: 'tabs__btn', type: 'button', role: 'tab',
      'aria-selected': String(key === active), 'data-key': key,
      onclick: () => { pick(key); onSelect(key); } }, [label]));
  const node = el('div', { class: 'tabs', role: 'tablist' }, btns);
  function pick(key) { btns.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.key === key))); }
  return { node, select: pick };
}

export function emptyState(title, hint, action) {
  return el('div', { class: 'empty' }, [
    el('span', { class: 'empty__icon' }, [icon('image', { size: 30 })]),
    el('p', { class: 'empty__title' }, [title]),
    hint ? el('p', {}, [hint]) : null,
    action || null,
  ]);
}

export function badge(kind, label) {
  return el('span', { class: `badge badge--${kind}` }, [label]);
}
