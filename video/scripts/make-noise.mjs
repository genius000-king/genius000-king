// Generates a seamless 128x128 monochrome noise tile as PNG.
// Grain is what separates "flat CSS" from "designed" — but running an
// feTurbulence filter on every one of 28,560 frames is a rendering tax we
// refuse to pay. So we bake it once, here, and tile the result.
import {deflateSync} from 'node:zlib';
import {writeFileSync} from 'node:fs';

const SIZE = 128;

const crcTable = Array.from({length: 256}, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 4;  // grayscale + alpha
ihdr[10] = 0; // deflate
ihdr[11] = 0; // adaptive filtering
ihdr[12] = 0; // no interlace

// Deterministic PRNG so the tile is identical on every build.
let seed = 0x2f6e2b1;
const rand = () => {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed / 0xffffffff;
};

const raw = Buffer.alloc(SIZE * (SIZE * 2 + 1));
let p = 0;
for (let y = 0; y < SIZE; y++) {
  raw[p++] = 0; // filter type: none
  for (let x = 0; x < SIZE; x++) {
    const v = Math.round(rand() * 255);
    raw[p++] = v;   // luminance
    raw[p++] = 255; // opaque; the CSS layer controls strength
  }
}

writeFileSync('public/img/noise.png', Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, {level: 9})),
  chunk('IEND', Buffer.alloc(0)),
]));
console.log('wrote public/img/noise.png');
