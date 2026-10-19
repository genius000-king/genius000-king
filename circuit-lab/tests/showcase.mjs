// Builds a project containing the given part types in a grid, opens it through the app's
// file import, and screenshots it.  Usage: node tests/showcase.mjs out.png type1,type2,… [cols] [spacing]
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import {newProject} from '../engines/workspace/index.js';
import {makeComponent} from '../engines/catalog/index.js';
const [out, list, cols = '4', gap = '60', dir = '0.55,0.95,1', zoom = '0.92'] = process.argv.slice(2),
  types = list.split(','),
  p = newProject();
p.name = 'Parts showcase';
p.wires = [];
p.components = types.map((t, i) =>
  makeComponent(t, [((i % +cols) - (+cols - 1) / 2) * +gap, 0, Math.floor(i / +cols) * +gap], t + i)
);
delete p.activeBoard;
const file =
  '/tmp/claude-0/-home-user-genius000-king/e0fff6b0-f9ff-5166-b792-c5c87228c0e9/scratchpad/showcase.circuitlab.json';
await fs.writeFile(file, JSON.stringify(p));
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const pg = await b.newPage({viewport: {width: 1600, height: 1000}});
pg.on('dialog', d => d.accept());
await pg.addInitScript(
  () => (
    sessionStorage.setItem('circuit-lab-force-webgl', '1'),
    sessionStorage.setItem('circuit-lab-debug', '1'),
    localStorage.getItem('circuit-lab-performance') ||
      localStorage.setItem('circuit-lab-performance', 'quality')
  )
);
await pg.goto('http://127.0.0.1:5173/');
await pg.waitForFunction(() => window.__circuitLab?.scene()?.objects.size > 0);
await pg.locator('input[type=file]').setInputFiles(file);
await pg.waitForFunction(n => window.__circuitLab.scene().objects.size === n, types.length);
await pg.evaluate(
  ([d, z]) => {
    const s = window.__circuitLab.scene();
    s.focus();
    const t = s.controls.target,
      dist = s.camera.position.distanceTo(t);
    s.camera.position
      .copy(t)
      .add(new s.camera.position.constructor(...d).normalize().multiplyScalar(dist * z));
    s.dirty = true;
  },
  [dir.split(',').map(Number), +zoom]
);
await pg.waitForTimeout(1500);
await pg.screenshot({path: out});
console.log('ok', out);
await b.close();
