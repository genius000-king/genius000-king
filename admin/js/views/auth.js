// auth.js — شاشة الدخول: كلمة مرور واحدة.
//
// البريد ثابت في الإعدادات (ADMIN_EMAIL) فلا يُكتب في كل مرّة — لكن
// ما يُرسَل إلى Supabase هو نفسه، والتحقّق يبقى على الخادم. إن لم
// يُضبط البريد بعد نُظهر حقله أيضاً، فلا يُحبَس المشرف خارج لوحته.
//
// ❌ لا تسجيل ذاتي · ❌ لا دخول اجتماعي · ❌ لا كلمة مرور في الكود.
import { el } from '../core/dom.js';
import { signIn, hasAdminEmail } from '../core/auth.js';
import { isConfigured } from '../core/config.js';
import { logoImg, logoMark } from '../shell/logo.js';
import logoFx from '../motion/logo-mark.js';

export function mountAuth(root, onDone) {
  if (!isConfigured) return mountSetup(root);

  const solo = hasAdminEmail();          // بريد مضبوط ← كلمة المرور تكفي

  const err = el('p', { class: 'fld__err', role: 'alert', style: { minBlockSize: '1.2em' } });
  const email = solo ? null : el('input', { type: 'email', class: 'field',
    autocomplete: 'username', required: true,
    'aria-label': 'البريد الإلكتروني', placeholder: 'البريد الإلكتروني' });
  const pass = el('input', { type: 'password', class: 'field', autocomplete: 'current-password',
    required: true, 'aria-label': 'كلمة المرور', placeholder: 'كلمة المرور' });
  const submit = el('button', { class: 'btn btn--primary btn--lg btn--block', type: 'submit' }, ['دخول']);
  const mark = logoMark();

  const form = el('form', { class: 'card auth__card', onsubmit: async (e) => {
    e.preventDefault();
    err.textContent = '';
    submit.disabled = true;
    submit.textContent = 'جارٍ الدخول…';
    try {
      await signIn(pass.value, email ? email.value.trim() : undefined);
      onDone();
    } catch (ex) {
      err.textContent = ex.message || 'تعذّر تسجيل الدخول';
      submit.disabled = false;
      submit.textContent = 'دخول';
      pass.value = '';
      pass.focus();
    }
  } }, [
    mark,
    el('h1', { class: 'auth__title' }, ['aboal3z.dzn']),
    el('p', { class: 'auth__sub' }, ['لوحة التحكم']),
    email, pass, err, submit,
    solo ? null : el('p', { class: 'fld__hint' }, [
      'أضِف ', el('code', {}, ['ADMIN_EMAIL']), ' في config.local.js ليكفيك إدخال كلمة المرور.',
    ]),
  ]);

  root.replaceChildren(el('div', { class: 'auth' }, [form]));
  // الشعار يتفاعل مع السحب في أي مكان من الشاشة — نفس سلوك الموقع
  try { logoFx.init(mark, {}); } catch (e) { console.warn('[logo]', e); }
  (email || pass).focus();
}

/** لا اتصال بعد — نعرض خطوات الإعداد بدل شاشة دخول لا تعمل. */
function mountSetup(root) {
  root.replaceChildren(el('div', { class: 'auth' }, [
    el('div', { class: 'card auth__card', style: { textAlign: 'start', gap: 'var(--a-4)' } }, [
      logoImg(48, 'auth__logo'),
      el('h1', { class: 'auth__title' }, ['اللوحة غير مربوطة بعد']),
      el('p', { class: 'fld__hint' }, [
        'انسخ config.example.js باسم config.local.js في مجلد admin، واملأ رابط Supabase والمفتاح العام، ثم أضف قبل وسم main.js:',
      ]),
      el('pre', { class: 'mono', style: {
        padding: 'var(--a-3)', background: 'var(--a-panel-2)', borderRadius: 'var(--a-r-sm)',
        fontSize: '12px', overflowX: 'auto', border: '1px solid var(--a-line)',
      } }, ['<script src="config.local.js"></script>']),
      el('p', { class: 'fld__hint' }, ['الخطوات الكاملة في ملف README.md داخل المشروع.']),
    ]),
  ]));
}
