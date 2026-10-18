// Families of the firmware API (see tools/switch-to-table.mjs).
const plain = {
  gpio: ['pinMode', 'digitalWrite', 'digitalRead', 'pulseIn', 'pulseInLong', 'shiftOut', 'shiftIn'],
  analog: [
    'analogRead',
    'analogReadMilliVolts',
    'analogReadResolution',
    'analogSetAttenuation',
    'analogReference',
    'dacWrite',
  ],
  pwm: [
    'analogWrite',
    'analogWriteResolution',
    'analogWriteRange',
    'analogWriteFreq',
    'ledcWrite',
    'ledcAttach',
    'ledcSetup',
    'ledcAttachPin',
    'tone',
    'ledcWriteTone',
    'noTone',
  ],
  timing: ['millis', 'micros', 'yield', 'timerEvery', 'timerCancel'],
  interrupts: ['digitalPinToInterrupt', 'attachInterrupt', 'detachInterrupt', 'interrupts', 'noInterrupts'],
  system: ['F', 'String'],
};
const dotted = {Wire: 'wire', LCD: 'lcd', OLED: 'oled', SPI: 'spi', EEPROM: 'storage', ESP: 'system'};
export default {
  host: 'engines/runtime/api.js',
  method: 'call',
  discriminant: 'name',
  dir: 'api',
  family(label) {
    const dot = label.indexOf('.');
    if (dot > 0) return dotted[label.slice(0, dot)];
    for (const [f, names] of Object.entries(plain)) if (names.includes(label)) return f;
    return 'math';
  },
  docs: {
    gpio: 'Digital pins: modes, reads and writes, pulse timing and bit-banged shift registers.',
    analog: 'ADC reads in the board’s resolution and attenuation, and the ESP32 DAC.',
    pwm: 'PWM (analogWrite, ESP32 LEDC) and square-wave tones.',
    timing: 'Time since boot and the simulator’s periodic timers.',
    interrupts: 'Pin-change interrupts and global interrupt masking.',
    system: 'Language helpers that the compiler exposes as calls.',
    wire: 'I²C master (Wire) talking to the simulated I²C devices.',
    lcd: 'HD44780 16×2 character LCD on the I²C backpack (fixed-address shortcut API).',
    oled: 'SSD1306 128×64 OLED (fixed-address shortcut API).',
    spi: 'SPI master: transfers to the shift registers and SPI devices on the bus.',
    storage: 'EEPROM emulation (AVR EEPROM and the ESP flash-backed EEPROM library).',
    math: 'Arduino math, bit and random helpers.',
  },
};
