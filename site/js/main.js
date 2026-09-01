// ============================================================
// main.js — نقطة الدخول الوحيدة لموقع العملاء.
// تسجيل قسم = سطر واحد في SECTIONS.
//
// الإقلاع في v2 مسارَان:
//
//   زيارة أولى   → شاشة تحميل قصيرة، جلب، رسم، ثم تخزين على الجهاز.
//   زيارة تالية  → رسم فوري من نسخة الجهاز في الإطار الأول، والشبكة
//                   تُسأل بعدها بصمت. لا تُعاد الرسمة إلا إن تغيّر شيء
//                   فعلاً — فلا وميض ولا هيكل تحميل بلا سبب.
// ============================================================
import { isConfigured } from './core/config.js';
import { loadAll, hydrate, anyFailed } from './core/store.js';
import { applyTheme, listenPreviewTheme } from './core/theme.js';
import { applyLayout, watchLayout } from './core/layout-apply.js';
import { scan, destroyIn } from './motion/registry.js';
import { el } from './core/dom.js';
import { toast } from './core/toast.js';
import { logoImg } from './components/logo.js';
import './motion/index.js';
import * as preloader from './motion/preloader.js';

import { mount as nav } from './sections/nav.js';
import { mount as hero } from './sections/hero.js';
import { mount as about } from './sections/about.js';
import { mount as works } from './sections/works.js';
import { mount as packages } from './sections/packages.js';
import { mount as services } from './sections/services.js';
import { mount as process } from './sections/process.js';
import { mount as testimonials } from './sections/testimonials.js';
import { mount as payments } from './sections/payments.js';
import { mount as order } from './sections/order.js';
import { mount as footer } from './sections/footer.js';

const SECTIONS = [
  ['nav', nav], ['hero', hero], ['about', about], ['works', works],
  ['packages', packages], ['services', services], ['process', process],
  ['testimonials', testimonials], ['payments', payments], ['order', order],
  ['footer', footer],
];

let drawn = false;

/** يبني الصفحة كاملة من البيانات الحاضرة في الذاكرة. */
function paint() {
  applyTheme();

  for (const [id, mount] of SECTIONS) {
    const container = document.getElementById(id);
    if (!container) continue;
    // إعادة الرسم تنظّف مؤثّرات الرسمة السابقة أولاً — بلا هذا تتراكم
    // مستمعات ولوحات رسم على كل تحديث صامت
    if (drawn) destroyIn(container);
    try { mount(container); }
    catch (e) { console.error(`[section:${id}]`, e); }
  }

  // بعد التركيب لا قبله: أقسامٌ كـ«طرق الدفع» و«الآراء» ترفع إخفاءَ
  // نفسها عند التركيب متى وجدت بيانات، فلو سبقها التخطيط ضاع قرار
  // المشرف بإخفائها. الكلمة الأخيرة للتخطيط.
  applyLayout();
  watchLayout();

  document.documentElement.classList.add('js-ready');
  scan(document);
  drawn = true;
}

function showPreloader(node) {
  if (!node || !preloader.shouldShow()) { node?.remove(); return null; }
  node.append(el('div', { class: 'preloader__inner' }, [
    logoImg({ size: 76, cls: 'preloader__logo', eager: true }),
    el('span', { class: 'preloader__bar' }),
  ]));
  node.removeAttribute('aria-hidden');
  return node;
}

/** شاشة إعداد واضحة حين لا يكون الاتصال مضبوطاً — لا محتوى وهمي. */
function setupScreen() {
  document.getElementById('preloader')?.remove();
  document.getElementById('page').replaceChildren(
    el('div', { class: 'bento bento--flow', style: { paddingBlock: '18vh' } }, [
      el('div', { class: 'card glass glass--strong t--full', style: { gap: '16px' } }, [
        logoImg({ size: 64, eager: true }),
        el('h1', {}, ['الموقع غير مربوط بقاعدة البيانات بعد']),
        el('p', { class: 'card__text' }, [
          'انسخ ملف ', el('code', {}, ['config.example.js']), ' باسم ',
          el('code', {}, ['config.local.js']),
          ' واملأ فيه رابط Supabase والمفتاح العام، ثم أعد رفع المجلد.',
        ]),
        el('p', { class: 'card__text' }, ['الخطوات الكاملة في ملف README داخل المشروع.']),
      ]),
    ]),
  );
  document.documentElement.classList.add('js-ready');
}

async function boot() {
  // داخل معاينة اللوحة نستقبل الثيم منها حيّاً؛ خارجها لا أثر لهذا
  listenPreviewTheme();

  if (!isConfigured) return setupScreen();

  /* ── المسار السريع: نسخة الجهاز موجودة ── */
  if (hydrate()) {
    document.getElementById('preloader')?.remove();
    paint();
    // تحديث صامت: لا يعيد الرسم إلا إن اختلفت البيانات فعلاً
    loadAll()
      .then(({ changed }) => { if (changed) paint(); })
      .catch((e) => console.warn('[boot] تحديث صامت فشل', e));
    return;
  }

  /* ── الزيارة الأولى ── */
  const pre = showPreloader(document.getElementById('preloader'));
  await loadAll();
  paint();
  preloader.hide(pre);

  if (anyFailed()) toast('بعض الأقسام لم تُحمَّل — حدّث الصفحة', 'warn', 6000);
}

boot().catch((err) => {
  console.error('[boot]', err);
  document.documentElement.classList.add('js-ready');
  preloader.hide(document.getElementById('preloader'));
  toast('تعذّر تحميل المحتوى. حدّث الصفحة أو حاول لاحقاً.', 'error', 8000);
});

/* ── التخزين المؤقّت للملفات نفسها ──
   عامل الخدمة يحفظ CSS و JS والخطوط والصور عند أول زيارة، فتفتح
   الزيارات التالية من القرص بلا شبكة أصلاً. */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* ليس ضرورياً */ });
  });
}
