// تصدير CSV — بناء نصي خالص ثم Blob. بلا مكتبات.

const COLS = [
  ['order_number', 'رقم الطلب'], ['name', 'الاسم'], ['contact', 'التواصل'],
  ['platform', 'المنصة'], ['usage', 'الاستخدام'], ['description', 'الوصف'],
  ['status', 'الحالة'], ['created_at', 'التاريخ'],
];

/** يهرّب خلية CSV. البادئات = + - @ تُسبق بفاصلة عليا لمنع تنفيذها كصيغة في Excel. */
export function cell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCSV(rows) {
  const head = COLS.map(([, label]) => cell(label)).join(',');
  const body = rows.map((r) => COLS.map(([key]) => {
    if (key === 'created_at') return cell(new Date(r[key] || Date.now()).toLocaleString('ar'));
    return cell(r[key]);
  }).join(',')).join('\n');
  return `﻿${head}\n${body}`;      // BOM حتى يقرأ Excel العربية صحيحة
}

export function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
