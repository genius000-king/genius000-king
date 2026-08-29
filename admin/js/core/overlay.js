// overlay.js — مكدّس الطبقات المنبثقة (لوحة، لايتبوكس، لوح جانبي).
// يوحّد التعامل مع السجل حتى لا يغلق زر الرجوع طبقتين دفعة واحدة.
// كل طبقة تُضيف مدخلاً واحداً بنفس الرابط تماماً (Spec AD-2).

const stack = [];

/** يسجّل طبقة مفتوحة. `onPop` تُستدعى حين يطلب المستخدم إغلاقها من السجل. */
export function push(onPop) {
  stack.push(onPop);
  history.pushState({ overlay: stack.length }, '', location.href);
}

/** يزيل طبقة أُغلقت برمجياً ويستهلك مدخلها من السجل. */
export function pop(onPop) {
  const i = stack.lastIndexOf(onPop);
  if (i === -1) return;
  stack.splice(i, 1);
  history.back();
}

/** يزيل الطبقة بلا لمس السجل (عند الاستبدال المباشر). */
export function drop(onPop) {
  const i = stack.lastIndexOf(onPop);
  if (i > -1) stack.splice(i, 1);
}

/** يستبدل طبقة بأخرى في نفس موضع السجل (استبدال مباشر بلا مدخل جديد). */
export function replace(oldPop, newPop) {
  const i = stack.lastIndexOf(oldPop);
  if (i === -1) { push(newPop); return; }
  stack[i] = newPop;
}

export function depth() { return stack.length; }

addEventListener('popstate', () => {
  const onPop = stack.pop();
  if (onPop) onPop();
});
