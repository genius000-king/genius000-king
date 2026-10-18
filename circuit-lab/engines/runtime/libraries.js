import {ref} from '../catalog/types.js';
import {Gfx} from './graphics.js';
import {LIBRARY_METHODS} from './libraries/index.js';

// Simulator methods: objectFor, newObject, objectCall, lcdFrame, neoShow, dhtRead
export const librariesMethods = {
  objectFor(handle, cls) {
    const o = this.objects[handle];
    if (!o || o.cls !== cls) throw Error(`${cls} object is invalid`);
    return o;
  },
  newObject(cls, a) {
    const o = {cls};
    switch (cls) {
      case 'Servo':
        o.pin = null;
        break;
      case 'LiquidCrystal_I2C':
        Object.assign(o, {
          address: a[0] ?? 39,
          cols: a[1] ?? 16,
          rows: a[2] ?? 2,
          cursor: [0, 0],
          text: Array(4).fill(''),
          backlight: true,
        });
        break;
      case 'Adafruit_SSD1306':
        o.gfx = new Gfx(a[0] ?? 128, a[1] ?? 64);
        o.address = 60;
        break;
      case 'DHT':
        Object.assign(o, {pin: a[0], type: a[1] ?? 22, last: -1e9, t: NaN, h: NaN});
        break;
      case 'Adafruit_NeoPixel':
        Object.assign(o, {n: Math.max(1, Math.min(300, a[0] ?? 8)), pin: a[1] ?? 6, brightness: 0});
        o.pixels = Array.from({length: o.n}, () => [0, 0, 0]);
        break;
      case 'SoftwareSerial':
        o.port = 'SoftSerial' + this.objects.length;
        this.uarts[o.port] = {name: o.port, q: [], tx: a[1], rx: a[0], baud: 0, busyUntil: 0};
        o.rxPin = a[0];
        o.txPin = a[1];
        break;
      case 'WiFiUDP':
        break;
    }
    this.objects.push(o);
    return this.objects.length - 1;
  },
  objectCall(cls, method, a) {
    const o = this.objectFor(a[0], cls),
      args = a.slice(1);
    const handler = LIBRARY_METHODS[cls + '.' + method];
    if (handler) return handler.call(this, o, args, method, cls, a);
    if (cls === 'WiFiUDP') return this.netCall('UDP.' + method, args);
    if (cls === 'Adafruit_SSD1306') return o.gfx.call(method, args, this);
    throw Error(`Unsupported operation ${cls}.${method}`);
  },
  lcdFrame(o) {
    const dev = this.transaction(
      o.address,
      Array.from(o.text.join('').slice(0, 32), c => c.charCodeAt(0)),
      'LCD text frame'
    );
    if (dev?.type === 'lcd') {
      this.oled.screens[dev.id] = o.off
        ? ''
        : o.text
            .slice(0, 2)
            .map(l => (l || '').padEnd(16).slice(0, 16))
            .join('\n');
      this.oled.gfx[dev.id] = {backlight: o.backlight && !o.off};
    }
  },
  neoShow(o) {
    const board = this.board();
    if (!board) return 0;
    const strips = this.project.components.filter(c => c.type === 'neopixel');
    const scale = o.brightness ? o.brightness / 255 : 1;
    let net = this.node(o.pin),
      offset = 0,
      guard = 0;
    while (net && offset < o.n && guard++ < 20) {
      const strip = strips.find(s => this.circuit.same(ref(s, 'DIN'), net));
      if (!strip) break;
      const r = this.circuit.components[strip.id];
      const powered =
        (r?.voltage ?? 0) > 3 && this.circuit.same(ref(strip, 'GND'), ref(board, this.profile.gnd[0]));
      if (!powered) {
        this.warn(`${strip.name}: not powered or ground not shared with ${board.name}; the data is ignored.`);
        break;
      }
      if (r.voltage > 4.2 && this.profile.logic < 3.5)
        this.warn(
          `${strip.name}: 3.3 V data into a 5 V WS2812B is below its 0.7 × VDD input threshold; real strips may glitch. Use a level shifter.`
        );
      const count = strip.params.count;
      this.devState(strip).colors = o.pixels
        .slice(offset, offset + count)
        .map(p => p.map(c => Math.round(c * scale)));
      offset += count;
      net = ref(strip, 'DOUT');
    }
    return 0;
  },
  dhtRead(o, what) {
    const board = this.board(),
      node = this.node(o.pin);
    const sensor = this.project.components.find(
      c => c.type === 'dht22' && node && this.circuit.same(ref(c, 'DATA'), node)
    );
    const r = sensor && this.circuit.components[sensor.id];
    if (
      !sensor ||
      !r ||
      r.voltage < 3 ||
      !this.circuit.same(ref(sensor, 'GND'), ref(board, this.profile.gnd[0]))
    ) {
      this.warn(`DHT on ${this.pinName(o.pin)}: no response. Check VCC, GND and the DATA wire.`);
      return NaN;
    }
    if (o.type === 11) {
      this.warn(
        'DHT object is set to DHT11 but the wired sensor is a DHT22: values are decoded incorrectly.'
      );
    }
    if (this.time - o.last >= 2000) {
      o.last = this.time;
      this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
      const n = (this.seed / 4294967296 - 0.5) * 0.2;
      o.t = Math.round((sensor.params.temperature + n) * 10) / 10;
      o.h = Math.round((sensor.params.humidity + n * 2) * 10) / 10;
      if (o.type === 11) {
        o.t = Math.round(o.t);
        o.h = Math.round(o.h);
      }
    }
    return what === 'H' ? o.h : what === 'F' ? o.t * 1.8 + 32 : o.t;
  },
};
