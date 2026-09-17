// ============================================================
// معالج الطلب — أربع خطوات، ثم تسليم إلى واتساب.
//
// نقاط حرجة في هذا الملف:
//  · النافذة تُفتح متزامنةً داخل معالج النقر — بعد await يحجبها المتصفح.
//  · الطلب يُحفظ في القاعدة قبل فتح واتساب، فلا يضيع لو لم يضغط الزبون إرسال.
//  · المسودة تُحفظ في المتصفح، فإغلاق اللوحة لا يضيّع شيئاً.
// ============================================================
import { el, published, on } from '../core/dom.js';
import { get, content } from '../core/store.js';
import { insert } from '../core/api.js';
import { toast } from '../core/toast.js';
import { closePanel } from '../core/panel.js';
import { uploadMany } from '../core/upload.js';
import { iconOr, icon } from '../components/icon.js';
import {
  summarize, validateStep1, validateStep2, validateStep3,
  validateFile, MAX_FILES,
} from './order-logic.js';
import {
  genOrderNumber, fillTemplate, buildVars, buildWhatsAppUrl,
  canShareFiles, shareNative, copyToClipboard, normalizePhone, DEFAULT_TEMPLATE,
} from './whatsapp.js';

export { summarize, validateStep1, validateStep3 };

const DRAFT_KEY = 'aboal3z:draft';
const PLATFORMS = ['واتساب', 'انستقرام', 'سناب شات', 'بريد إلكتروني'];
const USAGES = ['تجاري — مشروع أو متجر', 'شخصي — هدية أو مناسبة',
                'فعالية — حفل أو مؤتمر', 'محتوى — سوشيال ميديا'];
const STEPS = ['البنود', 'المرفقات', 'بياناتك', 'المراجعة'];

const loadDraft = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; }
};
const saveDraft = (s) => {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...s, files: [] })); } catch { /* وضع خاص */ }
};
const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* */ } };

export default function render({ preset } = {}) {
  const draft = loadDraft();
  const state = {
    items: [], custom: [], files: [], uploaded: [],
    name: '', contact: '', platform: PLATFORMS[0], usage: USAGES[0], description: '',
    ...(draft || {}),
  };
  if (preset?.name) state.custom = [...(state.custom || []), { text: preset.name, qty: preset.qty || 1 }];

  let step = 1;
  let submitting = false;

  const body = el('div', { class: 'wiz__body' });
  const err = el('p', { class: 'wiz__error', role: 'alert' });

  const fill = el('span', { class: 'wiz__fill' });
  const labels = el('div', { class: 'wiz__labels' },
    STEPS.map((s) => el('span', {}, [s])));
  const progress = el('div', { class: 'wiz__progress' }, [
    el('div', { class: 'wiz__track' }, [fill]), labels,
  ]);

  const back = el('button', { class: 'btn', type: 'button', onclick: () => go(step - 1) }, ['رجوع']);
  const next = el('button', { class: 'btn btn--primary', type: 'button', 'data-fx': 'magnetic',
    onclick: (e) => go(step + 1, e) }, ['التالي']);

  const root = el('form', { class: 'wiz', novalidate: true, onsubmit: (e) => e.preventDefault() },
    [progress, body, err, el('div', { class: 'wiz__nav' }, [back, next])]);

  const VALIDATE = { 1: validateStep1, 2: validateStep2, 3: validateStep3 };

  function go(to, ev) {
    err.textContent = '';
    if (to > step) {
      const msg = VALIDATE[step]?.(state);
      if (msg) { err.textContent = msg; return; }
    }
    if (to > STEPS.length) return submit(ev);
    step = Math.min(STEPS.length, Math.max(1, to));
    saveDraft(state);
    draw();
  }

  function draw() {
    fill.style.setProperty('--p', `${(step / STEPS.length) * 100}%`);
    [...labels.children].forEach((n, i) => {
      n.classList.toggle('is-on', i === step - 1);
      n.classList.toggle('is-done', i < step - 1);
    });
    back.hidden = step === 1;
    next.textContent = step === STEPS.length ? 'إرسال عبر واتساب' : 'التالي';
    next.replaceChildren(
      document.createTextNode(step === STEPS.length ? 'إرسال عبر واتساب' : 'التالي'),
      step === STEPS.length ? icon('whatsapp', { size: 18 }) : icon('arrow', { size: 16 }),
    );
    body.replaceChildren(
      step === 1 ? stepItems() : step === 2 ? stepFiles() : step === 3 ? stepDetails() : stepReview(),
    );
    body.scrollIntoView?.({ block: 'nearest' });
  }

  /* ───────── الخطوة 1 — الكتالوج ───────── */
  function stepItems() {
    const catalog = published(get('order_items'));

    const cards = catalog.map((it) => {
      let row = state.items.find((i) => i.id === it.id);
      if (!row) { row = { id: it.id, name: it.name, qty: 0 }; state.items.push(row); }

      const out = el('output', { class: 'qty__value' }, [String(row.qty)]);
      const card = el('div', { class: `card item glass glass--soft ${row.qty ? 'is-picked' : ''}` }, [
        el('span', { class: 'item__icon' }, [iconOr(it.icon, '✦')]),
        el('h4', { class: 'item__name' }, [it.name]),
        it.description ? el('p', { class: 'card__text' }, [it.description]) : null,
        el('div', { class: 'qty' }, [
          el('button', { class: 'btn btn--icon', type: 'button', 'aria-label': `إنقاص ${it.name}`,
            onclick: () => bump(-1) }, [icon('minus', { size: 16 })]),
          out,
          el('button', { class: 'btn btn--icon', type: 'button', 'aria-label': `زيادة ${it.name}`,
            onclick: () => bump(1) }, [icon('plus', { size: 16 })]),
        ]),
      ]);
      function bump(d) {
        row.qty = Math.max(0, row.qty + d);
        out.textContent = String(row.qty);
        card.classList.toggle('is-picked', row.qty > 0);
        saveDraft(state);
      }
      return card;
    });

    const rows = el('div', { class: 'custom__rows' });
    const addRow = (entry) => {
      const out = el('output', { class: 'qty__value' }, [String(entry.qty)]);
      const row = el('div', { class: 'custom__row' }, [
        el('input', { type: 'text', class: 'field', placeholder: 'اكتب ما تريده',
          'aria-label': 'منتج غير مدرج', value: entry.text,
          oninput: (e) => { entry.text = e.target.value; saveDraft(state); } }),
        el('div', { class: 'qty' }, [
          el('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'إنقاص',
            onclick: () => { entry.qty = Math.max(1, entry.qty - 1); out.textContent = String(entry.qty); saveDraft(state); } },
            [icon('minus', { size: 16 })]),
          out,
          el('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'زيادة',
            onclick: () => { entry.qty++; out.textContent = String(entry.qty); saveDraft(state); } },
            [icon('plus', { size: 16 })]),
        ]),
        el('button', { class: 'btn btn--icon btn--danger', type: 'button', 'aria-label': 'حذف الصف',
          onclick: () => {
            const i = state.custom.indexOf(entry);
            if (i > -1) state.custom.splice(i, 1);
            row.remove(); saveDraft(state);
          } }, [icon('close', { size: 16 })]),
      ]);
      rows.append(row);
    };
    state.custom.forEach(addRow);

    return el('div', {}, [
      el('h3', { class: 'wiz__title' }, ['وش تحتاج؟']),
      catalog.length
        ? el('div', { class: 'items__grid' }, cards)
        : el('p', { class: 'card__text' }, ['الكتالوج فارغ — اكتب طلبك في «منتج غير مدرج» أدناه.']),
      el('div', { class: 'custom' }, [
        el('h4', { class: 'custom__head' }, ['منتج غير مدرج']),
        rows,
        el('button', { class: 'btn btn--sm', type: 'button',
          onclick: () => { const e = { text: '', qty: 1 }; state.custom.push(e); addRow(e); } },
          [icon('plus', { size: 16 }), 'أضف صفاً']),
      ]),
    ]);
  }

  /* ───────── الخطوة 2 — المرفقات ───────── */
  function stepFiles() {
    const grid = el('div', { class: 'thumbs' });
    const input = el('input', { type: 'file', multiple: true, hidden: true,
      accept: 'image/*,application/pdf',
      onchange: (e) => { addFiles([...e.target.files]); e.target.value = ''; } });

    const zone = el('div', {
      class: 'dropzone', role: 'button', tabindex: '0',
      'aria-label': 'إضافة مرفقات',
      onclick: () => input.click(),
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } },
      ondragover: (e) => { e.preventDefault(); zone.classList.add('is-over'); },
      ondragleave: () => zone.classList.remove('is-over'),
      ondrop: (e) => {
        e.preventDefault(); zone.classList.remove('is-over');
        addFiles([...(e.dataTransfer?.files || [])]);
      },
    }, [
      el('span', { class: 'dropzone__icon' }, [icon('upload', { size: 26 })]),
      el('span', { class: 'dropzone__title' }, ['اسحب صورك هنا أو اضغط للاختيار']),
      el('span', { class: 'dropzone__hint' }, [`صور أو PDF · حتى ${MAX_FILES} ملفات · 6MB للملف`]),
      input,
    ]);

    function addFiles(files) {
      for (const f of files) {
        const msg = validateFile(f, state.files.length);
        if (msg) { toast(msg, 'warn'); continue; }
        state.files.push(f);
      }
      drawThumbs();
    }

    function drawThumbs() {
      grid.replaceChildren(...state.files.map((f, i) => {
        const url = URL.createObjectURL(f);
        const isImg = f.type.startsWith('image/');
        return el('div', { class: 'thumb' }, [
          isImg
            ? el('img', { src: url, alt: f.name, onload: () => URL.revokeObjectURL(url) })
            : el('span', { class: 'card__text', style: { padding: '8px', fontSize: '11px' } }, [f.name]),
          el('button', { class: 'thumb__x', type: 'button', 'aria-label': `حذف ${f.name}`,
            onclick: () => { state.files.splice(i, 1); drawThumbs(); } }, [icon('close', { size: 14 })]),
        ]);
      }));
    }
    drawThumbs();

    return el('div', { class: 'field__stack' }, [
      el('h3', { class: 'wiz__title' }, ['عندك صور أو مراجع؟']),
      el('p', { class: 'card__text' }, ['اختياري — لكن الصور تختصر علينا وعليك وقتاً كبيراً.']),
      zone,
      grid,
    ]);
  }

  /* ───────── الخطوة 3 — البيانات ───────── */
  function field(label, node, hint) {
    return el('label', { class: 'field__wrap' }, [
      el('span', { class: 'field__label' }, [label]),
      node,
      hint ? el('span', { class: 'field__hint' }, [hint]) : null,
    ]);
  }

  function stepDetails() {
    const counter = el('span', { class: 'field__count' }, [`${state.description.length} / 500`]);
    const desc = el('textarea', { class: 'field', rows: '4', maxlength: '500',
      value: state.description,
      oninput: (e) => {
        state.description = e.target.value;
        counter.textContent = `${e.target.value.length} / 500`;
        saveDraft(state);
      } });
    desc.value = state.description;

    return el('div', { class: 'field__stack' }, [
      el('h3', { class: 'wiz__title' }, ['كيف نوصلك؟']),
      field('الاسم', el('input', { type: 'text', class: 'field', autocomplete: 'name',
        value: state.name, oninput: (e) => { state.name = e.target.value; saveDraft(state); } })),
      field('المنصة المفضّلة', el('select', { class: 'field',
        onchange: (e) => { state.platform = e.target.value; saveDraft(state); } },
        PLATFORMS.map((p) => el('option', { value: p, selected: p === state.platform }, [p])))),
      field('وسيلة التواصل', el('input', { type: 'text', class: 'field', inputmode: 'tel',
        placeholder: 'رقم واتساب أو معرف انستقرام', value: state.contact,
        oninput: (e) => { state.contact = e.target.value; saveDraft(state); } }),
        'لو اخترت واتساب اكتب الرقم بالأرقام — مثل 05xxxxxxxx'),
      field('نوع الاستخدام', el('select', { class: 'field',
        onchange: (e) => { state.usage = e.target.value; saveDraft(state); } },
        USAGES.map((u) => el('option', { value: u, selected: u === state.usage }, [u])))),
      field('وصف الفكرة', el('div', { class: 'field__stack' }, [desc, counter])),
    ]);
  }

  /* ───────── الخطوة 4 — المراجعة ───────── */
  function stepReview() {
    const { lines, totalUnits } = summarize(state);
    return el('div', {}, [
      el('h3', { class: 'wiz__title' }, ['راجع طلبك']),
      el('ul', { class: 'review-list' }, lines.map((l) =>
        el('li', {}, [
          el('span', {}, [l.name + (l.custom ? ' (طلب خاص)' : '')]),
          el('b', {}, [`×${l.qty}`]),
        ]))),
      el('p', { class: 'review-total' }, [`الإجمالي: ${totalUnits} بنداً`]),
      el('dl', { class: 'review-meta' }, [
        el('dt', {}, ['الاسم']), el('dd', {}, [state.name]),
        el('dt', {}, ['التواصل']), el('dd', {}, [`${state.platform} — ${state.contact}`]),
        el('dt', {}, ['الاستخدام']), el('dd', {}, [state.usage]),
        el('dt', {}, ['الوصف']), el('dd', {}, [state.description]),
        state.files.length ? el('dt', {}, ['المرفقات']) : null,
        state.files.length ? el('dd', {}, [`${state.files.length} ملف`]) : null,
      ]),
      el('p', { class: 'card__text' }, ['بالضغط على الإرسال يفتح واتساب والرسالة جاهزة — تضغط إرسال فقط.']),
    ]);
  }

  /* ───────── الإرسال ───────── */
  async function submit() {
    if (submitting) return;
    submitting = true;
    next.disabled = true;
    next.replaceChildren(document.createTextNode('جارٍ التجهيز…'));

    // 🔑 النافذة تُفتح الآن — متزامنةً — وإلا حجبها المتصفح بعد await
    let win = null;
    const needsWindow = !canShareFiles(state.files);
    if (needsWindow) { try { win = window.open('', '_blank'); } catch { win = null; } }

    const order_number = genOrderNumber(content('order_prefix', 'APX'));
    const { lines, totalUnits } = summarize(state);
    const phone = content('whatsapp');

    try {
      // 1) رفع المرفقات (لا يوقف التدفّق إن فشل)
      let urls = [];
      if (state.files.length) {
        next.replaceChildren(document.createTextNode('جارٍ رفع المرفقات…'));
        urls = await uploadMany(state.files, `orders/${order_number}`).catch((e) => {
          console.error('[upload]', e);
          toast('تعذّر رفع المرفقات — سنرسل الطلب بدونها', 'warn');
          return [];
        });
      }
      state.uploaded = urls;

      // 2) الحفظ في القاعدة — قبل واتساب، فلا يضيع الطلب
      const record = {
        order_number,
        service: lines[0]?.name || '',
        items_json: { items: state.items.filter((i) => i.qty > 0), custom: state.custom },
        name: state.name.trim(),
        contact: state.contact.trim(),
        contact_normalized: normalizePhone(state.contact),
        platform: state.platform,
        usage: state.usage,
        description: state.description.trim(),
        attachments: urls,
        total_units: totalUnits,
        channel: 'whatsapp',
        status: 'new',
        read: false,
      };
      await insert('orders', record, { returning: false }).catch((e) => {
        console.error('[order:insert]', e);   // نكمل — الأهم أن تصل الرسالة
      });

      // 3) بناء الرسالة من القالب الذي يحرّره المشرف
      const template = content('wa_template', DEFAULT_TEMPLATE);
      const vars = buildVars(
        { order_number, lines, name: record.name, contact: record.contact,
          platform: record.platform, usage: record.usage,
          description: record.description, attachments: urls },
        { brand: content('brand', 'aboal3z.dzn'), site: location.origin },
      );
      const text = fillTemplate(template, vars);

      // 4) التسليم — ثلاثة مستويات
      if (canShareFiles(state.files)) {
        try {
          await shareNative(state.files, text, `طلب ${order_number}`);
          return success(order_number, text, phone, 'native');
        } catch (e) {
          if (e && e.name === 'AbortError') {          // ألغى المستخدم الورقة
            next.disabled = false; submitting = false; draw(); return;
          }
          // نكمل إلى المستوى ب
        }
      }

      const url = buildWhatsAppUrl(phone, text);
      if (win && !win.closed) win.location.href = url;
      else window.open(url, '_blank', 'noopener');

      success(order_number, text, phone, urls.length ? 'links' : 'text');
    } catch (e) {
      console.error('[order]', e);
      win?.close();
      const text = fillTemplate(content('wa_template', DEFAULT_TEMPLATE),
        buildVars({ order_number, lines, ...state }, { brand: content('brand') }));
      await copyToClipboard(text);
      next.disabled = false;
      submitting = false;
      next.replaceChildren(document.createTextNode('إرسال عبر واتساب'), icon('whatsapp', { size: 18 }));
      err.textContent = 'تعذّر فتح واتساب — نسخنا الرسالة للحافظة، الصقها في المحادثة.';
      toast('نُسخت الرسالة للحافظة', 'warn');
    }
  }

  function success(number, text, phone, mode) {
    clearDraft();
    const url = buildWhatsAppUrl(phone, text);
    root.replaceChildren(el('div', { class: 'wiz__done' }, [
      el('span', { style: { color: 'var(--c-success)' } }, [icon('check', { size: 40 })]),
      el('h3', { class: 'wiz__title' }, ['طلبك جاهز في واتساب']),
      el('p', { class: 'card__text' }, [
        mode === 'native'
          ? 'اختر واتساب من قائمة المشاركة، وسترى الصور والرسالة معاً — اضغط إرسال فقط.'
          : 'فتحنا لك واتساب والرسالة مكتوبة — كل ما عليك هو الضغط على زر الإرسال.',
      ]),
      el('p', { class: 'wiz__number' }, [number]),
      el('div', { class: 'wiz__nav' }, [
        el('button', { class: 'btn', type: 'button', onclick: () => closePanel() }, ['إغلاق']),
        el('button', { class: 'btn', type: 'button',
          onclick: async () => {
            toast(await copyToClipboard(text) ? 'نُسخت الرسالة' : 'تعذّر النسخ',
              'success');
          } }, [icon('copy', { size: 16 }), 'نسخ الرسالة']),
        el('a', { class: 'btn btn--primary', href: url, target: '_blank', rel: 'noopener' },
          [icon('whatsapp', { size: 18 }), 'فتح واتساب']),
      ]),
    ]));
    toast('تم تجهيز طلبك', 'success');
  }

  // استئناف المسودة
  if (draft && (draft.name || draft.description || (draft.custom || []).length)) {
    queueMicrotask(() => toast('استأنفنا مسودتك السابقة', 'success'));
  }

  draw();
  return root;
}
