// content.js — كل نصوص الموقع، مجمّعة حسب القسم. تحرير مباشر وحفظ تلقائي.
import { el } from '../core/dom.js';
import { get, setAll, content as val } from '../core/store.js';
import { saveContent } from '../core/autosave.js';
import { tabs, fld, text, textarea } from '../ui/fields.js';
import { icon } from '../ui/icon.js';
import { go } from '../core/router.js';

/** خريطة النصوص: [مفتاح، تسمية، نوع، تلميح] */
export const GROUPS = [
  ['brand', 'العلامة', [
    ['brand', 'اسم الاستوديو', 'text'],
    ['status_badge', 'شارة الحالة', 'text', 'تظهر أعلى الهيرو — مثل «متاح لمشاريع جديدة»'],
  ]],
  ['hero', 'الصفحة الرئيسية', [
    ['hero_title_1', 'العنوان — الجزء الأول', 'text'],
    ['hero_title_hl', 'العنوان — الكلمة الملوّنة', 'text', 'تُعرض بلون الهوية'],
    ['hero_title_2', 'العنوان — الجزء الأخير', 'text'],
    ['hero_subtitle', 'الوصف', 'area'],
    ['hero_cta', 'زر الطلب', 'text'],
    ['hero_cta_alt', 'الزر الثانوي', 'text'],
  ]],
  ['about', 'من أنا', [
    ['about_label', 'التسمية الصغيرة', 'text'],
    ['about_title', 'العنوان', 'text'],
    ['about_text', 'النص', 'area'],
    ['stat_1_value', 'الرقم الأول', 'text', 'أرقام فقط — يُعدّ تصاعدياً'],
    ['stat_1_label', 'وصف الرقم الأول', 'text'],
    ['stat_2_value', 'الرقم الثاني', 'text'],
    ['stat_2_label', 'وصف الرقم الثاني', 'text'],
    ['stat_3_value', 'الرقم الثالث', 'text'],
    ['stat_3_label', 'وصف الرقم الثالث', 'text'],
  ]],
  ['sections', 'عناوين الأقسام', [
    ['works_title', 'الأعمال — العنوان', 'text'],
    ['works_sub', 'الأعمال — الوصف', 'text'],
    ['packages_title', 'البكجات — العنوان', 'text'],
    ['packages_sub', 'البكجات — الوصف', 'text'],
    ['services_title', 'الخدمات — العنوان', 'text'],
    ['services_sub', 'الخدمات — الوصف', 'text'],
    ['process_title', 'كيف نشتغل — العنوان', 'text'],
    ['process_sub', 'كيف نشتغل — الوصف', 'text'],
    ['testimonials_title', 'الآراء — العنوان', 'text'],
    ['testimonials_sub', 'الآراء — الوصف', 'text'],
    ['payments_title', 'الدفع — العنوان', 'text'],
    ['payments_sub', 'الدفع — الوصف', 'text'],
    ['payments_note', 'الدفع — ملاحظة أسفل البلاطات', 'text'],
  ]],
  ['order', 'قسم الطلب', [
    ['order_title', 'العنوان', 'text'],
    ['order_sub', 'الوصف', 'text'],
    ['order_cta', 'نص الزر', 'text'],
    ['package_cta', 'زر الطلب داخل لوحة البكج', 'text'],
    ['order_prefix', 'بادئة رقم الطلب', 'text', 'ثلاثة أحرف لاتينية — مثل APX'],
  ]],
  ['footer', 'الفوتر', [
    ['footer_text', 'نص الفوتر', 'area'],
    ['footer_legal', 'سطر الحقوق', 'text'],
  ]],
];

export const ALL_KEYS = GROUPS.flatMap(([, , fields]) => fields.map(([k]) => k));

function saveKey(key, value) {
  const rows = get('site_content').filter((r) => r.key !== key).concat([{ key, value }]);
  setAll('site_content', rows);
  saveContent(key, value).catch(() => {});
}

function fieldFor([key, label, type, hint]) {
  const v = val(key);
  const node = type === 'area'
    ? textarea(v, (x) => saveKey(key, x), { rows: 3, label })
    : text(v, (x) => saveKey(key, x), { label });
  return fld(label, node, hint);
}

export function render(host, { query } = {}) {
  let active = query?.g || GROUPS[0][0];
  const body = el('div');

  const t = tabs(GROUPS.map(([k, label]) => [k, label]), active, (k) => {
    active = k;
    history.replaceState(null, '', `#/content?g=${k}`);
    draw();
  });

  function draw() {
    const grp = GROUPS.find(([k]) => k === active) || GROUPS[0];
    body.replaceChildren(
      el('div', { class: 'card' }, [
        el('div', { class: 'card__head' }, [
          el('span', { class: 'card__title grow' }, [grp[1]]),
          el('span', { class: 'card__hint' }, [`${grp[2].length} حقلاً · يُحفظ تلقائياً`]),
        ]),
        el('div', { class: 'fld-grid' }, grp[2].map(fieldFor)),
      ]),
    );
  }

  draw();
  host.replaceChildren(el('div', { class: 'view' }, [
    el('div', { class: 'view__head' }, [
      el('div', {}, [
        el('h1', { class: 'view__title' }, ['نصوص الموقع']),
        el('p', { class: 'view__sub' }, ['كل كلمة في الموقع تُحرَّر من هنا — الحفظ تلقائي']),
      ]),
      el('div', { class: 'view__actions' }, [
        el('button', { class: 'btn', type: 'button', onclick: () => go('/preview') },
          [icon('eye', { size: 15 }), 'معاينة']),
      ]),
    ]),
    t.node,
    body,
  ]));
}
