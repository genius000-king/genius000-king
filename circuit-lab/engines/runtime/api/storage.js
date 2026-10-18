/** EEPROM emulation (AVR EEPROM and the ESP flash-backed EEPROM library). Called as handler.call(simulator, args, name). */
export const storageApi = {
  'EEPROM.begin'(a) {
    return 1;
  },
  'EEPROM.commit'(a) {
    return 1;
  },
  'EEPROM.length'(a) {
    const prof = this.profile;
    return prof.family === 'avr' ? (prof.key === 'mega' ? 4096 : 1024) : 4096;
  },
  'EEPROM.read'(a) {
    const address = a[0];
    return this.eeprom[address] ?? 255;
  },
  'EEPROM.write'(a) {
    const address = a[0];
    if (address < 0 || address >= 4096) throw Error('EEPROM address out of range');
    this.eeprom[address] = a[1] & 255;
    return 0;
  },
};

// same behaviour, other names
Object.assign(storageApi, {'EEPROM.update': storageApi['EEPROM.write']});
