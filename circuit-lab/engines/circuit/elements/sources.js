export const ALKALINE = soc => 0.78 + 0.22 * Math.sqrt(Math.max(0, soc));

export const LIION = soc => {
  const t = [
    [0, 3],
    [0.05, 3.3],
    [0.1, 3.45],
    [0.2, 3.6],
    [0.4, 3.7],
    [0.6, 3.8],
    [0.8, 3.95],
    [1, 4.2],
  ];
  soc = Math.max(0, Math.min(1, soc));
  for (let i = 1; i < t.length; i++)
    if (soc <= t[i][0]) {
      const [a, va] = t[i - 1],
        [b, vb] = t[i];
      return va + ((vb - va) * (soc - a)) / (b - a);
    }
  return 4.2;
};

export function battery(k, voc, rint, capacityMah, maxmA) {
  const soc = k.s.soc ?? 1;
  const v = voc(soc);
  k.S('+', '-', v, rint, 'battery ' + k.c.name, {max: maxmA / 1000});
  k.ref('-');
  k.post(() => {
    const vt = k.v('+') - k.v('-'),
      i = (v - vt) / rint;
    k.next.soc = Math.max(0, soc - (i * k.h) / (capacityMah * 3.6));
    k.next.i = i;
  });
  k.result(() => {
    const vt = k.v('+') - k.v('-'),
      i = (v - vt) / rint;
    if (Math.abs(i) * 1000 > maxmA)
      k.diag('error', `${k.c.name}: ${(i * 1000).toFixed(0)} mA exceeds ${maxmA} mA source rating.`);
    if (soc < 0.05) k.diag('warning', `${k.c.name}: battery is nearly empty (${(soc * 100).toFixed(1)} %).`);
    return {voltage: vt, current: i, soc};
  });
}
