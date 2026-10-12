/* بسّطها — منطق صفحة الإنشاء */
(() => {
  "use strict";
  const { $, $$, icon, esc, toast, fileKind, fileSize, sleep } = UI;
  const BALANCE = 340;
  const state = { mode: "idea", files: [], style: "auto", level: 2, slides: 10 };

  /* ---------- استرجاع المسودة من الصفحة الرئيسية ---------- */
  const idea = $("#idea");
  try {
    const d = JSON.parse(sessionStorage.getItem("bssatha:draft") || "null");
    if (d) {
      idea.value = d.idea || "";
      if (d.slides) state.slides = d.slides;
      if (d.files && d.files.length) toast(`أعد إرفاق ${d.files.length} ملف بعد تسجيل الدخول`, "paperclip", 3500);
      sessionStorage.removeItem("bssatha:draft");
    }
  } catch (_) {}

  const countEl = $("#count");
  const updCount = () => (countEl.textContent = `${UI.fmt(idea.value.length)} / 20,000`);
  idea.addEventListener("input", updCount); updCount();

  $$("[data-mode]").forEach((b) => b.addEventListener("click", () => {
    $$("[data-mode]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    state.mode = b.dataset.mode;
    $(".idea-box").classList.toggle("is-script", state.mode === "script");
    idea.placeholder = state.mode === "script"
      ? "الصق السكربت كاملاً هنا. افصل الشرائح بسطر «---» إن أردت، والذكاء يحترم ترتيبك ونصّك."
      : "مثال: أريد عرضاً يشرح الخلية البشرية بطريقة تفاعلية…";
    idea.focus();
  }));

  // تحسين الفكرة (يستدعي الذكاء في الواقع)
  $("#enhance").addEventListener("click", async (e) => {
    if (!idea.value.trim()) { toast("اكتب فكرة أولاً، وأنا أحسّنها", "edit"); return idea.focus(); }
    const b = e.currentTarget; b.disabled = true; b.innerHTML = icon("wand", "i-sm") + "يحسّن…";
    await sleep(900);
    idea.value = idea.value.trim() + "\n\n• ابدأ بمقدمة جذابة بسؤال للجمهور.\n• أضف نموذجاً تفاعلياً في منتصف العرض.\n• اختم باختبار قصير من 5 أسئلة وملخص.";
    updCount(); b.disabled = false; b.innerHTML = icon("wand", "i-sm") + "حسّن فكرتي";
    toast("أضفت اقتراحات — عدّلها كما تريد", "wand");
  });

  // الإملاء الصوتي (Web Speech API إن توفّر)
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mic = $("#mic");
  if (!SR) mic.hidden = true;
  else {
    let rec = null;
    mic.addEventListener("click", () => {
      if (rec) { rec.stop(); return; }
      rec = new SR(); rec.lang = "ar-SA"; rec.interimResults = false;
      rec.onresult = (e) => { idea.value += (idea.value ? " " : "") + e.results[0][0].transcript; updCount(); };
      rec.onend = () => { rec = null; mic.classList.remove("is-rec"); };
      rec.start(); mic.classList.add("is-rec"); toast("أسمعك… تكلّم", "mic");
    });
  }

  /* ---------- الملفات ---------- */
  const drop = $("#drop"), input = $("#files"), list = $("#fileList");
  function addFiles(fl) {
    [...fl].forEach((file) => {
      const k = fileKind(file.name);
      const id = "f" + Math.random().toString(36).slice(2, 8);
      state.files.push({ id, name: file.name, done: false });
      list.insertAdjacentHTML("beforeend", `
        <li class="file" id="${id}">
          <span class="ico ${k.tone}">${icon(k.icon)}</span>
          <div style="min-width:0"><b>${esc(file.name)}</b><small>${k.kind} · ${fileSize(file.size)}</small><div class="meter"><span style="width:0%"></span></div></div>
          <button class="btn btn-ghost btn-icon btn-sm" data-rm="${id}" aria-label="إزالة">${icon("x", "i-sm")}</button>
        </li>`);
      const el = $("#" + id);
      API.uploadFile(file, (p) => (el.querySelector(".meter span").style.width = p + "%")).then(() => {
        const f = state.files.find((x) => x.id === id); if (f) f.done = true;
        el.querySelector(".meter").outerHTML = `<small class="ok">${icon("check", "i-sm")} جاهز للتحليل</small>`;
        el.querySelector(".ok .i").style.cssText = "width:12px;height:12px;display:inline;vertical-align:-1px";
      });
    });
    summary();
  }
  input.addEventListener("change", () => { addFiles(input.files); input.value = ""; });
  drop.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), input.click()));
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("is-drag"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("is-drag"); }));
  drop.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));
  // السحب في أي مكان بالصفحة يوجّه للمنطقة
  addEventListener("dragover", (e) => e.preventDefault());
  addEventListener("drop", (e) => { if (!drop.contains(e.target)) { e.preventDefault(); e.dataTransfer.files.length && addFiles(e.dataTransfer.files); } });
  list.addEventListener("click", (e) => {
    const b = e.target.closest("[data-rm]"); if (!b) return;
    state.files = state.files.filter((f) => f.id !== b.dataset.rm);
    $("#" + b.dataset.rm).remove(); summary();
  });

  /* ---------- الأساليب ---------- */
  const cats = ["الكل", ...new Set(Covers.STYLES.map((s) => s.cat))];
  let cat = "الكل";
  $("#styleFilters").innerHTML = cats.map((c, i) => `<button type="button" class="chip" aria-pressed="${i === 0}" data-cat="${c}">${c}</button>`).join("");
  function renderStyles() {
    const items = Covers.STYLES.filter((s) => cat === "الكل" || s.cat === cat);
    $("#styleGrid").innerHTML =
      (cat === "الكل" ? `<button type="button" role="radio" class="style style-auto" data-style="auto" aria-checked="${state.style === "auto"}"><div class="pv">${icon("wand")}الذكاء يختار</div><b>تلقائي (موصى به)</b></button>` : "") +
      items.map((s) => `<button type="button" role="radio" class="style" data-style="${s.id}" aria-checked="${state.style === s.id}"><div class="pv">${Covers.stylePreview(s)}</div><b>${s.name}</b></button>`).join("");
  }
  renderStyles();
  $("#styleFilters").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]"); if (!b) return;
    $$("#styleFilters .chip").forEach((x) => x.setAttribute("aria-pressed", x === b));
    cat = b.dataset.cat; renderStyles();
  });
  $("#styleGrid").addEventListener("click", (e) => {
    const b = e.target.closest("[data-style]"); if (!b) return;
    state.style = b.dataset.style;
    $$("#styleGrid .style").forEach((x) => x.setAttribute("aria-checked", x === b));
    summary();
  });
  $("#customStyle").addEventListener("input", summary);

  /* ---------- الإعدادات ---------- */
  const slides = $("#slides");
  slides.value = state.slides;
  slides.addEventListener("input", () => { state.slides = +slides.value; $("#slidesOut").textContent = slides.value; summary(); });
  $("#slidesOut").textContent = slides.value;
  $$("[data-level]").forEach((b) => b.addEventListener("click", () => {
    $$("[data-level]").forEach((x) => x.setAttribute("aria-checked", x === b));
    state.level = +b.dataset.level; summary();
  }));

  /* ---------- الملخص والتكلفة ---------- */
  const LEVELS = { 1: ["بسيط", 3], 2: ["تفاعلي", 6], 3: ["غامر", 10] };
  let shownCost = 0;
  function animateNum(el, from, to) {
    const t0 = performance.now();
    const f = (t) => { const k = Math.min((t - t0) / 350, 1); el.textContent = Math.round(from + (to - from) * k); if (k < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }
  function summary() {
    const [lvlName, perSlide] = LEVELS[state.level];
    const cost = state.slides * perSlide + state.files.length * 2;
    $("#sumSlides").textContent = state.slides;
    $("#sumLevel").textContent = lvlName;
    const st = Covers.STYLES.find((s) => s.id === state.style);
    $("#sumStyle").textContent = $("#customStyle").value.trim() ? "وصف مخصص" : st ? st.name : "تلقائي";
    $("#sumFiles").textContent = state.files.length ? `${state.files.length} ${state.files.length > 2 ? "ملفات" : "ملف"}` : "لا يوجد";
    animateNum($("#cost"), shownCost, cost); animateNum($("#costM"), shownCost, cost);
    shownCost = cost;
    const after = BALANCE - cost;
    $("#after").textContent = after;
    $("#after").style.color = after < 0 ? "var(--danger)" : "";
    [$("#generate"), $("#generateM")].forEach((b) => {
      b.innerHTML = after < 0 ? icon("zap") + "اشحن رصيدك" : icon("sparkles") + "أنشئ العرض";
      b.dataset.short = after < 0 ? "1" : "";
    });
  }
  summary();

  /* ---------- الإنشاء ---------- */
  async function generate(e) {
    if (e.currentTarget.dataset.short) { location.href = "pricing.html"; return; }
    if (!idea.value.trim()) {
      $("#s-idea").scrollIntoView({ behavior: "smooth", block: "center" });
      idea.focus(); toast("اكتب فكرة العرض أولاً", "edit"); return;
    }
    if (state.files.some((f) => !f.done)) { toast("انتظر حتى يكتمل رفع الملفات", "upload"); return; }

    const gen = $("#gen"); gen.hidden = false; document.body.style.overflow = "hidden";
    const title = idea.value.trim().split(/\s+/).slice(0, 6).join(" ");
    $("#genSub").textContent = `«${title}…» · ${state.slides} شريحة`;
    $("#genSlides").innerHTML = Array.from({ length: Math.min(state.slides, 12) }, () => `<div class="gen-slide"><div class="skeleton" style="width:100%;height:100%;border-radius:0"></div></div>`).join("");
    const STAGES = ["فهم الفكرة وتحليل الملفات", "تخطيط المحتوى وتوزيعه على الشرائح", "اختيار التصميم والألوان والخطوط", "كتابة الكود وبناء التفاعلات", "مراجعة الجودة على الجوال والكمبيوتر"];
    $("#stages").innerHTML = STAGES.map((s) => `<li class="stage"><span class="st"></span>${s}</li>`).join("");

    const { jobId } = await API.generate({ ...state, idea: idea.value, customStyle: $("#customStyle").value, lang: $("#lang").value, audience: $("#aud").value });
    const stageEls = $$("#stages .stage"), slideEls = $$("#genSlides .gen-slide");
    const pool = Covers.STYLES.filter((s) => state.style === "auto" || s.id === state.style);
    let progress = 0;
    const stop = API.streamJob(jobId, (ev) => {
      if (ev.type === "stage") {
        stageEls.forEach((el, i) => {
          el.classList.toggle("is-done", i < ev.index);
          el.classList.toggle("is-active", i === ev.index);
          if (i < ev.index) el.querySelector(".st").innerHTML = icon("check");
        });
        progress = Math.max(progress, ev.index * 18 + 4);
      }
      if (ev.type === "slide" && slideEls[ev.index]) {
        const s = pool[ev.index % pool.length];
        slideEls[ev.index].innerHTML = Covers.stylePreview(s);
        slideEls[ev.index].classList.add("is-in");
        progress = Math.min(92, progress + 4);
      }
      if (ev.type === "done") {
        stageEls.forEach((el) => { el.classList.remove("is-active"); el.classList.add("is-done"); el.querySelector(".st").innerHTML = icon("check"); });
        slideEls.forEach((el, i) => { if (!el.classList.contains("is-in")) { el.innerHTML = Covers.stylePreview(pool[i % pool.length]); el.classList.add("is-in"); } });
        progress = 100;
        $("#genTitle").textContent = "عرضك جاهز! 🎉";
        $("#genActions").hidden = true; $("#genDone").hidden = false;
        confetti();
      }
      if (ev.type === "error") { toast(ev.message || "تعذّر الإنشاء، لم يُخصم أي كريدت", "alert"); }
      $("#genBar").style.width = progress + "%";
    });
    $("#genCancel").onclick = () => { stop(); gen.hidden = true; document.body.style.overflow = ""; toast("أُلغي الإنشاء — لم يُخصم أي كريدت", "x"); };
    $("#genBg").onclick = () => { location.href = "dashboard.html"; };
  }
  $("#generate").addEventListener("click", generate);
  $("#generateM").addEventListener("click", generate);

  // احتفال صغير
  function confetti() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#F0643A", "#FFC83D", "#3B82F6", "#F6A6C8", "#22B07D"];
    for (let i = 0; i < 80; i++) {
      const p = document.createElement("i");
      p.style.cssText = `position:fixed;z-index:99;top:-10px;left:${Math.random() * 100}vw;width:${6 + Math.random() * 6}px;height:${10 + Math.random() * 8}px;background:${colors[i % 5]};border-radius:2px;pointer-events:none`;
      document.body.appendChild(p);
      p.animate([{ transform: `translateY(0) rotate(0)` }, { transform: `translate(${(Math.random() - .5) * 200}px, ${innerHeight + 40}px) rotate(${Math.random() * 720}deg)` }], { duration: 1800 + Math.random() * 1400, easing: "cubic-bezier(.2,.6,.4,1)", delay: Math.random() * 300 }).onfinish = () => p.remove();
    }
  }

  // قادم من المعرض: ?style=id أو ?idea=...
  const qp = new URLSearchParams(location.search);
  if (qp.get("style") && Covers.STYLES.some((x) => x.id === qp.get("style"))) {
    state.style = qp.get("style"); renderStyles(); summary();
    setTimeout(() => $("#styles").scrollIntoView({ behavior: "smooth", block: "start" }), 250);
  }
  if (qp.get("idea") && !idea.value) { idea.value = qp.get("idea"); updCount(); }
  if (location.hash === "#styles") setTimeout(() => $("#styles").scrollIntoView({ behavior: "smooth" }), 200);
})();
