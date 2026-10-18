// Methods of the Arduino library classes (o = the object, args = arguments after it), one module per family. Every handler runs with `this` = the Simulator.
import {servoMethods} from './servo.js';
import {liquidCrystalI2cMethods} from './liquid-crystal-i2c.js';
import {ssd1306Methods} from './ssd1306.js';
import {dhtMethods} from './dht.js';
import {neopixelMethods} from './neopixel.js';
import {softwareSerialMethods} from './software-serial.js';

export const LIBRARY_METHODS = {
  ...servoMethods,
  ...liquidCrystalI2cMethods,
  ...ssd1306Methods,
  ...dhtMethods,
  ...neopixelMethods,
  ...softwareSerialMethods,
};
