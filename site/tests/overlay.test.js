import { test, eq, ok } from './assert.js';
import { toast, pending } from '../js/core/toast.js';
import { openLightbox, closeLightbox, isLightboxOpen, lightboxIndex, go } from '../js/core/lightbox.js';
import { depth } from '../js/core/overlay.js';

const IMGS = [
  { type: 'image', url: 'assets/posters/ember-2.webp', caption: 'أ' },
  { type: 'image', url: 'assets/posters/ember-3.webp', caption: 'ب' },
  { type: 'image', url: 'assets/posters/ember-4.webp', caption: 'ج' },
];

test('toast يضيف رسالة للطابور ويعرضها', async () => {
  toast('تم الحفظ', 'success');
  await new Promise(r => setTimeout(r, 30));
  const node = document.querySelector('.toast');
  ok(node, 'ظهرت الرسالة');
  eq(node.textContent, 'تم الحفظ');
  ok(node.classList.contains('toast--success'));
});

test('toast يصطف ولا يعرض اثنتين معاً', async () => {
  toast('واحد'); toast('اثنان');
  await new Promise(r => setTimeout(r, 30));
  ok(pending() >= 1);
  ok(document.querySelectorAll('.toast').length <= 2);
});

test('openLightbox يفتح على الفهرس المطلوب', () => {
  const href = location.href;
  openLightbox(IMGS, 1);
  ok(isLightboxOpen());
  eq(lightboxIndex(), 1);
  eq(location.href, href, 'الرابط لم يتغيّر');
  eq(document.querySelector('.lightbox__caption').textContent, 'ب');
  eq(document.querySelector('.lightbox__counter').textContent, '2 / 3');
});

test('go يلتف عند الطرفين', () => {
  go(1); eq(lightboxIndex(), 2);
  go(1); eq(lightboxIndex(), 0, 'يلتف للبداية');
  go(-1); eq(lightboxIndex(), 2, 'يلتف للنهاية');
});

test('أسهم لوحة المفاتيح تتنقل (RTL)', () => {
  const at = lightboxIndex();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
  eq(lightboxIndex(), (at + 1) % 3);
});

test('Escape يغلق العارض ويفرغ المكدّس', () => {
  const before = depth();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  eq(isLightboxOpen(), false);
  eq(document.querySelectorAll('.lightbox').length, 0);
  eq(document.body.style.overflow, '');
  ok(depth() < before, 'الطبقة أُزيلت من المكدّس');
});

test('openLightbox يتجاهل مصفوفة فارغة', () => {
  openLightbox([]); eq(isLightboxOpen(), false);
});

test('openLightbox يقبل روابط نصية', () => {
  openLightbox(['assets/posters/blue-1.webp']);
  ok(isLightboxOpen());
  eq(document.querySelector('.lightbox__counter').textContent, '');
  closeLightbox();
});
