/** Language helpers that the compiler exposes as calls. Called as handler.call(simulator, args, name). */
export const systemApi = {
  'ESP.restart'(a) {
    this.log('ESP.restart(): rebooting', 'system');
    this.restartRequested = true;
    return 0;
  },
  F(a) {
    const x = a[0];
    return x;
  },
  String(a) {
    const x = a[0];
    return a.length >= 2 && typeof x === 'number'
      ? Number.isInteger(x) && [2, 8, 10, 16].includes(a[1])
        ? x.toString(a[1]).toUpperCase()
        : x.toFixed(a[1])
      : typeof x === 'number' && !Number.isInteger(x)
        ? x.toFixed(2)
        : String(x);
  },
};
