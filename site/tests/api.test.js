import { test, eq, ok } from './assert.js';
import { buildQuery, select, insert, update, remove, count } from '../js/core/api.js';

test('buildQuery يبني سلسلة PostgREST', () => {
  eq(buildQuery({ eq: { published: true }, order: 'sort.asc', limit: 5 }),
     'published=eq.true&order=sort.asc&limit=5');
});

test('buildQuery يعيد فراغاً بلا خيارات', () => { eq(buildQuery({}), ''); });

test('buildQuery يضيف select و in', () => {
  eq(buildQuery({ in: { id: ['a', 'b'] }, select: 'id,name' }), 'id=in.(a,b)&select=id,name');
});

test('select الوهمي يصفّي ويرتّب', async () => {
  const rows = await select('collections', { eq: { published: true }, order: 'sort.asc' });
  ok(rows.length >= 3, 'ثلاثة معارض على الأقل');
  eq(rows.map(r => r.sort), rows.map(r => r.sort).slice().sort((a, b) => a - b), 'مرتّبة تصاعدياً');
  ok(rows.every(r => r.published), 'كلها منشورة');
});

test('select يحترم limit', async () => {
  eq((await select('works', { limit: 3 })).length, 3);
});

test('insert ثم update ثم remove يعملون على الوهمي', async () => {
  const before = await count('services');
  const row = await insert('services', { name: 'اختبار', sort: 99, published: true });
  ok(row.id, 'يولّد معرّفاً');
  eq(await count('services'), before + 1);
  const patched = await update('services', row.id, { name: 'معدّل' });
  eq(patched.name, 'معدّل');
  await remove('services', row.id);
  eq(await count('services'), before);
});

test('البيانات الوهمية تحمل كل جداول المواصفات', async () => {
  for (const t of ['site_content', 'collections', 'works', 'packages', 'package_blocks',
                   'services', 'payment_methods', 'testimonials', 'orders', 'theme',
                   'layout', 'order_items']) {
    ok((await select(t)).length > 0, `${t} غير فارغ`);
  }
});
