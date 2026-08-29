// ============================================================
// main.js — نقطة دخول لوحة المشرف.
// إضافة قسم = سطر في nav-map.js + سطر route هنا.
// ============================================================
import { isConfigured } from './core/config.js';
import { loadAll, hydrate, anyFailed } from './core/store.js';
import { restore, isAuthed } from './core/auth.js';
import { isUnlocked, mountGate } from './core/gate.js';
import { route, start, resolve } from './core/router.js';
import { toast } from './core/toast.js';
import { el } from './core/dom.js';

import { mountAuth } from './views/auth.js';
import { mountSidebar, setActive } from './shell/sidebar.js';
import { mountTopbar } from './shell/topbar.js';
import { mountTabbar, setActiveTab } from './shell/tabbar.js';

import * as dashboard from './views/dashboard.js';
import * as orders from './views/orders.js';
import * as content from './views/content.js';
import * as works from './views/works.js';
import * as packages from './views/packages.js';
import * as catalog from './views/catalog.js';
import * as appearance from './views/appearance.js';
import * as layout from './views/layout.js';
import * as preview from './views/preview.js';
import * as settings from './views/settings.js';

const EXTRA_TABLES = ['orders'];
let topbar = null;

function main() { return document.getElementById('main'); }

/** غلاف يمسك أخطاء العرض فلا يترك الشاشة بيضاء. */
function safe(fn) {
  return async (params) => {
    const host = main();
    try { await fn(host, params); host.scrollTop = 0; }
    catch (e) {
      console.error('[view]', e);
      host.replaceChildren(el('div', { class: 'view' }, [
        el('div', { class: 'empty' }, [
          el('p', { class: 'empty__title' }, ['تعذّر عرض هذه الصفحة']),
          el('p', { class: 'mono', style: { fontSize: '12px' } }, [String(e.message || e)]),
          el('button', { class: 'btn', type: 'button', onclick: () => location.reload() }, ['تحديث']),
        ]),
      ]));
    }
  };
}

function registerRoutes() {
  route('/',                safe(dashboard.render));
  route('/orders',          safe(orders.render));
  route('/orders/:id',      safe(orders.render));
  route('/content',         safe(content.render));
  route('/works',           safe(works.render));
  route('/packages',        safe(packages.render));
  route('/packages/:id',    safe(packages.render));
  route('/catalog',         safe(catalog.render));
  route('/appearance',      safe(appearance.render));
  route('/layout',          safe(layout.render));
  route('/preview',         safe(preview.render));
  route('/settings',        safe(settings.render));
}

async function enter() {
  document.getElementById('auth').hidden = true;
  document.getElementById('auth').replaceChildren();
  document.getElementById('app').hidden = false;

  mountSidebar(document.getElementById('sidebar'));
  topbar = mountTopbar(document.getElementById('topbar'));
  mountTabbar(document.getElementById('tabbar'));

  registerRoutes();

  const onRoute = (r) => {
    const base = '/' + (r.path.split('/')[1] || '');
    setActive(base === '/' ? '/' : base);
    setActiveTab(base === '/' ? '/' : base);
    topbar.setCrumb(r.path, r.params?.id);
  };

  /* ── المسار السريع: نسخة الجهاز موجودة ──
     نرسم فوراً ثم نسأل الشبكة بصمت. لا تُعاد الرسمة إلا إن اختلف شيء. */
  if (hydrate()) {
    await start(onRoute);
    orders.refreshBadge();
    loadAll(EXTRA_TABLES).then(({ failed, changed }) => {
      if (failed.length) toast(`تعذّر تحديث: ${failed.join('، ')}`, 'warn', 6000);
      if (changed) { resolve(); orders.refreshBadge(); }
    }).catch((e) => console.warn('[boot] تحديث صامت فشل', e));
    return;
  }

  const { failed } = await loadAll(EXTRA_TABLES);
  if (failed.length) toast(`تعذّر تحميل: ${failed.join('، ')}`, 'error', 8000);

  await start(onRoute);
  orders.refreshBadge();
}

function afterGate() {
  if (!isConfigured) return mountAuth(document.getElementById('auth'), enter);
  restore();
  if (isAuthed()) return enter();
  mountAuth(document.getElementById('auth'), enter);
}

function boot() {
  // قفل أوّلي قبل أي شيء — لا تظهر حتى شاشة الدخول بدونه
  if (!isUnlocked()) return mountGate(document.getElementById('auth'), afterGate);
  afterGate();
}

boot();

/* عامل الخدمة: ملفات اللوحة تُحفظ على القرص عند أول فتح، فتفتح
   المرّات التالية بلا انتظار شبكة. */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* ليس ضرورياً */ });
  });
}
