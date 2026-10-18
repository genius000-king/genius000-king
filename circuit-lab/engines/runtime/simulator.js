import {profileOf, isBoard} from '../catalog/boards.js';
import {ref} from '../catalog/types.js';
import {electricalSignature, Circuit} from '../circuit/circuit.js';
import {compile} from '../firmware/codegen.js';
import {VM} from '../firmware/vm.js';
import {mixin} from '../shared/mixin.js';
import {apiMethods} from './api.js';
import {busMethods} from './bus.js';
import {librariesMethods} from './libraries.js';
import {netApiMethods} from './net-api.js';
import {pinsMethods} from './pins.js';
import {serialMethods} from './serial.js';
import {timingMethods} from './timing.js';

export const READ_ONLY = new Set([
  'digitalRead',
  'analogRead',
  'analogReadMilliVolts',
  'millis',
  'micros',
  'pulseIn',
  'pulseInLong',
  'min',
  'max',
  'abs',
  'sq',
  'sqrt',
  'pow',
  'sin',
  'cos',
  'tan',
  'map',
  'constrain',
  'random',
  'Serial.available',
  'Serial.read',
  'Serial.print',
  'Serial.println',
  'String.length',
  'String.toInt',
  'String.charAt',
  'String.indexOf',
  'String.substring',
  'bitRead',
  'DHT.readTemperature',
  'DHT.readHumidity',
  'Wire.read',
  'Wire.available',
  'UDP.parsePacket',
  'WiFi.status',
]);

export class Simulator {
  constructor(project, boardId = null, sharedCircuit = null) {
    this.boardId = boardId;
    this.project = project;
    this.signature = electricalSignature(project);
    this.circuit = sharedCircuit ?? new Circuit(project);
    this.time = 0;
    this.running = false;
    this.logs = [];
    this.transactions = [];
    this.warnings = [];
    this.gpio = {};
    this.vm = null;
    this.program = null;
    this.oled = {address: 60, text: '', screens: {}, gfx: {}};
    this.lcd = {address: 39, text: '', cursor: 0};
    this.interrupts = {};
    this.timers = {};
    this.timerId = 0;
    this.seed = 12345;
    this.trace = [];
    this.boot = 'idle';
    this.eeprom = new Array(4096).fill(255);
    this.resetPeripherals();
    if (!sharedCircuit) this.circuit.step(this, 0);
  }
  get profile() {
    return profileOf(this.board()) ?? profileOf('board');
  }
  get uart() {
    return this.uarts.Serial.q;
  }
  resetPeripherals() {
    const prof = this.profile;
    this.adcBits = prof.adc.bits;
    this.adcRange = prof.adc.vref;
    this.adcRef = 'DEFAULT';
    this.pwmBits = 8;
    this.pwmRange = null;
    this.pwmFreq = null;
    this.i2c = {sda: prof.i2c[0], scl: prof.i2c[1], address: null, buffer: [], read: [], begun: false};
    this.objects = [];
    this.uarts = {};
    for (const [name, u] of Object.entries(prof.uarts))
      this.uarts[name] = {name, ...u, baud: 0, q: [], busyUntil: 0};
    this.uartActivity = {};
    this.watchers = [];
    this.toneEnds = {};
    this.channels = {};
    this.pwmSetup = {};
    this.spi = null;
    this.irqEnabled = true;
  }
  update(project) {
    this.project = project;
    this.circuit.project = project;
    const signature = electricalSignature(project);
    if (signature !== this.signature) {
      this.signature = signature;
      this.circuit.rebuild();
      this.circuit.step(this, this.time);
    }
  }
  log(text, kind = 'serial') {
    this.logs.push({time: this.time, text: String(text), kind});
    if (this.logs.length > 400) this.logs.shift();
  }
  stream(text, kind, prefix = '') {
    const parts = String(text).replace(/\r/g, '').split('\n');
    parts.forEach((part, i) => {
      const last = this.logs.at(-1);
      if (i === 0 && last?.open && last.kind === kind && last.prefix === prefix) {
        last.text += part;
      } else if (part.length || i < parts.length - 1) {
        this.logs.push({time: this.time, text: prefix + part, kind, prefix, open: true});
        if (this.logs.length > 400) this.logs.shift();
      }
      if (i < parts.length - 1) {
        const l = this.logs.at(-1);
        if (l) l.open = false;
      }
    });
  }
  warn(message) {
    if (!this.warnings.includes(message)) {
      this.warnings.push(message);
      if (this.warnings.length > 60) this.warnings.shift();
      this.log(message, 'warning');
    }
  }
  compile(source) {
    this.program = compile(source, {profile: this.profile});
    this.log(
      `Compiled ${this.program.size} bytecode instructions · ${this.profile.name} · Lab Arduino subset`,
      'compile'
    );
    return this.program;
  }
  reset() {
    this.gpio = {};
    this.time = 0;
    this.seed = 12345;
    this.interrupts = {};
    this.timers = {};
    this.resetPeripherals();
    this.vm = this.program ? new VM(this.program, this) : null;
    this.oled.text = '';
    this.oled.screens = {};
    this.oled.gfx = {};
    this.lcd = {address: 39, text: '', cursor: 0};
    this.warnings = [];
    this.trace = [];
    this.boot = this.vm ? 'ready' : 'idle';
    if (this.circuit.sharedHardware === undefined) this.circuit.resetState();
    this.circuit.step(this, 0);
  }
  start() {
    if (!this.program) throw Error('Compile a supported sketch first.');
    this.reset();
    this.running = true;
    this.boot = this.bootState();
    this.log(`Firmware uploaded to the Lab bytecode VM (${this.profile.name}).`, 'system');
  }
  bootState() {
    const b = this.board();
    if (!b) return 'running';
    const prof = this.profile,
      v = id => this.circuit.voltage(ref(b, id));
    if (prof.strap === 'esp32') {
      if (v('IO12') > 2.475) {
        this.warn('GPIO 12 strap is HIGH: the selected 3.3 V flash cannot boot with a 1.8 V flash strap.');
        return 'invalid boot strap';
      }
      if (v('IO0') < 0.825) {
        if (v('IO2') < 0.825) return 'download mode';
        this.warn('GPIO 0 LOW requires GPIO 2 LOW to enter download mode.');
        return 'invalid boot strap';
      }
    }
    if (prof.strap === 'esp8266') {
      if (v('D8') > 2) {
        this.warn('GPIO 15 (D8) is HIGH at reset: the ESP8266 tries to boot from an SD card and stalls.');
        return 'invalid boot strap';
      }
      if (v('D3') < 0.8) return 'download mode';
      if (v('D4') < 0.8) {
        this.warn('GPIO 2 (D4) must be HIGH at reset.');
        return 'invalid boot strap';
      }
    }
    return 'running';
  }
  stop() {
    this.running = false;
    this.boot = 'stopped';
  }
  board() {
    return this.project.components.find(c => isBoard(c) && (!this.boardId || c.id === this.boardId));
  }
  tick(ms = 1) {
    try {
      for (let t = 0; t < ms; t++) {
        this.circuit.step(this, this.time);
        const board = this.board(),
          prof = this.profile;
        if (board && this.circuit.voltage(ref(board, prof.reset)) < 0.8) {
          if (this.boot !== 'reset held') {
            this.gpio = {};
            this.resetPeripherals();
          }
          this.boot = 'reset held';
          this.vm = null;
          this.time++;
          continue;
        }
        if (this.boot === 'reset held') {
          this.vm = this.program ? new VM(this.program, this) : null;
          this.boot = this.bootState();
        }
        if (this.boot === 'download mode' || this.boot === 'invalid boot strap') {
          this.time++;
          continue;
        }
        for (const [pin, end] of Object.entries(this.toneEnds))
          if (this.time >= end) {
            const s = this.gpio[pin];
            if (s) {
              delete s.duty;
              s.value = 0;
            }
            delete this.toneEnds[pin];
          }
        this.vm?.run(this.time);
        if (this.restartRequested) {
          this.restartRequested = false;
          this.gpio = {};
          this.resetPeripherals();
          this.vm = new VM(this.program, this);
        }
        this.circuit.step(this, this.time);
        this.checkWatchers();
        if (this.irqEnabled)
          for (const [pin, v] of Object.entries(this.interrupts)) {
            const next = this.read(Number(pin));
            if (next !== v.last && (v.mode === 1 || (v.mode === 2 && next) || (v.mode === 3 && !next)))
              this.vm?.callback(v.fn);
            v.last = next;
          }
        for (const timer of Object.values(this.timers))
          if (this.time >= timer.next) {
            this.vm?.callback(timer.fn);
            timer.next += timer.period;
          }
        if (!this.world) this.deliverUart([this]);
        this.time++;
        if (this.time % 10 === 0) {
          this.trace.push({t: this.time, v: this.voltageAt(prof.constants?.LED_BUILTIN ?? 2)});
          if (this.trace.length > 200) this.trace.shift();
        }
      }
    } catch (e) {
      this.running = false;
      this.boot = 'runtime error';
      this.log(e.message, 'error');
      this.warn(e.message);
    }
  }
  snapshot() {
    return {
      ...this.circuit.snapshot(),
      time: this.time,
      running: this.running,
      boot: this.boot,
      gpio: this.gpio,
      logs: this.logs,
      transactions: this.transactions,
      warnings: this.warnings,
      oled: this.oled.screens,
      gfx: this.oled.gfx,
      trace: this.trace,
      instructions: this.vm?.instructions ?? 0,
    };
  }
}

mixin(
  Simulator,
  pinsMethods,
  busMethods,
  serialMethods,
  librariesMethods,
  timingMethods,
  netApiMethods,
  apiMethods
);
