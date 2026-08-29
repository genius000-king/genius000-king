// 18 — شبكة نقاط تتموّج حول المؤشر. محبوسة في قسمها، وتتوقف خارج الشاشة.
import prefs from './prefs.js';
import { on } from '../core/dom.js';
import { makeCanvas } from './_canvas.js';

const GAP = 34;          // المسافة بين نقطتين
const REACH = 150;       // نطاق تأثير المؤشر

export default {
  name: 'grid-ripple',
  init(host, o = {}) {
    if (prefs.reduced) return;
    const push = prefs.scale(16, o.intensity ?? 1);
    const mouse = { x: -9999, y: -9999 };

    const move = (e) => {
      const r = host.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    const leave = () => { mouse.x = mouse.y = -9999; };

    const draw = ({ ctx, w, h, now }) => {
      ctx.clearRect(0, 0, w, h);
      for (let x = GAP / 2; x < w; x += GAP) {
        for (let y = GAP / 2; y < h; y += GAP) {
          const dx = x - mouse.x, dy = y - mouse.y;
          const d = Math.hypot(dx, dy);
          const f = d < REACH ? (1 - d / REACH) : 0;
          const wave = Math.sin(now / 1400 + (x + y) / 90) * 0.5 + 0.5;
          const ox = f ? (dx / (d || 1)) * f * push : 0;
          const oy = f ? (dy / (d || 1)) * f * push : 0;
          ctx.globalAlpha = 0.10 + f * 0.55 + wave * 0.06;
          ctx.fillStyle = f > 0.15 ? '#60A5FA' : '#3B5170';
          ctx.beginPath();
          ctx.arc(x + ox, y + oy, 1 + f * 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    host.__grid = makeCanvas(host, { onFrame: draw });
    host.__gridOff = [on(window, 'pointermove', move, { passive: true }),
                      on(host, 'pointerleave', leave)];
  },
  destroy(host) {
    host.__grid?.destroy();
    (host.__gridOff || []).forEach((f) => f());
    delete host.__grid; delete host.__gridOff;
  },
};
