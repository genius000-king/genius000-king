/** Servo: 50 Hz pulses of 544–2400 µs on one pin; AVR boards lose PWM on pins 9 and 10. Called as handler.call(simulator, o, args, method, cls, a). */
export const servoMethods = {
  'Servo.attach'(o, args) {
    const pin = args[0];
    this.pin(pin);
    if (
      this.profile.family === 'avr' &&
      this.objects.filter(x => x.cls === 'Servo' && x.pin !== null).length === 0
    )
      this.servoTimer = true;
    o.pin = pin;
    o.min = args[1] ?? 544;
    o.max = args[2] ?? 2400;
    o.us = 1500;
    Object.assign(this.pin(pin), {mode: 1, servo: 1500, frequency: 50, duty: 1500 / 20000, value: 0});
    return 1;
  },
  'Servo.write'(o, args, method) {
    if (o.pin === null) {
      this.warn('Servo.write() before attach(): no pulse is generated.');
      return 0;
    }
    let us =
      method === 'write' && args[0] < 200
        ? o.min + ((o.max - o.min) * Math.max(0, Math.min(180, args[0]))) / 180
        : args[0];
    us = Math.max(o.min, Math.min(o.max, us));
    o.us = us;
    Object.assign(this.pin(o.pin), {servo: us, duty: us / 20000, frequency: 50, mode: 1});
    return 0;
  },
  'Servo.read'(o) {
    return o.pin === null ? 0 : Math.round(((o.us - o.min) / (o.max - o.min)) * 180);
  },
  'Servo.readMicroseconds'(o) {
    return o.us ?? 0;
  },
  'Servo.attached'(o) {
    return o.pin !== null ? 1 : 0;
  },
  'Servo.detach'(o) {
    if (o.pin !== null) {
      const s = this.pin(o.pin);
      delete s.servo;
      delete s.duty;
      s.value = 0;
    }
    o.pin = null;
    return 0;
  },
};

// same behaviour, other names
Object.assign(servoMethods, {'Servo.writeMicroseconds': servoMethods['Servo.write']});
