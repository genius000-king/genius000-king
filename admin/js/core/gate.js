// ============================================================
// gate.js — قفل أوّلي على اللوحة.
//
// هذا القفل *قبل* تسجيل الدخول، وليس بديلاً عنه: حمايتك الحقيقية
// تبقى حساب Supabase وسياسات RLS. وظيفته أن أي شخص يفتح الرابط
// بالصدفة لا يرى شيئاً — ولا حتى شاشة الدخول.
//
// لتغيير الكلمة: بدّل PASSCODE أدناه وارفع الملف. لا شيء آخر.
// ============================================================
import { el, on } from './dom.js';
import { logoMark } from '../shell/logo.js';
import logoFx from '../motion/logo-mark.js';

/** كلمة الدخول للوحة. */
const PASSCODE = 'ليدر';
/** تُقبل هذه أيضاً حين تكون لوحة المفاتيح إنجليزية. */
const ALIASES = ['leader'];

const KEY = 'aboal3z:gate';
const norm = (v) => String(v || '').trim().toLowerCase();

function ok(v) {
  const s = norm(v);
  return s === norm(PASSCODE) || ALIASES.some((a) => norm(a) === s);
}

export function isUnlocked() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function lock() {
  try { localStorage.removeItem(KEY); } catch { /* تجاهل */ }
}

/** يعرض القفل ويستدعي onPass عند نجاح الكلمة. */
export function mountGate(root, onPass) {
  const err = el('p', { class: 'fld__err', role: 'alert', style: { minBlockSize: '1.2em' } });
  const input = el('input', {
    type: 'password', class: 'field', autocomplete: 'off',
    'aria-label': 'كلمة الدخول', placeholder: 'كلمة الدخول',
  });
  const btn = el('button', { class: 'btn btn--primary btn--lg btn--block', type: 'submit' }, ['دخول']);
  const mark = logoMark();

  const form = el('form', {
    class: 'card auth__card',
    onsubmit: (e) => {
      e.preventDefault();
      if (!ok(input.value)) {
        err.textContent = 'كلمة الدخول غير صحيحة';
        input.value = '';
        input.focus();
        return;
      }
      try { localStorage.setItem(KEY, '1'); } catch { /* وضع خاص */ }
      onPass();
    },
  }, [
    mark,
    el('h1', { class: 'auth__title' }, ['لوحة محمية']),
    el('p', { class: 'auth__sub' }, ['اكتب كلمة الدخول للمتابعة']),
    input, err, btn,
  ]);

  root.replaceChildren(el('div', { class: 'auth' }, [form]));
  try { logoFx.init(mark, {}); } catch (e) { console.warn('[logo]', e); }
  input.focus();

  // الكيبورد على الجوال يغطّي الحقل أحياناً — نعيده للعرض
  on(input, 'focus', () => setTimeout(() => input.scrollIntoView({ block: 'center' }), 250));
}
