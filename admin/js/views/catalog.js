// catalog.js — الجداول البسيطة في مكان واحد: خيارات الطلب، بنوده، الخدمات،
// خطوات العمل، طرق الدفع، الآراء. كلها نفس النمط: قائمة قابلة للسحب
// + محرّر جانبي. إضافة جدول = مُدخَل في TABLES أدناه، لا شاشة جديدة.
//
// ⚠️ منصّات التواصل وأوجه الاستخدام كانت مصفوفتين مكتوبتين يدوياً
//    داخل order-wizard.js، فما كان المشرف يقدر على إزالة «سناب شات»
//    مثلاً. صارتا جدولين هنا كبقيّة القوائم.
import { el } from '../core/dom.js';
import { get, setAll } from '../core/store.js';
import { insert, remove } from '../core/api.js';
import { save } from '../core/autosave.js';
import { toast } from '../core/toast.js';
import { icon, iconNames } from '../ui/icon.js';
import { makeSortable } from '../ui/sortable.js';
import { openDrawer, closeDrawer } from '../ui/drawer.js';
import { confirmDelete } from '../ui/modal.js';
import { fld, text, textarea, toggle, select, tabs, emptyState } from '../ui/fields.js';
import { imageField } from '../ui/media.js';

/** تعريف كل جدول: الحقول والافتراضيات. مصدر واحد للعرض والتحرير. */
const TABLES = {
  order_platforms: {
    label: 'منصّات التواصل', hint: 'ما يختار منه الزبون في «المنصة المفضّلة» — أزِل ما لا تريده',
    title: 'name',
    fields: [['name', 'الاسم', 'text']],
    blank: () => ({ name: 'منصّة جديدة', published: true }),
  },
  order_usages: {
    label: 'أوجه الاستخدام', hint: 'ما يختار منه الزبون في «نوع الاستخدام»',
    title: 'name',
    fields: [['name', 'الاسم', 'text']],
    blank: () => ({ name: 'استخدام جديد', published: true }),
  },
  order_items: {
    label: 'بنود الطلب', hint: 'ما يظهر للزبون في الخطوة الأولى من الطلب',
    title: 'name',
    fields: [
      ['name', 'الاسم', 'text'],
      ['description', 'الوصف', 'area'],
      ['icon', 'الأيقونة', 'icon'],
    ],
    blank: () => ({ name: 'بند جديد', description: '', icon: 'sparkle', published: false }),
  },
  services: {
    label: 'الخدمات', hint: 'بلاطات قسم الخدمات',
    title: 'name',
    fields: [
      ['name', 'الاسم', 'text'],
      ['description', 'الوصف', 'area'],
      ['price', 'ملاحظة جانبية', 'text', 'نص حر — مدة التسليم مثلاً'],
      ['icon', 'الأيقونة', 'icon'],
    ],
    blank: () => ({ name: 'خدمة جديدة', description: '', price: '', icon: 'sparkle', published: false }),
  },
  process_steps: {
    label: 'خطوات العمل', hint: 'الخط الزمني في قسم «كيف نشتغل»',
    title: 'name',
    fields: [['name', 'العنوان', 'text'], ['description', 'الشرح', 'area']],
    blank: () => ({ name: 'خطوة جديدة', description: '', published: false }),
  },
  payment_methods: {
    label: 'طرق الدفع', hint: 'عرض فقط — لا يتم أي دفع داخل الموقع',
    title: 'name',
    fields: [['name', 'الاسم', 'text'], ['logo_url', 'الشعار', 'image']],
    blank: () => ({ name: 'طريقة دفع', logo_url: '', published: false }),
  },
  testimonials: {
    label: 'الآراء', hint: 'لا تُعرض إلا الآراء المنشورة',
    title: 'name',
    fields: [
      ['name', 'اسم العميل', 'text'],
      ['role', 'الصفة', 'text'],
      ['text', 'الرأي', 'area'],
      ['rating', 'التقييم', 'rating'],
    ],
    blank: () => ({ name: '', role: '', text: '', rating: 5, published: false }),
  },
};

const KEYS = Object.keys(TABLES);
const sorted = (r) => r.slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

function iconPicker(value, onChange) {
  const names = iconNames();
  const grid = el('div', { class: 'icon-picker' }, names.map((n) =>
    el('button', {
      class: `icon-opt ${n === value ? 'is-on' : ''}`, type: 'button', title: n,
      'aria-label': n,
      onclick: () => {
        value = n;
        onChange(n);
        [...grid.children].forEach((b) => b.classList.toggle('is-on', b.title === n));
      },
    }, [icon(n, { size: 17 })])));
  return grid;
}

function ratingPicker(value, onChange) {
  const stars = [1, 2, 3, 4, 5].map((n) =>
    el('button', { class: 'star-opt', type: 'button', 'aria-label': `${n} من 5`,
      onclick: () => { value = n; onChange(n); paint(); } },
      [icon('star', { size: 20, filled: n <= value })]));
  const box = el('div', { class: 'row', style: { gap: '2px' } }, stars);
  function paint() {
    stars.forEach((b, i) => b.replaceChildren(icon('star', { size: 20, filled: i < value })));
    box.dataset.value = String(value);
  }
  paint();
  return box;
}

function editRow(table, row, done) {
  const def = TABLES[table];
  const patch = (k, v) => { row[k] = v; save(table, row.id, { [k]: v }).catch((e) => toast(`تعذّر الحفظ: ${e.message}`, 'error')); };

  const body = el('div', { class: 'stack stack--lg' }, [
    ...def.fields.map(([key, label, type, hint]) => {
      let node;
      if (type === 'area') node = textarea(row[key], (v) => patch(key, v), { rows: 3, label });
      else if (type === 'icon') node = iconPicker(row[key], (v) => patch(key, v));
      else if (type === 'image') node = imageField(row[key], table, (v) => patch(key, v), label);
      else if (type === 'rating') node = ratingPicker(Number(row[key]) || 5, (v) => patch(key, v));
      else node = text(row[key], (v) => patch(key, v), { label });
      return fld(label, node, hint);
    }),
    toggle(row.published !== false, (v) => patch('published', v), 'منشور'),
  ]);

  openDrawer({
    title: row[def.title] || def.label, sub: 'الحفظ تلقائي', body,
    foot: el('div', { class: 'row grow' }, [
      el('button', { class: 'btn grow', type: 'button', onclick: () => closeDrawer() }, ['تم']),
      el('button', { class: 'btn btn--danger', type: 'button', onclick: async () => {
        if (!await confirmDelete(row[def.title] || 'هذا العنصر')) return;
        await remove(table, row.id);
        setAll(table, get(table).filter((x) => x.id !== row.id));
        closeDrawer();
        toast('حُذف', 'success');
        done();
      } }, [icon('trash', { size: 15 })]),
    ]),
    onClose: done,
  });
}

export function render(host, { query } = {}) {
  let active = KEYS.includes(query?.t) ? query.t : KEYS[0];
  const body = el('div');

  const t = tabs(KEYS.map((k) => [k, TABLES[k].label]), active, (k) => {
    active = k;
    history.replaceState(null, '', `#/catalog?t=${k}`);
    draw();
  });

  function draw() {
    const def = TABLES[active];
    const rows = sorted(get(active));
    const list = el('div', { class: 'sortable' });

    list.replaceChildren(...rows.map((r) => el('div', { class: 'sort-row', 'data-id': r.id }, [
      el('span', { class: 'grip', 'aria-hidden': 'true' }, [icon('drag', { size: 15 })]),
      r.icon ? el('span', { style: { color: 'var(--a-accent)' } }, [icon(r.icon, { size: 17 })]) : null,
      r.logo_url ? el('img', { class: 'thumb-sm', src: r.logo_url, alt: '' }) : null,
      el('button', { class: 'link grow', type: 'button', style: { textAlign: 'start' },
        onclick: () => editRow(active, r, draw) },
        [r[def.title] || 'بلا اسم']),
      toggle(r.published !== false, (v) => { r.published = v; save(active, r.id, { published: v }); }),
    ])));

    makeSortable(list, (ids) => {
      ids.forEach((id, i) => save(active, id, { sort: i + 1 }));
      setAll(active, get(active).map((r) => ({ ...r, sort: ids.indexOf(r.id) + 1 })));
      toast('حُفظ الترتيب', 'success');
    });

    body.replaceChildren(
      el('div', { class: 'row row--wrap' }, [
        el('p', { class: 'view__sub grow' }, [def.hint]),
        el('button', { class: 'btn btn--primary', type: 'button', onclick: async () => {
          const created = await insert(active, { ...def.blank(), sort: get(active).length + 1 });
          setAll(active, [...get(active), created]);
          draw();
          editRow(active, created, draw);
        } }, [icon('plus', { size: 16 }), 'إضافة']),
      ]),
      rows.length ? list : emptyState(`لا توجد ${def.label} بعد`, def.hint),
    );
  }

  draw();
  host.replaceChildren(el('div', { class: 'view' }, [
    el('div', { class: 'view__head' }, [
      el('div', {}, [
        el('h1', { class: 'view__title' }, ['الكتالوج']),
        el('p', { class: 'view__sub' }, ['القوائم التي تغذّي أقسام الموقع ونموذج الطلب']),
      ]),
    ]),
    t.node,
    body,
  ]));
}
