'use strict';
// ══════════════════════════════════════════════════════════════
//  Castle — a voxel fortress. Surface voxels only; roofs/windows/gate in graphite, walls in white.
//  Pure data: returns [{x,y,z,cls,key}] with the origin at the centre of the base, y up.
// ══════════════════════════════════════════════════════════════
const Castle = (() => {
  const U = 0.13;                                           // cell edge in world units
  function build() {
    const V = new Map();
    const k = (x, y, z) => (x + 64) + (y + 8) * 128 + (z + 64) * 128 * 96;
    const put = (x, y, z, c) => V.set(k(x, y, z), [x, y, z, c]);
    const del = (x, y, z) => V.delete(k(x, y, z));
    const box = (x0, y0, z0, x1, y1, z1, c = 0) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(x, y, z, c); };
    const carve = (x0, y0, z0, x1, y1, z1) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) del(x, y, z); };
    const pyramid = (cx, cz, y0, hw, h, c = 1) => { for (let j = 0; j < h; j++) { const w = Math.max(0, Math.round(hw * (1 - j / h))); box(cx - w, y0 + j, cz - w, cx + w, y0 + j, cz + w, c); } };
    const crenel = (x0, z0, x1, z1, y) => {                  // alternating teeth on a rectangular rim
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
        const rim = x === x0 || x === x1 || z === z0 || z === z1;
        if (rim && ((x + z) % 4 < 2)) { put(x, y, z, 0); put(x, y + 1, z, 0); }
      }
    };
    const flag = (cx, cz, y0, h, sg = 1) => { for (let j = 0; j < h; j++) put(cx, y0 + j, cz, 0); for (let j = 0; j < 3; j++) for (let i = 1; i <= 4; i++) put(cx + sg * i, y0 + h - 1 - j, cz, 3); };
    const windowsXZ = (cx, cz, hw, ys, w = 1) => {            // dark window slits on the four faces of a tower
      for (const y of ys) for (let o = -w; o <= w; o += 2 * w + 2) {
        put(cx + o, y, cz - hw, 2); put(cx + o, y + 1, cz - hw, 2); put(cx + o, y + 2, cz - hw, 2);
        put(cx + o, y, cz + hw, 2); put(cx + o, y + 1, cz + hw, 2); put(cx + o, y + 2, cz + hw, 2);
        put(cx - hw, y, cz + o, 2); put(cx - hw, y + 1, cz + o, 2); put(cx - hw, y + 2, cz + o, 2);
        put(cx + hw, y, cz + o, 2); put(cx + hw, y + 1, cz + o, 2); put(cx + hw, y + 2, cz + o, 2);
      }
    };

    // curtain walls
    const W = 19;
    box(-W, 0, -W, W, 11, -W + 2); box(-W, 0, W - 2, W, 11, W); box(-W, 0, -W, -W + 2, 11, W); box(W - 2, 0, -W, W, 11, W);
    crenel(-W, -W, W, W, 12);
    // gate (front, +z)
    carve(-3, 0, W - 2, 3, 8, W); carve(-2, 9, W - 2, 2, 10, W);
    box(-3, 0, W - 3, 3, 8, W - 3, 2);                          // the glowing door
    box(-5, 9, W - 2, -4, 13, W, 0); box(4, 9, W - 2, 5, 13, W, 0);
    // gatehouse towers
    for (const gx of [-8, 8]) { box(gx - 2, 0, W - 3, gx + 2, 17, W + 1); crenel(gx - 2, W - 3, gx + 2, W + 1, 18); pyramid(gx, W - 1, 20, 3, 7); windowsXZ(gx, W - 1, 2, [9], 0); }
    // corner towers
    for (const [cx, cz, sg] of [[-W, -W, 1], [W, -W, -1], [-W, W, 1], [W, W, -1]]) {
      box(cx - 4, 0, cz - 4, cx + 4, 25, cz + 4); crenel(cx - 4, cz - 4, cx + 4, cz + 4, 26);
      windowsXZ(cx, cz, 4, [8, 16], 1); pyramid(cx, cz, 28, 5, 12); flag(cx, cz, 40, 6, sg);
    }
    // the keep
    box(-6, 0, -6, 6, 32, 6); crenel(-6, -6, 6, 6, 33); windowsXZ(0, 0, 6, [10, 18, 26], 1);
    box(-8, 20, -8, 8, 21, 8, 1); box(-7, 22, -7, 7, 22, 7, 0);   // a graphite gallery band
    box(-7, 35, -7, 7, 35, 7, 0);
    pyramid(0, 0, 36, 8, 18); flag(0, 0, 54, 8, 1);
    // gallery rail + interior hollow are cosmetic; extract the visible shell
    const out = [], cells = [...V.values()];
    const has = (x, y, z) => V.has(k(x, y, z));
    for (const [x, y, z, c] of cells) {
      if (has(x + 1, y, z) && has(x - 1, y, z) && has(x, y + 1, z) && has(x, y - 1, z) && has(x, y, z + 1) && has(x, y, z - 1)) continue;
      out.push({ x: x * U, y: (y + 0.5) * U, z: z * U, cls: c, key: y / 62, size: U * 0.49 });
    }
    return out;
  }
  return { build, U };
})();
