// toast.js — رسائل قصيرة بطابور. لا تتكدّس ولا تحجب الواجهة.
import { el } from './dom.js';

const DURATION = 3000;
const queue = [];
let showing = false;

function host() {
  let h = document.getElementById('toast');
  if (!h) { h = el('div', { id: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(h); }
  return h;
}

function next() {
  if (showing || !queue.length) return;
  const { msg, type } = queue.shift();
  showing = true;
  const node = el('div', { class: `toast toast--${type}` }, [msg]);
  host().append(node);
  requestAnimationFrame(() => node.classList.add('is-in'));
  setTimeout(() => {
    node.classList.remove('is-in');
    setTimeout(() => { node.remove(); showing = false; next(); }, 300);
  }, DURATION);
}

/** يعرض رسالة. type: info | success | error */
export function toast(msg, type = 'info') {
  queue.push({ msg: String(msg), type });
  next();
  return queue.length;
}

export function pending() { return queue.length + (showing ? 1 : 0); }

export default toast;
