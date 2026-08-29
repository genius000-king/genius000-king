// مشغّل اختبارات بلا مكتبات — يدعم الاختبارات المتزامنة وغير المتزامنة.
const results = [];
// طابور متسلسل: الاختبارات تُنفَّذ بترتيب تعريفها، واحداً بعد الآخر —
// ضروري لأن كثيراً منها يلمس حالة عامة (اللوحة، body، السجل).
let chain = Promise.resolve();

export function test(name, fn) {
  chain = chain.then(async () => {
    try { await fn(); results.push({ name, ok: true }); }
    catch (e) { results.push({ name, ok: false, msg: e.message }); }
  });
}

export function eq(a, b, msg = '') {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error(`${msg} expected ${B}, got ${A}`);
}

export function ok(v, msg = '') { if (!v) throw new Error(msg || 'expected truthy'); }

export function throws(fn, msg = '') {
  try { fn(); } catch { return; }
  throw new Error(msg || 'expected throw');
}

export async function report() {
  await chain;
  const out = document.getElementById('out');
  const failed = results.filter(r => !r.ok);
  out.innerHTML = results.map(r =>
    `<div style="color:${r.ok ? '#2ecc71' : '#e74c3c'}">${r.ok ? '✓' : '✗'} ${r.name}${r.msg ? ' — ' + r.msg : ''}</div>`
  ).join('');
  out.insertAdjacentHTML('afterbegin',
    `<h2>${results.length - failed.length}/${results.length} نجحت</h2>`);
  document.title = `${results.length - failed.length}/${results.length}`;
  window.__testSummary = { total: results.length, failed: failed.length, failures: failed };
  document.body.dataset.done = '1';
}
