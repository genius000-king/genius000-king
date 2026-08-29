// أدوات DOM صغيرة — لا مكتبات. مستوردة من كل ملفات الواجهة.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/**
 * ينشئ عنصراً بسماته وأبنائه.
 * `style` ككائن (يدعم --المتغيّرات) · `on*` كمستمعات · `html` كـ innerHTML.
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'style' && typeof v === 'object') {
      for (const [prop, val] of Object.entries(v)) {
        if (val === null || val === undefined || val === false) continue;
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

/** جزء SVG — للأيقونات والمسارات. */
export function svgEl(tag, attrs = {}, children = []) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) if (c) node.append(c);
  return node;
}

export function qs(sel, root = document) { return root.querySelector(sel); }
export function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

export function on(target, evt, fn, opts) {
  target.addEventListener(evt, fn, opts);
  return () => target.removeEventListener(evt, fn, opts);
}

export function debounce(fn, ms = 300) {
  let t;
  const wrapped = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

export function throttle(fn, ms = 100) {
  let last = 0, timer = null;
  return (...args) => {
    const now = Date.now();
    const wait = ms - (now - last);
    if (wait <= 0) { last = now; fn(...args); }
    else if (!timer) timer = setTimeout(() => { last = Date.now(); timer = null; fn(...args); }, wait);
  };
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

/**
 * يستبدل أبناء عنصر متجاهلاً الفراغات.
 *
 * ⚠️ `replaceChildren` الأصلية لا تتجاهل `null`: تحوّلها إلى *نصّ*
 *    مكتوب فيه «null» يظهر للزائر في الصفحة. وكل قسم هنا يمرّر
 *    `شرط ? عنصر : null` — فأي قسم بلا محتوى كان يطبع الكلمة.
 *    هذه الدالة تحلّ ذلك في مكان واحد.
 */
export function setKids(node, ...kids) {
  node.replaceChildren(...kids.flat(Infinity).filter(
    (k) => k !== null && k !== undefined && k !== false && k !== ''));
}

/** يصفّي غير المنشور ثم يرتّب بـ `sort`. */
export function published(rows = []) {
  return rows.filter((r) => r && r.published !== false)
    .slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}

/** حالة فارغة موحّدة. */
export function emptyState(title, hint, action) {
  return el('div', { class: 'empty-state' }, [
    el('span', { class: 'empty-state__icon', 'aria-hidden': 'true' }, ['◇']),
    el('p', { class: 'empty-state__title' }, [title]),
    hint ? el('p', {}, [hint]) : null,
    action || null,
  ]);
}

/** حالة خطأ موحّدة. */
export function errorState(msg, onRetry) {
  return el('div', { class: 'error-state' }, [
    el('p', {}, [msg || 'تعذّر تحميل هذا القسم.']),
    onRetry ? el('button', { class: 'btn btn--sm', type: 'button', onclick: onRetry }, ['إعادة المحاولة']) : null,
  ]);
}

/** هيكل تحميل. */
export function skeletons(n = 4, cls = 't--box') {
  return Array.from({ length: n }, () => el('div', { class: `skeleton skeleton--card ${cls}` }));
}
