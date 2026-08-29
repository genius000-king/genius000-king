// edit-layer.js — طبقة التحرير فوق المعاينة: تحديد العنصر وشريط إجراءاته.
// لا تلمس بنية الأقسام: كل ما تضيفه قابل للإزالة الكاملة بـ `disableEditing`.
import { el, qsa, on } from './dom.js';
import { iconOr } from '../components/icon.js';
import { confirmModal } from './modal.js';
import * as api from './api.js';
import { hasOverride, clearOverride } from './overrides.js';
import { openStylePanel, closeStylePanel, currentBreakpoint } from '../panels/style-panel.js';

const GAP = 8;    // فراغ بين الشريط والعنصر — هندسة تشغيل لا قيمة تصميم
const EDGE = 8;   // أدنى بعد عن حافة النافذة

// [المفتاح، الوصف بالعربية، اسم الأيقونة، البديل النصي]
const ACTIONS = [
  ['text', 'تحرير النص', 'pencil', '✏️'],
  ['style', 'تنسيق العنصر', 'palette', '🎨'],
  ['drag', 'إعادة ترتيب العنصر', 'drag', '⠿'],
  ['add', 'إضافة عنصر مجاور', 'plus', '＋'],
  ['delete', 'حذف العنصر', 'trash', '🗑'],
  ['revert', 'إرجاع تنسيق العنصر', 'revert', '⟲'],
];

const roots = new Set();      // كل الجذور المفعّل عليها التحرير (قسم لكل جذر)
let bar = null;
let active = null;
let offs = [];

const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));
const saveState = (state) => emit('autosave:state', { state });
const idOf = (node) => node?.dataset?.editId || '';

/* --- بناء الشريط --- */
function buildBar() {
  const btn = ([key, label, name, glyph]) => el('button', {
    class: 'edit-bar__btn', type: 'button', 'data-act': key,
    'aria-label': label, title: label,
    onclick: (e) => { e.preventDefault(); run(key); },
  }, [iconOr(name, glyph)]);
  return el('div', { class: 'edit-bar', role: 'toolbar', 'aria-label': 'إجراءات العنصر' },
    ACTIONS.map(btn));
}

/* --- الموضع: فوق العنصر، ولا يغطّيه أبداً، ويبقى داخل الشاشة --- */
function place() {
  if (!active || !bar) return;
  const r = active.getBoundingClientRect();
  const b = bar.getBoundingClientRect();
  let top = r.top - b.height - GAP;
  if (top < EDGE) top = r.bottom + GAP;                       // العناصر الملاصقة للأعلى
  top = Math.min(Math.max(EDGE, top), Math.max(EDGE, innerHeight - b.height - EDGE));

  const rtl = getComputedStyle(document.documentElement).direction === 'rtl';
  const start = rtl ? innerWidth - r.right : r.left;
  const maxStart = Math.max(EDGE, innerWidth - b.width - EDGE);
  bar.style.insetBlockStart = `${top}px`;
  bar.style.insetInlineStart = `${Math.min(Math.max(EDGE, start), maxStart)}px`;
}

function show(node) {
  if (node === active) return place();
  active?.classList.remove('is-edit-active');
  active = node;
  node.classList.add('is-edit-active');
  bar.classList.add('is-on');
  bar.querySelector('[data-act="revert"]').hidden = !hasOverride(idOf(node), currentBreakpoint());
  place();
}

function hide() {
  active?.classList.remove('is-edit-active');
  active = null;
  bar?.classList.remove('is-on');
}

/* --- تحرير النص في مكانه --- */
// مفتاح `site_content` = `data-edit-key` إن وُجد، وإلا معرّف التحرير بنقاطه شُرَطاً سفلية.
const keyOf = (node) => node.dataset.editKey || idOf(node).replace(/\./g, '_');

function startText(node) {
  node.setAttribute('contenteditable', 'true');
  node.focus();
  on(node, 'blur', async () => {
    node.removeAttribute('contenteditable');
    saveState('saving');
    try {
      await api.upsert('site_content', { key: keyOf(node), value: node.textContent.trim() });
      saveState('saved');
    } catch (err) { console.error('[edit-layer]', err); saveState('error'); }
  }, { once: true });
}

/* --- تنفيذ إجراء الشريط --- */
async function run(key) {
  const node = active;
  if (!node) return;
  const target = idOf(node);
  if (key === 'text') return startText(node);
  if (key === 'style') return openStylePanel(target);
  if (key === 'drag') return emit('edit:reorder-request', { target, node });
  if (key === 'add') return emit('edit:add-sibling', { target, node });
  if (key === 'revert') {
    await clearOverride(target, currentBreakpoint());
    bar.querySelector('[data-act="revert"]').hidden = true;
    return;
  }
  if (key === 'delete') {
    const yes = await confirmModal({
      title: 'حذف هذا العنصر؟',
      body: `سيُحذف «${target}» من الصفحة. لا يمكن التراجع.`,
    });
    if (yes) emit('edit:delete', { target, node });
  }
}

/**
 * يشغّل التحرير داخل `root`.
 * ⚠️ كل قسم يستدعيها على حاويته، فالجذور متعدّدة لا واحد. الشريط
 * والمستمعات تُبنى مرة واحدة فقط ويُشاركها الجميع؛ لولا ذلك لهدم كل
 * قسم تسجيلَ الذي قبله ولم ينجُ إلا آخر قسم.
 */
export function enableEditing(root = document) {
  roots.add(root);
  (root === document ? document.body : root).classList.add('is-editing');
  if (bar) return bar;                     // مبنيّ سلفاً — يكفي تسجيل الجذر

  bar = buildBar();
  document.body.append(bar);

  const over = (e) => {
    if (bar.contains(e.target)) return;
    const node = e.target?.closest?.('[data-edit-id]');
    const inScope = node && [...roots].some((r) => r === document || r.contains(node));
    if (inScope) show(node); else hide();
  };
  offs = [
    on(document, 'pointerover', over),
    on(document, 'focusin', over),
    on(window, 'scroll', place, true),
    on(window, 'resize', place),
  ];
  return bar;
}

/**
 * يوقف التحرير في جذر واحد، أو في الكل حين لا يُمرَّر جذر.
 * الشريط والمستمعات لا تُهدَم إلا حين يفرغ آخر جذر.
 */
export function disableEditing(root) {
  const targets = root ? [root] : [...roots];
  for (const r of targets) {
    roots.delete(r);
    const scope = r && r !== document ? r : document;
    qsa('[contenteditable]', scope).forEach((n) => n.removeAttribute('contenteditable'));
    qsa('.is-edit-active', scope).forEach((n) => n.classList.remove('is-edit-active'));
    (r === document || !r ? document.body : r).classList.remove('is-editing');
  }
  if (roots.size) return;                  // بقي جذر آخر نشط

  offs.forEach((f) => f());
  offs = [];
  hide();
  bar?.remove();
  bar = null;
  closeStylePanel();
  document.body.classList.remove('is-editing');
}
