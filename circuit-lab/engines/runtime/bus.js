import {ref} from '../catalog/types.js';
import {I2C_DEVICES, i2cAddress} from './i2c-devices.js';

// Simulator methods: wireDevices, wireDevice, transaction, devState, ensureWire
export const busMethods = {
  wireDevices() {
    const board = this.board();
    if (!board) return [];
    const out = [];
    for (const c of this.project.components) {
      const dev = I2C_DEVICES[c.type];
      if (!dev) continue;
      const r = this.circuit.components[c.id];
      if (!r?.powered) continue;
      if (!(
        this.circuit.same(this.node(this.i2c.sda), ref(c, 'SDA')) &&
        this.circuit.same(this.node(this.i2c.scl), ref(c, 'SCL')) &&
        this.circuit.same(ref(board, this.profile.gnd[0]), ref(c, 'GND')) &&
        !this.circuit.same(ref(c, 'SDA'), ref(c, 'SCL')) &&
        this.circuit.voltage(ref(c, 'SDA')) > 1.6 &&
        this.circuit.voltage(ref(c, 'SCL')) > 1.6
      ))
        continue;
      out.push(c);
    }
    return out;
  },
  wireDevice(address) {
    const found = this.wireDevices().filter(c => i2cAddress(c, this.circuit) === address);
    if (found.length > 1)
      this.warn(
        `I2C address collision at 0x${address.toString(16)}: ${found.map(c => c.name).join(' and ')} answer together; data is corrupted.`
      );
    return found.length === 1 ? found[0] : null;
  },
  transaction(address, bytes, description) {
    const device = this.wireDevice(address),
      ack = !!device;
    this.transactions.push({time: this.time, address, bytes: [...bytes].slice(0, 64), ack, description});
    if (this.transactions.length > 100) this.transactions.shift();
    if (!ack) this.warn(`I2C 0x${address.toString(16)}: NACK. Verify SDA, SCL, power, ground and address.`);
    return device;
  },
  devState(c) {
    return this.circuit.digital[c.id] ?? (this.circuit.digital[c.id] = {});
  },
  ensureWire() {
    if (!this.i2c.begun) {
      this.i2c.begun = true;
      this.pin(this.i2c.sda);
      this.pin(this.i2c.scl);
    }
  },
};
