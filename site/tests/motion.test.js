import { test, eq, ok } from './assert.js';
import loop from '../js/motion/loop.js';
import prefs from '../js/motion/prefs.js';

// تثبيت البيئة حتى لا تتغيّر النتيجة باختلاف الجهاز.
prefs._forceLowPower = false;

test('loop يضيف ويزيل مشتركين', () => {
  const f = () => {}; loop.add(f); eq(loop.count(), 1);
  loop.remove(f); eq(loop.count(), 0);
});

test('loop يعيد دالة إلغاء من add', () => {
  const off = loop.add(() => {});
  eq(loop.count(), 1); off(); eq(loop.count(), 0);
});

test('loop يبدأ عند أول إضافة ويتوقف عند التفريغ', () => {
  // تسليم الإطارات شأن المتصفح (يخنقها في التبويب المخفي عمداً)؛
  // ما نملكه ونختبره هو أن الحلقة تُجدوَل وتتوقف في وقتها.
  const f = () => {};
  loop.add(f);
  eq(loop.running, !document.hidden, 'تعمل ما لم يكن التبويب مخفياً');
  loop.remove(f);
  eq(loop.running, false, 'توقفت بعد آخر مشترك');
  eq(loop.count(), 0);
});

test('loop يمرّر dt موجباً حين يسلّم المتصفح إطاراً', async () => {
  let dts = [];
  const f = (dt) => dts.push(dt);
  loop.add(f);
  await new Promise(r => setTimeout(r, 60));
  loop.remove(f);
  ok(dts.every(d => d > 0), 'كل dt موجب');
});

test('scale يطبّق الشدة', () => { eq(prefs.scale(100, 0.5), 50); });

test('scale يصفّر عند reduced', () => {
  prefs._forceReduced = true; eq(prefs.scale(100, 1), 0); prefs._forceReduced = false;
});

test('scale ينصّف عند ضعف الجهاز', () => {
  prefs._forceLowPower = true; eq(prefs.scale(100, 1), 50); prefs._forceLowPower = false;
});

test('scale يحصر الشدة بين 0 و 1', () => {
  eq(prefs.scale(100, 5), 100); eq(prefs.scale(100, -2), 0);
});
