// registry.js — سجل المؤثرات والربط بـ data-fx.
// إضافة مؤثر = import + سطر register واحد. حذفه = حذف السطر (Spec §6.2).
import prefs from './prefs.js';

const effects = new Map();

/** يسجّل مؤثراً بالعقد { name, init(el, options), destroy(el) }. */
export function register(effect) {
  if (!effect || !effect.name || typeof effect.init !== 'function') {
    console.warn('[fx] مؤثر غير صالح — يحتاج { name, init }', effect);
    return;
  }
  effects.set(effect.name, effect);
}

export function has(name) { return effects.has(name); }
export function names() { return [...effects.keys()]; }

/** يقرأ خيارات المؤثر من سمات data-fx-* على العنصر. */
function optionsOf(el) {
  const opts = { intensity: 1 };
  for (const [k, v] of Object.entries(el.dataset)) {
    if (!k.startsWith('fx') || k === 'fx') continue;
    const key = k.slice(2, 3).toLowerCase() + k.slice(3);
    const num = Number(v);
    opts[key] = v !== '' && !Number.isNaN(num) ? num : v;
  }
  opts.intensity = Math.min(1, Math.max(0, Number(opts.intensity) || 0));
  return opts;
}

/**
 * يمسح `[data-fx]` داخل الجذر ويهيّئ ما لم يُهيَّأ.
 * يُستدعى عند الإقلاع وبعد كل حقن ديناميكي.
 */
export function scan(root = document) {
  const nodes = root.querySelectorAll ? [...root.querySelectorAll('[data-fx]')] : [];
  if (root.dataset && root.dataset.fx) nodes.unshift(root);
  let started = 0;
  for (const el of nodes) {
    if (el.__fxInit) continue;
    const list = el.dataset.fx.split(/\s+/).filter(Boolean);
    const live = [];
    for (const name of list) {
      const fx = effects.get(name);
      if (!fx) { console.warn(`[fx] مؤثر غير مسجَّل: ${name}`); continue; }
      if (prefs.reduced && fx.heavy) continue;   // مؤثر مكثّف يُتخطّى كلياً
      try { fx.init(el, optionsOf(el)); live.push(fx); started++; }
      catch (e) { console.warn(`[fx] فشل تهيئة ${name}`, e); }
    }
    if (live.length) { el.__fxInit = true; el.__fxLive = live; }
  }
  return started;
}

/** ينظّف كل المؤثرات داخل الجذر (قبل إزالة عنصر أو لوحة). */
export function destroyIn(root = document) {
  const nodes = root.querySelectorAll ? [...root.querySelectorAll('[data-fx]')] : [];
  if (root.dataset && root.dataset.fx) nodes.unshift(root);
  for (const el of nodes) {
    for (const fx of el.__fxLive || []) {
      try { fx.destroy && fx.destroy(el); } catch (e) { console.warn(`[fx] فشل تنظيف ${fx.name}`, e); }
    }
    delete el.__fxInit; delete el.__fxLive;
  }
}
