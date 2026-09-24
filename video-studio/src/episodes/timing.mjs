// حساب التوقيت من النص — مصدر واحد يستخدمه المونتاج ومولّد ملف التلقين (SRT).
// السرعة: 2.5 كلمة/ثانية ≈ إيقاع خليجي حادّ وسريع. غيّرها إن كان إلقاؤك أبطأ.
export const WPS = 2.5;
export const PAD = 0.45; // نَفَس بعد كل جملة
export const MIN = 2.2;
export const CHAPTER = 2.4; // عنوان الفصل: صمت (لا كلام) — استراحة للمشاهد

export const words = (s) => s.replace(/["«»()]/g, " ").split(/\s+/).filter((w) => w && !/^[.,،!؟?:\-–]+$/.test(w)).length;

/** يُرجع [{id, say, title, sub, start, dur}] بالثواني */
export const timeline = (script, fps = 30) => {
  let t = 0;
  return script.map(([id, say, title, sub]) => {
    const secs = id.startsWith("ch") ? CHAPTER : Math.max(MIN, words(say) / WPS + PAD);
    const frames = Math.round(secs * fps);
    const item = { id, say, title, sub, from: Math.round(t * fps), frames };
    t += frames / fps;
    return item;
  });
};
