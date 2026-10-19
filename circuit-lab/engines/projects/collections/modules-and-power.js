// Driver modules, power stages and sensor boards with and without firmware.
import {def} from '../registry.js';
import {C, base, add, on, at, w, code, done} from '../kit.js';

def(
  'h-bridge',
  'H-bridge motor direction',
  'Arduino Uno',
  'Intermediate',
  ['L293D', 'H-bridge', 'PWM'],
  'An L293D reverses a DC motor: forward, stop, reverse, with PWM on the enable pin for speed.',
  () => {
    const p = base('H-bridge motor direction');
    add(p, 'uno', 'uno', [-80, 0, 0]);
    add(p, 'l293d', 'drv', [10, 0, 20]);
    add(p, 'motor', 'm', [70, 0, 25]);
    add(p, 'battery', 'bat', [30, 0, -50]);
    w(p, 'uno:5V', 'drv:VCC1', 'red');
    w(p, 'uno:GND1', 'drv:GND1', 'black');
    w(p, 'bat:+', 'drv:VCC2', 'red');
    w(p, 'bat:-', 'drv:GND2', 'black');
    w(p, 'uno:D9', 'drv:EN12', 'orange');
    w(p, 'uno:D7', 'drv:1A', 'yellow');
    w(p, 'uno:D8', 'drv:2A', 'green');
    w(p, 'drv:1Y', 'm:+', 'blue');
    w(p, 'drv:2Y', 'm:-', 'purple');
    code(
      p,
      'uno',
      `const int EN = 9, IN1 = 7, IN2 = 8;\n\nvoid drive(int speed, bool forward) {\n  digitalWrite(IN1, forward ? HIGH : LOW);\n  digitalWrite(IN2, forward ? LOW : HIGH);\n  analogWrite(EN, speed);\n}\n\nvoid setup() {\n  pinMode(EN, OUTPUT);\n  pinMode(IN1, OUTPUT);\n  pinMode(IN2, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  Serial.println("forward");\n  drive(255, true);\n  delay(1500);\n  Serial.println("stop");\n  analogWrite(EN, 0);\n  delay(700);\n  Serial.println("reverse");\n  drive(200, false);\n  delay(1500);\n  analogWrite(EN, 0);\n  delay(700);\n}\n`
    );
    return done(p, {position: [0, 170, 200], target: [0, 0, 0]});
  }
);
def(
  'stepper',
  'Stepper motor with ULN2003',
  'Arduino Uno',
  'Intermediate',
  ['28BYJ-48', 'ULN2003', 'Half-step'],
  'Half-stepping a 28BYJ-48 through a ULN2003: 4096 half-steps make one turn of the geared shaft.',
  () => {
    const p = base('Stepper motor with ULN2003');
    add(p, 'uno', 'uno', [-80, 0, 0]);
    add(p, 'uln2003', 'drv', [5, 0, 20]);
    add(p, 'stepper', 'm', [60, 0, 0]);
    for (const [i, pin] of [
      [1, 8],
      [2, 9],
      [3, 10],
      [4, 11],
    ])
      w(p, 'uno:D' + pin, 'drv:IN' + i, ['blue', 'purple', 'yellow', 'orange'][i - 1]);
    w(p, 'uno:GND1', 'drv:GND', 'black');
    w(p, 'uno:5V', 'drv:COM', 'red');
    w(p, 'uno:5V', 'm:RED', 'red');
    w(p, 'drv:OUT1', 'm:BLUE', 'blue');
    w(p, 'drv:OUT2', 'm:PINK', 'purple');
    w(p, 'drv:OUT3', 'm:YELLOW', 'yellow');
    w(p, 'drv:OUT4', 'm:ORANGE', 'orange');
    code(
      p,
      'uno',
      `// Half-step sequence: Blue, Blue+Pink, Pink, Pink+Yellow, …\nconst int coil[4] = {8, 9, 10, 11};\nconst byte steps[8] = {0b0001, 0b0011, 0b0010, 0b0110, 0b0100, 0b1100, 0b1000, 0b1001};\nint phase = 0;\nlong count = 0;\n\nvoid setup() {\n  for (int i = 0; i < 4; i++) pinMode(coil[i], OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  for (int i = 0; i < 4; i++) digitalWrite(coil[i], (steps[phase] >> i) & 1);\n  phase = (phase + 1) % 8;\n  count++;\n  if (count % 512 == 0) {\n    Serial.print("turned ");\n    Serial.print(count * 360 / 4096);\n    Serial.println(" degrees");\n  }\n  delay(2);\n}\n`
    );
    return done(p, {position: [0, 170, 190], target: [0, 0, 0]});
  }
);
def(
  'lm317-supply',
  'Adjustable LM317 supply',
  'No microcontroller',
  'Beginner',
  ['LM317', 'Panel meter', 'Vout = 1.25 (1 + R2/R1)'],
  'Turn the pot: the LM317 keeps 1.25 V across the 240 Ω resistor, so Vout = 1.25 V × (1 + R2/240 Ω). A panel meter shows it.',
  () => {
    const p = base('Adjustable LM317 supply');
    add(p, 'psu', 'ps', [-110, 0, -10], {voltage: 15, limit: 1});
    add(p, 'lm317', 'u', [-25, 0, 10]);
    add(p, 'resistor', 'r1', [0, 0, -5], {resistance: 240});
    add(p, 'pot', 'pot', [-5, 0, 35], {value: 0.75, resistance: 5000});
    add(p, 'electrolytic', 'co', [25, 0, 10], {capacitance: 10e-6, rating: 25});
    add(p, 'resistor', 'load', [45, 0, 10], {resistance: 1000}, Math.PI / 2);
    add(p, 'panelmeter', 'vm', [60, 0, -45]);
    w(p, 'ps:+', 'u:IN', 'red');
    w(p, 'u:OUT', 'r1:B', 'orange');
    w(p, 'r1:A', 'u:ADJ', 'yellow');
    w(p, 'u:ADJ', 'pot:VCC', 'yellow');
    w(p, 'pot:W', 'pot:GND', 'gray');
    w(p, 'pot:GND', 'ps:-', 'black');
    w(p, 'u:OUT', 'co:+', 'orange');
    w(p, 'co:-', 'ps:-', 'black');
    w(p, 'u:OUT', 'load:A', 'orange');
    w(p, 'load:B', 'ps:-', 'black');
    w(p, 'ps:+', 'vm:V+', 'red');
    w(p, 'u:OUT', 'vm:VIN', 'yellow');
    w(p, 'vm:GND', 'ps:-', 'black');
    return done(p, {position: [-10, 170, 190], target: [-10, 0, 0]});
  }
);
def(
  'buck-converter',
  '12 V to 5 V buck converter',
  'No microcontroller',
  'Beginner',
  ['LM2596', 'Switching regulator', 'Efficiency'],
  'An LM2596 module steps 12 V down to 5 V. Input current is lower than output current: power in = power out ÷ efficiency.',
  () => {
    const p = base('12 V to 5 V buck converter');
    add(p, 'psu', 'ps', [-110, 0, -10], {voltage: 12, limit: 2});
    add(p, 'buck', 'b', [-20, 0, 10], {vout: 5});
    add(p, 'lamp', 'lamp', [40, 0, 25], {ratedVoltage: 6, ratedCurrent: 0.1});
    add(p, 'panelmeter', 'vm', [40, 0, -35]);
    add(p, 'multimeter', 'dmm', [-110, 0, 110], {mode: 'A'});
    w(p, 'ps:+', 'dmm:A', 'red');
    w(p, 'dmm:COM', 'b:IN+', 'red');
    w(p, 'ps:-', 'b:IN-', 'black');
    w(p, 'b:OUT+', 'lamp:A', 'orange');
    w(p, 'lamp:B', 'b:OUT-', 'black');
    w(p, 'b:OUT+', 'vm:V+', 'red');
    w(p, 'b:OUT+', 'vm:VIN', 'yellow');
    w(p, 'vm:GND', 'b:OUT-', 'black');
    return done(p, {position: [-30, 210, 230], target: [-30, 0, 20]});
  }
);
def(
  'opto-isolation',
  'Optocoupler isolation',
  'Arduino Uno',
  'Intermediate',
  ['PC817', 'Isolation', 'Separate grounds'],
  'The Uno blinks the PC817’s internal LED; light crosses the isolation gap and switches an LED powered by a separate 9 V battery with its own ground.',
  () => {
    const p = base('Optocoupler isolation');
    add(p, 'uno', 'uno', [-80, 0, 0]);
    add(p, 'resistor', 'rin', [0, 0, 0], {resistance: 330});
    add(p, 'pc817', 'opto', [25, 0, 0]);
    add(p, 'battery', 'bat', [85, 0, -35]);
    add(p, 'resistor', 'rl', [55, 0, 25], {resistance: 1000}, Math.PI / 2);
    add(p, 'led', 'led', [75, 0, 40], {color: '#34c759'});
    w(p, 'uno:D4', 'rin:A', 'yellow');
    w(p, 'rin:B', 'opto:A', 'yellow');
    w(p, 'opto:K', 'uno:GND1', 'black');
    w(p, 'bat:+', 'rl:A', 'red');
    w(p, 'rl:B', 'led:A', 'orange');
    w(p, 'led:K', 'opto:C', 'green');
    w(p, 'opto:E', 'bat:-', 'black');
    code(
      p,
      'uno',
      `void setup() {\n  pinMode(4, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(4, HIGH);\n  delay(400);\n  digitalWrite(4, LOW);\n  delay(400);\n}\n`
    );
    return done(p, {position: [0, 150, 170], target: [0, 0, 0]});
  }
);
def(
  'comparator-night',
  'Comparator night light',
  'No microcontroller',
  'Beginner',
  ['LM393', 'LDR', 'Pull-up'],
  'No code: an LM393 compares an LDR divider with a reference from a pot. In the dark the divider falls below the reference and the open-collector output pulls the LED’s cathode low.',
  () => {
    const p = base('Comparator night light');
    add(p, 'aapack', 'bat', [-110, 0, 0], {cells: 4});
    add(p, 'lm393', 'u', [0, 0, 0]);
    add(p, 'ldr', 'ldr', [-40, 0, 30], {lux: 2});
    add(p, 'resistor', 'rd', [-40, 0, -25], {resistance: 10000}, Math.PI / 2);
    add(p, 'pot', 'ref', [-25, 0, 55], {value: 0.5});
    add(p, 'resistor', 'rl', [40, 0, -25], {resistance: 330}, Math.PI / 2);
    add(p, 'led', 'led', [45, 0, 10], {color: '#ffcc00'});
    w(p, 'bat:+', 'u:VCC', 'red');
    w(p, 'bat:-', 'u:GND', 'black');
    w(p, 'bat:+', 'ldr:A', 'red');
    w(p, 'ldr:B', 'rd:A', 'yellow');
    w(p, 'rd:B', 'bat:-', 'black');
    w(p, 'ldr:B', 'u:IN1+', 'yellow');
    w(p, 'bat:+', 'ref:VCC', 'red');
    w(p, 'ref:GND', 'bat:-', 'black');
    w(p, 'ref:W', 'u:IN1-', 'blue');
    w(p, 'bat:+', 'rl:A', 'red');
    w(p, 'rl:B', 'led:A', 'orange');
    w(p, 'led:K', 'u:OUT1', 'green');
    return done(p, {position: [-20, 150, 170], target: [-20, 0, 10]});
  }
);
def(
  'traffic-module',
  'Traffic light module',
  'Arduino Uno',
  'Beginner',
  ['Traffic light', 'Timing', 'digitalWrite'],
  'A ready-made traffic light module (resistors on board) runs a real cycle: green, yellow, red, red + yellow.',
  () => {
    const p = base('Traffic light module');
    add(p, 'uno', 'uno', [-50, 0, 0]);
    add(p, 'trafficlight', 'tl', [30, 0, -5]);
    w(p, 'uno:D2', 'tl:R', 'red');
    w(p, 'uno:D3', 'tl:Y', 'yellow');
    w(p, 'uno:D4', 'tl:G', 'green');
    w(p, 'uno:GND2', 'tl:GND', 'black');
    code(
      p,
      'uno',
      `const int RED = 2, YELLOW = 3, GREEN = 4;\n\nvoid show(bool r, bool y, bool g, int ms) {\n  digitalWrite(RED, r);\n  digitalWrite(YELLOW, y);\n  digitalWrite(GREEN, g);\n  delay(ms);\n}\n\nvoid setup() {\n  pinMode(RED, OUTPUT);\n  pinMode(YELLOW, OUTPUT);\n  pinMode(GREEN, OUTPUT);\n}\n\nvoid loop() {\n  show(0, 0, 1, 3000);\n  show(0, 1, 0, 1000);\n  show(1, 0, 0, 3000);\n  show(1, 1, 0, 800);\n}\n`
    );
    return done(p, {position: [0, 140, 150], target: [0, 0, 0]});
  }
);
def(
  'solar-meter',
  'Solar panel under load',
  'No microcontroller',
  'Beginner',
  ['Solar panel', 'I–V curve', 'Multimeter'],
  'A 6 V 1 W panel lights a 6 V bulb. Change the sunlight: the current follows the light, and the bulb dims well before the panel voltage collapses.',
  () => {
    const p = base('Solar panel under load');
    add(p, 'solar', 'pv', [-60, 0, 0], {irradiance: 800});
    add(p, 'lamp', 'load', [30, 0, 30], {ratedVoltage: 6, ratedCurrent: 0.1});
    add(p, 'multimeter', 'dmm', [60, 0, -60], {mode: 'V'});
    add(p, 'multimeter', 'amm', [-20, 0, 110], {mode: 'A'});
    w(p, 'pv:+', 'amm:A', 'red');
    w(p, 'amm:COM', 'load:A', 'red');
    w(p, 'load:B', 'pv:-', 'black');
    w(p, 'dmm:VΩ', 'load:A', 'red');
    w(p, 'dmm:COM', 'pv:-', 'black');
    return done(p, {position: [0, 220, 230], target: [0, 0, 10]});
  }
);
def(
  'fuse-protection',
  'Fuse protection',
  'No microcontroller',
  'Beginner',
  ['Fuse', 'Short circuit', 'I²t'],
  'A 500 mA fast fuse feeds a lamp. Hold the “fault” button to short the lamp: the fuse blows in milliseconds and the circuit stays open until you replace it.',
  () => {
    const p = base('Fuse protection');
    add(p, 'psu', 'ps', [-100, 0, -10], {voltage: 6, limit: 3});
    add(p, 'fuse', 'f', [-20, 0, 10]);
    add(p, 'lamp', 'lamp', [25, 0, 10], {ratedVoltage: 6, ratedCurrent: 0.1});
    add(p, 'button', 'fault', [25, 0, 45]);
    w(p, 'ps:+', 'f:A', 'red');
    w(p, 'f:B', 'lamp:A', 'red');
    w(p, 'lamp:B', 'ps:-', 'black');
    w(p, 'lamp:A', 'fault:1', 'orange');
    w(p, 'fault:2', 'lamp:B', 'orange');
    return done(p, {position: [-20, 140, 160], target: [-20, 0, 10]});
  }
);
def(
  'door-alarm',
  'Reed switch door alarm',
  'ESP32',
  'Beginner',
  ['Reed switch', 'INPUT_PULLUP', 'Buzzer'],
  'A magnet on the door keeps the reed switch closed. Open the door (move the magnet away) and the ESP32 sounds the buzzer.',
  () => {
    const p = base('Reed switch door alarm');
    add(p, 'board', 'esp', [-50, 0, 0]);
    add(p, 'reed', 'reed', [20, 0, -20], {distance: 3});
    add(p, 'buzzer', 'bz', [25, 0, 25]);
    w(p, 'esp:IO27', 'reed:A', 'yellow');
    w(p, 'reed:B', 'esp:GND1', 'black');
    w(p, 'esp:IO26', 'bz:+', 'red');
    w(p, 'bz:-', 'esp:GND1', 'black');
    code(
      p,
      'esp',
      `const int REED = 27, BUZZER = 26;\n\nvoid setup() {\n  pinMode(REED, INPUT_PULLUP);\n  pinMode(BUZZER, OUTPUT);\n  Serial.begin(115200);\n}\n\nvoid loop() {\n  bool open = digitalRead(REED) == HIGH;  // magnet gone: contacts open, pull-up wins\n  digitalWrite(BUZZER, open);\n  if (open) Serial.println("Door open!");\n  delay(200);\n}\n`
    );
    return done(p, {position: [0, 130, 150], target: [0, 0, 0]});
  }
);
def(
  'ir-obstacle',
  'IR obstacle detector',
  'Arduino Nano',
  'Beginner',
  ['FC-51', 'Active LOW', 'LED'],
  'An FC-51 infrared sensor pulls its output LOW when something comes within range; the Nano lights its L LED and prints the event.',
  () => {
    const p = base('IR obstacle detector');
    add(p, 'nano', 'nano', [-30, 0, 0]);
    add(p, 'irsensor', 'ir', [35, 0, 0], {distance: 40, threshold: 15});
    w(p, 'nano:5V', 'ir:VCC', 'red');
    w(p, 'nano:GND1', 'ir:GND', 'black');
    w(p, 'nano:D2', 'ir:OUT', 'yellow');
    code(
      p,
      'nano',
      `void setup() {\n  pinMode(2, INPUT);\n  pinMode(13, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  bool blocked = digitalRead(2) == LOW;\n  digitalWrite(13, blocked);\n  Serial.println(blocked ? "obstacle" : "clear");\n  delay(250);\n}\n`
    );
    return done(p, {position: [0, 110, 120], target: [0, 0, 0]});
  }
);
def(
  'pwm-scope',
  'PWM generator on the scope',
  'No microcontroller',
  'Beginner',
  ['XY-LPWM', 'Duty cycle', 'Oscilloscope'],
  'An XY-LPWM module makes a 20 Hz, 30 % square wave at its supply voltage. The scope shows the pulses and the LED brightness follows the duty cycle.',
  () => {
    const p = base('PWM generator on the scope');
    add(p, 'psu', 'ps', [-110, 0, -10], {voltage: 9, limit: 1});
    add(p, 'pwmgen', 'g', [-20, 0, 10], {frequency: 20, duty: 0.3});
    add(p, 'resistor', 'r', [30, 0, 30], {resistance: 470}, Math.PI / 2);
    add(p, 'led', 'led', [45, 0, 45], {color: '#3a8bff'});
    add(p, 'scope', 'scope', [110, 0, -20]);
    w(p, 'ps:+', 'g:VIN+', 'red');
    w(p, 'ps:-', 'g:VIN-', 'black');
    w(p, 'g:PWM', 'r:A', 'yellow');
    w(p, 'r:B', 'led:A', 'yellow');
    w(p, 'led:K', 'g:GND', 'black');
    w(p, 'scope:CH1', 'g:PWM', 'yellow');
    w(p, 'scope:GND', 'g:GND', 'black');
    return done(p, {position: [0, 180, 220], target: [0, 0, 0]});
  }
);
def(
  'speaker-tone',
  'Speaker with a transistor driver',
  'Arduino Uno',
  'Beginner',
  ['Speaker', 'tone()', 'NPN driver'],
  'tone() on D8 switches an NPN transistor that drives an 8 Ω speaker through 100 Ω. Straight from the pin the speaker would try to draw over 100 mA.',
  () => {
    const p = base('Speaker with a transistor driver');
    add(p, 'uno', 'uno', [-70, 0, 0]);
    add(p, 'resistor', 'rb', [0, 0, 0], {resistance: 1000});
    add(p, 'npn', 'q', [25, 0, 0], {model: '2N2222A'});
    add(p, 'resistor', 'rs', [45, 0, -25], {resistance: 100}, Math.PI / 2);
    add(p, 'speaker', 'spk', [75, 0, -30]);
    add(p, 'diode', 'd', [55, 0, 25], {model: '1N4148'});
    w(p, 'uno:D8', 'rb:A', 'yellow');
    w(p, 'rb:B', 'q:B', 'yellow');
    w(p, 'q:E', 'uno:GND1', 'black');
    w(p, 'uno:5V', 'rs:A', 'red');
    w(p, 'rs:B', 'spk:+', 'red');
    w(p, 'spk:-', 'q:C', 'blue');
    w(p, 'd:K', 'spk:+', 'gray');
    w(p, 'd:A', 'spk:-', 'gray');
    code(
      p,
      'uno',
      `const int notes[] = {262, 330, 392, 523};\n\nvoid setup() {}\n\nvoid loop() {\n  for (int i = 0; i < 4; i++) {\n    tone(8, notes[i]);\n    delay(300);\n  }\n  noTone(8);\n  delay(600);\n}\n`
    );
    return done(p, {position: [0, 150, 170], target: [0, 0, 0]});
  }
);
def(
  'relay-module',
  'Relay module switches a lamp',
  'Arduino Uno',
  'Beginner',
  ['KY-019', 'Relay', 'Isolated load'],
  'A KY-019 relay module turns a separately powered 6 V lamp on and off. The Uno pin only feeds the module’s transistor (about 4 mA); the lamp current flows through the relay contacts.',
  () => {
    const p = base('Relay module switches a lamp');
    add(p, 'uno', 'uno', [-80, 0, 0]);
    add(p, 'relaymodule', 'k', [5, 0, 0]);
    add(p, 'psu', 'ps', [60, 0, -55], {voltage: 6, limit: 1});
    add(p, 'lamp', 'lamp', [70, 0, 25]);
    w(p, 'uno:D7', 'k:S', 'yellow');
    w(p, 'uno:5V', 'k:+', 'red');
    w(p, 'uno:GND1', 'k:-', 'black');
    // the lamp circuit has its own supply: it only meets the module at the screw terminals
    w(p, 'ps:+', 'k:COM', 'red');
    w(p, 'k:NO', 'lamp:A', 'orange');
    w(p, 'lamp:B', 'ps:-', 'black');
    code(
      p,
      'uno',
      `// KY-019: S HIGH energizes the relay; COM connects to NO.\nconst int RELAY = 7;\n\nvoid setup() {\n  pinMode(RELAY, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  digitalWrite(RELAY, HIGH);\n  Serial.println("lamp on");\n  delay(1000);\n  digitalWrite(RELAY, LOW);\n  Serial.println("lamp off");\n  delay(1000);\n}\n`
    );
    return done(p, {position: [0, 150, 175], target: [0, 0, 0]});
  }
);
def(
  'solenoid-striker',
  'Solenoid striker',
  'Arduino Uno',
  'Intermediate',
  ['JF-0530B', 'MOSFET', 'Flyback diode'],
  'An IRLZ44N lets the Uno fire a 12 V push-pull solenoid in short pulses. The 1N4007 across the coil catches the switch-off kick; remove it and the diagnostics show why it is there.',
  () => {
    const p = base('Solenoid striker');
    add(p, 'uno', 'uno', [-85, 0, 0]);
    add(p, 'bbhalf', 'bb', [10, 0, 10]);
    add(p, 'psu', 'ps', [20, 0, -70], {voltage: 12, limit: 1});
    add(p, 'solenoid', 'sol', [95, 0, 10]);
    on(p, 'mosfet', 'q', 'bb', 'E12');
    on(p, 'resistor', 'rg', 'bb', 'D5', {resistance: 220});
    on(p, 'resistor', 'rpd', 'bb', 'D12', {resistance: 10000}); // gate pull-down: off while the Uno boots
    on(p, 'diode', 'd', 'bb', 'G20');
    w(p, 'uno:D9', at(p, 'bb', 'rg', 'A', 'A'), 'yellow');
    w(p, at(p, 'bb', 'rg', 'B', 'B'), at(p, 'bb', 'q', 'G', 'B'), 'yellow');
    w(p, at(p, 'bb', 'q', 'S', 'A'), 'bb:TN16', 'black');
    w(p, at(p, 'bb', 'rpd', 'B', 'E'), 'bb:TN19', 'black');
    w(p, 'uno:GND1', 'bb:TN2', 'black');
    w(p, 'ps:-', 'bb:TN24', 'black');
    w(p, at(p, 'bb', 'q', 'D', 'C'), at(p, 'bb', 'd', 'A', 'H'), 'blue');
    w(p, 'ps:+', at(p, 'bb', 'd', 'K', 'J'), 'red');
    w(p, at(p, 'bb', 'd', 'K', 'I'), 'sol:+', 'red');
    w(p, at(p, 'bb', 'd', 'A', 'I'), 'sol:-', 'blue');
    code(
      p,
      'uno',
      `// JF-0530B is for short pulses: about 1 s on, 1 s off at most.\nconst int GATE = 9;\n\nvoid setup() {\n  pinMode(GATE, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(GATE, HIGH);  // pull the plunger in\n  delay(150);\n  digitalWrite(GATE, LOW);   // the spring pushes it back\n  delay(850);\n}\n`
    );
    return done(p, {position: [10, 160, 170], target: [10, 0, 0]});
  }
);
