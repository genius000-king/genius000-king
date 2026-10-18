/** ADC reads in the board’s resolution and attenuation, and the ESP32 DAC. Called as handler.call(simulator, args, name). */
export const analogApi = {
  analogRead(a) {
    const pin = a[0];
    return this.adcRead(pin);
  },
  analogReadMilliVolts(a) {
    const pin = a[0];
    return this.adcRead(pin, true);
  },
  analogReadResolution(a) {
    const prof = this.profile,
      bits = a[0];
    if (bits < (prof.adc.minBits ?? 9) || bits > (prof.adc.maxBits ?? 12))
      throw Error(
        `ADC resolution must be ${prof.adc.minBits ?? 9}–${prof.adc.maxBits ?? 12} bits on ${prof.name}.`
      );
    this.adcBits = bits;
    return 0;
  },
  analogSetAttenuation(a) {
    const attenuation = a[0];
    this.adcRange = [1.1, 1.5, 2.2, 3.3][attenuation] ?? 3.3;
    return 0;
  },
  analogReference(a) {
    const reference = a[0];
    this.adcRef = reference === 3 ? 'INTERNAL' : reference === 0 ? 'EXTERNAL' : 'DEFAULT';
    return 0;
  },
  dacWrite(a) {
    const prof = this.profile,
      pin = a[0];
    if (!prof.dac?.includes(pin))
      throw Error(`GPIO ${pin} has no DAC. ESP32 DAC outputs are GPIO 25 and 26.`);
    Object.assign(this.pin(pin), {mode: 5, dac: (Math.max(0, Math.min(255, a[1])) / 255) * prof.logic});
    return 0;
  },
};
