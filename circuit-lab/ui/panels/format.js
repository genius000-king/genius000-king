export const fmtNum = (v, digits = 2) => {
  if (typeof v !== 'number') return v ?? '—';
  if (!Number.isFinite(v)) return v > 0 ? '∞' : '—';
  const a = Math.abs(v);
  return a !== 0 && (a < 1e-3 || a >= 1e6) ? v.toExponential(2) : v.toFixed(digits);
};

export const stats = v => {
  if (!v.length) return null;
  let min = Infinity,
    max = -Infinity,
    sum = 0;
  for (const x of v) {
    if (x < min) min = x;
    if (x > max) max = x;
    sum += x;
  }
  return {min, max, mean: sum / v.length, pp: max - min};
};

export function frequency(t, v) {
  const s = stats(v);
  if (!s || s.pp < 0.05) return null;
  const mid = (s.max + s.min) / 2,
    ups = [];
  for (let i = 1; i < v.length; i++) if (v[i - 1] < mid && v[i] >= mid) ups.push(t[i]);
  if (ups.length < 2) return null;
  return (1000 * (ups.length - 1)) / (ups.at(-1) - ups[0]);
}

export const E12 = [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];

export const nearestE12 = r => {
  if (!(r > 0)) return null;
  const d = Math.pow(10, Math.floor(Math.log10(r)));
  let best = null;
  for (const m of [...E12.map(x => x * d), 10 * d])
    if (!best || Math.abs(Math.log(m / r)) < Math.abs(Math.log(best / r))) best = m;
  return best;
};

export const ohms = r =>
  !(r > 0)
    ? '—'
    : r >= 1e6
      ? `${+(r / 1e6).toFixed(2)} MΩ`
      : r >= 1e3
        ? `${+(r / 1e3).toFixed(2)} kΩ`
        : `${+r.toFixed(2)} Ω`;
