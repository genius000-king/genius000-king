/* ==========================================================
   بسّطها — أغلفة العروض ومعاينات الأساليب (SVG خفيف بدل الصور)
   عند الربط: الغلاف الحقيقي يأتي من السيرفر كصورة (thumbnail)،
   وهذه تبقى كبديل أثناء التحميل أو عند غياب الصورة.
   ========================================================== */
(() => {
  "use strict";

  const COVERS = {
    space: `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice"><rect width="320" height="200" fill="#16153A"/>
      ${Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 73) % 320}" cy="${(i * 37) % 200}" r="${i % 5 === 0 ? 1.6 : .8}" fill="#fff" opacity=".7"/>`).join("")}
      <circle cx="230" cy="100" r="34" fill="#FFC83D"/><circle cx="230" cy="100" r="58" fill="none" stroke="#fff" stroke-opacity=".25" stroke-dasharray="3 5"/>
      <circle cx="230" cy="100" r="86" fill="none" stroke="#fff" stroke-opacity=".18" stroke-dasharray="3 5"/>
      <circle cx="172" cy="100" r="8" fill="#3B82F6"/><circle cx="292" cy="58" r="12" fill="#F0643A"/><circle cx="150" cy="140" r="6" fill="#F6A6C8"/></svg>`,
    cell: `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice"><rect width="320" height="200" fill="#2A1840"/>
      <path d="M160 26c62 0 112 30 112 76s-44 76-112 76S46 148 48 100 98 26 160 26Z" fill="#F6A6C8" stroke="#FCE3EE" stroke-width="4"/>
      <circle cx="170" cy="98" r="30" fill="#7C3AED" stroke="#C4B5FD" stroke-width="4"/><circle cx="178" cy="92" r="9" fill="#C4B5FD"/>
      <ellipse cx="98" cy="88" rx="18" ry="8" fill="#F0643A" transform="rotate(-25 98 88)"/><ellipse cx="226" cy="140" rx="20" ry="8" fill="#F0643A" transform="rotate(20 226 140)"/>
      <circle cx="232" cy="66" r="6" fill="#FFC83D"/><circle cx="110" cy="138" r="5" fill="#FFC83D"/><circle cx="128" cy="60" r="4" fill="#22B07D"/></svg>`,
    history: `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice"><rect width="320" height="200" fill="#F7D9A8"/>
      <circle cx="250" cy="56" r="26" fill="#F0643A" opacity=".85"/>
      <path d="M0 150 60 70l50 80Z" fill="#C98A4B"/><path d="M80 150 150 50l70 100Z" fill="#B0703A"/><path d="M180 150 230 92l46 58Z" fill="#C98A4B"/>
      <rect y="150" width="320" height="50" fill="#E8B878"/><path d="M0 170c50-8 100 8 160 0s110-8 160 0" stroke="#C98A4B" stroke-width="3" fill="none"/></svg>`,
    data: `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice"><rect width="320" height="200" fill="#FFF6EA"/>
      <rect x="24" y="24" width="272" height="152" rx="14" fill="#fff" stroke="#E8DDCD"/>
      ${[60, 96, 72, 120, 104, 136].map((h, i) => `<rect x="${48 + i * 28}" y="${158 - h}" width="18" height="${h}" rx="5" fill="${["#F0643A", "#FFC83D", "#3B82F6", "#F0643A", "#22B07D", "#F6A6C8"][i]}"/>`).join("")}
      <circle cx="252" cy="94" r="30" fill="none" stroke="#E8DDCD" stroke-width="12"/><circle cx="252" cy="94" r="30" fill="none" stroke="#3B82F6" stroke-width="12" stroke-dasharray="120 200" transform="rotate(-90 252 94)"/></svg>`,
    physics: `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice"><rect width="320" height="200" fill="#0E2A3B"/>
      <path d="M20 170h280" stroke="#3B82F6" stroke-width="2" opacity=".6"/>
      <path d="M40 160c40-140 120-140 160 0" stroke="#FFC83D" stroke-width="3" fill="none" stroke-dasharray="6 6"/>
      <circle cx="120" cy="56" r="14" fill="#F0643A"/><path d="M120 76v30" stroke="#fff" stroke-width="3"/>
      <rect x="226" y="126" width="56" height="44" rx="6" fill="#22B07D"/><path d="M226 148h-30" stroke="#fff" stroke-width="3"/></svg>`,
    math: `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice"><rect width="320" height="200" fill="#EEF4FF"/>
      ${Array.from({ length: 9 }, (_, i) => `<path d="M${i * 40} 0v200" stroke="#C9DAFB"/>`).join("")}${Array.from({ length: 6 }, (_, i) => `<path d="M0 ${i * 40}h320" stroke="#C9DAFB"/>`).join("")}
      <path d="M0 100h320M160 0v200" stroke="#1D58C4" stroke-width="2"/>
      <path d="M10 180C70 180 110 20 160 100s100-80 150-80" stroke="#F0643A" stroke-width="4" fill="none"/>
      <path d="M10 40c60 0 100 120 150 60s110 60 150 60" stroke="#22B07D" stroke-width="4" fill="none"/></svg>`,
    game: `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice"><rect width="320" height="200" fill="#9BE3F5"/>
      <circle cx="60" cy="50" r="20" fill="#fff"/><circle cx="84" cy="50" r="16" fill="#fff"/>
      <path d="M0 150c60-30 100-30 160 0s100 30 160 0v50H0Z" fill="#22B07D"/>
      <rect x="196" y="98" width="40" height="40" rx="6" fill="#FFC83D" stroke="#4E2D47" stroke-width="3"/><text x="216" y="125" text-anchor="middle" font-size="22" font-weight="700" fill="#4E2D47">?</text>
      <circle cx="120" cy="128" r="16" fill="#F0643A" stroke="#4E2D47" stroke-width="3"/><circle cx="115" cy="124" r="3" fill="#4E2D47"/><circle cx="125" cy="124" r="3" fill="#4E2D47"/></svg>`,
  };

  /* مكتبة الأساليب — كل أسلوب "توجّه بصري" يقرأه الذكاء الاصطناعي، لا قالب جامد */
  const STYLES = [
    { id: "playful", name: "مرح كرتوني", cat: "تعليمي", bg: "#FFF3E2", fg: "#2A1B12", ac: "#F0643A", ac2: "#FFC83D", font: "Marhey", deco: "blob" },
    { id: "academic", name: "أكاديمي هادئ", cat: "تعليمي", bg: "#F4F1EA", fg: "#1F2A37", ac: "#2F5D8A", ac2: "#C9A227", font: "Readex Pro", deco: "line" },
    { id: "cinematic", name: "سينمائي داكن", cat: "سينمائي", bg: "#0D0D12", fg: "#F5F2EA", ac: "#E8B04A", ac2: "#7A5CFF", font: "Readex Pro", deco: "glow" },
    { id: "neon", name: "تقني نيون", cat: "تقني", bg: "#0A1020", fg: "#E6F1FF", ac: "#22D3EE", ac2: "#A78BFA", font: "Readex Pro", deco: "grid" },
    { id: "minimal", name: "بسيط أبيض", cat: "رسمي", bg: "#FFFFFF", fg: "#111111", ac: "#111111", ac2: "#E5E5E5", font: "Readex Pro", deco: "none" },
    { id: "paper", name: "ورقي مرسوم", cat: "تعليمي", bg: "#FBF6EC", fg: "#3A2E22", ac: "#D2553A", ac2: "#4C8C6B", font: "Marhey", deco: "scribble" },
    { id: "space", name: "فضائي ثلاثي الأبعاد", cat: "ثلاثي الأبعاد", bg: "#14123A", fg: "#FFFFFF", ac: "#FFC83D", ac2: "#F6A6C8", font: "Readex Pro", deco: "orbit" },
    { id: "corporate", name: "شركات رسمي", cat: "رسمي", bg: "#F6F8FB", fg: "#0F1B2D", ac: "#1D4ED8", ac2: "#10B981", font: "Readex Pro", deco: "bar" },
    { id: "nature", name: "طبيعة ناعمة", cat: "علمي", bg: "#EEF5EC", fg: "#1D3B2A", ac: "#2E8B57", ac2: "#E9A23B", font: "Readex Pro", deco: "leaf" },
    { id: "magazine", name: "مجلة جريئة", cat: "سينمائي", bg: "#FFE14D", fg: "#111111", ac: "#111111", ac2: "#FF4D4D", font: "Marhey", deco: "big" },
    { id: "lab", name: "مختبر علمي", cat: "علمي", bg: "#F2FBFF", fg: "#0B2A3C", ac: "#0EA5E9", ac2: "#F43F5E", font: "Readex Pro", deco: "atom" },
    { id: "retro", name: "ريترو دافئ", cat: "سينمائي", bg: "#F3E3C7", fg: "#3B2416", ac: "#C2502A", ac2: "#2F6F73", font: "Marhey", deco: "sun" },
  ];

  function decoSVG(s) {
    switch (s.deco) {
      case "blob": return `<circle cx="250" cy="44" r="40" fill="${s.ac2}"/><circle cx="34" cy="168" r="26" fill="${s.ac}" opacity=".9"/>`;
      case "line": return `<rect x="24" y="24" width="4" height="56" fill="${s.ac}"/>`;
      case "glow": return `<circle cx="260" cy="40" r="90" fill="${s.ac2}" opacity=".25"/><circle cx="40" cy="180" r="70" fill="${s.ac}" opacity=".2"/>`;
      case "grid": return Array.from({ length: 9 }, (_, i) => `<path d="M${i * 40} 0v200" stroke="${s.ac}" stroke-opacity=".12"/>`).join("") + `<circle cx="256" cy="150" r="22" fill="none" stroke="${s.ac}" stroke-width="2"/>`;
      case "scribble": return `<path d="M210 40c20-14 40 14 60 0s30 10 30 10" stroke="${s.ac}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M24 172l18-10 18 10 18-10" stroke="${s.ac2}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
      case "orbit": return `<circle cx="250" cy="110" r="22" fill="${s.ac}"/><ellipse cx="250" cy="110" rx="56" ry="20" fill="none" stroke="#fff" stroke-opacity=".4"/><circle cx="196" cy="104" r="6" fill="${s.ac2}"/>`;
      case "bar": return `<rect x="0" y="0" width="320" height="10" fill="${s.ac}"/><rect x="214" y="110" width="16" height="50" rx="3" fill="${s.ac}"/><rect x="238" y="90" width="16" height="70" rx="3" fill="${s.ac2}"/><rect x="262" y="124" width="16" height="36" rx="3" fill="${s.ac}"/>`;
      case "leaf": return `<path d="M260 30c40 10 40 70 0 90-40-20-40-80 0-90Z" fill="${s.ac}" opacity=".8"/><path d="M260 40v76" stroke="${s.bg}" stroke-width="2"/>`;
      case "big": return `<circle cx="270" cy="160" r="60" fill="${s.ac2}"/>`;
      case "atom": return `<g transform="translate(252 112)" fill="none" stroke="${s.ac}" stroke-width="2"><ellipse rx="40" ry="14"/><ellipse rx="40" ry="14" transform="rotate(60)"/><ellipse rx="40" ry="14" transform="rotate(-60)"/></g><circle cx="252" cy="112" r="6" fill="${s.ac2}"/>`;
      case "sun": return `<circle cx="256" cy="150" r="46" fill="${s.ac}"/><path d="M200 150h112M206 166h100M214 182h84" stroke="${s.bg}" stroke-width="5"/>`;
      default: return "";
    }
  }

  function stylePreview(s) {
    return `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" style="font-family:'${s.font}',sans-serif" aria-hidden="true">
      <rect width="320" height="200" fill="${s.bg}"/>${decoSVG(s)}
      <text x="292" y="${s.deco === "big" ? 92 : 76}" text-anchor="start" font-size="${s.deco === "big" ? 34 : 24}" font-weight="700" fill="${s.fg}" direction="rtl">عنوان العرض</text>
      <rect x="${292 - 140}" y="${s.deco === "big" ? 108 : 92}" width="140" height="7" rx="3.5" fill="${s.fg}" opacity=".35"/>
      <rect x="${292 - 100}" y="${s.deco === "big" ? 122 : 106}" width="100" height="7" rx="3.5" fill="${s.fg}" opacity=".2"/>
      <rect x="${292 - 64}" y="${s.deco === "big" ? 142 : 128}" width="64" height="20" rx="10" fill="${s.ac}"/>
    </svg>`;
  }

  window.Covers = { COVERS, STYLES, stylePreview, cover: (k) => COVERS[k] || COVERS.data };
})();
