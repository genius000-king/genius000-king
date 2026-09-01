// payments — بلاطات طرق الدفع. عرض بحت: صفر منطق دفع.
import { el, published, setKids } from '../core/dom.js';
import { get, content } from '../core/store.js';
import { sectionHead } from '../components/head.js';
import { applyEditable } from '../components/editable.js';

function tile(m) {
  // shape/fit اختيار المشرف — auto+contain هو الافتراضي القديم بحرفه،
  // فمن لا يلمسهما لا يرى فرقاً. الاثنان مستقلّان (كل تركيبة ممكنة).
  const mods = [
    m.shape === 'square' ? 'pay--square' : null,
    m.fit === 'cover' ? 'pay--fill' : null,
  ].filter(Boolean);

  return el('div', { class: ['card', 'pay', 'glass', 'glass--soft', 't--quarter', ...mods].join(' '),
    'data-edit-id': `payment.card.${m.id}`, 'data-fx': 'shine' }, [
    m.logo_url
      ? el('img', { class: 'pay__logo', src: m.logo_url, alt: m.name || '',
          loading: 'lazy', decoding: 'async', width: '120', height: '46' })
      : null,
    m.name ? el('span', { class: 'pay__name' }, [m.name]) : null,
  ]);
}

export function mount(root, opts = {}) {
  const list = published(get('payment_methods'));
  if (!list.length && !opts.editable) { setKids(root,); root.hidden = true; return; }
  root.hidden = false;

  const note = content('payments_note');

  setKids(root,
    sectionHead('payments', content('payments_title'), content('payments_sub'), 'الدفع'),
    el('div', { class: 'bento bento--flow', 'data-fx': 'reveal', 'data-fx-children': '.pay' }, [
      ...list.map(tile),
      note ? el('p', { class: 'pay__note' }, [note]) : null,
    ]),
  );

  applyEditable(root, opts);
}
