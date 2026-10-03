const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 600)));
  await page.goto('file://' + path.resolve(__dirname, 'index.html') + '?scale=0.25');
  await page.evaluate(() => window.READY);
  const cues = await page.evaluate(() => { renderTime(15.5); renderTime(46.0); return window.dumpCues(); });
  fs.writeFileSync(path.join(__dirname, 'cues.json'), JSON.stringify(cues));
  console.log('cues.json written; TCR=', cues.clash.TCR, 'ranks', cues.clash.ranks.join(','), 'ideas', cues.ideas.map(i => i.name + '@' + i.t).join(' '));
  await browser.close();
})();
