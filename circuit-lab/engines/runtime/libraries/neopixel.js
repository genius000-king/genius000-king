/** Adafruit_NeoPixel: WS2812B strips, brightness scaling and colour helpers. Called as handler.call(simulator, o, args, method, cls, a). */
export const neopixelMethods = {
  'Adafruit_NeoPixel.begin'(o) {
    Object.assign(this.pin(o.pin), {mode: 1, value: 0});
    return 0;
  },
  'Adafruit_NeoPixel.numPixels'(o) {
    return o.n;
  },
  'Adafruit_NeoPixel.setBrightness'(o, args) {
    o.brightness = args[0] & 255;
    return 0;
  },
  'Adafruit_NeoPixel.getBrightness'(o) {
    return o.brightness;
  },
  'Adafruit_NeoPixel.clear'(o) {
    o.pixels.forEach(p => p.fill(0));
    return 0;
  },
  'Adafruit_NeoPixel.Color'(o, args) {
    return (((args[0] & 255) << 16) | ((args[1] & 255) << 8) | (args[2] & 255)) >>> 0;
  },
  'Adafruit_NeoPixel.ColorHSV'(o, args) {
    const h = (((args[0] ?? 0) % 65536) / 65536) * 6,
      s = (args[1] ?? 255) / 255,
      v = (args[2] ?? 255) / 255,
      i = Math.floor(h),
      f = h - i,
      p = v * (1 - s),
      q = v * (1 - s * f),
      t = v * (1 - s * (1 - f));
    const [r, g, b] = [
      [v, t, p],
      [q, v, p],
      [p, v, t],
      [p, q, v],
      [t, p, v],
      [v, p, q],
    ][i % 6];
    return ((Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255)) >>> 0;
  },
  'Adafruit_NeoPixel.gamma32'(o, args) {
    const c = args[0] >>> 0,
      gm = x => Math.round(Math.pow(x / 255, 2.6) * 255);
    return ((gm((c >> 16) & 255) << 16) | (gm((c >> 8) & 255) << 8) | gm(c & 255)) >>> 0;
  },
  'Adafruit_NeoPixel.setPixelColor'(o, args) {
    const i = args[0];
    if (i < 0 || i >= o.n) return 0;
    o.pixels[i] =
      args.length >= 4
        ? [args[1] & 255, args[2] & 255, args[3] & 255]
        : [(args[1] >>> 16) & 255, (args[1] >>> 8) & 255, args[1] & 255];
    return 0;
  },
  'Adafruit_NeoPixel.fill'(o, args) {
    const c = args[0] >>> 0,
      first = args[1] ?? 0,
      count = args[2] || o.n - first;
    for (let i = first; i < Math.min(o.n, first + count); i++)
      o.pixels[i] = [(c >>> 16) & 255, (c >>> 8) & 255, c & 255];
    return 0;
  },
  'Adafruit_NeoPixel.show'(o) {
    return this.neoShow(o);
  },
};
