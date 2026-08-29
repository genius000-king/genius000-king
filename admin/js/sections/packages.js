// packages — شريط مربعات، داخل كل مربع اللوجو فقط. النقر يفتح لوحة البكج.
import { el, published } from '../core/dom.js';
import { get, content } from '../core/store.js';
import { openPanel } from '../core/panel.js';
import { sectionHead } from '../components/head.js';
import { applyEditable } from '../components/editable.js';

function square(pkg) {
  return el('button', {
    class: 'pkg card', type: 'button',
    'data-edit-id': `package.card.${pkg.id}`,
    'data-fx': 'tilt shine reveal-swap',
    'data-cursor': 'افتح',
    'aria-label': pkg.name,
    onclick: () => openPanel(`pkg-${pkg.id}`,
      () => import('../panels/package-detail.js'), { id: pkg.id }),
  }, [
    pkg.logo_url
      ? el('img', { class: 'pkg__logo', src: pkg.logo_url, alt: pkg.name,
          loading: 'lazy', decoding: 'async', width: '200', height: '200' })
      : el('span', { class: 'pkg__fallback' }, [pkg.name]),
    pkg.cover_url
      ? el('img', { class: 'pkg__cover', src: pkg.cover_url, alt: '', 'data-swap': '',
          loading: 'lazy', decoding: 'async', width: '200', height: '200' })
      : null,
  ]);
}

export function mount(root, opts = {}) {
  const list = published(get('packages'));
  root.replaceChildren(
    sectionHead('packages', content('packages_title'), content('packages_sub')),
    // ⚙ لا يظهر إلا في وضع التحرير داخل لوحة المشرف
    opts.editable
      ? el('div', { class: 'bento' }, [
          el('button', { class: 'btn', type: 'button',
            onclick: () => document.dispatchEvent(new CustomEvent('leader:packages')) },
            ['⚙ إدارة البكجات'])])
      : null,
    el('div', { class: 'bleed' }, [
      el('div', { class: 'marquee', 'data-fx': 'marquee', 'data-fx-speed': '22',
        'data-cursor': 'اسحب' },
        [el('div', { class: 'marquee__track' }, list.map(square))]),
    ]),
  );

  applyEditable(root, opts);
}
