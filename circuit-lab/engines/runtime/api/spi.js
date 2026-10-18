/** SPI master: transfers to the shift registers and SPI devices on the bus. Called as handler.call(simulator, args, name). */
export const spiApi = {
  'SPI.begin'(a) {
    const prof = this.profile;
    this.spi = {sck: a[0] ?? prof.spi.sck, miso: a[1] ?? prof.spi.miso, mosi: a[2] ?? prof.spi.mosi};
    return 0;
  },
  'SPI.beginTransaction'(a) {
    return 0;
  },
  'SPI.transfer'(a) {
    const value = a[0];
    if (!this.spi) throw Error('Call SPI.begin first.');
    this.warn(
      'SPI is a logical edge model. External SPI slave devices and cycle-accurate timing are unsupported.'
    );
    let received = 0;
    for (let bit = 7; bit >= 0; bit--) {
      Object.assign(this.pin(this.spi.mosi), {mode: 1, value: (value >> bit) & 1});
      Object.assign(this.pin(this.spi.sck), {mode: 1, value: 0});
      this.circuit.step(this, this.time);
      this.pin(this.spi.sck).value = 1;
      this.circuit.step(this, this.time);
      received = (received << 1) | this.read(this.spi.miso);
    }
    this.pin(this.spi.sck).value = 0;
    this.circuit.step(this, this.time);
    return received;
  },
};

// same behaviour, other names
Object.assign(spiApi, {
  'SPI.endTransaction': spiApi['SPI.beginTransaction'],
  'SPI.end': spiApi['SPI.beginTransaction'],
});
