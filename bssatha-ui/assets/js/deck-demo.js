/* ==========================================================
   بسّطها — عرض تجريبي (يُستخدم في المحرر والمشغّل)

   كل شريحة مصممة على لوحة ثابتة 1280×720 ثم تُكبّر/تُصغّر لتناسب الشاشة،
   تماماً مثل محركات العروض الحقيقية. كل عنصر قابل للتحرير يحمل data-el.
   عند الربط: هذا الملف يُستبدل بالعرض الذي يولّده الذكاء (HTML/CSS/JS)
   ويُحمَّل داخل iframe معزول (sandbox) للأمان.
   ========================================================== */
(() => {
  "use strict";

  const CSS = `
  .slide { position: absolute; inset: 0; width: 1280px; height: 720px; overflow: hidden; font-family: "Readex Pro", sans-serif; color: #2A1B12; background: #FFF3E2; direction: rtl; }
  .slide [data-el] { position: absolute; }
  .slide .t-display { font-family: "Marhey", "Readex Pro", sans-serif; font-weight: 700; line-height: 1.25; }
  .slide .t-body { font-size: 26px; line-height: 1.7; color: #5A4636; }
  .slide .pill { display: inline-flex; align-items: center; gap: 8px; padding: 8px 18px; border-radius: 999px; background: #2A1B12; color: #fff; font-size: 18px; font-weight: 600; }
  .slide .blob { border-radius: 50%; }
  .slide .anim { animation: sIn .8s cubic-bezier(.2,.8,.2,1) both; animation-delay: var(--d, 0s); }
  @keyframes sIn { from { opacity: 0; transform: translateY(30px); } }
  .slide .float { animation: sFloat 5s ease-in-out infinite; }
  @keyframes sFloat { 50% { transform: translateY(-14px) rotate(2deg); } }

  /* الخلية التفاعلية */
  .cell-svg .org { cursor: pointer; transition: transform .35s cubic-bezier(.34,1.56,.64,1), filter .2s; transform-box: fill-box; transform-origin: center; }
  .cell-svg .org:hover { transform: scale(1.12); filter: drop-shadow(0 6px 10px rgba(0,0,0,.25)); }
  .cell-svg .org.on { transform: scale(1.18); filter: drop-shadow(0 0 0 #2A1B12) drop-shadow(0 8px 16px rgba(0,0,0,.3)); }
  .cell-info { background: #fff; border: 3px solid #2A1B12; border-radius: 28px; box-shadow: 8px 8px 0 #2A1B12; padding: 32px; }
  .cell-info h3 { font-family: "Marhey", sans-serif; font-size: 40px; margin: 10px 0 8px; }
  .cell-info p { font-size: 22px; line-height: 1.7; color: #5A4636; margin: 0; }
  .cell-info .swap { animation: sIn .45s cubic-bezier(.2,.8,.2,1); }
  .hint { font-size: 18px; color: #8E7663; display: flex; align-items: center; gap: 8px; }

  /* الرسم البياني */
  .bars { display: flex; align-items: flex-end; gap: 26px; height: 360px; padding: 0 10px; border-bottom: 3px solid #2A1B12; }
  .bar { position: relative; flex: 1; border-radius: 16px 16px 0 0; border: 3px solid #2A1B12; border-bottom: 0; transform-origin: bottom; animation: barUp 1s cubic-bezier(.34,1.3,.64,1) both; animation-delay: var(--d); transition: height .5s cubic-bezier(.34,1.3,.64,1); }
  @keyframes barUp { from { transform: scaleY(0); } }
  .bar b { position: absolute; top: -46px; inset-inline: 0; text-align: center; font-size: 24px; }
  .bar span { position: absolute; bottom: -44px; inset-inline: -10px; text-align: center; font-size: 18px; color: #5A4636; }
  .chart-ctrl { background: #fff; border-radius: 22px; padding: 22px 26px; border: 2px solid #E8D5BD; font-size: 20px; }
  .chart-ctrl input { width: 100%; accent-color: #F0643A; height: 30px; }

  /* المحاكاة */
  .sim { background: #14123A; border-radius: 28px; border: 3px solid #2A1B12; overflow: hidden; }
  .sim canvas { width: 100%; height: 100%; display: block; }
  .sim-ctrl { color: #fff; font-size: 20px; display: flex; align-items: center; gap: 16px; background: rgba(255,255,255,.1); padding: 14px 22px; border-radius: 18px; }
  .sim-ctrl input { flex: 1; accent-color: #FFC83D; }

  /* الاختبار */
  .quiz-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .q-opt { display: flex; align-items: center; gap: 18px; padding: 24px 28px; border-radius: 24px; background: #fff; border: 3px solid #2A1B12; box-shadow: 6px 6px 0 #2A1B12; font: 600 26px "Readex Pro", sans-serif; color: #2A1B12; cursor: pointer; text-align: start; transition: transform .15s, box-shadow .15s, background .2s; }
  .q-opt:hover { transform: translate(-2px,-2px); box-shadow: 8px 8px 0 #2A1B12; }
  .q-opt .k { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; background: #FFF3E2; border: 2px solid #2A1B12; font-size: 22px; flex: none; }
  .q-opt.right { background: #D5F3E6; animation: qPop .5s cubic-bezier(.34,1.56,.64,1); }
  .q-opt.wrong { background: #FCE1E1; animation: qShake .4s; }
  .q-opt[disabled] { cursor: default; }
  @keyframes qPop { 50% { transform: scale(1.06); } }
  @keyframes qShake { 25% { transform: translateX(-10px); } 75% { transform: translateX(10px); } }
  .q-feedback { font-size: 26px; font-weight: 600; min-height: 40px; }
  `;

  const cellSVG = `
  <svg class="cell-svg" viewBox="0 0 600 520" width="100%" height="100%">
    <defs><radialGradient id="cyto" cx="50%" cy="45%"><stop offset="0" stop-color="#FCD5E5"/><stop offset="1" stop-color="#F6A6C8"/></radialGradient></defs>
    <path class="org" data-org="membrane" d="M300 20c150 0 270 80 270 230S450 500 300 500 30 410 34 250 150 20 300 20Z" fill="url(#cyto)" stroke="#2A1B12" stroke-width="6"/>
    <g class="org" data-org="mito"><ellipse cx="140" cy="200" rx="62" ry="28" fill="#F0643A" stroke="#2A1B12" stroke-width="5" transform="rotate(-24 140 200)"/><path d="M96 214c14-22 28 10 42-12s28 10 42-12" stroke="#FFC83D" stroke-width="5" fill="none" transform="rotate(-24 140 200)"/></g>
    <g class="org" data-org="mito"><ellipse cx="450" cy="380" rx="58" ry="26" fill="#F0643A" stroke="#2A1B12" stroke-width="5" transform="rotate(20 450 380)"/><path d="M410 392c14-20 26 10 40-10s26 10 40-10" stroke="#FFC83D" stroke-width="5" fill="none" transform="rotate(20 450 380)"/></g>
    <g class="org" data-org="golgi"><path d="M420 120c30 10 60 40 66 80" stroke="#22B07D" stroke-width="16" fill="none" stroke-linecap="round"/><path d="M404 150c26 8 50 32 56 66" stroke="#22B07D" stroke-width="16" fill="none" stroke-linecap="round"/><path d="M390 180c20 6 38 26 42 52" stroke="#22B07D" stroke-width="16" fill="none" stroke-linecap="round"/></g>
    <g class="org" data-org="nucleus"><circle cx="300" cy="270" r="96" fill="#7C3AED" stroke="#2A1B12" stroke-width="6"/><circle cx="320" cy="250" r="30" fill="#C4B5FD" stroke="#2A1B12" stroke-width="4"/></g>
    <g class="org" data-org="ribo">${[[180, 360], [210, 400], [160, 320], [380, 440], [500, 260], [120, 280]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10" fill="#FFC83D" stroke="#2A1B12" stroke-width="3"/>`).join("")}</g>
  </svg>`;

  const ORGANELLES = {
    nucleus: ["🟣", "النواة", "مركز التحكم في الخلية. تحتوي على الحمض النووي DNA الذي يحمل كل التعليمات لبناء جسمك وتشغيله."],
    mito: ["🔋", "الميتوكوندريا", "محطة الطاقة. تحوّل الغذاء والأكسجين إلى طاقة (ATP) تستخدمها الخلية في كل نشاط."],
    golgi: ["📦", "جهاز جولجي", "مركز التغليف والشحن. يجهّز البروتينات ويرسلها إلى حيث تحتاجها الخلية أو خارجها."],
    ribo: ["🧵", "الريبوسومات", "مصانع البروتين الصغيرة. تقرأ التعليمات وتركّب البروتينات حبة حبة."],
    membrane: ["🛡️", "الغشاء الخلوي", "الحارس. يحيط بالخلية ويقرر ما يدخل وما يخرج منها."],
  };

  const SLIDES = [
    {
      title: "الغلاف",
      html: `<div class="slide" style="background:#FFF3E2">
        <div data-el="blob1" class="blob" style="left:-120px;top:-140px;width:420px;height:420px;background:#FFC83D"></div>
        <div data-el="blob2" class="blob" style="left:180px;top:520px;width:160px;height:160px;background:#F6A6C8"></div>
        <div data-el="cellArt" class="float" style="left:90px;top:150px;width:460px;height:400px">${cellSVG}</div>
        <div data-el="tag" class="anim" style="right:100px;top:150px;--d:.1s"><span class="pill">🧬 أحياء — الصف الأول الثانوي</span></div>
        <h1 data-el="title" class="t-display anim" style="right:100px;top:230px;width:620px;font-size:84px;margin:0;--d:.2s">الخلية البشرية: رحلة إلى الداخل</h1>
        <p data-el="sub" class="t-body anim" style="right:100px;top:470px;width:560px;margin:0;--d:.35s">اضغط، كبّر، واكتشف بنفسك كيف تعمل أصغر وحدة حيّة في جسمك.</p>
      </div>`,
    },
    {
      title: "استكشف الخلية",
      html: `<div class="slide" style="background:#FFF8EE">
        <h2 data-el="h" class="t-display anim" style="right:80px;top:56px;font-size:56px;margin:0">اضغط على أي جزء لتكتشفه</h2>
        <div data-el="cell" style="right:70px;top:150px;width:620px;height:520px">${cellSVG}</div>
        <div data-el="info" class="cell-info" style="left:80px;top:200px;width:460px">
          <div class="swap" id="orgInfo"><div style="font-size:52px">🟣</div><h3>النواة</h3><p>${ORGANELLES.nucleus[2]}</p></div>
        </div>
        <div data-el="hint" class="hint" style="left:80px;top:610px">👆 جرّب الضغط على الميتوكوندريا البرتقالية</div>
      </div>`,
      init(root) {
        const info = root.querySelector("#orgInfo");
        const orgs = root.querySelectorAll(".org");
        const pick = (k) => {
          orgs.forEach((o) => o.classList.toggle("on", o.dataset.org === k));
          const [e, t, d] = ORGANELLES[k];
          info.classList.remove("swap"); void info.offsetWidth; info.classList.add("swap");
          info.innerHTML = `<div style="font-size:52px">${e}</div><h3>${t}</h3><p>${d}</p>`;
        };
        orgs.forEach((o) => o.addEventListener("click", (ev) => { ev.stopPropagation(); pick(o.dataset.org); }));
        pick("nucleus");
      },
    },
    {
      title: "بالأرقام",
      html: `<div class="slide" style="background:#FFFFFF">
        <h2 data-el="h" class="t-display anim" style="right:80px;top:56px;font-size:56px;margin:0">كم يعيش كل نوع من الخلايا؟</h2>
        <p data-el="p" class="t-body anim" style="right:80px;top:140px;margin:0;--d:.1s">عمر الخلية بالأيام (تقريبي) — حرّك المؤشر لتقارن بعمر الإنسان.</p>
        <div data-el="chart" style="right:80px;top:250px;width:760px">
          <div class="bars" id="bars"></div>
        </div>
        <div data-el="ctrl" class="chart-ctrl" style="left:70px;top:270px;width:340px">
          <div style="font-weight:600;margin-bottom:6px">مقياس الرسم</div>
          <input type="range" id="scale" min="1" max="3" step="1" value="1" aria-label="مقياس الرسم">
          <div id="scaleLbl" style="color:#8E7663;font-size:18px">خطي</div>
        </div>
      </div>`,
      init(root) {
        const data = [["الأمعاء", 4, "#F0643A"], ["الجلد", 30, "#FFC83D"], ["الدم الأحمر", 120, "#F6A6C8"], ["العظام", 3650, "#3B82F6"], ["الأعصاب", 25000, "#22B07D"]];
        const bars = root.querySelector("#bars"), sc = root.querySelector("#scale"), lbl = root.querySelector("#scaleLbl");
        bars.innerHTML = data.map(([n, v, c], i) => `<div class="bar" style="background:${c};--d:${i * .1}s"><b>${v.toLocaleString("ar-SA-u-nu-latn")}</b><span>${n}</span></div>`).join("");
        const draw = () => {
          const mode = +sc.value, f = mode === 1 ? (v) => v / 25000 : mode === 2 ? (v) => Math.sqrt(v / 25000) : (v) => Math.log10(v + 1) / Math.log10(25001);
          lbl.textContent = ["", "خطي — الفروق الحقيقية", "جذري — يوضّح الصغير", "لوغاريتمي — يقارن الكل"][mode];
          [...bars.children].forEach((b, i) => (b.style.height = Math.max(4, f(data[i][1]) * 340) + "px"));
        };
        sc.addEventListener("input", draw); draw();
      },
    },
    {
      title: "محاكاة الانتشار",
      html: `<div class="slide" style="background:#0E0C2A;color:#fff">
        <h2 data-el="h" class="t-display anim" style="right:80px;top:50px;font-size:54px;margin:0;color:#fff">كيف تدخل المواد إلى الخلية؟</h2>
        <p data-el="p" class="t-body anim" style="right:80px;top:130px;margin:0;color:#C9C3E6;width:900px">الجزيئات تنتقل من التركيز العالي إلى المنخفض. ارفع الحرارة وراقب السرعة.</p>
        <div data-el="sim" class="sim" style="left:80px;top:210px;width:1120px;height:380px"><canvas id="diff"></canvas></div>
        <div data-el="ctrl" class="sim-ctrl" style="left:80px;top:610px;width:560px">🌡️ الحرارة <input type="range" id="temp" min="0.3" max="3" step="0.1" value="1" aria-label="الحرارة"> <b id="tempOut">37°</b></div>
        <div data-el="reset" style="right:80px;top:610px"><button class="pill" id="resetSim" style="border:0;cursor:pointer;height:58px;padding:0 26px;background:#FFC83D;color:#2A1B12;font-size:20px">↺ إعادة التجربة</button></div>
      </div>`,
      init(root) {
        const cv = root.querySelector("#diff"), ctx = cv.getContext("2d");
        const W = 1120, H = 380; cv.width = W; cv.height = H;
        let ps, raf, alive = true;
        const reset = () => { ps = Array.from({ length: 160 }, () => ({ x: 40 + Math.random() * 360, y: 20 + Math.random() * (H - 40), vx: Math.random() - .5, vy: Math.random() - .5 })); };
        reset();
        const temp = root.querySelector("#temp");
        temp.addEventListener("input", () => (root.querySelector("#tempOut").textContent = Math.round(12 + temp.value * 25) + "°"));
        root.querySelector("#resetSim").addEventListener("click", reset);
        const memX = W / 2;
        const tick = () => {
          if (!alive || !cv.isConnected) return;
          const t = +temp.value;
          ctx.fillStyle = "#14123A"; ctx.fillRect(0, 0, W, H);
          // الغشاء بثقوب
          ctx.fillStyle = "#F6A6C8";
          for (let y = 0; y < H; y += 60) ctx.fillRect(memX - 6, y + 22, 12, 38);
          let right = 0;
          ps.forEach((p) => {
            p.vx += (Math.random() - .5) * .6 * t; p.vy += (Math.random() - .5) * .6 * t;
            p.vx *= .92; p.vy *= .92;
            const nx = p.x + p.vx * t * 2.2, ny = p.y + p.vy * t * 2.2;
            const crossing = (p.x < memX) !== (nx < memX);
            const inHole = (ny % 60) < 22;
            if (crossing && !inHole) p.vx *= -1; else p.x = nx;
            p.y = ny;
            if (p.x < 8 || p.x > W - 8) p.vx *= -1, p.x = Math.max(8, Math.min(W - 8, p.x));
            if (p.y < 8 || p.y > H - 8) p.vy *= -1, p.y = Math.max(8, Math.min(H - 8, p.y));
            if (p.x > memX) right++;
            ctx.fillStyle = p.x > memX ? "#22D3EE" : "#FFC83D";
            ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 7); ctx.fill();
          });
          ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.font = "600 22px Readex Pro"; ctx.textAlign = "center";
          ctx.fillText(`خارج الخلية: ${ps.length - right}`, W * .25, 34);
          ctx.fillText(`داخل الخلية: ${right}`, W * .75, 34);
          raf = requestAnimationFrame(tick);
        };
        tick();
        return () => { alive = false; cancelAnimationFrame(raf); };
      },
    },
    {
      title: "اختبر نفسك",
      html: `<div class="slide" style="background:#FFF3E2">
        <div data-el="blob" class="blob" style="right:-90px;bottom:-110px;width:320px;height:320px;background:#FFC83D;position:absolute"></div>
        <div data-el="tag" style="right:80px;top:60px"><span class="pill">سؤال 1 من 1</span></div>
        <h2 data-el="q" class="t-display" style="right:80px;top:130px;width:1100px;font-size:54px;margin:0">أي جزء يُعد «محطة الطاقة» في الخلية؟</h2>
        <div data-el="opts" class="quiz-opts" style="right:80px;top:290px;width:1120px">
          <button class="q-opt" data-ok="0"><span class="k">أ</span>النواة</button>
          <button class="q-opt" data-ok="1"><span class="k">ب</span>الميتوكوندريا</button>
          <button class="q-opt" data-ok="0"><span class="k">ج</span>جهاز جولجي</button>
          <button class="q-opt" data-ok="0"><span class="k">د</span>الغشاء الخلوي</button>
        </div>
        <div data-el="fb" class="q-feedback" id="qfb" style="right:80px;top:600px;width:900px"></div>
      </div>`,
      init(root) {
        const opts = root.querySelectorAll(".q-opt"), fb = root.querySelector("#qfb");
        opts.forEach((o) => o.addEventListener("click", () => {
          const ok = o.dataset.ok === "1";
          o.classList.add(ok ? "right" : "wrong");
          if (ok) {
            opts.forEach((x) => (x.disabled = true));
            fb.innerHTML = "🎉 صحيح! الميتوكوندريا تنتج الطاقة على شكل ATP.";
            fb.style.color = "#0E7A53";
          } else {
            o.disabled = true;
            fb.innerHTML = "قريب… فكّر في الجزء البرتقالي الذي يشبه البطارية 🔋";
            fb.style.color = "#B23E17";
          }
        }));
      },
    },
    {
      title: "الخاتمة",
      html: `<div class="slide" style="background:#2A1B12;color:#fff">
        <div data-el="b1" class="blob" style="left:-80px;top:-80px;width:300px;height:300px;background:#F0643A;opacity:.9"></div>
        <div data-el="b2" class="blob" style="right:120px;bottom:-140px;width:360px;height:360px;background:#7C3AED;opacity:.7"></div>
        <h2 data-el="h" class="t-display anim" style="right:0;left:0;top:220px;text-align:center;font-size:96px;margin:0;color:#FFC83D">شكراً لكم!</h2>
        <p data-el="p" class="t-body anim" style="right:0;left:0;top:380px;text-align:center;margin:0;color:#E8DCCB;--d:.2s">أنت الآن تعرف خلاياك أكثر من 90% من الناس 😉</p>
        <div data-el="c" class="anim" style="right:0;left:0;top:470px;text-align:center;--d:.35s"><span class="pill" style="background:#fff;color:#2A1B12">صُنع بـ بسّطها في 6 دقائق</span></div>
      </div>`,
    },
  ];

  window.DeckDemo = { CSS, SLIDES, W: 1280, H: 720 };
})();
