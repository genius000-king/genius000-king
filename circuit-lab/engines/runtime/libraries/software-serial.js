/** SoftwareSerial: a bit-banged UART on any two pins. Called as handler.call(simulator, o, args, method, cls, a). */
export const softwareSerialMethods = {
  'SoftwareSerial.begin'(o, args) {
    this.uarts[o.port].baud = args[0];
    Object.assign(this.pin(o.txPin), {mode: 1, value: 1});
    this.pin(o.rxPin).mode = 2;
    return 0;
  },
  'SoftwareSerial.listen'(o) {
    return 0;
  },
  'SoftwareSerial.print'(o, args, method) {
    const tag = args.at(-1);
    const s =
      method === 'write'
        ? typeof args[0] === 'string'
          ? args[0]
          : String.fromCharCode(args[0] & 255)
        : this.fmt(args[0] ?? '', tag, args.length > 2 ? args[1] : undefined) +
          (method === 'println' ? '\r\n' : '');
    return this.serialWrite(o.port, s);
  },
  'SoftwareSerial.available'(o, args, method) {
    return this.serialRead(o.port, method, args);
  },
};

// same behaviour, other names
Object.assign(softwareSerialMethods, {
  'SoftwareSerial.end': softwareSerialMethods['SoftwareSerial.listen'],
  'SoftwareSerial.println': softwareSerialMethods['SoftwareSerial.print'],
  'SoftwareSerial.write': softwareSerialMethods['SoftwareSerial.print'],
  'SoftwareSerial.read': softwareSerialMethods['SoftwareSerial.available'],
  'SoftwareSerial.peek': softwareSerialMethods['SoftwareSerial.available'],
  'SoftwareSerial.readString': softwareSerialMethods['SoftwareSerial.available'],
});
