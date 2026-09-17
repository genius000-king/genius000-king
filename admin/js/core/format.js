// format.js — تنسيق موحّد للتواريخ والأرقام. تقويم ميلادي ثابت بين الأجهزة.
const DATE = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn',
  { year: 'numeric', month: '2-digit', day: '2-digit' });
const TIME = new Intl.DateTimeFormat('ar-SA-u-nu-latn',
  { hour: '2-digit', minute: '2-digit', hour12: false });
const NUM = new Intl.NumberFormat('ar-SA-u-nu-latn');

export function date(v) { return v ? DATE.format(new Date(v)) : '—'; }
export function time(v) { return v ? TIME.format(new Date(v)) : '—'; }
export function dateTime(v) { return v ? `${date(v)} · ${time(v)}` : '—'; }
export function num(v) { return NUM.format(Number(v) || 0); }

/** «قبل 3 ساعات» — للنشاط الأخير. */
export function ago(v) {
  if (!v) return '—';
  const s = (Date.now() - new Date(v).getTime()) / 1000;
  if (s < 60) return 'الآن';
  if (s < 3600) return `قبل ${Math.floor(s / 60)} دقيقة`;
  if (s < 86400) return `قبل ${Math.floor(s / 3600)} ساعة`;
  if (s < 2592000) return `قبل ${Math.floor(s / 86400)} يوم`;
  return date(v);
}

export function bytes(n) {
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0, v = Number(n) || 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`;
}
