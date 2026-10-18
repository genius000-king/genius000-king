import {I2C_DEVICES} from '../i2c-devices.js';

/** I²C master (Wire) talking to the simulated I²C devices. Called as handler.call(simulator, args, name). */
export const wireApi = {
  'Wire.begin'(a) {
    const prof = this.profile;

    if (prof.family === 'avr' && a.length) {
      this.warn(
        'Wire.begin(address) makes an AVR an I²C slave; slave mode is not modeled. Use Wire.begin().'
      );
      return 0;
    }
    if (a.length >= 2 && !['esp32', 'esp8266', 'rp2040'].includes(prof.family))
      this.warn(`${prof.name} uses fixed I²C pins; the pin arguments are ignored.`);
    this.i2c.sda = a.length >= 2 && ['esp32', 'esp8266', 'rp2040'].includes(prof.family) ? a[0] : prof.i2c[0];
    this.i2c.scl = a.length >= 2 && ['esp32', 'esp8266', 'rp2040'].includes(prof.family) ? a[1] : prof.i2c[1];
    if (prof.inputOnly.includes(this.i2c.sda) || prof.inputOnly.includes(this.i2c.scl))
      throw Error('I2C requires output-capable SDA and SCL pins.');
    this.i2c.begun = false;
    this.ensureWire();
    return 1;
  },
  'Wire.setClock'(a) {
    return 0;
  },
  'Wire.beginTransmission'(a) {
    const address = a[0];
    this.ensureWire();
    this.i2c.address = address;
    this.i2c.buffer = [];
    return 0;
  },
  'Wire.write'(a) {
    const value = a[0];
    if (typeof value === 'string') this.i2c.buffer.push(...Array.from(value, c => c.charCodeAt(0)));
    else this.i2c.buffer.push(value & 255);
    return typeof value === 'string' ? value.length : 1;
  },
  'Wire.endTransmission'(a) {
    const dev = this.transaction(this.i2c.address, this.i2c.buffer, 'write');
    if (!dev) return 2;
    I2C_DEVICES[dev.type].write?.(this.devState(dev), this.i2c.buffer, dev, this);
    return 0;
  },
  'Wire.requestFrom'(a) {
    const address = a[0];
    const n = Math.max(0, Math.min(32, a[1] ?? 1));
    const dev = this.transaction(address, [], `read ${n} bytes`);
    this.i2c.read = [];
    if (!dev) return 0;
    const reader = I2C_DEVICES[dev.type].read;
    if (!reader) {
      this.warn(`${dev.name} does not support register reads in Circuit Lab.`);
      return 0;
    }
    this.i2c.read = reader(this.devState(dev), n, dev, this);
    return this.i2c.read.length;
  },
  'Wire.available'(a) {
    return this.i2c.read.length;
  },
  'Wire.read'(a) {
    return this.i2c.read.length ? this.i2c.read.shift() : -1;
  },
};
