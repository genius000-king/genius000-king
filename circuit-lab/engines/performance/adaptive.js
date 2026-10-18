// Lowers the render resolution while frames are late and raises it again once they are on time.
// Only frames rendered back to back are measured: an idle scene renders nothing and says nothing.

export class AdaptiveResolution {
  constructor({max, min, frameMs, onChange}) {
    this.max = max;
    this.min = min;
    this.target = Math.max(frameMs, 1000 / 60);
    this.onChange = onChange;
    this.ratio = max;
    this.samples = [];
    this.onTime = 0;
    this.last = 0;
  }
  /** Call once per animation frame; `rendered` says whether this frame drew. */
  frame(now, rendered) {
    if (!rendered) {
      this.last = 0;
      return;
    }
    if (this.last) this.samples.push(now - this.last);
    this.last = now;
    if (this.samples.length < 30) return;
    const average = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    this.samples = [];
    if (average > this.target * 1.6 && this.ratio > this.min) {
      this.onTime = 0;
      this.set(Math.max(this.min, this.ratio * 0.8));
    } else if (average < this.target * 1.15 && this.ratio < this.max) {
      // climb back slowly so the scene does not oscillate between two sizes
      if (++this.onTime >= 3) {
        this.onTime = 0;
        this.set(Math.min(this.max, this.ratio * 1.12));
      }
    } else this.onTime = 0;
  }
  set(ratio) {
    this.ratio = Math.round(ratio * 100) / 100;
    this.onChange(this.ratio);
  }
}
