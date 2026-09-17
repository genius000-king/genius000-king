import { test, eq, ok } from './assert.js';
import { register, scan, destroyIn, has, names } from '../js/motion/registry.js';

let inits = [], destroys = 0;
register({
  name: 'x',
  init(el, o) { inits.push(o.intensity); },
  destroy() { destroys++; },
});

function host(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  document.body.appendChild(d);
  return d;
}

test('register يسجّل المؤثر', () => { ok(has('x')); ok(names().includes('x')); });

test('scan يهيّئ العنصر مرة واحدة بالشدة المقروءة', () => {
  inits = [];
  const root = host('<div data-fx="x" data-fx-intensity="0.5"></div>');
  eq(scan(root), 1);
  eq(inits, [0.5]);
  eq(scan(root), 0, 'المسح الثاني لا يعيد التهيئة');
  eq(inits, [0.5]);
  root.remove();
});

test('destroyIn ينظّف ويسمح بإعادة التهيئة', () => {
  inits = []; destroys = 0;
  const root = host('<div data-fx="x"></div>');
  scan(root);
  eq(inits, [1], 'الشدة الافتراضية 1');
  destroyIn(root);
  eq(destroys, 1);
  eq(scan(root), 1, 'يمكن إعادة التهيئة بعد التنظيف');
  destroyIn(root); root.remove();
});

test('scan يتجاهل مؤثراً غير مسجَّل بلا انهيار', () => {
  const root = host('<div data-fx="لا-يوجد"></div>');
  eq(scan(root), 0);
  root.remove();
});

test('scan يقبل عدة مؤثرات على عنصر واحد', () => {
  inits = [];
  register({ name: 'y', init(el, o) { inits.push('y' + o.intensity); }, destroy() {} });
  const root = host('<div data-fx="x y" data-fx-intensity="0.25"></div>');
  scan(root);
  eq(inits, [0.25, 'y0.25']);
  destroyIn(root); root.remove();
});
