// toast.js — تنبيه مؤقّت. يتكدّس رأسياً ويختفي وحده.
import { el } from './dom.js';

const DURATION = 3800;

export function toast(message, kind = 'info', ms = DURATION) {
  const box = document.getElementById('toast');
  if (!box) { console.log(`[toast:${kind}]`, message); return null; }

  const node = el('div', { class: 'toast', 'data-kind': kind }, [
    el('span', {}, [message]),
  ]);
  box.append(node);

  const kill = () => {
    node.classList.add('is-out');
    node.addEventListener('animationend', () => node.remove(), { once: true });
    setTimeout(() => node.remove(), 400);
  };
  const t = setTimeout(kill, ms);
  node.addEventListener('click', () => { clearTimeout(t); kill(); });
  return node;
}
