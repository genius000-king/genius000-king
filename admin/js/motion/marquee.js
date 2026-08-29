// 23 + 3 — حلقة لانهائية بلا قفزة + سحب يدوي بقصور ذاتي.
// يُستعمل الإزاحة بـ transform لا scrollLeft — لأن scrollLeft في RTL
// يختلف سلوكه بين المتصفحات ويكسر نقطة الالتفاف.
import loop from './loop.js';
import prefs from './prefs.js';
import { on } from '../core/dom.js';
import { scan } from './registry.js';

const FRICTION = 0.94;     // تخميد القصور الذاتي بعد الإفلات
const MIN_V = 0.05;

export default {
  name: 'marquee',
  init(host, o = {}) {
    const track = host.firstElementChild;
    if (!track || track.children.length === 0) return;

    // تكرار المجموعة مرتين — النصف الثاني نسخة بصرية بحتة
    const clone = track.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    [...clone.children].forEach((c) => c.setAttribute('tabindex', '-1'));
    const firstCopy = clone.firstElementChild;
    while (clone.firstChild) track.append(clone.firstChild);
    // النسخ لا ترث حالة التهيئة (خاصية JS لا سمة) — تُمسح لتعمل مؤثراتها أيضاً
    if (firstCopy) queueMicrotask(() => scan(track));

    const speed = prefs.scale(Number(o.speed ?? 28), o.intensity ?? 1);
    const dir = Number(o.dir ?? 1) >= 0 ? 1 : -1;

    const s = { x: 0, v: 0, half: 0, paused: false, dragging: false, lastX: 0, moved: 0 };

    const measure = () => { s.half = track.scrollWidth / 2; };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);

    const wrap = () => {
      if (!s.half) return;
      while (s.x <= -s.half) s.x += s.half;
      while (s.x > 0) s.x -= s.half;
    };

    const tick = (dt) => {
      if (s.dragging) { /* الإزاحة تأتي من المؤشر */ }
      else if (Math.abs(s.v) > MIN_V) { s.x += s.v; s.v *= FRICTION; }
      else if (!s.paused) { s.x -= dir * speed * dt; }
      wrap();
      track.style.transform = `translate3d(${s.x.toFixed(2)}px, 0, 0)`;
    };

    const down = (e) => {
      s.dragging = true; s.v = 0; s.moved = 0;
      s.lastX = e.clientX;
      host.setPointerCapture?.(e.pointerId);
      host.classList.add('is-dragging');
    };
    const move = (e) => {
      if (!s.dragging) return;
      const dx = e.clientX - s.lastX;
      s.lastX = e.clientX;
      s.moved += Math.abs(dx);
      s.x += dx; s.v = dx;
    };
    const up = (e) => {
      if (!s.dragging) return;
      s.dragging = false;
      host.releasePointerCapture?.(e.pointerId);
      host.classList.remove('is-dragging');
      // سحبة حقيقية تمنع نقرة عرضية على البطاقة
      if (s.moved > 8) { host.__swallowClick = true; setTimeout(() => { host.__swallowClick = false; }, 0); }
    };

    const offs = [
      on(host, 'pointerenter', () => { s.paused = true; }),
      on(host, 'pointerleave', () => { s.paused = false; }),
      on(host, 'pointerdown', down),
      on(host, 'pointermove', move, { passive: true }),
      on(host, 'pointerup', up),
      on(host, 'pointercancel', up),
      on(host, 'click', (e) => { if (host.__swallowClick) { e.stopPropagation(); e.preventDefault(); } }, true),
      loop.add(tick),
    ];

    host.__marquee = { offs, ro, track };
  },
  destroy(host) {
    const m = host.__marquee;
    if (!m) return;
    m.offs.forEach((f) => f());
    m.ro.disconnect();
    m.track.style.transform = '';
    delete host.__marquee;
  },
};
