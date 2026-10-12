/* ==========================================================
   بسّطها — السكربت المشترك لكل الصفحات
   - الأيقونات:  <svg data-i="name"></svg>  أو  <i data-i="name"></i>
   - الشخصية:   <div data-mascot></div>
   - الشعار:    <a data-logo></a>
   - الإشعارات: UI.toast("تم الحفظ")
   - النوافذ:   data-open-modal="id"  /  data-close-modal
   - القوائم:   data-menu="id"
   - الظهور:    class="reveal"
   ========================================================== */
(() => {
  "use strict";

  /* ---------- الأيقونات (خطّية بنمط Lucide) ---------- */
  const ICONS = {
    "arrow-left": '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    "arrow-right": '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    "chev-down": '<path d="m6 9 6 6 6-6"/>',
    "chev-left": '<path d="m15 18-6-6 6-6"/>',
    "chev-right": '<path d="m9 18 6-6-6-6"/>',
    paperclip: '<path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l8.6-8.6a4 4 0 0 1 5.7 5.7l-8.6 8.6a2 2 0 0 1-2.8-2.8l8-8"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    sparkles: '<path d="M9.9 15.5A2 2 0 0 0 8.5 14l-6.1-1.6a.5.5 0 0 1 0-1L8.5 9.9A2 2 0 0 0 9.9 8.5l1.6-6.1a.5.5 0 0 1 1 0l1.6 6.1a2 2 0 0 0 1.4 1.4l6.1 1.6a.5.5 0 0 1 0 1l-6.1 1.6a2 2 0 0 0-1.4 1.4l-1.6 6.1a.5.5 0 0 1-1 0Z"/>',
    play: '<path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5Z"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a2 2 0 0 1 2-2h11"/>',
    edit: '<path d="M12 20h9"/><path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>',
    video: '<rect x="2" y="5" width="14" height="14" rx="2"/><path d="m22 8-6 4 6 4V8Z"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    cube: '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
    table: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8"/><path d="M22 21a7 7 0 0 0-4-6.3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9a2.5 2.5 0 0 0-2.5-1.5c-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2A2.5 2.5 0 0 1 9.5 15"/><path d="M12 6v1.5"/><path d="M12 16.5V18"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/>',
    palette: '<circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.3A5.6 5.6 0 0 0 22 9.8C22 5.5 17.5 2 12 2Z"/>',
    bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
    redo: '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/>',
    maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
    minimize: '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 16v-4"/><path d="M12 16V8"/><path d="M17 16v-7"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
    server: '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01"/><path d="M6 18h.01"/>',
    alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    "eye-off": '<path d="M9.9 4.2A10 10 0 0 1 12 4c6.4 0 10 8 10 8a17 17 0 0 1-2.2 3.2"/><path d="M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="m2 2 20 20"/><path d="M14.1 14.1a3 3 0 0 1-4.2-4.2"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    wand: '<path d="m15 4-1 1"/><path d="M21 3 3 21"/><path d="M18 2v2"/><path d="M20 6h2"/><path d="M14 10l-1 1"/><path d="M22 10h-2"/><path d="M10 2v2"/>',
    filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5Z"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/>',
    type: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
    move: '<path d="m5 9-3 3 3 3"/><path d="m9 5 3-3 3 3"/><path d="m15 19-3 3-3-3"/><path d="m19 9 3 3-3 3"/><path d="M2 12h20"/><path d="M12 2v20"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    sidebar: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    "align-r": '<path d="M21 6H3"/><path d="M21 12H9"/><path d="M21 18H7"/>',
    "align-c": '<path d="M21 6H3"/><path d="M17 12H7"/><path d="M19 18H5"/>',
    "align-l": '<path d="M3 6h18"/><path d="M3 12h12"/><path d="M3 18h14"/>',
    bold: '<path d="M6 4h8a4 4 0 0 1 0 8H6z"/><path d="M6 12h9a4 4 0 0 1 0 8H6z"/>',
    apple: '<path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7a4.5 4.5 0 0 0-3.6-2c-1.5-.1-3 .9-3.7.9-.8 0-2-.9-3.2-.9a4.8 4.8 0 0 0-4 2.5c-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8s1.9.8 3.1.8c1.3 0 2.1-1.2 2.9-2.4a10 10 0 0 0 1.3-2.7 4.2 4.2 0 0 1-2.2-3.9Z"/><path d="M14.1 5.4A4 4 0 0 0 15 2.5a4.2 4.2 0 0 0-2.7 1.4 3.9 3.9 0 0 0-1 2.8 3.5 3.5 0 0 0 2.8-1.3Z"/>',
  };

  function icon(name, cls = "") {
    const body = ICONS[name] || ICONS.info;
    return `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  }

  function hydrateIcons(root = document) {
    root.querySelectorAll("[data-i]").forEach((el) => {
      const name = el.getAttribute("data-i");
      const tmp = document.createElement("div");
      tmp.innerHTML = icon(name, el.getAttribute("class") || "");
      const svg = tmp.firstElementChild;
      el.replaceWith(svg);
    });
  }

  /* ---------- الشخصية: شعلة "بسّوط" ---------- */
  function mascot({ arms = true, legs = true } = {}) {
    return `
<svg class="mascot" viewBox="0 0 220 266" role="img" aria-label="شعلة بسّوط — شخصية بسّطها">
  <g class="m-spark"><path d="M176 18c4 10 12 12 12 22a10 10 0 0 1-20 0c0-9 6-12 8-22Z" fill="#F0643A" stroke="#4E2D47" stroke-width="4"/></g>
  <g class="m-spark" style="animation-delay:.8s"><path d="M38 40c3 7 8 9 8 15a7 7 0 0 1-14 0c0-6 4-8 6-15Z" fill="#FFC83D" stroke="#4E2D47" stroke-width="3.5"/></g>
  ${legs ? `
  <path d="M94 218 88 246M126 218l6 28" stroke="#4E2D47" stroke-width="9" stroke-linecap="round" fill="none"/>
  <ellipse cx="80" cy="250" rx="19" ry="10" fill="#FFC83D" stroke="#4E2D47" stroke-width="4"/>
  <ellipse cx="141" cy="250" rx="19" ry="10" fill="#FFC83D" stroke="#4E2D47" stroke-width="4"/>` : ""}
  ${arms ? `
  <g class="m-arm-l"><path d="M42 160c-14 6-22 18-25 30" stroke="#4E2D47" stroke-width="8" stroke-linecap="round" fill="none"/>
  <circle cx="16" cy="196" r="13" fill="#FFF8E7" stroke="#4E2D47" stroke-width="4"/></g>
  <path d="M178 160c14 6 22 18 25 30" stroke="#4E2D47" stroke-width="8" stroke-linecap="round" fill="none"/>
  <circle cx="204" cy="196" r="13" fill="#FFF8E7" stroke="#4E2D47" stroke-width="4"/>` : ""}
  <g class="m-flame">
    <path d="M110 14c8 34 40 44 50 74 6-16 2-30-2-40 32 28 38 74 30 108-8 40-38 66-78 66s-70-26-77-64c-7-36 7-66 29-82-2 16 4 28 14 34-2-34 16-62 34-96Z" fill="#F0643A" stroke="#4E2D47" stroke-width="5" stroke-linejoin="round"/>
    <path d="M110 86c8 22 34 32 36 64 2 32-16 58-36 58-22 0-38-20-36-48 2-26 26-38 36-74Z" fill="#FFB75A"/>
  </g>
  <g>
    <ellipse class="m-eye" cx="94" cy="146" rx="7.5" ry="11.5" fill="#4E2D47"/>
    <ellipse class="m-eye" cx="128" cy="146" rx="7.5" ry="11.5" fill="#4E2D47"/>
    <circle cx="96.5" cy="141" r="2.6" fill="#fff"/><circle cx="130.5" cy="141" r="2.6" fill="#fff"/>
    <circle cx="111" cy="163" r="4.5" fill="#F07A8E"/>
    <path d="M84 172c8 22 46 22 54 0Z" fill="#fff" stroke="#4E2D47" stroke-width="4" stroke-linejoin="round"/>
    <path d="M97 173v9M111 174v10M125 173v9" stroke="#4E2D47" stroke-width="2.5" stroke-linecap="round"/>
  </g>
</svg>`;
  }

  const LOGO_MARK = `
<svg class="logo-mark" viewBox="0 0 40 40" aria-hidden="true">
  <path d="M20 3.5C11.4 3.5 6 10 6 16.6c0 5 2.6 8 5.6 10.6V31h16.8v-3.8c3-2.6 5.6-5.6 5.6-10.6C34 10 28.6 3.5 20 3.5Z" fill="#FFC83D" stroke="#1E1916" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M14.5 16.5c1.6 3 9.4 3 11 0" stroke="#1E1916" stroke-width="2.4" stroke-linecap="round" fill="none"/>
  <circle cx="15.5" cy="12.6" r="1.6" fill="#1E1916"/><circle cx="24.5" cy="12.6" r="1.6" fill="#1E1916"/>
  <path d="M14 35h12M16.5 38.5h7" stroke="#1E1916" stroke-width="2.6" stroke-linecap="round"/>
</svg>`;

  function hydrateBrand(root = document) {
    root.querySelectorAll("[data-mascot]").forEach((el) => {
      el.innerHTML = mascot({
        arms: el.dataset.mascot !== "head",
        legs: el.dataset.mascot !== "head" && el.dataset.mascot !== "bust",
      });
    });
    root.querySelectorAll("[data-logo]").forEach((el) => {
      const sub = el.hasAttribute("data-logo-sub") ? "<small class=\"ltr\">BSSATHA</small>" : "";
      el.classList.add("logo");
      el.innerHTML = `${LOGO_MARK}<span>بسّطها${sub}</span>`;
      if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", "بسّطها — الرئيسية");
    });
  }

  /* ---------- الإشعارات ---------- */
  function toast(msg, ic = "check", ms = 2600) {
    let host = document.querySelector(".toasts");
    if (!host) {
      host = document.createElement("div");
      host.className = "toasts";
      host.setAttribute("role", "status");
      host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = `${icon(ic)}<span></span>`;
    t.querySelector("span").textContent = msg;
    host.appendChild(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 260); }, ms);
  }

  /* ---------- النوافذ ---------- */
  let lastFocus = null;
  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    lastFocus = document.activeElement;
    m.classList.add("is-open");
    m.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    const f = m.querySelector("input, textarea, select, button:not([data-close-modal])");
    setTimeout(() => f && f.focus(), 60);
  }
  function closeModal(m) {
    if (typeof m === "string") m = document.getElementById(m);
    if (!m) return;
    m.classList.remove("is-open");
    m.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    lastFocus && lastFocus.focus && lastFocus.focus();
  }

  /* ---------- القوائم المنسدلة ---------- */
  function closeMenus(except) {
    document.querySelectorAll(".menu.is-open").forEach((m) => {
      if (m !== except) {
        m.classList.remove("is-open");
        const trg = document.querySelector(`[data-menu="${m.id}"]`);
        trg && trg.setAttribute("aria-expanded", "false");
      }
    });
  }
  function positionMenu(menu, trigger) {
    const r = trigger.getBoundingClientRect();
    menu.style.position = "fixed";
    const mw = menu.offsetWidth || 220;
    let left = r.right - mw; // RTL: محاذاة لليمين
    if (document.dir === "ltr") left = r.left;
    left = Math.max(8, Math.min(left, innerWidth - mw - 8));
    let top = r.bottom + 6;
    const mh = menu.offsetHeight || 200;
    if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 6);
    menu.style.left = left + "px";
    menu.style.top = top + "px";
  }

  document.addEventListener("click", (e) => {
    const openBtn = e.target.closest("[data-open-modal]");
    if (openBtn) { e.preventDefault(); openModal(openBtn.dataset.openModal); return; }
    const closeBtn = e.target.closest("[data-close-modal]");
    if (closeBtn) { closeModal(closeBtn.closest(".modal-backdrop")); return; }
    if (e.target.classList.contains("modal-backdrop")) { closeModal(e.target); return; }

    const trg = e.target.closest("[data-menu]");
    if (trg) {
      e.preventDefault();
      const menu = document.getElementById(trg.dataset.menu);
      if (!menu) return;
      const willOpen = !menu.classList.contains("is-open");
      closeMenus(menu);
      if (willOpen) {
        menu.classList.add("is-open");
        positionMenu(menu, trg);
        trg.setAttribute("aria-expanded", "true");
      } else {
        menu.classList.remove("is-open");
        trg.setAttribute("aria-expanded", "false");
      }
      return;
    }
    if (!e.target.closest(".menu")) closeMenus();
    else if (e.target.closest(".menu-item")) closeMenus();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeMenus();
      const m = document.querySelector(".modal-backdrop.is-open");
      m && closeModal(m);
    }
  });
  addEventListener("scroll", () => closeMenus(), { passive: true });
  addEventListener("resize", () => closeMenus());

  /* ---------- الظهور عند التمرير ---------- */
  function initReveal() {
    const els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("is-in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    els.forEach((el) => io.observe(el));
  }

  /* ---------- أدوات صغيرة ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = (n) => new Intl.NumberFormat("ar-SA-u-nu-latn").format(n);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function fileKind(name) {
    const ext = (name.split(".").pop() || "").toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(ext)) return { kind: "صورة", icon: "image", tone: "pink" };
    if (["mp4", "mov", "webm", "mkv"].includes(ext)) return { kind: "فيديو", icon: "video", tone: "sky" };
    if (["mp3", "wav", "m4a", "ogg"].includes(ext)) return { kind: "صوت", icon: "music", tone: "sun" };
    if (["glb", "gltf", "obj", "fbx", "stl"].includes(ext)) return { kind: "نموذج 3D", icon: "cube", tone: "mint" };
    if (["xlsx", "xls", "csv"].includes(ext)) return { kind: "جدول بيانات", icon: "table", tone: "mint" };
    if (["js", "ts", "py", "html", "css", "json", "cpp"].includes(ext)) return { kind: "كود", icon: "code", tone: "sky" };
    return { kind: "مستند", icon: "file", tone: "brand" };
  }
  const fileSize = (b) => (b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(0) + " KB" : (b / 1048576).toFixed(1) + " MB");

  function init() {
    hydrateBrand();
    hydrateIcons();
    initReveal();
  }

  window.UI = { icon, hydrateIcons, hydrateBrand, mascot, toast, openModal, closeModal, closeMenus, $, $$, fmt, esc, sleep, fileKind, fileSize, init };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
