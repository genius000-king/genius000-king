import test from 'node:test';
import assert from 'node:assert/strict';
import {makeComponent} from '../engines/catalog/index.js';
import {Circuit} from '../engines/circuit/index.js';
import {Simulator} from '../engines/runtime/index.js';

const P = (...comps) => ({
  version: 2,
  name: 't',
  components: comps.map(([type, id, params = {}]) => {
    const c = makeComponent(type, [0, 0, 0], id);
    Object.assign(c.params, params);
    return c;
  }),
  wires: [],
  files: {'main.ino': 'void setup(){}\nvoid loop(){delay(10);}\n'},
  activeFile: 'main.ino',
  config: {precision: 5},
});
const W = (p, ...pairs) => {
  for (const [a, b] of pairs) p.wires.push({id: 'w' + p.wires.length, a, b});
  return p;
};
const near = (a, b, e, msg = '') =>
  assert.ok(Math.abs(a - b) <= e, `${msg} ${a} should be within ${e} of ${b}`);

// a 5 V lamp load on the relay contacts shows when COM–NO is closed
const relayBench = board => {
  const p = W(
    P(
      [board, 'mcu'],
      ['relaymodule', 'k'],
      ['psu', 'ps', {voltage: 5, limit: 2}],
      ['resistor', 'load', {resistance: 100}]
    ),
    ['mcu:' + (board === 'uno' ? 'D7' : 'IO26'), 'k:S'],
    ['ps:+', 'k:+'],
    ['ps:-', 'k:-'],
    ['ps:-', 'mcu:GND1'],
    ['ps:+', 'k:COM'],
    ['k:NO', 'load:A'],
    ['load:B', 'ps:-']
  );
  return p;
};
const sketch = pin =>
  `void setup(){ pinMode(${pin}, OUTPUT); }\nvoid loop(){ digitalWrite(${pin}, HIGH); delay(100); digitalWrite(${pin}, LOW); delay(100); }\n`;

test('KY-019 relay module: a GPIO pin switches it through the transistor; it pulls in and releases on time', () => {
  const p = relayBench('uno'),
    s = new Simulator(p);
  s.compile(sketch(7));
  s.start();
  let closedAt = null,
    openedAt = null;
  for (let t = 0; t < 200; t++) {
    s.tick(1);
    const k = s.circuit.components.k;
    if (closedAt === null && k.closed) closedAt = s.time;
    if (closedAt !== null && openedAt === null && !k.closed) openedAt = s.time;
  }
  assert.ok(closedAt >= 7 && closedAt <= 12, 'operate time ' + closedAt);
  assert.ok(openedAt - 100 >= 4 && openedAt - 100 <= 15, 'release time after LOW ' + (openedAt - 100));
  s.tick(30); // HIGH again
  const k = s.circuit.components.k;
  near(k.input, (5 - 0.7) / 1000, 0.0006, 'signal current from the pin');
  near(k.coil, 0.0685, 0.004, 'coil current');
  assert.ok(k.led);
  near(s.circuit.components.load.voltage, 5, 0.05, 'load powered through COM–NO');
  assert.equal(
    s.circuit.diagnostics.filter(d => /kick/.test(d.message)).length,
    0,
    'the on-board diode catches the kick'
  );
});

test('KY-019 works from a 3.3 V ESP32 pin and warns when + is not powered', () => {
  const p = relayBench('board'),
    s = new Simulator(p);
  s.compile(sketch(26));
  s.start();
  s.tick(40);
  assert.equal(s.circuit.components.k.closed, true);
  near(s.circuit.components.k.input, (3.3 - 0.7) / 1000, 0.0006);
  const bare = W(
    P(['psu', 'ps', {voltage: 5, limit: 1}], ['relaymodule', 'k']),
    ['ps:+', 'k:S'],
    ['ps:-', 'k:-']
  );
  const c = new Circuit(bare);
  for (let t = 0; t < 30; t++) c.step(null, t);
  assert.equal(c.components.k.closed, false);
  assert.ok(c.diagnostics.some(d => /no supply/.test(d.message)));
});

// 12 V solenoid low-side switched by an IRLZ44N from Uno pin 9, optionally with a flyback diode
const solenoidBench = diode =>
  W(
    P(
      ['uno', 'uno'],
      ['psu', 'ps', {voltage: 12, limit: 2}],
      ['solenoid', 'sol'],
      ['mosfet', 'q'],
      ['resistor', 'rg', {resistance: 220}],
      ...(diode ? [['diode', 'd']] : [])
    ),
    ['uno:D9', 'rg:A'],
    ['rg:B', 'q:G'],
    ['q:S', 'ps:-'],
    ['uno:GND1', 'ps:-'],
    ['ps:+', 'sol:+'],
    ['sol:-', 'q:D'],
    ...(diode
      ? [
          ['d:A', 'sol:-'],
          ['d:K', 'sol:+'],
        ]
      : [])
  );

test('JF-0530B solenoid: 300 mA at 12 V, pulls in over its 10 mm stroke, springs back', () => {
  const s = new Simulator(solenoidBench(true));
  s.compile(
    sketch(9).replace(
      'delay(100); digitalWrite(9, LOW); delay(100);',
      'delay(400); digitalWrite(9, LOW); delay(400);'
    )
  );
  s.start();
  s.tick(200);
  const sol = s.circuit.components.sol;
  near(sol.current, 0.3, 0.01, 'coil current');
  near(sol.stroke, 10, 0.2, 'pulled in');
  near(sol.force, 5, 0.4, 'pull force');
  s.tick(400); // switched off at 400 ms
  near(s.circuit.components.sol.stroke, 0, 0.5, 'spring return');
  assert.equal(s.circuit.diagnostics.filter(d => /kick/.test(d.message)).length, 0, 'diode clamps the coil');
});

test('without a flyback diode the solenoid kick is diagnosed; held on, it overheats', () => {
  const s = new Simulator(solenoidBench(false));
  s.compile(sketch(9));
  s.start();
  s.tick(150);
  assert.ok(
    s.circuit.diagnostics.some(d => /inductive kick/.test(d.message)),
    'kick when the MOSFET opens'
  );
  const held = new Simulator(solenoidBench(true));
  held.compile('void setup(){ pinMode(9, OUTPUT); digitalWrite(9, HIGH); }\nvoid loop(){ delay(10); }\n');
  held.start();
  held.tick(2600);
  assert.ok(held.circuit.diagnostics.some(d => /short pulses/.test(d.message)));
});

test('LC ringing project: rings at 1/(2π√LC) and decays with Q ≈ √(L/C)/R', async () => {
  const {projectById} = await import('../engines/projects/index.js');
  const {validateProject} = await import('../engines/workspace/index.js');
  const p = validateProject(structuredClone(projectById('lc-ringing').build())),
    c = new Circuit(p),
    v = [];
  for (let t = 0; t <= 760; t++) {
    c.step(null, t);
    if (t >= 500) v.push(c.voltage('c:+') - c.voltage('c:-'));
  }
  // a rising edge of the 2 Hz square wave arrives at t = 500 ms
  const peaks = [];
  for (let i = 1; i < v.length - 1; i++) if (v[i] > v[i - 1] && v[i] >= v[i + 1] && v[i] > 5.2) peaks.push(i);
  const period = (peaks.at(-1) - peaks[0]) / (peaks.length - 1),
    R = 50 + 5,
    f0 = 1 / (2 * Math.PI * Math.sqrt(1 * 10e-6)),
    zeta = R / 2 / Math.sqrt(1 / 10e-6);
  near(1000 / period, f0 * Math.sqrt(1 - zeta * zeta), 2.5, 'ringing frequency (Hz)');
  near(
    Math.max(...v),
    5 * (1 + Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta))),
    0.35,
    'first overshoot (V)'
  );
  assert.ok(peaks.length >= 4, 'several visible cycles: ' + peaks.length);
});
