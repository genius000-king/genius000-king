import { test, eq, ok } from './assert.js';
import { reorderArray } from '../js/core/sortable.js';
import { autosave } from '../js/core/autosave.js';

test('reorderArray ينقل عنصراً للأمام وللخلف', () => {
  eq(reorderArray(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd']);
  eq(reorderArray(['a', 'b', 'c', 'd'], 3, 1), ['a', 'd', 'b', 'c']);
});

test('reorderArray لا يعدّل المصفوفة الأصلية', () => {
  const src = ['a', 'b', 'c'];
  reorderArray(src, 0, 2);
  eq(src, ['a', 'b', 'c'], 'الأصل كما هو');
});

test('reorderArray يحتمل الحالات الحدّية', () => {
  eq(reorderArray(['a', 'b'], 1, 1), ['a', 'b'], 'نفس الموضع');
  eq(reorderArray([], 0, 1), [], 'مصفوفة فارغة');
  eq(reorderArray(['a'], 5, 9), ['a'], 'فهارس خارج المدى');
});

test('autosave ينفّذ مرة واحدة رغم خمسة تعديلات', async () => {
  let runs = 0;
  const save = autosave(() => { runs++; }, 20);
  save(); save(); save(); save(); save();
  await new Promise(r => setTimeout(r, 80));
  eq(runs, 1);
});

test('autosave يبثّ saving ثم saved بالترتيب', async () => {
  const seen = [];
  const off = (e) => seen.push(e.detail.state);
  document.addEventListener('autosave:state', off);
  const save = autosave(async () => {}, 10);
  save();
  await new Promise(r => setTimeout(r, 80));
  document.removeEventListener('autosave:state', off);
  eq(seen, ['saving', 'saved']);
});

test('autosave يبثّ error عند فشل الكتابة', async () => {
  const seen = [];
  const off = (e) => seen.push(e.detail.state);
  document.addEventListener('autosave:state', off);
  const save = autosave(async () => { throw new Error('فشل'); }, 10);
  save();
  await new Promise(r => setTimeout(r, 80));
  document.removeEventListener('autosave:state', off);
  eq(seen.at(-1), 'error');
});

test('cancel يلغي الحفظ المعلّق', async () => {
  let runs = 0;
  const save = autosave(() => { runs++; }, 20);
  save(); save.cancel();
  await new Promise(r => setTimeout(r, 60));
  eq(runs, 0);
});
