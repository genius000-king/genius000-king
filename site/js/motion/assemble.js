// ============================================================
// assemble.js — الموقع يبني نفسه من غبار وأنت تنزل.
//
// كل بلاطة، لحظة دخولها الشاشة، لا تظهر ظهوراً عادياً: يتجمّع فوق
// موضعها سربٌ من الحبيبات البيضاء، يهبط عليها، وتظهر هي من تحته
// وقد اكتمل. فتُقرأ الصفحة كأنها تتشكّل تحت الإصبع لا كأنها تُكشف.
//
// ── لماذا لوحة واحدة ──
//
//   البديل لوحة لكل بلاطة: عشرات السياقات وعشرات الحلقات على صفحة
//   واحدة. هنا لوحة واحدة ثابتة بحجم النافذة، وحلقة واحدة، تُشغَّل
//   عند أول تجمّع وتتوقّف تماماً حين تهبط آخر حبيبة. الصفحة الساكنة
//   لا تدفع شيئاً.
//
// ── لماذا إحداثيات الصفحة لا النافذة ──
//
//   التجمّع يستغرق ٦٤٠ms، والزائر ينزل أثناءها. فلو خُزّنت المقاصد
//   بإحداثيات النافذة انزلق الغبار عن بلاطته وهبط في الفراغ. تُخزَّن
//   بإحداثيات المستند ويُطرح التمرير عند الرسم، فيبقى ملتصقاً.
//
// ── الميزانية ──
//
//   سقف عالمي للحبيبات: ما يزيد يُرفض بصمت — بلاطة بلا غبار خير من
//   صفحة تتقطّع. ومع «تقليل الحركة» لا يعمل المحرّك أصلاً.
// ============================================================
import prefs from './prefs.js';

/* ── الثوابت ── */
const DUR = 640;          // ms — زمن هبوط الحبيبة (يطابق --t-slow في CSS)
const SPREAD = 74;        // px — أقصى تشتّت أوّلي عن المقصد
const RISE = 26;          // px — انحياز التشتّت إلى أعلى: غبار يهبط لا ينفجر
const PER_AREA = 2600;    // px² لكل حبيبة
const MIN_P = 14, MAX_P = 120;   // حدّ الحبيبات للبلاطة الواحدة
const EDGE_BIAS = 0.55;   // نصيب الحبيبات التي تقصد الحافّة: بها تُقرأ الحدود

const CAP = () => (prefs.lowPower ? 900 : prefs.touch ? 1600 : 3200);

let canvas = null, ctx = null, dpr = 1;
let parts = [];           // حبيبات حيّة
let raf = 0, last = 0;

/* ── اللوحة ── */
function ensureCanvas() {
  if (canvas) return canvas;
  canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', inlineSize: '100%', blockSize: '100%',
    pointerEvents: 'none', zIndex: '90',   // فوق المحتوى، تحت الشريط واللوحات
  });
  document.body.append(canvas);
  ctx = canvas.getContext('2d', { alpha: true });
  size();
  addEventListener('resize', size, { passive: true });
  return canvas;
}

function size() {
  if (!canvas) return;
  dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
}

/* ── منحنى الهبوط: سريع أولاً ثم يستقرّ بلا ارتداد ── */
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/**
 * يبثّ غباراً يتجمّع على صندوق العنصر.
 * يُستدعى لحظة ظهور البلاطة (انظر reveal.js).
 */
export function assemble(node) {
  if (prefs.reduced || !node || !node.isConnected) return;

  const r = node.getBoundingClientRect();
  if (r.width < 24 || r.height < 24) return;

  // خارج الشاشة تماماً؟ لا معنى لغبار لا يُرى
  if (r.bottom < -40 || r.top > innerHeight + 40) return;

  const room = CAP() - parts.length;
  if (room <= 0) return;                     // السقف: نرفض بصمت

  const n = Math.min(room,
    Math.max(MIN_P, Math.min(MAX_P, Math.round((r.width * r.height) / PER_AREA))));

  ensureCanvas();

  // إحداثيات المستند — التمرير يُطرح عند الرسم
  const ox = scrollX, oy = scrollY;
  const left = r.left + ox, top = r.top + oy;
  const cx = left + r.width / 2, cy = top + r.height / 2;
  const half = Math.hypot(r.width, r.height) / 2 || 1;

  for (let i = 0; i < n; i++) {
    let tx, ty;
    if (Math.random() < EDGE_BIAS) {
      // نقطة على المحيط: بها يُقرأ شكل البلاطة لا سحابة بلا حدّ
      const s = Math.random() * 2 * (r.width + r.height);
      if (s < r.width) { tx = left + s; ty = top; }
      else if (s < r.width + r.height) { tx = left + r.width; ty = top + (s - r.width); }
      else if (s < 2 * r.width + r.height) { tx = left + (2 * r.width + r.height - s); ty = top + r.height; }
      else { tx = left; ty = top + (2 * (r.width + r.height) - s); }
    } else {
      tx = left + Math.random() * r.width;
      ty = top + Math.random() * r.height;
    }

    const a = Math.random() * Math.PI * 2;
    const d = SPREAD * (0.35 + Math.random() * 0.65);

    parts.push({
      tx, ty,
      sx: tx + Math.cos(a) * d,
      sy: ty + Math.sin(a) * d - RISE * Math.random(),
      // الدور: من المركز إلى الأطراف، فتتشكّل البلاطة موجةً لا دفعةً
      delay: (Math.hypot(tx - cx, ty - cy) / half) * DUR * 0.34 + Math.random() * 70,
      t: 0,
      r: 0.7 + Math.random() * 1.5,
      // أبيض يميل قليلاً إلى زرقة الهوية في بعضها
      blue: Math.random() < 0.22,
    });
  }
  start();
}

/* ── الحلقة ── */
function frame(now) {
  raf = 0;
  const dt = Math.min(50, now - last);
  last = now;

  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'lighter';   // الحبيبات تتراكم ضوءاً

  const ox = scrollX, oy = scrollY;
  let alive = 0;

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    p.t += dt;
    const local = p.t - p.delay;
    if (local < 0) { alive++; continue; }        // لم يحن دورها بعد

    const k = local / DUR;
    if (k >= 1) continue;                        // هبطت: تُحذف في الكنس

    const e = easeOut(k);
    const x = (p.sx + (p.tx - p.sx) * e - ox) * dpr;
    const y = (p.sy + (p.ty - p.sy) * e - oy) * dpr;

    // خارج اللوحة؟ لا نرسم — لكنها تبقى حيّة حتى تكتمل
    if (x >= -8 && y >= -8 && x <= w + 8 && y <= h + 8) {
      // تسطع ثم تخفت عند الهبوط: تُقرأ استقراراً لا اختفاءً
      const alpha = k < 0.22 ? k / 0.22 : 1 - (k - 0.22) / 0.78;
      ctx.fillStyle = p.blue
        ? `rgba(150, 214, 244, ${alpha * 0.85})`
        : `rgba(255, 255, 255, ${alpha * 0.92})`;
      ctx.beginPath();
      ctx.arc(x, y, p.r * dpr, 0, 6.2832);
      ctx.fill();
    }
    alive++;
  }

  // كنس دوري: نحذف ما هبط بدل بناء مصفوفة كل إطار
  if (alive < parts.length * 0.6) {
    parts = parts.filter((p) => p.t - p.delay < DUR);
  }

  if (alive > 0) { raf = requestAnimationFrame(frame); return; }

  // لا شيء حيّ: نمسح ونتوقّف تماماً
  parts.length = 0;
  ctx.clearRect(0, 0, w, h);
  raf = 0;
}

function start() {
  if (raf) return;
  last = performance.now();
  raf = requestAnimationFrame(frame);
}

/** يوقف كل شيء ويمسح اللوحة — للتنقّل بين الرسمات. */
export function clearAll() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  parts.length = 0;
  if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export default { assemble, clearAll };
