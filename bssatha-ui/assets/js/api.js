/* ==========================================================
   بسّطها — طبقة الاتصال بالباك إند (API Layer)

   كل الواجهة تتكلم مع السيرفر من هنا فقط.
   حالياً: MOCK = true  → بيانات وهمية لتجربة الواجهة.
   عند الربط: ضع MOCK = false وعدّل BASE_URL، والواجهة لا تحتاج أي تعديل آخر.
   العقد الكامل (Endpoints + الأشكال) موثّق في README.md
   ========================================================== */
(() => {
  "use strict";

  const CONFIG = {
    BASE_URL: "/api/v1",
    MOCK: true,
  };

  async function http(method, path, body, { isForm = false } = {}) {
    const res = await fetch(CONFIG.BASE_URL + path, {
      method,
      credentials: "include", // جلسة عبر Cookie (HttpOnly) — أكثر أماناً من localStorage
      headers: isForm ? {} : { "Content-Type": "application/json" },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
    if (res.status === 401) { location.href = "auth.html?next=" + encodeURIComponent(location.pathname); return; }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.message || "حدث خطأ غير متوقع"), { status: res.status, data });
    return data;
  }

  /* ---------------- بيانات وهمية ---------------- */
  const wait = (ms = 450) => new Promise((r) => setTimeout(r, ms + Math.random() * 250));
  const MOCK_USER = { id: "u_1", name: "عبدالله", email: "abdullah@example.com", plan: "pro", credits: 340, creditsMax: 500, role: "admin" };
  const MOCK_DECKS = [
    { id: "d1", title: "الخلية البشرية: رحلة إلى الداخل", slides: 12, status: "ready", updated: "منذ ساعتين", cover: "cell", tags: ["3D", "تفاعلي"] },
    { id: "d2", title: "قوانين نيوتن بالمحاكاة", slides: 9, status: "ready", updated: "أمس", cover: "physics", tags: ["محاكاة"] },
    { id: "d3", title: "تقرير المبيعات — الربع الثالث", slides: 14, status: "generating", progress: 64, updated: "الآن", cover: "data", tags: ["بيانات"] },
    { id: "d4", title: "تاريخ الحضارات القديمة", slides: 18, status: "ready", updated: "قبل 3 أيام", cover: "history", tags: ["سينمائي"] },
    { id: "d5", title: "مقدمة في الدوال الرياضية", slides: 10, status: "draft", updated: "قبل أسبوع", cover: "math", tags: ["رسوم تفاعلية"] },
    { id: "d6", title: "لعبة الكسور للصف الخامس", slides: 7, status: "ready", updated: "قبل أسبوعين", cover: "game", tags: ["لعبة"] },
  ];

  const mock = {
    me: async () => (await wait(150), MOCK_USER),
    login: async ({ email }) => (await wait(700), { ...MOCK_USER, email }),
    signup: async ({ name, email }) => (await wait(800), { ...MOCK_USER, name, email, credits: 50, plan: "free" }),
    listDecks: async () => (await wait(), MOCK_DECKS),
    deleteDeck: async () => (await wait(300), { ok: true }),
    duplicateDeck: async (id) => (await wait(400), { ...MOCK_DECKS.find((d) => d.id === id), id: "d" + Date.now(), title: "نسخة من " + MOCK_DECKS.find((d) => d.id === id).title }),
    uploadFile: async (file, onProgress) => {
      for (let p = 0; p <= 100; p += 20) { onProgress && onProgress(p); await wait(120); }
      return { id: "f_" + Math.random().toString(36).slice(2, 8), name: file.name, size: file.size };
    },
    estimate: async ({ slides, interactive }) => (await wait(100), { credits: Math.round(slides * (interactive ? 6 : 3)) }),
    /* يُرجع jobId؛ والتقدّم يأتي من streamJob (SSE في الواقع) */
    generate: async (payload) => (await wait(500), { jobId: "job_" + Date.now(), deckId: "d_new", payload }),
    streamJob: (jobId, onEvent) => {
      const stages = [
        ["understand", "فهم الفكرة وتحليل الملفات"],
        ["plan", "تخطيط المحتوى وتوزيعه على الشرائح"],
        ["design", "اختيار التصميم والألوان والخطوط"],
        ["build", "كتابة الكود وبناء التفاعلات"],
        ["review", "مراجعة الجودة على الجوال والكمبيوتر"],
      ];
      let i = 0, slide = 0, stop = false;
      (async () => {
        for (const [key, label] of stages) {
          if (stop) return;
          onEvent({ type: "stage", key, label, index: i++ });
          const n = key === "build" ? 8 : 1;
          for (let k = 0; k < n; k++) {
            await wait(key === "build" ? 650 : 1100);
            if (key === "build") onEvent({ type: "slide", index: slide++ });
          }
        }
        onEvent({ type: "done", deckId: "d_new" });
      })();
      return () => { stop = true; };
    },
    chatEdit: async ({ message }) => {
      await wait(1100);
      return { reply: "تم. عدّلت الشريحة المحددة حسب طلبك — تقدر تتراجع بضغطة من زر التراجع.", changes: [{ op: "update", target: "slide", summary: message.slice(0, 40) }], creditsUsed: 2 };
    },
    plans: async () => (await wait(150), PLANS),
    checkout: async () => (await wait(1400), { ok: true, invoiceId: "INV-" + Date.now().toString().slice(-6) }),
  };

  const PLANS = [
    { id: "free", name: "مجاني", monthly: 0, yearly: 0, credits: 50, features: ["50 كريدت عند التسجيل", "حتى 10 شرائح للعرض", "أساليب أساسية", "تصدير برابط مشاركة"], cta: "ابدأ مجاناً" },
    { id: "pro", name: "احترافي", monthly: 39, yearly: 31, credits: 500, popular: true, features: ["500 كريدت شهرياً", "شرائح غير محدودة", "كل الأساليب (+100)", "3D ومحاكاة وألعاب", "تعديل بالمحادثة", "إزالة العلامة المائية"], cta: "اشترك الآن" },
    { id: "team", name: "فِرق ومدارس", monthly: 119, yearly: 95, credits: 2000, features: ["2000 كريدت مشتركة", "حتى 10 أعضاء", "أسلوب خاص بهويتك", "مساحة عمل مشتركة", "فواتير ضريبية", "دعم أولوية"], cta: "تواصل معنا" },
  ];

  /* ---------------- الواجهة الحقيقية ---------------- */
  const real = {
    me: () => http("GET", "/me"),
    login: (b) => http("POST", "/auth/login", b),
    signup: (b) => http("POST", "/auth/signup", b),
    listDecks: () => http("GET", "/decks"),
    deleteDeck: (id) => http("DELETE", `/decks/${id}`),
    duplicateDeck: (id) => http("POST", `/decks/${id}/duplicate`),
    uploadFile: (file, onProgress) => new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const fd = new FormData(); fd.append("file", file);
      xhr.open("POST", CONFIG.BASE_URL + "/files"); xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress && onProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => (xhr.status < 300 ? resolve(JSON.parse(xhr.responseText)) : reject(new Error("فشل الرفع")));
      xhr.onerror = () => reject(new Error("فشل الرفع"));
      xhr.send(fd);
    }),
    estimate: (b) => http("POST", "/decks/estimate", b),
    generate: (b) => http("POST", "/decks/generate", b),
    streamJob: (jobId, onEvent) => {
      const es = new EventSource(`${CONFIG.BASE_URL}/jobs/${jobId}/events`, { withCredentials: true });
      es.onmessage = (e) => { const ev = JSON.parse(e.data); onEvent(ev); if (ev.type === "done" || ev.type === "error") es.close(); };
      es.onerror = () => { onEvent({ type: "error", message: "انقطع الاتصال" }); es.close(); };
      return () => es.close();
    },
    chatEdit: (b) => http("POST", `/decks/${b.deckId}/chat`, b),
    plans: () => http("GET", "/plans"),
    checkout: (b) => http("POST", "/billing/checkout", b),
  };

  window.API = new Proxy({}, { get: (_, k) => (CONFIG.MOCK ? mock : real)[k] });
  window.API_CONFIG = CONFIG;
})();
