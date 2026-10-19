// Developer tools in the real app: serial plotter, RAM report after compiling, scope CSV export.
// Usage: node tests/dev-tools.mjs   (expects the app on 127.0.0.1:5173)
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const out = new URL('../screenshots/', import.meta.url).pathname;
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const p = await b.newPage({viewport: {width: 1600, height: 1000}, acceptDownloads: true}),
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
  for (const c of ['Close instruments', 'Close editor'])
    if (await p.getByRole('button', {name: c, exact: true}).count()) await btn(c);
  await btn('Projects');
  await p.getByLabel('Search projects').fill(name);
  await p
    .locator('.project-card')
    .first()
    .evaluate(el => el.click());
  await p.waitForTimeout(1500);
};
const SKETCH = `void setup() {
  Serial.begin(115200);
}
void loop() {
  float t = millis() / 1000.0;
  Serial.print("wave:");
  Serial.print(sin(t * 6.283) * 100);
  Serial.print(" knob:");
  Serial.println(analogRead(36) / 20);
  delay(20);
}
`;
try {
  await p.goto('http://127.0.0.1:5173/');
  await p.waitForFunction(() => window.__circuitLab?.scene()?.objects.size > 0);
  await open('Dial it in');
  await btn('Code');
  await p.waitForSelector('.cm-content');
  await p.locator('.cm-content').click();
  await p.keyboard.press('Control+A');
  await p.keyboard.insertText(SKETCH);
  await p
    .locator('.run-button')
    .first()
    .evaluate(el => el.click());
  await p.waitForFunction(() => window.__circuitLab.state().time > 2500, null, {timeout: 120000});
  // RAM report next to "Build ready"
  const ram = await p.locator('.ram-meter').textContent();
  console.log('ram meter:', ram, '|', (await p.locator('.ram-meter').getAttribute('title')).split('\n')[0]);
  assert.match(ram, /RAM \d+%/);
  await btn('Workspace options');
  await p.getByText('Instruments', {exact: true}).click();
  await btn('Serial plotter');
  await p.waitForSelector('.plotter-canvas');
  await p.waitForTimeout(1200);
  const legend = await p.locator('.plot-legend').allTextContents();
  console.log('plotter series:', legend);
  assert.deepEqual(
    legend.map(l => l.replace(/[-\d.]+$/, '')),
    ['wave', 'knob']
  );
  await btn('Freeze');
  await p.screenshot({path: out + '16-serial-plotter.png'});
  // oscilloscope capture as CSV
  await open('RC filter');
  await p
    .locator('.run-button')
    .first()
    .evaluate(el => el.click());
  await p.waitForFunction(() => window.__circuitLab.state().time > 1500, null, {timeout: 120000});
  await btn('Workspace options');
  await p.getByText('Instruments', {exact: true}).click();
  await btn('Oscilloscope');
  await p.waitForSelector('.capture-head button');
  const [download] = await Promise.all([
    p.waitForEvent('download'),
    p.locator('.capture-head button').first().click(),
  ]);
  const csv = await (await download.createReadStream()).toArray().then(c => Buffer.concat(c).toString());
  const rows = csv.trim().split('\n');
  console.log('csv:', download.suggestedFilename(), rows.length, 'rows,', rows[0], '|', rows[1]);
  assert.equal(rows[0], 'time (ms),CH1 (V),CH2 (V)');
  assert.ok(rows.length > 50);
  console.log('errors', errors);
  assert.equal(errors.length, 0);
} catch (e) {
  console.error(e);
  await p.screenshot({path: out + 'dev-tools-failure.png'});
  process.exitCode = 1;
} finally {
  await b.close();
}
