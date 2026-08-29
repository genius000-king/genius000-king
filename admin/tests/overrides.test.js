import { test, eq, ok } from './assert.js';
import { ALLOWED_PROPS, isAllowed, cssFor } from '../js/core/overrides.js';

test('قائمة الخصائص مغلقة', () => {
  ok(isAllowed('color')); ok(isAllowed('font-size')); ok(isAllowed('box-shadow'));
  ok(!isAllowed('position'), 'position مرفوضة');
  ok(!isAllowed('width'), 'width مرفوضة');
  ok(!isAllowed('transform'), 'transform مرفوضة');
  ok(!isAllowed('display'), 'display مرفوضة');
  eq(ALLOWED_PROPS.length, 9, 'تسع خصائص بالضبط');
});

test('cssFor يبني قاعدة لعنصر واحد', () => {
  eq(cssFor([{ target: 'hero.title', breakpoint: 'all', prop: 'color', value: '#f00' }]),
     '[data-edit-id="hero.title"]{color:#f00}');
});

test('cssFor يلف نقطة التوقف بميديا', () => {
  ok(cssFor([{ target: 'a', breakpoint: 'mobile', prop: 'color', value: '#f00' }])
     .startsWith('@media (max-width:640px)'));
});

test('cssFor يدمج خصائص نفس العنصر في قاعدة واحدة', () => {
  const out = cssFor([
    { target: 'a', breakpoint: 'all', prop: 'color', value: '#f00' },
    { target: 'a', breakpoint: 'all', prop: 'opacity', value: '0.5' },
  ]);
  eq((out.match(/\[data-edit-id="a"\]/g) || []).length, 1, 'محدِّد واحد لا اثنان');
  ok(out.includes('color:#f00') && out.includes('opacity:0.5'));
});

test('cssFor يتجاهل الخصائص خارج القائمة', () => {
  eq(cssFor([{ target: 'a', breakpoint: 'all', prop: 'position', value: 'fixed' }]), '');
});

test('cssFor يرفض القيم التي تكسر القاعدة', () => {
  for (const bad of ['red}body{display:none', 'red;color:blue', '<script>']) {
    eq(cssFor([{ target: 'a', breakpoint: 'all', prop: 'color', value: bad }]), '',
       `القيمة «${bad}» مرفوضة`);
  }
});
