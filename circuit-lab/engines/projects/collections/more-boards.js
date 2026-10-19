// Nano, Mega, Pico, Blue Pill and ESP8266: what changes from board to board.
import {def} from '../registry.js';
import {C, base, add, on, at, w, code, done} from '../kit.js';

def(
  'nightlight',
  'Automatic night light',
  'Arduino Nano',
  'Beginner',
  ['LDR', 'Voltage divider', 'Breadboard'],
  'An LDR divider dims an LED as the room gets darker.',
  () => {
    const p = base('Automatic night light');
    add(p, 'bbhalf', 'bb', [0, 0, 0]);
    on(p, 'nano', 'nano', 'bb', 'H3', {}, Math.PI / 2);
    on(p, 'ldr', 'ldr', 'bb', 'G21', {lux: 30});
    on(p, 'resistor', 'rd', 'bb', 'I22', {resistance: 10000});
    on(p, 'led', 'led', 'bb', 'B24', {color: '#ffd27a'});
    on(p, 'resistor', 'rl', 'bb', 'D25', {resistance: 220});
    w(p, at(p, 'bb', 'nano', '5V', 'J'), 'bb:BP12', 'red');
    w(p, at(p, 'bb', 'nano', 'GND1', 'J'), 'bb:BN14', 'black');
    w(p, 'bb:BN25', 'bb:TN25', 'black');
    w(p, 'bb:J21', 'bb:BP19', 'red');
    w(p, 'bb:J26', 'bb:BN21', 'black');
    w(p, at(p, 'bb', 'nano', 'A0', 'J'), 'bb:F22', 'yellow');
    w(p, at(p, 'bb', 'nano', 'D9', 'A'), 'bb:A24', 'orange');
    w(p, 'bb:A29', 'bb:TN22', 'black');
    code(
      p,
      'nano',
      `// LDR from 5V to A0, 10 kΩ from A0 to GND.
void setup() {
  Serial.begin(9600);
}

void loop() {
  int light = analogRead(A0);
  int glow = constrain(map(light, 200, 800, 255, 0), 0, 255);
  analogWrite(9, glow);
  Serial.print("light=");
  Serial.print(light);
  Serial.print(" glow=");
  Serial.println(glow);
  delay(100);
}
`
    );
    return done(p, {position: [0, 140, 150], target: [0, 0, 0]});
  }
);
def(
  'thermometer',
  'NTC thermometer',
  'Arduino Nano',
  'Intermediate',
  ['Thermistor', 'Steinhart–Hart', 'float math'],
  'Convert an NTC divider voltage to °C with the Beta equation.',
  () => {
    const p = base('NTC thermometer');
    add(p, 'nano', 'nano', [-30, 0, 0]);
    add(p, 'thermistor', 'ntc', [25, 0, 20], {temperature: 31});
    add(p, 'resistor', 'r', [25, 0, -10], {resistance: 10000}, Math.PI / 2);
    w(p, 'nano:5V', 'ntc:A', 'red');
    w(p, 'ntc:B', 'r:A', 'yellow');
    w(p, 'r:B', 'nano:GND1', 'black');
    w(p, 'nano:A1', 'ntc:B', 'yellow');
    code(
      p,
      'nano',
      `const float BETA = 3950.0, R0 = 10000.0, T0 = 298.15, RFIXED = 10000.0;

void setup() {
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(A1);
  float v = raw * 5.0 / 1024.0;
  float rNtc = RFIXED * (5.0 - v) / v;
  float kelvin = 1.0 / (1.0 / T0 + log(rNtc / R0) / BETA);
  float celsius = kelvin - 273.15;
  Serial.print("Temperature: ");
  Serial.print(celsius, 1);
  Serial.println(" C");
  delay(500);
}
`
    );
    return done(p, {position: [0, 110, 120], target: [0, 0, 0]});
  }
);
def(
  'mega-chaser',
  'Mega pin chaser',
  'Arduino Mega',
  'Beginner',
  ['Mega', 'for loop'],
  'Light eight LEDs on the Mega’s double-row header, pins 22–36.',
  () => {
    const p = base('Mega pin chaser');
    add(p, 'mega', 'mega', [-20, 0, 0]);
    for (let i = 0; i < 8; i++) {
      add(p, 'led', 'l' + i, [55 + (i % 4) * 10, 0, -25 + Math.floor(i / 4) * 40], {
        color: i % 2 ? '#3aa0ff' : '#ff3b30',
      });
      add(
        p,
        'resistor',
        'r' + i,
        [55 + (i % 4) * 10, 0, -10 + Math.floor(i / 4) * 40],
        {resistance: 330},
        Math.PI / 2
      );
      w(p, 'mega:D' + (22 + i * 2), 'r' + i + ':A', 'orange');
      w(p, 'r' + i + ':B', 'l' + i + ':A', 'orange');
      w(p, 'l' + i + ':K', 'mega:GND' + (4 + (i % 2)), 'black');
    }
    code(
      p,
      'mega',
      `void setup() {
  for (int pin = 22; pin <= 36; pin += 2) pinMode(pin, OUTPUT);
}

void loop() {
  for (int pin = 22; pin <= 36; pin += 2) {
    digitalWrite(pin, HIGH);
    delay(120);
    digitalWrite(pin, LOW);
  }
}
`
    );
    return done(p, {position: [20, 180, 200], target: [20, 0, 0]});
  }
);
def(
  'pico-breathe',
  'Pico breathing LED',
  'Raspberry Pi Pico',
  'Beginner',
  ['RP2040', 'PWM', 'Breadboard'],
  'Blink the internal GP25 LED and breathe an external LED on GP15.',
  () => {
    const p = base('Pico breathing LED');
    add(p, 'bbhalf', 'bb', [0, 0, 0]);
    on(p, 'pico', 'pico', 'bb', 'H3', {}, Math.PI / 2);
    on(p, 'resistor', 'r', 'bb', 'I24', {resistance: 220});
    on(p, 'led', 'led', 'bb', 'G28', {color: '#3aa0ff'});
    w(p, at(p, 'bb', 'pico', 'GP15', 'J'), 'bb:J24', 'orange');
    w(p, 'bb:J29', 'bb:BN22', 'black');
    w(p, at(p, 'bb', 'pico', 'GND4', 'J'), 'bb:BN17', 'black');
    code(
      p,
      'pico',
      `void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  for (int v = 0; v < 255; v += 5) { analogWrite(15, v); delay(10); }
  digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
  for (int v = 255; v > 0; v -= 5) { analogWrite(15, v); delay(10); }
}
`
    );
    return done(p, {position: [0, 140, 150], target: [0, 0, 0]});
  }
);
def(
  'pico-rainbow',
  'NeoPixel rainbow',
  'Raspberry Pi Pico',
  'Intermediate',
  ['NeoPixel', 'ColorHSV', 'Libraries'],
  'An 8-LED WS2812B stick cycles through the color wheel.',
  () => {
    const p = base('NeoPixel rainbow');
    add(p, 'pico', 'pico', [-35, 0, 0]);
    add(p, 'neopixel', 'strip', [30, 0, 0]);
    w(p, 'pico:VBUS', 'strip:VCC', 'red');
    w(p, 'pico:GND1', 'strip:GND', 'black');
    w(p, 'pico:GP2', 'strip:DIN', 'green');
    code(
      p,
      'pico',
      `#include <Adafruit_NeoPixel.h>

Adafruit_NeoPixel strip(8, 2, NEO_GRB + NEO_KHZ800);
long hue = 0;

void setup() {
  strip.begin();
  strip.setBrightness(80);
}

void loop() {
  for (int i = 0; i < 8; i++) {
    strip.setPixelColor(i, strip.ColorHSV(hue + i * 8192, 255, 255));
  }
  strip.show();
  hue = (hue + 1024) % 65536;
  delay(30);
}
`
    );
    return done(p, {position: [0, 110, 120], target: [0, 0, 0]});
  }
);
def(
  'stm32-button',
  'Blue Pill interrupt',
  'STM32 Blue Pill',
  'Intermediate',
  ['STM32', 'attachInterrupt', 'volatile'],
  'A button on PA0 toggles the active-low PC13 LED using an interrupt.',
  () => {
    const p = base('Blue Pill interrupt');
    add(p, 'bluepill', 'bp', [-25, 0, 0]);
    add(p, 'button', 'btn', [30, 0, 20], {bounce: 0});
    w(p, 'bp:PA0', 'btn:1', 'yellow');
    w(p, 'btn:2', 'bp:GND1', 'black');
    code(
      p,
      'bp',
      `volatile bool lit = false;

void toggle() {
  lit = !lit;
}

void setup() {
  pinMode(PC13, OUTPUT);
  pinMode(PA0, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PA0), toggle, FALLING);
  Serial.begin(115200);
}

void loop() {
  digitalWrite(PC13, lit ? LOW : HIGH);   // PC13 LED is active low
  Serial.println(lit ? "on" : "off");
  delay(200);
}
`
    );
    return done(p, {position: [0, 110, 120], target: [0, 0, 0]});
  }
);
def(
  'esp8266-remote',
  'ESP8266 remote LED',
  'ESP32 + ESP8266',
  'Intermediate',
  ['Wi-Fi', 'UDP', 'Heterogeneous boards'],
  'An ESP32 button sends UDP commands; a NodeMCU switches its LED.',
  () => {
    const p = base('ESP8266 remote LED');
    add(p, 'board', 'ap', [-60, 0, 0]);
    add(p, 'esp8266', 'node', [45, 0, 0]);
    add(p, 'button', 'btn', [-60, 0, 55], {bounce: 0});
    add(p, 'led', 'led', [80, 0, 45], {color: '#34c759'});
    add(p, 'resistor', 'r', [80, 0, 25], {resistance: 220}, Math.PI / 2);
    w(p, 'ap:IO4', 'btn:1', 'yellow');
    w(p, 'btn:2', 'ap:GND1', 'black');
    w(p, 'node:D5', 'r:A', 'orange');
    w(p, 'r:B', 'led:A', 'orange');
    w(p, 'led:K', 'node:GND3', 'black');
    code(
      p,
      'ap',
      `#include <WiFi.h>
bool last = HIGH;

void setup() {
  pinMode(4, INPUT_PULLUP);
  Serial.begin(115200);
  WiFi.softAP("LabNet", "circuitlab");
  UDP.begin(4210);
}

void loop() {
  bool now = digitalRead(4);
  if (now != last) {
    UDP.beginPacket("192.168.4.255", 4210);
    UDP.print(now == LOW ? "ON" : "OFF");
    UDP.endPacket();
    Serial.println(now == LOW ? "sent ON" : "sent OFF");
    last = now;
  }
  delay(10);
}
`
    );
    code(
      p,
      'node',
      `#include <ESP8266WiFi.h>
#include <WiFiUdp.h>

WiFiUDP udp;

void setup() {
  pinMode(D5, OUTPUT);
  Serial.begin(115200);
  WiFi.begin("LabNet", "circuitlab");
  udp.begin(4210);
}

void loop() {
  if (udp.parsePacket()) {
    String cmd = udp.readString();
    digitalWrite(D5, cmd == "ON");
    Serial.println(cmd);
  }
  delay(5);
}
`
    );
    return done(p, {position: [0, 170, 190], target: [0, 0, 10]});
  }
);
