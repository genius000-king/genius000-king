// router.js — موجّه مسارات hash. زر الرجوع يعمل، والروابط تُحفظ وتُشارك.
const routes = [];
let current = null;
let onChange = null;

/** يسجّل مساراً. النمط يقبل :params — مثل '/packages/:id'. */
export function route(pattern, handler, meta = {}) {
  const keys = [];
  const rx = new RegExp('^' + pattern
    .replace(/\/:([\w]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; })
    .replace(/\//g, '\\/') + '$');
  routes.push({ pattern, rx, keys, handler, meta });
}

export function parse(hash = location.hash) {
  const raw = String(hash || '').replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  return { path: path || '/', query: Object.fromEntries(new URLSearchParams(query)) };
}

/** دالة خالصة: تطابق مساراً وتستخرج معاملاته. */
export function match(path) {
  for (const r of routes) {
    const m = r.rx.exec(path);
    if (!m) continue;
    const params = {};
    r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    return { ...r, params };
  }
  return null;
}

export function go(path, { replace = false } = {}) {
  const h = '#' + (path.startsWith('/') ? path : '/' + path);
  if (location.hash === h) return resolve();
  if (replace) history.replaceState(null, '', h); else location.hash = h;
}

export function currentRoute() { return current; }

export async function resolve() {
  const { path, query } = parse();
  const hit = match(path) || match('/');
  if (!hit) return;
  current = { ...hit, path, query };
  onChange?.(current);
  await hit.handler({ ...hit.params, query, path });
}

export function start(cb) {
  onChange = cb;
  addEventListener('hashchange', resolve);
  if (!location.hash) history.replaceState(null, '', '#/');
  return resolve();
}
