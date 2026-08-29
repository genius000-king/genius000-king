// main.js — نقطة دخول لوحة المشرف.
// المعاينة تستورد نفس ملفات js/sections/* حرفياً وتمرّر { editable }.
import { loadAll } from './core/store.js';
import { scan, destroyIn } from './motion/registry.js';
import { restore, isAuthed } from './core/auth.js';
import { mountAuth } from './panels/auth-screen.js';
import { mountToolbar } from './panels/toolbar.js';
import { loadTheme } from './core/theme.js';
import { applyOverrides, allOverrides, clearAll } from './core/overrides.js';
import { applyLayout } from './core/layout.js';
import { get } from './core/store.js';
import { confirmModal } from './core/modal.js';
import { toast } from './core/toast.js';
import './motion/index.js';

// استيراد الألواح لتسجيل مستمعاتها على `document` — كل واحد يفتح بحدثه
import './panels/theme-panel.js';
import './panels/layout-panel.js';
import './panels/orders.js';
import './panels/packages-manager.js';
import './panels/catalog-manager.js';

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
import { refreshBadge } from './panels/orders.js';

const SECTIONS = [
  ['nav', nav], ['hero', hero], ['about', about], ['works', works],
  ['packages', packages], ['services', services], ['process', process],
  ['testimonials', testimonials], ['payments', payments], ['order', order],
  ['footer', footer],
];

let editable = false;

/** يعيد بناء المعاينة كاملة — يُستدعى بعد أي تغيير بنيوي. */
export async function renderPreview() {
  const preview = document.getElementById('preview');
  destroyIn(preview);
  for (const [id, mount] of SECTIONS) {
    const container = document.getElementById(id);
    if (container) mount(container, { editable });
  }
  scan(preview);
}

async function enter() {
  document.getElementById('auth').hidden = true;
  document.getElementById('auth').replaceChildren();
  document.getElementById('shell').hidden = false;

  mountToolbar(document.getElementById('toolbar'), { onReload: renderPreview });
  await loadAll(['orders']);

  // الثيم ثم التجاوزات ثم التخطيط — بهذا الترتيب: الأعمّ فالأخصّ
  await loadTheme();
  applyOverrides(get('overrides'));
  applyLayout(get('layout'));

  await renderPreview();
  refreshBadge();

  document.addEventListener('leader:mode', async (e) => {
    editable = e.detail.mode === 'edit';
    await renderPreview();
  });

  document.addEventListener('leader:clear-overrides', async () => {
    if (!await confirmModal({
      title: 'مسح كل التجاوزات؟',
      body: 'ترجع كل العناصر لقيم الثيم. لا يمكن التراجع.',
      confirm: 'مسح',
    })) return;
    await clearAll();
    toast('مُسحت كل التجاوزات', 'success');
  });
}

function boot() {
  restore();
  if (isAuthed()) return enter();
  mountAuth(document.getElementById('auth'), enter);
}

boot();
