// يفهرس كل ملفات public/sfx مع أطوالها → src/sfx/durations.json
// المحرّك يحتاج الطول ليضع "ذروة" الصوت (نهاية الرايزر، منتصف الووش) على فريم الحدث بالضبط.
import { execFileSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const pub = join(root, "public");
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const out = {};
for (const f of walk(join(pub, "sfx")).filter((f) => /\.(wav|ogg|mp3)$/.test(f))) {
  const d = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString();
  out[relative(pub, f)] = Math.round(parseFloat(d) * 1000) / 1000;
}
writeFileSync(join(root, "src/sfx/durations.json"), JSON.stringify(out, null, 1));
console.log(`✓ ${Object.keys(out).length} ملف صوتي مفهرس`);
