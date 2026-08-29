// ============================================================
// main.js — نقطة الدخول الوحيدة لموقع العملاء.
// تسجيل قسم = سطر واحد في SECTIONS.
// ============================================================
import { isConfigured } from './core/config.js';
import { loadAll, anyFailed } from './core/store.js';
import { loadTheme } from './core/theme.js';
import { applyLayout } from './core/layout-apply.js';
import { scan } from './motion/registry.js';
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

function showPreloader(node) {
  if (!node || !preloader.shouldShow()) { node?.remove(); return null; }
  node.append(el('div', { class: 'preloader__inner' }, [
    logoImg({ size: 76, cls: 'preloader__logo' }),
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
        logoImg({ size: 64 }),
        el('h1', {}, ['الموقع غير مربوط بقاعدة البيانات بعد']),
        el('p', { class: 'card__text' }, [
          'انسخ ملف ', el('code', {}, ['config.example.js']), ' باسم ',
          el('code', {}, ['config.local.js']),
          ' واملأ فيه رابط Supabase والمفتاح العام، ثم أضف قبل وسم main.js:',
        ]),
        el('pre', { style: { direction: 'ltr', overflowX: 'auto', padding: '12px',
          background: 'rgba(0,0,0,.35)', borderRadius: '12px', fontSize: '13px' } },
          ['<script src="config.local.js"></script>']),
        el('p', { class: 'card__text' }, ['الخطوات الكاملة في ملف README داخل المشروع.']),
      ]),
    ]),
  );
  document.documentElement.classList.add('js-ready');
}

async function boot() {
  if (!isConfigured) return setupScreen();

  const pre = showPreloader(document.getElementById('preloader'));

  await loadAll();
  await loadTheme();
  applyLayout();

  for (const [id, mount] of SECTIONS) {
    const container = document.getElementById(id);
    if (!container) continue;
    try { mount(container); }
    catch (e) { console.error(`[section:${id}]`, e); }
  }

  document.documentElement.classList.add('js-ready');
  scan(document);
  preloader.hide(pre);

  if (anyFailed()) toast('بعض الأقسام لم تُحمَّل — حدّث الصفحة', 'warn', 6000);
}

boot().catch((err) => {
  console.error('[boot]', err);
  document.documentElement.classList.add('js-ready');
  preloader.hide(document.getElementById('preloader'));
  toast('تعذّر تحميل المحتوى. حدّث الصفحة أو حاول لاحقاً.', 'error', 8000);
});
