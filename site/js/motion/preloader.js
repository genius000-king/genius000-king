// شاشة التحميل — تظهر مرة واحدة لكل زائر (قرار المالك).
const SEEN = 'aboal3z:seen';

export function shouldShow() {
  try { return !localStorage.getItem(SEEN); } catch { return true; }
}

export function markSeen() {
  try { localStorage.setItem(SEEN, '1'); } catch { /* وضع خاص — لا بأس */ }
}

/** يخفي البريلودر ويزيله من الـ DOM بعد انتهاء الانتقال. */
export function hide(node) {
  if (!node) return;
  node.classList.add('is-out');
  markSeen();
  setTimeout(() => node.remove(), 700);
}
