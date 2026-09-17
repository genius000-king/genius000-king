// prefs.js — تفضيلات الحركة وقدرة الجهاز. المصدر الوحيد لقرار «كم نتحرك».
const mq = (q) => (typeof matchMedia === 'function' ? matchMedia(q) : null);

const reduceQuery = mq('(prefers-reduced-motion: reduce)');
const coarseQuery = mq('(pointer: coarse)');
const dataQuery   = mq('(prefers-reduced-data: reduce)');

const prefs = {
  _forceReduced: null,
  _forceLowPower: null,

  get reduced() {
    if (this._forceReduced !== null) return this._forceReduced;
    return !!(reduceQuery && reduceQuery.matches);
  },

  get lowPower() {
    if (this._forceLowPower !== null) return this._forceLowPower;
    if (dataQuery && dataQuery.matches) return true;
    const cores = navigator.hardwareConcurrency || 8;
    const mem = navigator.deviceMemory || 8;
    const slowNet = navigator.connection && /2g/.test(navigator.connection.effectiveType || '');
    return cores <= 4 || mem <= 4 || !!slowNet;
  },

  get touch() { return !!(coarseQuery && coarseQuery.matches); },

  /** يقيس قيمة بالشدّة وبقدرة الجهاز. `reduced` يصفّرها. */
  scale(value, intensity = 1) {
    if (this.reduced) return 0;
    const i = Math.min(1, Math.max(0, Number(intensity)));
    return this.lowPower ? value * i * 0.5 : value * i;
  },

  onChange(fn) {
    reduceQuery?.addEventListener('change', fn);
    return () => reduceQuery?.removeEventListener('change', fn);
  },
};

export default prefs;
