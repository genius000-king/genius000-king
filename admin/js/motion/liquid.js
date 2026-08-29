// 6 — سائل: شبكة نقاط مربوطة بنوابض، لمسة المؤشر تولّد موجة تنتشر وتخمد.
import prefs from './prefs.js';
import { on } from '../core/dom.js';
import { makeCanvas } from './_canvas.js';

const GAP = 46;
const K = 0.06;          // ثابت النابض للعودة للأصل
const SPREAD = 0.14;     // انتقال الطاقة للجيران
const DAMP = 0.94;       // احتكاك

export default {
  name: 'liquid',
  init(host, o = {}) {
    if (prefs.reduced) return;
    const hit = prefs.scale(26, o.intensity ?? 1);
    let cols = 0, rows = 0, z = [], v = [];

    const build = ({ w, h }) => {
      cols = Math.max(2, Math.ceil(w / GAP) + 1);
      rows = Math.max(2, Math.ceil(h / GAP) + 1);
      z = new Float32Array(cols * rows);
      v = new Float32Array(cols * rows);
    };

    const poke = (e) => {
      const r = host.getBoundingClientRect();
      const cx = Math.round((e.clientX - r.left) / GAP);
      const cy = Math.round((e.clientY - r.top) / GAP);
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return;
      v[cy * cols + cx] -= hit;
    };

    const draw = ({ ctx, w, h }) => {
      // فيزياء: نابض نحو الصفر + انتشار للجيران + تخميد
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          let neigh = 0, n = 0;
          if (x > 0) { neigh += z[i - 1]; n++; }
          if (x < cols - 1) { neigh += z[i + 1]; n++; }
          if (y > 0) { neigh += z[i - cols]; n++; }
          if (y < rows - 1) { neigh += z[i + cols]; n++; }
          v[i] += (neigh / n - z[i]) * SPREAD - z[i] * K;
          v[i] *= DAMP;
        }
      }
      for (let i = 0; i < z.length; i++) z[i] += v[i];

      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      for (let y = 0; y < rows; y++) {
        ctx.beginPath();
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const px = x * GAP, py = y * GAP + z[i];
          x === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        const amp = Math.min(1, Math.abs(z[y * cols]) / 12);
        ctx.strokeStyle = `rgba(96, 165, 250, ${0.07 + amp * 0.35})`;
        ctx.stroke();
      }
    };

    host.__liquid = makeCanvas(host, { onResize: build, onFrame: draw });
    host.__liquidOff = [on(host, 'pointermove', poke, { passive: true })];
  },
  destroy(host) {
    host.__liquid?.destroy();
    (host.__liquidOff || []).forEach((f) => f());
    delete host.__liquid; delete host.__liquidOff;
  },
};
