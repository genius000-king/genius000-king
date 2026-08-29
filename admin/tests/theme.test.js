import { test, eq, ok } from './assert.js';
import { applyTheme, resetTheme, getToken, isSafeValue, accentTokens, contrast, toRgb }
  from '../js/core/theme.js';

const root = document.documentElement;

test('applyTheme يحقن التوكن على :root', () => {
  applyTheme([{ key: 'c-accent', value: '#ff0000' }]);
  eq(getComputedStyle(root).getPropertyValue('--c-accent').trim(), '#ff0000');
  resetTheme();
});

test('resetTheme يرجع قيمة tokens.css', () => {
  const before = getComputedStyle(root).getPropertyValue('--c-accent').trim();
  applyTheme([{ key: 'c-accent', value: '#00ff00' }]);
  resetTheme();
  eq(getComputedStyle(root).getPropertyValue('--c-accent').trim(), before);
});

test('resetTheme لا يمسّ ما لم نحقنه نحن', () => {
  root.style.setProperty('--dahsn-test', 'خارجي');
  applyTheme([{ key: 'fs-scale', value: '1.2' }]);
  resetTheme();
  eq(root.style.getPropertyValue('--dahsn-test'), 'خارجي');
  root.style.removeProperty('--dahsn-test');
});

test('القيم التي تكسر الإعلان مرفوضة', () => {
  for (const bad of ['red}body{display:none', 'red;x:y', '<script>', 'url(javascript:alert(1))']) {
    ok(!isSafeValue(bad), `«${bad}» مرفوضة`);
  }
  ok(isSafeValue('#2563EB'));
  ok(isSafeValue('1.2'));
});

test('تغيير اللون المميز يشتقّ الثلاثة معاً', () => {
  const rows = accentTokens('#2563EB');
  eq(rows.map(r => r.key), ['c-accent', 'c-accent-rgb', 'c-accent-text']);
  eq(rows[1].value, '37, 99, 235', 'صيغة rgba');
});

test('لون النص المميز يبلغ 4.5:1 على الخلفية', () => {
  const bg = toRgb('#050A14');
  for (const hex of ['#2563EB', '#1D4ED8', '#0F172A']) {
    const text = accentTokens(hex).find(r => r.key === 'c-accent-text').value;
    ok(contrast(toRgb(text), bg) >= 4.5, `${hex} → ${text} يبلغ العتبة`);
  }
});

test('accentTokens يعيد فراغاً للون غير صالح', () => {
  eq(accentTokens('ليس لوناً'), []);
});
