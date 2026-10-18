import {Gfx} from './graphics.js';
import {I2C_DEVICES} from './i2c-devices.js';
import {READ_ONLY} from './simulator.js';
import {stringCall} from './strings.js';

// Simulator methods: call
export const apiMethods = {
  call(name, a) {
    if (!READ_ONLY.has(name)) this.dirty = true;
    if (name.startsWith('new.')) return this.newObject(name.slice(4), a);
    const dot = name.indexOf('.');
    if (dot > 0) {
      const cls = name.slice(0, dot);
      if (
        this.objects &&
        [
          'Servo',
          'LiquidCrystal_I2C',
          'Adafruit_SSD1306',
          'DHT',
          'Adafruit_NeoPixel',
          'SoftwareSerial',
          'WiFiUDP',
        ].includes(cls)
      )
        return this.objectCall(cls, name.slice(dot + 1), a);
      if (cls === 'String') return stringCall(name.slice(dot + 1), a);
      const port = /^Serial\d?$/.exec(cls)?.[0];
      if (port) return this.serialCall(port, name.slice(dot + 1), a);
      if (cls === 'WiFi' || cls === 'UDP') return this.netCall(name, a);
    }
    const prof = this.profile,
      pin = a[0];
    switch (name) {
      case 'pinMode': {
        const mode = a[1];
        if (![0, 1, 2, 3, 4].includes(mode)) throw Error('Invalid GPIO mode.');
        if (prof.inputOnly.includes(pin) && mode !== 0)
          throw Error(`GPIO ${pin} is input-only and has no internal pull resistors.`);
        if (prof.adc.analogOnly?.includes(pin))
          this.warn(`${this.pinName(pin)} is analog-only on ${prof.name}; pinMode() has no effect.`);
        if (prof.family === 'esp8266' && pin === 16 && mode === 2)
          this.warn(
            'GPIO 16 (D0) has no internal pull-up on the ESP8266; use INPUT_PULLDOWN_16 or an external resistor.'
          );
        const s = this.pin(pin);
        s.mode = mode;
        delete s.dac;
        if (mode !== 1) {
          delete s.duty;
          delete s.servo;
        }
        return 0;
      }
      case 'digitalWrite': {
        const s = this.pin(pin);
        if (s.mode !== 1) {
          if (prof.family === 'avr' && s.mode !== 1) {
            s.mode = a[1] ? 2 : 0;
            this.warn(
              `digitalWrite(${this.pinName(pin)}) on an INPUT pin toggles its internal pull-up on AVR. Call pinMode(${pin}, OUTPUT) first.`
            );
            return 0;
          }
          this.warn(`digitalWrite(${pin}): set pinMode(${pin}, OUTPUT) first.`);
          return 0;
        }
        s.value = a[1] ? 1 : 0;
        delete s.duty;
        delete s.servo;
        return 0;
      }
      case 'digitalRead':
        return this.read(pin);
      case 'analogRead':
        return this.adcRead(pin);
      case 'analogReadMilliVolts':
        return this.adcRead(pin, true);
      case 'analogReadResolution':
        if (pin < (prof.adc.minBits ?? 9) || pin > (prof.adc.maxBits ?? 12))
          throw Error(
            `ADC resolution must be ${prof.adc.minBits ?? 9}–${prof.adc.maxBits ?? 12} bits on ${prof.name}.`
          );
        this.adcBits = pin;
        return 0;
      case 'analogSetAttenuation':
        this.adcRange = [1.1, 1.5, 2.2, 3.3][pin] ?? 3.3;
        return 0;
      case 'analogReference':
        this.adcRef = pin === 3 ? 'INTERNAL' : pin === 0 ? 'EXTERNAL' : 'DEFAULT';
        return 0;
      case 'analogWriteResolution':
        this.pwmBits = Math.max(1, Math.min(16, pin));
        return 0;
      case 'analogWriteRange':
        this.pwmRange = pin;
        return 0;
      case 'analogWriteFreq':
        this.pwmFreq = pin;
        return 0;
      case 'dacWrite': {
        if (!prof.dac?.includes(pin))
          throw Error(`GPIO ${pin} has no DAC. ESP32 DAC outputs are GPIO 25 and 26.`);
        Object.assign(this.pin(pin), {mode: 5, dac: (Math.max(0, Math.min(255, a[1])) / 255) * prof.logic});
        return 0;
      }
      case 'millis':
        return Math.floor(this.time);
      case 'micros':
        return Math.floor(this.time * 1000);
      case 'yield':
        return 0;
      case 'analogWrite': {
        if (prof.inputOnly.includes(pin)) throw Error(`GPIO ${pin} is input-only.`);
        const s = this.pin(pin);
        const max = this.pwmRange ?? (1 << this.pwmBits) - 1,
          v = Math.max(0, Math.min(max, a[1]));
        const pwmOk = prof.pwm === 'all' ? !prof.noPwm?.includes(pin) : prof.pwm.includes(pin);
        if (prof.family === 'avr') {
          s.mode = 1;
          if (v === 0 || v === max || !pwmOk) {
            if (!pwmOk && v > 0 && v < max)
              this.warn(
                `${this.pinName(pin)} has no PWM on ${prof.name}: analogWrite(${v}) becomes ${v < 128 ? 'LOW' : 'HIGH'}. PWM pins: ${prof.pwm.join(', ')}.`
              );
            s.value = v >= 128 ? 1 : 0;
            delete s.duty;
            return 0;
          }
          if (this.servoTimer && [9, 10].includes(pin))
            this.warn('The Servo library uses Timer1 on AVR: analogWrite() on pins 9 and 10 stops working.');
        } else if (!pwmOk) throw Error(`${this.pinName(pin)} cannot output PWM on ${prof.name}.`);
        s.mode = 1;
        s.duty = v / max;
        s.value = s.duty > 0.5 ? 1 : 0;
        s.frequency = this.pwmFreq ?? (prof.pwmFast?.includes(pin) ? 980 : prof.pwmFreq);
        delete s.servo;
        return 0;
      }
      case 'ledcWrite': {
        if (prof.inputOnly.includes(pin)) throw Error(`GPIO ${pin} is input-only.`);
        const target = this.channels[pin] ?? pin;
        const state = this.pin(target);
        state.mode = 1;
        state.duty = Math.max(0, Math.min(1, a[1] / ((1 << (state.bits ?? 8)) - 1)));
        state.value = state.duty > 0.5 ? 1 : 0;
        state.frequency ??= 1000;
        return 1;
      }
      case 'ledcAttach':
        if (prof.inputOnly.includes(pin)) throw Error(`GPIO ${pin} is input-only.`);
        if (a[1] <= 0 || a[2] < 1 || a[2] > 16)
          throw Error('PWM requires positive frequency and 1–16 resolution bits.');
        Object.assign(this.pin(pin), {mode: 1, frequency: a[1], bits: a[2], duty: 0});
        return 1;
      case 'ledcSetup':
        this.pwmSetup[pin] = {frequency: a[1], bits: a[2]};
        return a[1];
      case 'ledcAttachPin':
        this.channels[a[1]] = pin;
        Object.assign(this.pin(pin), {mode: 1, ...this.pwmSetup[a[1]], duty: 0});
        return 0;
      case 'tone':
      case 'ledcWriteTone': {
        if (prof.inputOnly.includes(pin)) throw Error(`GPIO ${pin} is input-only.`);
        if (a[1] < 31 && name === 'tone' && prof.family === 'avr')
          throw Error('tone() frequency must be at least 31 Hz on AVR.');
        Object.assign(this.pin(pin), {mode: 1, duty: a[1] > 0 ? 0.5 : 0, frequency: a[1]});
        delete this.pin(pin).servo;
        if (a[2] > 0) this.toneEnds[pin] = this.time + a[2];
        return a[1];
      }
      case 'noTone': {
        const s = this.pin(pin);
        delete s.duty;
        s.value = 0;
        delete this.toneEnds[pin];
        return 0;
      }
      case 'pulseIn':
      case 'pulseInLong':
        return this.pulseWait(pin, a[1], a[2]);
      case 'shiftOut': {
        const [data, clock, order, value] = a;
        for (let i = 0; i < 8; i++) {
          const bit = order === 0 ? (value >> i) & 1 : (value >> (7 - i)) & 1;
          const d = this.pin(data),
            ck = this.pin(clock);
          if (d.mode !== 1 || ck.mode !== 1)
            this.warn('shiftOut(): set pinMode(dataPin, OUTPUT) and pinMode(clockPin, OUTPUT) first.');
          Object.assign(d, {mode: 1, value: bit});
          delete d.duty;
          Object.assign(ck, {mode: 1, value: 0});
          this.circuit.step(this, this.time);
          ck.value = 1;
          this.circuit.step(this, this.time);
          ck.value = 0;
          this.circuit.step(this, this.time);
        }
        return 0;
      }
      case 'shiftIn': {
        const [data, clock, order] = a;
        let v = 0;
        for (let i = 0; i < 8; i++) {
          Object.assign(this.pin(clock), {mode: 1, value: 1});
          this.circuit.step(this, this.time);
          const bit = this.read(data);
          if (order === 0) v |= bit << i;
          else v = (v << 1) | bit;
          this.pin(clock).value = 0;
          this.circuit.step(this, this.time);
        }
        return v;
      }
      case 'digitalPinToInterrupt':
        return prof.interrupts === 'all'
          ? prof.noInterrupt?.includes(pin)
            ? -1
            : pin
          : (prof.interrupts[pin] ?? -1);
      case 'attachInterrupt': {
        let p = pin;
        if (prof.interrupts !== 'all') {
          p = Object.entries(prof.interrupts).find(([, n]) => n === pin)?.[0];
          if (p === undefined)
            throw Error(
              `Interrupt ${pin} does not exist on ${prof.name}. Use attachInterrupt(digitalPinToInterrupt(${Object.keys(prof.interrupts).join(' or ')}), …).`
            );
          p = Number(p);
        }
        if (p < 0 || prof.noInterrupt?.includes(p))
          throw Error(`${this.pinName(p)} has no external interrupt on ${prof.name}.`);
        this.pin(p);
        if (!this.program.funcs[a[1]]) throw Error('Interrupt callback is not a compiled function.');
        this.interrupts[p] = {fn: a[1], mode: a[2], last: this.read(p)};
        return 0;
      }
      case 'detachInterrupt': {
        let p = pin;
        if (prof.interrupts !== 'all')
          p = Number(Object.entries(prof.interrupts).find(([, n]) => n === pin)?.[0]);
        delete this.interrupts[p];
        return 0;
      }
      case 'interrupts':
        this.irqEnabled = true;
        return 0;
      case 'noInterrupts':
        this.irqEnabled = false;
        return 0;
      case 'timerEvery':
        if (pin < 1 || !this.program.funcs[a[1]])
          throw Error('timerEvery requires milliseconds ≥ 1 and a callback function.');
        this.timers[++this.timerId] = {period: pin, next: this.time + pin, fn: a[1]};
        return this.timerId;
      case 'timerCancel':
        delete this.timers[pin];
        return 0;
      case 'Wire.begin': {
        if (prof.family === 'avr' && a.length) {
          this.warn(
            'Wire.begin(address) makes an AVR an I²C slave; slave mode is not modeled. Use Wire.begin().'
          );
          return 0;
        }
        if (a.length >= 2 && !['esp32', 'esp8266', 'rp2040'].includes(prof.family))
          this.warn(`${prof.name} uses fixed I²C pins; the pin arguments are ignored.`);
        this.i2c.sda =
          a.length >= 2 && ['esp32', 'esp8266', 'rp2040'].includes(prof.family) ? a[0] : prof.i2c[0];
        this.i2c.scl =
          a.length >= 2 && ['esp32', 'esp8266', 'rp2040'].includes(prof.family) ? a[1] : prof.i2c[1];
        if (prof.inputOnly.includes(this.i2c.sda) || prof.inputOnly.includes(this.i2c.scl))
          throw Error('I2C requires output-capable SDA and SCL pins.');
        this.i2c.begun = false;
        this.ensureWire();
        return 1;
      }
      case 'Wire.setClock':
        return 0;
      case 'Wire.beginTransmission':
        this.ensureWire();
        this.i2c.address = pin;
        this.i2c.buffer = [];
        return 0;
      case 'Wire.write':
        if (typeof pin === 'string') this.i2c.buffer.push(...Array.from(pin, c => c.charCodeAt(0)));
        else this.i2c.buffer.push(pin & 255);
        return typeof pin === 'string' ? pin.length : 1;
      case 'Wire.endTransmission': {
        const dev = this.transaction(this.i2c.address, this.i2c.buffer, 'write');
        if (!dev) return 2;
        I2C_DEVICES[dev.type].write?.(this.devState(dev), this.i2c.buffer, dev, this);
        return 0;
      }
      case 'Wire.requestFrom': {
        const n = Math.max(0, Math.min(32, a[1] ?? 1));
        const dev = this.transaction(pin, [], `read ${n} bytes`);
        this.i2c.read = [];
        if (!dev) return 0;
        const reader = I2C_DEVICES[dev.type].read;
        if (!reader) {
          this.warn(`${dev.name} does not support register reads in Circuit Lab.`);
          return 0;
        }
        this.i2c.read = reader(this.devState(dev), n, dev, this);
        return this.i2c.read.length;
      }
      case 'Wire.available':
        return this.i2c.read.length;
      case 'Wire.read':
        return this.i2c.read.length ? this.i2c.read.shift() : -1;
      case 'LCD.begin':
        this.ensureWire();
        this.lcd.address = pin ?? 39;
        return this.transaction(this.lcd.address, [0], 'LCD display on')?.type === 'lcd' ? 1 : 0;
      case 'LCD.clear':
        this.lcd.text = '';
        this.lcd.cursor = 0;
        return 0;
      case 'LCD.setCursor':
        this.lcd.cursor = Math.max(0, Math.min(31, Math.floor(a[1] ?? 0) * 16 + Math.floor(pin ?? 0)));
        return 0;
      case 'LCD.print':
      case 'LCD.println': {
        for (const ch of this.fmt(pin, a.at(-1), a.length > 2 ? a[1] : undefined)) {
          if (this.lcd.cursor >= 32) break;
          this.lcd.text = this.lcd.text.padEnd(32, ' ');
          this.lcd.text =
            this.lcd.text.slice(0, this.lcd.cursor) + ch + this.lcd.text.slice(this.lcd.cursor + 1);
          this.lcd.cursor++;
        }
        if (name === 'LCD.println')
          this.lcd.cursor = Math.min(32, (Math.floor((this.lcd.cursor - 1) / 16) + 1) * 16);
        return 0;
      }
      case 'LCD.display': {
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
      }
      case 'OLED.begin':
        this.ensureWire();
        this.oled.address = pin ?? 60;
        this.oled.g = new Gfx(128, 64);
        return this.transaction(this.oled.address, [0x00, 0xaf], 'display on') ? 1 : 0;
      case 'OLED.clear':
      case 'OLED.clearDisplay':
        (this.oled.g ??= new Gfx(128, 64)).call('clearDisplay', []);
        return 0;
      case 'OLED.setCursor':
        (this.oled.g ??= new Gfx(128, 64)).call('setCursor', a);
        return 0;
      case 'OLED.print':
      case 'OLED.println':
        (this.oled.g ??= new Gfx(128, 64)).call(name.slice(5), a, this);
        return 0;
      case 'OLED.display': {
        const g = (this.oled.g ??= new Gfx(128, 64));
        const dev = this.transaction(this.oled.address, [0x40, ...g.bytes()], 'text frame');
        if (dev?.type === 'oled') {
          this.oled.screens[dev.id] = g.text();
          this.oled.gfx[dev.id] = g.list();
        }
        return 0;
      }
      case 'SPI.begin':
        this.spi = {sck: a[0] ?? prof.spi.sck, miso: a[1] ?? prof.spi.miso, mosi: a[2] ?? prof.spi.mosi};
        return 0;
      case 'SPI.beginTransaction':
      case 'SPI.endTransaction':
      case 'SPI.end':
        return 0;
      case 'SPI.transfer': {
        if (!this.spi) throw Error('Call SPI.begin first.');
        this.warn(
          'SPI is a logical edge model. External SPI slave devices and cycle-accurate timing are unsupported.'
        );
        let received = 0;
        for (let bit = 7; bit >= 0; bit--) {
          Object.assign(this.pin(this.spi.mosi), {mode: 1, value: (pin >> bit) & 1});
          Object.assign(this.pin(this.spi.sck), {mode: 1, value: 0});
          this.circuit.step(this, this.time);
          this.pin(this.spi.sck).value = 1;
          this.circuit.step(this, this.time);
          received = (received << 1) | this.read(this.spi.miso);
        }
        this.pin(this.spi.sck).value = 0;
        this.circuit.step(this, this.time);
        return received;
      }
      case 'EEPROM.begin':
        return 1;
      case 'EEPROM.commit':
        return 1;
      case 'EEPROM.length':
        return prof.family === 'avr' ? (prof.key === 'mega' ? 4096 : 1024) : 4096;
      case 'EEPROM.read':
        return this.eeprom[pin] ?? 255;
      case 'EEPROM.write':
      case 'EEPROM.update':
        if (pin < 0 || pin >= 4096) throw Error('EEPROM address out of range');
        this.eeprom[pin] = a[1] & 255;
        return 0;
      case 'ESP.restart':
        this.log('ESP.restart(): rebooting', 'system');
        this.restartRequested = true;
        return 0;
      case 'min':
        return Math.min(...a);
      case 'max':
        return Math.max(...a);
      case 'abs':
        return Math.abs(pin);
      case 'sq':
        return pin * pin;
      case 'sqrt':
        return Math.sqrt(pin);
      case 'pow':
        return Math.pow(pin, a[1]);
      case 'sin':
        return Math.sin(pin);
      case 'cos':
        return Math.cos(pin);
      case 'tan':
        return Math.tan(pin);
      case 'atan':
        return Math.atan(pin);
      case 'atan2':
        return Math.atan2(pin, a[1]);
      case 'asin':
        return Math.asin(pin);
      case 'acos':
        return Math.acos(pin);
      case 'exp':
        return Math.exp(pin);
      case 'log':
        return Math.log(pin);
      case 'log10':
        return Math.log10(pin);
      case 'floor':
        return Math.floor(pin);
      case 'ceil':
        return Math.ceil(pin);
      case 'round':
        return Math.round(pin);
      case 'fabs':
        return Math.abs(pin);
      case 'map':
        if (a[1] === a[2]) throw Error('map input range is zero');
        return Math.trunc(((Math.trunc(pin) - a[1]) * (a[4] - a[3])) / (a[2] - a[1]) + a[3]);
      case 'constrain':
        return Math.max(a[1], Math.min(a[2], pin));
      case 'bitRead':
        return (pin >> a[1]) & 1;
      case 'bitSet':
        return pin | (1 << a[1]);
      case 'bitClear':
        return pin & ~(1 << a[1]);
      case 'bitWrite':
        return a[2] ? pin | (1 << a[1]) : pin & ~(1 << a[1]);
      case 'bit':
        return 1 << pin;
      case 'highByte':
        return (pin >> 8) & 255;
      case 'lowByte':
        return pin & 255;
      case 'isnan':
        return Number.isNaN(pin) ? 1 : 0;
      case 'isinf':
        return Math.abs(pin) === Infinity ? 1 : 0;
      case 'random':
        this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
        return a.length === 1
          ? Math.floor((this.seed / 4294967296) * pin)
          : Math.floor(pin + (this.seed / 4294967296) * (a[1] - pin));
      case 'randomSeed':
        this.seed = pin >>> 0 || 12345;
        return 0;
      case 'F':
        return pin;
      case 'String':
        return a.length >= 2 && typeof pin === 'number'
          ? Number.isInteger(pin) && [2, 8, 10, 16].includes(a[1])
            ? pin.toString(a[1]).toUpperCase()
            : pin.toFixed(a[1])
          : typeof pin === 'number' && !Number.isInteger(pin)
            ? pin.toFixed(2)
            : String(pin);
      default:
        throw Error(`Unsupported operation ${name}`);
    }
  },
};
