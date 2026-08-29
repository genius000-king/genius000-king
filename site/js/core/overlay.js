// overlay.js — مكدّس الطبقات المنبثقة (لوحة، لايتبوكس، درج).
// يوحّد التعامل مع السجل حتى لا يغلق زر الرجوع طبقتين دفعة واحدة،
// ولا يغادر الموقع بدل إغلاق الطبقة.
const stack = [];
let popping = false;

export function push(onPop) {
  stack.push(onPop);
  try { history.pushState({ overlay: stack.length }, '', location.href); } catch { /* */ }
}

/** يزيل طبقة أُغلقت برمجياً ويستهلك مدخلها من السجل. */
export function pop(onPop) {
  const i = stack.lastIndexOf(onPop);
  if (i === -1) return;
  stack.splice(i, 1);
  if (popping) return;
  popping = true;
  try { history.back(); } catch { /* */ }
  setTimeout(() => { popping = false; }, 60);
}

/** يزيل الطبقة بلا لمس السجل. */
export function drop(onPop) {
  const i = stack.lastIndexOf(onPop);
  if (i > -1) stack.splice(i, 1);
}

/** يستبدل طبقة بأخرى في نفس موضع السجل. */
export function replace(oldPop, newPop) {
  const i = stack.lastIndexOf(oldPop);
  if (i === -1) { push(newPop); return; }
  stack[i] = newPop;
}

export function depth() { return stack.length; }
export function top() { return stack[stack.length - 1] || null; }

addEventListener('popstate', () => {
  const onPop = stack.pop();
  if (onPop) onPop();
});
