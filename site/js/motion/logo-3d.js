// ============================================================
// logo-3d.js — الشعار مجسّماً، وتفتّته فيزياء حقيقية.
//
// ما الذي تغيّر عن المحرّك المسطّح (logo-mark.js)؟
//
//   الشعار لم يعد صورة تُرسم فوقها نقاط. صار جسماً مبثوقاً من
//   مسارات logo-shape.js، والجسيمات تُعاين من سطحه هو — بترجيح
//   مساحة المثلثات — فلكلٍّ منها موضع بيت حقيقي في الفراغ، له عمق.
//
// ── العودة: لا تلاشٍ، بل هبوط ──
//
//   الخطأ الذي كان: الجسيمات تخفت والمجسّم يظهر بمؤقّت. فالعين
//   ترى تبديلاً، لا عودة. الآن المؤقّت لا يقرّر شيئاً في العودة:
//
//     1  نابض مخمَّد حرجاً يسحب كل جسيمة إلى بيتها — بلا تجاوز،
//        فتهبط ولا تتأرجح.
//     2  نقيس متوسّط بُعد الجسيمات عن بيوتها كل إطار.
//     3  ظهور المجسّم مربوط بهذا القياس لا بالزمن.
//
//   فحين يظهر المجسّم تكون الجسيمات فوقه بالضبط — التبديل يقع
//   في اللحظة التي لا يمكن رؤيته فيها. هذا هو «التجمّع».
//
// ── الملاحقة سريعة ──
//
//   ثابت زمن 90ms للميلان خلف المؤشّر: يلحقك، لا يتباطأ خلفك.
//
// ── الميزانية ──
//
//   three.js يُحمَّل عند أول ظهور للشعار فقط، لا في إقلاع الصفحة.
//   بلا WebGL أو مع «تقليل الحركة» نسقط إلى المحرّك المسطّح كما هو.
//   الحلقة تقف تماماً حين يخرج الشعار من الشاشة أو يُخفى التبويب.
// ============================================================
import prefs from './prefs.js';
import flat from './logo-mark.js';
import { VIEW, SHAPES, isBlue } from './logo-shape.js';

const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.185.1/three.module.min.js';

/* ── الفيزياء ──
   مكشوفة عمداً ككائن واحد: preview/logo-3d.html يعدّلها حيّةً
   بمساطر، فما يُضبط هناك يُنقل إلى هنا رقماً رقماً.
   ⚠️ التخميد حرِج لا أقلّ: النابض الأقلّ تخميداً يتجاوز البيت ويعود،
      فيبدو الشعار مطّاطاً لا صلباً. */
export const TUNE = {
  track:    0.09,   // ث — زمن ملاحقة الميلان للمؤشّر (أصغر = ألحق)
  tiltX:    0.40,   // راد — أقصى ميلان رأسي
  tiltY:    0.58,   // راد — أقصى ميلان أفقي
  spin:     0.15,   // راد/ث — تمايل خامل بطيء
  omega:    11,     // تردّد نابض العودة (زمن الهبوط ≈ 4/ω)
  drag:     0.986,  // مقاومة الهواء لكل 1/60 ث أثناء الطيران الحرّ
  holdMs:   520,    // طيران حرّ قبل أن يمسك النابض
  burst:    1050,   // قوة الانفجار الكامل عند النقر
  spread:   210,    // نصيب العشوائية من الانفجار
  burstFade: 0.55,  // ث — انحسار الانفجار بعد فترة الإمساك
  size:     9,      // قطر الجسيمة بوحدات المجسّم
  wind:     0.9,    // دفع السحب على ما هو مُفعَّل

  /* ── الحقل الموضعي تحت المؤشّر ──
     التفاعل الأساسي: لا نقرة ولا تصويب. مجرّد مرور الماوس أو الإصبع
     يحوّل ما تحته إلى جسيمات ويعيده خلفه.

     ⚠️ الدفع ضعيف عمداً. جرّبناه قوياً فطارت الجسيمات بعيداً وتُرك
        مكانها خالياً — فتُقرأ فجوةً محفورة في الشعار لا تحوّلاً.
        حين تبقى الجسيمة قرب موضعها ترفّ مكانها، فترى المادّة نفسها
        وقد صارت غباراً: هذا هو «التحوّل». */
  fxR:      0.46,   // نصف قطر التأثير — متوسط: كان 0.30 فبدا صغيراً
  fxRise:   0.07,   // ث — تحوّل ما يدخل الحقل (ناعم لا مفاجئ)
  fxFall:   0.45,   // ث — عودة ما خرج منه (أبطأ، فيبقى أثر)
  fxPush:   240,    // رفّة جانبية خفيفة — لا قذف
  fxLift:   170,    // ارتفاع طفيف عن السطح
  fxSwirl:  1.6,    // دوران حول موضع المؤشّر: يمنع الجمود بلا تشتيت
  fxKeep:   0.17,   // ما يبقى من السطح في قلب الحقل — بلا هذا يصير ثقباً
  grain:    1.7,    // خشونة حافّة التحوّل (أكبر = حبيبات أدقّ)
  idleMs:   2600,   // إن سكن المؤشّر هذا الزمن يهدأ الحقل

  /* ── الإضاءة ──
     مأخوذة من الصورة المرجعية الجديدة: ضوء رئيسي من أعلى اليسار،
     جسم أبيض لمّاع، وأزرق نقيّ لا يبهت. يضبطها المشرف من اللوحة. */
  lightX:   -0.55,  // موضع الضوء أفقياً، نسبةً إلى نصف قطر المجسّم
  lightY:    0.70,  // وعمودياً
  lightZ:    1.00,  // وأمام/خلف
  lightPow:  2.10,  // شدّته
  lightHue:  0,     // درجة تلوينه (0 = أبيض؛ تُضبط بمنتقي لون)
  envPow:    1.15,  // شدّة انعكاس المحيط
  gloss:     0.14,  // لمعان الجسم (خشونة أقلّ = ألمع)
};

/* لون الضوء الافتراضي — يتجاوزه المشرف بمفتاح ثيم. */
const LIGHT_COLOR = 0xffffff;

/* ── جسر لوحة المشرف ──
   ما يضبطه المشرف يُكتب متغيّراتِ CSS على الجذر (core/theme.js)،
   ونقرؤه هنا عند التركيب. فالمسار واحد: نفس الحفظ ونفس المعاينة
   الحيّة داخل iframe اللوحة، بلا قناة ثانية نصونها. */
const THEME_MAP = {
  fxR: ['--logo-fx-r', 0.05, 1],
  fxPush: ['--logo-fx-push', 0, 6000],
  fxLift: ['--logo-fx-lift', 0, 4000],
  fxRise: ['--logo-fx-rise', 0.005, 1],
  fxFall: ['--logo-fx-fall', 0.03, 3],
  track: ['--logo-track', 0.01, 1],
  tiltY: ['--logo-tilt', 0, 2],
  spin: ['--logo-spin', 0, 2],
  grain: ['--logo-grain', 0.1, 6],
  lightX: ['--logo-light-x', -3, 3],
  lightY: ['--logo-light-y', -3, 3],
  lightZ: ['--logo-light-z', -3, 3],
  lightPow: ['--logo-light-power', 0, 8],
  envPow: ['--logo-env-power', 0, 4],
  gloss: ['--logo-gloss', 0.01, 0.8],
};

/** #RRGGBB → عدد. القيمة الفاسدة تُتجاهَل. */
function hexNum(v) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(v).trim());
  return m ? parseInt(m[1], 16) : null;
}

/** يقرأ تجاوزات المشرف من الجذر. القيمة الفاسدة تُتجاهَل لا تُعطِّل. */
function tuneFromTheme() {
  const cs = getComputedStyle(document.documentElement);
  const out = { ...TUNE };
  for (const [key, [varName, lo, hi]] of Object.entries(THEME_MAP)) {
    const raw = cs.getPropertyValue(varName).trim();
    if (!raw) continue;
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) continue;
    out[key] = Math.min(hi, Math.max(lo, n));
  }
  // الميلان الرأسي يتبع الأفقي بنسبة ثابتة — مسطرة واحدة تكفي المشرف
  out.tiltX = out.tiltY * (TUNE.tiltX / TUNE.tiltY);
  const p = parseFloat(cs.getPropertyValue('--logo-particles'));
  out.particles = Number.isFinite(p) ? Math.min(24000, Math.max(800, p)) : null;
  out.lightColor = hexNum(cs.getPropertyValue('--logo-light-color')) ?? LIGHT_COLOR;
  return out;
}

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** تقارب أسّي مستقلّ عن معدّل الإطارات. */
const approach = (dt, tau) => 1 - Math.exp(-dt / tau);

let threeMod = null;
function loadThree() {
  if (!threeMod) threeMod = import(/* webpackIgnore: true */ THREE_URL);
  return threeMod;
}

function webglOk() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

/* ════════════════ المسار → شكل ════════════════ */
function shapeFrom(THREE, d) {
  const s = new THREE.Shape();
  const cx = VIEW.w / 2, cy = VIEW.h / 2;
  const X = (x) => x - cx, Y = (y) => cy - y;      // SVG ينزل، three يصعد
  for (const t of d.match(/[MCZ][^MCZ]*/gi) || []) {
    const k = t[0].toUpperCase();
    if (k === 'Z') { s.closePath(); continue; }
    const n = (t.slice(1).match(/-?\d*\.?\d+/g) || []).map(Number);
    if (k === 'M') { s.moveTo(X(n[0]), Y(n[1])); continue; }
    for (let i = 0; i + 5 < n.length; i += 6) {
      s.bezierCurveTo(X(n[i]), Y(n[i + 1]), X(n[i + 2]), Y(n[i + 3]), X(n[i + 4]), Y(n[i + 5]));
    }
  }
  return s;
}

/* ════════════════ بيئة الانعكاس ════════════════
   مولَّدة برمجياً: أربع شرائح ضوء استوديو، إحداها بلون الهوية
   فتحمل الانعكاسات زرقة الشعار نفسه. لا ملفّات خارجية. */
function studioEnv(THREE, renderer) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, '#ffffff');
  sky.addColorStop(.22, '#dfe8f4');
  sky.addColorStop(.46, '#8fa2b8');
  sky.addColorStop(.58, '#39434f');
  sky.addColorStop(1, '#0b0e13');
  g.fillStyle = sky; g.fillRect(0, 0, 512, 256);

  const strip = (x, w, h, col) => {
    const s = g.createLinearGradient(x, 0, x + w, 0);
    s.addColorStop(0, 'rgba(255,255,255,0)');
    s.addColorStop(.5, col);
    s.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = s; g.fillRect(x, 0, w, h);
  };
  strip(20, 130, 170, 'rgba(255,255,255,1)');       // رئيسي
  strip(210, 85, 150, 'rgba(236,246,255,.9)');      // ملء
  strip(375, 105, 180, 'rgba(150,220,248,.95)');    // لمسة الهوية
  strip(145, 55, 115, 'rgba(255,246,228,.7)');      // وميض دافئ

  const floor = g.createLinearGradient(0, 165, 0, 256);
  floor.addColorStop(0, 'rgba(175,195,220,.42)');
  floor.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = floor; g.fillRect(0, 165, 512, 91);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(renderer);
  pm.compileEquirectangularShader();
  const env = pm.fromEquirectangular(tex).texture;
  pm.dispose(); tex.dispose();
  return env;
}

/* ════════════════ المحرّك ════════════════ */
export function mount(THREE, host, opts = {}) {
  const img = host.querySelector('.logo-mark__img');
  const canvas = host.querySelector('.logo-mark__fx');
  if (!canvas) return null;

  const T = tuneFromTheme();          // ثوابت الفيزياء بعد تجاوزات المشرف
  const intensity = clamp(Number(opts.intensity ?? 1), 0, 1);
  const low = prefs.lowPower;
  const base = T.particles ?? (low ? 6000 : prefs.touch ? 10000 : 17000);
  const N = Math.round(base * (0.5 + intensity * 0.5));

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, alpha: true,
    powerPreference: low ? 'low-power' : 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, low ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.environment = studioEnv(THREE, renderer);
  const camera = new THREE.PerspectiveCamera(34, 1, 1, 5000);

  /* الضوء الرئيسي يضبط المشرف موضعه ولونه وشدّته؛ الحافّ والملء
     ثابتان لأنهما يحفظان حجم المجسّم لا يغيّران مزاجه. */
  scene.add(new THREE.AmbientLight(0xffffff, .34));
  const key = new THREE.DirectionalLight(T.lightColor ?? LIGHT_COLOR, T.lightPow);
  const rim = new THREE.DirectionalLight(0x8fdcf7, .55); rim.position.set(340, -180, -300);
  const fil = new THREE.DirectionalLight(0xffffff, .34); fil.position.set(180, 260, 300);
  scene.add(key, rim, fil);

  const group = new THREE.Group();
  const solid = new THREE.Group();
  group.add(solid);
  scene.add(group);

  /* ════════ حقل التفكّك ════════
     مصدر واحد للحقيقة يقرؤه طرفان: الشيدر يحذف به شظايا السطح،
     وحلقة الفيزياء تحرّك به الجسيمات. فما يختفي من المجسّم يظهر
     جسيماتٍ في المكان نفسه — لا فجوة ولا ازدواج. */
  const FX = {
    uFxPos:   { value: new THREE.Vector2(1e6, 1e6) },  // موضع المؤشّر محلياً
    uFxR:     { value: 120 },                          // نصف قطر التأثير
    uBurst:   { value: 0 },                            // 0..1 للانفجار الكامل
    uModelR:  { value: 300 },
    uGrain:   { value: T.grain },
  };

  /* ── الخامتان ──
     الأزرق ليس معدناً: المعدن يأخذ لونه من انعكاسه لا من نفسه، فلو
     جعلناه معدنياً ابيضّ تحت ضوء الاستوديو وضاع أزرق الهوية. هو في
     الأصل سطح لمّاع ملوّن — أي عازل بطلاء صافٍ فوقه.
     الفضّي عكسه: كروم حقيقي، لونه من المحيط، وخشونة تكفي ليبقى فيه
     رماد بدل أن يصير أبيض مسطّحاً. */
  /* ── الخامتان، مطابقتان للصورة المرجعية الجديدة ──
     الجسم لم يعد كروماً رمادياً: صار أبيض لمّاعاً — عازلاً بطلاء
     صافٍ، لونه من نفسه لا من انعكاسه، فلا يبهت ولا يسودّ.
     والأزرق أنصع: 0x0a9ad3 بدل 0x0e86b4، كما في الصورة. */
  const mats = SHAPES.map((sh) => isBlue(sh.rgb)
    ? new THREE.MeshPhysicalMaterial({ color: 0x0a9ad3, metalness: .10, roughness: T.gloss + .06,
        clearcoat: 1, clearcoatRoughness: .04, envMapIntensity: T.envPow, reflectivity: .6 })
    : new THREE.MeshPhysicalMaterial({ color: 0xf4f6f8, metalness: .06, roughness: T.gloss,
        clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: T.envPow, reflectivity: .55 }));

  /* حقن الحذف في شيدر الخامة القياسية.
     ⚠️ discard لا opacity: الشفافية تُظهر ما خلف السطح فيبان الوجه
        الخلفي للمجسّم، أما الحذف فيقتطع السطح فعلاً كما لو تفتّت. */
  for (const m of mats) {
    m.customProgramCacheKey = () => 'logo-dissolve';
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, FX);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vLocalXY;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalXY = position.xy;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec2 vLocalXY;
uniform vec2 uFxPos; uniform float uFxR, uBurst, uModelR, uGrain, uKeep;
// ضوضاء رخيصة: تجعل حافّة التفكّك حبيبات لا دائرة مقصوصة بمقصّ
float lgHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.545); }`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
{
  float d  = length(vLocalXY - uFxPos);
  float pf = 1.0 - smoothstep(uFxR * 0.42, uFxR, d);          // قرب المؤشّر
  float rr = length(vLocalXY) / max(1.0, uModelR);
  float bw = clamp(uBurst * 1.55 - rr * 0.55, 0.0, 1.0);      // موجة الانفجار
  // uKeep يمنع الحذف الكامل: يبقى نسيج رقيق من السطح حتى في القلب،
  // فيُقرأ الموضع مادّةً تتفكّك لا فجوةً سوداء
  float a  = min(max(pf, bw), 1.0 - uKeep);
  if (a > 0.002 && a > lgHash(floor(vLocalXY * uGrain)) * 0.94 + 0.03) discard;
}`);
    };
  }

  /* السماكة والشطف نسبةً إلى مقاس الشعار لا رقمين ثابتين: الأصل
     تغيّر مرّة من ٥٤٠ عرضاً إلى ٩٢٢، فبدا المجسّم مسطّحاً بسماكة
     كانت تناسب الأصغر. النسبة تنجو من أي تغيير قادم. */
  const DEPTH = VIEW.w * 0.086, BEVEL = VIEW.w * 0.013;
  const meshes = SHAPES.map((sh, i) => {
    const g = new THREE.ExtrudeGeometry(shapeFrom(THREE, sh.d), {
      depth: DEPTH, curveSegments: low ? 8 : 14,
      bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL * .8,
      bevelOffset: 0, bevelSegments: low ? 2 : 4,
    });
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mats[i]);
    solid.add(m);
    return m;
  });

  // توسيط حول مركز الكتلة الحقيقي، ثم قياس أنصاف الصندوق للتأطير
  const box = new THREE.Box3();
  for (const m of meshes) { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox); }
  const ctr = box.getCenter(new THREE.Vector3());
  for (const m of meshes) m.geometry.translate(-ctr.x, -ctr.y, -ctr.z);
  const sz = box.getSize(new THREE.Vector3());
  const HALF_W = sz.x / 2, HALF_H = sz.y / 2;
  const RADIUS = Math.hypot(sz.x, sz.y) / 2;      // مرجع مقياس، لا تأطير
  FX.uModelR.value = RADIUS;
  key.position.set(T.lightX * RADIUS * 2, T.lightY * RADIUS * 2, T.lightZ * RADIUS * 2);
  FX.uFxR.value = RADIUS * T.fxR;

  /* ── الجسيمات: عيّنات من سطح المجسّم بترجيح المساحة ── */
  const home = new Float32Array(N * 3), pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3), seed = new Float32Array(N * 3);
  const ord = new Float32Array(N), act = new Float32Array(N), col = new Float32Array(N * 3);

  (function sample() {
    const parts = [];
    let total = 0;
    for (const m of meshes) {
      const p = m.geometry.attributes.position.array;
      const tris = [];
      let area = 0;
      for (let i = 0; i < p.length; i += 9) {
        const ax = p[i], ay = p[i + 1], az = p[i + 2];
        const ux = p[i + 3] - ax, uy = p[i + 4] - ay, uz = p[i + 5] - az;
        const vx = p[i + 6] - ax, vy = p[i + 7] - ay, vz = p[i + 8] - az;
        const a = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) * .5;
        if (a > 0) { area += a; tris.push([ax, ay, az, ux, uy, uz, vx, vy, vz, area]); }
      }
      if (area > 0) { parts.push({ tris, area, c: m.material.color }); total += area; }
    }
    const pick = (tris, t) => {
      let lo = 0, hi = tris.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (tris[m][9] < t) lo = m + 1; else hi = m; }
      return tris[lo];
    };
    let k = 0, maxR = 1;
    parts.forEach((part, pi) => {
      const end = pi === parts.length - 1 ? N : Math.min(N, k + Math.round(N * part.area / total));
      for (; k < end; k++) {
        const t = pick(part.tris, Math.random() * part.area);
        let u = Math.random(), v = Math.random();
        if (u + v > 1) { u = 1 - u; v = 1 - v; }
        const j = k * 3;
        const x = t[0] + t[3] * u + t[6] * v;
        const y = t[1] + t[4] * u + t[7] * v;
        const z = t[2] + t[5] * u + t[8] * v;
        home[j] = pos[j] = x; home[j + 1] = pos[j + 1] = y; home[j + 2] = pos[j + 2] = z;
        seed[j] = Math.random() * 2 - 1;
        seed[j + 1] = Math.random() * 2 - 1;
        seed[j + 2] = Math.random() * 2 - 1;
        const w = Math.random() * .45;                 // انحياز نحو الأبيض: بريق
        col[j] = part.c.r + (1 - part.c.r) * w;
        col[j + 1] = part.c.g + (1 - part.c.g) * w;
        col[j + 2] = part.c.b + (1 - part.c.b) * w;
        const r = Math.hypot(x, y);
        if (r > maxR) maxR = r;
      }
    });
    // نصف القطر المنسوب — به يحسب الجسيم موجة الانفجار كما يحسبها الشيدر
    for (let i = 0; i < N; i++) ord[i] = Math.hypot(home[i * 3], home[i * 3 + 1]) / maxR;
  })();

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  pGeo.setAttribute('aAct', new THREE.BufferAttribute(act, 1));
  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uSize: { value: T.size }, uProj: { value: 600 } },
    vertexShader: `
      attribute vec3 aColor; attribute float aAct;
      varying vec3 vC; varying float vD, vA;
      uniform float uSize, uProj;
      void main(){
        vC = aColor; vA = aAct;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vD = -mv.z;
        gl_PointSize = clamp(uSize * uProj / max(120.0, vD), 1.0, 40.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vC; varying float vD, vA;
      void main(){
        if (vA < 0.01) discard;
        vec2 q = gl_PointCoord - .5;
        float d = dot(q, q);
        if (d > .25) discard;
        float a = smoothstep(.25, .02, d);
        float fog = clamp(1.9 - vD / 3200.0, .3, 1.0);
        // قلب أنصع من الحافّة: تُقرأ الجسيمة حبّة ضوء لا مربّعاً باهتاً
        vec3 c = mix(vC, vec3(1.0), a * 0.45) * 1.25;
        gl_FragColor = vec4(c, a * vA * fog);
      }`,
  });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  group.add(points);

  /* ── التأطير ── */
  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vFov = camera.fov * Math.PI / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const hostW = host.getBoundingClientRect().width || w;
    const over = Math.min(2, Math.max(1, w / hostW));
    // ⚠️ نؤطّر بنصفَي الصندوق لا بقطر الدائرة المحيطة: القطر يصلح
    //    لجسم كرويّ، وهنا يجعل الشعار أصغر من صندوقه بنحو ٢٣٪ —
    //    أي أصغر من الصورة التي كانت مكانه.
    camera.position.z = Math.max(
      HALF_H / Math.tan(vFov / 2),
      HALF_W / Math.tan(hFov / 2),
    ) * over * 1.06;
    camera.updateProjectionMatrix();
    pMat.uniforms.uProj.value = (h * .5) / Math.tan(vFov / 2);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  /* ── الحالة ── */
  let burstAmt = 0, burstUntil = 0;
  let rx = 0, ry = 0, tx = 0, ty = 0, spin = 0;
  let ndcX = 2, ndcY = 2;              // خارج الشاشة = لا مؤشّر
  let pointerLive = false, lastPointer = 0;
  let px = 1e6, py = 1e6;              // موضع المؤشّر في فضاء المجسّم
  let dragging = false, lastX = 0, lastY = 0;
  let onScreen = true, running = false, raf = 0, last = 0;

  const ray = new THREE.Ray();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  const rc = new THREE.Raycaster();

  /** يسقط المؤشّر على مستوى المجسّم بإحداثياته المحلّية. */
  function projectPointer() {
    if (ndcX > 1.5) { px = py = 1e6; return; }
    group.updateMatrixWorld();
    rc.setFromCamera({ x: ndcX, y: ndcY }, camera);
    inv.copy(group.matrixWorld).invert();
    ray.copy(rc.ray).applyMatrix4(inv);
    if (ray.intersectPlane(plane, hit)) { px = hit.x; py = hit.y; }
    else { px = py = 1e6; }
  }

  function burst(power = 1) {
    burstAmt = Math.min(1.6, burstAmt + power);
    burstUntil = performance.now() + T.holdMs;
    const F = T.burst * power, S = T.spread * power;
    for (let i = 0; i < N; i++) {
      const j = i * 3;
      const d = Math.hypot(home[j], home[j + 1], home[j + 2]) || 1;
      const k = F / (1 + d * .012);
      vel[j] += (home[j] / d) * k + seed[j] * S;
      vel[j + 1] += (home[j + 1] / d) * k + seed[j + 1] * S;
      vel[j + 2] += (home[j + 2] / d) * k + seed[j + 2] * S * 1.4;
    }
    start();
  }

  function step(now) {
    raf = 0;
    const dt = Math.min(.05, (now - last) / 1000);
    last = now;

    // المؤشّر يهدأ إن سكن طويلاً: لا يبقى ثقبٌ محفور في الشعار
    if (pointerLive && now - lastPointer > T.idleMs) pointerLive = false;
    projectPointer();
    const live = pointerLive && px < 1e5;
    FX.uFxPos.value.set(live ? px : 1e6, live ? py : 1e6);

    // الانفجار ينحسر بعد فترة الإمساك
    if (now > burstUntil && burstAmt > 0) {
      burstAmt -= dt / T.burstFade;
      if (burstAmt < 0) burstAmt = 0;
    }
    FX.uBurst.value = Math.min(1, burstAmt);

    /* ── الفيزياء ──
       نفس المعادلة التي يحسبها الشيدر: ما يُحذف من السطح هو ما يُضاء
       من الجسيمات. الاختلاف بينهما يعني ثقباً أو ازدواجاً. */
    const R = FX.uFxR.value, R0 = R * 0.42;
    const bAmt = FX.uBurst.value;
    const riseA = approach(dt, T.fxRise);
    const fallA = approach(dt, T.fxFall);
    const drag = Math.pow(T.drag, dt * 60);
    let anyAct = false;

    for (let i = 0; i < N; i++) {
      const j = i * 3;
      // نصيب هذا الجسيم من الحقل — يُقاس من بيته فيثبت الحقل مكانه
      let pf = 0;
      if (live) {
        const dx = home[j] - px, dy = home[j + 1] - py;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < R) pf = d <= R0 ? 1 : 1 - smooth((d - R0) / (R - R0));
      }
      const bw = clamp(bAmt * 1.55 - ord[i] * 0.55);
      const target = pf > bw ? pf : bw;

      const a0 = act[i];
      act[i] = a0 + (target - a0) * (target > a0 ? riseA : fallA);
      const a = act[i];
      if (a > 0.004) anyAct = true;

      if (a > 0.004 || vel[j] || vel[j + 1] || vel[j + 2]) {
        // دفع بعيداً عن المؤشّر بقدر نصيب الجسيم من الحقل
        if (pf > 0.01) {
          const dx = pos[j] - px, dy = pos[j + 1] - py;
          const d = Math.hypot(dx, dy) || 1;
          const f = T.fxPush * pf * dt;
          // نصفها طرد ونصفها دوران: الطرد وحده يفرّغ المكان، والدوران
          // وحده يجمّدها في مدار. معاً ترفّ حول موضعها
          vel[j] += ((dx / d) * f) + (-dy / d) * f * T.fxSwirl;
          vel[j + 1] += ((dy / d) * f) + (dx / d) * f * T.fxSwirl;
          vel[j + 2] += (seed[j + 2] * 0.7 + 0.5) * T.fxLift * pf * dt;
        }
        // النابض يشدّ إلى البيت، ويضعف بقدر ما الجسيم مُفعَّل
        const gi = 1 - a * 0.92;
        const k = T.omega * T.omega * gi;
        const c = 2 * T.omega * Math.sqrt(gi > 1e-4 ? gi : 1e-4);
        const ex = home[j] - pos[j], ey = home[j + 1] - pos[j + 1], ez = home[j + 2] - pos[j + 2];
        vel[j] = (vel[j] + (ex * k - vel[j] * c) * dt) * drag;
        vel[j + 1] = (vel[j + 1] + (ey * k - vel[j + 1] * c) * dt) * drag;
        vel[j + 2] = (vel[j + 2] + (ez * k - vel[j + 2] * c) * dt) * drag;
        pos[j] += vel[j] * dt;
        pos[j + 1] += vel[j + 1] * dt;
        pos[j + 2] += vel[j + 2] * dt;
        // استقرار تامّ: نصفّر السرعة كي لا تبقى الحلقة تحسب أصفاراً
        if (a < 0.004 && Math.abs(ex) < .3 && Math.abs(ey) < .3 && Math.abs(ez) < .3
            && Math.abs(vel[j]) < .6 && Math.abs(vel[j + 1]) < .6 && Math.abs(vel[j + 2]) < .6) {
          pos[j] = home[j]; pos[j + 1] = home[j + 1]; pos[j + 2] = home[j + 2];
          vel[j] = vel[j + 1] = vel[j + 2] = 0;
        }
      }
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.aAct.needsUpdate = true;
    points.visible = anyAct;

    /* ── الميلان: ملاحقة سريعة ── */
    const t = approach(dt, T.track);
    rx += (tx - rx) * t;
    ry += (ty - ry) * t;
    spin += dt * T.spin;
    group.rotation.x = rx + Math.sin(now / 2600) * .04;
    group.rotation.y = ry + Math.sin(spin) * .16;
    group.position.y = Math.sin(now / 1900) * RADIUS * .022;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(step);
  }

  function start() {
    if (running || !onScreen || document.hidden) return;
    running = true; last = performance.now();
    raf = requestAnimationFrame(step);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  /* ── التفاعل ──
     الاستماع على النافذة كلها: المؤثّر يستجيب لمرور الماوس ولو لم
     يقصده أحد، وهذا هو المطلوب — لا نقرة ولا تصويب. */
  const onMove = (e) => {
    ty = clamp((e.clientX / innerWidth - .5) * 2, -1, 1) * T.tiltY;
    tx = clamp((e.clientY / innerHeight - .5) * -2, -1, 1) * T.tiltX;
    const r = canvas.getBoundingClientRect();
    ndcX = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndcY = -((e.clientY - r.top) / r.height) * 2 + 1;
    pointerLive = true;
    lastPointer = performance.now();
    if (dragging) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      const w = T.wind;                     // السحب يدفع ما هو مُفعَّل فقط
      for (let i = 0; i < N; i++) {
        if (act[i] < .02) continue;
        vel[i * 3] += dx * w * act[i];
        vel[i * 3 + 1] -= dy * w * act[i];
      }
    }
    start();
  };
  const onLeave = () => { pointerLive = false; };
  const onDown = (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; onMove(e); };
  const onUp = () => { dragging = false; };

  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onDown, { passive: true });
  addEventListener('pointerup', onUp, { passive: true });
  addEventListener('pointercancel', onUp, { passive: true });
  document.addEventListener('pointerleave', onLeave, { passive: true });

  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVis);

  const io = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    onScreen ? start() : stop();
  }, { rootMargin: '120px' });
  io.observe(host);

  /* ── التسليم: الصورة تبقى حتى يجهز المجسّم، ثم تخفت ── */
  renderer.render(scene, camera);
  canvas.style.opacity = '1';
  if (img) { img.style.transition = 'opacity .45s ease'; img.style.opacity = '0'; }
  host.dataset.logo3d = 'on';
  start();

  return {
    /** تفتيت كامل — للاختبار وللمعاينة، بلا تزوير أحداث. */
    burst(power = 1) { burst(power); },

    /** موضع المؤشّر المحلّي — للاختبار. */
    debug() { return { px, py, live: pointerLive, burst: FX.uBurst.value, N }; },

    destroy() {
      stop();
      io.disconnect(); ro.disconnect();
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerdown', onDown);
      removeEventListener('pointerup', onUp);
      removeEventListener('pointercancel', onUp);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVis);
      for (const m of meshes) m.geometry.dispose();
      for (const m of mats) m.dispose();
      pGeo.dispose(); pMat.dispose();
      scene.environment?.dispose();
      renderer.dispose();
      canvas.style.opacity = '';
      if (img) { img.style.opacity = ''; img.style.transition = ''; }
      delete host.dataset.logo3d;
    },
  };
}

/* ════════════════ غلاف المؤثّر ════════════════ */
export default {
  name: 'logo-mark',
  heavy: true,

  init(host, o = {}) {
    // «تقليل الحركة» أو بلا WebGL: المحرّك المسطّح كما كان، بلا تغيير
    if (prefs.reduced || !webglOk()) return flat.init(host, o);

    host.__logo3dPending = true;
    loadThree()
      .then((THREE) => {
        if (!host.__logo3dPending || !host.isConnected) return;
        host.__logo3d = mount(THREE, host, o);
        host.__logo3dPending = false;
      })
      .catch((e) => {
        // الشبكة أو الـ CDN — نسقط للمحرّك المسطّح بدل شعار جامد
        console.warn('[logo-3d] تعذّر تحميل المحرّك، نعود للمسطّح', e);
        if (host.__logo3dPending && host.isConnected) flat.init(host, o);
        host.__logo3dPending = false;
      });
  },

  destroy(host) {
    host.__logo3dPending = false;
    if (host.__logo3d) { host.__logo3d.destroy(); host.__logo3d = null; }
    else flat.destroy?.(host);
  },
};
