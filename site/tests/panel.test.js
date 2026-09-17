import { test, eq, ok } from './assert.js';
import { openPanel, closePanel, isOpen, currentId } from '../js/core/panel.js';
import { el } from '../js/core/dom.js';
import { depth } from '../js/core/overlay.js';

const loader = async () => ({ default: () => el('p', { id: 'panelProbe' }, ['محتوى']) });

test('openPanel يفتح بلا تغيير الرابط ويزيد السجل', async () => {
  const before = { href: location.href, d: depth() };
  await openPanel('t1', loader);
  ok(isOpen(), 'مفتوحة');
  eq(currentId(), 't1');
  eq(location.href, before.href, 'الرابط لم يتغيّر');
  eq(depth(), before.d + 1, 'أُضيفت طبقة واحدة للمكدّس');
  ok(history.state && history.state.overlay, 'مدخل السجل يحمل علامة الطبقة');
  eq(document.body.style.overflow, 'hidden', 'التمرير محبوس');
  ok(document.getElementById('panelProbe'), 'المحتوى حُقن');
  closePanel();
});

test('closePanel يغلق ويحرّر التمرير', async () => {
  await openPanel('t2', loader);
  closePanel();
  eq(isOpen(), false);
  eq(document.body.style.overflow, '');
  eq(document.querySelectorAll('.glass-panel').length, 0);
});

test('اللوحة تعرض هيكلاً عظمياً قبل وصول المحتوى', async () => {
  let release;
  const slow = () => new Promise(r => { release = () => r({ default: () => el('p', {}, ['تم']) }); });
  const p = openPanel('t3', slow);
  await new Promise(r => setTimeout(r, 0));
  ok(document.querySelector('.glass-panel__skeleton'), 'الهيكل ظاهر');
  release(); await p;
  ok(!document.querySelector('.glass-panel__skeleton'), 'اختفى بعد التحميل');
  closePanel();
});

test('Escape يغلق اللوحة', async () => {
  await openPanel('t4', loader);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  eq(isOpen(), false);
});

test('فتح لوحة ثانية يستبدل الأولى', async () => {
  await openPanel('t5', loader);
  await openPanel('t6', loader);
  eq(currentId(), 't6');
  eq(document.querySelectorAll('.glass-panel').length, 1);
  closePanel();
});

test('خطأ اللودر يعرض رسالة ولا ينهار', async () => {
  await openPanel('t7', async () => { throw new Error('فشل'); });
  ok(document.querySelector('.glass-panel__error'), 'رسالة خطأ ظاهرة');
  closePanel();
});
