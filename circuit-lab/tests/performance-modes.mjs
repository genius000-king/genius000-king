// Battery saver end to end: the renderer, the UI and the simulation snapshots all follow the chosen mode.
// Usage: node tests/performance-modes.mjs   (expects the app on 127.0.0.1:5173)
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const out = new URL('../screenshots/', import.meta.url).pathname;
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
  if (!sessionStorage.getItem('seeded')) {
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('circuit-lab-performance', 'saver');
  }
});
const btn = name =>
  p
    .getByRole('button', {name, exact: true})
    .first()
    .evaluate(el => el.click());
const renderer = () =>
  p.evaluate(() => {
    const s = window.__circuitLab.scene(),
      panel = document.querySelector('.topbar');
    return {
      tier: s.profile.tier,
      shadows: s.renderer.shadowMap.enabled,
      antialias: s.renderer.getContext().getContextAttributes().antialias,
      blur: getComputedStyle(panel).backdropFilter,
      lowPower: document.querySelector('.app').classList.contains('low-power'),
    };
  });
try {
  await p.goto('http://127.0.0.1:5173/');
  await p.waitForFunction(() => window.__circuitLab?.scene()?.objects.size > 0);
  const saver = await renderer();
  console.log('saver', saver);
  assert.deepEqual(saver, {tier: 'low', shadows: false, antialias: false, blur: 'none', lowPower: true});
  await btn('Projects');
  await p.getByLabel('Search projects').fill('Ultrasonic ruler');
  await p
    .locator('.project-card')
    .first()
    .evaluate(el => el.click());
  await p.waitForTimeout(2000);
  await p
    .locator('.run-button')
    .first()
    .evaluate(el => el.click());
  await p.waitForFunction(() => window.__circuitLab.state().time > 800, null, {timeout: 120000});
  await p.waitForTimeout(800);
  await p.screenshot({path: out + '14-battery-saver.png'});
  // switch to Quality from the menu: the renderer is rebuilt with shadows and antialiasing
  await btn('Workspace options');
  await p.getByText('Performance', {exact: true}).click();
  await p.getByLabel('Graphics performance').selectOption('quality');
  await p.waitForFunction(() => window.__circuitLab.scene()?.profile.tier === 'high');
  await p.waitForFunction(() => window.__circuitLab.scene().objects.size > 0);
  const quality = await renderer();
  console.log('quality', quality);
  assert.equal(quality.shadows, true);
  assert.equal(quality.antialias, true);
  assert.equal(quality.lowPower, false);
  assert.notEqual(quality.blur, 'none');
  assert.equal(await p.evaluate(() => localStorage.getItem('circuit-lab-performance')), 'quality');
  console.log('errors', errors);
  assert.equal(errors.length, 0);
} catch (e) {
  console.error(e);
  await p.screenshot({path: out + 'performance-failure.png'});
  process.exitCode = 1;
} finally {
  await b.close();
}
