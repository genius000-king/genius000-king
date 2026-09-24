// مسجّل الشاشة للبي-رول: يفتح موقعاً في متصفح حقيقي (بلا حساب)، يؤدي "كوريغرافيا"
// (كتابة في البحث، تمرير ناعم، توقّف، تحويم) ويسجّلها فيديو MP4 جاهزاً لإطار الماك.
//
// الاستخدام:
//   node tools/record-web.mjs youtube "fluid dynamics"        ← بحث يوتيوب + تمرير
//   node tools/record-web.mjs url https://example.com          ← أي صفحة + تمرير
//   node tools/record-web.mjs google "navier stokes"           ← بحث جوجل
//
// الناتج: public/broll/rec/<name>.mp4  + <name>.json (الطول + أحداث النقر/التمرير
// بالتوقيت، كي يضع المحرّك صوت النقرة وصوت التمرير في لحظتها بالضبط).
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const outDir = join(root, "public/broll/rec");
const tmp = join(outDir, ".tmp");
mkdirSync(tmp, { recursive: true });

const [mode = "youtube", query = "fluid dynamics", nameArg] = process.argv.slice(2);
const name = nameArg ?? `${mode}-${query.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}`.slice(0, 60);
const W = 1600, H = 1000;

// في بيئات فيها Chromium مثبّت مسبقاً (مثل هذه) نستخدمه بدل تنزيل نسخة جديدة
const sysChrome = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch(existsSync(sysChrome) ? { executablePath: sysChrome } : {});
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  locale: "en-US",
  colorScheme: "dark",
  recordVideo: { dir: tmp, size: { width: W, height: H } },
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
});
const page = await ctx.newPage();
const t0 = Date.now();
const events = [];
const mark = (type, extra = {}) => events.push({ type, t: (Date.now() - t0) / 1000, ...extra });

// مؤشّر فأرة مرئي (فيديو Playwright لا يرسم المؤشر) — سهم macOS
const CURSOR = `
  (() => { if (document.getElementById('__cur')) return;
    const c = document.createElement('div'); c.id='__cur';
    c.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28"><path d="M5 3l16 11.5-7 1.2 4.3 8.3-3.1 1.6-4.3-8.4L5 22z" fill="#000" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style,{position:'fixed',left:'0',top:'0',zIndex:2147483647,pointerEvents:'none',transition:'transform 0.08s linear',filter:'drop-shadow(0 2px 3px rgba(0,0,0,.4))'});
    document.documentElement.appendChild(c);
    addEventListener('mousemove', e => c.style.transform = 'translate('+(e.clientX-5)+'px,'+(e.clientY-3)+'px)', true);
    addEventListener('mousedown', () => { c.style.scale='0.85' }, true);
    addEventListener('mouseup', () => { c.style.scale='1' }, true);
  })();`;
await ctx.addInitScript(CURSOR);

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
async function glide(x1, y1, x2, y2, ms = 700) {
  const steps = Math.round(ms / 16);
  for (let i = 1; i <= steps; i++) {
    const p = ease(i / steps);
    // قوس خفيف بدل الخط المستقيم — حركة يد بشرية
    const arc = Math.sin(p * Math.PI) * 40;
    await page.mouse.move(x1 + (x2 - x1) * p, y1 + (y2 - y1) * p - arc);
    await page.waitForTimeout(16);
  }
}
async function smoothScroll(total, ms) {
  mark("scroll_start", { dur: ms / 1000 });
  const steps = Math.round(ms / 16);
  let done = 0;
  for (let i = 1; i <= steps; i++) {
    const target = total * ease(i / steps);
    await page.mouse.wheel(0, target - done);
    done = target;
    await page.waitForTimeout(16);
  }
  mark("scroll_end");
}
async function dismissConsent() {
  for (const label of [/accept all/i, /reject all/i, /i agree/i, /agree/i]) {
    const b = page.getByRole("button", { name: label }).first();
    if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await page.waitForTimeout(800); return; }
  }
}
async function typeHuman(text) {
  for (const ch of text) {
    await page.keyboard.type(ch);
    mark("key");
    await page.waitForTimeout(55 + Math.random() * 70);
  }
}

let cx = W * 0.7, cy = H * 0.7;
await page.mouse.move(cx, cy);

if (mode === "youtube") {
  await page.goto("https://www.youtube.com/", { waitUntil: "domcontentloaded" });
  await dismissConsent();
  await page.waitForTimeout(1500);
  const box = page.locator('input[name="search_query"]').first();
  const bb = await box.boundingBox();
  if (bb) {
    await glide(cx, cy, bb.x + 120, bb.y + bb.height / 2);
    cx = bb.x + 120; cy = bb.y + bb.height / 2;
    mark("click"); await box.click();
    await typeHuman(query);
    await page.waitForTimeout(300);
    mark("enter"); await page.keyboard.press("Enter");
  } else {
    await page.goto(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
  }
  await page.waitForSelector("ytd-video-renderer", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2200);
  await glide(cx, cy, W * 0.45, H * 0.55, 900); cx = W * 0.45; cy = H * 0.55;
  await smoothScroll(1400, 3200);
  await page.waitForTimeout(700);
  await smoothScroll(1800, 3600);
  await page.waitForTimeout(900);
} else if (mode === "google") {
  await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en`);
  await dismissConsent();
  await page.waitForTimeout(2000);
  await smoothScroll(1200, 3500);
  await page.waitForTimeout(800);
} else {
  await page.goto(query, { waitUntil: "load" });
  await dismissConsent();
  await page.waitForTimeout(2000);
  await smoothScroll(1600, 5000);
  await page.waitForTimeout(800);
}

const video = page.video();
await ctx.close();
await browser.close();
const webm = await video.path();

const mp4 = join(outDir, `${name}.mp4`);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", webm, "-c:v", "libx264", "-crf", "16", "-preset", "slow",
  "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart", mp4]);
const dur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4]).toString());
writeFileSync(join(outDir, `${name}.json`), JSON.stringify({ file: `broll/rec/${name}.mp4`, width: W, height: H, duration: dur, url: page.url(), events }, null, 2));
rmSync(tmp, { recursive: true, force: true });
console.log(`✓ ${mp4}  (${dur.toFixed(1)}s, ${events.length} حدث)`);
