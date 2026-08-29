// packages — جدار بلاطات البكجات. النقر يفتح لوحة البكج بنظام البينتو.
import { el, published, emptyState, errorState } from '../core/dom.js';
import { get, content, blocksOf, didFail, reload } from '../core/store.js';
import { openPanel } from '../core/panel.js';
import { sectionHead } from '../components/head.js';
import { applyEditable } from '../components/editable.js';

const SPANS = ['t--wide-tall', 't--tall', 't--tall', 't--box', 't--box', 't--wide'];

function tile(pkg, span) {
  const blocks = blocksOf(pkg.id);
  const shots = blocks.reduce((n, b) => n + (Array.isArray(b.images) ? b.images.length : 0), 0);

  return el('button', {
    class: `pkg glass glass--lift ${span}`, type: 'button',
    'data-edit-id': `package.card.${pkg.id}`,
    'data-fx': 'tilt glass shine',
    'data-cursor': 'افتح',
    'aria-label': `افتح بكج ${pkg.name}`,
    onclick: () => openPanel(`pkg-${pkg.id}`,
      () => import('../panels/package-detail.js'), { id: pkg.id }),
  }, [
    pkg.cover_url
      ? el('img', { class: 'pkg__cover', src: pkg.cover_url, alt: '',
          loading: 'lazy', decoding: 'async' })
      : null,
    pkg.logo_url
      ? el('img', { class: 'pkg__logo', src: pkg.logo_url, alt: '',
          loading: 'lazy', decoding: 'async', width: '200', height: '200' })
      : el('span', { class: 'pkg__fallback' }, [pkg.name || '؟']),
    el('span', { class: 'pkg__name' }, [pkg.name || '']),
    shots ? el('span', { class: 'pkg__count' }, [`${shots} صورة`]) : null,
  ]);
}

export function mount(root, opts = {}) {
  const head = sectionHead('packages', content('packages_title'), content('packages_sub'), 'الحزم');

  if (didFail('packages')) {
    root.replaceChildren(head, el('div', { class: 'bento bento--flow' }, [
      errorState('تعذّر تحميل البكجات.', async () => {
        await reload('packages').catch(() => {}); mount(root, opts);
      }),
    ]));
    return;
  }

  const list = published(get('packages'));

  root.replaceChildren(
    head,
    opts.editable
      ? el('div', { class: 'bento bento--flow' }, [
          el('button', { class: 'btn t--third', type: 'button',
            onclick: () => document.dispatchEvent(new CustomEvent('leader:packages')) },
            ['⚙ إدارة البكجات'])])
      : null,
    list.length
      ? el('div', { class: 'bento', 'data-fx': 'reveal', 'data-fx-children': '.pkg' },
          list.map((p, i) => tile(p, SPANS[i % SPANS.length])))
      : el('div', { class: 'bento bento--flow' }, [
          emptyState('لا توجد بكجات منشورة بعد', 'أضِف بكجاً من لوحة التحكم لتظهر هنا.'),
        ]),
  );

  applyEditable(root, opts);
}
