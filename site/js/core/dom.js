// أدوات DOM صغيرة — لا مكتبات. مستوردة من كل ملفات الواجهة.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** يهرّب النص قبل حقنه في HTML. */
export function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/**
 * ينشئ عنصراً بسماته وأبنائه.
 * السمات: `class`, `data-*`, أي سمة عادية، `style` ككائن، و`on*` كمستمعات.
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    // المتغيّرات المخصّصة (--x) لا تُضبط بـ Object.assign — تحتاج setProperty
    if (k === 'style' && typeof v === 'object') {
      for (const [prop, val] of Object.entries(v)) {
        prop.startsWith('--') ? node.style.setProperty(prop, val) : (node.style[prop] = val);
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false || child === '') continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function qs(sel, root = document) { return root.querySelector(sel); }

export function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

/** يربط مستمعاً ويعيد دالة إلغاء الربط. */
export function on(target, evt, fn, opts) {
  target.addEventListener(evt, fn, opts);
  return () => target.removeEventListener(evt, fn, opts);
}

/** يؤجّل التنفيذ حتى يهدأ الاستدعاء `ms` ميلي ثانية. */
export function debounce(fn, ms = 300) {
  let t;
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

/** يفرغ عنصراً من أبنائه. */
export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

/** يرتّب مصفوفة بـ `sort` ثم يصفّي غير المنشور. */
export function published(rows = []) {
  return rows.filter((r) => r.published !== false)
    .slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}
