import { test, eq, ok } from './assert.js';
import { colsFor, safeBg } from '../js/core/layout.js';
import { renderCustomBlock } from '../js/components/custom-block.js';

test('الأعمدة تتقلص تلقائياً', () => {
  eq(colsFor(4, 'desktop'), 4);
  eq(colsFor(4, 'tablet'), 2);
  eq(colsFor(4, 'mobile'), 1);
  eq(colsFor(1, 'desktop'), 1);
});

test('قاعدة التقلص تسري على كل الأعداد', () => {
  eq(colsFor(3, 'tablet'), 2);
  eq(colsFor(2, 'tablet'), 2);
  eq(colsFor(1, 'tablet'), 1);
  eq(colsFor(3, 'mobile'), 1);
  eq(colsFor(2, 'mobile'), 1);
});

test('الجوال عمود واحد دائماً مهما كانت القيمة', () => {
  for (const n of [1, 2, 3, 4, 9, 0, -2]) eq(colsFor(n, 'mobile'), 1);
});

test('خلفية القسم تُنقّى من القيم الكاسرة', () => {
  for (const bad of ['red}body{display:none', 'red;x:y', 'url(javascript:alert(1))', '<script>']) {
    eq(safeBg(bad), '', `«${bad}» مرفوضة`);
  }
  ok(safeBg('#2563EB'));
});

test('الكتلة المخصصة تحمل معرّف تحرير', () => {
  const node = renderCustomBlock({ id: 'b9', type: 'text', content: { text: 'نص' }, visible: true });
  ok(node, 'أُنتجت عقدة');
  eq(node.dataset.editId, 'block.b9');
  ok(node.textContent.includes('نص'));
});

test('نوع غير معروف لا يرسم شيئاً ولا يرمي', () => {
  eq(renderCustomBlock({ id: 'x', type: 'لا-يوجد', content: {} }), null);
});

test('كل الأنواع الستة تُرسم', () => {
  const types = [
    ['text', { text: 'نص' }], ['image', { url: 'a.webp' }], ['video', { url: 'a.mp4' }],
    ['button', { label: 'زر', href: '#' }], ['divider', {}], ['spacer', { height: '40px' }],
  ];
  for (const [type, content] of types) {
    ok(renderCustomBlock({ id: 't', type, content, visible: true }), `${type} يُرسم`);
  }
});
