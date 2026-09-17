import { test, eq, ok } from './assert.js';
import { loadAll, get, content, byCollection, blocksOf, setAll } from '../js/core/store.js';

await loadAll();

test('loadAll يملأ المخزن', () => {
  ok(get('collections').length >= 3, 'معارض');
  ok(get('works').length >= 12, 'أعمال');
  ok(get('packages').length >= 3, 'بكجات');
  ok(get('process_steps').length >= 4, 'مراحل عمل');
});

test('content يعيد القيمة النصية للمفتاح', () => {
  eq(content('whatsapp'), '966511572807');
});

test('content يعيد فراغاً لمفتاح غير موجود', () => {
  eq(content('مفتاح_غير_موجود'), '');
});

test('byCollection يعيد أعمال المعرض مرتبة بـ sort', () => {
  const rows = byCollection('c1');
  ok(rows.length > 1, 'أكثر من عمل');
  eq(rows.map(r => r.sort), rows.map(r => r.sort).slice().sort((a, b) => a - b), 'مرتّبة بـ sort');
  ok(rows.every(r => r.collection_id === 'c1'), 'كلها لنفس المعرض');
});

test('byCollection يعيد مصفوفة فارغة لمعرّف مجهول', () => {
  eq(byCollection('لا-يوجد'), []);
});

test('get يعيد مصفوفة فارغة لجدول مجهول', () => { eq(get('لا-يوجد'), []); });

test('blocksOf يعيد كتل البكج مرتبة', () => {
  const b = blocksOf('p1');
  ok(b.length >= 2, 'كتلتان على الأقل');
  eq(b.map(r => r.sort), b.map(r => r.sort).slice().sort((a, b2) => a - b2), 'مرتّبة بـ sort');
});

test('setAll يستبدل جدولاً في المخزن', () => {
  const keep = get('services');
  setAll('services', [{ id: 'x', name: 'واحدة', sort: 1, published: true }]);
  eq(get('services').length, 1);
  setAll('services', keep);
  ok(get('services').length > 1);
});
