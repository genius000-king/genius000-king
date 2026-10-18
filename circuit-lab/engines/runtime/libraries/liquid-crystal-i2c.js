/** LiquidCrystal_I2C: HD44780 16×2 through a PCF8574 backpack. Called as handler.call(simulator, o, args, method, cls, a). */
export const liquidCrystalI2cMethods = {
  'LiquidCrystal_I2C.init'(o) {
    this.ensureWire();
    o.text = Array(4).fill(' '.repeat(o.cols));
    o.cursor = [0, 0];
    this.lcdFrame(o);
    return 0;
  },
  'LiquidCrystal_I2C.backlight'(o) {
    o.backlight = true;
    this.lcdFrame(o);
    return 0;
  },
  'LiquidCrystal_I2C.noBacklight'(o) {
    o.backlight = false;
    this.lcdFrame(o);
    return 0;
  },
  'LiquidCrystal_I2C.clear'(o) {
    o.text = Array(4).fill(' '.repeat(o.cols));
    o.cursor = [0, 0];
    this.lcdFrame(o);
    return 0;
  },
  'LiquidCrystal_I2C.home'(o) {
    o.cursor = [0, 0];
    return 0;
  },
  'LiquidCrystal_I2C.setCursor'(o, args) {
    o.cursor = [
      Math.max(0, Math.min(o.cols - 1, args[0] | 0)),
      Math.max(0, Math.min(o.rows - 1, args[1] | 0)),
    ];
    return 0;
  },
  'LiquidCrystal_I2C.print'(o, args) {
    const s = this.fmt(args[0] ?? '', args.at(-1), args.length > 2 ? args[1] : undefined);
    for (const ch of s) {
      if (ch === '\n') continue;
      const [cx, cy] = o.cursor;
      if (cx < 40) {
        const line = (o.text[cy] || '').padEnd(o.cols, ' ');
        o.text[cy] = line.slice(0, cx) + ch + line.slice(cx + 1);
      }
      o.cursor = [cx + 1, cy];
    }
    this.lcdFrame(o);
    return s.length;
  },
  'LiquidCrystal_I2C.display'(o, args, method) {
    o.off = method === 'noDisplay';
    this.lcdFrame(o);
    return 0;
  },
};

// same behaviour, other names
Object.assign(liquidCrystalI2cMethods, {
  'LiquidCrystal_I2C.begin': liquidCrystalI2cMethods['LiquidCrystal_I2C.init'],
  'LiquidCrystal_I2C.println': liquidCrystalI2cMethods['LiquidCrystal_I2C.print'],
  'LiquidCrystal_I2C.noDisplay': liquidCrystalI2cMethods['LiquidCrystal_I2C.display'],
});
