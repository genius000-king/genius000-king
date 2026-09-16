// Generates a YouTube-ready .srt from the transcript's own timestamps.
// Each cue ends where the next one begins, so the file can never drift
// out of step with the picture.
import {writeFileSync} from 'node:fs';
import {readFileSync} from 'node:fs';

const src = readFileSync('src/script/transcript.ts', 'utf8');
const lines = [...src.matchAll(/\{at: '(\d+:\d+)', text: '([\s\S]*?)'\},/g)].map((m) => ({
  at: m[1],
  text: m[2].replace(/\\'/g, "'"),
}));

const toSec = (clock) => {
  const [m, s] = clock.split(':').map(Number);
  return m * 60 + s;
};
const stamp = (sec) => {
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(Math.floor(sec % 60)).padStart(2, '0');
  const ms = String(Math.round((sec % 1) * 1000)).padStart(3, '0');
  return `${h}:${m}:${s},${ms}`;
};

const END = toSec('15:55');
const out = lines
  .map((l, i) => {
    const start = toSec(l.at);
    // Leave a 120 ms gap so consecutive cues never visually collide.
    const end = (i + 1 < lines.length ? toSec(lines[i + 1].at) : END) - 0.12;
    return `${i + 1}\n${stamp(start)} --> ${stamp(end)}\n${l.text}\n`;
  })
  .join('\n');

writeFileSync('out/storage-film.ar.srt', out, 'utf8');
console.log(`wrote out/storage-film.ar.srt — ${lines.length} cues`);
