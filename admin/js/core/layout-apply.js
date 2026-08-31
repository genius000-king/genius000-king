// layout-apply.js — يطبّق جدول `layout` على الأقسام:
// الترتيب · الإظهار · العرض بالأعمدة · عدد الأعمدة الداخلية ·
// المسافة · خلفية القسم.
//
// لكل قسم قيمتان: واحدة لسطح المكتب وأخرى للجوال (‎*_m‎). الترتيب
// والعرض والإظهار **لا يرث الجوال فيها سطح المكتب**: نصفُ عرضٍ
// يناسب شاشة عريضة يصير شريطاً لا يُقرأ على شاشة صغيرة. أما ما ليس
// تخطيطاً — الخلفية والمسافة — فمشترك بين الجهازين.
import { get } from './store.js';

const SAFE_BG = /^(#[0-9a-f]{3,8}|rgba?\([\d\s,.%]+\)|linear-gradient\([^;{}<>]+\)|radial-gradient\([^;{}<>]+\)|var\(--[\w-]+\))$/i;
const SAFE_URL = /^https?:\/\/[^\s'"<>{}]+$/i;

const span = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 12 ? Math.round(n) : 12;
};

/** دالة خالصة: تحوّل صف تخطيط إلى أنماط مضمونة. */
export function stylesFor(row = {}) {
  const out = {};
  const cols = Number(row.columns);
  if (Number.isFinite(cols) && cols >= 1 && cols <= 6) out['--cols'] = String(cols);
  if (row.gap && /^[\d.]+(px|rem)$|^var\(--[\w-]+\)$/.test(row.gap)) out['--gap'] = row.gap;
  if (row.align) out['--align-items'] = ['start', 'center', 'end', 'stretch'].includes(row.align) ? row.align : 'stretch';

  const s = span(row.span);
  const sm = span(row.span_m);
  out['--span'] = String(s);
  out['--span-m'] = String(sm);
  // قسمٌ أضيق من الكامل: حاوياته الداخلية تأخذ عرضه هو لا عرض الصفحة،
  // وإلا فاضت خارجه. الكامل يترك ‎--container‎ يعمل كما كان.
  if (s < 12 || sm < 12) out['--section-w'] = '100%';

  if (row.bg_type === 'color' && SAFE_BG.test(row.bg_value || '')) out.background = row.bg_value;
  else if (row.bg_type === 'gradient' && SAFE_BG.test(row.bg_value || '')) out.backgroundImage = row.bg_value;
  else if (row.bg_type === 'image' && SAFE_URL.test(row.bg_value || '')) {
    out.backgroundImage = `linear-gradient(rgba(19,20,23,.74), rgba(19,20,23,.74)), url("${row.bg_value}")`;
    out.backgroundSize = 'cover';
    out.backgroundPosition = 'center';
  }
  return out;
}

/** هل نحن على شاشة جوال؟ نفس نقطة التوقّف في CSS (640px). */
export const isNarrow = (win = window) =>
  typeof win.matchMedia === 'function' && win.matchMedia('(max-width: 640px)').matches;

export function applyLayout(rows = get('layout'), doc = document, win = window) {
  const narrow = isNarrow(win);
  // الترتيب يُقرأ من عمود الجهاز الحالي — والجوال لا يرث ترتيب المكتب
  const key = narrow ? 'sort_m' : 'sort';
  const list = [...rows].sort((a, b) => (a[key] ?? a.sort ?? 99) - (b[key] ?? b.sort ?? 99));

  list.forEach((row, i) => {
    const node = doc.getElementById(row.section_key);
    if (!node) return;
    node.style.order = String(i);
    // الإخفاء بيدين: المشرف من هذا الجدول، والقسمُ نفسه إن كان فارغاً
    // (طرق الدفع والآراء تخفي نفسها بلا بيانات). فلا نرفع إخفاءً لم
    // نضعه نحن — وإلا أظهر إعادةُ التطبيق عند العبور قسماً فارغاً.
    const off = (narrow ? row.visible_m : row.visible) === false;
    if (off) { node.hidden = true; node.dataset.layoutHid = '1'; }
    else if (node.dataset.layoutHid === '1') { node.hidden = false; delete node.dataset.layoutHid; }
    const styles = stylesFor(row);
    for (const [k, v] of Object.entries(styles)) {
      k.startsWith('--') ? node.style.setProperty(k, v) : (node.style[k] = v);
    }
  });
  return list;
}

/* ── متابعة نقطة التوقّف ──
   الترتيب والإظهار يُقرآن من عمود الجهاز، وهما يُطبَّقان مرّةً عند
   الرسم. لو دار الجوّال أو تغيّر عرض النافذة عبر ٦٤٠px بقي ترتيب
   الجهاز الآخر لاصقاً — لذلك نعيد التطبيق عند العبور وحده، لا عند
   كل بكسل. مستمعٌ واحدٌ للصفحة كلّها مهما تكرّر النداء. */
let watching = false;
export function watchLayout(doc = document, win = window) {
  if (watching || typeof win.matchMedia !== 'function') return;
  const mq = win.matchMedia('(max-width: 640px)');
  const onCross = () => applyLayout(get('layout'), doc, win);
  // Safari القديم لا يعرف addEventListener على MediaQueryList
  if (mq.addEventListener) mq.addEventListener('change', onCross);
  else if (mq.addListener) mq.addListener(onCross);
  else return;
  watching = true;
}
