/* بسّطها — تفاعلات الصفحة الرئيسية */
(() => {
  "use strict";
  const { $, $$, toast, icon, esc, fileKind } = UI;

  /* الرأس عند التمرير + قائمة الجوال */
  const header = $("#header");
  const onScroll = () => header.classList.toggle("is-scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  const mBtn = $("#mNavBtn"), mNav = $("#mNav");
  mBtn.addEventListener("click", () => {
    const open = mNav.classList.toggle("is-open");
    mBtn.setAttribute("aria-expanded", open);
    mBtn.innerHTML = icon(open ? "x" : "menu");
  });
  $$("a", mNav).forEach((a) => a.addEventListener("click", () => { mNav.classList.remove("is-open"); mBtn.innerHTML = icon("menu"); }));

  /* ---------- صندوق الفكرة ---------- */
  const idea = $("#idea");
  const autosize = () => { idea.style.height = "auto"; idea.style.height = Math.min(idea.scrollHeight, 320) + "px"; };
  idea.addEventListener("input", autosize);

  // نص توضيحي يكتب نفسه — يوضح للمستخدم ماذا يكتب دون أن يزحم الواجهة
  const examples = [
    "أريد عرضاً يشرح الخلية البشرية مع نموذج ثلاثي الأبعاد…",
    "محاكاة لحركة الكواكب يغيّر فيها الطالب الكتلة والسرعة…",
    "حوّل ملف Excel المرفق إلى رسوم بيانية تفاعلية…",
    "عرض سينمائي عن تاريخ الأندلس في 12 شريحة…",
  ];
  let ex = 0, ch = 0, del = false;
  (function type() {
    if (document.activeElement === idea || idea.value) { idea.placeholder = "اكتب فكرتك هنا…"; return setTimeout(type, 800); }
    const s = examples[ex];
    ch += del ? -1 : 1;
    idea.placeholder = s.slice(0, ch);
    if (!del && ch === s.length) { del = true; return setTimeout(type, 1800); }
    if (del && ch === 0) { del = false; ex = (ex + 1) % examples.length; }
    setTimeout(type, del ? 18 : 42);
  })();

  // (أُزيلت اقتراحات الأفكار الجاهزة من تحت الصندوق)
  $$("[data-idea]").forEach((b) => b.addEventListener("click", () => {
    idea.value = b.dataset.idea; autosize(); idea.focus();
    idea.setSelectionRange(idea.value.length, idea.value.length);
  }));

  // عدد الشرائح
  let slides = 10;
  const out = $("#slidesOut");
  $$("[data-step]").forEach((b) => b.addEventListener("click", () => {
    slides = Math.max(3, Math.min(40, slides + +b.dataset.step));
    out.textContent = `${slides} ${slides <= 10 ? "شرائح" : "شريحة"}`;
  }));

  // الأسلوب
  let style = "تلقائي";
  $$("[data-style]").forEach((b) => b.addEventListener("click", () => { style = b.dataset.style; $("#styleLabel").textContent = style; }));

  // الملفات: زر + سحب وإفلات
  const files = [];
  const prompt = $("#prompt"), pf = $("#promptFiles"), fi = $("#fileInput");
  const renderFiles = () => {
    pf.innerHTML = files.map((f, i) => {
      const k = fileKind(f.name);
      return `<span class="file-pill">${icon(k.icon, "i-sm")}<span>${esc(f.name)}</span><button type="button" data-rm="${i}" aria-label="إزالة ${esc(f.name)}">${icon("x", "i-sm")}</button></span>`;
    }).join("");
  };
  const addFiles = (list) => { [...list].forEach((f) => files.push(f)); renderFiles(); toast(`أُرفق ${list.length} ${list.length > 2 ? "ملفات" : "ملف"}`, "paperclip"); };
  $("#attachBtn").addEventListener("click", () => fi.click());
  fi.addEventListener("change", () => fi.files.length && addFiles(fi.files));
  pf.addEventListener("click", (e) => { const b = e.target.closest("[data-rm]"); if (b) { files.splice(+b.dataset.rm, 1); renderFiles(); } });
  ["dragenter", "dragover"].forEach((t) => prompt.addEventListener(t, (e) => { e.preventDefault(); prompt.classList.add("is-drag"); }));
  ["dragleave", "drop"].forEach((t) => prompt.addEventListener(t, (e) => { e.preventDefault(); if (t === "dragleave" && prompt.contains(e.relatedTarget)) return; prompt.classList.remove("is-drag"); }));
  prompt.addEventListener("drop", (e) => e.dataTransfer.files.length && addFiles(e.dataTransfer.files));

  prompt.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!idea.value.trim()) { idea.focus(); prompt.animate([{ transform: "translateX(0)" }, { transform: "translateX(-8px)" }, { transform: "translateX(8px)" }, { transform: "translateX(0)" }], { duration: 300 }); toast("اكتب فكرتك أولاً ✍️", "edit"); return; }
    // الفكرة تنتقل لصفحة الإنشاء. (الملفات تُرفع هناك بعد تسجيل الدخول)
    try { sessionStorage.setItem("bssatha:draft", JSON.stringify({ idea: idea.value, slides, style, files: files.map((f) => f.name) })); } catch (_) {}
    location.href = "create.html";
  });

  /* ---------- المعرض ---------- */
  const examplesData = [
    ["space", "النظام الشمسي", "مجسم ثلاثي الأبعاد تتجول بين كواكبه"],
    ["cell", "الخلية البشرية", "اضغط على النواة وادخل إليها"],
    ["history", "تاريخ الحضارات", "رحلة سينمائية عبر الزمن"],
    ["data", "البيانات والإحصاءات", "رسوم تتغير مع أرقامك"],
    ["physics", "قوانين الحركة", "محاكاة تتحكم في قوتها"],
    ["game", "لعبة الكسور", "مراحل ونقاط واختبار نهائي"],
  ];
  $("#galleryGrid").innerHTML = examplesData.map(([k, t, d], i) => `
    <a class="g-card reveal" style="--d:${i * 60}ms" href="create.html?idea=${encodeURIComponent(t + " — " + d)}">
      <div class="g-cover">${Covers.cover(k)}<span class="g-play">${icon("play")}</span></div>
      <div class="g-body"><h3>${t}</h3><p>${d}</p></div>
    </a>`).join("");
  // تفعيل الظهور للعناصر الجديدة
  const io = new IntersectionObserver((en) => en.forEach((x) => x.isIntersecting && (x.target.classList.add("is-in"), io.unobserve(x.target))), { threshold: .1 });
  $$("#galleryGrid .reveal").forEach((el) => io.observe(el));

})();
