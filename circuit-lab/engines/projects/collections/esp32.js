// ESP32 first steps: GPIO, ADC, PWM, displays and a two-board Wi-Fi link.
import {def} from '../registry.js';
import {on, legacy} from '../kit.js';

def(
  'blink',
  'First light',
  'ESP32',
  'Beginner',
  ['LED', 'GPIO'],
  'Blink an LED through a 220 Ω resistor.',
  legacy('blink', 'First light')
);
def(
  'button',
  'A little push',
  'ESP32',
  'Beginner',
  ['Input', 'Pull-up'],
  'Read a push button with the internal pull-up.',
  legacy('button', 'A little push')
);
def(
  'analog',
  'Dial it in',
  'ESP32',
  'Beginner',
  ['ADC'],
  'Read a potentiometer on GPIO 36.',
  legacy('analog', 'Dial it in')
);
def(
  'pwm',
  'A softer glow',
  'ESP32',
  'Beginner',
  ['PWM'],
  'Fade an LED with the LEDC peripheral.',
  legacy('pwm', 'A softer glow')
);
def(
  'oled',
  'Hello, world',
  'ESP32',
  'Beginner',
  ['I²C', 'Display'],
  'Text on a 128 × 64 OLED.',
  legacy('oled', 'Hello, world')
);
def(
  'lcd',
  'LCD workbench',
  'ESP32',
  'Beginner',
  ['I²C', 'Display'],
  'Text on a 16 × 2 LCD.',
  legacy('lcd', 'LCD workbench')
);
def(
  'wifi',
  'Two boards · Wi-Fi',
  'ESP32 × 2',
  'Intermediate',
  ['Wi-Fi', 'UDP', 'Multi-board'],
  'An access point broadcasts UDP; a station drives its LED.',
  legacy('wifi')
);
