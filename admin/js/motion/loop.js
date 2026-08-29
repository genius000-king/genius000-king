// loop.js — حلقة requestAnimationFrame واحدة مشتركة لكل المؤثرات (Spec §6.3).
// ❌ ممنوع على أي مؤثر أن يفتح حلقته الخاصة.

const subs = new Set();
let raf = 0;
let last = 0;

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
  last = now;
  for (const fn of subs) {
    try { fn(dt, now); } catch (e) { console.warn('[loop] مشترك أخطأ ثم أُزيل', e); subs.delete(fn); }
  }
  raf = subs.size ? requestAnimationFrame(tick) : 0;
}

function start() {
  if (raf || !subs.size || (typeof document !== 'undefined' && document.hidden)) return;
  last = 0;
  raf = requestAnimationFrame(tick);
}

function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
}

const loop = {
  add(fn) { subs.add(fn); start(); return () => loop.remove(fn); },
  remove(fn) { subs.delete(fn); if (!subs.size) stop(); },
  count() { return subs.size; },
  get running() { return !!raf; },
};

export default loop;
