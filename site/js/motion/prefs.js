// prefs.js — تفضيلات الحركة وقدرة الجهاز. المصدر الوحيد لقرار «كم نتحرك».
// كل مؤثر يقرأ منه بدل أن يستعلم بنفسه (Spec §6.3).

const reduceQuery = typeof matchMedia === 'function'
  ? matchMedia('(prefers-reduced-motion: reduce)') : null;

const coarseQuery = typeof matchMedia === 'function'
  ? matchMedia('(pointer: coarse)') : null;

const prefs = {
  // تجاوزات للاختبار فقط — `null` يعني «اقرأ من البيئة».
  _forceReduced: null,
  _forceLowPower: null,

  get reduced() {
    if (this._forceReduced !== null) return this._forceReduced;
    return !!(reduceQuery && reduceQuery.matches);
  },

  get lowPower() {
    if (this._forceLowPower !== null) return this._forceLowPower;
    const cores = navigator.hardwareConcurrency || 8;
    const mem = navigator.deviceMemory || 8;
    return cores <= 4 || mem <= 4;
  },

  get touch() { return !!(coarseQuery && coarseQuery.matches); },

  /** يقيس قيمة رقمية بالشدة وبقدرة الجهاز. `reduced` يصفّرها. */
  scale(value, intensity = 1) {
    if (this.reduced) return 0;
    const i = Math.min(1, Math.max(0, Number(intensity)));
    return this.lowPower ? value * i * 0.5 : value * i;
  },

  /** يستمع لتغيّر تفضيل المستخدم أثناء التصفح. */
  onChange(fn) {
    reduceQuery?.addEventListener('change', fn);
    return () => reduceQuery?.removeEventListener('change', fn);
  },
};

export default prefs;
