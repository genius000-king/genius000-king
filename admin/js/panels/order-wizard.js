// معالج الطلب — ثلاث خطوات داخل لوحة زجاجية. بلا أسعار (قرار المالك).
// الدوال الخالصة في `order-logic.js` ويُعاد تصديرها هنا للاختبارات.
import { el, published } from '../core/dom.js';
import { get } from '../core/store.js';
import { insert } from '../core/api.js';
import { toast } from '../core/toast.js';
import { closePanel } from '../core/panel.js';
import { iconOr, icon } from '../components/icon.js';
import { genOrderNumber, summarize, validateItems, validateStep1, validateStep2 } from './order-logic.js';

export { genOrderNumber, summarize, validateItems, validateStep1, validateStep2 };

const PLATFORMS = ['واتساب', 'انستقرام', 'سناب شات', 'بريد إلكتروني'];
const USAGES = ['تجاري — مشروع أو متجر', 'شخصي — هدية أو مناسبة',
                'فعالية — حفل أو مؤتمر', 'محتوى — سوشيال ميديا'];

export default function render() {
  const state = { items: [], custom: [], name: '', contact: '',
                  platform: PLATFORMS[0], usage: USAGES[0], description: '', file: '' };
  let step = 1;

  const body = el('div', { class: 'wiz__body' });
  const err = el('p', { class: 'wiz__error', role: 'alert' });
  const dots = el('div', { class: 'wiz__steps' },
    [1, 2, 3].map((n) => el('span', { class: 'wiz__dot', 'data-step': n })));

  const back = el('button', { class: 'btn', type: 'button', onclick: () => go(step - 1) }, ['رجوع']);
  const next = el('button', { class: 'btn btn--primary', type: 'button', 'data-fx': 'magnetic',
    onclick: () => go(step + 1) }, ['التالي']);

  const root = el('form', { class: 'wiz', novalidate: true,
    onsubmit: (e) => e.preventDefault() },
    [dots, body, err, el('div', { class: 'wiz__nav' }, [back, next])]);

  function go(to) {
    err.textContent = '';
    if (to > step) {
      const msg = step === 1 ? validateStep1(state) : step === 2 ? validateStep2(state) : null;
      if (msg) { err.textContent = msg; return; }
    }
    if (to > 3) return submit();
    step = Math.max(1, to);
    draw();
  }

  function draw() {
    [...dots.children].forEach((d, i) => d.classList.toggle('is-on', i < step));
    back.hidden = step === 1;
    next.textContent = step === 3 ? 'إرسال الطلب' : 'التالي';
    body.replaceChildren(step === 1 ? stepItems() : step === 2 ? stepDetails() : stepReview());
  }

  /* ---------- الخطوة 1 — الكتالوج والكميات ---------- */
  function stepItems() {
    const catalog = published(get('order_items'));
    const cards = catalog.map((it) => {
      const row = state.items.find((i) => i.id === it.id)
        || (state.items.push({ id: it.id, name: it.name, qty: 0 }), state.items.at(-1));
      const out = el('output', { class: 'qty__value' }, [String(row.qty)]);
      const bump = (d) => { row.qty = Math.max(0, row.qty + d); out.textContent = String(row.qty);
        card.classList.toggle('is-picked', row.qty > 0); };
      const card = el('div', { class: `card item ${row.qty ? 'is-picked' : ''}` }, [
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
      return card;
    });

    const rows = el('div', { class: 'custom__rows' });
    const addRow = (entry = { text: '', qty: 1 }) => {
      state.custom.push(entry);
      const out = el('output', { class: 'qty__value' }, [String(entry.qty)]);
      const row = el('div', { class: 'custom__row' }, [
        el('input', { type: 'text', class: 'field', placeholder: 'اكتب ما تريده',
          'aria-label': 'منتج غير مدرج', value: entry.text,
          oninput: (e) => { entry.text = e.target.value; } }),
        el('div', { class: 'qty' }, [
          el('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'إنقاص',
            onclick: () => { entry.qty = Math.max(1, entry.qty - 1); out.textContent = String(entry.qty); } },
            [icon('minus', { size: 16 })]),
          out,
          el('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'زيادة',
            onclick: () => { entry.qty++; out.textContent = String(entry.qty); } },
            [icon('plus', { size: 16 })]),
        ]),
        el('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'حذف الصف',
          onclick: () => { state.custom.splice(state.custom.indexOf(entry), 1); row.remove(); } },
          [icon('close', { size: 16 })]),
      ]);
      rows.append(row);
    };
    // إعادة بناء الصفوف اليدوية المحفوظة عند الرجوع لهذه الخطوة
    const kept = state.custom.slice();
    state.custom = [];
    kept.forEach(addRow);

    return el('div', {}, [
      el('h3', { class: 'wiz__title' }, ['وش تحتاج؟']),
      el('div', { class: 'grid items__grid', style: { '--cols': '2' } }, cards),
      el('div', { class: 'custom' }, [
        el('h4', { class: 'custom__head' }, ['منتج غير مدرج']),
        rows,
        el('button', { class: 'btn', type: 'button', onclick: () => addRow() },
          [icon('plus', { size: 16 }), 'أضف صفاً']),
      ]),
    ]);
  }

  /* ---------- الخطوة 2 — البيانات ---------- */
  function field(label, node) {
    return el('label', { class: 'field__wrap' }, [el('span', { class: 'field__label' }, [label]), node]);
  }

  function stepDetails() {
    const counter = el('span', { class: 'field__count' }, ['0 / 500']);
    const desc = el('textarea', { class: 'field', rows: '4', maxlength: '500',
      oninput: (e) => { state.description = e.target.value; counter.textContent = `${e.target.value.length} / 500`; } });

    return el('div', { class: 'wiz__fields' }, [
      el('h3', { class: 'wiz__title' }, ['كيف نوصلك؟']),
      field('الاسم', el('input', { type: 'text', class: 'field', autocomplete: 'name',
        value: state.name, oninput: (e) => { state.name = e.target.value; } })),
      field('وسيلة التواصل', el('input', { type: 'text', class: 'field',
        placeholder: 'رقم واتساب أو معرف انستقرام', value: state.contact,
        oninput: (e) => { state.contact = e.target.value; } })),
      field('المنصة', el('select', { class: 'field',
        onchange: (e) => { state.platform = e.target.value; } },
        PLATFORMS.map((p) => el('option', { value: p, selected: p === state.platform }, [p])))),
      field('نوع الاستخدام', el('select', { class: 'field',
        onchange: (e) => { state.usage = e.target.value; } },
        USAGES.map((u) => el('option', { value: u, selected: u === state.usage }, [u])))),
      field('وصف الفكرة', el('div', { class: 'field__stack' }, [desc, counter])),
    ]);
  }

  /* ---------- الخطوة 3 — المراجعة ---------- */
  function stepReview() {
    const { lines, totalUnits } = summarize(state);
    return el('div', {}, [
      el('h3', { class: 'wiz__title' }, ['راجع طلبك']),
      el('ul', { class: 'review-list' }, lines.map((l) =>
        el('li', {}, [el('span', {}, [l.name]), el('b', {}, [`×${l.qty}`])]))),
      el('p', { class: 'review-total' }, [`الإجمالي: ${totalUnits} بنداً`]),
      el('dl', { class: 'review-meta' }, [
        el('dt', {}, ['الاسم']), el('dd', {}, [state.name]),
        el('dt', {}, ['التواصل']), el('dd', {}, [`${state.platform} — ${state.contact}`]),
        el('dt', {}, ['الاستخدام']), el('dd', {}, [state.usage]),
        el('dt', {}, ['الوصف']), el('dd', {}, [state.description]),
      ]),
    ]);
  }

  /* ---------- الإرسال ---------- */
  async function submit() {
    next.disabled = true;
    next.textContent = 'جارٍ الإرسال…';
    const order_number = genOrderNumber();
    try {
      await insert('orders', {
        order_number, service: summarize(state).lines[0]?.name || '',
        items_json: { items: state.items.filter((i) => i.qty > 0), custom: state.custom },
        name: state.name, contact: state.contact, platform: state.platform,
        usage: state.usage, description: state.description,
        file_url: state.file, status: 'new', read: false,
      });
      success(order_number);
    } catch (e) {
      console.error(e);
      next.disabled = false;
      next.textContent = 'إرسال الطلب';
      err.textContent = 'تعذّر الإرسال. حاول مرة أخرى.';
      toast('تعذّر إرسال الطلب', 'error');
    }
  }

  function success(number) {
    const wa = get('site_content').find((r) => r.key === 'whatsapp')?.value;
    root.replaceChildren(el('div', { class: 'wiz__done' }, [
      el('h3', { class: 'wiz__title' }, ['وصلنا طلبك!']),
      el('p', { class: 'card__text' }, ['نرد عليك خلال 24 ساعة.']),
      el('p', { class: 'wiz__number' }, [number]),
      el('div', { class: 'wiz__nav' }, [
        el('button', { class: 'btn', type: 'button', onclick: () => closePanel() }, ['إغلاق']),
        wa ? el('a', { class: 'btn btn--primary', href: `https://wa.me/${wa}`,
          target: '_blank', rel: 'noopener' }, ['تواصل على واتساب']) : null,
      ]),
    ]));
    toast('تم إرسال طلبك', 'success');
  }

  draw();
  return root;
}
