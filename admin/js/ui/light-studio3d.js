// ============================================================
// light-studio3d.js — استوديو إضاءة ثلاثيّ الأبعاد داخل اللوحة.
//
// مشهدٌ حقيقيّ لا لوحةٌ مسطّحة: الشعار مجسّماً في وسطه، وثلاثة
// مصابيح أجساماً في الفراغ تُمسك وتُحرَّك، وكاميرا تُدار حولها
// فترى المشهد من أيّ جهة — كما يُضبط الضوء في برنامج ثلاثيّ.
//
// ولماذا لا يكفي المسطّح: الضوء موضعه ثلاثة أعداد. لوحةٌ مسطّحة
// تُظهر اثنين وتخفي الثالث خلف مسطرة، فيضبط المشرف عمقاً لا يراه.
// وهنا يراه: يدور بالكاميرا فيرى أين يقف المصباح فعلاً.
//
// الهندسة نفسها التي يعرضها الموقع — مستوردةً من محرّكه لا منسوخةً
// عنه — فما يُضبط هنا هو ما يظهر هناك، بلا فرقٍ يتسلّل بين نسختين.
//
// ⚠️ الوحدات: المخزَّن نسبةٌ إلى نصف قطر المجسّم (‎-3..3‎)، والمشهد
//    يعمل بالوحدات العالمية. التحويل ‎× D‎ حيث ‎D = RADIUS * 2‎ —
//    نفس ثابت المحرّك بالضبط. أيّ اختلافٍ فيه يعني مصباحاً يقف في
//    اللوحة غير حيث يقف في الموقع.
// ============================================================
import { el, on } from '../core/dom.js';
import { VIEW, SHAPES, isBlue } from '../../../site/js/motion/logo-shape.js';
import { shapeFrom, EXTRUDE } from '../../../site/js/motion/logo-3d.js';

const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.185.1/three.module.min.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round2 = (n) => Math.round(n * 100) / 100;
const HEX = /^#[0-9a-f]{6}$/i;

let threeMod = null;
const loadThree = () => (threeMod ||= import(/* webpackIgnore: true */ THREE_URL));

/**
 * @param {object} o
 *   @param {Array<{id,label,x,y,z,power,color,angle,soft}>} o.lights
 *   @param {string} [o.selected]
 *   @param {Function} [o.onSelect]  (id) => void
 *   @param {Function} [o.onMove]    (id, x, y, z) => void — أثناء السحب
 *   @param {Function} [o.onCommit]  (id, x, y, z) => void — عند الإفلات
 * @returns {{node, select, refresh, stop, ready}}
 */
export function makeLightStudio3D(o = {}) {
  const canvas = el('canvas', { class: 'studio3d__canvas' });
  const hint = el('p', { class: 'studio3d__hint' }, [
    'اسحب الخلفية لتدوير الكاميرا · اسحب المصباح لتحريكه · العجلة تقرّب وتبعّد',
  ]);
  const node = el('div', { class: 'studio3d' }, [
    canvas,
    el('div', { class: 'studio3d__bar' }, [hint]),
  ]);

  const lights = new Map((o.lights || []).map((l) => [l.id, { ...l }]));
  let selected = lights.has(o.selected) ? o.selected : [...lights.keys()][0];

  let stopped = false;
  const api = {
    node,
    select(id) { if (lights.has(id)) { selected = id; api._mark?.(); } },
    refresh(next = []) {
      for (const l of next) {
        if (!lights.has(l.id)) continue;
        lights.set(l.id, { ...lights.get(l.id), ...l });
      }
      api._sync?.();
    },
    stop() { stopped = true; api._stop?.(); },
  };

  api.ready = loadThree()
    .then((THREE) => { if (!stopped) build(THREE); })
    .catch((e) => {
      node.replaceChildren(el('p', { class: 'studio3d__error' }, [
        'تعذّر تحميل المحرّك ثلاثي الأبعاد. تحقّق من الاتصال ثم حدّث الصفحة.',
      ]));
      console.error('[studio3d]', e);
    });

  // ════════════════════════════════════════════
  function build(THREE) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1017);
    const camera = new THREE.PerspectiveCamera(38, 1, 1, 40000);

    // ── الشعار: نفس هندسة الموقع ──
    const solid = new THREE.Group();
    const geos = SHAPES.map((sh) => {
      const g = new THREE.ExtrudeGeometry(shapeFrom(THREE, sh.d), {
        depth: EXTRUDE.depth, curveSegments: 10,
        bevelEnabled: true, bevelThickness: EXTRUDE.bevel, bevelSize: EXTRUDE.bevel * 0.8,
        bevelSegments: 3,
      });
      return g;
    });
    const box = new THREE.Box3();
    for (const g of geos) { g.computeBoundingBox(); box.union(g.boundingBox); }
    const ctr = box.getCenter(new THREE.Vector3());
    for (const g of geos) g.translate(-ctr.x, -ctr.y, -ctr.z);
    const sz = box.getSize(new THREE.Vector3());
    const RADIUS = Math.hypot(sz.x, sz.y) / 2;
    const D = RADIUS * 2;                       // نفس ثابت المحرّك

    geos.forEach((g, i) => {
      const blue = isBlue(SHAPES[i].rgb);
      const m = blue
        ? new THREE.MeshPhysicalMaterial({ color: 0x0a9ad3, metalness: .10, roughness: .20,
            clearcoat: 1, clearcoatRoughness: .04 })
        : new THREE.MeshPhysicalMaterial({ color: 0xf4f6f8, metalness: .06, roughness: .14,
            clearcoat: 1, clearcoatRoughness: .05 });
      solid.add(new THREE.Mesh(g, m));
    });
    scene.add(solid);

    // ── أرضية وشبكة: يقيس بها العين العمق ──
    const grid = new THREE.GridHelper(D * 6, 24, 0x2a3346, 0x1b2130);
    grid.position.y = -sz.y * 0.9;
    scene.add(grid);
    scene.add(new THREE.AmbientLight(0xffffff, 0.10));   // إضاءة خدمة للمشهد لا للشعار

    // ── المصابيح وأجسامها ──
    const rig = new Map();
    for (const [id, l] of lights) {
      const spot = new THREE.SpotLight(hex(THREE, l.color), l.power);
      spot.decay = 0; spot.distance = 0;
      spot.angle = l.angle; spot.penumbra = l.soft;
      scene.add(spot, spot.target);

      /* الجسم: كرةٌ مضيئة بذاتها ترى مكان المصباح، ومخروطٌ شفّاف
         يرسم زاويته فيُرى التركيز لا يُقرأ رقماً، وخيطٌ إلى المركز
         يقول إلى أين يصوّب. */
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(D * 0.055, 20, 14),
        new THREE.MeshBasicMaterial({ color: hex(THREE, l.color) }),
      );
      bulb.userData.lightId = id;

      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(D * 0.085, 16, 12),
        new THREE.MeshBasicMaterial({ color: hex(THREE, l.color), transparent: true,
          opacity: 0.16, depthWrite: false }),
      );
      bulb.add(halo);

      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(1, 1, 28, 1, true),
        new THREE.MeshBasicMaterial({ color: hex(THREE, l.color), transparent: true,
          opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }),
      );

      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
        new THREE.LineBasicMaterial({ color: hex(THREE, l.color), transparent: true, opacity: 0.35 }),
      );

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(D * 0.075, D * 0.006, 8, 32),
        new THREE.MeshBasicMaterial({ color: 0x4c7dff }),
      );
      ring.visible = false;
      bulb.add(ring);

      scene.add(bulb, cone, line);
      rig.set(id, { spot, bulb, halo, cone, line, ring });
    }

    /* ── حجم المصباح ثابتٌ على الشاشة ──
       الكرة بحجمٍ عالميّ ثابت تصير خمس بكسلات حين تبتعد الكاميرا،
       فتفلت من الإصبع ومن الفأرة. نقيس كم وحدةً عالمية يساوي البكسل
       عند بُعد كل مصباح، فيبقى قطره الظاهر واحداً مهما قرّبت أو
       بعّدت — كما تفعل مقابض البرامج الثلاثية. */
    const BULB_PX = 13;
    function sizeBulbs() {
      const h = renderer.domElement.height / renderer.getPixelRatio();
      const k = 2 * Math.tan((camera.fov * Math.PI) / 360) / Math.max(1, h);
      for (const r of rig.values()) {
        const dist = camera.position.distanceTo(r.bulb.position);
        const want = BULB_PX * k * dist;               // نصف القطر بالوحدات العالمية
        r.bulb.scale.setScalar(Math.max(0.35, want / (D * 0.055)));
      }
    }

    // ── الكاميرا: مدارٌ حول المركز ──
    /* الكاميرا أبعد ممّا يكفي للشعار وحده: أبعد مصباحٍ افتراضاً يقف
       عند ‎2.56 × D‎، وإطارٌ أضيق يقطعه فيبحث المشرف عن ضوءٍ لا يراه. */
    const cam = { az: 0.0, el: 0.26, dist: D * 5.4 };
    function placeCamera() {
      cam.el = clamp(cam.el, -1.35, 1.35);
      cam.dist = clamp(cam.dist, D * 1.6, D * 14);
      camera.position.set(
        Math.cos(cam.el) * Math.sin(cam.az) * cam.dist,
        Math.sin(cam.el) * cam.dist,
        Math.cos(cam.el) * Math.cos(cam.az) * cam.dist,
      );
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      sizeBulbs();
    }

    /** يعيد رسم كل ما يتبع قيم الأضواء — يُنادى بعد أي تغيير. */
    function sync() {
      for (const [id, l] of lights) {
        const r = rig.get(id);
        if (!r) continue;
        const col = hex(THREE, l.color);
        const px = l.x * D, py = l.y * D, pz = l.z * D;

        r.spot.color.setHex(col);
        r.spot.intensity = l.power;
        r.spot.angle = l.angle;
        r.spot.penumbra = l.soft;
        r.spot.position.set(px, py, pz);
        r.spot.target.position.set(0, 0, 0);
        r.spot.target.updateMatrixWorld();

        r.bulb.position.set(px, py, pz);
        r.bulb.material.color.setHex(col);
        r.halo.material.color.setHex(col);
        r.ring.visible = id === selected;

        // المخروط: قاعدته عند المركز ورأسه عند المصباح
        const len = Math.hypot(px, py, pz) || 1;
        const rad = Math.tan(l.angle) * len;
        r.cone.geometry.dispose();
        r.cone.geometry = new THREE.ConeGeometry(rad, len, 28, 1, true);
        r.cone.material.color.setHex(col);
        /* المخروط للمختار وحده: ثلاثة مخاريط معاً تملأ المشهد ضباباً
           فلا يُرى الشعار ولا يُقرأ أيٌّ منها. */
        r.cone.visible = id === selected;
        r.cone.material.opacity = 0.07 + 0.09 * clamp(l.power / 8, 0, 1);
        r.cone.position.set(px / 2, py / 2, pz / 2);
        // الرأس عند المصباح: المخروط الافتراضي رأسه للأعلى
        r.cone.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(px, py, pz).normalize(),
        );

        r.line.geometry.setFromPoints([
          new THREE.Vector3(0, 0, 0), new THREE.Vector3(px, py, pz),
        ]);
        r.line.material.color.setHex(col);
      }
      sizeBulbs();
      draw();
    }
    api._sync = sync;
    api._mark = () => {
      for (const [id, r] of rig) {
        r.ring.visible = id === selected;
        r.cone.visible = id === selected;
      }
      draw();
    };

    // ── الحجم ──
    function resize() {
      const w = Math.max(1, node.clientWidth);
      const h = Math.max(1, Math.round(w * 0.66));
      canvas.style.height = `${h}px`;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      sizeBulbs();
      draw();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(node);

    let pending = 0;
    function draw() {
      if (pending) return;
      pending = requestAnimationFrame(() => { pending = 0; renderer.render(scene, camera); });
    }

    // ── التفاعل ──
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plane = new THREE.Plane();
    const hitPt = new THREE.Vector3();
    let drag = null;

    /** إحداثيات القُماشة المعياريّة — فيزيائية، لا تتأثر باتجاه الصفحة. */
    function toNdc(e) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1,
              -((e.clientY - r.top) / r.height) * 2 + 1);
      return ndc;
    }

    function pickBulb(e) {
      ray.setFromCamera(toNdc(e), camera);
      const hits = ray.intersectObjects([...rig.values()].map((r) => r.bulb), false);
      return hits.length ? hits[0].object.userData.lightId : null;
    }

    function down(e) {
      if (e.button != null && e.button !== 0) return;
      const id = pickBulb(e);
      canvas.setPointerCapture?.(e.pointerId);
      if (id) {
        if (id !== selected) { selected = id; api._mark(); o.onSelect?.(id); }
        const l = lights.get(id);
        const p = new THREE.Vector3(l.x * D, l.y * D, l.z * D);
        /* مستوٍ يمرّ بالمصباح ويواجه الكاميرا: السحب عليه يحرّك
           المصباح في البعدين اللذين تراهما العين الآن، فيتغيّر
           العمق أيضاً متى أدرت الكاميرا. */
        plane.setFromNormalAndCoplanarPoint(
          camera.getWorldDirection(new THREE.Vector3()).negate(), p);
        drag = { kind: 'light', id };
      } else {
        drag = { kind: 'orbit', x: e.clientX, y: e.clientY };
      }
      e.preventDefault();
    }

    function move(e) {
      if (!drag) return;
      e.preventDefault();
      if (drag.kind === 'orbit') {
        cam.az -= (e.clientX - drag.x) * 0.008;
        cam.el += (e.clientY - drag.y) * 0.008;
        drag.x = e.clientX; drag.y = e.clientY;
        placeCamera();
        draw();
        return;
      }
      ray.setFromCamera(toNdc(e), camera);
      if (!ray.ray.intersectPlane(plane, hitPt)) return;
      const l = lights.get(drag.id);
      l.x = round2(clamp(hitPt.x / D, -3, 3));
      l.y = round2(clamp(hitPt.y / D, -3, 3));
      l.z = round2(clamp(hitPt.z / D, -3, 3));
      sync();
      o.onMove?.(drag.id, l.x, l.y, l.z);
    }

    function up(e) {
      if (!drag) return;
      const d = drag;
      drag = null;
      try { canvas.releasePointerCapture?.(e.pointerId); } catch { /* لا يهمّ */ }
      if (d.kind !== 'light') return;
      const l = lights.get(d.id);
      o.onCommit?.(d.id, l.x, l.y, l.z);
    }

    function wheel(e) {
      e.preventDefault();
      cam.dist *= e.deltaY > 0 ? 1.1 : 0.9;
      placeCamera();
      draw();
    }

    const offs = [
      on(canvas, 'pointerdown', down),
      on(canvas, 'pointermove', move, { passive: false }),
      on(canvas, 'pointerup', up),
      on(canvas, 'pointercancel', up),
      on(canvas, 'wheel', wheel, { passive: false }),
      on(window, 'blur', () => { drag = null; }),
    ];

    api._stop = () => {
      offs.forEach((f) => f());
      ro.disconnect();
      cancelAnimationFrame(pending);
      for (const g of geos) g.dispose();
      for (const r of rig.values()) { r.cone.geometry.dispose(); r.bulb.geometry.dispose(); }
      renderer.dispose();
    };

    placeCamera();
    resize();
    sync();
  }

  function hex(THREE, v) {
    void THREE;
    return HEX.test(String(v || '')) ? parseInt(String(v).slice(1), 16) : 0xffffff;
  }

  return api;
}
