/* ==========================================================
   بسّطها — المحرر البصري
   - تحديد العناصر [data-el] وسحبها وتغيير حجمها
   - تحرير النص بالنقر المزدوج
   - لوحة خصائص + شريط أدوات عائم
   - تعديل بالمحادثة مع الذكاء
   - تراجع / إعادة، وحفظ تلقائي
   ========================================================== */
(() => {
  "use strict";
  const { $, $$, icon, esc, toast, sleep } = UI;
  const { SLIDES, CSS, W, H } = DeckDemo;
  document.head.insertAdjacentHTML("beforeend", `<style>${CSS}</style>`);

  const deckId = new URLSearchParams(location.search).get("id") || "d1";
  const slides = SLIDES.map((s) => ({ title: s.title, html: s.html, init: s.init }));
  let cur = 0, sel = null, mode = "edit", scale = 1, cleanup = null;
  const canvas = $("#canvas"), wrap = $("#wrap"), selBox = $("#sel"), ftb = $("#ftb");
  $("#playBtn").href = `present.html?id=${deckId}`;

  /* ---------- السجل (تراجع/إعادة) ---------- */
  const hist = [], fut = [];
  const snap = () => JSON.stringify({ cur, html: slides.map((s) => s.html) });
  function commit() {
    serialize();
    const s = snap();
    if (hist[hist.length - 1] !== s) { hist.push(s); if (hist.length > 80) hist.shift(); fut.length = 0; }
    updHistBtns(); autosave(); renderThumb(cur);
  }
  function restore(s) {
    const o = JSON.parse(s);
    o.html.forEach((h, k) => slides[k] && (slides[k].html = h));
    slides.length = o.html.length;
    cur = Math.min(o.cur, slides.length - 1);
    renderRail(); renderCanvas(); autosave();
  }
  function undo() { if (hist.length < 2) return; fut.push(hist.pop()); restore(hist[hist.length - 1]); updHistBtns(); }
  function redo() { if (!fut.length) return; const s = fut.pop(); hist.push(s); restore(s); updHistBtns(); }
  const updHistBtns = () => { $("#undo").disabled = hist.length < 2; $("#redo").disabled = !fut.length; };
  $("#undo").addEventListener("click", undo);
  $("#redo").addEventListener("click", redo);

  let saveT;
  function autosave() {
    const st = $("#saveState");
    st.classList.add("is-saving"); st.lastElementChild.textContent = "يحفظ…";
    clearTimeout(saveT);
    // الربط: PATCH /decks/:id  { slides }
    saveT = setTimeout(() => { st.classList.remove("is-saving"); st.lastElementChild.textContent = "محفوظ"; }, 700);
  }
  $("#deckName").addEventListener("change", autosave);

  /* ---------- الرسم ---------- */
  function fit() {
    const r = wrap.getBoundingClientRect();
    const pad = innerWidth < 900 ? 16 : 48;
    scale = Math.max(.1, Math.min((r.width - pad) / W, (r.height - pad) / H));
    canvas.style.transform = `translate(-50%, -50%) scale(${scale})`;
    positionSel();
  }
  new ResizeObserver(fit).observe(wrap);

  function serialize() {
    const s = canvas.querySelector(".slide"); if (!s) return;
    const c = s.cloneNode(true);
    c.querySelectorAll("[contenteditable]").forEach((e) => e.removeAttribute("contenteditable"));
    slides[cur].html = c.outerHTML;
  }

  function renderCanvas() {
    cleanup && cleanup(); cleanup = null;
    canvas.innerHTML = slides[cur].html;
    if (mode === "try" && slides[cur].init) { const r = slides[cur].init(canvas); if (typeof r === "function") cleanup = r; }
    deselect();
    $("#ctxSlide").textContent = `الشريحة ${cur + 1}`;
    $$(".thumb").forEach((t, k) => t.classList.toggle("is-active", k === cur));
    fit();
  }

  function thumbHTML(k) {
    return `<div role="button" tabindex="0" class="thumb ${k === cur ? "is-active" : ""}" data-k="${k}" aria-label="الشريحة ${k + 1}: ${esc(slides[k].title)}">
      <span class="no">${k + 1}</span><span class="tv"><span class="scaler" inert>${slides[k].html}</span></span></div>`;
  }
  function scaleThumbs() { $$(".tv").forEach((t) => (t.querySelector(".scaler").style.transform = `scale(${t.clientWidth / W})`)); }
  function renderRail() {
    $("#rail").innerHTML = slides.map((_, k) => thumbHTML(k)).join("") + `<button class="add-slide" id="addSlide">${icon("plus", "i-sm")}<span>شريحة</span></button>`;
    requestAnimationFrame(scaleThumbs);
  }
  function renderThumb(k) {
    const t = $(`.thumb[data-k="${k}"]`); if (!t) return;
    t.querySelector(".scaler").innerHTML = slides[k].html;
  }
  new ResizeObserver(scaleThumbs).observe($("#rail"));
  $("#rail").addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("thumb")) { e.preventDefault(); e.target.click(); } });

  $("#rail").addEventListener("click", (e) => {
    if (e.target.closest("#addSlide")) return addSlide();
    const t = e.target.closest(".thumb"); if (!t) return;
    serialize(); cur = +t.dataset.k; renderCanvas();
    t.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  });

  function addSlide() {
    serialize();
    slides.splice(cur + 1, 0, { title: "شريحة جديدة", html: `<div class="slide" style="background:#FFF8EE"><h2 data-el="h" class="t-display" style="right:80px;top:280px;width:1120px;font-size:64px;margin:0">عنوان جديد</h2><p data-el="p" class="t-body" style="right:80px;top:400px;width:900px;margin:0">اضغط مرتين للكتابة، أو اطلب من المساعد أن يملأ الشريحة.</p></div>` });
    cur++; renderRail(); renderCanvas(); commit();
    toast("أُضيفت شريحة جديدة", "plus");
  }

  /* ---------- الوضع: تحرير / تجربة ---------- */
  $$("[data-mode]").forEach((b) => b.addEventListener("click", () => {
    serialize();
    mode = b.dataset.mode;
    $$("[data-mode]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    canvas.classList.toggle("is-editing", mode === "edit");
    renderCanvas();
    if (mode === "try") toast("وضع التجربة: تفاعل مع الشريحة كما يراها جمهورك", "play");
  }));

  /* ---------- التحديد ---------- */
  const LABELS = { title: "عنوان", h: "عنوان", sub: "نص", p: "نص", tag: "شارة", info: "بطاقة", chart: "رسم بياني", sim: "محاكاة", cell: "نموذج", cellArt: "رسم", opts: "خيارات", q: "سؤال", ctrl: "أداة تحكم" };
  function select(el) {
    sel = el;
    selBox.classList.add("is-on"); ftb.classList.add("is-on");
    const k = el.dataset.el;
    const label = LABELS[k] || (el.classList.contains("blob") ? "شكل" : "عنصر");
    $("#selTag").textContent = label;
    $("#ctxEl").hidden = false; $("#ctxEl").textContent = label;
    positionSel(); syncProps();
    $("#propsEmpty").hidden = true; $("#props").hidden = false;
  }
  function deselect() {
    if (sel) sel.removeAttribute("contenteditable");
    sel = null;
    selBox.classList.remove("is-on"); ftb.classList.remove("is-on");
    $("#ctxEl").hidden = true;
    $("#propsEmpty").hidden = false; $("#props").hidden = true;
  }
  function positionSel() {
    if (!sel || !sel.isConnected) return;
    const wr = wrap.getBoundingClientRect(), r = sel.getBoundingClientRect();
    Object.assign(selBox.style, { left: r.left - wr.left - 4 + "px", top: r.top - wr.top - 4 + "px", width: r.width + 8 + "px", height: r.height + 8 + "px" });
    const fw = ftb.offsetWidth || 300;
    let fx = r.left - wr.left + r.width / 2 - fw / 2;
    fx = Math.max(8, Math.min(fx, wr.width - fw - 8));
    let fy = r.bottom - wr.top + 14;
    if (fy + 50 > wr.height) fy = Math.max(8, r.top - wr.top - 60);
    Object.assign(ftb.style, { left: fx + "px", top: fy + "px" });
    $("#ftbFs").textContent = Math.round(parseFloat(getComputedStyle(sel).fontSize));
  }

  // يحوّل الموضع إلى left/top صريحة (العناصر قد تكون مثبّتة بـ right)
  function normalize(el) {
    if (el.dataset.norm) return;
    const L = el.offsetLeft, T = el.offsetTop, w = el.offsetWidth, h = el.offsetHeight;
    Object.assign(el.style, { left: L + "px", top: T + "px", right: "auto", bottom: "auto", width: w + "px" });
    if (!el.style.height && el.classList.contains("blob")) el.style.height = h + "px";
    el.dataset.norm = "1";
  }

  let drag = null;
  canvas.addEventListener("pointerdown", (e) => {
    if (mode !== "edit") return;
    const el = e.target.closest("[data-el]");
    if (!el) { deselect(); return; }
    if (el.getAttribute("contenteditable") === "true") return;
    e.preventDefault();
    if (sel !== el) { if (sel) sel.removeAttribute("contenteditable"); select(el); }
    normalize(el);
    drag = { kind: "move", el, x: e.clientX, y: e.clientY, L: el.offsetLeft, T: el.offsetTop, moved: false };
    canvas.setPointerCapture(e.pointerId);
  });
  selBox.addEventListener("pointerdown", (e) => {
    const h = e.target.closest(".h"); if (!h || !sel) return;
    e.preventDefault(); e.stopPropagation();
    normalize(sel);
    drag = { kind: h.dataset.h, el: sel, x: e.clientX, y: e.clientY, L: sel.offsetLeft, T: sel.offsetTop, w: sel.offsetWidth, h: sel.offsetHeight, moved: false };
    selBox.setPointerCapture(e.pointerId);
  });
  function onMove(e) {
    if (!drag) return;
    const dx = (e.clientX - drag.x) / scale, dy = (e.clientY - drag.y) / scale;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    const s = drag.el.style, snapV = (v) => (e.shiftKey ? v : Math.round(v / 8) * 8);
    if (drag.kind === "move") { s.left = snapV(drag.L + dx) + "px"; s.top = snapV(drag.T + dy) + "px"; }
    else {
      let { L, T, w, h } = drag;
      if (drag.kind.includes("e")) w = drag.w + dx;
      if (drag.kind.includes("w")) { w = drag.w - dx; L = drag.L + dx; }
      if (drag.kind.includes("s")) h = drag.h + dy;
      if (drag.kind.includes("n")) { h = drag.h - dy; T = drag.T + dy; }
      Object.assign(s, { left: L + "px", top: T + "px", width: Math.max(40, w) + "px", height: Math.max(30, h) + "px" });
    }
    positionSel(); syncProps();
  }
  function onUp() { if (drag && drag.moved) commit(); drag = null; }
  canvas.addEventListener("pointermove", onMove); selBox.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp); selBox.addEventListener("pointerup", onUp);

  // تحرير النص
  canvas.addEventListener("dblclick", (e) => {
    if (mode !== "edit") return;
    const el = e.target.closest("[data-el]"); if (!el || !el.textContent.trim() || el.querySelector("svg, canvas, button")) return;
    el.setAttribute("contenteditable", "true"); el.focus();
    const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    ftb.classList.remove("is-on");
  });
  canvas.addEventListener("focusout", (e) => {
    const el = e.target.closest?.("[contenteditable]");
    if (el) { el.removeAttribute("contenteditable"); commit(); if (sel) { ftb.classList.add("is-on"); positionSel(); } }
  });
  canvas.addEventListener("input", positionSel);

  /* ---------- الأدوات ---------- */
  const isShape = (el) => el.classList.contains("blob") || (!el.textContent.trim() && !el.querySelector("svg, canvas"));
  function setFont(d) { if (!sel) return; const f = parseFloat(getComputedStyle(sel).fontSize); sel.style.fontSize = Math.max(10, Math.round(f + d)) + "px"; positionSel(); syncProps(); commit(); }
  function setColor(c) { if (!sel) return; isShape(sel) ? (sel.style.background = c) : (sel.style.color = c); syncProps(); commit(); }
  function del() { if (!sel) return; const el = sel; deselect(); el.remove(); commit(); toast("حُذف العنصر — Ctrl+Z للتراجع", "trash"); }
  function dup() {
    if (!sel) return; normalize(sel);
    const c = sel.cloneNode(true);
    c.dataset.el = sel.dataset.el + "_" + Math.random().toString(36).slice(2, 5);
    c.style.left = sel.offsetLeft + 24 + "px"; c.style.top = sel.offsetTop + 24 + "px";
    sel.after(c); select(c); commit();
  }
  ftb.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.color) return setColor(b.dataset.color);
    ({ "fs-": () => setFont(-4), "fs+": () => setFont(4), del, dup, ai: () => { openPanel("chat"); $("#prompt").focus(); } })[b.dataset.act]?.();
  });

  /* ---------- لوحة الخصائص ---------- */
  function syncProps() {
    if (!sel) return;
    const cs = getComputedStyle(sel);
    const v = { left: sel.offsetLeft, top: sel.offsetTop, width: sel.offsetWidth, height: sel.offsetHeight, fontSize: parseFloat(cs.fontSize) };
    $$("[data-prop]").forEach((i) => { if (document.activeElement !== i) i.value = Math.round(v[i.dataset.prop]); });
    $("#opacity").value = cs.opacity;
    $("#fontFam").value = cs.fontFamily.includes("Marhey") ? '"Marhey"' : '"Readex Pro"';
    $("#anim").value = sel.classList.contains("anim") ? "anim" : sel.classList.contains("float") ? "float" : "";
    const col = isShape(sel) ? cs.backgroundColor : cs.color;
    $$("#swatches button").forEach((b) => b.classList.toggle("is-on", hexToRgb(b.dataset.c) === col));
  }
  const hexToRgb = (h) => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;
  $$("[data-prop]").forEach((i) => i.addEventListener("change", () => {
    if (!sel) return; normalize(sel);
    sel.style[i.dataset.prop] = i.value + "px"; positionSel(); commit();
  }));
  $("#swatches").addEventListener("click", (e) => { const b = e.target.closest("button"); b && setColor(b.dataset.c); });
  $("#customColor").addEventListener("change", (e) => setColor(e.target.value));
  $("#opacity").addEventListener("input", (e) => { if (sel) sel.style.opacity = e.target.value; });
  $("#opacity").addEventListener("change", commit);
  $("#fontFam").addEventListener("change", (e) => { if (sel) { sel.style.fontFamily = e.target.value + ", sans-serif"; positionSel(); commit(); } });
  $("#anim").addEventListener("change", (e) => {
    if (!sel) return;
    sel.classList.remove("anim", "float");
    if (e.target.value) { sel.classList.add(e.target.value); sel.style.animation = "none"; void sel.offsetWidth; sel.style.animation = ""; }
    commit();
  });
  $$("[data-z]").forEach((b) => b.addEventListener("click", () => {
    if (!sel) return;
    b.dataset.z === "up" ? sel.parentNode.appendChild(sel) : sel.parentNode.prepend(sel);
    commit(); positionSel();
  }));
  $("[data-act-panel=del]").addEventListener("click", del);

  /* ---------- اللوحة (تبويبات + ورقة الجوال) ---------- */
  function showTab(t) {
    $$("[data-tab]").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === t));
    $("#pane-chat").hidden = t !== "chat"; $("#pane-props").hidden = t !== "props";
  }
  $$("[data-tab]").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
  function openPanel(t) { showTab(t); $("#panel").classList.add("is-open"); $("#sheetBg").classList.add("is-open"); }
  function closePanel() { $("#panel").classList.remove("is-open"); $("#sheetBg").classList.remove("is-open"); }
  $$("[data-open]").forEach((b) => b.addEventListener("click", () => openPanel(b.dataset.open)));
  $("#closeSheet").addEventListener("click", closePanel);
  $("#sheetBg").addEventListener("click", closePanel);

  /* ---------- المحادثة ---------- */
  const msgs = $("#msgs"), prompt = $("#prompt");
  prompt.addEventListener("input", () => { prompt.style.height = "auto"; prompt.style.height = Math.min(prompt.scrollHeight, 140) + "px"; });
  prompt.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#composer").requestSubmit(); } });
  $$(".sugs button").forEach((b) => b.addEventListener("click", () => { prompt.value = b.textContent; $("#composer").requestSubmit(); }));

  const MINI = () => `<span class="mini">${UI.mascot({ arms: false, legs: false })}</span>`;
  function addMsg(who, html) {
    $("#chatEmpty")?.remove();
    const d = document.createElement("div");
    d.className = "msg " + who;
    d.innerHTML = html;
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
    return d;
  }

  // تطبيق تجريبي لطلبات شائعة — في الإنتاج: الذكاء يرجع diff على كود الشريحة
  function applyDemo(text) {
    const slideEl = canvas.querySelector(".slide");
    if (/هادئ|هادئة|ألوان|الوان/.test(text)) {
      const palette = ["#EEF4F1", "#F1F5FB", "#F6F3EE"];
      slideEl.style.background = palette[cur % palette.length];
      slideEl.querySelectorAll(".blob").forEach((b, k) => (b.style.background = ["#B8D8CB", "#C9D7EE", "#E4D9C5"][k % 3]));
      return "غيّرت الخلفية والأشكال لدرجات هادئة";
    }
    if (/كبّر|كبر|أكبر|اكبر/.test(text)) {
      const t = sel || slideEl.querySelector("[data-el=cell], [data-el=cellArt], [data-el=title], [data-el=h]");
      if (t) { normalize(t); t.style.transition = "all .5s cubic-bezier(.34,1.56,.64,1)"; t.style.width = t.offsetWidth * 1.15 + "px"; if (t.style.height) t.style.height = t.offsetHeight * 1.15 + "px"; t.style.fontSize = parseFloat(getComputedStyle(t).fontSize) * 1.12 + "px"; setTimeout(() => (t.style.transition = ""), 600); }
      return "كبّرت العنصر 15%";
    }
    if (/حركة|حركات|انتقال/.test(text)) {
      slideEl.querySelectorAll("[data-el]").forEach((el, k) => { el.classList.add("anim"); el.style.setProperty("--d", k * 0.08 + "s"); });
      return "أضفت حركات دخول متتابعة لكل العناصر";
    }
    slideEl.animate([{ filter: "brightness(1)" }, { filter: "brightness(1.15)" }, { filter: "brightness(1)" }], { duration: 700 });
    return "حدّثت الشريحة";
  }

  $("#composer").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = prompt.value.trim(); if (!text) return;
    prompt.value = ""; prompt.style.height = "";
    addMsg("me", esc(text));
    const t = addMsg("ai", `<div class="who">${MINI()}بسّوط</div><span class="typing"><i></i><i></i><i></i></span>`);
    const res = await API.chatEdit({ deckId, slide: cur, element: sel?.dataset.el, message: text });
    const summary = applyDemo(text);
    commit();
    if (sel) positionSel();
    t.innerHTML = `<div class="who">${MINI()}بسّوط</div>${esc(res.reply)}
      <div class="change">${icon("check")}<span>${summary} · الشريحة ${cur + 1}</span><span class="cost">−${res.creditsUsed} كريدت</span></div>`;
    msgs.scrollTop = msgs.scrollHeight;
  });

  /* ---------- المشاركة ---------- */
  $("#copyUrl").addEventListener("click", () => { navigator.clipboard?.writeText($("#shareUrl").value).catch(() => {}); toast("نُسخ الرابط", "link"); });

  /* ---------- لوحة المفاتيح ---------- */
  addEventListener("keydown", (e) => {
    const typing = e.target.matches("input, textarea, [contenteditable=true]");
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y" && !typing) { e.preventDefault(); redo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && sel && !typing) { e.preventDefault(); dup(); return; }
    if (typing) { if (e.key === "Escape") e.target.blur(); return; }
    if (!sel) return;
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); del(); }
    else if (e.key === "Escape") deselect();
    else if (e.key.startsWith("Arrow")) {
      e.preventDefault(); normalize(sel);
      const step = e.shiftKey ? 24 : 4;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      sel.style.left = sel.offsetLeft + d[0] + "px"; sel.style.top = sel.offsetTop + d[1] + "px";
      positionSel(); syncProps(); clearTimeout(sel._t); sel._t = setTimeout(commit, 400);
    }
  });

  /* ---------- البدء ---------- */
  renderRail(); renderCanvas();
  hist.push(snap()); updHistBtns();
})();
