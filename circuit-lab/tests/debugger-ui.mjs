// The firmware debugger in the real app: breakpoint from the editor gutter, halt, step, variables, continue.
// Usage: node tests/debugger-ui.mjs   (expects the app on 127.0.0.1:5173)
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
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
const halted = () => p.locator('.debug-state.halted').textContent();
try {
  await p.goto('http://127.0.0.1:5173/');
  await p.waitForFunction(() => window.__circuitLab?.scene()?.objects.size > 0);
  await btn('Projects');
  await p.getByLabel('Search projects').fill('Traffic light');
  await p
    .locator('.project-card')
    .first()
    .evaluate(el => el.click());
  await p.waitForFunction(() => window.__circuitLab.scene().objects.size > 3);
  await btn('Code');
  await p.waitForSelector('.cm-content');
  await btn('Dock editor left').catch(() => {});
  await p.waitForTimeout(600);
  // a breakpoint on the first call inside loop()
  const line = await p.evaluate(() => {
    const lines = window.__circuitLab.project().files['main.ino'].split('\n'),
      loop = lines.findIndex(l => l.includes('void loop'));
    return lines.findIndex((l, i) => i > loop && l.includes('show(')) + 1;
  });
  await p.waitForTimeout(900);
  const text = await p.evaluate(
    l => window.__circuitLab.project().files['main.ino'].split('\n')[l - 1].trim(),
    line
  );
  const row = p.locator('.cm-line', {hasText: text}).first(),
    box = await row.boundingBox(),
    gutter = await p.locator('.cm-bp-gutter').boundingBox();
  await p.mouse.click(gutter.x + gutter.width / 2, box.y + box.height / 2);
  await p.waitForSelector('.cm-bp.on');
  await p
    .locator('.run-button')
    .first()
    .evaluate(el => el.click());
  await p.waitForSelector('.debug-state.halted', {timeout: 120000});
  const first = await halted();
  console.log('halted:', first);
  assert.match(first, new RegExp(`Breakpoint · line ${line}`));
  assert.ok(await p.locator('.cm-paused-line').count(), 'the editor highlights the halted line');
  const t0 = (await p.evaluate(() => window.__circuitLab.state())).time;
  await p.waitForTimeout(800);
  assert.equal((await p.evaluate(() => window.__circuitLab.state())).time, t0, 'the bench stands still');
  await p.screenshot({path: out + '15-debugger-breakpoint.png'});
  await p.keyboard.press('F10');
  await p.waitForFunction(
    l => document.querySelector('.debug-state.halted')?.textContent.includes('Stepped'),
    line
  );
  const second = await halted();
  console.log('after F10:', second);
  assert.match(second, /Stepped · line \d+/);
  assert.notEqual(second, first);
  const vars = await p.locator('.debug-var').count();
  console.log('variables shown:', vars);
  await p.keyboard.press('F8');
  await p.waitForFunction(() =>
    document.querySelector('.debug-state.halted')?.textContent.includes('Breakpoint')
  );
  console.log('after F8:', await halted());
  // remove the breakpoint from the list and continue: the bench runs freely
  await p.getByRole('button', {name: 'Remove breakpoint'}).first().click();
  await btn('Continue');
  await p.waitForFunction(t => window.__circuitLab.state().time > t + 500, t0);
  assert.equal(await p.locator('.debug-state.halted').count(), 0);
  console.log('errors', errors);
  assert.equal(errors.length, 0);
} catch (e) {
  console.error(e);
  await p.screenshot({path: out + 'debugger-failure.png'});
  process.exitCode = 1;
} finally {
  await b.close();
}
