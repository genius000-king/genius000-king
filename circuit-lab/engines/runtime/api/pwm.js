/** PWM (analogWrite, ESP32 LEDC) and square-wave tones. Called as handler.call(simulator, args, name). */
export const pwmApi = {
  analogWriteResolution(a) {
    const bits = a[0];
    this.pwmBits = Math.max(1, Math.min(16, bits));
    return 0;
  },
  analogWriteRange(a) {
    const range = a[0];
    this.pwmRange = range;
    return 0;
  },
  analogWriteFreq(a) {
    const hz = a[0];
    this.pwmFreq = hz;
    return 0;
  },
  analogWrite(a) {
    const prof = this.profile,
      pin = a[0];
    if (prof.inputOnly.includes(pin)) throw Error(`GPIO ${pin} is input-only.`);
    const s = this.pin(pin);
    const max = this.pwmRange ?? (1 << this.pwmBits) - 1,
      v = Math.max(0, Math.min(max, a[1]));
    const pwmOk = prof.pwm === 'all' ? !prof.noPwm?.includes(pin) : prof.pwm.includes(pin);
    if (prof.family === 'avr') {
      s.mode = 1;
      if (v === 0 || v === max || !pwmOk) {
        if (!pwmOk && v > 0 && v < max)
          this.warn(
            `${this.pinName(pin)} has no PWM on ${prof.name}: analogWrite(${v}) becomes ${v < 128 ? 'LOW' : 'HIGH'}. PWM pins: ${prof.pwm.join(', ')}.`
          );
        s.value = v >= 128 ? 1 : 0;
        delete s.duty;
        return 0;
      }
      if (this.servoTimer && [9, 10].includes(pin))
        this.warn('The Servo library uses Timer1 on AVR: analogWrite() on pins 9 and 10 stops working.');
    } else if (!pwmOk) throw Error(`${this.pinName(pin)} cannot output PWM on ${prof.name}.`);
    s.mode = 1;
    s.duty = v / max;
    s.value = s.duty > 0.5 ? 1 : 0;
    s.frequency = this.pwmFreq ?? (prof.pwmFast?.includes(pin) ? 980 : prof.pwmFreq);
    delete s.servo;
    return 0;
  },
  ledcWrite(a) {
    const prof = this.profile,
      pin = a[0];
    if (prof.inputOnly.includes(pin)) throw Error(`GPIO ${pin} is input-only.`);
    const target = this.channels[pin] ?? pin;
    const state = this.pin(target);
    state.mode = 1;
    state.duty = Math.max(0, Math.min(1, a[1] / ((1 << (state.bits ?? 8)) - 1)));
    state.value = state.duty > 0.5 ? 1 : 0;
    state.frequency ??= 1000;
    return 1;
  },
  ledcAttach(a) {
    const prof = this.profile,
      pin = a[0];
    if (prof.inputOnly.includes(pin)) throw Error(`GPIO ${pin} is input-only.`);
    if (a[1] <= 0 || a[2] < 1 || a[2] > 16)
      throw Error('PWM requires positive frequency and 1–16 resolution bits.');
    Object.assign(this.pin(pin), {mode: 1, frequency: a[1], bits: a[2], duty: 0});
    return 1;
  },
  ledcSetup(a) {
    const pin = a[0];
    this.pwmSetup[pin] = {frequency: a[1], bits: a[2]};
    return a[1];
  },
  ledcAttachPin(a) {
    const pin = a[0];
    this.channels[a[1]] = pin;
    Object.assign(this.pin(pin), {mode: 1, ...this.pwmSetup[a[1]], duty: 0});
    return 0;
  },
  tone(a, name) {
    const prof = this.profile,
      pin = a[0];
    if (prof.inputOnly.includes(pin)) throw Error(`GPIO ${pin} is input-only.`);
    if (a[1] < 31 && name === 'tone' && prof.family === 'avr')
      throw Error('tone() frequency must be at least 31 Hz on AVR.');
    Object.assign(this.pin(pin), {mode: 1, duty: a[1] > 0 ? 0.5 : 0, frequency: a[1]});
    delete this.pin(pin).servo;
    if (a[2] > 0) this.toneEnds[pin] = this.time + a[2];
    return a[1];
  },
  noTone(a) {
    const pin = a[0];
    const s = this.pin(pin);
    delete s.duty;
    s.value = 0;
    delete this.toneEnds[pin];
    return 0;
  },
};

// same behaviour, other names
Object.assign(pwmApi, {ledcWriteTone: pwmApi['tone']});
