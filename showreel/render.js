// usage: node render.js <outdir> <workerIndex> <workerCount> [scale] [fps] [startFrame] [endFrame]
// Renders frames f where f % workerCount === workerIndex into outdir/frame_%05d.jpg
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const [outdir, wi, wn] = [process.argv[2], +process.argv[3], +process.argv[4]];
  const scale = process.argv[5] || '1', fps = +(process.argv[6] || 60);
  const startF = +(process.argv[7] || 0), endF = +(process.argv[8] || fps * 30);
  fs.mkdirSync(outdir, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', m => { const t = m.text(); if (!/GPU stall|Performance/.test(t)) console.log(`[w${wi}]`, t.slice(0, 600)); });
  page.on('pageerror', e => console.log(`[w${wi}] pageerror`, e.message.slice(0, 600)));
  await page.goto('file://' + path.resolve(__dirname, 'index.html') + '?scale=' + scale);
  await page.evaluate(() => window.READY);
  const t00 = Date.now(); let n = 0;
  for (let f = startF; f < endF; f++) {
    if (f % wn !== wi) continue;
    const file = path.join(outdir, `frame_${String(f).padStart(5, '0')}.jpg`);
    if (fs.existsSync(file) && fs.statSync(file).size > 1000) continue;         // resumable
    const data = await page.evaluate(({ f, fps }) => { renderTime(f / fps); return grab(0.97); }, { f, fps });
    fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
    n++;
    if (n % 20 === 0) console.log(`[w${wi}] frame ${f}  ${(n / ((Date.now() - t00) / 1000)).toFixed(2)} fps`);
  }
  console.log(`[w${wi}] done ${n} frames in ${((Date.now() - t00) / 1000).toFixed(0)}s`);
  await browser.close();
})();
