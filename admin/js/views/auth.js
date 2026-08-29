// auth.js — شاشة الدخول. بريد وكلمة مرور فقط: لا تسجيل ذاتي ولا دخول اجتماعي.
import { el } from '../core/dom.js';
import { signIn } from '../core/auth.js';
import { isConfigured } from '../core/config.js';
import { logoImg } from '../shell/logo.js';

export function mountAuth(root, onDone) {
  if (!isConfigured) return mountSetup(root);

  const err = el('p', { class: 'fld__err', role: 'alert', style: { minBlockSize: '1.2em' } });
  const email = el('input', { type: 'email', class: 'field', autocomplete: 'username',
    required: true, 'aria-label': 'البريد الإلكتروني', placeholder: 'البريد الإلكتروني' });
  const pass = el('input', { type: 'password', class: 'field', autocomplete: 'current-password',
    required: true, 'aria-label': 'كلمة المرور', placeholder: 'كلمة المرور' });
  const submit = el('button', { class: 'btn btn--primary btn--lg btn--block', type: 'submit' }, ['دخول']);

  const form = el('form', { class: 'card auth__card', onsubmit: async (e) => {
    e.preventDefault();
    err.textContent = '';
    submit.disabled = true;
    submit.textContent = 'جارٍ الدخول…';
    try {
      await signIn(email.value.trim(), pass.value);
      onDone();
    } catch (ex) {
      err.textContent = ex.message || 'تعذّر تسجيل الدخول';
      submit.disabled = false;
      submit.textContent = 'دخول';
      pass.value = '';
      pass.focus();
    }
  } }, [
    logoImg(56, 'auth__logo'),
    el('h1', { class: 'auth__title' }, ['aboal3z.dzn']),
    el('p', { class: 'auth__sub' }, ['لوحة التحكم']),
    email, pass, err, submit,
  ]);

  root.replaceChildren(el('div', { class: 'auth' }, [form]));
  email.focus();
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
