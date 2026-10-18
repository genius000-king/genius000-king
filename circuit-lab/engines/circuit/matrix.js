export function solveMatrix(a, b, n) {
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let j = k + 1; j < n; j++) if (Math.abs(a[j * n + k]) > Math.abs(a[p * n + k])) p = j;
    if (p !== k) {
      for (let j = k; j < n; j++) {
        const t = a[k * n + j];
        a[k * n + j] = a[p * n + j];
        a[p * n + j] = t;
      }
      const t = b[k];
      b[k] = b[p];
      b[p] = t;
    }
    const pivot = a[k * n + k];
    if (Math.abs(pivot) < 1e-18) continue;
    for (let i = k + 1; i < n; i++) {
      const f = a[i * n + k] / pivot;
      if (!f) continue;
      for (let j = k + 1; j < n; j++) a[i * n + j] -= f * a[k * n + j];
      b[i] -= f * b[k];
    }
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let v = b[i];
    for (let j = i + 1; j < n; j++) v -= a[i * n + j] * x[j];
    x[i] = Math.abs(a[i * n + i]) > 1e-18 ? v / a[i * n + i] : 0;
  }
  return x;
}
