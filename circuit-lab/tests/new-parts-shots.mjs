// Screenshots of the relay module, solenoid and LC projects running in the app.
// Usage: node tests/new-parts-shots.mjs   (expects the app on 127.0.0.1:5173)
import {chromium} from '@playwright/test';
const out = new URL('../screenshots/', import.meta.url).pathname;
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const p = await b.newPage({viewport: {width: 1600, height: 1000}}),
  errors = [];
p.setDefaultTimeout(60000);
p.on('pageerror', e => errors.push(e.message));
p.on('dialog', d => d.accept());
await p.addInitScript(() => {
  sessionStorage.setItem('circuit-lab-force-webgl', '1');
  sessionStorage.setItem('circuit-lab-debug', '1');
  localStorage.getItem('circuit-lab-performance') ||
    localStorage.setItem('circuit-lab-performance', 'quality');
});
const btn = name =>
  p
    .getByRole('button', {name, exact: true})
    .first()
    .evaluate(el => el.click());
const open = async name => {
  for (const c of ['Close instruments', 'Close editor', 'Close inspector'])
    if (await p.getByRole('button', {name: c, exact: true}).count()) await btn(c);
  await btn('Projects');
  await p.getByLabel('Search projects').fill(name);
  await p
    .locator('.project-card')
    .first()
    .evaluate(el => el.click());
  await p.waitForFunction(() => window.__circuitLab.scene().objects.size > 2);
  await p.waitForTimeout(1500);
};
const runUntil = async (ms, test = () => true) => {
  await p
    .locator('.run-button')
    .first()
    .evaluate(el => el.click());
  await p.waitForFunction(t => window.__circuitLab.state().time > t, ms, {timeout: 120000});
};
try {
  await p.goto('http://127.0.0.1:5173/');
  await p.waitForFunction(() => window.__circuitLab?.scene()?.objects.size > 0);
  await open('Relay module');
  await runUntil(400);
  await p.waitForFunction(() => window.__circuitLab.state().components.k?.closed);
  await p
    .locator('.run-button')
    .first()
    .evaluate(el => el.click());
  await p.waitForTimeout(900);
  await p.screenshot({path: out + '17-relay-module.png'});
  await open('Solenoid striker');
  await runUntil(100);
  await p.waitForFunction(() => window.__circuitLab.state().components.sol?.stroke > 9);
  await p
    .locator('.run-button')
    .first()
    .evaluate(el => el.click());
  await p.waitForTimeout(900);
  await p.screenshot({path: out + '18-solenoid-striker.png'});
  await open('LC ringing');
  await runUntil(1300);
  await p
    .locator('.run-button')
    .first()
    .evaluate(el => el.click());
  await btn('Workspace options');
  await p.getByText('Instruments', {exact: true}).click();
  await btn('Oscilloscope');
  await p.waitForTimeout(1200);
  await p.screenshot({path: out + '19-lc-ringing.png'});
  console.log('errors', errors);
} catch (e) {
  console.error(e);
  await p.screenshot({path: out + 'new-parts-failure.png'});
  process.exitCode = 1;
} finally {
  await b.close();
}
