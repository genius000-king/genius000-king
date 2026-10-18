import {Gfx} from '../graphics.js';

/** SSD1306 128×64 OLED (fixed-address shortcut API). Called as handler.call(simulator, args, name). */
export const oledApi = {
  'OLED.begin'(a) {
    const address = a[0];
    this.ensureWire();
    this.oled.address = address ?? 60;
    this.oled.g = new Gfx(128, 64);
    return this.transaction(this.oled.address, [0x00, 0xaf], 'display on') ? 1 : 0;
  },
  'OLED.clear'(a) {
    (this.oled.g ??= new Gfx(128, 64)).call('clearDisplay', []);
    return 0;
  },
  'OLED.setCursor'(a) {
    (this.oled.g ??= new Gfx(128, 64)).call('setCursor', a);
    return 0;
  },
  'OLED.print'(a, name) {
    (this.oled.g ??= new Gfx(128, 64)).call(name.slice(5), a, this);
    return 0;
  },
  'OLED.display'(a) {
    const g = (this.oled.g ??= new Gfx(128, 64));
    const dev = this.transaction(this.oled.address, [0x40, ...g.bytes()], 'text frame');
    if (dev?.type === 'oled') {
      this.oled.screens[dev.id] = g.text();
      this.oled.gfx[dev.id] = g.list();
    }
    return 0;
  },
};

// same behaviour, other names
Object.assign(oledApi, {'OLED.clearDisplay': oledApi['OLED.clear'], 'OLED.println': oledApi['OLED.print']});
