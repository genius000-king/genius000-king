// Drives the real app in Chromium and captures screenshots of each feature.
// Usage: node tests/app-tour.mjs [steps…]   (expects `npm run dev` on 127.0.0.1:5173)
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const out = new URL('../screenshots/', import.meta.url).pathname,
  only = process.argv.slice(2);
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const p = await b.newPage({viewport: {width: 1600, height: 1000}}),
  errors = [];
p.setDefaultTimeout(60000);
p.on('pageerror', e => errors.push(e.message));
p.on('console', m => {
  if (m.type() === 'error') errors.push(m.text());
});
p.on('dialog', d => d.accept());
await p.addInitScript(() => {
  sessionStorage.setItem('circuit-lab-force-webgl', '1');
  (sessionStorage.setItem('circuit-lab-debug', '1'),
    localStorage.getItem('circuit-lab-performance') ||
      localStorage.setItem('circuit-lab-performance', 'quality'));
});
const click = sel =>
  p
    .locator(sel)
    .first()
    .evaluate(el => el.click());
const btn = name =>
  p
    .getByRole('button', {name, exact: true})
    .first()
    .evaluate(el => el.click());
const shot = async (name, wait = 900) => {
  await p.waitForTimeout(wait);
  await p.screenshot({path: out + name + '.png'});
  console.log('shot', name);
};
const state = () => p.evaluate(() => window.__circuitLab.state());
const openProject = async name => {
  for (const c of ['Close instruments', 'Close editor', 'Close inspector', 'Close projects'])
    if (await p.getByRole('button', {name: c, exact: true}).count()) await btn(c);
  await btn('Projects');
  await p.getByLabel('Search projects').fill(name);
  await click('.project-card');
  await p.waitForFunction(() => window.__circuitLab.scene().objects.size > 0);
  await p.waitForTimeout(1500);
};
const run = async ms => {
  await click('.run-button');
  await p.waitForFunction(t => window.__circuitLab.state().time > t, ms, {timeout: 120000});
};
const pause = async () => {
  if ((await state()).running) await click('.run-button');
};
const step = n => !only.length || only.includes(n);
try {
  await p.goto('http://127.0.0.1:5173/');
  await p.waitForFunction(() => window.__circuitLab?.scene()?.objects.size > 0);
  if (step('library')) {
    await btn('Components');
    await shot('01-library', 4000);
    await p.locator('.category-tabs button', {hasText: 'Boards'}).first().click();
    await shot('02-library-boards', 2500);
    await btn('Collapse components');
  }
  if (step('gallery')) {
    await btn('Projects');
    await shot('03-project-gallery');
    await btn('Close projects');
  }
  if (step('traffic')) {
    await openProject('Traffic light');
    await run(400);
    await shot('04-traffic-light-running');
    await pause();
  }
  if (step('uno')) {
    await openProject('Ultrasonic ruler');
    await run(1200);
    await pause();
    await shot('05-uno-ultrasonic-lcd');
  }
  if (step('scope')) {
    await openProject('RC filter');
    await run(1500);
    await pause();
    await btn('Workspace options');
    await p.getByText('Instruments', {exact: true}).click();
    await btn('Oscilloscope');
    await shot('06-rc-oscilloscope');
  }
  if (step('opamp')) {
    await openProject('Op-amp amplifier');
    await run(800);
    await pause();
    await shot('07-opamp-breadboard');
  }
  if (step('555')) {
    await openProject('555 LED flasher');
    await run(600);
    await shot('08-555-breadboard');
    await pause();
  }
  if (step('pico')) {
    await openProject('NeoPixel rainbow');
    await run(300);
    await pause();
    await shot('09-pico-neopixel');
  }
  if (step('inspector')) {
    await openProject('Shift register');
    const pt = await p.evaluate(() => {
      const s = window.__circuitLab.scene(),
        g = s.objects.get('uno'),
        v = g.position.clone();
      v.x -= 12;
      v.z += 17;
      v.y += 3;
      v.project(s.camera);
      const r = s.renderer.domElement.getBoundingClientRect();
      return {x: r.left + ((v.x + 1) * r.width) / 2, y: r.top + ((1 - v.y) * r.height) / 2};
    });
    await p.mouse.click(pt.x, pt.y);
    await shot('10-board-inspector');
  }
  if (step('tools')) {
    await btn('Workspace options');
    await btn('Engineering calculators');
    await shot('11-calculators');
    await btn('Close tools');
  }
  if (step('docs')) {
    await btn('Workspace options');
    await btn('Reference & shortcuts');
    await p.waitForSelector('.docs-modal');
    await p
      .locator('.docs-modal details')
      .nth(1)
      .evaluate(el => (el.open = true));
    await shot('13-reference');
    await btn('Close reference');
  }
  if (step('code')) {
    await openProject('Keypad door lock');
    await btn('Code');
    await shot('12-editor-keypad');
  }
  await fs.writeFile(out + 'tour-errors.json', JSON.stringify(errors, null, 1));
  console.log('errors', errors.length, errors.slice(0, 5));
} catch (e) {
  console.error(e);
  await p.screenshot({path: out + 'tour-failure.png'});
  process.exitCode = 1;
} finally {
  await b.close();
}
