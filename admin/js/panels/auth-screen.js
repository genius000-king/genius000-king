// شاشة الدخول — بريد وكلمة مرور فقط. لا تسجيل ذاتي ولا استعادة ولا دخول اجتماعي.
import { el } from '../core/dom.js';
import { signIn } from '../core/auth.js';

export function mountAuth(root, onDone) {
  const err = el('p', { class: 'auth__error', role: 'alert' });
  const email = el('input', { type: 'email', class: 'field', autocomplete: 'username',
    required: true, 'aria-label': 'البريد الإلكتروني', placeholder: 'البريد الإلكتروني' });
  const pass = el('input', { type: 'password', class: 'field', autocomplete: 'current-password',
    required: true, 'aria-label': 'كلمة المرور', placeholder: 'كلمة المرور' });
  const submit = el('button', { class: 'btn btn--primary btn--block', type: 'submit' }, ['دخول']);

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
    }
  } }, [
    el('h1', { class: 'auth__title' }, ['aboal3z.dzn']),
    el('p', { class: 'auth__sub' }, ['لوحة التحكم']),
    email, pass, err, submit,
  ]);

  root.replaceChildren(el('div', { class: 'auth__wrap' }, [form]));
  email.focus();
}
