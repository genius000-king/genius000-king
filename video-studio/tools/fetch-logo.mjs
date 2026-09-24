// جالب الشعارات: تذكر اسم شركة/تطبيق → يجلب شعاره الرسمي إلى public/broll/logos
//
// الاستخدام:  node tools/fetch-logo.mjs youtube "Google" tiktok
//
// الترتيب:
//  1) Simple Icons — +3000 شعار SVG متجهي نظيف مع لون العلامة الرسمي (مثالي للتحريك)
//  2) ويكيبيديا — صورة الصفحة (للشركات غير الموجودة في Simple Icons)
// ويكتب manifest.json فيه: المسار + اللون الرسمي، فيقرؤه المكوّن <LogoReveal> مباشرة.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = join(root, "public/broll/logos");
mkdirSync(out, { recursive: true });
const manifestPath = join(out, "manifest.json");
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};

const slugify = (s) =>
  s.toLowerCase().replace(/\+/g, "plus").replace(/\./g, "dot").replace(/&/g, "and").replace(/[^a-z0-9]/g, "");

let siIndex;
async function simpleIcons() {
  if (siIndex) return siIndex;
  const r = await fetch("https://cdn.jsdelivr.net/npm/simple-icons@latest/data/simple-icons.json");
  const j = await r.json();
  siIndex = Array.isArray(j) ? j : j.icons;
  return siIndex;
}

async function fromSimpleIcons(name) {
  const icons = await simpleIcons();
  const want = slugify(name);
  const hit = icons.find((i) => (i.slug ?? slugify(i.title)) === want) ?? icons.find((i) => slugify(i.title) === want);
  if (!hit) return null;
  const slug = hit.slug ?? slugify(hit.title);
  const svg = await (await fetch(`https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${slug}.svg`)).text();
  if (!svg.startsWith("<svg")) return null;
  // نلوّن الـSVG بلون العلامة الرسمي ونحفظه
  const colored = svg.replace("<svg ", `<svg fill="#${hit.hex}" `);
  const file = `${slug}.svg`;
  writeFileSync(join(out, file), colored);
  return { file, color: `#${hit.hex}`, title: hit.title, source: "simple-icons (CC0)" };
}

async function fromWikipedia(name) {
  const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`, {
    headers: { "User-Agent": "video-studio/1.0 (broll fetcher)" },
  });
  if (!r.ok) return null;
  const j = await r.json();
  const src = j.originalimage?.source ?? j.thumbnail?.source;
  if (!src) return null;
  const ext = new URL(src).pathname.split(".").pop().toLowerCase();
  const file = `${slugify(name)}.${ext}`;
  const img = await fetch(src, { headers: { "User-Agent": "video-studio/1.0" } });
  writeFileSync(join(out, file), Buffer.from(await img.arrayBuffer()));
  return { file, color: "#111111", title: j.title, source: `wikipedia: ${j.content_urls?.desktop?.page}` };
}

const names = process.argv.slice(2);
if (!names.length) {
  console.log('الاستخدام: node tools/fetch-logo.mjs youtube "Google" tiktok');
  process.exit(1);
}
for (const name of names) {
  const res = (await fromSimpleIcons(name)) ?? (await fromWikipedia(name));
  if (!res) { console.error(`✗ ${name}: لم أجد شعاراً`); continue; }
  manifest[slugify(name)] = { ...res, file: `broll/logos/${res.file}` };
  console.log(`✓ ${name} → ${res.file}  ${res.color}  [${res.source}]`);
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
