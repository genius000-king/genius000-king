// marquee — حلقة لانهائية بلا قفزة + سحب يدوي بقصور ذاتي.
//
// الإصلاحات: القياس بعد فك ترميز الصور (كان يقيس قبلها فتحدث قفزة عند
// الالتفاف) · التوقّف باللمس لا بالمرور فقط · مراقبة تغيّر حجم البلاطات.
import loop from './loop.js';
import prefs from './prefs.js';
import { on } from '../core/dom.js';
import { scan } from './registry.js';

const FRICTION = 0.94;
const MIN_V = 0.05;

export default {
  name: 'marquee',
  init(host, o = {}) {
    const track = host.firstElementChild;
    if (!track || track.children.length === 0) return;

    const originals = [...track.children];

    // تكرار المجموعة مرة — النصف الثاني نسخة بصرية بحتة
    const clone = track.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    [...clone.children].forEach((c) => {
      c.setAttribute('tabindex', '-1');
      c.setAttribute('aria-hidden', 'true');
    });
    while (clone.firstChild) track.append(clone.firstChild);
    queueMicrotask(() => scan(track));

    const speed = prefs.scale(Number(o.speed ?? 26), o.intensity ?? 1);
    const dir = Number(o.dir ?? 1) >= 0 ? 1 : -1;
    const s = { x: 0, v: 0, half: 0, paused: false, dragging: false, lastX: 0, moved: 0 };

    const measure = () => { s.half = track.scrollWidth / 2; };
    measure();

    // القياس مرة أخرى بعد أن تعرف الصور أبعادها الحقيقية
    const imgs = [...track.querySelectorAll('img')];
    Promise.allSettled(imgs.map((i) => (i.decode ? i.decode() : Promise.resolve())))
      .then(measure);
    on(window, 'load', measure);

    const ro = new ResizeObserver(measure);
    ro.observe(track);
    originals.forEach((c) => ro.observe(c));

    const wrap = () => {
      if (!s.half) return;
      while (s.x <= -s.half) s.x += s.half;
      while (s.x > 0) s.x -= s.half;
    };

    const tick = (dt) => {
      if (s.dragging) { /* الإزاحة من المؤشر */ }
      else if (Math.abs(s.v) > MIN_V) { s.x += s.v; s.v *= FRICTION; }
      else if (!s.paused) { s.x -= dir * speed * dt; }
      wrap();
      track.style.transform = `translate3d(${s.x.toFixed(2)}px, 0, 0)`;
    };

    const down = (e) => {
      s.dragging = true; s.paused = true; s.v = 0; s.moved = 0;
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
      s.paused = host.matches(':hover');
      host.releasePointerCapture?.(e.pointerId);
      host.classList.remove('is-dragging');
      if (s.moved > 8) { host.__swallowClick = true; setTimeout(() => { host.__swallowClick = false; }, 0); }
    };

    let unsub = null;
    const io = new IntersectionObserver((e) => {
      if (e[0].isIntersecting) { if (!unsub) unsub = loop.add(tick); }
      else { unsub?.(); unsub = null; }
    }, { threshold: 0 });
    io.observe(host);

    const offs = [
      on(host, 'pointerenter', () => { if (!prefs.touch) s.paused = true; }),
      on(host, 'pointerleave', () => { s.paused = false; }),
      on(host, 'pointerdown', down),
      on(host, 'pointermove', move, { passive: true }),
      on(host, 'pointerup', up),
      on(host, 'pointercancel', up),
      on(host, 'focusin', () => { s.paused = true; }),
      on(host, 'focusout', () => { s.paused = false; }),
      on(host, 'click', (e) => {
        if (host.__swallowClick) { e.stopPropagation(); e.preventDefault(); }
      }, true),
    ];

    host.__marquee = { offs, ro, io, track, stop: () => { unsub?.(); unsub = null; } };
  },
  destroy(host) {
    const m = host.__marquee;
    if (!m) return;
    m.stop();
    m.offs.forEach((f) => f());
    m.ro.disconnect();
    m.io.disconnect();
    m.track.style.transform = '';
    delete host.__marquee;
  },
};
