// ============================================================
// light-stage.js — مسرح إضاءة استوديو: بقعٌ قابلة للسحب فوق معاينة
// مصغّرة للشعار، بدل شريط مزالق x/y منفصلة لا تعطي حَدْساً مكانياً.
//
// الإحداثيات فيزيائية دائماً، كما في grid-canvas.js: getBoundingClientRect
// لا يتأثر باتجاه الصفحة (left يبقى اليسار)، فحساب موضع السحب من
// rect.left مباشرةً يعطي نفس النتيجة في RTL وLTR. المحور العمودي وحده
// معكوس: y الرياضية موجبة للأعلى، وشاشة العرض موجبة للأسفل — فنعكسه
// عند القراءة والكتابة معاً بدل أن ننساه في أحدهما فيختلف الاثنان.
//
// لا شبح سحبٍ هنا: البقعة نفسها تتحرّك أثناء السحب، فما يُرى أثناء
// الإفلات هو نفسه ما سيُحفظ — لا تقريبٌ منفصل له.
// ============================================================
import { el, on } from '../core/dom.js';

/* المسرح يغطّي المدى المخزَّن كلَّه ‎-3..+3‎ لا جزءاً منه: مدىً أضيق
   يعني بقعاً تُقصّ عند الحافّة ولا تُرى مواضعها — والحافّ افتراضه
   ‎x = 2.4‎ فكان نصفه خارج الإطار. */
const RANGE = 3;
/* وحافّة المسرح ليست الصفر: البقعة مركزها موضعُها، فبقعةٌ عند أقصى
   المدى يخرج نصفها. نحجز شريطاً بعرض نصف بقعة على كل جانب. */
const PAD = 0.075;
const PUCK_MIN = 30, PUCK_MAX = 64; // px — حجم البقعة يعكس شدّة الضوء فتُقرأ الشدّة قبل فتح المزلاق

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round2 = (n) => Math.round(n * 100) / 100;
const HEX = /^#[0-9a-f]{6}$/i;

/**
 * @param {object} o
 *   @param {Array<{id,label,x,y,z,power,color}>} o.lights
 *   @param {string} [o.selected] المعرّف المختار مبدئياً — أوّل ضوء إن غاب
 *   @param {string} [o.logoSrc] رابط صورة الشعار المرجعية
 *   @param {Function} [o.onSelect] (id) => void — عند اختيار بقعة
 *   @param {Function} [o.onMove] (id, x, y) => void — أثناء السحب، لا تُحفَظ به
 *   @param {Function} [o.onCommit] (id, x, y) => void — مرّة واحدة عند الإفلات
 * @returns {{node: HTMLElement, select(id): void, refresh(lights): void, stop(): void}}
 */
export function makeLightStage(o = {}) {
  const lights = new Map((o.lights || []).map((l) => [l.id, { ...l }]));
  let selected = lights.has(o.selected) ? o.selected : [...lights.keys()][0];

  const logo = el('div', { class: 'light-stage__logo' }, [
    el('img', {
      // نسخة اللوحة نفسها لا نسخة الموقع: تجاور index.html فلا تعتمد
      // على ترتيب المجلّدات، وتعمل في أي جذرِ خدمة
      src: o.logoSrc || 'assets/img/logo.png', alt: 'الشعار',
      draggable: 'false',
      onerror(e) { e.target.replaceWith(el('div', { class: 'light-stage__logo-fallback' }, ['الشعار'])); },
    }),
  ]);

  const pucks = new Map();
  const field = el('div', { class: 'light-stage__field' });
  for (const [id, l] of lights) {
    const puck = el('button', {
      type: 'button', class: 'light-stage__puck', 'data-id': id,
      title: `${l.label || id} — اسحب لتحريكه`,
      'aria-label': l.label || id,
      style: { '--puck-color': HEX.test(l.color || '') ? l.color : '#ffffff' },
    }, [el('span', { class: 'light-stage__puck-label' }, [l.label || id])]);
    pucks.set(id, puck);
    field.append(puck);
  }
  field.append(logo);

  // dir="ltr" على المسرح نفسه: بقعة عند x سالبة يجب أن تُرى يساراً
  // فيزيائياً بصرف النظر عن اتجاه لوحة التحكّم المحيطة (وهي RTL). كل
  // بقعة عنصر مستقل فتسميتها العربية تبقى سليمة القراءة رغم ذلك.
  const node = el('div', { class: 'light-stage', dir: 'ltr' }, [field]);

  function valueToFrac(v) {
    const f = clamp((v + RANGE) / (RANGE * 2), 0, 1);
    return PAD + f * (1 - 2 * PAD);
  }
  /** عكسُها — السحب يقرأ الكسر من الشاشة فيجب أن يمرّ بنفس الشريط. */
  function fracToValue(f) {
    const g = clamp((f - PAD) / (1 - 2 * PAD), 0, 1);
    return round2(g * RANGE * 2 - RANGE);
  }

  function place(id) {
    const l = lights.get(id), puck = pucks.get(id);
    if (!l || !puck) return;
    puck.style.left = `${valueToFrac(l.x) * 100}%`;
    puck.style.top = `${(1 - valueToFrac(l.y)) * 100}%`;
  }

  function size(id) {
    const l = lights.get(id), puck = pucks.get(id);
    if (!l || !puck) return;
    const p = clamp(Number(l.power) || 0, 0, 8) / 8;
    puck.style.setProperty('--puck-size', `${Math.round(PUCK_MIN + (PUCK_MAX - PUCK_MIN) * p)}px`);
    puck.style.setProperty('--puck-glow', String(0.3 + 0.55 * p));
  }

  function paint(id) {
    place(id);
    size(id);
    const l = lights.get(id), puck = pucks.get(id);
    if (l && puck) puck.style.setProperty('--puck-color', HEX.test(l.color || '') ? l.color : '#ffffff');
  }

  function markSelected() {
    for (const [id, puck] of pucks) puck.classList.toggle('is-selected', id === selected);
  }

  function select(id) {
    if (!lights.has(id)) return;
    selected = id;
    markSelected();
  }

  for (const id of lights.keys()) paint(id);
  markSelected();

  // ── السحب — Pointer Events توحّد الفأرة واللمس في مسارٍ واحد ──
  let drag = null;

  function down(e) {
    if (e.button != null && e.button !== 0) return;
    const puck = e.target.closest('.light-stage__puck');
    if (!puck || !field.contains(puck)) return;
    const id = puck.dataset.id;
    if (id !== selected) { select(id); o.onSelect?.(id); }
    drag = { id, puck, pointerId: e.pointerId };
    puck.classList.add('is-dragging');
    try { puck.setPointerCapture(e.pointerId); } catch { /* لا يهمّ */ }
    e.preventDefault();
  }

  function move(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    e.preventDefault();
    const rect = field.getBoundingClientRect();
    // فيزيائية دائماً — لا نستعمل خصائص منطقية هنا البتّة
    const fx = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const fy = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    const x = fracToValue(fx);
    const y = fracToValue(1 - fy);
    const l = lights.get(drag.id);
    l.x = x; l.y = y;
    place(drag.id);
    o.onMove?.(drag.id, x, y);
  }

  function up(e) {
    if (!drag || (e.pointerId != null && e.pointerId !== drag.pointerId)) return;
    const d = drag;
    drag = null;
    d.puck.classList.remove('is-dragging');
    try { d.puck.releasePointerCapture(d.pointerId); } catch { /* لا يهمّ */ }
    const l = lights.get(d.id);
    o.onCommit?.(d.id, l.x, l.y);
  }

  const offs = [
    on(field, 'pointerdown', down),
    on(field, 'pointermove', move, { passive: false }),
    on(field, 'pointerup', up),
    on(field, 'pointercancel', up),
    on(window, 'blur', up),
  ];

  /** يحدّث بقعاً موجودة (بعد حفظ خارجي أو إرجاعٍ للأصل) دون إعادة بناء المسرح. */
  function refresh(next = []) {
    for (const l of next) {
      if (!lights.has(l.id)) continue;
      lights.set(l.id, { ...lights.get(l.id), ...l });
      paint(l.id);
    }
  }

  return { node, select, refresh, stop: () => offs.forEach((f) => f()) };
}
