/** Arduino math, bit and random helpers. Called as handler.call(simulator, args, name). */
export const mathApi = {
  min(a) {
    return Math.min(...a);
  },
  max(a) {
    return Math.max(...a);
  },
  abs(a) {
    const x = a[0];
    return Math.abs(x);
  },
  sq(a) {
    const x = a[0];
    return x * x;
  },
  sqrt(a) {
    const x = a[0];
    return Math.sqrt(x);
  },
  pow(a) {
    const x = a[0];
    return Math.pow(x, a[1]);
  },
  sin(a) {
    const x = a[0];
    return Math.sin(x);
  },
  cos(a) {
    const x = a[0];
    return Math.cos(x);
  },
  tan(a) {
    const x = a[0];
    return Math.tan(x);
  },
  atan(a) {
    const x = a[0];
    return Math.atan(x);
  },
  atan2(a) {
    const x = a[0];
    return Math.atan2(x, a[1]);
  },
  asin(a) {
    const x = a[0];
    return Math.asin(x);
  },
  acos(a) {
    const x = a[0];
    return Math.acos(x);
  },
  exp(a) {
    const x = a[0];
    return Math.exp(x);
  },
  log(a) {
    const x = a[0];
    return Math.log(x);
  },
  log10(a) {
    const x = a[0];
    return Math.log10(x);
  },
  floor(a) {
    const x = a[0];
    return Math.floor(x);
  },
  ceil(a) {
    const x = a[0];
    return Math.ceil(x);
  },
  round(a) {
    const x = a[0];
    return Math.round(x);
  },
  fabs(a) {
    const x = a[0];
    return Math.abs(x);
  },
  map(a) {
    const x = a[0];
    if (a[1] === a[2]) throw Error('map input range is zero');
    return Math.trunc(((Math.trunc(x) - a[1]) * (a[4] - a[3])) / (a[2] - a[1]) + a[3]);
  },
  constrain(a) {
    const x = a[0];
    return Math.max(a[1], Math.min(a[2], x));
  },
  bitRead(a) {
    const x = a[0];
    return (x >> a[1]) & 1;
  },
  bitSet(a) {
    const x = a[0];
    return x | (1 << a[1]);
  },
  bitClear(a) {
    const x = a[0];
    return x & ~(1 << a[1]);
  },
  bitWrite(a) {
    const x = a[0];
    return a[2] ? x | (1 << a[1]) : x & ~(1 << a[1]);
  },
  bit(a) {
    const x = a[0];
    return 1 << x;
  },
  highByte(a) {
    const x = a[0];
    return (x >> 8) & 255;
  },
  lowByte(a) {
    const x = a[0];
    return x & 255;
  },
  isnan(a) {
    const x = a[0];
    return Number.isNaN(x) ? 1 : 0;
  },
  isinf(a) {
    const x = a[0];
    return Math.abs(x) === Infinity ? 1 : 0;
  },
  random(a) {
    const low = a[0];
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return a.length === 1
      ? Math.floor((this.seed / 4294967296) * low)
      : Math.floor(low + (this.seed / 4294967296) * (a[1] - low));
  },
  randomSeed(a) {
    const seed = a[0];
    this.seed = seed >>> 0 || 12345;
    return 0;
  },
};
