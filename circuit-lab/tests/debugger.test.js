import test from 'node:test';
import assert from 'node:assert/strict';
import {LabWorld} from '../engines/runtime/index.js';
import {newProject} from '../engines/workspace/project.js';
import {codeLines} from '../engines/firmware/index.js';

const SOURCE = `int count = 0;
float level = 0.5;

int twice(int v) {
  int r = v * 2;
  return r;
}

void setup() {
  pinMode(2, OUTPUT);
}

void loop() {
  count = twice(count + 1);
  level = level / 2;
  delay(10);
}
`;

function world(lines = []) {
  const p = newProject();
  p.files = {'main.ino': SOURCE};
  const w = new LabWorld(p);
  const id = p.activeBoard ?? p.components.find(c => c.type === 'board').id;
  w.setBreakpoints(id, lines);
  w.start();
  return {w, id};
}
const runUntilHalt = (w, ms = 200) => {
  for (let i = 0; i < ms && w.running; i++) w.tick(1);
  return w.halted;
};

test('a breakpoint halts the bench at that line with the variables in view', () => {
  const {w} = world([14]);
  assert.ok(runUntilHalt(w), 'halted');
  const info = w.inspect();
  assert.equal(info.line, 14);
  assert.equal(info.reason, 'breakpoint');
  assert.equal(info.frames[0].fn, 'loop');
  assert.deepEqual(
    info.globals.map(g => [g.name, g.type, g.value]),
    [
      ['count', 'int', '0'],
      ['level', 'float', '0.5'],
    ]
  );
  assert.equal(w.running, false);
});

test('step into, step over, step out and continue', () => {
  const {w} = world([14]);
  runUntilHalt(w);
  w.debugAction('into');
  runUntilHalt(w);
  let info = w.inspect();
  assert.equal(info.line, 5, 'into twice()');
  assert.deepEqual(
    info.frames.map(f => f.fn),
    ['twice', 'loop']
  );
  assert.deepEqual(
    info.locals.find(l => l.name === 'v'),
    {name: 'v', type: 'int', value: '1'}
  );
  w.debugAction('over');
  runUntilHalt(w);
  info = w.inspect();
  assert.equal(info.line, 6);
  assert.equal(info.locals.find(l => l.name === 'r').value, '2');
  w.debugAction('out');
  runUntilHalt(w);
  info = w.inspect();
  assert.equal(info.frames[0].fn, 'loop');
  assert.equal(info.line, 15, 'back in loop, after the call');
  assert.equal(info.globals.find(g => g.name === 'count').value, '2');
  w.debugAction('over');
  runUntilHalt(w);
  assert.equal(w.inspect().line, 16);
  w.debugAction('continue');
  runUntilHalt(w);
  info = w.inspect();
  assert.equal(info.line, 14, 'next pass of loop()');
  assert.equal(info.globals.find(g => g.name === 'level').value, '0.25');
});

test('a breakpoint on a line without code moves to the next statement', () => {
  const {w} = world([13]); // `void loop() {`
  runUntilHalt(w);
  assert.equal(w.inspect().line, 14);
});

test('without breakpoints nothing halts, and code lines are listed', () => {
  const {w} = world([]);
  assert.equal(runUntilHalt(w, 100), null);
  assert.deepEqual(codeLines(w.active.program), [5, 6, 10, 14, 15, 16]);
});
