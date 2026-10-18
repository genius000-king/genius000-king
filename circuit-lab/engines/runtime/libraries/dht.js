/** DHT11/DHT22: temperature and humidity with the sensor’s minimum read interval. Called as handler.call(simulator, o, args, method, cls, a). */
export const dhtMethods = {
  'DHT.begin'(o) {
    this.pin(o.pin);
    return 0;
  },
  'DHT.readTemperature'(o, args, method) {
    return this.dhtRead(o, method === 'readTemperature' ? (args[0] ? 'F' : 'C') : 'H');
  },
  'DHT.computeHeatIndex'(o, args) {
    const T = args[0],
      H = args[1],
      F = args[2] === 0 ? T * 1.8 + 32 : T;
    let hi = 0.5 * (F + 61 + (F - 68) * 1.2 + H * 0.094);
    if (hi > 79)
      hi =
        -42.379 +
        2.04901523 * F +
        10.14333127 * H -
        0.22475541 * F * H -
        0.00683783 * F * F -
        0.05481717 * H * H +
        0.00122874 * F * F * H +
        0.00085282 * F * H * H -
        0.00000199 * F * F * H * H;
    return args[2] === 0 ? (hi - 32) / 1.8 : hi;
  },
};

// same behaviour, other names
Object.assign(dhtMethods, {'DHT.readHumidity': dhtMethods['DHT.readTemperature']});
