// One module per Arduino library class (see tools/switch-to-table.mjs).
const files = {
  Servo: 'servo',
  LiquidCrystal_I2C: 'liquid-crystal-i2c',
  Adafruit_SSD1306: 'ssd1306',
  DHT: 'dht',
  Adafruit_NeoPixel: 'neopixel',
  SoftwareSerial: 'software-serial',
  WiFiUDP: 'wifi-udp',
};
export default {
  host: 'engines/runtime/libraries.js',
  method: 'objectCall',
  key: "cls + '.' + method",
  params: ['o', 'args', 'method', 'cls', 'a'],
  passLocals: ['o', 'args'],
  table: 'LIBRARY_METHODS',
  suffix: 'Methods',
  title: 'Methods of the Arduino library classes (o = the object, args = arguments after it)',
  dir: 'libraries',
  family: label => files[label.slice(0, label.indexOf('.'))],
  docs: {
    servo: 'Servo: 50 Hz pulses of 544–2400 µs on one pin; AVR boards lose PWM on pins 9 and 10.',
    'liquid-crystal-i2c': 'LiquidCrystal_I2C: HD44780 16×2 through a PCF8574 backpack.',
    ssd1306: 'Adafruit_SSD1306: 128×64 OLED; drawing calls fall through to the shared Gfx canvas.',
    dht: 'DHT11/DHT22: temperature and humidity with the sensor’s minimum read interval.',
    neopixel: 'Adafruit_NeoPixel: WS2812B strips, brightness scaling and colour helpers.',
    'software-serial': 'SoftwareSerial: a bit-banged UART on any two pins.',
    'wifi-udp': 'WiFiUDP: packets on the virtual network (the rest goes to the network model).',
  },
};
