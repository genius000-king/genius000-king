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

// ⚠️ لا نستخدم نابضاً هنا. النسخة الأولى كانت نابضاً (SPRING مع
//    FRICTION) فتذبذبَ ولم يستقرّ: قياسٌ حيّ أظهر متوسط البعد عن الموطن
//    يهبط 80←8.6 ثم يرتدّ 36.9←17.9، لأن النابض شبه المخمَّد يعيد ضخّ
//    الطاقة كل دورة. فبقي الشعار نقاطاً بلا رجوع.
//
//    البديل: تقارب أسّي خالص نحو الموطن — بلا تجاوز وبلا تذبذب ووصولٌ
//    مضمون. RETURN هو الزمن (ث) الذي يقطع فيه الجسيم 99.85% من المسافة،
//    وهو مستقلّ عن معدّل الإطارات لأنه محسوب من dt. السرعة vx/vy لم تعد
//    تحمل إلا دفعة النفور، وتتلاشى وحدها.
const RETURN   = 0.55;      // ث — زمن العودة إلى الموطن
const RESIDUAL = 0.0015;    // ما يتبقّى من المسافة بعد RETURN
const FRICTION = 0.86;      // تلاشي دفعة النفور (لكل 1/60 ث)
const REPEL    = 52;        // قوة النفور المستمرّ تحت المؤشّر
const REPEL_R  = 130;
const BURST    = 190;       // دفعة اللمسة الواحدة
const SETTLE_D = 1.2;       // متوسط البعد (px) الذي نعتبره وصولاً
const MIN_FX   = 520;       // أقلّ زمن تبقى فيه الجسيمات ظاهرة بعد الإشعال
const MAX_FX   = 2600;      // سقف: الصورة الحادّة تعود مهما حدث
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
    let fxSince = 0, holdUntil = 0;
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

      // يطابق object-fit: contain تماماً — أي انكماش هنا يجعل الشعار
      // «يقفز» حجمُه لحظة التبديل بين الصورة والجسيمات.
      const scale = Math.min(W / img.naturalWidth, H / img.naturalHeight);
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

      const spread = Math.max(60, Math.min(W, H) * 0.55);
      for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
          if (px[(y * W + x) * 4 + 3] <= 130) continue;
          const a = Math.random() * Math.PI * 2;
          const d = spread * (0.35 + Math.random() * 0.65);
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

    const frame = (dt) => {
      if (!P.length) return;
      ctx.clearRect(0, 0, W, H);

      const step = Math.min(dt || 0.016, 0.05);
      const pull = 1 - Math.pow(RESIDUAL, step / RETURN);   // نحو الموطن
      const drag = Math.pow(FRICTION, step * 60);           // تلاشي الدفعة
      let dist = 0;

      for (const p of P) {
        if (mouse.on) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < REPEL_R * REPEL_R && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const f = (1 - d / REPEL_R) * REPEL / d * step * 60;
            p.vx += dx * f; p.vy += dy * f;
          }
        }

        p.x += (p.hx - p.x) * pull + p.vx * step * 60;
        p.y += (p.hy - p.y) * pull + p.vy * step * 60;
        p.vx *= drag; p.vy *= drag;
        dist += Math.abs(p.hx - p.x) + Math.abs(p.hy - p.y);

        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // وصلت بيوتها؟ نعيد الصورة الحادّة ونوقف الرسم. نقيس البعد لا
      // السرعة: السرعة تهدأ والجسيم بعيد. و MIN_FX يضمن أن اللمسة تُرى
      // ولو ارتدّ المؤشّر فوراً، و MAX_FX ضمانة ألّا يعلق نقاطاً أبداً.
      const now = performance.now();
      const done = dist / P.length < SETTLE_D && now > holdUntil;
      if (!mouse.on && (done || now - fxSince > MAX_FX)) {
        setState('rest');
        setTimeout(stop, FADE);
      }
    };

    const start = () => { if (!running) { running = true; unsub = loop.add(frame); } };
    const stop  = () => { if (running && state === 'rest') { running = false; unsub?.(); unsub = null; ctx.clearRect(0,0,W,H); } };

    const wake = () => {
      fxSince = performance.now();
      holdUntil = Math.max(holdUntil, fxSince + MIN_FX);
      setState('fx'); start();
    };

    /** لمسة واحدة: دفعة شعاعية فورية — لا تعتمد على بقاء المؤشّر. */
    const burst = (cx, cy) => {
      const R = REPEL_R * 1.5;
      for (const p of P) {
        const dx = p.x - cx, dy = p.y - cy;
        const d = Math.hypot(dx, dy);
        if (d > R || d < 0.01) continue;
        const f = (1 - d / R) * BURST / d / 60;
        p.vx += dx * f; p.vy += dy * f;
      }
      wake();
    };

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
      // ⚠️ على اللمس تُطلق المتصفّحات pointerleave فور رفع الإصبع، فلو
      //    اعتمدنا على mouse.on المستمرّ لانطفأ التأثير قبل أن يُرى.
      //    لذلك اللمسة دفعة فورية مستقلّة عن بقاء المؤشّر.
      on(host, 'pointerdown', (e) => {
        const r = canvas.getBoundingClientRect();
        burst(e.clientX - r.left, e.clientY - r.top);
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
