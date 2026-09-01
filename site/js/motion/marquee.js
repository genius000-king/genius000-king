// ============================================================
// marquee — شريط يمشي وحده، ويُسحب باليد فيستمرّ بقصوره الذاتي.
//
// ⚠️ الاتجاه — وهو ما كان يكسره:
//   الصفحة RTL، فالمسار يصفّ بطاقاته من اليمين إلى اليسار ويمتدّ
//   فائضه يساراً عن الحافّة اليمنى. أي أنّ المنفذ مغطًّى أصلاً عند
//   إزاحة صفر، وكل إزاحةٍ سالبة تدفع المحتوى خارجه. وكان الالتفاف
//   يحصر الإزاحة في ‎(-half, 0]‎ — وهي الفتحة الصحيحة لاتجاهٍ يبدأ من
//   اليسار وحده — فيدفع الشريط كلَّه بعيداً.
//
//   قِستُه قبل الإصلاح: تغطية البطاقات لعرض الحاوية صفرٌ بالمئة في
//   ثلاث حالاتٍ من أربع. لا خللٌ في قسم، بل قسمٌ فارغ.
//
//   والفتحة تتبع الاتجاه: ‎[0, +half)‎ في RTL و‎(-half, 0]‎ في LTR.
//
// وثابتُ الأمان: نكرّر المجموعة حتى يصير نصفُ المسار أوسع من
//   الحاوية. عندها أيّ إزاحةٍ داخل الفتحة تغطّي المنفذ كلَّه، فلا
//   تظهر فجوة مهما قلّت البطاقات. النسخة الواحدة لا تكفي: بطاقتان
//   على شاشةٍ عريضة تتركان فراغاً بعد نصف دورة.
//
// والفيزياء بالثواني لا بالإطارات: كانت السرعة تُضرب في معامل
//   احتكاكٍ مرّةً كلَّ إطار، فيمشي الشريط على شاشة ١٢٠Hz ضعفَ ما
//   يمشي على ٦٠ ويقف في نصف الزمن. الآن الاحتكاك أُسّيٌّ في الزمن،
//   والسرعة تُقاس بالبكسل في الثانية من زمن الأحداث لا من عددها.
// ============================================================
import loop from './loop.js';
import prefs from './prefs.js';
import { on } from '../core/dom.js';
import { scan } from './registry.js';

const DAMP = 3.2;      // معامل تخميد أُسّيّ في الثانية
const MIN_V = 8;       // بكسل/ثانية — دونها يُسلَّم للمشي التلقائي
const MAX_COPIES = 12; // سقفٌ يمنع تكراراً لا ينتهي لو صفر عرض البطاقة
const VEL_WINDOW = 110; // ms — نافذة اشتقاق سرعة الدفعة
const STALE_MS = 220;   // ms — بعدها تُعدّ اليد ساكنةً فلا دفعة

export default {
  name: 'marquee',
  init(host, o = {}) {
    const track = host.firstElementChild;
    if (!track || track.children.length === 0) return;

    const originals = [...track.children];

    // الفتحة التي يلتفّ فيها الشريط تتبع اتجاه الصفحة — انظر رأس الملف
    const rtl = getComputedStyle(host).direction === 'rtl';

    /** ينسخ المجموعة الأصلية مرّةً واحدة في نهاية المسار. */
    function addCopy() {
      const frag = document.createDocumentFragment();
      for (const c of originals) {
        const k = c.cloneNode(true);
        k.setAttribute('aria-hidden', 'true');
        k.setAttribute('tabindex', '-1');
        frag.append(k);
      }
      track.append(frag);
    }

    const s = { x: 0, v: 0, half: 0, paused: false, dragging: false,
      lastX: 0, lastT: 0, moved: 0, copies: 1, samples: [] };

    /* يكرّر حتى يصير نصف المسار أوسع من الحاوية، ثم يقيس. النسخ عددٌ
       زوجيّ دائماً: النصفان يجب أن يتطابقا وإلا قفز الالتفاف. */
    function measure() {
      const width = host.clientWidth || 1;
      let guard = 0;
      while (guard++ < MAX_COPIES) {
        const one = track.scrollWidth / s.copies;
        if (!one) break;
        if (one * Math.floor(s.copies / 2) >= width && s.copies % 2 === 0) break;
        addCopy();
        s.copies += 1;
      }
      if (s.copies % 2 === 1) { addCopy(); s.copies += 1; }
      s.half = track.scrollWidth / 2;
      wrap();
      paint();
    }

    const wrap = () => {
      if (!s.half) return;
      s.x %= s.half;
      // RTL: ‎[0, +half)‎ — الصفر يغطّي المنفذ والسالب يفرّغه. وLTR عكسها.
      if (rtl) { if (s.x < 0) s.x += s.half; }
      else if (s.x > 0) s.x -= s.half;
    };

    const paint = () => {
      track.style.transform = `translate3d(${s.x.toFixed(2)}px, 0, 0)`;
    };

    measure();
    queueMicrotask(() => scan(track));

    // القياس ثانيةً بعد أن تعرف الصور والخطوط أبعادها الحقيقية
    const imgs = [...track.querySelectorAll('img')];
    Promise.allSettled(imgs.map((i) => (i.decode ? i.decode() : Promise.resolve())))
      .then(measure);
    document.fonts?.ready?.then(measure);
    on(window, 'load', measure);

    const ro = new ResizeObserver(measure);
    ro.observe(host);
    originals.forEach((c) => ro.observe(c));

    const speed = prefs.scale(Number(o.speed ?? 26), o.intensity ?? 1);  // بكسل/ثانية
    const dir = Number(o.dir ?? 1) >= 0 ? 1 : -1;

    const tick = (dt) => {
      if (!s.dragging) {
        if (Math.abs(s.v) > MIN_V) {
          // قصورٌ ذاتيّ: تخميد أُسّيّ مستقلّ عن معدّل الإطارات
          s.x += s.v * dt;
          s.v *= Math.exp(-DAMP * dt);
        } else if (!s.paused) {
          s.v = 0;
          s.x -= dir * speed * dt;
        }
      }
      wrap();
      paint();
    };

    // ── السحب ──
    const down = (e) => {
      s.dragging = true;
      s.paused = true;
      s.v = 0;
      s.moved = 0;
      s.lastX = e.clientX;
      s.lastT = e.timeStamp;
      s.samples.length = 0;
      s.samples.push({ x: e.clientX, t: e.timeStamp });
      host.setPointerCapture?.(e.pointerId);
      host.classList.add('is-dragging');
    };

    const move = (e) => {
      if (!s.dragging) return;
      const dx = e.clientX - s.lastX;
      s.lastX = e.clientX;
      s.lastT = e.timeStamp;
      s.moved += Math.abs(dx);
      s.x += dx;
      /* السرعة من نافذةٍ زمنية لا من آخر حدثين: حدثٌ واحدٌ متأخّر —
         وهو شائعٌ عند انشغال الخيط — يجعل الدفعة عشوائية، مرّةً
         مضاعفةً ومرّةً صفراً. النافذة تعطي متوسّط حركة اليد فعلاً. */
      s.samples.push({ x: e.clientX, t: e.timeStamp });
      while (s.samples.length > 2 && e.timeStamp - s.samples[0].t > VEL_WINDOW) s.samples.shift();
      wrap();
      paint();
    };

    const up = (e) => {
      if (!s.dragging) return;
      s.dragging = false;
      /* لا نستأنف بـ‎:hover‎: على اللمس تلتصق هذه الحالة بعد الرفع
         فيبقى الشريط واقفاً بلا سبب ظاهر. المؤشّر الدقيق وحده يوقف.
         والقصور الذاتي يسبق هذا الإيقاف في حلقة الرسم، فدفعةٌ تنطلق
         ثمّ يسكن الشريط تحت المؤشّر — وهو المتوقَّع. */
      s.paused = !prefs.touch && host.matches(':hover');
      host.releasePointerCapture?.(e.pointerId);
      host.classList.remove('is-dragging');

      /* الدفعة من النافذة: أوّل عيّنةٍ فيها إلى آخر نقطةٍ لمستها اليد.
         ويدٌ سكنت قبل الرفع لا تورّث دفعة — والحدّ سخيٌّ لأنّ تأخّر
         حدثٍ واحد على جهازٍ مشغول ليس سكوناً. */
      const a = s.samples[0];
      const z = s.samples[s.samples.length - 1];
      const span = z && a ? z.t - a.t : 0;
      s.v = span > 0 ? ((z.x - a.x) / span) * 1000 : 0;
      if (e.timeStamp - s.lastT > STALE_MS) s.v = 0;
      s.samples.length = 0;
      if (s.moved > 8) {
        host.__swallowClick = true;
        setTimeout(() => { host.__swallowClick = false; }, 0);
      }
    };

    let unsub = null;
    const io = new IntersectionObserver((e) => {
      if (e[0].isIntersecting) { if (!unsub) unsub = loop.add(tick); }
      else { unsub?.(); unsub = null; }
    }, { threshold: 0 });
    io.observe(host);

    const offs = [
      on(host, 'pointerenter', (e) => {
        if (e.pointerType !== 'touch' && !prefs.touch) s.paused = true;
      }),
      on(host, 'pointerleave', () => { s.paused = false; }),
      on(host, 'pointerdown', down),
      on(host, 'pointermove', move, { passive: true }),
      on(host, 'pointerup', up),
      on(host, 'pointercancel', up),
      on(host, 'focusin', () => { s.paused = true; }),
      on(host, 'focusout', () => { s.paused = false; }),
      on(host, 'click', (e) => {
        if (host.__swallowClick) { e.stopPropagation(); e.preventDefault(); }
      }, true),
    ];

    host.__marquee = { offs, ro, io, track, stop: () => { unsub?.(); unsub = null; } };
  },
  destroy(host) {
    const m = host.__marquee;
    if (!m) return;
    m.stop();
    m.offs.forEach((f) => f());
    m.ro.disconnect();
    m.io.disconnect();
    m.track.style.transform = '';
    delete host.__marquee;
  },
};
