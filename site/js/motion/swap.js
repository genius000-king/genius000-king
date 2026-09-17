// swap — تبديل الصورة الثانية عند المرور. CSS يقوم بالعمل؛ هذا يضيف الصنف فقط.
export default {
  name: 'swap',
  init(node) { if (node.querySelector('[data-swap]')) node.classList.add('fx-swap'); },
  destroy(node) { node.classList.remove('fx-swap'); },
};
