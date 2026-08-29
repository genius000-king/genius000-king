// order-logic.js — الدوال الخالصة لمعالج الطلب. بلا DOM، قابلة للاختبار وحدها.
import { isPhone } from './whatsapp.js';

/** يجمع البنود المختارة واليدوية في ملخّص واحد. */
export function summarize(state = {}) {
  const items = (state.items || []).filter((i) => i.qty > 0);
  const custom = (state.custom || []).filter((c) => c.text && c.text.trim() && c.qty > 0);
  const lines = [
    ...items.map((i) => ({ name: i.name, qty: i.qty, custom: false })),
    ...custom.map((c) => ({ name: c.text.trim(), qty: c.qty, custom: true })),
  ];
  return { lines, totalUnits: lines.reduce((s, l) => s + Number(l.qty || 0), 0) };
}

export function validateItems(state = {}) {
  return summarize(state).lines.length > 0;
}

/** الخطوة 1 — البنود. */
export function validateStep1(state) {
  return validateItems(state) ? null : 'اختر بنداً واحداً على الأقل بكمية';
}

/** الخطوة 2 — المرفقات (اختيارية دائماً). */
export function validateStep2() { return null; }

/** الخطوة 3 — البيانات. */
export function validateStep3(state = {}) {
  if (!state.name || state.name.trim().length < 2) return 'اكتب اسمك الكامل';
  const contact = (state.contact || '').trim();
  if (contact.length < 3) return 'حط وسيلة تواصل نوصلك عليها';
  // إن اختار واتساب فلا بد أن تكون وسيلة التواصل رقماً صالحاً
  if (state.platform === 'واتساب' && !isPhone(contact)) {
    return 'رقم الواتساب غير صحيح — اكتبه بالأرقام مثل 05xxxxxxxx';
  }
  if (!state.description || state.description.trim().length < 10) {
    return 'صف فكرتك بـ 10 أحرف على الأقل عشان نفهمك صح';
  }
  return null;
}

export const VALIDATORS = [validateStep1, validateStep2, validateStep3];

/** يتحقق من ملف مرفق قبل قبوله. */
export const MAX_FILES = 6;
export const MAX_SIZE = 6 * 1024 * 1024;
const OK_TYPES = /^image\/(png|jpe?g|webp|gif|avif)$|^application\/pdf$/i;

export function validateFile(file, currentCount = 0) {
  if (currentCount >= MAX_FILES) return `أقصى عدد مرفقات ${MAX_FILES}`;
  if (!OK_TYPES.test(file.type)) return 'الملفات المقبولة: صور أو PDF';
  if (file.size > MAX_SIZE) return `حجم الملف أكبر من ${Math.round(MAX_SIZE / 1024 / 1024)}MB`;
  return null;
}
