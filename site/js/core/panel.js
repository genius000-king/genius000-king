// panel.js — محرك اللوحات الزجاجية المنبثقة.
// 🔑 الرابط لا يتغيّر أبداً: pushState بنفس location.href حتى يغلق زر الرجوع
//    اللوحة بدل مغادرة الموقع (Spec AD-2).
import { el, qs, qsa, on } from './dom.js';
import { scan, destroyIn } from '../motion/registry.js';
import * as overlay from './overlay.js';

const FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';

let current = null;          // { id, root, opener, pushed }
let unbind = [];

export function isOpen() { return !!current; }
export function currentId() { return current?.id || null; }

/** جذر اللوحات — يُنشأ عند الحاجة حتى تعمل الوحدة في مشغّل الاختبارات أيضاً. */
function panelRoot() {
  let r = document.getElementById('panelRoot');
  if (!r) { r = el('div', { id: 'panelRoot' }); document.body.append(r); }
  return r;
}

function skeleton() {
  return el('div', { class: 'glass-panel__skeleton', 'aria-hidden': 'true' },
    [el('span'), el('span'), el('span')]);
}

function trapFocus(e) {
  if (!current || e.key !== 'Tab') return;
  const items = qsa(FOCUSABLE, current.root).filter((n) => n.offsetParent !== null);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/**
 * يفتح لوحة زجاجية.
 * @param {string} id   معرّف فريد للوحة (يدخل في حالة السجل)
 * @param {Function} loader دالة تعيد Promise — عادةً `() => import('...')`
 * @param {object} props تُمرَّر لدالة العرض داخل الوحدة
 */
export async function openPanel(id, loader, props = {}) {
  const previous = current ? current.onPop : null;
  const prevOpener = current ? current.opener : null;
  if (current) closePanel({ silent: true });

  const opener = prevOpener || document.activeElement;
  const body = el('div', { class: 'glass-panel__body' }, [skeleton()]);
  const panel = el('div', {
    class: 'glass-panel', role: 'dialog', 'aria-modal': 'true', 'data-panel': id, tabindex: '-1',
  }, [
    el('button', { class: 'glass-panel__close', type: 'button', 'aria-label': 'إغلاق اللوحة',
      onclick: () => closePanel() }, ['×']),
    body,
  ]);
  const root = el('div', { class: 'glass-panel__wrap', 'data-panel-wrap': id }, [
    el('div', { class: 'glass-panel__backdrop', onclick: () => closePanel() }),
    panel,
  ]);

  panelRoot().append(root);
  document.body.style.overflow = 'hidden';
  const onPop = () => closePanel({ fromPop: true });
  // استبدال لوحة بأخرى يعيد استخدام مدخل السجل نفسه — ضغطة رجوع واحدة تكفي.
  if (previous) overlay.replace(previous, onPop); else overlay.push(onPop);
  current = { id, root, panel, body, opener, onPop };

  unbind = [
    on(document, 'keydown', (e) => { if (e.key === 'Escape') closePanel(); }),
    on(document, 'keydown', trapFocus),
  ];
  requestAnimationFrame(() => root.classList.add('is-open'));
  document.dispatchEvent(new CustomEvent('panel:open', { detail: { id, panel } }));

  try {
    const mod = await loader();
    if (!current || current.id !== id) return;            // أُغلقت أثناء التحميل
    body.replaceChildren(await resolve(mod, props));
    scan(body);
    (qs(FOCUSABLE, body) || panel).focus();
  } catch (err) {
    console.error('[panel]', err);
    if (current && current.id === id) {
      body.replaceChildren(el('p', { class: 'glass-panel__error' }, ['تعذّر تحميل المحتوى.']));
    }
  }
  return root;
}

/** يحوّل ما أعاده اللودر إلى عقدة DOM. */
async function resolve(mod, props) {
  let out = mod && mod.default !== undefined ? mod.default : mod;
  if (typeof out === 'function') out = await out(props);
  if (out instanceof Node) return out;
  return el('div', { html: String(out ?? '') });
}

/** يغلق اللوحة المفتوحة. `fromPop` عند وصول popstate، `silent` عند الاستبدال. */
export function closePanel({ fromPop = false, silent = false } = {}) {
  if (!current) return;
  const { root, opener, onPop } = current;
  destroyIn(root);
  unbind.forEach((f) => f());
  unbind = [];
  root.classList.remove('is-open');
  root.remove();
  current = null;
  document.body.style.overflow = '';
  document.dispatchEvent(new CustomEvent('panel:close'));
  if (opener && typeof opener.focus === 'function') opener.focus();
  if (fromPop || silent) overlay.drop(onPop);   // fromPop: المكدّس أزالها بنفسه
  else overlay.pop(onPop);                      // يستهلك المدخل الذي أضفناه
}
