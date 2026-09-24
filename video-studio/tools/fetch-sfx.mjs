// يجلب حزم Kenney الصوتية (رخصة CC0 — حرّة تماماً حتى تجارياً) ويفكّها في public/sfx/kenney
// الاستخدام: node tools/fetch-sfx.mjs
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PACKS = [
  "interface-sounds", // نقرات، تأكيد، إغلاق، تمرير — لواجهات الشاشة والمؤشر
  "impact-sounds",    // ضربات فيزيائية حقيقية — لهبوط العناوين الثقيلة
  "ui-audio",         // نقرات ناعمة — لظهور الكلمات الصغيرة
  "sci-fi-sounds",    // ليزر وأنظمة — للتقنية والبيانات
  "digital-audio",    // أصوات رقمية — للأرقام والعدّادات
  "rpg-audio",        // ورق، كتب، قماش — لقلب الصفحات والمخطوطات
];

const root = new URL("..", import.meta.url).pathname;
const out = join(root, "public/sfx/kenney");
mkdirSync(out, { recursive: true });

for (const pack of PACKS) {
  const dest = join(out, pack);
  if (existsSync(dest)) { console.log(`✓ ${pack} (موجود)`); continue; }
  const page = await (await fetch(`https://kenney.nl/assets/${pack}`)).text();
  const url = page.match(/https:\/\/kenney\.nl\/media\/pages\/assets\/[^"]+\.zip/)?.[0];
  if (!url) { console.error(`✗ ${pack}: لم أجد رابط التحميل`); continue; }
  const zip = join(out, `${pack}.zip`);
  writeFileSync(zip, Buffer.from(await (await fetch(url)).arrayBuffer()));
  mkdirSync(dest);
  execFileSync("unzip", ["-q", "-j", zip, "*.ogg", "-d", dest]);
  execFileSync("rm", [zip]);
  console.log(`✓ ${pack}`);
}
