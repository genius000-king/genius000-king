/* ==========================================================
   بسّطها — حاوية الشرائح (فارغة)

   المحرر (editor.html) والمشغّل (present.html) يقرآن الشرائح من هنا.
   لا توجد شرائح جاهزة — أضف شرائحك بإحدى طريقتين:

   1) قبل تحميل هذا الملف، عرّف:
        window.BSSATHA_DECK = {
          title: "اسم العرض",
          slides: [
            { title: "الغلاف", html: '<div class="slide">…</div>', init(root) { … تفاعلات اختيارية … } },
          ],
          css: ".my-class { … }  ← CSS خاص بشرائحك",
        };
   2) أو من الباك إند: GET /decks/:id يرجع نفس الشكل.

   قواعد الشريحة:
   - لوحة ثابتة 1280×720 تُكبَّر وتُصغَّر تلقائياً لتناسب الشاشة.
   - الجذر: <div class="slide">…</div>
   - أي عنصر قابل للتحرير في المحرر يحمل data-el="اسم-فريد" ويكون position:absolute.
   - init(root) اختيارية: تُستدعى عند عرض الشريحة، وإن أرجعت دالة تُستدعى عند مغادرتها (للتنظيف).
   ========================================================== */
(() => {
  "use strict";
  const W = 1280, H = 720;

  // أساسيات الشريحة فقط (بدون أي محتوى)
  const BASE_CSS = `
  .slide { position: absolute; inset: 0; width: ${W}px; height: ${H}px; overflow: hidden; font-family: "Readex Pro", sans-serif; color: #2A1B12; background: #FFFFFF; direction: rtl; }
  .slide [data-el] { position: absolute; }
  .slide .t-display { font-family: "Marhey", "Readex Pro", sans-serif; font-weight: 700; line-height: 1.25; margin: 0; }
  .slide .t-body { font-size: 26px; line-height: 1.7; color: #5A4636; margin: 0; }
  .slide .anim { animation: sIn .8s cubic-bezier(.2,.8,.2,1) both; animation-delay: var(--d, 0s); }
  @keyframes sIn { from { opacity: 0; transform: translateY(30px); } }
  .slide .float { animation: sFloat 5s ease-in-out infinite; }
  @keyframes sFloat { 50% { transform: translateY(-14px); } }
  `;

  const src = window.BSSATHA_DECK || {};
  const SLIDES = Array.isArray(src.slides) ? src.slides : [];

  // شريحة فارغة تُستخدم عند إضافة شريحة جديدة أو عند عدم وجود شرائح
  const blank = (n = 1) => ({
    title: "شريحة " + n,
    html: `<div class="slide"><h2 data-el="h" class="t-display" style="right:80px;top:280px;width:1120px;font-size:64px">عنوان الشريحة</h2><p data-el="p" class="t-body" style="right:80px;top:400px;width:900px">اضغط مرتين للكتابة، أو اطلب من المساعد أن يملأ الشريحة.</p></div>`,
  });

  window.Deck = { W, H, CSS: BASE_CSS + (src.css || ""), SLIDES, TITLE: src.title || "عرض بدون عنوان", blank };
})();
