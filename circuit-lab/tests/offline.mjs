// The production site works offline after one visit (service worker in public/sw.js).
// Usage: npm run build && npm start & node tests/offline.mjs
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const ctx = await b.newContext({viewport: {width: 1280, height: 800}}),
  p = await ctx.newPage(),
  errors = [];
p.setDefaultTimeout(60000);
p.on('pageerror', e => errors.push(e.message));
await p.addInitScript(() => {
  sessionStorage.setItem('circuit-lab-force-webgl', '1');
  sessionStorage.setItem('circuit-lab-debug', '1');
});
try {
  await p.goto('http://127.0.0.1:5173/');
  await p.waitForFunction(() => window.__circuitLab?.scene()?.objects.size > 0);
  await p
    .waitForFunction(() => navigator.serviceWorker?.controller || null, null, {timeout: 20000})
    .catch(() => p.reload());
  await p.waitForFunction(() => window.__circuitLab?.scene()?.objects.size > 0);
  await p.waitForTimeout(1500);
  await ctx.setOffline(true);
  await p.reload();
  await p.waitForFunction(
    () => window.__circuitLab?.scene()?.objects.size > 0 && window.__circuitLab.state().nets > 0
  );
  const state = await p.evaluate(() => ({
    nets: window.__circuitLab.state().nets,
    sw: !!navigator.serviceWorker.controller,
  }));
  console.log('offline reload', state);
  assert.ok(state.sw && state.nets > 0);
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('offline ok');
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await b.close();
}
