/** Digital pins: modes, reads and writes, pulse timing and bit-banged shift registers. Called as handler.call(simulator, args, name). */
export const gpioApi = {
  pinMode(a) {
    const prof = this.profile,
      pin = a[0];
    const mode = a[1];
    if (![0, 1, 2, 3, 4].includes(mode)) throw Error('Invalid GPIO mode.');
    if (prof.inputOnly.includes(pin) && mode !== 0)
      throw Error(`GPIO ${pin} is input-only and has no internal pull resistors.`);
    if (prof.adc.analogOnly?.includes(pin))
      this.warn(`${this.pinName(pin)} is analog-only on ${prof.name}; pinMode() has no effect.`);
    if (prof.family === 'esp8266' && pin === 16 && mode === 2)
      this.warn(
        'GPIO 16 (D0) has no internal pull-up on the ESP8266; use INPUT_PULLDOWN_16 or an external resistor.'
      );
    const s = this.pin(pin);
    s.mode = mode;
    delete s.dac;
    if (mode !== 1) {
      delete s.duty;
      delete s.servo;
    }
    return 0;
  },
  digitalWrite(a) {
    const prof = this.profile,
      pin = a[0];
    const s = this.pin(pin);
    if (s.mode !== 1) {
      if (prof.family === 'avr' && s.mode !== 1) {
        s.mode = a[1] ? 2 : 0;
        this.warn(
          `digitalWrite(${this.pinName(pin)}) on an INPUT pin toggles its internal pull-up on AVR. Call pinMode(${pin}, OUTPUT) first.`
        );
        return 0;
      }
      this.warn(`digitalWrite(${pin}): set pinMode(${pin}, OUTPUT) first.`);
      return 0;
    }
    s.value = a[1] ? 1 : 0;
    delete s.duty;
    delete s.servo;
    return 0;
  },
  digitalRead(a) {
    const pin = a[0];
    return this.read(pin);
  },
  pulseIn(a) {
    const pin = a[0];
    return this.pulseWait(pin, a[1], a[2]);
  },
  shiftOut(a) {
    const [data, clock, order, value] = a;
    for (let i = 0; i < 8; i++) {
      const bit = order === 0 ? (value >> i) & 1 : (value >> (7 - i)) & 1;
      const d = this.pin(data),
        ck = this.pin(clock);
      if (d.mode !== 1 || ck.mode !== 1)
        this.warn('shiftOut(): set pinMode(dataPin, OUTPUT) and pinMode(clockPin, OUTPUT) first.');
      Object.assign(d, {mode: 1, value: bit});
      delete d.duty;
      Object.assign(ck, {mode: 1, value: 0});
      this.circuit.step(this, this.time);
      ck.value = 1;
      this.circuit.step(this, this.time);
      ck.value = 0;
      this.circuit.step(this, this.time);
    }
    return 0;
  },
  shiftIn(a) {
    const [data, clock, order] = a;
    let v = 0;
    for (let i = 0; i < 8; i++) {
      Object.assign(this.pin(clock), {mode: 1, value: 1});
      this.circuit.step(this, this.time);
      const bit = this.read(data);
      if (order === 0) v |= bit << i;
      else v = (v << 1) | bit;
      this.pin(clock).value = 0;
      this.circuit.step(this, this.time);
    }
    return v;
  },
};

// same behaviour, other names
Object.assign(gpioApi, {pulseInLong: gpioApi['pulseIn']});
