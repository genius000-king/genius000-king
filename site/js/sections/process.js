// process — خط زمني يرسم نفسه فوق خلفية سائلة.
import { el, published } from '../core/dom.js';
import { get, content } from '../core/store.js';
import { sectionHead } from '../components/head.js';
import { applyEditable } from '../components/editable.js';

function step(s, i) {
  return el('li', { class: 'step', 'data-edit-id': `process.step.${s.id}` }, [
    el('span', { class: 'step__num' }, [String(i + 1)]),
    el('h3', { class: 'step__title' }, [s.name]),
    el('p', { class: 'card__text' }, [s.description || '']),
  ]);
}

/** خط SVG عمودي يمرّ بكل المراحل — `draw-line.js` يرسمه مع التمرير. */
function line() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'process__line');
  svg.setAttribute('viewBox', '0 0 4 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M2 0 L2 100');
  path.setAttribute('stroke', 'var(--c-accent)');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('fill', 'none');
  svg.append(path);
  return svg;
}

export function mount(root, opts = {}) {
  const list = published(get('process_steps'));
  root.replaceChildren(
    el('canvas', { class: 'fx-canvas', 'data-fx': 'liquid', 'aria-hidden': 'true' }),
    sectionHead('process', content('process_title'), content('process_sub')),
    el('div', { class: 'bento process', 'data-fx': 'draw-line' }, [
      line(),
      el('ol', { class: 'process__list', 'data-fx': 'reveal', 'data-fx-children': '.step' },
        list.map(step)),
    ]),
  );

  applyEditable(root, opts);
}
