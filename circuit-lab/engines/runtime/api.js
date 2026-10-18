import {API} from './api/index.js';
import {READ_ONLY} from './simulator.js';
import {stringCall} from './strings.js';

// Simulator methods: call. Library objects, String, Serial and Wi-Fi have their own dispatchers;
// everything else is looked up in the API tables of ./api/, one module per family.
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
    const handler = API[name];
    if (handler) return handler.call(this, a, name);
    throw Error(`Unsupported operation ${name}`);
  },
};
