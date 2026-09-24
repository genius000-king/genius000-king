// مراجعة سريعة: يرندر فريماً من كل مشهد (عند نسبة من طوله) بدل رندر الحلقة كاملة.
// الاستخدام: node tools/beat-stills.mjs FakeExperts src/episodes/fake-experts/script.json out/stills 0.6 [ids...]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync, readFileSync } from "node:fs";
import { timeline } from "../src/episodes/timing.mjs";

const [comp, scriptPath, outDir, at = "0.6", ...only] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const tl = timeline(JSON.parse(readFileSync(scriptPath, "utf8")));
const serveUrl = await bundle({ entryPoint: new URL("../src/index.ts", import.meta.url).pathname });
const composition = await selectComposition({ serveUrl, id: comp });
for (const b of tl) {
  if (only.length && !only.includes(b.id)) continue;
  const frame = b.from + Math.round(b.frames * parseFloat(at));
  await renderStill({ serveUrl, composition, frame, output: `${outDir}/${String(tl.indexOf(b)).padStart(2, "0")}_${b.id}.jpg`, imageFormat: "jpeg", scale: 0.25 });
  process.stdout.write(`${b.id} `);
}
console.log("\n✓");
