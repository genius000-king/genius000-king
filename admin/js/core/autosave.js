// autosave.js — حفظ مؤجَّل: خمس تعديلات متتالية تعني حفظاً واحداً بعد الهدوء.
// يبثّ حالته على `document` باسم `autosave:state`، وشريط الأدوات يلتقطها.

const EVENT = 'autosave:state';

/** يبثّ حالة الحفظ: saving ← saved، أو error عند الفشل. */
function emit(state) {
  document.dispatchEvent(new CustomEvent(EVENT, { detail: { state } }));
}

/**
 * يغلّف `fn` بمؤجّل. الاستدعاء المتكرّر يُلغي السابق، فتُنفَّذ مرة واحدة
 * بعد `delay` ميلي ثانية من آخر استدعاء، بآخر وسائط مُرِّرت.
 * على الغلاف: `.flush()` تنفّذ فوراً، و`.cancel()` تُلغي المعلّق.
 */
export function autosave(fn, delay = 800) {
  let timer = 0;
  let args = [];
  let seq = 0;     // لتجاهل بثّ النتيجة إن بدأ حفظ أحدث أثناء الانتظار

  async function run() {
    const mine = ++seq;
    const now = args;
    emit('saving');
    try {
      await fn(...now);
      if (mine === seq) emit('saved');
      return true;
    } catch (err) {
      if (mine === seq) emit('error');
      console.error('[autosave] تعذّر الحفظ', err);
      return false;
    }
  }

  const wrapped = (...next) => {
    args = next;
    clearTimeout(timer);
    timer = setTimeout(() => { timer = 0; run(); }, delay);
  };

  /** يُلغي الحفظ المعلّق بلا تنفيذ ولا بثّ. */
  wrapped.cancel = () => { clearTimeout(timer); timer = 0; };

  /** ينفّذ الحفظ المعلّق حالاً. يعيد وعداً بنجاح العملية. */
  wrapped.flush = () => {
    if (!timer) return Promise.resolve(false);
    clearTimeout(timer); timer = 0;
    return run();
  };

  /** هل يوجد حفظ معلّق الآن؟ */
  wrapped.pending = () => timer !== 0;

  return wrapped;
}

/**
 * كتابة فورية مغلّفة بحالات المؤشر — للأزرار التي لا معنى لتأجيلها
 * (حذف، إضافة، تبديل نشر). لا ترمي أبداً: تعيد null عند الفشل.
 */
export async function saveNow(fn) {
  emit('saving');
  try {
    const out = await fn();
    emit('saved');
    return out;
  } catch (err) {
    console.error('[autosave] تعذّر الحفظ', err);
    emit('error');
    return null;
  }
}

export default autosave;
