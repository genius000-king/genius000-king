import { test, eq, ok } from './assert.js';
import { el, qs, qsa, on, esc, debounce } from '../js/core/dom.js';

test('el ينشئ عنصراً بسمات وأبناء', () => {
  const n = el('div', { class: 'a', 'data-x': '1' }, ['نص']);
  eq(n.className, 'a'); eq(n.dataset.x, '1'); eq(n.textContent, 'نص');
});

test('el يقبل عنصراً كابن ويتجاهل الفراغات', () => {
  const n = el('ul', {}, [el('li', {}, ['أ']), null, false, 'ب']);
  eq(n.children.length, 1); eq(n.textContent, 'أب');
});

test('el يضبط style ككائن ويربط on*', () => {
  let hit = 0;
  const n = el('button', { style: { opacity: '0.5' }, onclick: () => hit++ });
  eq(n.style.opacity, '0.5');
  n.click(); eq(hit, 1);
});

test('esc يهرّب HTML', () => {
  eq(esc('<img onerror=x>'), '&lt;img onerror=x&gt;');
  eq(esc(`"a" & 'b'`), '&quot;a&quot; &amp; &#39;b&#39;');
  eq(esc(null), '');
});

test('qs و qsa يبحثان داخل جذر', () => {
  const root = el('div', {}, [el('span', { class: 'x' }), el('span', { class: 'x' })]);
  ok(qs('.x', root)); eq(qsa('.x', root).length, 2);
});

test('on يعيد دالة إلغاء', () => {
  let n = 0;
  const b = el('button');
  const off = on(b, 'click', () => n++);
  b.click(); off(); b.click();
  eq(n, 1);
});

test('debounce ينفّذ مرة واحدة', async () => {
  let n = 0; const f = debounce(() => n++, 10);
  f(); f(); f();
  await new Promise(r => setTimeout(r, 30));
  eq(n, 1);
});

test('el يضبط المتغيّرات المخصّصة عبر setProperty', () => {
  const n = el('div', { style: { '--cols': '3', opacity: '0.5' } });
  eq(n.style.getPropertyValue('--cols'), '3');
  eq(n.style.opacity, '0.5');
});
