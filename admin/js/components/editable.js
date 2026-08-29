// editable.js — الجسر بين ملفات الأقسام وطبقة التحرير.
// ملفات الأقسام مشتركة حرفياً بين الموقعين؛ طبقة التحرير موجودة في لوحة
// المشرف وحدها. الاستيراد الديناميكي هنا لا يُنفَّذ إطلاقاً في موقع العملاء
// لأن `editable` تبقى false — فلا يحتاج الموقع الملف ولا يطلبه.
export async function applyEditable(root, { editable = false } = {}) {
  if (!editable || !root) return;
  try {
    const { enableEditing } = await import('../core/edit-layer.js');
    enableEditing(root);
  } catch (e) {
    console.warn('[editable] طبقة التحرير غير متاحة هنا', e);
  }
}
