// Arduino Uno classics on the breadboard: timing, arrays, servos, sensors, displays, keypads.
import {def} from '../registry.js';
import {C, base, add, on, get, at, w, code, done} from '../kit.js';

def(
  'uno-blink',
  'Hello, Arduino',
  'Arduino Uno',
  'Beginner',
  ['LED_BUILTIN'],
  'The classic: blink the onboard “L” LED on pin 13.',
  () => {
    const p = base('Hello, Arduino');
    add(p, 'uno', 'uno', [0, 0, 0]);
    code(
      p,
      'uno',
      `// The onboard L LED is wired to pin 13.
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  Serial.println("L on");
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  Serial.println("L off");
  delay(1000);
}
`
    );
    return done(p, {position: [40, 90, 90], target: [0, 0, 0]});
  }
);
def(
  'traffic',
  'Traffic light',
  'Arduino Uno',
  'Beginner',
  ['Breadboard', 'Functions'],
  'Three LEDs on a breadboard cycle through a traffic-light sequence.',
  () => {
    const p = base('Traffic light');
    add(p, 'uno', 'uno', [-62, 0, 0]);
    add(p, 'bbhalf', 'bb', [30, 0, 0]);
    [
      ['red', '#ff3b30', 12, 'red'],
      ['amber', '#ffb020', 11, 'orange'],
      ['green', '#34c759', 10, 'green'],
    ].forEach(([n, col, pin, wc], i) => {
      const c = 5 + i * 8;
      on(p, 'led', 'led_' + n, 'bb', 'E' + c, {color: col});
      on(p, 'resistor', 'r_' + n, 'bb', 'C' + (c + 1), {resistance: 220});
      w(p, 'uno:D' + pin, 'bb:A' + c, wc);
      w(p, 'bb:A' + (c + 5), 'bb:TN' + (4 + i * 6), 'black');
    });
    w(p, 'uno:GND2', 'bb:TN1', 'black');
    code(
      p,
      'uno',
      `const int RED = 12, AMBER = 11, GREEN = 10;

void show(int r, int a, int g, int ms) {
  digitalWrite(RED, r);
  digitalWrite(AMBER, a);
  digitalWrite(GREEN, g);
  delay(ms);
}

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(AMBER, OUTPUT);
  pinMode(GREEN, OUTPUT);
}

void loop() {
  show(HIGH, LOW, LOW, 3000);   // stop
  show(HIGH, HIGH, LOW, 800);   // get ready
  show(LOW, LOW, HIGH, 3000);   // go
  show(LOW, HIGH, LOW, 1000);   // caution
}
`
    );
    return done(p, {position: [0, 150, 170], target: [0, 0, 0]});
  }
);
def(
  'chaser',
  'Knight Rider scanner',
  'Arduino Uno',
  'Beginner',
  ['Arrays', 'sizeof', 'Breadboard'],
  'Six LEDs sweep back and forth using an array of pins.',
  () => {
    const p = base('Knight Rider scanner');
    add(p, 'uno', 'uno', [-105, 0, 0]);
    add(p, 'bbfull', 'bb', [20, 0, 0]);
    const pins = [2, 3, 4, 5, 6, 7];
    pins.forEach((pin, i) => {
      const c = 4 + i * 7;
      on(p, 'resistor', 'r' + i, 'bb', 'J' + c, {resistance: 330});
      on(p, 'led', 'led' + i, 'bb', 'H' + (c + 4), {color: '#ff3b30'});
      w(p, 'uno:D' + pin, 'bb:F' + c, 'orange');
      w(p, 'bb:F' + (c + 5), 'bb:BN' + (2 + i * 4), 'black');
    });
    w(p, 'uno:GND2', 'bb:BN1', 'black');
    code(
      p,
      'uno',
      `const byte leds[] = {2, 3, 4, 5, 6, 7};
const int COUNT = sizeof(leds) / sizeof(leds[0]);

void setup() {
  for (int i = 0; i < COUNT; i++) pinMode(leds[i], OUTPUT);
}

void light(int i) {
  digitalWrite(leds[i], HIGH);
  delay(80);
  digitalWrite(leds[i], LOW);
}

void loop() {
  for (int i = 0; i < COUNT; i++) light(i);
  for (int i = COUNT - 2; i > 0; i--) light(i);
}
`
    );
    return done(p, {position: [-20, 190, 210], target: [-20, 0, 0]});
  }
);
def(
  'servo-pot',
  'Servo follows a knob',
  'Arduino Uno',
  'Beginner',
  ['Servo', 'ADC', 'map()'],
  'A potentiometer sets the angle of an SG90 servo.',
  () => {
    const p = base('Servo follows a knob');
    add(p, 'uno', 'uno', [-30, 0, 0]);
    add(p, 'pot', 'pot', [45, 0, 30], {value: 0.25});
    add(p, 'servo', 'servo', [45, 0, -20]);
    w(p, 'uno:5V', 'pot:VCC', 'red');
    w(p, 'uno:GND1', 'pot:GND', 'black');
    w(p, 'uno:A0', 'pot:W', 'yellow');
    w(p, 'uno:5V', 'servo:VCC', 'red');
    w(p, 'uno:GND3', 'servo:GND', 'black');
    w(p, 'uno:D9', 'servo:SIG', 'orange');
    code(
      p,
      'uno',
      `#include <Servo.h>

Servo arm;

void setup() {
  arm.attach(9);
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(A0);            // 0..1023
  int angle = map(raw, 0, 1023, 0, 180);
  arm.write(angle);
  Serial.print("angle ");
  Serial.println(angle);
  delay(20);
}
`
    );
    return done(p, {position: [20, 110, 150], target: [10, 0, 5]});
  }
);
def(
  'sonar-lcd',
  'Ultrasonic ruler',
  'Arduino Uno',
  'Intermediate',
  ['HC-SR04', 'pulseIn', 'LCD I²C'],
  'Measure distance with an HC-SR04 and show it on a 16 × 2 LCD.',
  () => {
    const p = base('Ultrasonic ruler');
    add(p, 'uno', 'uno', [-40, 0, 10]);
    add(p, 'hcsr04', 'sonar', [45, 0, 40], {distance: 42});
    add(p, 'lcd', 'lcd', [30, 0, -45]);
    w(p, 'uno:5V', 'sonar:VCC', 'red');
    w(p, 'uno:GND1', 'sonar:GND', 'black');
    w(p, 'uno:D9', 'sonar:TRIG', 'yellow');
    w(p, 'uno:D10', 'sonar:ECHO', 'green');
    w(p, 'uno:5V', 'lcd:VCC', 'red');
    w(p, 'uno:GND3', 'lcd:GND', 'black');
    w(p, 'uno:SDA', 'lcd:SDA', 'blue');
    w(p, 'uno:SCL', 'lcd:SCL', 'purple');
    code(
      p,
      'uno',
      `#include <Wire.h>
#include <LiquidCrystal_I2C.h>

const int TRIG = 9, ECHO = 10;
LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  lcd.init();
  lcd.backlight();
  lcd.print("Ultrasonic ruler");
}

void loop() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long echo = pulseIn(ECHO, HIGH, 30000);
  float cm = echo / 58.0;
  lcd.setCursor(0, 1);
  lcd.print(cm, 1);
  lcd.print(" cm      ");
  delay(200);
}
`
    );
    return done(p, {position: [10, 140, 160], target: [10, 0, 0]});
  }
);
def(
  'weather',
  'Weather station',
  'Arduino Uno',
  'Intermediate',
  ['DHT22', 'LCD I²C', 'float'],
  'Temperature and humidity from a DHT22 on a 16 × 2 LCD.',
  () => {
    const p = base('Weather station');
    add(p, 'uno', 'uno', [-40, 0, 10]);
    add(p, 'dht22', 'dht', [40, 0, 40], {temperature: 22.5, humidity: 48});
    add(p, 'lcd', 'lcd', [30, 0, -45]);
    w(p, 'uno:5V', 'dht:VCC', 'red');
    w(p, 'uno:GND1', 'dht:GND', 'black');
    w(p, 'uno:D2', 'dht:DATA', 'yellow');
    w(p, 'uno:5V', 'lcd:VCC', 'red');
    w(p, 'uno:GND3', 'lcd:GND', 'black');
    w(p, 'uno:A4', 'lcd:SDA', 'blue');
    w(p, 'uno:A5', 'lcd:SCL', 'purple');
    code(
      p,
      'uno',
      `#include <DHT.h>
#include <LiquidCrystal_I2C.h>

DHT dht(2, DHT22);
LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  dht.begin();
  lcd.init();
  lcd.backlight();
}

void loop() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  lcd.setCursor(0, 0);
  if (isnan(t)) {
    lcd.print("Sensor error    ");
  } else {
    lcd.print("Temp ");
    lcd.print(t, 1);
    lcd.print(" C   ");
    lcd.setCursor(0, 1);
    lcd.print("Hum  ");
    lcd.print(h, 1);
    lcd.print(" %   ");
  }
  delay(2000);
}
`
    );
    return done(p, {position: [10, 140, 160], target: [10, 0, 0]});
  }
);
def(
  'melody',
  'Play a melody',
  'Arduino Uno',
  'Beginner',
  ['tone()', 'Arrays', 'Passive buzzer'],
  'Arrays of notes and durations played with tone().',
  () => {
    const p = base('Play a melody');
    add(p, 'uno', 'uno', [-30, 0, 0]);
    add(p, 'buzzer', 'bz', [40, 0, 20], {active: false});
    w(p, 'uno:D8', 'bz:+', 'orange');
    w(p, 'uno:GND2', 'bz:-', 'black');
    code(
      p,
      'uno',
      `#define NOTE_C4 262
#define NOTE_D4 294
#define NOTE_E4 330
#define NOTE_F4 349
#define NOTE_G4 392
#define NOTE_A4 440

int melody[] = {NOTE_C4, NOTE_C4, NOTE_G4, NOTE_G4, NOTE_A4, NOTE_A4, NOTE_G4, 0,
                NOTE_F4, NOTE_F4, NOTE_E4, NOTE_E4, NOTE_D4, NOTE_D4, NOTE_C4, 0};

void setup() {
  Serial.begin(9600);
}

void loop() {
  for (int i = 0; i < 16; i++) {
    if (melody[i] > 0) tone(8, melody[i], 250);
    Serial.println(melody[i]);
    delay(300);
  }
  delay(1000);
}
`
    );
    return done(p, {position: [10, 110, 140], target: [5, 0, 5]});
  }
);
def(
  'dice',
  '7-segment counter',
  'Arduino Uno',
  'Intermediate',
  ['7-segment', '2-D arrays', 'Breadboard'],
  'Count 0–9 on a common-cathode display using a 2-D segment table.',
  () => {
    const p = base('7-segment counter');
    add(p, 'uno', 'uno', [-110, 0, 0]);
    add(p, 'bbfull', 'bb', [20, 0, 0]);
    on(p, 'sevenseg', 'seg', 'bb', 'H8');
    const segs = ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      cols = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'];
    segs.forEach((s, i) => {
      const c = 24 + i * 5;
      on(p, 'resistor', 'r' + s, 'bb', 'B' + c, {resistance: 330});
      w(p, 'uno:D' + (2 + i), 'bb:A' + c, cols[i]);
      const seg = at(p, 'bb', 'seg', s, s === 'C' || s === 'D' || s === 'E' ? 'J' : 'A');
      w(p, 'bb:E' + (c + 4), seg, cols[i]);
    });
    w(p, at(p, 'bb', 'seg', 'COM1', 'J'), 'bb:BN5', 'black');
    w(p, 'uno:GND2', 'bb:BN1', 'black');
    code(
      p,
      'uno',
      `// Segments a..g on pins 2..8, common cathode to GND.
const byte segPins[7] = {2, 3, 4, 5, 6, 7, 8};
const byte digits[10][7] = {
  {1,1,1,1,1,1,0}, {0,1,1,0,0,0,0}, {1,1,0,1,1,0,1}, {1,1,1,1,0,0,1}, {0,1,1,0,0,1,1},
  {1,0,1,1,0,1,1}, {1,0,1,1,1,1,1}, {1,1,1,0,0,0,0}, {1,1,1,1,1,1,1}, {1,1,1,1,0,1,1}
};

void showDigit(int n) {
  for (int s = 0; s < 7; s++) digitalWrite(segPins[s], digits[n][s]);
}

void setup() {
  for (int s = 0; s < 7; s++) pinMode(segPins[s], OUTPUT);
}

void loop() {
  for (int n = 0; n <= 9; n++) {
    showDigit(n);
    delay(700);
  }
}
`
    );
    return done(p, {position: [-30, 200, 210], target: [-20, 0, 0]});
  }
);
def(
  'shift',
  'Shift register bar graph',
  'Arduino Uno',
  'Intermediate',
  ['74HC595', 'shiftOut()', 'Breadboard'],
  'Drive eight segments of an LED bar graph through a 74HC595 using three pins.',
  () => {
    const p = base('Shift register bar graph');
    add(p, 'uno', 'uno', [-110, 0, 0]);
    add(p, 'bbfull', 'bb', [20, 0, 0]);
    on(p, 'hc595', 'sr', 'bb', 'F6');
    on(p, 'ledbar', 'bar', 'bb', 'F44', {color: '#ff5a36'});
    const top = pin => at(p, 'bb', 'sr', pin, 'A'),
      bot = pin => at(p, 'bb', 'sr', pin, 'J');
    w(p, 'uno:5V', 'bb:TP1', 'red');
    w(p, 'uno:GND2', 'bb:TN1', 'black');
    w(p, 'bb:TP25', 'bb:BP25', 'red');
    w(p, 'bb:TN24', 'bb:BN24', 'black');
    w(p, top('VCC'), 'bb:TP3', 'red');
    w(p, top('MR'), 'bb:TP6', 'red');
    w(p, top('OE'), 'bb:TN5', 'black');
    w(p, bot('GND'), 'bb:BN5', 'black');
    w(p, 'uno:D11', top('DS'), 'yellow');
    w(p, 'uno:D12', top('SHCP'), 'green');
    w(p, 'uno:D8', top('STCP'), 'blue');
    const wc = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray', 'white'];
    for (let i = 0; i < 8; i++) {
      const c = 16 + i * 3;
      on(p, 'resistor', 'r' + i, 'bb', (i % 2 ? 'G' : 'I') + c, {resistance: 330});
      w(p, i === 0 ? top('Q0') : bot('Q' + i), 'bb:' + (i % 2 ? 'F' : 'H') + c, wc[i]);
      w(p, 'bb:' + (i % 2 ? 'H' : 'J') + (c + 4), at(p, 'bb', 'bar', 'A' + (i + 1), 'J'), wc[i]);
      w(p, at(p, 'bb', 'bar', 'K' + (i + 1), 'A'), 'bb:TN' + (14 + i), 'black');
    }
    code(
      p,
      'uno',
      `const int DATA = 11, CLOCK = 12, LATCH = 8;

void setup() {
  pinMode(DATA, OUTPUT);
  pinMode(CLOCK, OUTPUT);
  pinMode(LATCH, OUTPUT);
}

void loop() {
  for (int n = 0; n <= 8; n++) {
    byte pattern = (1 << n) - 1;     // n lit segments
    digitalWrite(LATCH, LOW);
    shiftOut(DATA, CLOCK, MSBFIRST, pattern);
    digitalWrite(LATCH, HIGH);
    delay(250);
  }
}
`
    );
    return done(p, {position: [-20, 210, 220], target: [-20, 0, 0]});
  }
);
def(
  'keypad-lock',
  'Keypad door lock',
  'Arduino Uno',
  'Intermediate',
  ['Keypad', 'char arrays', 'Matrix scan'],
  'Scan a 4 × 4 keypad by hand and unlock with a code.',
  () => {
    const p = base('Keypad door lock');
    add(p, 'uno', 'uno', [-50, 0, -10]);
    add(p, 'keypad', 'kp', [50, 0, -25]);
    add(p, 'led', 'ok', [0, 0, 55], {color: '#34c759'});
    add(p, 'led', 'no', [20, 0, 55], {color: '#ff3b30'});
    add(p, 'resistor', 'r1', [0, 0, 45], {resistance: 220});
    add(p, 'resistor', 'r2', [20, 0, 45], {resistance: 220});
    ['D9', 'D8', 'D7', 'D6'].forEach((d, i) => w(p, 'uno:' + d, 'kp:R' + (i + 1), 'orange'));
    ['D5', 'D4', 'D3', 'D2'].forEach((d, i) => w(p, 'uno:' + d, 'kp:C' + (i + 1), 'blue'));
    w(p, 'uno:D12', 'r1:A', 'green');
    w(p, 'r1:B', 'ok:A', 'green');
    w(p, 'ok:K', 'uno:GND1', 'black');
    w(p, 'uno:D13', 'r2:A', 'red');
    w(p, 'r2:B', 'no:A', 'red');
    w(p, 'no:K', 'uno:GND2', 'black');
    code(
      p,
      'uno',
      `const byte rows[4] = {9, 8, 7, 6};
const byte cols[4] = {5, 4, 3, 2};
const char keys[4][4] = {
  {'1','2','3','A'}, {'4','5','6','B'}, {'7','8','9','C'}, {'*','0','#','D'}
};
String entry = "";
const String CODE = "1234";
char last = 0;

char scan() {
  for (int r = 0; r < 4; r++) {
    digitalWrite(rows[r], LOW);
    for (int c = 0; c < 4; c++) {
      if (digitalRead(cols[c]) == LOW) {
        digitalWrite(rows[r], HIGH);
        return keys[r][c];
      }
    }
    digitalWrite(rows[r], HIGH);
  }
  return 0;
}

void setup() {
  Serial.begin(9600);
  for (int i = 0; i < 4; i++) {
    pinMode(rows[i], OUTPUT);
    digitalWrite(rows[i], HIGH);
    pinMode(cols[i], INPUT_PULLUP);
  }
  pinMode(12, OUTPUT);
  pinMode(13, OUTPUT);
  digitalWrite(13, HIGH);
  Serial.println("Enter code, # to submit");
}

void loop() {
  char k = scan();
  if (k != 0 && k != last) {
    Serial.print(k);
    if (k == '#') {
      Serial.println();
      bool ok = entry == CODE;
      digitalWrite(12, ok);
      digitalWrite(13, !ok);
      Serial.println(ok ? "Unlocked" : "Wrong code");
      entry = "";
    } else if (k == '*') {
      entry = "";
    } else {
      entry += k;
    }
  }
  last = k;
  delay(20);
}
`
    );
    return done(p, {position: [10, 170, 180], target: [10, 0, 0]});
  }
);
def(
  'rgb-joy',
  'Joystick color mixer',
  'Arduino Uno',
  'Beginner',
  ['Joystick', 'PWM', 'RGB LED'],
  'Two joystick axes mix red and blue on an RGB LED; press for green.',
  () => {
    const p = base('Joystick color mixer');
    add(p, 'uno', 'uno', [-40, 0, 0]);
    add(p, 'joystick', 'joy', [45, 0, 35], {x: 0.8, y: 0.3});
    add(p, 'rgbled', 'rgb', [45, 0, -25]);
    ['R', 'G', 'B'].forEach((ch, i) =>
      add(p, 'resistor', 'r' + ch, [25 + i * 14, 0, -10], {resistance: 220}, Math.PI / 2)
    );
    w(p, 'uno:5V', 'joy:VCC', 'red');
    w(p, 'uno:GND1', 'joy:GND', 'black');
    w(p, 'uno:A0', 'joy:VRX', 'yellow');
    w(p, 'uno:A1', 'joy:VRY', 'green');
    w(p, 'uno:D2', 'joy:SW', 'blue');
    w(p, 'uno:D9', 'rR:A', 'red');
    w(p, 'rR:B', 'rgb:R', 'red');
    w(p, 'uno:D10', 'rG:A', 'green');
    w(p, 'rG:B', 'rgb:G', 'green');
    w(p, 'uno:D11', 'rB:A', 'blue');
    w(p, 'rB:B', 'rgb:B', 'blue');
    w(p, 'rgb:K', 'uno:GND3', 'black');
    code(
      p,
      'uno',
      `void setup() {
  pinMode(2, INPUT_PULLUP);
}

void loop() {
  int red = analogRead(A0) / 4;     // 0..255
  int blue = analogRead(A1) / 4;
  int green = digitalRead(2) == LOW ? 255 : 0;
  analogWrite(9, red);
  analogWrite(10, green);
  analogWrite(11, blue);
  delay(20);
}
`
    );
    return done(p, {position: [10, 130, 160], target: [5, 0, 5]});
  }
);
