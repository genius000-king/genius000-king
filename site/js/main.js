// main.js — نقطة الدخول الوحيدة. تسجيل قسم = سطر واحد في SECTIONS.
import { loadAll } from './core/store.js';
import { scan } from './motion/registry.js';
import { el } from './core/dom.js';
import './motion/index.js';                    // تسجيل المؤثرات الخمسة والعشرين
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
    el('span', { class: 'preloader__brand' }, ['aboal3z.dzn']),
    el('span', { class: 'preloader__bar' }),
  ]));
  node.dataset.on = '1';
  return node;
}

async function boot() {
  const pre = showPreloader(document.getElementById('preloader'));
  await loadAll();

  for (const [id, mount] of SECTIONS) {
    const container = document.getElementById(id);
    if (container) mount(container);
  }

  scan(document);
  preloader.hide(pre);
}

boot().catch((err) => {
  console.error('[boot]', err);
  preloader.hide(document.getElementById('preloader'));
  const box = document.getElementById('toast');
  if (box) box.textContent = 'تعذّر تحميل المحتوى. حدّث الصفحة أو حاول لاحقاً.';
});
