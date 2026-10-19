import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePlotLine, plotSeries, toVcd, toCsv, memoryReport} from '../engines/instruments/index.js';
import {compile} from '../engines/firmware/index.js';
import {PROFILES} from '../engines/catalog/boards.js';

test('serial plotter lines follow the Arduino IDE format', () => {
  assert.deepEqual(parsePlotLine('512'), {'value 1': 512});
  assert.deepEqual(parsePlotLine('1.5 2,3\t4'), {'value 1': 1.5, 'value 2': 2, 'value 3': 3, 'value 4': 4});
  assert.deepEqual(parsePlotLine('temp:21.5 hum:40'), {temp: 21.5, hum: 40});
  assert.equal(parsePlotLine('Hello, Circuit Lab.'), null);
  assert.equal(parsePlotLine(''), null);
  const logs = [
    {kind: 'system', text: 'Firmware uploaded', time: 0},
    {kind: 'serial', text: 'a:1 b:2', time: 10},
    {kind: 'serial', text: 'Light on', time: 20},
    {kind: 'serial', text: 'a:3', time: 30},
    {kind: 'serial', text: 'a:9 b:', time: 40, open: true}, // still arriving
  ];
  assert.deepEqual(plotSeries(logs), {times: [10, 30], series: {a: [1, 3], b: [2, null]}});
});

test('logic capture exports as VCD with only the changes', () => {
  const vcd = toVcd({t: [0, 0.5, 1, 1.5], v: [[0b01], [0b01], [0b11], [0b10]]}, {channels: 2, date: 'x'});
  assert.match(vcd, /\$timescale 1 us \$end/);
  assert.match(vcd, /\$var wire 1 ! D0 \$end\n\$var wire 1 " D1 \$end/);
  const body = vcd.split('$enddefinitions $end\n')[1];
  assert.equal(body, '#0\n$dumpvars\n1!\n0"\n$end\n#1000\n1"\n#1500\n0!\n#1500\n');
});

test('scope capture exports as CSV', () => {
  assert.equal(
    toCsv({
      t: [0, 0.1],
      v: [
        [1, 2],
        [3, 4],
      ],
    }),
    'time (ms),CH1 (V),CH2 (V)\n0,1,2\n0.1,3,4\n'
  );
});

test('memory report counts globals in board-sized types and the AVR core buffers', () => {
  const uno = PROFILES.uno ?? Object.values(PROFILES).find(b => b.family === 'avr' && b.ramBytes === 2048);
  const src =
    'const int LED = 13;\nint x;\nfloat f[10];\nchar msg[] = "hello";\nlong readings[200];\nvoid setup(){ Serial.begin(9600); }\nvoid loop(){}';
  const r = memoryReport(compile(src, {profile: uno}), uno);
  // 2 + 40 + 6 + 800 = 848 sketch bytes; + 9 core + 175 Serial
  assert.equal(r.used, 848 + 9 + 175);
  assert.equal(r.max, 2048);
  assert.equal(r.percent, 50);
  assert.equal(r.items[0].name, 'readings');
  assert.equal(r.warning, null);
  const heavy = memoryReport(compile(src.replace('[200]', '[400]'), {profile: uno}), uno);
  assert.ok(heavy.percent > 75 && heavy.warning);
  const esp = Object.values(PROFILES).find(b => b.family === 'esp32');
  assert.equal(
    memoryReport(compile(src, {profile: esp}), esp).used,
    4 + 40 + 6 + 800,
    'int is 4 bytes; no AVR buffers'
  );
});
