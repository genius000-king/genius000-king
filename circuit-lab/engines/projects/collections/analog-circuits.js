// No microcontroller: timers, RC/RL, op-amps, regulators, rectifiers and logic gates.
import {terminals} from '../../catalog/types.js';
import {def} from '../registry.js';
import {C, base, add, on, get, at, rail, w, done} from '../kit.js';

def(
  '555-flasher',
  '555 LED flasher',
  'No microcontroller',
  'Beginner',
  ['NE555', 'Astable', 'RC timing'],
  'A 9 V NE555 astable blinks an LED at about 1.4 Hz: f = 1.44 / ((R1 + 2R2)·C).',
  () => {
    const p = base('555 LED flasher');
    add(p, 'bbhalf', 'bb', [0, 0, 0]);
    add(p, 'battery', 'bat', [-70, 0, -5]);
    on(p, 'ne555', 'u', 'bb', 'F10');
    const top = pin => at(p, 'bb', 'u', pin, 'A'),
      bot = pin => at(p, 'bb', 'u', pin, 'J');
    on(p, 'resistor', 'r1', 'bb', 'B11', {resistance: 1000});
    on(p, 'resistor', 'r2', 'bb', 'C12', {resistance: 10000});
    on(p, 'electrolytic', 'c', 'bb', 'G18', {capacitance: 47e-6, rating: 25});
    on(p, 'resistor', 'rl', 'bb', 'I12', {resistance: 470});
    on(p, 'led', 'led', 'bb', 'H16', {color: '#ff3b30'});
    w(p, 'bat:+', 'bb:TP1', 'red');
    w(p, 'bat:-', 'bb:TN1', 'black');
    w(p, 'bb:TP25', 'bb:BP25', 'red');
    w(p, 'bb:TN24', 'bb:BN24', 'black');
    w(p, top('VCC'), 'bb:TP6', 'red');
    w(p, bot('RESET'), 'bb:BP9', 'red');
    w(p, bot('GND'), 'bb:BN6', 'black');
    w(p, 'bb:A15', 'bb:TP11', 'red');
    w(p, 'bb:A16', 'bb:D11', 'yellow');
    w(p, 'bb:A12', 'bb:J11', 'green');
    w(p, 'bb:H11', 'bb:H18', 'green');
    w(p, 'bb:J19', 'bb:BN14', 'black');
    w(p, 'bb:J17', 'bb:BN12', 'black');
    return done(p, {position: [-10, 150, 160], target: [-10, 0, 0]});
  }
);
def(
  'rc-scope',
  'RC filter on a scope',
  'No microcontroller',
  'Intermediate',
  ['Capacitor', 'Oscilloscope', 'Time constant'],
  'A 2 Hz square wave charges a 100 µF capacitor through 1 kΩ; τ = RC = 100 ms.',
  () => {
    const p = base('RC filter on a scope');
    add(p, 'fgen', 'gen', [-80, 0, -10], {wave: 'square', frequency: 2, amplitude: 2.5, offset: 2.5});
    add(p, 'resistor', 'r', [-10, 0, 40], {resistance: 1000});
    add(p, 'electrolytic', 'c', [15, 0, 40], {capacitance: 100e-6, rating: 16});
    add(p, 'scope', 'scope', [75, 0, -10]);
    w(p, 'gen:OUT', 'r:A', 'yellow');
    w(p, 'r:B', 'c:+', 'green');
    w(p, 'c:-', 'gen:GND', 'black');
    w(p, 'gen:OUT', 'scope:CH1', 'yellow');
    w(p, 'c:+', 'scope:CH2', 'blue');
    w(p, 'scope:GND', 'gen:GND', 'black');
    return done(p, {position: [0, 140, 230], target: [0, 20, 0]});
  }
);
def(
  'rl-scope',
  'RL circuit and inductive current',
  'No microcontroller',
  'Intermediate',
  ['Inductor', 'Oscilloscope', 'τ = L/R'],
  'A square wave drives 1 H in series with 100 Ω; the resistor voltage shows the current rising with τ = 10 ms.',
  () => {
    const p = base('RL circuit');
    add(p, 'fgen', 'gen', [-80, 0, -10], {wave: 'square', frequency: 10, amplitude: 2.5, offset: 2.5});
    add(p, 'inductor', 'l', [-10, 0, 40], {inductance: 1, dcr: 1, maxCurrent: 200});
    add(p, 'resistor', 'r', [15, 0, 40], {resistance: 100});
    add(p, 'scope', 'scope', [75, 0, -10]);
    w(p, 'gen:OUT', 'l:A', 'yellow');
    w(p, 'l:B', 'r:A', 'green');
    w(p, 'r:B', 'gen:GND', 'black');
    w(p, 'gen:OUT', 'scope:CH1', 'yellow');
    w(p, 'r:A', 'scope:CH2', 'blue');
    w(p, 'scope:GND', 'gen:GND', 'black');
    return done(p, {position: [0, 140, 230], target: [0, 20, 0]});
  }
);
def(
  'opamp-amp',
  'Op-amp amplifier',
  'No microcontroller',
  'Intermediate',
  ['LM358', 'Gain', 'Oscilloscope'],
  'A non-inverting LM358 stage with gain 1 + 20k/10k = 3 amplifies a 0.5 V sine.',
  () => {
    const p = base('Op-amp amplifier');
    add(p, 'bbhalf', 'bb', [0, 0, 0]);
    add(p, 'psu', 'vcc', [-100, 0, -60], {voltage: 9, limit: 0.5});
    add(p, 'fgen', 'gen', [-100, 0, 55], {wave: 'sine', frequency: 5, amplitude: 0.5, offset: 1.5});
    add(p, 'scope', 'scope', [115, 0, 0]);
    on(p, 'opamp', 'u', 'bb', 'F10');
    const top = pin => at(p, 'bb', 'u', pin, 'A'),
      bot = pin => at(p, 'bb', 'u', pin, 'J');
    on(p, 'resistor', 'rf', 'bb', 'I6', {resistance: 20000});
    on(p, 'resistor', 'rg', 'bb', 'G11', {resistance: 10000});
    w(p, 'vcc:+', 'bb:TP1', 'red');
    w(p, 'vcc:-', 'bb:TN1', 'black');
    w(p, 'bb:TN25', 'bb:BN25', 'black');
    w(p, top('VCC'), 'bb:TP5', 'red');
    w(p, bot('GND'), 'bb:BN9', 'black');
    // 20 kΩ feedback from OUT1 (column 10) via I6–I10 to IN1− (column 11); 10 kΩ from IN1− to ground.
    w(p, 'bb:J6', 'bb:H11', 'green');
    w(p, 'bb:J15', 'bb:BN13', 'black');
    w(p, 'gen:OUT', bot('IN1+'), 'yellow');
    w(p, 'gen:GND', 'bb:BN3', 'black');
    w(p, 'gen:OUT', 'scope:CH1', 'yellow');
    w(p, 'bb:H10', 'scope:CH2', 'blue');
    w(p, 'scope:GND', 'bb:BN20', 'black');
    w(p, top('IN2+'), 'bb:TN8', 'black');
    w(p, top('IN2-'), top('OUT2'), 'gray');
    return done(p, {position: [0, 190, 230], target: [0, 10, 0]});
  }
);
def(
  'regulator',
  '9 V to 5 V regulator',
  'No microcontroller',
  'Beginner',
  ['LM7805', 'Multimeter', 'Power'],
  'An LM7805 regulates a 9 V battery to 5 V; a multimeter confirms the output.',
  () => {
    const p = base('9 V to 5 V regulator');
    add(p, 'battery', 'bat', [-60, 0, 0]);
    add(p, 'regulator', 'u', [0, 0, 20]);
    add(p, 'electrolytic', 'cin', [-15, 0, 40], {capacitance: 10e-6, rating: 25});
    add(p, 'electrolytic', 'cout', [15, 0, 40], {capacitance: 10e-6, rating: 16});
    add(p, 'resistor', 'r', [35, 0, 10], {resistance: 330}, Math.PI / 2);
    add(p, 'led', 'led', [45, 0, 30], {color: '#34c759'});
    add(p, 'multimeter', 'dmm', [70, 0, -60], {mode: 'V'});
    w(p, 'bat:+', 'u:IN', 'red');
    w(p, 'bat:-', 'u:GND', 'black');
    w(p, 'u:IN', 'cin:+', 'red');
    w(p, 'cin:-', 'u:GND', 'black');
    w(p, 'u:OUT', 'cout:+', 'orange');
    w(p, 'cout:-', 'u:GND', 'black');
    w(p, 'u:OUT', 'r:A', 'orange');
    w(p, 'r:B', 'led:A', 'orange');
    w(p, 'led:K', 'u:GND', 'black');
    w(p, 'dmm:VΩ', 'u:OUT', 'red');
    w(p, 'dmm:COM', 'bat:-', 'black');
    return done(p, {position: [0, 170, 220], target: [0, 10, 0]});
  }
);
def(
  'zener',
  'Zener reference',
  'No microcontroller',
  'Beginner',
  ['Zener diode', 'Load line', 'Bench supply'],
  'A 1N4733A holds about 5 V across its terminals while the supply varies.',
  () => {
    const p = base('Zener reference');
    add(p, 'psu', 'ps', [-70, 0, -30], {voltage: 12, limit: 0.2});
    add(p, 'resistor', 'r', [0, 0, 30], {resistance: 470});
    add(p, 'diode', 'z', [30, 0, 30], {model: '1N4733A (5.1 V Zener)'});
    add(p, 'multimeter', 'dmm', [70, 0, -40], {mode: 'V'});
    w(p, 'ps:+', 'r:A', 'red');
    w(p, 'r:B', 'z:K', 'orange');
    w(p, 'z:A', 'ps:-', 'black');
    w(p, 'dmm:VΩ', 'z:K', 'red');
    w(p, 'dmm:COM', 'ps:-', 'black');
    return done(p, {position: [0, 170, 220], target: [0, 10, 0]});
  }
);
def(
  'transistor-lamp',
  'Transistor lamp switch',
  'No microcontroller',
  'Beginner',
  ['BJT', 'Saturation', 'Push button'],
  'A button feeds base current to a 2N2222A that switches a 6 V lamp.',
  () => {
    const p = base('Transistor lamp switch');
    add(p, 'aapack', 'batt', [-70, 0, 0], {cells: 4});
    add(p, 'button', 'btn', [-15, 0, 40], {bounce: 0});
    add(p, 'resistor', 'rb', [5, 0, 40], {resistance: 1000});
    add(p, 'npn', 'q', [25, 0, 40]);
    add(p, 'lamp', 'lamp', [40, 0, 0]);
    w(p, 'batt:+', 'btn:1', 'red');
    w(p, 'btn:2', 'rb:A', 'orange');
    w(p, 'rb:B', 'q:B', 'orange');
    w(p, 'q:E', 'batt:-', 'black');
    w(p, 'batt:+', 'lamp:A', 'red');
    w(p, 'lamp:B', 'q:C', 'gray');
    return done(p, {position: [0, 130, 170], target: [0, 5, 10]});
  }
);
def(
  'dmm-ohms',
  'Measuring with a multimeter',
  'No microcontroller',
  'Beginner',
  ['Multimeter', 'Voltage divider', 'Ohm’s law'],
  'Measure a divider: volts across R2, and the resistance of R1 alone.',
  () => {
    const p = base('Measuring with a multimeter');
    add(p, 'battery', 'bat', [-60, 0, 0]);
    add(p, 'resistor', 'r1', [0, 0, 30], {resistance: 4700});
    add(p, 'resistor', 'r2', [25, 0, 30], {resistance: 10000});
    add(p, 'multimeter', 'dmm', [60, 0, -50], {mode: 'V'});
    add(p, 'resistor', 'rx', [0, 0, -40], {resistance: 2200});
    add(p, 'multimeter', 'ohm', [-60, 0, -90], {mode: 'Ω'});
    w(p, 'bat:+', 'r1:A', 'red');
    w(p, 'r1:B', 'r2:A', 'yellow');
    w(p, 'r2:B', 'bat:-', 'black');
    w(p, 'dmm:VΩ', 'r2:A', 'red');
    w(p, 'dmm:COM', 'r2:B', 'black');
    w(p, 'ohm:VΩ', 'rx:A', 'red');
    w(p, 'ohm:COM', 'rx:B', 'black');
    return done(p, {position: [0, 200, 230], target: [0, 10, -10]});
  }
);
def(
  'linear-psu',
  'Linear power supply',
  'No microcontroller',
  'Intermediate',
  ['Transformer', 'Bridge rectifier', '7805', 'Ripple'],
  '230 V AC → 12 V transformer → bridge → 1000 µF → 7805. The scope shows the 100 Hz ripple on the capacitor and the flat 5 V after the regulator.',
  () => {
    const p = base('Linear power supply');
    add(p, 'acsource', 'ac', [-175, 0, -10], {vrms: 230});
    add(p, 'transformer', 't', [-85, 0, 0]);
    add(p, 'bridge', 'br', [-35, 0, 0]);
    add(p, 'electrolytic', 'c', [-10, 0, 10], {capacitance: 1000e-6, rating: 25});
    add(p, 'regulator', 'u', [15, 0, 10]);
    add(p, 'electrolytic', 'co', [35, 0, 10], {capacitance: 10e-6, rating: 16});
    add(p, 'resistor', 'rl', [55, 0, 25], {resistance: 330}, Math.PI / 2);
    add(p, 'led', 'led', [55, 0, 45], {color: '#34c759'});
    add(p, 'multimeter', 'dmm', [10, 0, -110], {mode: 'V'});
    add(p, 'scope', 'scope', [150, 0, -20]);
    w(p, 'ac:L', 't:P1', 'red');
    w(p, 'ac:N', 't:P2', 'black');
    w(p, 't:S1', 'br:AC1', 'yellow');
    w(p, 't:S2', 'br:AC2', 'yellow');
    w(p, 'br:+', 'c:+', 'red');
    w(p, 'br:-', 'c:-', 'black');
    w(p, 'c:+', 'u:IN', 'red');
    w(p, 'c:-', 'u:GND', 'black');
    w(p, 'u:OUT', 'co:+', 'orange');
    w(p, 'co:-', 'u:GND', 'black');
    w(p, 'u:OUT', 'rl:A', 'orange');
    w(p, 'rl:B', 'led:A', 'orange');
    w(p, 'led:K', 'c:-', 'black');
    w(p, 'dmm:VΩ', 'u:OUT', 'red');
    w(p, 'dmm:COM', 'c:-', 'black');
    w(p, 'scope:CH1', 'c:+', 'yellow');
    w(p, 'scope:CH2', 'u:OUT', 'blue');
    w(p, 'scope:GND', 'c:-', 'black');
    return done(p, {position: [-10, 230, 260], target: [-10, 0, -10]});
  }
);
def(
  'ct-rectifier',
  'Center-tap full-wave rectifier',
  'No microcontroller',
  'Intermediate',
  ['Center-tap transformer', 'Diodes', 'Full wave'],
  'A 9-0-9 V transformer and two diodes rectify both half-cycles; the center tap is 0 V.',
  () => {
    const p = base('Center-tap full-wave rectifier');
    add(p, 'acsource', 'ac', [-165, 0, -10], {vrms: 230});
    add(p, 'transformerct', 't', [-75, 0, 0]);
    add(p, 'diode', 'd1', [-25, 0, -15], {model: '1N4007'});
    add(p, 'diode', 'd2', [-25, 0, 15], {model: '1N4007'});
    add(p, 'electrolytic', 'c', [5, 0, 0], {capacitance: 470e-6, rating: 25});
    add(p, 'resistor', 'r', [30, 0, 0], {resistance: 1000}, Math.PI / 2);
    add(p, 'scope', 'scope', [130, 0, -20]);
    w(p, 'ac:L', 't:P1', 'red');
    w(p, 'ac:N', 't:P2', 'black');
    w(p, 't:S1', 'd1:A', 'yellow');
    w(p, 't:S2', 'd2:A', 'yellow');
    w(p, 'd1:K', 'c:+', 'red');
    w(p, 'd2:K', 'c:+', 'red');
    w(p, 't:CT', 'c:-', 'black');
    w(p, 'c:+', 'r:A', 'red');
    w(p, 'r:B', 'c:-', 'black');
    w(p, 'scope:CH1', 't:S1', 'yellow');
    w(p, 'scope:CH2', 'c:+', 'blue');
    w(p, 'scope:GND', 't:CT', 'black');
    return done(p, {position: [-10, 200, 230], target: [-10, 0, 0]});
  }
);
def(
  '4017-chaser',
  '555 + CD4017 LED chaser',
  'No microcontroller',
  'Intermediate',
  ['NE555', 'CD4017', 'Decade counter'],
  'The 555 clocks a CD4017 about 7 times a second; its ten outputs walk one lit segment along an LED bar. The 4017’s weak CMOS outputs limit the LED current.',
  () => {
    const p = base('555 + CD4017 LED chaser');
    add(p, 'bbfull', 'bb', [0, 0, 0]);
    add(p, 'battery', 'bat', [-125, 0, -5]);
    on(p, 'ne555', 't', 'bb', 'F10');
    on(p, 'resistor', 'r1', 'bb', 'B11', {resistance: 1000});
    on(p, 'resistor', 'r2', 'bb', 'C12', {resistance: 10000});
    on(p, 'electrolytic', 'c', 'bb', 'G18', {capacitance: 10e-6, rating: 25});
    on(p, 'cd4017', 'u', 'bb', 'F30');
    on(p, 'ledbar', 'bar', 'bb', 'F45', {color: '#ff5a36'});
    const top = pin => at(p, 'bb', 't', pin, 'A'),
      bot = pin => at(p, 'bb', 't', pin, 'J');
    w(p, 'bat:+', 'bb:TP1', 'red');
    w(p, 'bat:-', 'bb:TN1', 'black');
    w(p, 'bb:TP50', 'bb:BP50', 'red');
    w(p, 'bb:TN49', 'bb:BN49', 'black');
    w(p, top('VCC'), rail(p, 'bb', 'TP', 10), 'red');
    w(p, bot('RESET'), rail(p, 'bb', 'BP', 13), 'red');
    w(p, bot('GND'), rail(p, 'bb', 'BN', 10), 'black');
    w(p, 'bb:A15', rail(p, 'bb', 'TP', 15), 'red');
    w(p, 'bb:A16', 'bb:D11', 'yellow');
    w(p, 'bb:A12', 'bb:J11', 'green');
    w(p, 'bb:H11', 'bb:H18', 'green');
    w(p, 'bb:J19', rail(p, 'bb', 'BN', 19), 'black');
    const ut = pin => at(p, 'bb', 'u', pin, 'A'),
      ub = (pin, row = 'J') => at(p, 'bb', 'u', pin, row);
    w(p, ut('VDD'), rail(p, 'bb', 'TP', 30), 'red');
    w(p, ub('VSS'), rail(p, 'bb', 'BN', 37), 'black');
    w(p, ut('CE'), rail(p, 'bb', 'TN', 33), 'black');
    w(p, ut('MR'), rail(p, 'bb', 'TN', 31), 'black');
    w(p, 'bb:I12', ut('CLK').replace(':A', ':B'), 'yellow');
    const anode = i => at(p, 'bb', 'bar', 'A' + i, 'J'),
      cath = i => at(p, 'bb', 'bar', 'K' + i, 'A');
    for (let i = 1; i <= 10; i++) w(p, cath(i), rail(p, 'bb', 'TN', +cath(i).slice(4)), 'black');
    const q = ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9'],
      rows = 'GHIJ';
    q.forEach((pin, i) => {
      const t = terminals(get(p, 'u')).find(t => t.id === pin),
        topRow = t.p[2] < 0;
      w(
        p,
        topRow ? ut(pin).replace(':A', ':' + 'BCD'[i % 3]) : ub(pin, rows[i % 4]),
        anode(i + 1).replace(':J', ':' + (topRow ? 'G' : rows[(i + 1) % 4])),
        ['orange', 'yellow', 'green', 'blue', 'purple', 'white', 'gray', 'orange', 'yellow', 'green'][i]
      );
    });
    return done(p, {position: [0, 190, 170], target: [0, 0, 0]});
  }
);
def(
  'half-adder',
  'Half adder with logic gates',
  'No microcontroller',
  'Beginner',
  ['74HC86', '74HC08', 'Truth table'],
  'Two buttons are the inputs A and B (10 kΩ pull-downs keep them LOW when released). XOR gives the sum bit and AND gives the carry bit: 1 + 1 = 10 in binary.',
  () => {
    const p = base('Half adder with logic gates');
    add(p, 'bbfull', 'bb', [0, 0, 0]);
    add(p, 'aapack', 'bat', [-125, 0, -5], {cells: 3});
    on(p, 'button', 'ba', 'bb', 'E5');
    on(p, 'resistor', 'pa', 'bb', 'I7', {resistance: 10000});
    on(p, 'button', 'bb2', 'bb', 'E14');
    on(p, 'resistor', 'pb', 'bb', 'I16', {resistance: 10000});
    on(p, 'hc86', 'x', 'bb', 'F25');
    on(p, 'hc08', 'a', 'bb', 'F40');
    on(p, 'resistor', 'rs', 'bb', 'G52', {resistance: 330});
    on(p, 'led', 'sum', 'bb', 'H56', {color: '#34c759'});
    on(p, 'resistor', 'rc', 'bb', 'B52', {resistance: 330});
    on(p, 'led', 'carry', 'bb', 'C56', {color: '#ff3b30'});
    w(p, 'bat:+', 'bb:TP1', 'red');
    w(p, 'bat:-', 'bb:TN1', 'black');
    w(p, 'bb:TP50', 'bb:BP50', 'red');
    w(p, 'bb:TN49', 'bb:BN49', 'black');
    w(p, 'bb:A5', rail(p, 'bb', 'TP', 5), 'red');
    w(p, 'bb:J11', rail(p, 'bb', 'BN', 11), 'black');
    w(p, 'bb:A14', rail(p, 'bb', 'TP', 14), 'red');
    w(p, 'bb:J20', rail(p, 'bb', 'BN', 20), 'black');
    const xt = pin => at(p, 'bb', 'x', pin, 'A'),
      xb = (pin, r = 'J') => at(p, 'bb', 'x', pin, r),
      at2 = pin => at(p, 'bb', 'a', pin, 'A'),
      ab = (pin, r = 'J') => at(p, 'bb', 'a', pin, r);
    w(p, xt('VCC'), rail(p, 'bb', 'TP', 25), 'red');
    w(p, xb('GND'), rail(p, 'bb', 'BN', 31), 'black');
    w(p, at2('VCC'), rail(p, 'bb', 'TP', 40), 'red');
    w(p, ab('GND'), rail(p, 'bb', 'BN', 46), 'black');
    w(p, 'bb:G7', xb('1A'), 'yellow');
    w(p, 'bb:H7', ab('1A'), 'yellow');
    w(p, 'bb:G16', xb('1B'), 'blue');
    w(p, 'bb:H16', ab('1B'), 'blue');
    w(p, xb('1Y', 'I'), 'bb:J52', 'green');
    w(p, 'bb:J57', rail(p, 'bb', 'BN', 57), 'black');
    w(p, ab('1Y', 'I'), 'bb:D52', 'orange');
    w(p, 'bb:A57', rail(p, 'bb', 'TN', 57), 'black');
    // CMOS inputs must never float: tie every unused gate input to ground.
    for (const id of ['x', 'a'])
      for (const pin of ['2A', '2B', '3A', '3B', '4A', '4B']) {
        const t = terminals(get(p, id)).find(t => t.id === pin),
          top = t.p[2] < 0;
        w(
          p,
          at(p, 'bb', id, pin, top ? 'D' : 'G'),
          rail(p, 'bb', top ? 'TN' : 'BN', +at(p, 'bb', id, pin, 'A').slice(4)),
          'black'
        );
      }
    return done(p, {position: [0, 190, 170], target: [0, 0, 0]});
  }
);
