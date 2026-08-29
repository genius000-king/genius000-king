// ============================================================
// logo-mark.js — الإصدار الثاني
//
// ما تغيّر، وهما الطلبان بالضبط:
//
// 1) التفاعل من أي مكان.
//    v1 كانت تستمع على الشعار وحده: لا يتحرّك إلا إن وقف المؤشّر
//    فوقه بالضبط. الآن الاستماع على `window`، وأي سحب في أي موضع من
//    الصفحة يحرّكه — قريباً كان أو بعيداً:
//      · قريب  → الجسيمات تنفر من موضع الإصبع نفسه
//      · بعيد  → تهبّ عليها «ريح» باتجاه السحب وسرعته
//    فحتى لو أمسكت الصفحة بالخطأ وسحبت من أسفلها، يتجاوب معك.
//
// 2) التحوّل تدريجي لا مفاجئ.
//    v1 كانت تبدّل حالتين: صورة ↔ جسيمات، بـ opacity 0↔1 وانتقال
//    260ms. النتيجة قفزة: «سبحان الله كذا فجأة».
//    الآن هناك قيمة واحدة مستمرّة `morph` بين 0 و1 تُحسب كل إطار
//    بتقارب أسّي، وكل جسيم له دوره `ord` فيتفكّك الشعار موجةً موجةً
//    من مركزه إلى أطرافه — ويعود كذلك. الصورة تخفت بمنحنى مكمّل
//    فلا توجد لحظة يكون فيها الاثنان باهتين معاً.
//
// حلقة رسم واحدة مشتركة، وتتوقّف تماماً حين يستقرّ الشعار.
// ============================================================
import loop from './loop.js';
import prefs from './prefs.js';
import { on, debounce } from '../core/dom.js';

/* ── ثوابت الفيزياء ──
   ⚠️ بلا نابض. النسخة الأولى جرّبت نابضاً فتذبذب ولم يستقرّ: النابض
      شبه المخمَّد يعيد ضخّ الطاقة كل دورة. التقارب الأسّي الخالص
      يصل دائماً، بلا تجاوز، ومستقلٌّ عن معدّل الإطارات. */
const RETURN   = 0.62;    // ث — زمن العودة إلى الموطن حين يهدأ كل شيء
const RESIDUAL = 0.0015;  // ما يتبقّى من المسافة بعد RETURN
const FRICTION = 0.90;    // تلاشي السرعة لكل 1/60 ث
const REPEL    = 46;      // قوة النفور تحت الإصبع
const BURST    = 210;     // دفعة اللمسة الواحدة
const WIND     = 0.55;    // نصيب سرعة السحب من قوة الريح

/* ── ثوابت التحوّل ── */
const TAU_UP   = 0.20;    // ث — سرعة التفكّك (أسرع: الاستجابة فورية)
const TAU_DOWN = 0.62;    // ث — سرعة التجمّع (أبطأ: العودة تُشاهَد)
const STAGGER  = 0.55;    // كم من التحوّل يمضي في تتابع الجسيمات
const HOLD_MS  = 620;     // أقلّ زمن يبقى فيه متفكّكاً بعد لمسة
const ASSEMBLE = 1500;    // زمن التجميعة الأولى عند أول ظهور

const PALETTE = ['#E8EDF5', '#FFFFFF', '#12A5D4', '#0E86B4', '#9AA8BC'];
const ALPHA_STEPS = 7;    // تكميم الشفافية: يجمع الرسم في دفعات قليلة

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
/* منحنى ناعم البداية والنهاية — يمنع «انطلاقة» مفاجئة في التلاشي */
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export default {
  name: 'logo-mark',
  heavy: true,

  init(host, o = {}) {
    const img = host.querySelector('.logo-mark__img');
    const canvas = host.querySelector('.logo-mark__fx');
    if (!img || !canvas) return;

    // احترام تقليل الحركة: الصورة الحادّة فقط، بلا جسيمات إطلاقاً
    if (prefs.reduced) { img.style.opacity = '1'; return; }

    const ctx = canvas.getContext('2d', { alpha: true });
    let P = [];
    let W = 0, H = 0;                    // مقاس لوحة الرسم (أوسع من الشعار)
    let running = false, unsub = null;
    let rect = null;                     // موضع اللوحة في نافذة العرض
    let morph = 0, target = 0, holdUntil = 0;
    let assembleFrom = 0;                // وقت بدء التجميعة الأولى

    /* ── حالة المؤشّر: عالمية، لا مرتبطة بالشعار ── */
    const ptr = {
      x: 0, y: 0,          // إحداثيات النافذة
      px: 0, py: 0,        // السابقة — لحساب السرعة
      vx: 0, vy: 0,        // سرعة السحب
      down: false, seen: false, moved: 0,
    };
    let wind = { x: 0, y: 0 };

    /* ── القياس ── */
    const size = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rect = r;
    };

    /**
     * يبني الجسيمات بأخذ عيّنات من قناة شفافية الشعار.
     * الشعار يُرسم في *صندوقه* داخل لوحة أوسع، فتبقى إحداثيات الموطن
     * مطابقة تماماً لمكان الصورة على الشاشة — بلا قفزة عند التبديل.
     */
    const build = () => {
      P = [];
      if (!img.naturalWidth || W < 60) return;

      const hostRect = host.getBoundingClientRect();
      const cRect = canvas.getBoundingClientRect();
      const bx = hostRect.left - cRect.left;
      const by = hostRect.top - cRect.top;
      const bw = hostRect.width, bh = hostRect.height;

      const off = document.createElement('canvas');
      const octx = off.getContext('2d', { willReadFrequently: true });
      off.width = W; off.height = H;

      // يطابق object-fit: contain تماماً
      const scale = Math.min(bw / img.naturalWidth, bh / img.naturalHeight);
      const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
      octx.drawImage(img, bx + (bw - dw) / 2, by + (bh - dh) / 2, dw, dh);
      const px = octx.getImageData(0, 0, W, H).data;

      const wish = Math.round(prefs.scale(
        matchMedia('(max-width: 760px)').matches ? 1000 : 2000, o.intensity ?? 1)) || 600;

      let step = 8;
      for (const s of [3, 4, 5, 6, 7, 8, 10]) {
        let n = 0;
        for (let y = 0; y < H; y += s) for (let x = 0; x < W; x += s)
          if (px[(y * W + x) * 4 + 3] > 130) n++;
        step = s;
        if (n <= wish) break;
      }

      // المركز: منه تبدأ موجة التفكّك وإليه تعود
      const cx = bx + bw / 2, cy = by + bh / 2;
      const maxR = Math.hypot(bw, bh) / 2 || 1;

      for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
          if (px[(y * W + x) * 4 + 3] <= 130) continue;
          const d = Math.hypot(x - cx, y - cy) / maxR;
          P.push({
            hx: x, hy: y,
            x, y,
            vx: 0, vy: 0,
            r: step * 0.36 + Math.random() * 0.6,
            // الدور: من المركز إلى الأطراف، مع رشّة عشوائية تكسر الانتظام
            ord: clamp(d * 0.78 + Math.random() * 0.22),
            ph: Math.random() * Math.PI * 2,
            ci: x > W * 0.6
              ? (Math.random() < .7 ? 2 : 3)
              : (Math.random() < .55 ? 0 : Math.random() < .8 ? 1 : 4),
          });
        }
      }
    };

    /* ── قياس تأثير المؤشّر ──
       بعدان: القرب من صندوق الشعار، وشدّة السحب. الأول يعطي نفوراً
       موضعياً، والثاني يعطي ريحاً تصل مهما بَعُد الإصبع. */
    const influence = () => {
      if (!ptr.seen || !rect) return { near: 0, far: 0, lx: 0, ly: 0 };

      const lx = ptr.x - rect.left;
      const ly = ptr.y - rect.top;

      // مسافة إلى صندوق اللوحة (صفر إن كان داخله)
      const dx = Math.max(rect.left - ptr.x, 0, ptr.x - rect.right);
      const dy = Math.max(rect.top - ptr.y, 0, ptr.y - rect.bottom);
      const dist = Math.hypot(dx, dy);

      const reach = Math.max(W, H) * 0.9 + 200;
      const near = smooth(1 - clamp(dist / reach));

      // السحب: يصل من أي مكان في الصفحة، وتخفت قوّته مع البُعد ببطء
      const speed = Math.hypot(ptr.vx, ptr.vy);
      const wide = Math.max(innerWidth, innerHeight) * 0.9;
      const reachFar = smooth(1 - clamp(dist / wide)) * 0.75 + 0.25;
      const far = ptr.down ? clamp((0.42 + speed / 26) * reachFar) : 0;

      return { near, far, lx, ly };
    };

    /* ── الإطار ── */
    const frame = (dt) => {
      if (!P.length) return;
      const step = Math.min(dt || 0.016, 0.05);
      const now = performance.now();

      rect = canvas.getBoundingClientRect();
      const inf = influence();

      /* الهدف: أقوى المؤثّرين، مع أرضية أثناء الإمساك بعد لمسة */
      target = Math.max(inf.near * (ptr.down ? 1 : 0.92), inf.far);
      if (now < holdUntil) target = Math.max(target, 0.55);
      if (assembleFrom) {
        const t = clamp((now - assembleFrom) / ASSEMBLE);
        target = Math.max(target, 1 - smooth(t));
        if (t >= 1) assembleFrom = 0;
      }

      /* التقارب: صعود سريع وهبوط أبطأ — لأن العودة هي التي تُشاهَد */
      const tau = target > morph ? TAU_UP : TAU_DOWN;
      morph += (target - morph) * (1 - Math.exp(-step / tau));
      if (morph < 0.0015 && target === 0) morph = 0;

      /* الريح: تتبع سرعة السحب وتتلاشى وحدها */
      const decay = Math.pow(0.86, step * 60);
      wind.x = wind.x * decay + ptr.vx * WIND * inf.far * step * 60 * 0.02;
      wind.y = wind.y * decay + ptr.vy * WIND * inf.far * step * 60 * 0.02;

      /* الصورة تخفت بمنحنى مكمّل — لا لحظة يكون فيها الاثنان شاحبين */
      const mImg = 1 - smooth(clamp(morph * 1.12));
      img.style.opacity = mImg.toFixed(3);
      canvas.style.opacity = morph > 0 ? '1' : '0';

      // لا شيء يتحرّك ولا شيء ظاهر؟ أوقف الحلقة
      if (morph === 0) { ctx.clearRect(0, 0, W, H); stop(); return; }

      ctx.clearRect(0, 0, W, H);

      const pullBase = 1 - Math.pow(RESIDUAL, step / RETURN);
      const drag = Math.pow(FRICTION, step * 60);
      const repelR = Math.max(90, Math.min(W, H) * 0.42);
      const t = now / 1000;

      /* دفعات الرسم: (لون × مستوى شفافية) — يقلّل تبديل الحالة في
         الـ canvas من آلاف المرّات إلى ٣٥ على الأكثر. */
      const bins = [];

      for (const p of P) {
        // نصيب هذا الجسيم من التحوّل — هنا يولد التتابع
        const m = smooth(clamp((morph - p.ord * STAGGER) / (1 - STAGGER)));

        if (m > 0.01) {
          // نفور موضعي حين يقترب الإصبع
          if (inf.near > 0.02) {
            const dx = p.x - inf.lx, dy = p.y - inf.ly;
            const d2 = dx * dx + dy * dy;
            if (d2 < repelR * repelR && d2 > 0.01) {
              const d = Math.sqrt(d2);
              const f = (1 - d / repelR) * REPEL * inf.near / d * step * 60;
              p.vx += dx * f; p.vy += dy * f;
            }
          }
          // ريح السحب — تصل من أي مكان
          p.vx += wind.x * m;
          p.vy += wind.y * m;
          // رفرفة خفيفة تمنع المشهد من التجمّد
          p.vx += Math.cos(t * 1.6 + p.ph) * 0.06 * m;
          p.vy += Math.sin(t * 1.9 + p.ph) * 0.06 * m;
        }

        // كلّما زاد التحوّل ضعف شدّ الموطن، فتطفو الجسيمات بدل أن تُشدّ
        const pull = pullBase * (1 - 0.82 * m);
        p.x += (p.hx - p.x) * pull + p.vx * step * 60;
        p.y += (p.hy - p.y) * pull + p.vy * step * 60;
        p.vx *= drag; p.vy *= drag;

        if (m <= 0.01) continue;
        const lvl = Math.min(ALPHA_STEPS - 1, Math.round(m * (ALPHA_STEPS - 1)));
        const key = p.ci * ALPHA_STEPS + lvl;
        (bins[key] || (bins[key] = [])).push(p);
      }

      for (let k = 0; k < bins.length; k++) {
        const list = bins[k];
        if (!list) continue;
        ctx.globalAlpha = ((k % ALPHA_STEPS) + 1) / ALPHA_STEPS;
        ctx.fillStyle = PALETTE[(k / ALPHA_STEPS) | 0];
        ctx.beginPath();
        for (const p of list) {
          ctx.moveTo(p.x + p.r, p.y);
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const start = () => { if (!running) { running = true; unsub = loop.add(frame); } };
    const stop = () => { if (running) { running = false; unsub?.(); unsub = null; } };

    /** لمسة واحدة: دفعة شعاعية فورية لا تعتمد على بقاء الإصبع. */
    const burst = (lx, ly) => {
      const R = Math.max(110, Math.min(W, H) * 0.55);
      for (const p of P) {
        const dx = p.x - lx, dy = p.y - ly;
        const d = Math.hypot(dx, dy);
        if (d > R || d < 0.01) continue;
        const f = (1 - d / R) * BURST / d / 60;
        p.vx += dx * f; p.vy += dy * f;
      }
      holdUntil = performance.now() + HOLD_MS;
      start();
    };

    /* ── الاستماع على النافذة: هذا هو «من أي مكان» ── */
    /** هل يستحقّ هذا الحدث إيقاظ حلقة الرسم؟
        بلا هذا السؤال تعمل الحلقة مع كل حركة فأرة في الصفحة كلها. */
    const worthWaking = (x, y) => {
      if (ptr.down || morph > 0) return true;
      if (!rect) return false;
      const dx = Math.max(rect.left - x, 0, x - rect.right);
      const dy = Math.max(rect.top - y, 0, y - rect.bottom);
      return Math.hypot(dx, dy) < Math.max(W, H) * 0.9 + 200;
    };

    const readPointer = (x, y) => {
      if (ptr.seen) {
        // سرعة مُنعَّمة — قفزة واحدة كبيرة لا تُترجم إلى عاصفة
        ptr.vx = ptr.vx * 0.6 + (x - ptr.px) * 0.4;
        ptr.vy = ptr.vy * 0.6 + (y - ptr.py) * 0.4;
      }
      ptr.px = ptr.x = x;
      ptr.py = ptr.y = y;
      ptr.seen = true;
      if (worthWaking(x, y)) start();
    };

    const onMove = (e) => readPointer(e.clientX, e.clientY);
    const onTouch = (e) => {
      const t0 = e.touches && e.touches[0];
      if (t0) readPointer(t0.clientX, t0.clientY);
    };

    const onDown = (e) => {
      ptr.down = true;
      readPointer(e.clientX, e.clientY);
      // ضغطة على الشعار نفسه: دفعة فورية تُرى ولو رُفع الإصبع حالاً
      if (rect && e.clientX >= rect.left && e.clientX <= rect.right
              && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        burst(e.clientX - rect.left, e.clientY - rect.top);
      }
    };
    const onUp = () => { ptr.down = false; };
    const onLeave = () => { ptr.seen = false; ptr.down = false; ptr.vx = ptr.vy = 0; };

    const onResize = debounce(() => { size(); build(); start(); }, 200);

    const offs = [
      on(window, 'pointermove', onMove, { passive: true }),
      on(window, 'pointerdown', onDown, { passive: true }),
      on(window, 'pointerup', onUp, { passive: true }),
      on(window, 'pointercancel', onUp, { passive: true }),
      // اللمس أثناء التمرير يُلغي مؤشّر المتصفّح، فنلتقطه من touchmove
      on(window, 'touchmove', onTouch, { passive: true }),
      on(window, 'touchend', onUp, { passive: true }),
      on(document, 'pointerleave', onLeave),
      on(window, 'blur', onLeave),
      on(window, 'resize', onResize, { passive: true }),
      // الشعار يتحرّك مع التمرير: نحدّث موضعه المخزَّن ولو كانت الحلقة نائمة
      on(window, 'scroll', () => {
        rect = canvas.getBoundingClientRect();
        if (morph > 0 || ptr.down) start();
      }, { passive: true }),
    ];

    /* ── لا نحسب شيئاً قبل أن يُرى الشعار ── */
    const io = new IntersectionObserver((en) => {
      if (en[0].isIntersecting) {
        if (!host.dataset.seen) {
          host.dataset.seen = '1';
          // التجميعة الأولى: يبدأ نقاطاً مبعثرة ثم يستقرّ صورةً حادّة
          morph = 1;
          const spread = Math.max(W, H) * 0.28;
          for (const p of P) {
            const a = Math.random() * Math.PI * 2;
            const d = spread * (0.3 + Math.random() * 0.7);
            p.x = p.hx + Math.cos(a) * d;
            p.y = p.hy + Math.sin(a) * d;
          }
          assembleFrom = performance.now();
        }
        start();
      } else {
        ptr.seen = false;
        if (morph === 0) stop();
      }
    }, { threshold: 0.15 });

    const ready = () => { size(); build(); io.observe(host); };
    if (img.complete && img.naturalWidth) ready();
    else on(img, 'load', ready);

    img.style.opacity = '1';
    host.__logoMark = { offs, io, stop, onResize };
  },

  destroy(host) {
    const s = host.__logoMark;
    if (!s) return;
    s.stop();
    s.io.disconnect();
    s.offs.forEach((f) => f());
    s.onResize.cancel?.();
    delete host.__logoMark;
    delete host.dataset.seen;
    const img = host.querySelector('.logo-mark__img');
    if (img) img.style.opacity = '1';
  },
};
