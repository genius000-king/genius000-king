/* 1 — الجسيمات النصية: اسم الاستوديو مرسوماً بآلاف الجسيمات الحيّة.
   منقول من المشروع القديم بخوارزميته البصرية كما هي — النابض والاحتكاك
   والتنافر وموجة التنفّس وأخذ العيّنات، بلا تغيير في القيم.
   المتغيّر عن القديم: حلقة `loop` المشتركة بدل rAF خاصة · `prefs` بدل
   الاستعلام الداخلي · اللوحة الزرقاء بدل ألوان الثيمات · العنصر يصل وسيطاً. */
import loop from './loop.js';
import prefs from './prefs.js';
import { on, debounce } from '../core/dom.js';

const TEXT = 'aboal3z.dzn';
const FONT = 'IBM Plex Sans Arabic';
const PALETTE = ['#2563EB', '#60A5FA', '#93C5FD', '#E0ECFF'];

// الثوابت الفيزيائية — غير قابلة للتفاوض (منقولة حرفياً)
const SPRING_K = 0.012;
const FRICTION = 0.90;
const REPEL_FORCE = 5.5;
const WAVE_AMP = 2.1;

function pickColor() {
  const r = Math.random();
  if (r < 0.62) return PALETTE[0];
  if (r < 0.85) return PALETTE[1];
  if (r < 0.96) return PALETTE[2];
  return PALETTE[3];
}

export default {
  name: 'particles',
  heavy: true,          // يتخطّاه السجل كلياً عند prefers-reduced-motion

  init(canvas, o = {}) {
    const ctx = canvas.getContext('2d');
    const intensity = o.intensity ?? 1;
    const mobile = matchMedia('(max-width: 760px)').matches;

    let particles = [], W = 0, H = 0, time = 0;
    const mouse = { x: -9999, y: -9999, active: false };

    function build() {
      particles = [];
      const off = document.createElement('canvas');
      const octx = off.getContext('2d', { willReadFrequently: true });
      off.width = Math.floor(W); off.height = Math.floor(H);

      const pad = W * 0.03;
      let size = 200;
      octx.textAlign = 'center'; octx.textBaseline = 'middle';
      octx.font = `800 ${size}px ${FONT}`;
      while (octx.measureText(TEXT).width > W - pad * 2 && size > 24) {
        size -= 4;
        octx.font = `800 ${size}px ${FONT}`;
      }
      octx.fillStyle = '#fff';
      octx.fillText(TEXT, W / 2, H / 2);

      const img = octx.getImageData(0, 0, off.width, off.height).data;
      // الهدف يمرّ عبر prefs — يقلّ تلقائياً على الأجهزة الضعيفة
      const target = Math.round(prefs.scale(mobile ? 1300 : 2400, intensity)) || 600;

      let step = 12;
      for (const s of [4, 5, 6, 7, 8, 9, 10, 12]) {
        let cnt = 0;
        for (let y = 0; y < off.height; y += s) {
          for (let x = 0; x < off.width; x += s) {
            if (img[(y * off.width + x) * 4 + 3] > 128) cnt++;
          }
        }
        step = s;
        if (cnt <= target) break;
      }

      for (let y = 0; y < off.height; y += step) {
        for (let x = 0; x < off.width; x += step) {
          if (img[(y * off.width + x) * 4 + 3] <= 128) continue;
          particles.push({
            hx: x, hy: y,
            x: x + (Math.random() - 0.5) * 500,
            y: y + (Math.random() - 0.5) * 500,
            vx: 0, vy: 0,
            r: 1 + Math.random() * (mobile ? 1.1 : 1.4),
            c: pickColor(),
            phase: Math.random() * Math.PI * 2,
            speed: 0.6 + Math.random() * 0.8,
          });
        }
      }
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = Math.max(320, rect.width);
      H = Math.max(100, rect.height);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    const local = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    function explode(ex, ey) {
      for (const p of particles) {
        const dx = p.x - ex, dy = p.y - ey;
        const d = Math.hypot(dx, dy);
        if (d >= 220) continue;
        const f = (220 - d) / 220 * 26;
        p.vx += (dx / (d || 1)) * f;
        p.vy += (dy / (d || 1)) * f;
      }
    }

    const mr = mobile ? 80 : 110;
    const mr2 = mr * mr;

    function tick(dt) {
      time += dt;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      for (const p of particles) {
        const tx = p.hx + Math.sin(time * p.speed + p.phase) * WAVE_AMP;
        const ty = p.hy + Math.cos(time * p.speed * 0.8 + p.phase * 1.3) * WAVE_AMP;
        p.vx += (tx - p.x) * SPRING_K;
        p.vy += (ty - p.y) * SPRING_K;

        if (mouse.active) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < mr2) {
            const d = Math.sqrt(d2) || 1;
            const f = (1 - d / mr) * REPEL_FORCE;
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }
        }

        p.vx *= FRICTION; p.vy *= FRICTION;
        p.x += p.vx; p.y += p.vy;

        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    const onResize = debounce(resize, 220);
    const offs = [
      on(window, 'pointermove', (e) => {
        const p = local(e);
        mouse.x = p.x; mouse.y = p.y;
        mouse.active = p.y > -140 && p.y < H + 140;
      }, { passive: true }),
      on(window, 'pointerout', () => { mouse.active = false; }),
      on(canvas, 'pointerdown', (e) => { const p = local(e); explode(p.x, p.y); }),
      on(window, 'resize', onResize, { passive: true }),
    ];

    // يتوقف كلياً حين يخرج الهيرو من الشاشة
    let unsub = null;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !unsub) unsub = loop.add(tick);
      else if (!e.isIntersecting && unsub) { unsub(); unsub = null; }
    }, { threshold: 0 });

    const boot = () => { resize(); io.observe(canvas); };
    if (document.fonts?.load) {
      document.fonts.load(`800 100px ${FONT}`).then(boot).catch(boot);
    } else boot();

    canvas.__particles = { offs, io, stop: () => unsub?.(), cancel: () => onResize.cancel() };
  },

  destroy(canvas) {
    const p = canvas.__particles;
    if (!p) return;
    p.stop(); p.io.disconnect(); p.cancel();
    p.offs.forEach((f) => f());
    delete canvas.__particles;
  },
};
