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
    <a class="g-card reveal" style="--d:${i * 60}ms" href="present.html?demo=${k}">
      <div class="g-cover">${Covers.cover(k)}<span class="g-play">${icon("play")}</span></div>
      <div class="g-body"><h3>${t}</h3><p>${d}</p></div>
    </a>`).join("");
  // تفعيل الظهور للعناصر الجديدة
  const io = new IntersectionObserver((en) => en.forEach((x) => x.isIntersecting && (x.target.classList.add("is-in"), io.unobserve(x.target))), { threshold: .1 });
  $$("#galleryGrid .reveal").forEach((el) => io.observe(el));

  /* ---------- محاكاة المدار (الشريحة الحية) ---------- */
  const cv = $("#orbit"), ctx = cv.getContext("2d");
  const massIn = $("#mass"), speedIn = $("#speed");
  let W, H, dpr, star, p, trail = [], running = false;
  const stars = Array.from({ length: 90 }, () => [Math.random(), Math.random(), Math.random() * 1.3 + .2]);

  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const r = cv.getBoundingClientRect();
    W = r.width; H = r.height;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    reset();
  }
  function reset() {
    star = { x: W / 2, y: H / 2 + 6 };
    const R = Math.min(W, H) * .3;
    const GM = 4000 * +massIn.value * (R / 140);
    const v = Math.sqrt(GM / R) * +speedIn.value;
    p = { x: star.x + R, y: star.y, vx: 0, vy: -v };
    trail = [];
  }
  function step(dt) {
    const GM = 4000 * +massIn.value * (Math.min(W, H) * .3 / 140);
    for (let k = 0; k < 4; k++) {
      const dx = star.x - p.x, dy = star.y - p.y, d2 = dx * dx + dy * dy, d = Math.sqrt(d2);
      if (d < 22) { reset(); return; }
      const a = GM / d2;
      p.vx += (a * dx / d) * dt / 4; p.vy += (a * dy / d) * dt / 4;
      p.x += p.vx * dt / 4; p.y += p.vy * dt / 4;
    }
    if (p.x < -W || p.x > 2 * W || p.y < -H || p.y > 2 * H) reset();
    trail.push([p.x, p.y]); if (trail.length > 220) trail.shift();
  }
  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    stars.forEach(([x, y, r], i) => { ctx.globalAlpha = .4 + .4 * Math.sin(t / 900 + i); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x * W, y * H, r, 0, 7); ctx.fill(); });
    ctx.globalAlpha = 1;
    // المسار
    for (let i = 1; i < trail.length; i++) {
      ctx.strokeStyle = `rgba(255,200,61,${i / trail.length * .8})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(...trail[i - 1]); ctx.lineTo(...trail[i]); ctx.stroke();
    }
    // النجم
    const sr = 16 + 9 * +massIn.value;
    const g = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, sr * 2.6);
    g.addColorStop(0, "rgba(255,200,61,.55)"); g.addColorStop(1, "rgba(255,200,61,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(star.x, star.y, sr * 2.6, 0, 7); ctx.fill();
    ctx.fillStyle = "#FFC83D"; ctx.beginPath(); ctx.arc(star.x, star.y, sr, 0, 7); ctx.fill();
    // الكوكب
    ctx.fillStyle = "#3B82F6"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, 7); ctx.fill(); ctx.stroke();
    // متجه السرعة
    ctx.strokeStyle = "#F6A6C8"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx * .35, p.y + p.vy * .35); ctx.stroke();
  }
  let last = 0;
  function loop(t) {
    if (!running) return;
    const dt = Math.min((t - last) / 1000, .033); last = t;
    step(dt); draw(t);
    requestAnimationFrame(loop);
  }
  const vis = new IntersectionObserver(([e]) => { running = e.isIntersecting; if (running) { last = performance.now(); requestAnimationFrame(loop); } });
  vis.observe(cv);
  massIn.addEventListener("input", () => { $("#massOut").textContent = (+massIn.value).toFixed(1); });
  speedIn.addEventListener("input", () => { $("#speedOut").textContent = (+speedIn.value).toFixed(1); reset(); });
  addEventListener("resize", size);
  size();
})();
