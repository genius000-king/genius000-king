// ============================================================
// preview.js — معاينة الموقع داخل iframe معزول.
//
// لماذا iframe: اللوحة القديمة كانت تشغّل ملفات الموقع في صفحتها،
// فتصادمت الأنماط والمؤثرات، وصار @media يقيس نافذة المشرف لا الجهاز.
// داخل iframe تكون القياسات حقيقية: 390px تعطي ما يراه الزبون بالضبط.
// ============================================================
import { el, on } from '../core/dom.js';
import { icon } from '../ui/icon.js';

const SRC = '../?preview=1';
const DEVICES = [
  ['mobile',  'جوال',      390],
  ['tablet',  'لوحي',      834],
  ['desktop', 'سطح مكتب',  0],
];

const frames = new Set();

/**
 * يبثّ صفوف الثيم إلى كل إطارات المعاينة المفتوحة.
 *
 * الصفوف الخام لا المتغيّرات المحسوبة: الموقع يمرّرها على applyTheme
 * نفسها، فيمرّ الوارد بنفس فحص المفاتيح والقيم الذي يمرّ به القادم من
 * القاعدة — مسارٌ واحد نصونه لا اثنان. والهدف نفس الأصل لا '*'.
 */
export function pushTheme(rows) {
  const list = Array.isArray(rows) ? rows : [];
  for (const f of frames) {
    try { f.contentWindow?.postMessage({ type: 'theme', rows: list }, location.origin); }
    catch { /* إطارٌ لم يُحمَّل بعد */ }
  }
}

/** يطلب من المعاينة إعادة التحميل. */
export function reloadPreview() {
  for (const f of frames) { try { f.contentWindow.location.reload(); } catch { f.src = f.src; } }
}

/** إطار معاينة قابل لإعادة الاستخدام. */
export function previewFrame({ compact = false } = {}) {
  const frame = el('iframe', {
    class: 'preview__frame', src: SRC, title: 'معاينة الموقع',
    loading: 'lazy', referrerpolicy: 'no-referrer',
  });
  frames.add(frame);
  on(frame, 'load', () => { frame.dataset.ready = '1'; });

  const stage = el('div', { class: 'preview__stage', 'data-device': compact ? 'desktop' : 'desktop' }, [frame]);

  const btns = DEVICES.map(([key, label, w]) =>
    el('button', { class: 'tabs__btn', type: 'button', role: 'tab',
      'aria-selected': String(key === 'desktop'), 'data-d': key,
      onclick: () => pick(key, w) }, [label]));

  function pick(key, w) {
    btns.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.d === key)));
    stage.dataset.device = key;
    stage.style.setProperty('--pw', w ? `${w}px` : '100%');
  }

  return el('div', { class: `preview ${compact ? 'preview--compact' : ''}` }, [
    el('div', { class: 'preview__bar' }, [
      el('div', { class: 'tabs', role: 'tablist' }, btns),
      el('span', { class: 'spacer' }),
      el('button', { class: 'btn btn--icon btn--sm btn--ghost', type: 'button',
        title: 'تحديث المعاينة', 'aria-label': 'تحديث المعاينة',
        onclick: () => reloadPreview() }, [icon('refresh', { size: 15 })]),
      el('a', { class: 'btn btn--icon btn--sm btn--ghost', href: '../', target: '_blank',
        rel: 'noopener', title: 'فتح في تبويب', 'aria-label': 'فتح في تبويب جديد' },
        [icon('external', { size: 15 })]),
    ]),
    stage,
  ]);
}

export function render(host) {
  host.replaceChildren(el('div', { class: 'view view--full' }, [
    el('div', { class: 'view__head' }, [
      el('div', {}, [
        el('h1', { class: 'view__title' }, ['معاينة الموقع']),
        el('p', { class: 'view__sub' }, ['قياسات حقيقية — ما تراه هنا هو ما يراه الزبون']),
      ]),
    ]),
    previewFrame(),
  ]));
}
