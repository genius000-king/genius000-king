// ============================================================
// logo-particles — الشعار يتجمّع من آلاف النقاط.
//
// نرسم صورة الشعار على لوحة خفيّة، نأخذ عيّنات من قناة الشفافية،
// ونحوّل كل نقطة مصمتة إلى جسيم له موضع بيت. الجسيمات تبدأ مبعثرة
// وتنجذب إلى بيوتها بنابض، وتتنافر مع المؤشر، وتتنفّس بموجة خفيفة.
//
// نفس فيزياء تأثير النقاط في الاسم — مطبَّقة على الشعار.
// ============================================================
import loop from './loop.js';
import prefs from './prefs.js';
import { on, debounce } from '../core/dom.js';

const SPRING_K   = 0.014;
const FRICTION   = 0.90;
const REPEL      = 5.2;
const REPEL_R    = 108;
const WAVE_AMP   = 1.7;

// ألوان الشعار: الفضّي والفيروزي المأخوذان منه مباشرة
const PALETTE = ['#D8DEE9', '#F2F5FA', '#0E86B4', '#3BB3D6', '#8A98AC'];

function pickColor(x, w) {
  // الطرف الأعلى-الأيمن من الشعار فيروزي (قطرة الفرشاة)
  const r = Math.random();
  if (x > w * 0.62) return r < 0.72 ? PALETTE[2] : PALETTE[3];
  if (r < 0.5) return PALETTE[0];
  if (r < 0.82) return PALETTE[1];
  return PALETTE[4];
}

export default {
  name: 'logo-particles',
  heavy: true,

  init(canvas, o = {}) {
    const src = canvas.dataset.fxSrc;
    if (!src) return;
    const ctx = canvas.getContext('2d');
    const host = canvas.parentElement || canvas;
    const intensity = o.intensity ?? 1;

    let particles = [];
    let W = 0, H = 0, dpr = 1, time = 0, ready = false;
    const mouse = { x: -9999, y: -9999 };
    const img = new Image();
    img.decoding = 'async';

    function resize() {
      const r = host.getBoundingClientRect();
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.inlineSize = `${W}px`;
      canvas.style.blockSize = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (ready) build();
    }

    function build() {
      particles = [];
      if (!img.naturalWidth || W < 20 || H < 20) return;

      // نرسم الشعار في المنتصف بأكبر حجم يسع اللوحة
      const off = document.createElement('canvas');
      const octx = off.getContext('2d', { willReadFrequently: true });
      off.width = W; off.height = H;

      const scale = Math.min(W / img.naturalWidth, H / img.naturalHeight) * 0.82;
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      octx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);

      const data = octx.getImageData(0, 0, W, H).data;
      const mobile = matchMedia('(max-width: 760px)').matches;
      const target = Math.round(prefs.scale(mobile ? 1100 : 2200, intensity)) || 500;

      // نختار خطوة العيّنة التي تقترب من العدد المستهدف
      let step = 10;
      for (const s of [3, 4, 5, 6, 7, 8, 10, 12]) {
        let cnt = 0;
        for (let y = 0; y < H; y += s) for (let x = 0; x < W; x += s) {
          if (data[(y * W + x) * 4 + 3] > 130) cnt++;
        }
        step = s;
        if (cnt <= target) break;
      }

      for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
          const a = data[(y * W + x) * 4 + 3];
          if (a <= 130) continue;
          const ang = Math.random() * Math.PI * 2;
          const dist = 160 + Math.random() * 320;
          particles.push({
            hx: x, hy: y,
            x: x + Math.cos(ang) * dist,
            y: y + Math.sin(ang) * dist,
            vx: 0, vy: 0,
            r: step * 0.34 + Math.random() * 0.7,
            c: pickColor(x, W),
            ph: Math.random() * Math.PI * 2,
          });
        }
      }
    }

    function frame(dt) {
      if (!particles.length) return;
      time += dt;
      ctx.clearRect(0, 0, W, H);

      for (const p of particles) {
        // نابض نحو البيت
        p.vx += (p.hx - p.x) * SPRING_K;
        p.vy += (p.hy - p.y) * SPRING_K;

        // تنافر مع المؤشر
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < REPEL_R * REPEL_R && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const f = (1 - d / REPEL_R) * REPEL;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
        }

        p.vx *= FRICTION;
        p.vy *= FRICTION;
        p.x += p.vx;
        p.y += p.vy;

        // موجة تنفّس خفيفة تمنع الجمود التام
        const wy = Math.sin(time * 1.15 + p.ph) * WAVE_AMP;

        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y + wy, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const onResize = debounce(resize, 180);
    const offs = [
      on(window, 'resize', onResize, { passive: true }),
      on(host, 'pointermove', (e) => {
        const r = canvas.getBoundingClientRect();
        mouse.x = e.clientX - r.left;
        mouse.y = e.clientY - r.top;
      }, { passive: true }),
      on(host, 'pointerleave', () => { mouse.x = mouse.y = -9999; }),
    ];

    let unsub = null;
    const io = new IntersectionObserver((e) => {
      if (e[0].isIntersecting) { if (!unsub) unsub = loop.add(frame); }
      else { unsub?.(); unsub = null; }
    }, { threshold: 0 });

    img.onload = () => {
      ready = true;
      resize();
      build();
      io.observe(host);
    };
    img.onerror = () => { host.dataset.static = '1'; };   // فشل التحميل → نُظهر الصورة العادية
    img.src = src;

    resize();
    canvas.__logoFx = { offs, io, stop: () => { unsub?.(); unsub = null; }, onResize };
  },

  destroy(canvas) {
    const s = canvas.__logoFx;
    if (!s) return;
    s.stop();
    s.io.disconnect();
    s.offs.forEach((f) => f());
    s.onResize.cancel?.();
    delete canvas.__logoFx;
  },
};
