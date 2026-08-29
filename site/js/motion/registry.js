// registry.js — سجل المؤثرات والربط بـ data-fx.
//
// ثلاث بوّابات تحمي الأداء:
//   heavy   → يُتخطّى عند prefers-reduced-motion
//   noTouch → يُتخطّى على شاشات اللمس (مؤثرات المؤشر لا معنى لها)
//   كسول    → لا شيء يُهيَّأ قبل أن يقترب القسم من نافذة العرض
import prefs from './prefs.js';

const effects = new Map();
const LAZY_MARGIN = '260px';
let lazyIO = null;

export function register(effect) {
  if (!effect || !effect.name || typeof effect.init !== 'function') {
    console.warn('[fx] مؤثر غير صالح — يحتاج { name, init }', effect);
    return;
  }
  effects.set(effect.name, effect);
}

export function has(name) { return effects.has(name); }
export function names() { return [...effects.keys()]; }

function optionsOf(el) {
  const opts = { intensity: Number(getComputedStyle(el).getPropertyValue('--fx-intensity')) || 1 };
  for (const [k, v] of Object.entries(el.dataset)) {
    if (!k.startsWith('fx') || k === 'fx') continue;
    const key = k.slice(2, 3).toLowerCase() + k.slice(3);
    const num = Number(v);
    opts[key] = v !== '' && !Number.isNaN(num) ? num : v;
  }
  opts.intensity = Math.min(1, Math.max(0, Number(opts.intensity) || 0));
  return opts;
}

function boot(el) {
  if (el.__fxInit) return 0;
  const list = (el.dataset.fx || '').split(/\s+/).filter(Boolean);
  const live = [];
  let started = 0;
  for (const name of list) {
    const fx = effects.get(name);
    if (!fx) { console.warn(`[fx] مؤثر غير مسجَّل: ${name}`); continue; }
    if (prefs.reduced && fx.heavy) continue;
    if (prefs.touch && fx.noTouch) continue;
    try { fx.init(el, optionsOf(el)); live.push(fx); started++; }
    catch (e) { console.warn(`[fx] فشل تهيئة ${name}`, e); }
  }
  el.__fxInit = true;
  el.__fxLive = live;
  return started;
}

function lazyObserver() {
  if (lazyIO) return lazyIO;
  lazyIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      lazyIO.unobserve(e.target);
      boot(e.target);
    }
  }, { rootMargin: LAZY_MARGIN, threshold: 0 });
  return lazyIO;
}

/**
 * يمسح `[data-fx]` داخل الجذر.
 * ما هو قريب من نافذة العرض يُهيَّأ فوراً، وما هو بعيد ينتظر اقترابه.
 */
export function scan(root = document) {
  const nodes = root.querySelectorAll ? [...root.querySelectorAll('[data-fx]')] : [];
  if (root.dataset && root.dataset.fx) nodes.unshift(root);
  let started = 0;
  const io = lazyObserver();
  for (const el of nodes) {
    if (el.__fxInit) continue;
    const r = el.getBoundingClientRect();
    const near = r.top < innerHeight * 1.6 && r.bottom > -innerHeight * 0.6;
    if (near) started += boot(el);
    else io.observe(el);
  }
  return started;
}

export function destroyIn(root = document) {
  const nodes = root.querySelectorAll ? [...root.querySelectorAll('[data-fx]')] : [];
  if (root.dataset && root.dataset.fx) nodes.unshift(root);
  for (const el of nodes) {
    lazyIO?.unobserve(el);
    for (const fx of el.__fxLive || []) {
      try { fx.destroy && fx.destroy(el); }
      catch (e) { console.warn(`[fx] فشل تنظيف ${fx.name}`, e); }
    }
    delete el.__fxInit; delete el.__fxLive;
  }
}
