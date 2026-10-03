// usage: node preview.js <outdir> <scale> <t1,t2,...>   → outdir/t_<time>.jpg
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const [outdir, scale, times] = [process.argv[2], process.argv[3] || '0.5', (process.argv[4] || '0').split(',').map(Number)];
  fs.mkdirSync(outdir, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', m => { const t = m.text(); if (!/GPU stall|Performance/.test(t)) console.log('[page]', t.slice(0, 1500)); });
  page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 1500)));
  await page.goto('file://' + path.resolve(__dirname, 'index.html') + '?scale=' + scale);
  await page.evaluate(() => window.READY);
  for (const t of times) {
    const t0 = Date.now();
    const data = await page.evaluate(t => { renderTime(t); return grab(0.93); }, t);
    fs.writeFileSync(path.join(outdir, `t_${t.toFixed(3).padStart(7, '0')}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
    console.log('t=' + t + ' ' + (Date.now() - t0) + 'ms');
  }
  await browser.close();
})();
