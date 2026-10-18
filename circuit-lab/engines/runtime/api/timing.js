/** Time since boot and the simulator’s periodic timers. Called as handler.call(simulator, args, name). */
export const timingApi = {
  millis(a) {
    return Math.floor(this.time);
  },
  micros(a) {
    return Math.floor(this.time * 1000);
  },
  yield(a) {
    return 0;
  },
  timerEvery(a) {
    const ms = a[0];
    if (ms < 1 || !this.program.funcs[a[1]])
      throw Error('timerEvery requires milliseconds ≥ 1 and a callback function.');
    this.timers[++this.timerId] = {period: ms, next: this.time + ms, fn: a[1]};
    return this.timerId;
  },
  timerCancel(a) {
    const id = a[0];
    delete this.timers[id];
    return 0;
  },
};
