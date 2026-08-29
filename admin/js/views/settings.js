// ============================================================
// settings.js — التواصل وSEO وقالب رسالة واتساب والحساب.
//
// قالب الرسالة هنا هو ما يطلبه المالك: يغيّر صيغة الرسالة التي تصل
// على واتساب بلا لمس الكود، ويرى معاينة فورية بمثال حقيقي.
// ============================================================
import { el } from '../core/dom.js';
import { get, setAll, content as val } from '../core/store.js';
import { saveContent } from '../core/autosave.js';
import { toast } from '../core/toast.js';
import { icon } from '../ui/icon.js';
import { fld, text, textarea, tabs } from '../ui/fields.js';
import { confirmModal } from '../ui/modal.js';
import { currentUser, signOut } from '../core/auth.js';
import { SUPABASE_URL, STORAGE_BUCKET } from '../core/config.js';
import {
  DEFAULT_TEMPLATE, TEMPLATE_VARS, fillTemplate, buildVars,
  buildWhatsAppUrl, normalizePhone, isPhone,
} from '../core/whatsapp.js';

function saveKey(key, value) {
  setAll('site_content', get('site_content').filter((r) => r.key !== key).concat([{ key, value }]));
  return saveContent(key, value);
}

/* ── مثال واقعي لمعاينة القالب ── */
const SAMPLE = {
  order_number: 'APX-K3M9F2',
  lines: [
    { name: 'بوستر إعلاني', qty: 2, custom: false },
    { name: 'تصميم شعار', qty: 1, custom: false },
    { name: 'غلاف بودكاست', qty: 1, custom: true },
  ],
  name: 'محمد العتيبي',
  contact: '0511572807',
  platform: 'واتساب',
  usage: 'تجاري — مشروع أو متجر',
  description: 'براند قهوة مختصة، الهوية بين الدافئ والمينيمال.',
  attachments: ['https://example.com/a1.jpg', 'https://example.com/a2.jpg'],
};

function templateTab() {
  const current = val('wa_template', DEFAULT_TEMPLATE);
  const preview = el('pre', { class: 'wa-preview' });
  const area = el('textarea', {
    class: 'field mono', rows: '18', 'aria-label': 'قالب رسالة واتساب',
    oninput: () => { paint(); queue(); },
  }, [current]);

  let timer = null;
  const queue = () => {
    clearTimeout(timer);
    timer = setTimeout(() => saveKey('wa_template', area.value).catch(() => {}), 700);
  };

  function paint() {
    preview.textContent = fillTemplate(area.value, buildVars(SAMPLE, {
      brand: val('brand', 'aboal3z.dzn'), site: location.origin,
    }));
  }
  paint();

  /** يدرج متغيّراً عند موضع المؤشر. */
  const insert = (name) => {
    const s = area.selectionStart ?? area.value.length;
    const e = area.selectionEnd ?? s;
    const token = `{{${name}}}`;
    area.value = area.value.slice(0, s) + token + area.value.slice(e);
    area.focus();
    area.setSelectionRange(s + token.length, s + token.length);
    paint();
    queue();
  };

  return el('div', { class: 'wa-grid' }, [
    el('div', { class: 'stack' }, [
      el('div', { class: 'card' }, [
        el('div', { class: 'card__head' }, [
          el('span', { class: 'card__title grow' }, ['قالب الرسالة']),
          el('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: async () => {
            if (!await confirmModal({ title: 'إرجاع القالب الأصلي؟',
              body: 'يُستبدل ما كتبته بالقالب الافتراضي.', confirm: 'إرجاع', danger: true })) return;
            area.value = DEFAULT_TEMPLATE;
            paint();
            await saveKey('wa_template', DEFAULT_TEMPLATE);
            toast('رجع القالب للأصل', 'success');
          } }, [icon('undo', { size: 13 }), 'الأصلي']),
        ]),
        area,
        el('p', { class: 'fld__hint' }, [
          'استعمل ',
          el('code', {}, ['{{#attachments}}…{{/attachments}}']),
          ' لإظهار قسم فقط عندما توجد قيمة له.',
        ]),
      ]),
      el('div', { class: 'card' }, [
        el('div', { class: 'card__head' }, [el('span', { class: 'card__title' }, ['المتغيّرات'])]),
        el('div', { class: 'var-grid' }, TEMPLATE_VARS.map(([name, label]) =>
          el('button', { class: 'var-chip', type: 'button', title: label,
            onclick: () => insert(name) }, [
            el('code', {}, [`{{${name}}}`]),
            el('span', {}, [label]),
          ]))),
      ]),
    ]),
    el('div', { class: 'card wa-card' }, [
      el('div', { class: 'card__head' }, [
        el('span', { class: 'card__title grow' }, ['المعاينة']),
        el('span', { class: 'card__hint' }, ['بمثال حقيقي']),
      ]),
      preview,
      el('a', {
        class: 'btn btn--primary', target: '_blank', rel: 'noopener',
        href: buildWhatsAppUrl(val('whatsapp'), preview.textContent),
        onclick: (e) => { e.currentTarget.href = buildWhatsAppUrl(val('whatsapp'), preview.textContent); },
      }, [icon('whatsapp', { size: 16 }), 'جرّبها على واتساب']),
    ]),
  ]);
}

function contactTab() {
  const waHint = el('span', { class: 'fld__hint' });
  const paintHint = (v) => {
    const n = normalizePhone(v);
    waHint.textContent = v
      ? (isPhone(v) ? `سيُرسل إلى: ${n}` : 'الرقم غير صالح — اكتبه بالأرقام مثل 0511572807')
      : 'بدونه لن يعمل زر الطلب.';
    waHint.style.color = v && !isPhone(v) ? 'var(--a-danger)' : '';
  };
  paintHint(val('whatsapp'));

  return el('div', { class: 'fld-grid' }, [
    el('div', { class: 'card' }, [
      fld('رقم واتساب', text(val('whatsapp'), (v) => { saveKey('whatsapp', v); paintHint(v); },
        { label: 'رقم واتساب', inputmode: 'tel', mono: true })),
      waHint,
    ]),
    el('div', { class: 'card' }, [
      fld('نص بجانب واتساب', text(val('whatsapp_label'), (v) => saveKey('whatsapp_label', v), { label: 'نص واتساب' })),
    ]),
    el('div', { class: 'card' }, [
      fld('معرّف انستقرام', text(val('instagram'), (v) => saveKey('instagram', v), { label: 'انستقرام' }), 'بلا @'),
      fld('نص بجانب انستقرام', text(val('instagram_label'), (v) => saveKey('instagram_label', v), { label: 'نص انستقرام' })),
    ]),
    el('div', { class: 'card' }, [
      fld('معرّف X', text(val('x'), (v) => saveKey('x', v), { label: 'X' }), 'بلا @ — اتركه فارغاً ليختفي'),
      fld('البريد الإلكتروني', text(val('email'), (v) => saveKey('email', v), { label: 'البريد', type: 'email' })),
    ]),
  ]);
}

function accountTab() {
  const u = currentUser();
  return el('div', { class: 'fld-grid' }, [
    el('div', { class: 'card' }, [
      el('div', { class: 'card__head' }, [el('span', { class: 'card__title' }, ['الحساب'])]),
      el('dl', { class: 'kv' }, [
        el('dt', {}, ['البريد']), el('dd', { class: 'mono' }, [u?.email || '—']),
        el('dt', {}, ['المعرّف']), el('dd', { class: 'mono' }, [(u?.id || '—').slice(0, 8)]),
      ]),
      el('p', { class: 'fld__hint' }, ['تغيير كلمة المرور يتم من لوحة Supabase → Authentication.']),
      el('button', { class: 'btn btn--danger', type: 'button', onclick: async () => {
        if (!await confirmModal({ title: 'تسجيل الخروج؟', confirm: 'خروج', danger: true })) return;
        signOut(); location.reload();
      } }, [icon('logout', { size: 15 }), 'تسجيل الخروج']),
    ]),
    el('div', { class: 'card' }, [
      el('div', { class: 'card__head' }, [el('span', { class: 'card__title' }, ['الاتصال'])]),
      el('dl', { class: 'kv' }, [
        el('dt', {}, ['قاعدة البيانات']), el('dd', { class: 'mono', style: { overflowWrap: 'anywhere' } }, [SUPABASE_URL || '—']),
        el('dt', {}, ['حاوية الملفات']), el('dd', { class: 'mono' }, [STORAGE_BUCKET]),
      ]),
      el('p', { class: 'fld__hint' }, ['تُضبط من ملف config.local.js — انظر README.']),
    ]),
  ]);
}

function seoTab() {
  return el('div', { class: 'fld-grid' }, [
    el('div', { class: 'card' }, [
      fld('عنوان الصفحة', text(val('seo_title'), (v) => saveKey('seo_title', v), { label: 'عنوان SEO' }),
        'يظهر في تبويب المتصفح ونتائج البحث'),
      fld('وصف الصفحة', textarea(val('seo_description'), (v) => saveKey('seo_description', v),
        { rows: 3, label: 'وصف SEO' }), 'سطران على الأكثر — يظهران تحت العنوان في جوجل'),
    ]),
  ]);
}

export function render(host, { query } = {}) {
  const TABS = [['contact', 'التواصل'], ['whatsapp', 'رسالة واتساب'],
                ['seo', 'محرّكات البحث'], ['account', 'الحساب']];
  let active = TABS.some(([k]) => k === query?.t) ? query.t : 'contact';
  const body = el('div');

  const t = tabs(TABS, active, (k) => {
    active = k;
    history.replaceState(null, '', `#/settings?t=${k}`);
    draw();
  });

  function draw() {
    body.replaceChildren(
      active === 'whatsapp' ? templateTab()
        : active === 'seo' ? seoTab()
        : active === 'account' ? accountTab()
        : contactTab(),
    );
  }
  draw();

  host.replaceChildren(el('div', { class: 'view' }, [
    el('div', { class: 'view__head' }, [
      el('div', {}, [
        el('h1', { class: 'view__title' }, ['الإعدادات']),
        el('p', { class: 'view__sub' }, ['التواصل وصيغة رسالة الطلب وبيانات الحساب']),
      ]),
    ]),
    t.node,
    body,
  ]));
}
