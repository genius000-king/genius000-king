// The Arduino-style API, one module per family. Every handler runs with `this` = the Simulator.
import {gpioApi} from './gpio.js';
import {analogApi} from './analog.js';
import {pwmApi} from './pwm.js';
import {timingApi} from './timing.js';
import {interruptsApi} from './interrupts.js';
import {wireApi} from './wire.js';
import {lcdApi} from './lcd.js';
import {oledApi} from './oled.js';
import {spiApi} from './spi.js';
import {storageApi} from './storage.js';
import {systemApi} from './system.js';
import {mathApi} from './math.js';

export const API = {
  ...gpioApi,
  ...analogApi,
  ...pwmApi,
  ...timingApi,
  ...interruptsApi,
  ...wireApi,
  ...lcdApi,
  ...oledApi,
  ...spiApi,
  ...storageApi,
  ...systemApi,
  ...mathApi,
};
