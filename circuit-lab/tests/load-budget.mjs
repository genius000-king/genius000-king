// Measures what the browser downloads at start and what each feature fetches the first time it is used.
// Usage: npm run build && node tools/serve.mjs & node tests/load-budget.mjs
import {chromium} from '@playwright/test';
import zlib from 'node:zlib';
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const p = await b.newPage({viewport: {width: 1440, height: 900}}),
  errors = [];
p.setDefaultTimeout(60000);
p.on('pageerror', e => errors.push(e.message));
p.on('dialog', d => d.accept());
await p.addInitScript(() => {
  sessionStorage.setItem('circuit-lab-force-webgl', '1');
  sessionStorage.setItem('circuit-lab-debug', '1');
  localStorage.getItem('circuit-lab-performance') || localStorage.setItem('circuit-lab-performance', 'quality');
});
let stage = [];
p.on('response', async r => {
  try {
    const body = await r.body();
    stage.push({
      url: r.url().replace(/^https?:\/\/[^/]+/, ''),
      raw: body.length,
      gz: zlib.gzipSync(body).length,
    });
  } catch {}
});
const kb = n => (n / 1024).toFixed(0) + ' KB';
const report = name => {
  const raw = stage.reduce((s, r) => s + r.raw, 0),
    gz = stage.reduce((s, r) => s + r.gz, 0);
  console.log(
    `${name.padEnd(28)} ${String(stage.length).padStart(3)} files  ${kb(raw).padStart(8)}  (${kb(gz)} gzip)`
  );
  if (process.env.VERBOSE)
    for (const r of stage.sort((a, b) => b.raw - a.raw)) console.log('   ', kb(r.raw).padStart(7), r.url);
  stage = [];
};
const btn = name =>
  p
    .getByRole('button', {name, exact: true})
    .first()
    .evaluate(el => el.click());
const t0 = Date.now();
await p.goto('http://127.0.0.1:5173/');
await p.waitForSelector('.splash, .app');
const splash = Date.now() - t0;
await p.waitForFunction(() => window.__circuitLab?.scene()?.objects.size > 0);
console.log(`splash after ${splash} ms, workbench with 3D scene after ${Date.now() - t0} ms`);
await p.waitForTimeout(1500);
report('start (shell + 3D + worker)');
await btn('Components');
await p.waitForSelector('.library .component-card');
await p.waitForTimeout(2500);
report('components library');
await btn('Collapse components');
await btn('Projects');
await p.waitForSelector('.project-card');
report('project gallery');
await p.getByLabel('Search projects').fill('Ultrasonic ruler');
await p
  .locator('.project-card')
  .first()
  .evaluate(el => el.click());
await p.waitForTimeout(2500);
report('open a project');
await btn('Workspace options');
await btn('Engineering calculators');
await p.waitForSelector('.tools-modal, .modal');
report('calculators');
console.log('errors', errors.length, errors.slice(0, 3));
await b.close();
