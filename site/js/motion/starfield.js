// 20 — حقل نجوم بثلاث طبقات عمق تتحرك مع التمرير.
// لوحة الرسم الوحيدة للخلفية (Spec: لوحتان نشطتان كحد أقصى).
import prefs from './prefs.js';
import { makeCanvas } from './_canvas.js';

const LAYERS = [
  { count: 90, size: 0.7, speed: 0.02, alpha: 0.35 },
  { count: 55, size: 1.1, speed: 0.05, alpha: 0.55 },
  { count: 22, size: 1.7, speed: 0.10, alpha: 0.85 },
];

export default {
  name: 'starfield',
  init(host, o = {}) {
    if (prefs.reduced) return;
    const intensity = o.intensity ?? 1;
    let stars = [];

    const build = ({ w, h }) => {
      stars = [];
      for (const L of LAYERS) {
        const n = Math.round(prefs.scale(L.count, intensity));
        for (let i = 0; i < n; i++) {
          stars.push({
            x: Math.random() * w, y: Math.random() * h,
            r: L.size * (0.6 + Math.random() * 0.8),
            a: L.alpha * (0.5 + Math.random() * 0.5),
            sp: L.speed,
            tw: Math.random() * Math.PI * 2,          // طور الوميض
          });
        }
      }
    };

    const draw = ({ ctx, w, h, now }) => {
      ctx.clearRect(0, 0, w, h);
      const sy = scrollY;
      for (const s of stars) {
        const y = (s.y - sy * s.sp) % h;
        const alpha = s.a * (0.7 + 0.3 * Math.sin(now / 900 + s.tw));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = s.r > 1.4 ? '#93C5FD' : '#E2ECFF';
        ctx.beginPath();
        ctx.arc(s.x, y < 0 ? y + h : y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    host.__stars = makeCanvas(host, { onResize: build, onFrame: draw, always: true });
  },
  destroy(host) { host.__stars?.destroy(); delete host.__stars; },
};
