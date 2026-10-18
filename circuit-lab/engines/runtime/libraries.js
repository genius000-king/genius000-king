import {ref} from '../catalog/types.js';
import {Gfx} from './graphics.js';

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
    switch (cls + '.' + method) {
      case 'Servo.attach': {
        const pin = args[0];
        this.pin(pin);
        if (
          this.profile.family === 'avr' &&
          this.objects.filter(x => x.cls === 'Servo' && x.pin !== null).length === 0
        )
          this.servoTimer = true;
        o.pin = pin;
        o.min = args[1] ?? 544;
        o.max = args[2] ?? 2400;
        o.us = 1500;
        Object.assign(this.pin(pin), {mode: 1, servo: 1500, frequency: 50, duty: 1500 / 20000, value: 0});
        return 1;
      }
      case 'Servo.write':
      case 'Servo.writeMicroseconds': {
        if (o.pin === null) {
          this.warn('Servo.write() before attach(): no pulse is generated.');
          return 0;
        }
        let us =
          method === 'write' && args[0] < 200
            ? o.min + ((o.max - o.min) * Math.max(0, Math.min(180, args[0]))) / 180
            : args[0];
        us = Math.max(o.min, Math.min(o.max, us));
        o.us = us;
        Object.assign(this.pin(o.pin), {servo: us, duty: us / 20000, frequency: 50, mode: 1});
        return 0;
      }
      case 'Servo.read':
        return o.pin === null ? 0 : Math.round(((o.us - o.min) / (o.max - o.min)) * 180);
      case 'Servo.readMicroseconds':
        return o.us ?? 0;
      case 'Servo.attached':
        return o.pin !== null ? 1 : 0;
      case 'Servo.detach':
        if (o.pin !== null) {
          const s = this.pin(o.pin);
          delete s.servo;
          delete s.duty;
          s.value = 0;
        }
        o.pin = null;
        return 0;
      case 'LiquidCrystal_I2C.init':
      case 'LiquidCrystal_I2C.begin':
        this.ensureWire();
        o.text = Array(4).fill(' '.repeat(o.cols));
        o.cursor = [0, 0];
        this.lcdFrame(o);
        return 0;
      case 'LiquidCrystal_I2C.backlight':
        o.backlight = true;
        this.lcdFrame(o);
        return 0;
      case 'LiquidCrystal_I2C.noBacklight':
        o.backlight = false;
        this.lcdFrame(o);
        return 0;
      case 'LiquidCrystal_I2C.clear':
        o.text = Array(4).fill(' '.repeat(o.cols));
        o.cursor = [0, 0];
        this.lcdFrame(o);
        return 0;
      case 'LiquidCrystal_I2C.home':
        o.cursor = [0, 0];
        return 0;
      case 'LiquidCrystal_I2C.setCursor':
        o.cursor = [
          Math.max(0, Math.min(o.cols - 1, args[0] | 0)),
          Math.max(0, Math.min(o.rows - 1, args[1] | 0)),
        ];
        return 0;
      case 'LiquidCrystal_I2C.print':
      case 'LiquidCrystal_I2C.println': {
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
      }
      case 'LiquidCrystal_I2C.display':
      case 'LiquidCrystal_I2C.noDisplay':
        o.off = method === 'noDisplay';
        this.lcdFrame(o);
        return 0;
      case 'Adafruit_SSD1306.begin':
        this.ensureWire();
        o.address = args[1] ?? 60;
        this.transaction(o.address, [0xae, 0xd5, 0x80, 0xaf], 'SSD1306 init');
        return 1;
      case 'Adafruit_SSD1306.display': {
        const dev = this.transaction(o.address, [0x40, ...o.gfx.bytes()], 'SSD1306 frame');
        if (dev?.type === 'oled') {
          this.oled.screens[dev.id] = o.gfx.text();
          this.oled.gfx[dev.id] = o.gfx.list();
        }
        return 0;
      }
      case 'Adafruit_SSD1306.width':
        return o.gfx.w;
      case 'Adafruit_SSD1306.height':
        return o.gfx.h;
      case 'DHT.begin':
        this.pin(o.pin);
        return 0;
      case 'DHT.readTemperature':
      case 'DHT.readHumidity':
        return this.dhtRead(o, method === 'readTemperature' ? (args[0] ? 'F' : 'C') : 'H');
      case 'DHT.computeHeatIndex': {
        const T = args[0],
          H = args[1],
          F = args[2] === 0 ? T * 1.8 + 32 : T;
        let hi = 0.5 * (F + 61 + (F - 68) * 1.2 + H * 0.094);
        if (hi > 79)
          hi =
            -42.379 +
            2.04901523 * F +
            10.14333127 * H -
            0.22475541 * F * H -
            0.00683783 * F * F -
            0.05481717 * H * H +
            0.00122874 * F * F * H +
            0.00085282 * F * H * H -
            0.00000199 * F * F * H * H;
        return args[2] === 0 ? (hi - 32) / 1.8 : hi;
      }
      case 'Adafruit_NeoPixel.begin':
        Object.assign(this.pin(o.pin), {mode: 1, value: 0});
        return 0;
      case 'Adafruit_NeoPixel.numPixels':
        return o.n;
      case 'Adafruit_NeoPixel.setBrightness':
        o.brightness = args[0] & 255;
        return 0;
      case 'Adafruit_NeoPixel.getBrightness':
        return o.brightness;
      case 'Adafruit_NeoPixel.clear':
        o.pixels.forEach(p => p.fill(0));
        return 0;
      case 'Adafruit_NeoPixel.Color':
        return (((args[0] & 255) << 16) | ((args[1] & 255) << 8) | (args[2] & 255)) >>> 0;
      case 'Adafruit_NeoPixel.ColorHSV': {
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
      }
      case 'Adafruit_NeoPixel.gamma32': {
        const c = args[0] >>> 0,
          gm = x => Math.round(Math.pow(x / 255, 2.6) * 255);
        return ((gm((c >> 16) & 255) << 16) | (gm((c >> 8) & 255) << 8) | gm(c & 255)) >>> 0;
      }
      case 'Adafruit_NeoPixel.setPixelColor': {
        const i = args[0];
        if (i < 0 || i >= o.n) return 0;
        o.pixels[i] =
          args.length >= 4
            ? [args[1] & 255, args[2] & 255, args[3] & 255]
            : [(args[1] >>> 16) & 255, (args[1] >>> 8) & 255, args[1] & 255];
        return 0;
      }
      case 'Adafruit_NeoPixel.fill': {
        const c = args[0] >>> 0,
          first = args[1] ?? 0,
          count = args[2] || o.n - first;
        for (let i = first; i < Math.min(o.n, first + count); i++)
          o.pixels[i] = [(c >>> 16) & 255, (c >>> 8) & 255, c & 255];
        return 0;
      }
      case 'Adafruit_NeoPixel.show':
        return this.neoShow(o);
      case 'SoftwareSerial.begin':
        this.uarts[o.port].baud = args[0];
        Object.assign(this.pin(o.txPin), {mode: 1, value: 1});
        this.pin(o.rxPin).mode = 2;
        return 0;
      case 'SoftwareSerial.listen':
      case 'SoftwareSerial.end':
        return 0;
      case 'SoftwareSerial.print':
      case 'SoftwareSerial.println':
      case 'SoftwareSerial.write': {
        const tag = args.at(-1);
        const s =
          method === 'write'
            ? typeof args[0] === 'string'
              ? args[0]
              : String.fromCharCode(args[0] & 255)
            : this.fmt(args[0] ?? '', tag, args.length > 2 ? args[1] : undefined) +
              (method === 'println' ? '\r\n' : '');
        return this.serialWrite(o.port, s);
      }
      case 'SoftwareSerial.available':
      case 'SoftwareSerial.read':
      case 'SoftwareSerial.peek':
      case 'SoftwareSerial.readString':
        return this.serialRead(o.port, method, args);
      default:
        if (cls === 'WiFiUDP') return this.netCall('UDP.' + method, args);
        if (cls === 'Adafruit_SSD1306') return o.gfx.call(method, args, this);
        throw Error(`Unsupported operation ${cls}.${method}`);
    }
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
