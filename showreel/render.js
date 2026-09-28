// node render.js still <t1> <t2> ...   |   node render.js all <fps> <outDir>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const [mode, ...rest] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--font-render-hinting=none', '--force-color-profile=srgb'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => { console.error('PAGEERR', e.message); process.exit(1); });
  p.on('console', m => m.type() === 'error' && console.error('CONSOLE', m.text()));
  await p.goto('file://' + path.resolve(__dirname, 'index.html'));
  await p.evaluate(() => window.ready);
  const shot = async (t, file) => { await p.evaluate(t => window.render(t), t); await p.locator('#c').screenshot({ path: file, type: 'png' }); };
  if (mode === 'still') {
    fs.mkdirSync(process.env.OUT, { recursive: true });
    for (const t of rest) await shot(+t, `${process.env.OUT}/s_${(+t).toFixed(2)}.png`);
  } else {
    const fps = +rest[0], dir = rest[1], N = Math.round(15 * fps), a = +(rest[2] || 0), n = +(rest[3] || N); fs.mkdirSync(dir, { recursive: true });
    const t0 = Date.now();
    for (let f = a; f < n; f++) { await shot(f / fps, `${dir}/f_${String(f).padStart(5, '0')}.png`); if (f % 30 === 0) console.log(f, '/', n, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  }
  await b.close();
})();
