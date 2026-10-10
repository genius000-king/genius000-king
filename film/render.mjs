// Renders the identity film deterministically via the browser page (src/film.js).
// Usage:
//   node render.mjs --preview --w 640 --h 360 --fps 30 --sub 2 --times 1,3,7
//   node render.mjs --w 1920 --h 1080 --fps 60 --sub 4 --workers 4 --encode
//   node render.mjs --w 3840 --h 2160 ...   (4K, same pipeline; slower)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const flag = name => args.includes('--' + name);

const W = +opt('w', 1920), H = +opt('h', 1080), FPS = +opt('fps', 60), SUB = +opt('sub', 4);
const DUR = 30.0, WORKERS = +opt('workers', 4);
const CHROME = opt('chrome', '/opt/pw-browsers/chromium');
const OUT = path.join(ROOT, 'out');
const FRAMES = path.join(OUT, opt('frames-dir', `frames_${W}x${H}_${FPS}`));
const AUDIO = path.join(OUT, 'audio_mix.wav');
const FINAL = path.join(OUT, opt('name', `identity_${H}p${FPS}.mp4`));

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const fp = path.join(ROOT, p === '/' ? 'index.html' : p);
  if (!fp.startsWith(ROOT) || fp.includes(path.sep + 'out' + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/index.html?w=${W}&h=${H}&fps=${FPS}&sub=${SUB}`;

fs.mkdirSync(FRAMES, { recursive: true });

async function runWorker(id, jobs) {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error(`[w${id}] pageerror`, e.message));
  page.on('console', m => { if (m.type() === 'error') console.error(`[w${id}]`, m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  const t0 = Date.now();
  let n = 0;
  for (const job of jobs) {
    if (!flag('preview') && fs.existsSync(job.file)) continue;
    await page.evaluate(t => window.renderFrame(t), job.t);
    await page.screenshot({ path: job.file, type: 'png' });
    n++;
    if (n % 50 === 0) console.log(`[w${id}] ${n}/${jobs.length} frames, ${((Date.now() - t0) / n).toFixed(0)} ms/frame`);
  }
  await browser.close();
  return n;
}

async function runAll(jobs) {
  const buckets = Array.from({ length: WORKERS }, () => []);
  jobs.forEach((j, i) => buckets[i % WORKERS].push(j));
  const t0 = Date.now();
  const counts = await Promise.all(buckets.map((b, i) => runWorker(i, b)));
  console.log(`rendered ${counts.reduce((a, b) => a + b, 0)} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

if (flag('preview')) {
  fs.mkdirSync(path.join(OUT, 'preview'), { recursive: true });
  const times = opt('times', '1,3,7,12,17,22,28,29.9').split(',').map(Number);
  await runAll(times.map(t => ({ t, file: path.join(OUT, 'preview', `t${String(t).replace('.', '_')}_${W}x${H}.png`) })));
} else {
  const total = Math.round(DUR * FPS);
  const from = +opt('from', 0), to = +opt('to', total);
  const jobs = [];
  for (let i = from; i < to; i++) jobs.push({ t: i / FPS, file: path.join(FRAMES, `frame_${String(i).padStart(5, '0')}.png`) });
  await runAll(jobs);
  if (flag('encode')) {
    if (!fs.existsSync(AUDIO)) throw new Error('missing audio mix: run audio/make_audio.py first');
    const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error',
      '-framerate', String(FPS), '-start_number', String(from), '-i', path.join(FRAMES, 'frame_%05d.png'),
      '-i', AUDIO,
      '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-tune', 'film',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(DUR), '-movflags', '+faststart', FINAL], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('ffmpeg failed');
    console.log('wrote', FINAL);
  }
}
server.close();
