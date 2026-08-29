// ============================================================
// logo-mark.js — الشعار حادّ في السكون، نقطي عند اللمس، ثم يعود.
//
// الفكرة: الحالة الطبيعية للشعار هي الصورة الأصلية بأعلى جودة — لا
// نقاط. الجسيمات ليست شكله الدائم بل *انتقال*:
//
//   دخول أول    → جسيمات مبعثرة تتجمّع، وحين تستقرّ نُظهر الصورة الحادّة
//   مؤشّر يقترب → نُخفي الصورة وتتفرّق الجسيمات هرباً منه
//   مؤشّر يبتعد → تعود لبيوتها، وحين تستقرّ ترجع الصورة الحادّة
//
// هكذا يرى الزائر شعاراً نظيفاً، ويكتشف التفاعل حين يلمسه.
// ============================================================
import loop from './loop.js';
import prefs from './prefs.js';
import { on, debounce } from '../core/dom.js';

const SPRING   = 0.055;
const FRICTION = 0.86;
const REPEL    = 46;
const REPEL_R  = 130;
const SETTLE   = 0.55;      // متوسط السرعة الذي نعتبره «استقراراً»
const FADE     = 260;       // مدة التبديل بين الصورة والجسيمات

const PALETTE = ['#E8EDF5', '#FFFFFF', '#12A5D4', '#0E86B4', '#9AA8BC'];

export default {
  name: 'logo-mark',
  heavy: true,

  init(host, o = {}) {
    const img = host.querySelector('.logo-mark__img');
    const canvas = host.querySelector('.logo-mark__fx');
    if (!img || !canvas) return;

    // احترام تقليل الحركة: الصورة الحادّة فقط، بلا جسيمات إطلاقاً
    if (prefs.reduced) { host.dataset.state = 'rest'; return; }

    const ctx = canvas.getContext('2d');
    let P = [], W = 0, H = 0, running = false, unsub = null, state = 'rest';
    const mouse = { x: -9999, y: -9999, on: false };

    const size = () => {
      const r = host.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.inlineSize = `${W}px`;
      canvas.style.blockSize = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    /** يبني الجسيمات بأخذ عيّنات من قناة شفافية الشعار. */
    const build = () => {
      P = [];
      if (!img.naturalWidth || W < 40) return;
      const off = document.createElement('canvas');
      const octx = off.getContext('2d', { willReadFrequently: true });
      off.width = W; off.height = H;

      const scale = Math.min(W / img.naturalWidth, H / img.naturalHeight) * 0.86;
      const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
      octx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      const px = octx.getImageData(0, 0, W, H).data;

      const target = Math.round(prefs.scale(
        matchMedia('(max-width: 760px)').matches ? 900 : 1800, o.intensity ?? 1)) || 500;
      let step = 8;
      for (const s of [3, 4, 5, 6, 7, 8, 10]) {
        let n = 0;
        for (let y = 0; y < H; y += s) for (let x = 0; x < W; x += s)
          if (px[(y * W + x) * 4 + 3] > 130) n++;
        step = s;
        if (n <= target) break;
      }

      for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
          if (px[(y * W + x) * 4 + 3] <= 130) continue;
          const a = Math.random() * Math.PI * 2;
          const d = 90 + Math.random() * 220;
          P.push({
            hx: x, hy: y,
            x: x + Math.cos(a) * d, y: y + Math.sin(a) * d,
            vx: 0, vy: 0,
            r: step * 0.36 + Math.random() * 0.6,
            c: PALETTE[x > W * 0.6 ? (Math.random() < .7 ? 2 : 3)
                                   : (Math.random() < .55 ? 0 : Math.random() < .8 ? 1 : 4)],
          });
        }
      }
    };

    const setState = (s) => {
      if (state === s) return;
      state = s;
      host.dataset.state = s;                 // CSS يتولّى التلاشي
    };

    const frame = () => {
      if (!P.length) return;
      ctx.clearRect(0, 0, W, H);
      let speed = 0;

      for (const p of P) {
        p.vx += (p.hx - p.x) * SPRING;
        p.vy += (p.hy - p.y) * SPRING;

        if (mouse.on) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < REPEL_R * REPEL_R && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const f = (1 - d / REPEL_R) * REPEL / d;
            p.vx += dx * f; p.vy += dy * f;
          }
        }

        p.vx *= FRICTION; p.vy *= FRICTION;
        p.x += p.vx; p.y += p.vy;
        speed += Math.abs(p.vx) + Math.abs(p.vy);

        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // استقرّت؟ نعيد الصورة الحادّة ونوقف الرسم
      if (!mouse.on && speed / P.length < SETTLE) {
        setState('rest');
        setTimeout(stop, FADE);
      }
    };

    const start = () => { if (!running) { running = true; unsub = loop.add(frame); } };
    const stop  = () => { if (running && state === 'rest') { running = false; unsub?.(); unsub = null; ctx.clearRect(0,0,W,H); } };

    const wake = () => { setState('fx'); start(); };

    const onResize = debounce(() => { size(); build(); if (state === 'fx') start(); }, 200);

    const offs = [
      on(window, 'resize', onResize, { passive: true }),
      on(host, 'pointerenter', () => { mouse.on = true; wake(); }),
      on(host, 'pointermove', (e) => {
        const r = canvas.getBoundingClientRect();
        mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
        mouse.on = true;
        if (state !== 'fx') wake();
      }, { passive: true }),
      on(host, 'pointerleave', () => { mouse.on = false; }),
      // على اللمس: لمسة واحدة تُشعل التأثير ثم يعود وحده
      on(host, 'pointerdown', (e) => {
        const r = canvas.getBoundingClientRect();
        mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
        mouse.on = true; wake();
        setTimeout(() => { mouse.on = false; }, 620);
      }),
    ];

    const io = new IntersectionObserver((en) => {
      if (en[0].isIntersecting && !host.dataset.seen) {
        host.dataset.seen = '1';
        wake();                               // التجميعة الأولى عند الظهور
      } else if (!en[0].isIntersecting) { mouse.on = false; }
    }, { threshold: 0.3 });

    const ready = () => { size(); build(); io.observe(host); };
    if (img.complete && img.naturalWidth) ready();
    else on(img, 'load', ready);

    host.dataset.state = 'rest';
    host.__logoMark = { offs, io, stop: () => { unsub?.(); unsub = null; }, onResize };
  },

  destroy(host) {
    const s = host.__logoMark;
    if (!s) return;
    s.stop(); s.io.disconnect();
    s.offs.forEach((f) => f());
    s.onResize.cancel?.();
    delete host.__logoMark;
    delete host.dataset.state;
    delete host.dataset.seen;
  },
};
