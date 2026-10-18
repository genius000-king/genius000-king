/** Adafruit_SSD1306: 128×64 OLED; drawing calls fall through to the shared Gfx canvas. Called as handler.call(simulator, o, args, method, cls, a). */
export const ssd1306Methods = {
  'Adafruit_SSD1306.begin'(o, args) {
    this.ensureWire();
    o.address = args[1] ?? 60;
    this.transaction(o.address, [0xae, 0xd5, 0x80, 0xaf], 'SSD1306 init');
    return 1;
  },
  'Adafruit_SSD1306.display'(o) {
    const dev = this.transaction(o.address, [0x40, ...o.gfx.bytes()], 'SSD1306 frame');
    if (dev?.type === 'oled') {
      this.oled.screens[dev.id] = o.gfx.text();
      this.oled.gfx[dev.id] = o.gfx.list();
    }
    return 0;
  },
  'Adafruit_SSD1306.width'(o) {
    return o.gfx.w;
  },
  'Adafruit_SSD1306.height'(o) {
    return o.gfx.h;
  },
};
