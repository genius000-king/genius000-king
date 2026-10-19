// Buses and real loads: UART between boards, I²C registers, RTC, relays, motors.
import {def} from '../registry.js';
import {C, base, add, on, w, code, done} from '../kit.js';

def(
  'uart-link',
  'Wired UART link',
  'Arduino Uno + ESP32',
  'Advanced',
  ['UART', 'Level shifting', 'Multi-board'],
  'An ESP32 sends readings over Serial2 to an Uno; a divider protects the ESP32 RX pin.',
  () => {
    const p = base('Wired UART link');
    add(p, 'board', 'esp', [-55, 0, 0]);
    add(p, 'uno', 'uno', [45, 0, 0]);
    add(p, 'resistor', 'r1', [-5, 0, 45], {resistance: 2000}, Math.PI / 2);
    add(p, 'resistor', 'r2', [5, 0, 45], {resistance: 3300}, Math.PI / 2);
    w(p, 'esp:IO17', 'uno:D0', 'green');
    w(p, 'uno:D1', 'r1:A', 'blue');
    w(p, 'r1:B', 'esp:IO16', 'blue');
    w(p, 'r1:B', 'r2:A', 'blue');
    w(p, 'r2:B', 'esp:GND1', 'black');
    w(p, 'esp:GND2', 'uno:GND1', 'black');
    code(
      p,
      'esp',
      `int count = 0;

void setup() {
  Serial.begin(115200);
  Serial2.begin(9600);       // TX = GPIO17, RX = GPIO16
}

void loop() {
  Serial2.println(count);
  Serial.print("sent ");
  Serial.println(count);
  count++;
  if (Serial2.available()) {
    Serial.print("Uno says: ");
    Serial.println(Serial2.readStringUntil('\\n'));
  }
  delay(500);
}
`
    );
    code(
      p,
      'uno',
      `void setup() {
  Serial.begin(9600);        // pins 0 (RX) and 1 (TX)
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  if (Serial.available()) {
    int n = Serial.readStringUntil('\n').toInt();
    digitalWrite(LED_BUILTIN, n % 2);
    Serial.print("ack ");
    Serial.println(n);
  }
  delay(5);
}
`
    );
    return done(p, {position: [0, 160, 190], target: [0, 0, 10]});
  }
);
def(
  'imu',
  'Tilt sensor (MPU-6050)',
  'ESP32',
  'Advanced',
  ['I²C registers', 'Wire.requestFrom', 'int16_t'],
  'Wake an MPU-6050 and read raw accelerometer registers with Wire.',
  () => {
    const p = base('Tilt sensor');
    add(p, 'board', 'esp', [-30, 0, 0]);
    add(p, 'mpu6050', 'imu', [30, 0, 10], {ax: 0.2, ay: -0.35, az: 0.91});
    w(p, 'esp:3V3', 'imu:VCC', 'red');
    w(p, 'esp:GND1', 'imu:GND', 'black');
    w(p, 'esp:IO21', 'imu:SDA', 'blue');
    w(p, 'esp:IO22', 'imu:SCL', 'purple');
    code(
      p,
      'esp',
      `#include <Wire.h>
const int MPU = 0x68;

int16_t read16() {
  return (Wire.read() << 8) | Wire.read();
}

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  Wire.beginTransmission(MPU);
  Wire.write(0x6B);          // PWR_MGMT_1
  Wire.write(0);             // wake up
  Wire.endTransmission();
}

void loop() {
  Wire.beginTransmission(MPU);
  Wire.write(0x3B);          // ACCEL_XOUT_H
  Wire.endTransmission(false);
  Wire.requestFrom(MPU, 6);
  float ax = read16() / 16384.0;
  float ay = read16() / 16384.0;
  float az = read16() / 16384.0;
  float pitch = atan2(ax, sqrt(ay * ay + az * az)) * 180 / PI;
  float roll = atan2(ay, az) * 180 / PI;
  Serial.printf("pitch %.1f  roll %.1f\\n", pitch, roll);
  delay(200);
}
`
    );
    return done(p, {position: [0, 100, 110], target: [0, 0, 0]});
  }
);
def(
  'rtc-oled',
  'Desk clock',
  'ESP32',
  'Advanced',
  ['DS3231', 'BCD', 'SSD1306'],
  'Read a DS3231 real-time clock over I²C and draw the time on an OLED.',
  () => {
    const p = base('Desk clock');
    add(p, 'board', 'esp', [-35, 0, 0]);
    add(p, 'ds3231', 'rtc', [35, 0, 35]);
    add(p, 'oled', 'oled', [30, 0, -25]);
    for (const id of ['rtc', 'oled']) {
      w(p, 'esp:3V3', id + ':VCC', 'red');
      w(p, 'esp:GND1', id + ':GND', 'black');
      w(p, 'esp:IO21', id + ':SDA', 'blue');
      w(p, 'esp:IO22', id + ':SCL', 'purple');
    }
    code(
      p,
      'esp',
      `#include <Wire.h>
#include <Adafruit_SSD1306.h>

Adafruit_SSD1306 display(128, 64, &Wire, -1);

int bcd(byte b) { return (b >> 4) * 10 + (b & 15); }

void setup() {
  Wire.begin(21, 22);
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
}

void loop() {
  Wire.beginTransmission(0x68);
  Wire.write(0);
  Wire.endTransmission();
  Wire.requestFrom(0x68, 3);
  int s = bcd(Wire.read()), m = bcd(Wire.read()), h = bcd(Wire.read() & 0x3F);
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("DS3231 clock");
  display.setTextSize(2);
  display.setCursor(16, 28);
  if (h < 10) display.print("0");
  display.print(h);
  display.print(":");
  if (m < 10) display.print("0");
  display.print(m);
  display.print(":");
  if (s < 10) display.print("0");
  display.print(s);
  display.drawRect(0, 22, 128, 30, SSD1306_WHITE);
  display.display();
  delay(250);
}
`
    );
    return done(p, {position: [0, 110, 120], target: [0, 0, 0]});
  }
);
def(
  'pir-alarm',
  'Motion alarm',
  'ESP32',
  'Beginner',
  ['PIR', 'Buzzer', 'Logic'],
  'A PIR sensor triggers a buzzer and LED for a few seconds.',
  () => {
    const p = base('Motion alarm');
    add(p, 'board', 'esp', [-35, 0, 0]);
    add(p, 'pir', 'pir', [40, 0, 40], {motion: true});
    add(p, 'buzzer', 'bz', [45, 0, -10], {active: true});
    add(p, 'led', 'led', [20, 0, -35], {color: '#ff3b30'});
    add(p, 'resistor', 'r', [5, 0, -35], {resistance: 220});
    w(p, 'esp:5V', 'pir:VCC', 'red');
    w(p, 'esp:GND1', 'pir:GND', 'black');
    w(p, 'esp:IO27', 'pir:OUT', 'yellow');
    w(p, 'esp:IO26', 'bz:+', 'orange');
    w(p, 'bz:-', 'esp:GND2', 'black');
    w(p, 'esp:IO25', 'r:A', 'red');
    w(p, 'r:B', 'led:A', 'red');
    w(p, 'led:K', 'esp:GND3', 'black');
    code(
      p,
      'esp',
      `const int PIR = 27, BUZZER = 26, LED = 25;
unsigned long until = 0;
bool wasAlarm = false;

void setup() {
  pinMode(PIR, INPUT);
  pinMode(BUZZER, OUTPUT);
  pinMode(LED, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  if (digitalRead(PIR) == HIGH) until = millis() + 3000;
  bool alarm = millis() < until;
  if (alarm && !wasAlarm) Serial.println("Motion detected!");
  wasAlarm = alarm;
  digitalWrite(LED, alarm);
  digitalWrite(BUZZER, alarm && (millis() / 250) % 2);
  delay(10);
}
`
    );
    return done(p, {position: [0, 120, 140], target: [0, 0, 0]});
  }
);
def(
  'plant',
  'Plant watering',
  'ESP32',
  'Advanced',
  ['Soil sensor', 'Relay', 'Transistor', 'Flyback diode'],
  'A capacitive soil sensor switches a pump motor through a transistor-driven relay.',
  () => {
    const p = base('Plant watering');
    add(p, 'board', 'esp', [-55, 0, 0]);
    add(p, 'soil', 'soil', [-5, 0, -40], {moisture: 25}, Math.PI / 2);
    add(p, 'relay', 'k', [25, 0, 30]);
    add(p, 'npn', 'q', [-5, 0, 40]);
    add(p, 'resistor', 'rb', [-20, 0, 40], {resistance: 1000});
    add(p, 'diode', 'd', [25, 0, 55], {model: '1N4007'});
    add(p, 'aapack', 'batt', [75, 0, -10], {cells: 4});
    add(p, 'motor', 'pump', [80, 0, 55]);
    w(p, 'esp:3V3', 'soil:VCC', 'red');
    w(p, 'esp:GND1', 'soil:GND', 'black');
    w(p, 'esp:IO34', 'soil:AOUT', 'yellow');
    w(p, 'esp:IO4', 'rb:A', 'orange');
    w(p, 'rb:B', 'q:B', 'orange');
    w(p, 'q:E', 'esp:GND2', 'black');
    w(p, 'esp:5V', 'k:C1', 'red');
    w(p, 'k:C2', 'q:C', 'gray');
    w(p, 'd:K', 'k:C1', 'red');
    w(p, 'd:A', 'k:C2', 'gray');
    w(p, 'batt:+', 'k:COM', 'red');
    w(p, 'k:NO', 'pump:+', 'orange');
    w(p, 'pump:-', 'batt:-', 'black');
    code(
      p,
      'esp',
      `const int SOIL = 34, RELAY = 4;
// Capacitive sensor: ~2.8 V dry, ~1.2 V wet.

void setup() {
  pinMode(RELAY, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  int mv = analogReadMilliVolts(SOIL);
  bool dry = mv > 2100;
  digitalWrite(RELAY, dry);
  Serial.print(mv);
  Serial.println(dry ? " mV  pump ON" : " mV  pump off");
  delay(500);
}
`
    );
    return done(p, {position: [10, 170, 190], target: [10, 0, 10]});
  }
);
def(
  'motor-pwm',
  'Motor speed control',
  'ESP32',
  'Intermediate',
  ['MOSFET', 'PWM', 'Flyback diode'],
  'A knob sets the PWM duty on a logic-level MOSFET driving a DC motor.',
  () => {
    const p = base('Motor speed control');
    add(p, 'board', 'esp', [-50, 0, 0]);
    add(p, 'pot', 'pot', [-50, 0, 55], {value: 0.7});
    add(p, 'mosfet', 'q', [15, 0, 25], {model: 'IRLZ44N'});
    add(p, 'resistor', 'rg', [0, 0, 25], {resistance: 220});
    add(p, 'diode', 'd', [35, 0, -15], {model: '1N5819'});
    add(p, 'motor', 'm', [55, 0, 30]);
    add(p, 'psu', 'ps', [60, 0, -55], {voltage: 6, limit: 1.5});
    w(p, 'esp:3V3', 'pot:VCC', 'red');
    w(p, 'esp:GND1', 'pot:GND', 'black');
    w(p, 'esp:IO34', 'pot:W', 'yellow');
    w(p, 'esp:IO25', 'rg:A', 'orange');
    w(p, 'rg:B', 'q:G', 'orange');
    w(p, 'q:S', 'esp:GND2', 'black');
    w(p, 'ps:-', 'esp:GND3', 'black');
    w(p, 'ps:+', 'm:+', 'red');
    w(p, 'm:-', 'q:D', 'gray');
    w(p, 'd:K', 'ps:+', 'red');
    w(p, 'd:A', 'q:D', 'gray');
    code(
      p,
      'esp',
      `void setup() {
  ledcAttach(25, 2000, 8);
  Serial.begin(115200);
}

void loop() {
  int duty = analogRead(34) / 16;      // 12-bit ADC → 8-bit duty
  ledcWrite(25, duty);
  Serial.println(duty);
  delay(50);
}
`
    );
    return done(p, {position: [10, 170, 190], target: [10, 0, 0]});
  }
);
