// Simulator methods: pulseWait, checkWatchers
export const timingMethods = {
  pulseWait(pin, level, timeoutUs) {
    this.pin(pin);
    const net = this.circuit.netOf(this.node(pin));
    return {
      wait: true,
      done: false,
      result: 0,
      pin,
      net,
      level: level ? 1 : 0,
      phase: this.read(pin) === (level ? 1 : 0) ? 0 : 1,
      deadline: this.time + (timeoutUs ?? 1e6) / 1000,
      seen: this.time,
    };
  },
  checkWatchers() {
    if (!this.vm?.waiting) return;
    const w = this.vm.waiting;
    if (w.done) return;
    const edges = this.circuit.edges
      .filter(e => e.net === w.net && e.t > (w.seen ?? -1) && e.t <= this.time + 1e-9)
      .sort((a, b) => a.t - b.t);
    const handle = (lvl, t) => {
      if (w.phase === 0) {
        if (lvl !== w.level) w.phase = 1;
      } else if (w.phase === 1) {
        if (lvl === w.level) {
          w.phase = 2;
          w.start = t;
        }
      } else if (w.phase === 2 && lvl !== w.level) {
        w.result = Math.round((t - w.start) * 1000);
        w.done = true;
      }
    };
    if (edges.length) {
      for (const e of edges) {
        w.seen = e.t;
        handle(e.level, e.t);
        if (w.done) break;
      }
    } else {
      const lvl = this.voltageAt(w.pin) >= this.profile.vih ? 1 : 0;
      handle(lvl, this.time);
    }
    if (!w.done && this.time >= w.deadline) {
      w.done = true;
      w.result = 0;
    }
  },
};
