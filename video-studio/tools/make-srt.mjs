// ملف التلقين: كل جملة من السكربت بتوقيت ظهور مشهدها في الفيديو.
// افتحه مع الفيديو (VLC/أي مشغّل) واقرأ الجملة وقت ظهورها — صوتك ينطبق على المشهد.
// الاستخدام: node tools/make-srt.mjs src/episodes/fake-experts/script.json out/fake-experts.srt
import { readFileSync, writeFileSync } from "node:fs";
import { timeline } from "../src/episodes/timing.mjs";

const [scriptPath, out] = process.argv.slice(2);
const fps = 30;
const ts = (fr) => {
  const ms = Math.round((fr / fps) * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
const tl = timeline(JSON.parse(readFileSync(scriptPath, "utf8")));
let n = 0;
const srt = tl.map((b) => {
  const text = b.id.startsWith("ch") ? `— ${b.title}${b.sub ? " · " + b.sub : ""} — (صمت)` : b.say;
  return `${++n}\n${ts(b.from)} --> ${ts(b.from + b.frames - 3)}\n${text}\n`;
}).join("\n");
writeFileSync(out, srt);
console.log(`✓ ${out}  (${n} سطر، ${ts(tl.at(-1).from + tl.at(-1).frames)})`);
