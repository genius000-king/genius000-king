/* ==========================================================
   بسّطها — هيكل التطبيق المشترك (الشريط الجانبي + شريط الجوال)
   الاستخدام: <body data-shell="decks">  ثم  <main class="main">…</main>
   ========================================================== */
(() => {
  "use strict";
  const { icon } = UI;
  const active = document.body.dataset.shell;
  const user = { name: "عبدالله", plan: "احترافي", credits: 340, max: 500, admin: true }; // يُستبدل بـ API.me()

  const nav = [
    ["decks", "dashboard.html", "folder", "عروضي", "6"],
    ["create", "create.html", "sparkles", "إنشاء عرض"],
    ["styles", "gallery.html", "palette", "المعرض والأساليب"],
    ["billing", "billing.html", "card", "الاشتراك والفوترة"],
    ["settings", "dashboard.html#settings", "settings", "الإعدادات"],
  ];
  const link = ([k, href, ic, label, count]) =>
    `<a href="${href}" ${k === active ? 'aria-current="page"' : ""}>${icon(ic)}${label}${count ? `<span class="count">${count}</span>` : ""}</a>`;

  const sidebar = `
  <aside class="sidebar" aria-label="القائمة الجانبية">
    <a href="index.html" data-logo></a>
    <a class="btn btn-primary btn-block" href="create.html">${icon("plus")}عرض جديد</a>
    <nav class="side-nav">${nav.map(link).join("")}</nav>
    ${user.admin ? `<nav class="side-nav"><div class="side-label">الإدارة</div><a href="admin.html">${icon("shield")}لوحة الإدارة</a></nav>` : ""}
    <div class="side-foot">
      <div class="credits">
        <div class="credits-top"><span class="muted">الرصيد</span><b>${user.credits} <small class="subtle" style="font-weight:500;font-size:.75rem">/ ${user.max}</small></b></div>
        <div class="meter"><span style="width:${(user.credits / user.max) * 100}%"></span></div>
        <a class="btn btn-soft btn-sm btn-block" href="pricing.html">${icon("zap", "i-sm")}شحن الرصيد</a>
      </div>
      <button class="user-chip" data-menu="userMenu" aria-haspopup="true" aria-expanded="false">
        <span class="avatar">${user.name[0]}</span>
        <span class="meta"><b>${user.name}</b><span>خطة ${user.plan}</span></span>
        ${icon("more", "i-sm")}
      </button>
    </div>
  </aside>
  <div class="menu" id="userMenu" role="menu">
    <a class="menu-item" href="dashboard.html#settings">${icon("user")}الحساب</a>
    <a class="menu-item" href="billing.html">${icon("card")}الاشتراك</a>
    <div class="menu-sep"></div>
    <a class="menu-item danger" href="index.html">${icon("logout")}تسجيل الخروج</a>
  </div>`;

  const topbar = `
  <header class="topbar">
    <a href="dashboard.html" data-logo></a>
    <div style="display:flex;gap:8px;align-items:center">
      <a class="credit-pill" href="billing.html">${icon("coin")}${user.credits}</a>
      <button class="avatar" data-menu="userMenu" aria-label="الحساب" style="width:34px;height:34px">${user.name[0]}</button>
    </div>
  </header>`;

  const tab = (k, href, ic, label) => `<a href="${href}" ${k === active ? 'aria-current="page"' : ""}>${icon(ic)}${label}</a>`;
  const tabbar = `
  <nav class="tabbar" aria-label="التنقل">
    ${tab("decks", "dashboard.html", "folder", "عروضي")}
    ${tab("styles", "gallery.html", "palette", "المعرض")}
    <a href="create.html" aria-label="عرض جديد"><span class="fab">${icon("plus")}</span></a>
    ${tab("billing", "billing.html", "card", "الاشتراك")}
    ${tab("settings", "dashboard.html#settings", "settings", "الإعدادات")}
  </nav>`;

  const app = document.createElement("div");
  app.className = "app";
  const main = document.querySelector("main.main");
  document.body.prepend(app);
  app.insertAdjacentHTML("beforeend", sidebar);
  const col = document.createElement("div");
  col.style.minWidth = "0";
  col.insertAdjacentHTML("beforeend", topbar);
  col.appendChild(main);
  app.appendChild(col);
  document.body.insertAdjacentHTML("beforeend", tabbar);
  UI.hydrateBrand(app);
})();
