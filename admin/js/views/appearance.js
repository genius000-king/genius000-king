// appearance.js — الألوان والخط والمسافات والحركة، بمعاينة حيّة داخل iframe.
import { el } from '../core/dom.js';
import { get, setAll } from '../core/store.js';
import { THEME_KEYS, setThemeKey, resetThemeKey, varsFor } from '../core/theme.js';
import { fld, color, slider, tabs, toggle } from '../ui/fields.js';
import { icon } from '../ui/icon.js';
import { toast } from '../core/toast.js';
import { confirmModal } from '../ui/modal.js';
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
    pushTheme(varsFor(get('theme')));
  } catch (e) { toast(e.message, 'error'); }
}

export function render(host, { query } = {}) {
  const GROUPS = [['colors', 'الألوان'], ['type', 'الخط والمسافات'],
                  ['glass', 'الزجاج'], ['shape', 'الأشكال']];
  let active = GROUPS.some(([k]) => k === query?.g) ? query.g : 'colors';
  const body = el('div');

  const t = tabs(GROUPS, active, (k) => {
    active = k;
    history.replaceState(null, '', `#/appearance?g=${k}`);
    draw();
  });

  const sliderRow = ([key, label, min, max, step, unit]) => {
    const raw = String(valueOf(key, '')).replace(/[a-z%]+$/i, '');
    const cur = Number(raw) || (min + max) / 2;
    return el('div', { class: 'card', style: { padding: 'var(--a-4)' } }, [
      slider(cur, (v) => set(key, unit ? `${v}${unit}` : String(v)), { label, min, max, step, unit }),
      el('button', { class: 'btn btn--sm btn--ghost', type: 'button',
        onclick: async () => { await resetThemeKey(key); pushTheme(varsFor(get('theme'))); draw(); } },
        [icon('undo', { size: 13 }), 'الافتراضي']),
    ]);
  };

  function draw() {
    if (active === 'colors') {
      body.replaceChildren(el('div', { class: 'fld-grid' }, COLORS.map(([key, label, dflt]) =>
        el('div', { class: 'card', style: { padding: 'var(--a-4)' } }, [
          fld(label, color(valueOf(key, dflt), (v) => set(key, v), { label, fallback: dflt })),
          el('button', { class: 'btn btn--sm btn--ghost', type: 'button',
            onclick: async () => { await resetThemeKey(key); draw(); pushTheme(varsFor(get('theme'))); } },
            [icon('undo', { size: 13 }), 'الافتراضي']),
        ]))));
    } else if (active === 'type') {
      body.replaceChildren(el('div', { class: 'fld-grid' }, SCALES.map(sliderRow)));
    } else if (active === 'glass') {
      body.replaceChildren(el('div', { class: 'fld-grid' }, GLASS.map(sliderRow)));
    } else {
      body.replaceChildren(el('div', { class: 'fld-grid' }, SHAPE.map(sliderRow)));
    }
  }

  draw();

  host.replaceChildren(el('div', { class: 'view' }, [
    el('div', { class: 'view__head' }, [
      el('div', {}, [
        el('h1', { class: 'view__title' }, ['المظهر']),
        el('p', { class: 'view__sub' }, ['كل تغيير يظهر في المعاينة فوراً ويُحفظ تلقائياً']),
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
