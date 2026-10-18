/** HD44780 16×2 character LCD on the I²C backpack (fixed-address shortcut API). Called as handler.call(simulator, args, name). */
export const lcdApi = {
  'LCD.begin'(a) {
    const address = a[0];
    this.ensureWire();
    this.lcd.address = address ?? 39;
    return this.transaction(this.lcd.address, [0], 'LCD display on')?.type === 'lcd' ? 1 : 0;
  },
  'LCD.clear'(a) {
    this.lcd.text = '';
    this.lcd.cursor = 0;
    return 0;
  },
  'LCD.setCursor'(a) {
    const col = a[0];
    this.lcd.cursor = Math.max(0, Math.min(31, Math.floor(a[1] ?? 0) * 16 + Math.floor(col ?? 0)));
    return 0;
  },
  'LCD.print'(a, name) {
    const value = a[0];
    for (const ch of this.fmt(value, a.at(-1), a.length > 2 ? a[1] : undefined)) {
      if (this.lcd.cursor >= 32) break;
      this.lcd.text = this.lcd.text.padEnd(32, ' ');
      this.lcd.text = this.lcd.text.slice(0, this.lcd.cursor) + ch + this.lcd.text.slice(this.lcd.cursor + 1);
      this.lcd.cursor++;
    }
    if (name === 'LCD.println')
      this.lcd.cursor = Math.min(32, (Math.floor((this.lcd.cursor - 1) / 16) + 1) * 16);
    return 0;
  },
  'LCD.display'(a) {
    const lcd = this.transaction(
      this.lcd.address,
      Array.from(this.lcd.text).map(c => c.charCodeAt(0)),
      'LCD text frame'
    );
    if (lcd?.type === 'lcd') {
      this.oled.screens[lcd.id] = this.lcd.text.slice(0, 16) + '\n' + this.lcd.text.slice(16, 32);
      this.oled.gfx[lcd.id] = {backlight: true};
    }
    return 0;
  },
};

// same behaviour, other names
Object.assign(lcdApi, {'LCD.println': lcdApi['LCD.print']});
