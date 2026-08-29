// style-panel.js — لوح التنسيق الجانبي لعنصر واحد عند نقطة توقف واحدة.
// ⚠️ نقطة التوقف الظاهرة في الترويسة ليست زينة: التجاوز يُحفظ لها وحدها.
import { el, on, debounce } from '../core/dom.js';
import { icon } from '../components/icon.js';
import * as ov from '../core/overrides.js';
import * as overlay from '../core/overlay.js';
import { buildGroups } from './style-fields.js';

const BP_LABEL = { mobile: 'جوال', tablet: 'لوحي', desktop: 'سطح مكتب', all: 'كل المقاسات' };

let bp = 'desktop';          // آخر نقطة توقف بثّها شريط الأدوات
let root = null;             // عقدة اللوح المفتوح
let target = null;           // قيمة data-edit-id المحدَّدة
let offs = [];
let onPop = null;
let head = null;
let body = null;

const queue = new Map();     // مفتاح فريد → صف مؤجَّل للحفظ
const emit = (state) => document.dispatchEvent(new CustomEvent('autosave:state', { detail: { state } }));

document.addEventListener('leader:breakpoint', (e) => {
  bp = e.detail?.breakpoint || 'desktop';
  if (root) { renderHead(); renderBody(); }
});

/** يحفظ كل ما تراكم من تغييرات دفعة واحدة، ويبثّ حالة الحفظ للشريط. */
async function flushNow() {
  if (!queue.size) return;
  const items = [...queue.values()];
  queue.clear();
  emit('saving');
  try {
    for (const it of items) await ov.setOverride(it.target, it.bp, it.prop, it.value);
    emit('saved');
  } catch (err) {
    console.error('[style-panel]', err);
    emit('error');
  }
}
const flushSoon = debounce(flushNow, 800);

/* --- الجسر بين عناصر التحكم ومخزن التجاوزات --- */
const ctx = {
  get: (prop) => ov.getOverride(target, bp, prop),
  set: (prop, value) => {
    ov.setOverride(target, bp, prop, value, { persist: false });   // تطبيق فوري
    queue.set(`${target}|${bp}|${prop}`, { target, bp, prop, value });
    flushSoon();
  },
  revert: async (prop) => {
    queue.delete(`${target}|${bp}|${prop}`);
    emit('saving');
    try { await ov.clearOverride(target, bp, prop); emit('saved'); }
    catch (err) { console.error('[style-panel]', err); emit('error'); }
    renderBody();
  },
};

function renderHead() {
  head.replaceChildren(
    el('div', {}, [
      el('div', { class: 'side__title' }, ['تنسيق العنصر']),
      el('div', { class: 'side__sub' }, [target || '']),
    ]),
    el('span', { class: 'style-panel__bp', 'data-bp': bp,
      title: 'التجاوز يُحفظ لهذا المقاس وحده' }, [BP_LABEL[bp] || bp]),
    el('button', { class: 'tb__btn side__close', type: 'button', 'aria-label': 'إغلاق لوح التنسيق',
      onclick: () => closeStylePanel() }, [icon('close', { size: 16 }) || '×']),
  );
}

function renderBody() {
  body.replaceChildren(...buildGroups(ctx));
}

/** يفتح اللوح لعنصر — أو يبدّل هدفه إن كان مفتوحاً. */
export function openStylePanel(nextTarget) {
  target = typeof nextTarget === 'string' ? nextTarget : nextTarget?.dataset?.editId;
  if (!target) return null;

  if (root) { renderHead(); renderBody(); return root; }

  head = el('header', { class: 'side__head' });
  body = el('div', { class: 'side__body' });
  root = el('aside', { class: 'side style-panel', role: 'dialog',
    'aria-label': 'لوح تنسيق العنصر' }, [head, body]);
  renderHead();
  renderBody();

  (document.getElementById('panelRoot') || document.body).append(root);
  requestAnimationFrame(() => root.classList.add('is-open'));

  onPop = () => closeStylePanel({ fromPop: true });
  overlay.push(onPop);
  offs = [on(document, 'keydown', (e) => { if (e.key === 'Escape') closeStylePanel(); })];
  return root;
}

/** يغلق اللوح بعد حفظ ما لم يُحفظ بعد. */
export function closeStylePanel({ fromPop = false } = {}) {
  if (!root) return;
  flushSoon.cancel();
  flushNow();
  offs.forEach((f) => f());
  offs = [];
  root.classList.remove('is-open');
  root.remove();
  root = head = body = null;
  target = null;
  if (fromPop) overlay.drop(onPop); else overlay.pop(onPop);
  onPop = null;
}

/** نقطة التوقف الجارية — يقرأها طبقة التحرير لزر الإرجاع. */
export function currentBreakpoint() { return bp; }
