/* ==========================================================
   بسّطها — «المختبر» 🧪
   لوحة تصميم حيّة على كل الصفحات: غيّر الألوان والخطوط والزوايا والظلال،
   أظهر/أخفِ الزخارف، واسحب الشخصيات والعناصر لأي مكان.
   - كل شيء يُحفظ في المتصفح ويُطبّق تلقائياً.
   - «تصدير» ينتج ملف إعدادات + كود CSS جاهز تلصقه في core.css عند الاعتماد.
   - يُحمَّل في <head> حتى تُطبّق الإعدادات قبل ظهور الصفحة.
   - في الإنتاج: احذف وسم lab.js من الصفحات (أو أظهره للمدير فقط).
   ========================================================== */
(() => {
  "use strict";
  const KEY = "bssatha:lab";
  const PAGE = location.pathname.split("/").pop() || "index.html";
  const root = document.documentElement;

  const COLORS = [
    ["--bg", "الخلفية"], ["--surface", "البطاقات"], ["--ink", "الحبر (النص والحدود)"], ["--ink-2", "النص الثانوي"],
    ["--brand", "اللون الأساسي (الأزرار)"], ["--sun", "الأصفر"], ["--pink", "الوردي"], ["--sky", "الأزرق"], ["--mint", "الأخضر"],
    ["--blob-yellow", "بقعة صفراء"], ["--blob-pink", "بقعة وردية"], ["--blob-blue", "بقعة زرقاء"],
  ];
  const PRESETS = {
    "الأصلي": {},
    "هادئ": { "--bg": "#F4F1EA", "--brand": "#D9774F", "--sun": "#E8C26A", "--pink": "#E7B3C6", "--sky": "#7FA7C9", "--blob-yellow": "#F1DFA6", "--blob-pink": "#EED2DC", "--blob-blue": "#CFE0EE" },
    "باستيل": { "--bg": "#FDF6F0", "--brand": "#F08A6C", "--sun": "#FFD98A", "--pink": "#FFC4DA", "--sky": "#9FCBFF", "--blob-yellow": "#FFE9B0", "--blob-pink": "#FFD6E6", "--blob-blue": "#CFE5FF" },
    "ليلي": { "--bg": "#1D1816", "--surface": "#2A2320", "--surface-2": "#352C28", "--surface-3": "#40352F", "--ink": "#F6EEE6", "--ink-2": "#CFC3B8", "--ink-3": "#9A8E84", "--line": "#3D332E", "--line-strong": "#51443D", "--blob-yellow": "#5A4720", "--blob-pink": "#5B3243", "--blob-blue": "#22415C" },
  };
  const FONTS_DISPLAY = ["Marhey", "Lalezar", "Rakkas", "Lemonada", "Reem Kufi", "El Messiri", "Changa", "Baloo Bhaijaan 2", "Readex Pro"];
  const FONTS_BODY = ["Readex Pro", "IBM Plex Sans Arabic", "Tajawal", "Cairo", "Almarai", "Changa", "Noto Kufi Arabic"];

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) { return {}; } };
  let S = Object.assign({ vars: {}, fontDisplay: null, fontBody: null, base: 16, radius: 1, shadow: "pop", hide: {}, pos: {} }, load());
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} };

  /* ---------- التطبيق ---------- */
  const loadedFonts = new Set(["Marhey", "Readex Pro"]);
  function loadFont(f) {
    if (!f || loadedFonts.has(f)) return;
    loadedFonts.add(f);
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700&display=swap`;
    document.head.appendChild(l);
  }
  let styleEl;
  function apply() {
    // نمسح أي متغير سابق ثم نطبق الحالية
    [...root.style].filter((p) => p.startsWith("--")).forEach((p) => root.style.removeProperty(p));
    Object.entries(S.vars).forEach(([k, v]) => root.style.setProperty(k, v));
    if (S.fontDisplay) { loadFont(S.fontDisplay); root.style.setProperty("--font-display", `"${S.fontDisplay}", "Readex Pro", sans-serif`); }
    if (S.fontBody) { loadFont(S.fontBody); root.style.setProperty("--font-ui", `"${S.fontBody}", system-ui, sans-serif`); }
    root.style.fontSize = S.base !== 16 ? S.base + "px" : "";
    const r = S.radius;
    if (r !== 1) [["--r-sm", 10], ["--r-md", 14], ["--r-lg", 20], ["--r-xl", 28]].forEach(([k, v]) => root.style.setProperty(k, Math.round(v * r) + "px"));
    if (S.shadow === "soft") { root.style.setProperty("--shadow-pop", "0 6px 18px -6px rgba(30,25,22,.28)"); root.style.setProperty("--shadow-pop-lg", "0 14px 34px -12px rgba(30,25,22,.3)"); }
    if (S.shadow === "none") { root.style.setProperty("--shadow-pop", "none"); root.style.setProperty("--shadow-pop-lg", "none"); }
    // إخفاء المجموعات
    const h = S.hide, css = [];
    if (h.mascots) css.push("[data-mascot], .char { display: none !important; }");
    if (h.blobs) css.push(".blob-bg { display: none !important; }");
    if (h.doodles) css.push(".doodle { display: none !important; }");
    if (h.notes) css.push(".sticky-note, .speech { display: none !important; }");
    if (h.motif) css.push(".motif { display: none !important; }");
    if (!styleEl) { styleEl = document.createElement("style"); styleEl.id = "lab-style"; document.head.appendChild(styleEl); }
    styleEl.textContent = css.join("\n");
    applyPositions();
  }
  function applyPositions() {
    const pos = S.pos[PAGE] || {};
    document.querySelectorAll("[data-lab]").forEach((el) => {
      const p = pos[el.dataset.lab];
      el.style.translate = p ? `${p.x}px ${p.y}px` : "";
      el.style.scale = p && p.s && p.s !== 1 ? p.s : "";
    });
  }
  apply();

  /* ---------- الواجهة ---------- */
  const CSS = `
  .lab-fab { position: fixed; z-index: 120; inset-inline-end: 16px; bottom: 16px; display: flex; align-items: center; gap: 8px; height: 48px; padding: 0 16px 0 12px; border-radius: 999px; background: var(--ink); color: var(--bg); font: 600 14px var(--font-ui); border: 2px solid var(--ink); box-shadow: 3px 3px 0 var(--brand); cursor: pointer; transition: transform .15s; }
  .lab-fab:hover { transform: translate(-1px,-1px) rotate(-2deg); }
  .lab-fab svg { width: 22px; height: 22px; }
  @media (max-width: 960px) { body:has(.tabbar) .lab-fab, body:has(.m-tabs) .lab-fab { bottom: calc(84px + env(safe-area-inset-bottom)); } .lab-fab span { display: none; } .lab-fab { width: 48px; padding: 0; justify-content: center; } }
  .lab:not(.is-open) { visibility: hidden; transition: transform .35s cubic-bezier(.2,.8,.2,1), visibility 0s .35s; }
  .lab { position: fixed; z-index: 121; top: 12px; bottom: 12px; inset-inline-end: 12px; width: 340px; display: grid; grid-template-rows: auto auto 1fr auto; background: var(--surface); color: var(--ink); border: 2px solid var(--ink); border-radius: 22px; box-shadow: 6px 6px 0 var(--ink); font-family: var(--font-ui); font-size: 14px; transform: translateX(-120%); transition: transform .35s cubic-bezier(.2,.8,.2,1); overflow: hidden; }
  [dir="rtl"] .lab { transform: translateX(-120%); }
  .lab.is-open { transform: none !important; }
  @media (max-width: 640px) { .lab { inset: auto 0 0 0; width: auto; height: 74dvh; border-radius: 22px 22px 0 0; border-width: 2px 0 0; box-shadow: 0 -10px 40px rgba(0,0,0,.25); transform: translateY(105%) !important; } .lab.is-open { transform: none !important; } }
  .lab-head { display: flex; align-items: center; gap: 10px; padding: 14px 16px 10px; }
  .lab-head h2 { font: 700 20px var(--font-display); margin: 0; flex: 1; }
  .lab-x { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--surface-2); border: 0; cursor: pointer; color: var(--ink); font-size: 18px; }
  .lab-tabs { display: flex; gap: 4px; padding: 0 12px 10px; border-bottom: 1px solid var(--line); }
  .lab-tabs button { flex: 1; height: 34px; border: 0; border-radius: 10px; background: none; color: var(--ink-3); font: 600 13px var(--font-ui); cursor: pointer; }
  .lab-tabs button[aria-selected="true"] { background: var(--ink); color: var(--bg); }
  .lab-body { overflow-y: auto; padding: 14px 16px; display: grid; align-content: start; gap: 14px; }
  .lab-sec h3 { font-size: 12px; color: var(--ink-3); margin: 0 0 8px; font-weight: 600; }
  .lab-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 0; }
  .lab-row label { flex: 1; }
  .lab-row input[type=color] { width: 40px; height: 30px; border: 2px solid var(--line-strong); border-radius: 8px; padding: 0; background: none; cursor: pointer; }
  .lab-row input[type=range] { flex: 1; accent-color: var(--brand); }
  .lab-row output { min-width: 40px; text-align: center; font-variant-numeric: tabular-nums; font-weight: 600; }
  .lab select { width: 100%; height: 40px; border-radius: 10px; border: 1.5px solid var(--line-strong); background: var(--surface); color: var(--ink); padding: 0 10px; font: 500 14px var(--font-ui); }
  .lab-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .lab-chips button { height: 34px; padding: 0 12px; border-radius: 999px; border: 1.5px solid var(--line-strong); background: var(--surface); color: var(--ink); font: 600 13px var(--font-ui); cursor: pointer; }
  .lab-chips button.on { background: var(--ink); color: var(--bg); border-color: var(--ink); }
  .lab-sw { display: inline-flex; gap: 3px; margin-inline-end: 6px; vertical-align: middle; }
  .lab-sw i { width: 10px; height: 10px; border-radius: 50%; border: 1px solid rgba(0,0,0,.15); }
  .lab-toggle { position: relative; width: 42px; height: 24px; flex: none; }
  .lab-toggle input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; z-index: 1; }
  .lab-toggle span { position: absolute; inset: 0; border-radius: 99px; background: var(--line-strong); transition: background .2s; }
  .lab-toggle span::after { content: ""; position: absolute; top: 3px; right: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform .2s; }
  .lab-toggle input:checked + span { background: var(--mint); }
  .lab-toggle input:checked + span::after { transform: translateX(-18px); }
  .lab-move-card { padding: 12px; border-radius: 14px; background: var(--sun-soft); border: 1.5px dashed var(--ink); font-size: 13px; line-height: 1.7; }
  .lab-sel { padding: 12px; border-radius: 14px; background: var(--surface-2); }
  .lab-sel b { display: block; margin-bottom: 6px; }
  .lab-foot { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; padding: 12px 16px 14px; border-top: 1px solid var(--line); }
  .lab-foot button, .lab-btn { height: 38px; border-radius: 10px; border: 1.5px solid var(--line-strong); background: var(--surface); color: var(--ink); font: 600 12px var(--font-ui); cursor: pointer; }
  .lab-foot .primary { background: var(--brand); color: #fff; border-color: var(--ink); }
  body.lab-moving [data-lab] { pointer-events: auto !important; cursor: grab; outline: 2px dashed rgba(59,130,246,.75); outline-offset: 4px; }
  body.lab-moving [data-lab]:hover { outline-color: var(--brand); }
  body.lab-moving [data-lab].lab-picked { outline: 3px solid var(--brand); cursor: grabbing; }
  body.lab-moving .hero-art { z-index: 3; }
  body.lab-moving [data-lab] * { pointer-events: none; }
  .lab-tip { position: fixed; z-index: 122; top: 14px; left: 50%; translate: -50% 0; padding: 10px 16px; border-radius: 999px; background: var(--ink); color: var(--bg); font: 600 13px var(--font-ui); box-shadow: 0 10px 30px rgba(0,0,0,.25); display: none; }
  body.lab-moving .lab-tip { display: block; }
  `;

  const FLASK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6"/><path d="M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21.5h11.6a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7 15h10"/></svg>';

  function build() {
    document.head.insertAdjacentHTML("beforeend", `<style>${CSS}</style>`);
    const fab = document.createElement("button");
    fab.className = "lab-fab"; fab.type = "button";
    fab.setAttribute("aria-label", "فتح المختبر"); fab.innerHTML = FLASK + "<span>المختبر</span>";
    const lab = document.createElement("aside");
    lab.className = "lab"; lab.setAttribute("aria-label", "مختبر التصميم");
    lab.innerHTML = `
      <div class="lab-head">${FLASK.replace("<svg", '<svg width="24" height="24"')}<h2>المختبر</h2><button class="lab-x" data-x aria-label="إغلاق">×</button></div>
      <div class="lab-tabs" role="tablist">
        <button role="tab" aria-selected="true" data-t="colors">الألوان</button>
        <button role="tab" aria-selected="false" data-t="type">الخطوط</button>
        <button role="tab" aria-selected="false" data-t="shape">الشكل</button>
        <button role="tab" aria-selected="false" data-t="items">العناصر</button>
      </div>
      <div class="lab-body" id="labBody"></div>
      <div class="lab-foot">
        <button class="primary" data-export>تصدير</button>
        <button data-import>استيراد</button>
        <button data-reset>إعادة ضبط</button>
        <input type="file" accept="application/json" hidden data-file>
      </div>`;
    const tip = document.createElement("div");
    tip.className = "lab-tip"; tip.textContent = "وضع التحريك: اسحب أي عنصر منقّط · عجلة الفأرة للتكبير · Esc للخروج";
    document.body.append(fab, lab, tip);

    let tab = "colors";
    const body = lab.querySelector("#labBody");
    const cssVal = (k) => (getComputedStyle(root).getPropertyValue(k).trim() || "#000000");
    const toHex = (c) => {
      if (/^#[0-9a-f]{6}$/i.test(c)) return c;
      if (/^#[0-9a-f]{3}$/i.test(c)) return "#" + [...c.slice(1)].map((x) => x + x).join("");
      const m = c.match(/\d+/g); return m ? "#" + m.slice(0, 3).map((n) => (+n).toString(16).padStart(2, "0")).join("") : "#000000";
    };

    function render() {
      lab.querySelectorAll("[data-t]").forEach((b) => b.setAttribute("aria-selected", b.dataset.t === tab));
      if (tab === "colors") {
        body.innerHTML = `
          <div class="lab-sec"><h3>لوحات جاهزة</h3><div class="lab-chips">${Object.entries(PRESETS).map(([n, p]) => `<button data-preset="${n}"><span class="lab-sw">${["--brand", "--sun", "--pink", "--sky"].map((k) => `<i style="background:${p[k] || cssDefault(k)}"></i>`).join("")}</span>${n}</button>`).join("")}</div></div>
          <div class="lab-sec"><h3>كل لون على حدة</h3>${COLORS.map(([k, n]) => `<div class="lab-row"><label for="c${k}">${n}</label><input type="color" id="c${k}" data-var="${k}" value="${toHex(cssVal(k))}"></div>`).join("")}</div>`;
      } else if (tab === "type") {
        body.innerHTML = `
          <div class="lab-sec"><h3>خط العناوين</h3><select data-font="fontDisplay">${FONTS_DISPLAY.map((f) => `<option ${f === (S.fontDisplay || "Marhey") ? "selected" : ""}>${f}</option>`).join("")}</select>
            <p style="font-family:var(--font-display);font-size:26px;margin:10px 0 0">حوّل فكرتك إلى عرض</p></div>
          <div class="lab-sec"><h3>خط النصوص</h3><select data-font="fontBody">${FONTS_BODY.map((f) => `<option ${f === (S.fontBody || "Readex Pro") ? "selected" : ""}>${f}</option>`).join("")}</select>
            <p style="margin:10px 0 0;color:var(--ink-2)">اكتب الفكرة، أرفق ملفاتك، والذكاء يبني لك عرضاً كاملاً.</p></div>
          <div class="lab-sec"><h3>حجم الخط الأساسي</h3><div class="lab-row"><input type="range" min="13" max="19" step="1" value="${S.base}" data-num="base"><output>${S.base}px</output></div></div>`;
      } else if (tab === "shape") {
        body.innerHTML = `
          <div class="lab-sec"><h3>استدارة الزوايا</h3><div class="lab-row"><input type="range" min="0" max="2" step="0.1" value="${S.radius}" data-num="radius"><output>${Math.round(S.radius * 100)}%</output></div></div>
          <div class="lab-sec"><h3>نوع الظل</h3><div class="lab-chips">${[["pop", "كرتوني"], ["soft", "ناعم"], ["none", "بدون"]].map(([v, n]) => `<button data-shadow="${v}" class="${S.shadow === v ? "on" : ""}">${n}</button>`).join("")}</div></div>
          <div class="lab-sec"><h3>معاينة</h3><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><button class="btn btn-primary">زر أساسي</button><button class="btn">زر عادي</button><span class="tile pink" style="display:grid"><svg class="i" viewBox="0 0 24 24"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/></svg></span></div></div>`;
      } else {
        const groups = [["mascots", "الشخصيات"], ["blobs", "البقع الملونة"], ["doodles", "الزخارف (نجوم، دوامات)"], ["notes", "الورقة اللاصقة والفقاعة"], ["motif", "شريط الأشكال"]];
        const items = [...document.querySelectorAll("[data-lab]")];
        body.innerHTML = `
          <div class="lab-sec"><h3>إظهار وإخفاء</h3>${groups.map(([k, n]) => `<div class="lab-row"><label>${n}</label><span class="lab-toggle"><input type="checkbox" data-hide="${k}" ${S.hide[k] ? "" : "checked"} aria-label="${n}"><span></span></span></div>`).join("")}</div>
          <div class="lab-sec"><h3>أماكن العناصر</h3>
            ${items.length ? `<div class="lab-move-card">فعّل «وضع التحريك» ثم اسحب أي عنصر منقّط في الصفحة. استخدم عجلة الفأرة (أو الشريط بالأسفل) لتكبيره وتصغيره.</div>
            <div class="lab-row" style="margin-top:8px"><label><b>وضع التحريك</b></label><span class="lab-toggle"><input type="checkbox" data-move ${document.body.classList.contains("lab-moving") ? "checked" : ""} aria-label="وضع التحريك"><span></span></span></div>
            <div class="lab-sel" id="labSel" ${picked ? "" : "hidden"}><b>المحدد: <span id="labSelName"></span></b>
              <div class="lab-row"><span>الحجم</span><input type="range" min="0.4" max="2.5" step="0.05" id="labScale"><output id="labScaleOut"></output></div>
              <button class="lab-btn" style="width:100%" data-reset-one>إرجاع هذا العنصر لمكانه</button></div>
            <button class="lab-btn" style="width:100%;margin-top:8px" data-reset-pos>إرجاع كل العناصر في هذه الصفحة</button>`
            : `<p style="color:var(--ink-3);margin:0">لا توجد عناصر قابلة للتحريك في هذه الصفحة. (تُعلَّم في الكود بـ data-lab)</p>`}
          </div>`;
        syncSel();
      }
    }
    const DEFAULTS = {};
    function cssDefault(k) { return DEFAULTS[k] || cssVal(k); }
    // نحفظ القيم الأصلية قبل أي تعديل
    root.style.cssText.split(";").length; // no-op
    COLORS.forEach(([k]) => { const inline = root.style.getPropertyValue(k); root.style.removeProperty(k); DEFAULTS[k] = getComputedStyle(root).getPropertyValue(k).trim(); if (inline) root.style.setProperty(k, inline); });

    lab.addEventListener("click", (e) => {
      const t = e.target.closest("[data-t]"); if (t) { tab = t.dataset.t; render(); return; }
      if (e.target.closest("[data-x]")) return toggle(false);
      const pr = e.target.closest("[data-preset]");
      if (pr) { S.vars = { ...PRESETS[pr.dataset.preset] }; save(); apply(); render(); return; }
      const sh = e.target.closest("[data-shadow]");
      if (sh) { S.shadow = sh.dataset.shadow; save(); apply(); render(); return; }
      if (e.target.closest("[data-reset-pos]")) { delete S.pos[PAGE]; save(); applyPositions(); unpick(); render(); return; }
      if (e.target.closest("[data-reset-one]") && picked) { delete (S.pos[PAGE] || {})[picked.dataset.lab]; save(); applyPositions(); syncSel(); return; }
      if (e.target.closest("[data-reset]")) {
        if (!confirm("إرجاع كل إعدادات المختبر للوضع الأصلي؟")) return;
        S = { vars: {}, fontDisplay: null, fontBody: null, base: 16, radius: 1, shadow: "pop", hide: {}, pos: {} }; save(); apply(); render(); return;
      }
      if (e.target.closest("[data-export]")) return exportAll();
      if (e.target.closest("[data-import]")) return lab.querySelector("[data-file]").click();
    });
    lab.addEventListener("input", (e) => {
      const el = e.target;
      if (el.dataset.var) { S.vars[el.dataset.var] = el.value; root.style.setProperty(el.dataset.var, el.value); save(); }
      if (el.dataset.num) { S[el.dataset.num] = +el.value; el.nextElementSibling.textContent = el.dataset.num === "radius" ? Math.round(el.value * 100) + "%" : el.value + "px"; save(); apply(); }
      if (el.id === "labScale" && picked) { setPos(picked, { s: +el.value }); lab.querySelector("#labScaleOut").textContent = Math.round(el.value * 100) + "%"; }
    });
    lab.addEventListener("change", (e) => {
      const el = e.target;
      if (el.dataset.font) { S[el.dataset.font] = el.value; save(); apply(); }
      if (el.dataset.hide) { S.hide[el.dataset.hide] = !el.checked; save(); apply(); }
      if (el.hasAttribute("data-move")) setMoving(el.checked);
      if (el.dataset.file !== undefined && el.files[0]) {
        el.files[0].text().then((txt) => { try { S = Object.assign(S, JSON.parse(txt)); save(); apply(); render(); alert("تم استيراد الإعدادات ✓"); } catch (_) { alert("الملف غير صالح"); } });
      }
    });

    function exportAll() {
      const vars = { ...S.vars };
      if (S.fontDisplay) vars["--font-display"] = `"${S.fontDisplay}", "Readex Pro", sans-serif`;
      if (S.fontBody) vars["--font-ui"] = `"${S.fontBody}", system-ui, sans-serif`;
      const css = `/* الصق هذا في آخر assets/css/core.css لاعتماد تصميم المختبر */\n:root {\n${Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n}\n` +
        Object.entries(S.pos).map(([page, items]) => Object.entries(items).map(([id, p]) => `/* ${page} */ [data-lab="${id}"] { translate: ${p.x || 0}px ${p.y || 0}px; scale: ${p.s || 1}; }`).join("\n")).join("\n");
      const blob = new Blob([JSON.stringify({ ...S, css }, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "bssatha-lab.json"; a.click();
      navigator.clipboard?.writeText(css).catch(() => {});
      window.UI?.toast ? UI.toast("نُزّل ملف الإعدادات ونُسخ كود CSS", "download") : alert("تم التصدير");
    }

    /* ---------- التحريك ---------- */
    let picked = null, drag = null;
    function setPos(el, patch) {
      const page = (S.pos[PAGE] = S.pos[PAGE] || {});
      const p = (page[el.dataset.lab] = Object.assign({ x: 0, y: 0, s: 1 }, page[el.dataset.lab], patch));
      el.style.translate = `${p.x}px ${p.y}px`; el.style.scale = p.s;
      save();
    }
    function pick(el) { unpick(); picked = el; el.classList.add("lab-picked"); syncSel(); }
    function unpick() { picked && picked.classList.remove("lab-picked"); picked = null; syncSel(); }
    function syncSel() {
      const box = lab.querySelector("#labSel"); if (!box) return;
      box.hidden = !picked; if (!picked) return;
      const p = (S.pos[PAGE] || {})[picked.dataset.lab] || { s: 1 };
      lab.querySelector("#labSelName").textContent = picked.dataset.lab;
      lab.querySelector("#labScale").value = p.s || 1;
      lab.querySelector("#labScaleOut").textContent = Math.round((p.s || 1) * 100) + "%";
    }
    function setMoving(on) {
      document.body.classList.toggle("lab-moving", on);
      if (!on) unpick();
      const cb = lab.querySelector("[data-move]"); if (cb) cb.checked = on;
    }
    document.addEventListener("pointerdown", (e) => {
      if (!document.body.classList.contains("lab-moving")) return;
      const el = e.target.closest("[data-lab]"); if (!el || lab.contains(el)) return;
      e.preventDefault(); e.stopPropagation();
      pick(el);
      const p = (S.pos[PAGE] || {})[el.dataset.lab] || { x: 0, y: 0 };
      drag = { el, sx: e.clientX, sy: e.clientY, x: p.x || 0, y: p.y || 0 };
      el.setPointerCapture?.(e.pointerId);
    }, true);
    document.addEventListener("pointermove", (e) => {
      if (!drag) return;
      setPos(drag.el, { x: Math.round(drag.x + e.clientX - drag.sx), y: Math.round(drag.y + e.clientY - drag.sy) });
    });
    document.addEventListener("pointerup", () => { drag = null; });
    document.addEventListener("click", (e) => { if (document.body.classList.contains("lab-moving") && e.target.closest("[data-lab]") && !lab.contains(e.target)) { e.preventDefault(); e.stopPropagation(); } }, true);
    document.addEventListener("wheel", (e) => {
      if (!document.body.classList.contains("lab-moving")) return;
      const el = e.target.closest("[data-lab]"); if (!el) return;
      e.preventDefault();
      const p = (S.pos[PAGE] || {})[el.dataset.lab] || { s: 1 };
      setPos(el, { s: Math.max(.3, Math.min(3, +((p.s || 1) * (e.deltaY < 0 ? 1.06 : .94)).toFixed(3))) });
      if (el === picked) syncSel();
    }, { passive: false });
    addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.body.classList.contains("lab-moving")) setMoving(false);
      if (picked && e.key.startsWith("Arrow") && document.body.classList.contains("lab-moving")) {
        e.preventDefault();
        const p = (S.pos[PAGE] || {})[picked.dataset.lab] || { x: 0, y: 0 }, st = e.shiftKey ? 10 : 1;
        const d = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key];
        setPos(picked, { x: (p.x || 0) + d[0], y: (p.y || 0) + d[1] });
      }
    });

    function toggle(open) {
      lab.classList.toggle("is-open", open);
      fab.style.display = open ? "none" : "";
      if (!open) setMoving(false);
      else render();
    }
    fab.addEventListener("click", () => toggle(true));
    if (location.hash === "#lab") toggle(true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
