// ============================================================
// liquid-glass.js — انكسار زجاجي حقيقي، لا محاكاة بالتمويه.
//
// الطريقة (نفس ما تفعله أنظمة التشغيل الحديثة):
//
//   1. نحسب «خريطة إزاحة»: صورة كل بكسل فيها يحمل متجّه إزاحة.
//      القناة الحمراء = الإزاحة الأفقية، والخضراء = الرأسية،
//      و128 يعني «لا إزاحة».
//
//   2. الخريطة تُبنى من هندسة العدسة: عند الحافّة يكون سطح الزجاج
//      منحنياً، فينكسر الضوء المارّ به حسب قانون سنيل. في المنتصف
//      السطح مستوٍ فلا انكسار.
//
//   3. feDisplacementMap يقرأ الخريطة ويزيح بكسلات الخلفية فعلياً،
//      فترى ما خلف الزجاج منحنياً عند الحوافّ — وهذا ما يميّز الزجاج
//      الحقيقي عن «مستطيل شفاف عليه blur».
//
//   4. ثلاث تمريرات بمقاييس متفاوتة قليلاً تفصل الطيف عند الحافّة
//      (الزيغ اللوني) — تفصيلة صغيرة لكنها التي تُقنع العين.
//
// الخرائط تُكيَّش حسب المقاس، فعشرات البلاطات المتشابهة تتشارك خريطة
// واحدة. والحساب في العامل الرئيسي مرة واحدة فقط عند تغيّر المقاس.
// ============================================================

const N_AIR = 1.0;
const N_GLASS = 1.48;
const cache = new Map();          // توقيع المقاس → { url, scale, id }
let defs = null;
let uid = 0;

/** دالة سطح «المربّع الدائري» — انتقال ناعم من الحافّة إلى المستوي. */
function surface(t) {
  const u = 1 - Math.min(1, Math.max(0, t));
  return Math.pow(1 - Math.pow(u, 4), 0.25);
}

/** مقدار الإزاحة عند نسبة `t` من عرض الحافّة (0 = الحدّ، 1 = المستوي). */
function refractAt(t, bezel) {
  const d = 0.0015;
  const slope = (surface(Math.min(1, t + d)) - surface(Math.max(0, t - d))) / (2 * d);
  const theta1 = Math.atan(slope);                       // زاوية السقوط على السطح المائل
  const s = (N_AIR / N_GLASS) * Math.sin(theta1);
  if (Math.abs(s) >= 1) return 0;                        // انعكاس داخلي كلّي
  const theta2 = Math.asin(s);
  return Math.tan(theta1 - theta2) * bezel;              // الإزاحة بالبكسل
}

/** أقرب مسافة إلى حدّ مستطيل بزوايا دائرية، وأقرب اتجاه للداخل. */
function edgeInfo(x, y, w, h, r) {
  // المسافة إلى حدّ مستطيل دائري: حيلة SDF المعروفة
  const qx = Math.abs(x - w / 2) - (w / 2 - r);
  const qy = Math.abs(y - h / 2) - (h / 2 - r);
  const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
  const outside = Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
  const dist = -outside;                                  // موجب داخل الشكل

  // الاتجاه: تدرّج دالة المسافة، محسوب بفروق محدودة
  let nx, ny;
  if (qx > 0 && qy > 0) { nx = ax; ny = ay; }             // منطقة الزاوية
  else if (qx > qy) { nx = Math.sign(x - w / 2); ny = 0; }
  else { nx = 0; ny = Math.sign(y - h / 2); }
  if (qx > 0 && qy > 0) {
    const L = Math.hypot(nx, ny) || 1;
    nx = (nx / L) * Math.sign(x - w / 2);
    ny = (ny / L) * Math.sign(y - h / 2);
  }
  return { dist, nx, ny };
}

/**
 * يبني خريطة الإزاحة لمقاس معيّن.
 * @returns {{url:string, scale:number}}
 */
const MAX_PIXELS = 360_000;      // سقف تكلفة بناء الخريطة

function buildMap(w, h, radius, bezel) {
  // دقّة مخفَّضة للبلاطات الكبيرة — الخريطة تُمدّد لاحقاً فلا يُلاحَظ فرق
  const q = Math.min(1, Math.sqrt(MAX_PIXELS / (w * h)));
  const mw = Math.max(16, Math.round(w * q));
  const mh = Math.max(16, Math.round(h * q));
  const mr = radius * q;
  const mb = Math.max(3, bezel * q);

  const cv = document.createElement('canvas');
  cv.width = mw; cv.height = mh;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const img = ctx.createImageData(mw, mh);
  const px = img.data;
  const w2 = mw, h2 = mh, radius2 = mr, bezel2 = Math.round(mb);

  // أقصى إزاحة — نحتاجها لتطبيع القيم ثم لإعادة تحجيمها في المرشّحة
  let maxMag = 0;
  // الإزاحة تُحسب بوحدات الشاشة (bezel الحقيقي) لا بوحدات الخريطة
  const lut = new Float32Array(bezel2 + 2);
  for (let i = 0; i <= bezel2; i++) {
    lut[i] = refractAt(i / bezel2, bezel);
    if (Math.abs(lut[i]) > maxMag) maxMag = Math.abs(lut[i]);
  }
  if (maxMag < 0.01) maxMag = 0.01;

  for (let y = 0; y < h2; y++) {
    for (let x = 0; x < w2; x++) {
      const o = (y * w2 + x) * 4;
      const { dist, nx, ny } = edgeInfo(x + .5, y + .5, w2, h2, radius2);

      let vx = 0, vy = 0;
      if (dist >= 0 && dist < bezel2) {
        const mag = lut[Math.round(dist)] / maxMag;        // مطبَّع إلى ‎-1..1
        vx = nx * mag;
        vy = ny * mag;
      }
      px[o]     = Math.round(128 + vx * 127);              // R = الإزاحة الأفقية
      px[o + 1] = Math.round(128 + vy * 127);              // G = الإزاحة الرأسية
      px[o + 2] = 128;
      px[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { url: cv.toDataURL('image/png'), scale: maxMag };
}

/** حاوية المرشّحات — واحدة لكل صفحة. */
function defsRoot() {
  if (defs && defs.isConnected) return defs;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  Object.assign(svg.style, {
    position: 'fixed', inlineSize: '0', blockSize: '0',
    overflow: 'hidden', pointerEvents: 'none', opacity: '0',
  });
  defs = document.createElementNS(NS, 'defs');
  svg.append(defs);
  document.body.append(svg);
  return defs;
}

/**
 * يسجّل مرشّحة لمقاس معيّن ويعيد معرّفها.
 * ثلاث تمريرات بمقاييس متقاربة → زيغ لوني عند الحافّة.
 */
function ensureFilter(w, h, radius, bezel) {
  const key = `${w}x${h}r${radius}b${bezel}`;
  const hit = cache.get(key);
  if (hit) return hit.id;

  const { url, scale } = buildMap(w, h, radius, bezel);
  const id = `lg-${++uid}`;
  const NS = 'http://www.w3.org/2000/svg';

  const f = document.createElementNS(NS, 'filter');
  f.setAttribute('id', id);
  f.setAttribute('color-interpolation-filters', 'sRGB');
  // filterUnits الافتراضي objectBoundingBox: المنطقة = صندوق العنصر بالضبط
  f.setAttribute('x', '0%'); f.setAttribute('y', '0%');
  f.setAttribute('width', '100%'); f.setAttribute('height', '100%');
  // ⚠️ كل بدائية تحتاج منطقتها الفرعية صريحة. بدونها يقصّ Chromium
  //    النواتج الوسيطة إلى مستطيل أصغر فيظهر حدّ حادّ داخل البلاطة —
  //    ثبت ذلك بالتجربة: تمريرة واحدة نظيفة، وثلاث بلا مناطق صريحة تُنتج الحدّ.
  const SUB = 'x="0%" y="0%" width="100%" height="100%"';
  f.innerHTML = `
    <feImage href="${url}" ${SUB} preserveAspectRatio="none" result="map"/>
    <feDisplacementMap ${SUB} in="SourceGraphic" in2="map" scale="${(scale * 1.07).toFixed(2)}"
                       xChannelSelector="R" yChannelSelector="G" result="red"/>
    <feDisplacementMap ${SUB} in="SourceGraphic" in2="map" scale="${scale.toFixed(2)}"
                       xChannelSelector="R" yChannelSelector="G" result="green"/>
    <feDisplacementMap ${SUB} in="SourceGraphic" in2="map" scale="${(scale * 0.93).toFixed(2)}"
                       xChannelSelector="R" yChannelSelector="G" result="blue"/>
    <feColorMatrix ${SUB} in="red"   type="matrix" result="rC"
      values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/>
    <feColorMatrix ${SUB} in="green" type="matrix" result="gC"
      values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"/>
    <feColorMatrix ${SUB} in="blue"  type="matrix" result="bC"
      values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"/>
    <feBlend ${SUB} in="rC" in2="gC" mode="screen" result="rg"/>
    <feBlend ${SUB} in="rg" in2="bC" mode="screen"/>`;

  defsRoot().append(f);
  cache.set(key, { id, url, scale });
  return id;
}

/** هل يدعم المتصفح تطبيق مرشّحة SVG على الخلفية؟ */
export const supported = (() => {
  if (typeof CSS === 'undefined' || !CSS.supports) return false;
  return CSS.supports('backdrop-filter', 'url(#x)')
      || CSS.supports('-webkit-backdrop-filter', 'url(#x)');
})();

/** مقاسات مقرّبة — بلاطات متقاربة تتشارك خريطة واحدة. */
const snap = (v, step) => Math.max(step, Math.round(v / step) * step);
const SNAP = 4;

export default {
  name: 'liquid-glass',
  heavy: true,

  init(node, o = {}) {
    if (!supported) return;                       // الاحتياط في CSS يتكفّل

    const bezelWish = Number(o.bezel) || 26;
    let applied = '';

    const apply = () => {
      const r = node.getBoundingClientRect();
      if (r.width < 40 || r.height < 40) return;

      const w = snap(r.width, SNAP);
      const h = snap(r.height, SNAP);
      const cs = getComputedStyle(node);
      const radius = Math.min(
        Math.round(parseFloat(cs.borderTopLeftRadius) || 22),
        Math.floor(Math.min(w, h) / 2),
      );
      const bezel = Math.max(8, Math.min(bezelWish, Math.floor(Math.min(w, h) / 4)));

      const id = ensureFilter(w, h, radius, bezel);
      if (id === applied) return;
      applied = id;

      const blur = o.blur ?? 14;
      const value = `blur(${blur}px) saturate(180%) url(#${id})`;
      node.style.backdropFilter = value;
      node.style.webkitBackdropFilter = value;
      node.classList.add('is-liquid');
    };

    // القياس بعد التخطيط، ثم عند كل تغيّر مقاس
    requestAnimationFrame(apply);
    const ro = new ResizeObserver(apply);
    ro.observe(node);
    node.__liquid = { ro };
  },

  destroy(node) {
    node.__liquid?.ro.disconnect();
    node.style.removeProperty('backdrop-filter');
    node.style.removeProperty('-webkit-backdrop-filter');
    node.classList.remove('is-liquid');
    delete node.__liquid;
  },
};
