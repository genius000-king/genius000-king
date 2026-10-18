export function segmentIntersectsBox(a, b, box, padding = 1.5) {
  let lo = 0,
    hi = 1;
  for (const k of [0, 2]) {
    const d = b[k] - a[k],
      min = box.min[k] - padding,
      max = box.max[k] + padding;
    if (Math.abs(d) < 1e-9) {
      if (a[k] < min || a[k] > max) return false;
    } else {
      let t = (min - a[k]) / d,
        u = (max - a[k]) / d;
      if (t > u) [t, u] = [u, t];
      lo = Math.max(lo, t);
      hi = Math.min(hi, u);
      if (lo > hi) return false;
    }
  }
  return true;
}

export function pathsCross(a, b, c, d) {
  const cross = (p, q, r) => (q[0] - p[0]) * (r[2] - p[2]) - (q[2] - p[2]) * (r[0] - p[0]);
  const eps = 0.001;
  return (
    cross(a, b, c) * cross(a, b, d) <= eps &&
    cross(c, d, a) * cross(c, d, b) <= eps &&
    Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <=
      Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) + 1 &&
    Math.max(Math.min(a[2], b[2]), Math.min(c[2], d[2])) <=
      Math.min(Math.max(a[2], b[2]), Math.max(c[2], d[2])) + 1
  );
}

export function escape(p, normal, owner, len = 4) {
  const q = p.map((v, i) => v + normal[i] * len);
  q[1] = Math.max(-0.5, q[1]);
  if (
    owner &&
    q[1] < owner.max[1] + 1 &&
    q[0] > owner.min[0] - 1 &&
    q[0] < owner.max[0] + 1 &&
    q[2] > owner.min[2] - 1 &&
    q[2] < owner.max[2] + 1
  ) {
    const choices = [
      [0, owner.min[0] - 3],
      [0, owner.max[0] + 3],
      [2, owner.min[2] - 3],
      [2, owner.max[2] + 3],
    ].sort((a, b) => Math.abs(q[a[0]] - a[1]) - Math.abs(q[b[0]] - b[1]));
    const out = [...q];
    out[choices[0][0]] = choices[0][1];
    return [q, out];
  }
  return [q];
}

export function autoRoute({
  a,
  b,
  normalA = [0, 1, 0],
  normalB = [0, 1, 0],
  escapeA = 4,
  escapeB = 4,
  ownerA,
  ownerB,
  obstacles = [],
  previous = [],
}) {
  const start = escape(a, normalA, ownerA, escapeA),
    end = escape(b, normalB, ownerB, escapeB),
    p = start.at(-1),
    q = end.at(-1);
  let height = Math.max(p[1], q[1]) + 5;
  for (const box of obstacles) if (segmentIntersectsBox(p, q, box)) height = Math.max(height, box.max[1] + 4);
  let moved = true;
  while (moved) {
    moved = false;
    for (const route of previous)
      if (pathsCross(p, q, route.a, route.b) && Math.abs(height - route.height) < 1.5) {
        height = route.height + 1.6;
        moved = true;
      }
  }
  const points = [a, ...start, [p[0], height, p[2]], [q[0], height, q[2]], ...end.reverse(), b].filter(
    (p, i, arr) => i === 0 || p.some((v, k) => Math.abs(v - arr[i - 1][k]) > 0.001)
  );
  return {points, a: p, b: q, height};
}
