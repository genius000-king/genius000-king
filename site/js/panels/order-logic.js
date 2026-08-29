// order-logic.js — الدوال الخالصة لمعالج الطلب. بلا DOM، قابلة للاختبار وحدها.

/** رقم طلب فريد: طابع زمني بالأساس 36 + عشوائي — لا تصادم عملياً. */
export function genOrderNumber() {
  const t = Date.now().toString(36).toUpperCase().slice(-6);
  const r = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `APX-${t}${r}`;
}

/** يجمع البنود المختارة واليدوية في ملخص واحد. */
export function summarize(state = {}) {
  const items = (state.items || []).filter((i) => i.qty > 0);
  const custom = (state.custom || []).filter((c) => c.text && c.text.trim() && c.qty > 0);
  const lines = [
    ...items.map((i) => ({ name: i.name, qty: i.qty, custom: false })),
    ...custom.map((c) => ({ name: c.text.trim(), qty: c.qty, custom: true })),
  ];
  return { lines, totalUnits: lines.reduce((s, l) => s + Number(l.qty || 0), 0) };
}

/** الخطوة 1 — لا بد من بند واحد على الأقل، مختاراً كان أو يدوياً. */
export function validateItems(state = {}) {
  return summarize(state).lines.length > 0;
}

export function validateStep1(state) {
  return validateItems(state) ? null : 'اختر بنداً واحداً على الأقل بكمية';
}

/** الخطوة 2 — نفس قواعد الموقع القديم، بنفس الرسائل. */
export function validateStep2(state = {}) {
  if (!state.name || state.name.trim().length < 2) return 'اكتب اسمك الكامل';
  if (!state.contact || state.contact.trim().length < 3) return 'حط وسيلة تواصل نوصلك عليها';
  if (!state.description || state.description.trim().length < 10) {
    return 'صف فكرتك بـ 10 أحرف على الأقل عشان نفهمك صح';
  }
  return null;
}
