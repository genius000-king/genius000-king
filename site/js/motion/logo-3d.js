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
  gateTau:  0.14,   // ث — إمساك النابض يتدرّج فلا يشدّ فجأة
  riseTau:  0.09,   // ث — سرعة التفكّك (فورية عمداً)
  stagger:  0.5,    // نصيب التتابع: موجة العودة من المركز إلى الأطراف
  landFrac: 0.10,   // متى يُسلَّم للمجسّم: نسبة من نصف القطر
  convTau:  0.07,   // ث — تنعيم قياس التقارب (يقلّ الرجفان)
  maxFxMs:  4200,   // سقف مطلق: لا يبقى متفكّتاً أبداً بعد هذا
  burst:    1050,   // قوة الانفجار من موضع اللمسة
  spread:   210,    // نصيب العشوائية من الانفجار
  size:     5,      // قطر الجسيمة بوحدات المجسّم
  wind:     3.2,    // دفع السحب على الجسيمات
};

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

  const intensity = clamp(Number(opts.intensity ?? 1), 0, 1);
  const low = prefs.lowPower;
  const N = Math.round((low ? 3800 : prefs.touch ? 6500 : 11000) * (0.5 + intensity * 0.5));

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, alpha: true,
    powerPreference: low ? 'low-power' : 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, low ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.environment = studioEnv(THREE, renderer);
  const camera = new THREE.PerspectiveCamera(34, 1, 1, 5000);

  scene.add(new THREE.AmbientLight(0xffffff, .25));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(-260, 320, 480);
  const rim = new THREE.DirectionalLight(0x64d2f5, 1.1); rim.position.set(340, -180, -300);
  const fil = new THREE.DirectionalLight(0xfff0dc, .5); fil.position.set(180, 260, 300);
  scene.add(key, rim, fil);

  const group = new THREE.Group();
  const solid = new THREE.Group();
  group.add(solid);
  scene.add(group);

  /* ── الأجسام ── */
  /* ── الخامتان ──
     الأزرق ليس معدناً: المعدن يأخذ لونه من انعكاسه لا من نفسه، فلو
     جعلناه معدنياً ابيضّ تحت ضوء الاستوديو وضاع أزرق الهوية. هو في
     الأصل سطح لمّاع ملوّن — أي عازل بطلاء صافٍ فوقه.
     الفضّي عكسه: كروم حقيقي، لونه من المحيط، وخشونة تكفي ليبقى فيه
     رماد بدل أن يصير أبيض مسطّحاً. */
  const mats = SHAPES.map((sh) => isBlue(sh.rgb)
    ? new THREE.MeshPhysicalMaterial({ color: 0x0e86b4, metalness: .22, roughness: .28,
        clearcoat: 1, clearcoatRoughness: .07, envMapIntensity: 1.1, transparent: true })
    : new THREE.MeshPhysicalMaterial({ color: sh.rgb[0] < 170 ? 0x9fa6b0 : 0xdfe4ec,
        metalness: 1, roughness: .26, clearcoat: .35, envMapIntensity: 1.3, transparent: true }));

  const DEPTH = 46, BEVEL = 7;
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

  // توسيط حول مركز الكتلة الحقيقي، ثم قياس نصف القطر للتأطير
  const box = new THREE.Box3();
  for (const m of meshes) { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox); }
  const ctr = box.getCenter(new THREE.Vector3());
  for (const m of meshes) { m.geometry.translate(-ctr.x, -ctr.y, -ctr.z); }
  const sz = box.getSize(new THREE.Vector3());
  const HALF_W = sz.x / 2, HALF_H = sz.y / 2;
  // مرجع مقياس للانفجار وللتسليم — لا للتأطير
  const RADIUS = Math.hypot(sz.x, sz.y) / 2;


  /* ── الجسيمات: عيّنات من سطح المجسّم بترجيح المساحة ── */
  const home = new Float32Array(N * 3), pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3), seed = new Float32Array(N * 3);
  const ord = new Float32Array(N), col = new Float32Array(N * 3);

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
    // بحث ثنائي على المساحة التراكمية: الاختيار متناسب مع مساحة المثلث
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
    // الدور: موجة من المركز إلى الأطراف — كما في المحرّك المسطّح
    for (let i = 0; i < N; i++) {
      ord[i] = Math.min(1, Math.hypot(home[i * 3], home[i * 3 + 1]) / maxR * .82 + Math.random() * .18);
    }
  })();

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uSize: { value: TUNE.size }, uOpacity: { value: 0 }, uProj: { value: 600 } },
    vertexShader: `
      attribute vec3 aColor; varying vec3 vC; varying float vD;
      uniform float uSize, uProj;
      void main(){
        vC = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vD = -mv.z;
        gl_PointSize = clamp(uSize * uProj / max(120.0, vD), 1.0, 40.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vC; varying float vD; uniform float uOpacity;
      void main(){
        vec2 q = gl_PointCoord - .5;
        float d = dot(q, q);
        if (d > .25) discard;
        float a = smoothstep(.25, .02, d);
        float fog = clamp(1.9 - vD / 3200.0, .3, 1.0);
        gl_FragColor = vec4(vC * (.75 + .45 * a), a * uOpacity * fog);
      }`,
  });
  const points = new THREE.Points(pGeo, pMat);
  points.visible = false;
  group.add(points);

  /* ── التأطير ── */
  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vFov = camera.fov * Math.PI / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    // اللوحة أوسع من صندوق الشعار (CSS: 152%) ليخرج التفتّت بلا قصّ.
    // نقيس الفارق ونبعد الكاميرا بقدره، فيظهر المجسّم بمقاس الصندوق
    // تماماً كما كانت الصورة — والفائض يبقى مساحةً للجسيمات.
    const hostW = host.getBoundingClientRect().width || w;
    const over = Math.min(2, Math.max(1, w / hostW));
    // ⚠️ نؤطّر بنصفَي الصندوق لا بقطر الدائرة المحيطة: القطر يصلح
    //    لجسم كرويّ، وهنا يجعل الشعار أصغر من صندوقه بنحو ٢٣٪ —
    //    أي أصغر من الصورة التي كانت مكانه. والهامش 1.06 يترك
    //    فسحة لزيادة الامتداد المسقَط عند الميلان.
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
  let morph = 0;          // 0 = مجسّم · 1 = جسيمات
  let gate = 0;           // إمساك النابض: 0 طيران حرّ · 1 عودة
  let conv = 1;           // متوسّط بُعد الجسيمات عن بيوتها، منسوباً إلى مسافة التسليم
  let holdUntil = 0, hardStop = 0;
  let tx = 0, ty = 0, rx = 0, ry = 0, spin = 0;
  let dragging = false, lastX = 0, lastY = 0, moved = 0;
  let onScreen = true, running = false, raf = 0, last = 0;

  const tmp = new THREE.Vector3();

  function burst(clientX, clientY, power = 1) {
    const now = performance.now();
    holdUntil = now + TUNE.holdMs;
    hardStop = now + TUNE.maxFxMs;
    gate = 0;
    points.visible = true;

    // موضع الإصبع في فضاء المجموعة — فينفجر من تحته بالضبط
    const r = canvas.getBoundingClientRect();
    const ndcX = ((clientX - r.left) / r.width) * 2 - 1;
    const ndcY = -((clientY - r.top) / r.height) * 2 + 1;
    tmp.set(ndcX, ndcY, .5).unproject(camera);
    tmp.sub(camera.position).normalize();
    const o = camera.position.clone().addScaledVector(tmp, (RADIUS - camera.position.z) / tmp.z);
    group.worldToLocal(o);

    const F = TUNE.burst * power, S = TUNE.spread * power;
    for (let i = 0; i < N; i++) {
      const j = i * 3;
      const dx = pos[j] - o.x, dy = pos[j + 1] - o.y, dz = pos[j + 2] - o.z;
      const d = Math.hypot(dx, dy, dz) || 1;
      const k = F / (1 + d * .012);
      vel[j] += (dx / d) * k + seed[j] * S;
      vel[j + 1] += (dy / d) * k + seed[j + 1] * S;
      vel[j + 2] += (dz / d) * k + seed[j + 2] * S * 1.4;
    }
    start();
  }

  function step(now) {
    raf = 0;
    const dt = Math.min(.05, (now - last) / 1000);
    last = now;

    const bursting = now < holdUntil && now < hardStop;

    /* ── التحوّل ──
       الخروج بمؤقّت (فوري)، والعودة بالقياس لا بالزمن. */
    if (bursting) {
      morph += (1 - morph) * approach(dt, TUNE.riseTau);
    } else {
      // النابض يمسك تدريجياً فلا تُشدّ الجسيمات شدّة مفاجئة
      // السقف 1/(1-stagger) لا 1: به تبلغ آخر جسيمة (ord=1) بوّابتها كاملة
      gate += (1 / (1 - TUNE.stagger) - gate) * approach(dt, TUNE.gateTau);
      const target = now > hardStop ? 0 : clamp(conv);
      morph = Math.min(morph, target);
      if (morph < .002) morph = 0;
    }

    /* ── الفيزياء ── */
    if (points.visible) {
      const drag = Math.pow(TUNE.drag, dt * 60);
      let disp = 0, cnt = 0;
      for (let i = 0; i < N; i++) {
        const j = i * 3;
        // كل جسيمة تُمسَك في دورها: المركز أولاً ثم الأطراف — فيعود
        // الشعار موجةً من قلبه إلى حوافّه، لا كتلةً واحدة
        let gi = (gate - ord[i] * TUNE.stagger) / (1 - TUNE.stagger);
        gi = gi < 0 ? 0 : gi > 1 ? 1 : gi;
        const k = TUNE.omega * TUNE.omega * gi;
        const c = 2 * TUNE.omega * Math.sqrt(gi > 1e-4 ? gi : 1e-4);   // تخميد حرِج
        const ex = home[j] - pos[j], ey = home[j + 1] - pos[j + 1], ez = home[j + 2] - pos[j + 2];
        vel[j] = (vel[j] + (ex * k - vel[j] * c) * dt) * drag;
        vel[j + 1] = (vel[j + 1] + (ey * k - vel[j + 1] * c) * dt) * drag;
        vel[j + 2] = (vel[j + 2] + (ez * k - vel[j + 2] * c) * dt) * drag;
        pos[j] += vel[j] * dt;
        pos[j + 1] += vel[j + 1] * dt;
        pos[j + 2] += vel[j + 2] * dt;
        if ((i & 15) === 0) { disp += Math.hypot(ex, ey, ez); cnt++; }   // عيّنة تكفي للقياس
      }
      pGeo.attributes.position.needsUpdate = true;
      const raw = clamp((disp / (cnt || 1)) / (RADIUS * TUNE.landFrac));
      conv += (raw - conv) * approach(dt, TUNE.convTau);
    }

    /* ── الظهور: المجسّم يخرج ويعود مع الجسيمات لا قبلها ── */
    const solidVis = 1 - smooth(clamp(morph * 1.3));
    solid.visible = solidVis > .02;
    for (const m of meshes) m.material.opacity = solidVis;
    pMat.uniforms.uOpacity.value = smooth(clamp(morph * 1.5));
      if (morph === 0 && !bursting) { points.visible = false; conv = 1; }

    /* ── الميلان: ملاحقة سريعة ── */
    const a = approach(dt, TUNE.track);
    rx += (tx - rx) * a;
    ry += (ty - ry) * a;
    spin += dt * TUNE.spin;
    group.rotation.x = rx + Math.sin(now / 2600) * .04;
    group.rotation.y = ry + Math.sin(spin) * .16;
    group.position.y = Math.sin(now / 1900) * RADIUS * .022;

    renderer.render(scene, camera);

    // الميلان الخامل حركة دائمة مقصودة، فالحلقة تستمرّ ما دام الشعار
    // في الشاشة والتبويب ظاهراً — والمراقبان أعلاه يوقفانها فيما عدا ذلك
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

  /* ── التفاعل: على النافذة كلها، كما في المحرّك السابق ── */
  const onMove = (e) => {
    ty = clamp((e.clientX / innerWidth - .5) * 2, -1, 1) * TUNE.tiltY;
    tx = clamp((e.clientY / innerHeight - .5) * -2, -1, 1) * TUNE.tiltX;
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    moved += Math.hypot(dx, dy);
    lastX = e.clientX; lastY = e.clientY;
    if (morph > .05) {                       // ريح تدفع الجسيمات أثناء السحب
      const wnd = TUNE.wind;
      for (let i = 0; i < N; i++) { vel[i * 3] += dx * wnd; vel[i * 3 + 1] -= dy * wnd; }
    }
  };
  const onDown = (e) => { dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY; start(); };
  const onUp = (e) => {
    // ⚠️ الهدف قد لا يكون عقدة أصلاً (حدث مُركَّب، أو نافذة) — و
    //    Node.contains يرمي حينها ويكسر بقيّة معالِجات الرفع
    const inside = e.target instanceof Node && host.contains(e.target);
    if (dragging && moved < 9 && inside) burst(e.clientX, e.clientY);
    dragging = false;
  };
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onDown, { passive: true });
  addEventListener('pointerup', onUp, { passive: true });
  addEventListener('pointercancel', () => { dragging = false; }, { passive: true });

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
    /** تفتيت من مركز الشعار — للاختبار وللمعاينة، بلا تزوير أحداث. */
    burst(power = 1) {
      const r = host.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, power);
    },

    destroy() {
      stop();
      io.disconnect(); ro.disconnect();
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerdown', onDown);
      removeEventListener('pointerup', onUp);
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
