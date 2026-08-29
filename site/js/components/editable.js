// editable.js — الجسر بين ملفات الأقسام وطبقة التحرير في لوحة المشرف.
// في موقع العملاء `editable` تبقى false فلا يُطلب الملف إطلاقاً.
export async function applyEditable(root, { editable = false } = {}) {
  if (!editable || !root) return;
  try {
    const { enableEditing } = await import('../core/edit-layer.js');
    enableEditing(root);
  } catch (e) {
    console.warn('[editable] طبقة التحرير غير متاحة هنا', e);
  }
}
