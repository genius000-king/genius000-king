// Drives the WebGL film in headless Chromium (SwiftShader) and pipes frames to ffmpeg.
//   node render.mjs stills 3,8.2,13 out/stills          -> PNG stills at given seconds
//   node render.mjs video out/video.mp4 [startFrame] [endFrame]
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const [, , mode, arg1, arg2, arg3, arg4] = process.argv;
const QS = process.env.QS || '';
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { const t = m.text(); if (!t.includes('GPU stall')) console.log('[page]', t); });
page.on('pageerror', (e) => console.log('[page error]', e.message));
await page.goto(`http://localhost:${port}/index.html?${QS}`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 600000 });
const TL = await page.evaluate(() => window.timeline);

if (mode === 'stills') {
  const times = arg1.split(',').map(Number);
  const dir = arg2 || 'out/stills';
  fs.mkdirSync(dir, { recursive: true });
  for (const t of times) {
    const t0 = Date.now();
    const url = await page.evaluate((t) => window.renderStill(t), t);
    const file = path.join(dir, `t${t.toFixed(2).padStart(5, '0')}.png`);
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    console.log(file, `${Date.now() - t0} ms`);
  }
} else if (mode === 'points') {
  for (const t of arg1.split(',').map(Number)) console.log(t, JSON.stringify(await page.evaluate((t) => window.debugPoints(t), t)));
} else if (mode === 'video') {
  const out = arg1 || 'out/video.mp4';
  const total = Math.round(TL.duration * TL.fps);
  const start = +(arg2 || 0), end = +(arg3 || total);
  const crf = arg4 || '14';
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1280x720', '-r', String(TL.fps), '-i', '-',
    '-vf', 'vflip', '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = start; f < end; f++) {
    const b64 = await page.evaluate((t) => window.renderFrame(t), f / TL.fps);
    const buf = Buffer.from(b64, 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - start) % 15 === 0) {
      const el = (Date.now() - t0) / 1000, done = f - start + 1;
      console.log(`frame ${f}/${end}  ${(el / done).toFixed(2)} s/frame  eta ${((end - f - 1) * el / done / 60).toFixed(1)} min`);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log('wrote', out, ((Date.now() - t0) / 1000).toFixed(0), 's');
}
await browser.close();
server.close();
