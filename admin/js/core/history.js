// history.js — تراجع محدود (10 خطوات) عن الحذف والتعديلات البنيوية.
// ليس تراجعاً عن كل ضغطة مفتاح: هو شبكة أمان لما لا يمكن التراجع عنه يدوياً.
const MAX = 10;
const stack = [];

const emit = () => document.dispatchEvent(new CustomEvent('history:change',
  { detail: { depth: stack.length, label: stack.at(-1)?.label || '' } }));

/** يسجّل خطوة قابلة للتراجع. `undo` دالة تعيد الحالة. */
export function record(label, undo) {
  stack.push({ label, undo, at: Date.now() });
  while (stack.length > MAX) stack.shift();
  emit();
}

export async function undo() {
  const step = stack.pop();
  emit();
  if (!step) return null;
  await step.undo();
  return step.label;
}

export function depth() { return stack.length; }
export function peek() { return stack.at(-1) || null; }
export function clear() { stack.length = 0; emit(); }
