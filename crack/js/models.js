'use strict';
// ══════════════════════════════════════════════════════════════
//  Instance-set builders (pure data; deterministic).  12 floats per cube:
//  iA(3) iB(3) iP(size, delay, seed, cls) iR(ao, extra)
// ══════════════════════════════════════════════════════════════
const Models = (() => {
  // cls: 0 white ceramic → 1 graphite (continuous) · 2 chrome · 3 white spark · 4 cold-blue glint
  function shuffleOrder(n, seed) {
    const r = rng(seed), idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i;
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
    return idx;
  }
  // N³ cubes for hierarchical subdivision (iA = integer cell)
  function heroCube(N = 32, cls = 0) {
    const n = N ** 3, d = new Float32Array(n * 12), order = shuffleOrder(n, 11), r = rng(5);
    const depthOf = q => { const i = q % N, j = Math.floor(q / N) % N, k = Math.floor(q / (N * N)); return Math.min(i, j, k, N - 1 - i, N - 1 - j, N - 1 - k); };
    const idx = Array.from(order).sort((a, b) => depthOf(a) - depthOf(b));       // shell first, core last
    for (let s = 0; s < n; s++) {
      const q = idx[s], i = q % N, j = Math.floor(q / N) % N, k = Math.floor(q / (N * N));
      const dm = Math.min(i, j, k, N - 1 - i, N - 1 - j, N - 1 - k) / (N / 2);
      const o = s * 12;
      d.set([i, j, k, 0, 0, 0, 1 / N, 0, r(), cls, 0.4 + 0.6 * Math.pow(1 - dm, 1.5), Math.min(i, j, k, N - 1 - i, N - 1 - j, N - 1 - k)], o);
    }
    return d;
  }
  return { shuffleOrder, heroCube };
})();
