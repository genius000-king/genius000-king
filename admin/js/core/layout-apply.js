// layout-apply.js — يطبّق جدول `layout` على الأقسام:
// الترتيب · الإظهار · عدد الأعمدة · المسافة · خلفية القسم.
import { get } from './store.js';

const SAFE_BG = /^(#[0-9a-f]{3,8}|rgba?\([\d\s,.%]+\)|linear-gradient\([^;{}<>]+\)|radial-gradient\([^;{}<>]+\)|var\(--[\w-]+\))$/i;
const SAFE_URL = /^https?:\/\/[^\s'"<>{}]+$/i;

/** دالة خالصة: تحوّل صف تخطيط إلى أنماط مضمونة. */
export function stylesFor(row = {}) {
  const out = {};
  const cols = Number(row.columns);
  if (Number.isFinite(cols) && cols >= 1 && cols <= 6) out['--cols'] = String(cols);
  if (row.gap && /^[\d.]+(px|rem)$|^var\(--[\w-]+\)$/.test(row.gap)) out['--gap'] = row.gap;
  if (row.align) out['--align-items'] = ['start', 'center', 'end', 'stretch'].includes(row.align) ? row.align : 'stretch';

  if (row.bg_type === 'color' && SAFE_BG.test(row.bg_value || '')) out.background = row.bg_value;
  else if (row.bg_type === 'gradient' && SAFE_BG.test(row.bg_value || '')) out.backgroundImage = row.bg_value;
  else if (row.bg_type === 'image' && SAFE_URL.test(row.bg_value || '')) {
    out.backgroundImage = `linear-gradient(rgba(6,9,18,.72), rgba(6,9,18,.72)), url("${row.bg_value}")`;
    out.backgroundSize = 'cover';
    out.backgroundPosition = 'center';
  }
  return out;
}

export function applyLayout(rows = get('layout'), doc = document) {
  const list = [...rows].sort((a, b) => (a.sort ?? 99) - (b.sort ?? 99));
  list.forEach((row, i) => {
    const node = doc.getElementById(row.section_key);
    if (!node) return;
    node.style.order = String(i);
    node.hidden = row.visible === false;
    const styles = stylesFor(row);
    for (const [k, v] of Object.entries(styles)) {
      k.startsWith('--') ? node.style.setProperty(k, v) : (node.style[k] = v);
    }
  });
  return list;
}
