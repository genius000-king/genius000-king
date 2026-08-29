// لوح الثيم — يعدّل التوكنات على مستوى الموقع كله.
// ⚠️ مميّز بصرياً عن لوح التنسيق عمداً: هذا يغيّر كل شيء، وذاك عنصراً واحداً.
import { el, qs, on } from '../core/dom.js';
import { slider, colorField } from '../components/control.js';
import { icon } from '../components/icon.js';
import { getToken, setToken, setAccent, resetTheme, clearStoredTheme } from '../core/theme.js';
import { confirmModal } from '../core/modal.js';
import { toast } from '../core/toast.js';

// [مفتاح، تسمية، أدنى، أقصى، خطوة، وحدة]
const SLIDERS = [
  ['fs-scale', 'مقياس الخط', 0.8, 1.4, 0.05, ''],
  ['s-scale', 'مقياس المسافات', 0.8, 1.4, 0.05, ''],
  ['r-md', 'نصف القطر', 0, 40, 1, 'px'],
  ['fx-intensity', 'شدة المؤثرات', 0, 1, 0.05, ''],
  ['fx-marquee-speed', 'سرعة الشرائط', 0, 80, 1, ''],
];

let side = null;

const num = (key, fallback) => {
  const v = parseFloat(getToken(key));
  return Number.isFinite(v) ? v : fallback;
};

function body() {
  return el('div', { class: 'side__body' }, [
    el('div', { class: 'side__group' }, [
      el('h3', { class: 'side__group-title' }, ['اللون المميز']),
      colorField('اللون', getToken('c-accent') || '#2563EB', (hex) => setAccent(hex)),
      el('p', { class: 'theme__hint' }, [
        'يُشتقّ منه تلقائياً لون النص المميز بتباين لا يقل عن 4.5:1 على الخلفية.',
      ]),
    ]),
    el('div', { class: 'side__group' }, SLIDERS.map(([key, label, min, max, step, unit]) => {
      const current = num(key, min);
      return slider(label, { min, max, step, value: current, unit,
        onChange: (value) => setToken(key, value) });
    })),
    el('div', { class: 'side__group' }, [
      el('button', { class: 'btn btn--danger btn--block', type: 'button', onclick: async () => {
        if (!await confirmModal({
          title: 'إرجاع الثيم بالكامل؟',
          body: 'ترجع كل الألوان والمقاييس لقيمها الأصلية. لا يمكن التراجع.',
          confirm: 'إرجاع',
        })) return;
        resetTheme();
        await clearStoredTheme();
        toast('رجع الثيم للأصل', 'success');
        refresh();
      } }, ['إرجاع الثيم للأصل']),
    ]),
  ]);
}

function refresh() {
  if (side) qs('.side__body', side).replaceWith(body());
}

export function openThemePanel() {
  if (!side) {
    side = el('div', { class: 'side side--theme', role: 'dialog', 'aria-label': 'ثيم الموقع' }, [
      el('div', { class: 'side__head' }, [
        el('div', {}, [
          el('span', { class: 'side__title' }, ['ثيم الموقع']),
          el('span', { class: 'side__sub' }, ['يؤثر على كل الصفحات والعناصر']),
        ]),
        el('button', { class: 'btn btn--icon side__close', type: 'button',
          'aria-label': 'إغلاق', onclick: closeThemePanel }, [icon('close')]),
      ]),
      body(),
    ]);
    document.body.append(side);
  } else refresh();
  requestAnimationFrame(() => side.classList.add('is-open'));
}

export function closeThemePanel() { side?.classList.remove('is-open'); }

on(document, 'leader:theme', openThemePanel);
