export class Union {
  constructor() {
    this.m = new Map();
  }
  root(a) {
    if (!this.m.has(a)) this.m.set(a, a);
    let r = a;
    while (this.m.get(r) !== r) r = this.m.get(r);
    while (this.m.get(a) !== r) {
      const n = this.m.get(a);
      this.m.set(a, r);
      a = n;
    }
    return r;
  }
  join(a, b) {
    this.m.set(this.root(a), this.root(b));
  }
}
