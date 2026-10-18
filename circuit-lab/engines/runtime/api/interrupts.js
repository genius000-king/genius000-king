/** Pin-change interrupts and global interrupt masking. Called as handler.call(simulator, args, name). */
export const interruptsApi = {
  digitalPinToInterrupt(a) {
    const prof = this.profile,
      pin = a[0];
    return prof.interrupts === 'all'
      ? prof.noInterrupt?.includes(pin)
        ? -1
        : pin
      : (prof.interrupts[pin] ?? -1);
  },
  attachInterrupt(a) {
    const prof = this.profile,
      pin = a[0];
    let p = pin;
    if (prof.interrupts !== 'all') {
      p = Object.entries(prof.interrupts).find(([, n]) => n === pin)?.[0];
      if (p === undefined)
        throw Error(
          `Interrupt ${pin} does not exist on ${prof.name}. Use attachInterrupt(digitalPinToInterrupt(${Object.keys(prof.interrupts).join(' or ')}), …).`
        );
      p = Number(p);
    }
    if (p < 0 || prof.noInterrupt?.includes(p))
      throw Error(`${this.pinName(p)} has no external interrupt on ${prof.name}.`);
    this.pin(p);
    if (!this.program.funcs[a[1]]) throw Error('Interrupt callback is not a compiled function.');
    this.interrupts[p] = {fn: a[1], mode: a[2], last: this.read(p)};
    return 0;
  },
  detachInterrupt(a) {
    const prof = this.profile,
      pin = a[0];
    let p = pin;
    if (prof.interrupts !== 'all')
      p = Number(Object.entries(prof.interrupts).find(([, n]) => n === pin)?.[0]);
    delete this.interrupts[p];
    return 0;
  },
  interrupts(a) {
    this.irqEnabled = true;
    return 0;
  },
  noInterrupts(a) {
    this.irqEnabled = false;
    return 0;
  },
};
