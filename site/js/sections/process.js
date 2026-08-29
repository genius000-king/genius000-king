// process — خط زمني يرسم نفسه: أفقي على سطح المكتب، عمودي على الجوال.
import { el, svgEl, published, emptyState, setKids } from '../core/dom.js';
import { get, content } from '../core/store.js';
import { sectionHead } from '../components/head.js';
import { applyEditable } from '../components/editable.js';

function step(s, i) {
  return el('li', { class: 'step card glass glass--soft', 'data-edit-id': `process.step.${s.id}` }, [
    el('span', { class: 'step__num' }, [String(i + 1)]),
    el('h3', { class: 'step__title' }, [s.name]),
    s.description ? el('p', { class: 'card__text' }, [s.description]) : null,
  ]);
}

function line() {
  return svgEl('svg', {
    class: 'process__line', viewBox: '0 0 100 2',
    preserveAspectRatio: 'none', 'aria-hidden': 'true',
  }, [svgEl('path', {
    d: 'M0 1 L100 1', stroke: 'url(#pgrad)', 'stroke-width': '2', fill: 'none',
  }), svgEl('defs', {}, [
    svgEl('linearGradient', { id: 'pgrad', x1: '0', x2: '1' }, [
      svgEl('stop', { offset: '0', 'stop-color': 'var(--c-accent)' }),
      svgEl('stop', { offset: '1', 'stop-color': 'var(--c-accent-2)' }),
    ]),
  ])]);
}

export function mount(root, opts = {}) {
  const list = published(get('process_steps'));
  const head = sectionHead('process', content('process_title'), content('process_sub'), 'الطريقة');

  setKids(root,
    head,
    list.length
      ? el('div', { class: 'bento bento--flow' }, [
          el('div', { class: 'process t--full', style: { '--steps': list.length },
            'data-fx': 'draw-line' }, [
            line(),
            el('ol', { class: 'process__list', style: { '--steps': list.length },
              'data-fx': 'reveal', 'data-fx-children': '.step' }, list.map(step)),
          ]),
        ])
      : el('div', { class: 'bento bento--flow' }, [emptyState('لم تُضَف خطوات العمل بعد')]),
  );

  applyEditable(root, opts);
}
