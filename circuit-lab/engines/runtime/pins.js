import {ref} from '../catalog/types.js';

// Simulator methods: pinName, pin, node, voltageAt, settle, read, analogPin, adcRead
export const pinsMethods = {
  pinName(pin) {
    const t = this.profile.pins.find(t => t.gpio === pin);
    return t ? t.label : `GPIO ${pin}`;
  },
  pin(pin) {
    const prof = this.profile;
    if (
      !Number.isInteger(pin) ||
      pin < 0 ||
      pin > prof.maxPin ||
      prof.invalid.includes(pin) ||
      (prof.family === 'stm32' && pin > 31 && pin < 45)
    )
      throw Error(
        prof.family === 'esp32'
          ? `GPIO ${pin} is unavailable on this module.`
          : `Pin ${pin} does not exist on ${prof.name}.`
      );
    if (prof.reserved.includes(pin)) throw Error(`GPIO ${pin} is reserved for SPI flash.`);
    return this.gpio[pin] ?? (this.gpio[pin] = {mode: 0, value: 0});
  },
  node(pin) {
    const board = this.board();
    if (!board) return '';
    const t = this.profile.pins.find(t => t.gpio === pin);
    return t ? ref(board, t.id) : '';
  },
  voltageAt(pin) {
    const n = this.node(pin);
    if (n) return this.circuit.voltage(n);
    const s = this.gpio[pin];
    return s?.mode === 1 ? this.profile.logic * (s.duty ?? s.value ?? 0) : 0;
  },
  settle() {
    if (this.dirty) {
      this.dirty = false;
      this.circuit.step(this, this.time);
    }
  },
  read(pin) {
    const prof = this.profile;
    this.pin(pin);
    this.settle();
    if (prof.adc.analogOnly?.includes(pin)) {
      this.warn(
        `${this.pinName(pin)} is analog-only on ${prof.name}; digitalRead() always returns 0. Use analogRead().`
      );
      return 0;
    }
    const v = this.voltageAt(pin);
    if (v > prof.vil && v < prof.vih)
      this.warn(`GPIO ${pin}: ${v.toFixed(2)} V is in the undefined digital input region.`);
    return v >= prof.vih ? 1 : 0;
  },
  analogPin(pin) {
    const a = this.profile.adc;
    if (a.channelBase !== undefined && pin < a.pins.length) pin = a.channelBase + pin;
    if (!a.pins.includes(pin))
      throw Error(
        this.profile.family === 'esp32'
          ? `GPIO ${pin} has no ADC channel.`
          : `${this.pinName(pin)} is not an analog input on ${this.profile.name}.`
      );
    return pin;
  },
  adcRead(pin, mv = false) {
    const prof = this.profile,
      a = prof.adc;
    pin = this.analogPin(pin);
    this.pin(pin);
    if (
      prof.family === 'esp32' &&
      [4, 0, 2, 15, 13, 12, 14, 27, 25, 26].includes(pin) &&
      (this.network?.nodes?.get(this.board().id)?.mode ?? 'off') !== 'off'
    ) {
      this.warn(
        `GPIO ${pin} is on ADC2, which cannot be read while Wi-Fi is active. Use an ADC1 pin (32–39).`
      );
      return 0;
    }
    let vref = this.adcRange;
    if (prof.family === 'avr') {
      vref =
        this.adcRef === 'INTERNAL'
          ? 1.1
          : this.adcRef === 'EXTERNAL'
            ? Math.max(0.1, this.circuit.voltage(ref(this.board(), 'AREF')))
            : this.circuit.voltage(ref(this.board(), '5V')) || 5;
    }
    this.settle();
    const volts = Math.max(0, Math.min(vref, this.voltageAt(pin)));
    if (mv) return Math.round(volts * 1000);
    const max = (1 << this.adcBits) - 1;
    return prof.family === 'avr' || prof.family === 'esp8266'
      ? Math.min(max, Math.floor((volts / vref) * (max + 1)))
      : Math.round((volts / vref) * max);
  },
};
