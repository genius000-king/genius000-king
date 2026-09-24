// ═══════════════════════════════════════════════════════════════════
//  الحلقة: "شاف له مقطعين عن AI وجالس يتفلسف!"
//  كل جملة من السكربت = مشهد (beat). طول المشهد يُحسب من عدد كلماته
//  (timing.mjs)، والمرئي هنا في خريطة V. الصوت البشري يُضاف لاحقاً فوق.
// ═══════════════════════════════════════════════════════════════════
import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ensureFonts, FONT } from "../../theme/fonts";
import { Camera } from "../../fx/Camera";
import { Grain, Vignette } from "../../fx/Finish";
import { DarkStage } from "../../bg/GraphPaper";
import { Sfx } from "../../sfx/library";
import { BilingualSplit, CountUp, GlitchText, InkReveal, SLAM_IMPACT, Slam, Typewriter, WordCascade } from "../../text/Kinetic";
import { LogoReveal } from "../../broll/LogoReveal";
import { MacWindow } from "../../broll/MacWindow";
import { AppTile, Bubble, CHALK, ChalkBoard, Chapter, CloneGrid, FakeCard, LIME, LogoOrbit, RED, Stamp, Sticker } from "../../kit/Collage";
import { BarChart, BrowserStrain, ChatMock, CodeEditor, ContextDecay, CycleLoop, EchoWords, EmptyContrib, EventLoop, OneInHundred, SandboxCage, TableReveal, ToolLog, Versus } from "../../kit/Tech";
import { RecBeat } from "../RecBeat";
import { timeline } from "../timing.mjs";
import script from "./script.json";
import recApp from "../../../public/broll/rec/yt-ar-app.json";
import recLlm from "../../../public/broll/rec/yt-ar-llm.json";
import recFlappy from "../../../public/broll/rec/yt-flappy.json";
import recHumanEval from "../../../public/broll/rec/humaneval.json";
import recSwe from "../../../public/broll/rec/swebench.json";
import recMcp from "../../../public/broll/rec/mcp.json";
import recMdn from "../../../public/broll/rec/mdn-eventloop.json";

ensureFonts();

export const TL = timeline(script as [string, string, string?, string?][]);
export const TOTAL = TL[TL.length - 1].from + TL[TL.length - 1].frames;

type Bg = "chalk" | "dark" | "none";
type Beat = { v: (d: number) => React.ReactNode; bg?: Bg; impacts?: number[]; hand?: number; push?: number };

// ───────────── مساعدات صغيرة ─────────────
const W = CHALK;
/** مشهدان في مشهد واحد (للجمل الطويلة): يبدّل المرئي عند نسبة من الطول */
const Two: React.FC<{ d: number; at?: number; a: React.ReactNode; b: React.ReactNode }> = ({ d, at = 0.5, a, b }) => {
  const cut = Math.round(d * at);
  return (
    <>
      <Sequence durationInFrames={cut} layout="none"><AbsoluteFill>{a}</AbsoluteFill></Sequence>
      <Sequence from={cut} layout="none"><AbsoluteFill>{b}</AbsoluteFill></Sequence>
    </>
  );
};
const Chips: React.FC<{ items: string[]; gap?: number; size?: number; y?: number; color?: string; font?: string }> = ({ items, gap = 7, size = 110, y = 0, color = "#111", font = FONT.mono }) => (
  <>
    {items.map((t, i) => (
      <Sticker key={i} delay={i * gap} x={(i % 2 ? -1 : 1) * 260} y={y + (i - (items.length - 1) / 2) * size * 1.9} rot={(i % 2 ? 4 : -5)} seed={i}>
        <div dir="auto" style={{ background: i % 2 ? LIME : W, color, fontFamily: font, fontSize: size, padding: `${size * 0.1}px ${size * 0.35}px`, borderRadius: size * 0.2, fontWeight: 700 }}>{t}</div>
      </Sticker>
    ))}
  </>
);
const Tiles: React.FC<{ brands: string[]; size?: number; gap?: number; label?: string }> = ({ brands, size = 260, gap = 8, label }) => (
  <>
    {brands.map((b, i) => (
      <Sticker key={b} delay={i * gap} x={(i - (brands.length - 1) / 2) * -(size + 90)} y={label ? -60 : 0} rot={i % 2 ? 5 : -6} edge={7} seed={i}>
        <AppTile brand={b} size={size} />
      </Sticker>
    ))}
    {label && <Caption text={label} y={300} delay={brands.length * gap} />}
  </>
);
const Caption: React.FC<{ text: string; y?: number; delay?: number; size?: number; color?: string }> = ({ text, y = 360, delay = 0, size = 64, color = W }) => {
  const f = useCurrentFrame();
  const p = spring({ frame: f - delay, fps: 30, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 50 }}>
      <div dir="rtl" style={{ transform: `translateY(${y + (1 - p) * 30}px)`, opacity: p, fontFamily: FONT.display, fontSize: size, color, textShadow: "0 4px 0 rgba(0,0,0,0.35)", textAlign: "center", maxWidth: 1600 }}>{text}</div>
    </AbsoluteFill>
  );
};
const Source: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position: "absolute", left: 50, bottom: 36, fontFamily: FONT.mono, fontSize: 20, color: "rgba(243,241,232,0.6)", direction: "ltr" }}>المصدر · {text}</div>
);
const Thumb: React.FC<{ w?: number; delay?: number; x?: number; y?: number; rot?: number }> = ({ w = 1000, delay = 0, x = 0, y = 0, rot = -3 }) => (
  <Sticker delay={delay} x={x} y={y} rot={rot} edge={9}>
    <Img src={staticFile("broll/thumb.png")} style={{ width: w, borderRadius: 18, display: "block" }} />
  </Sticker>
);
const GlassPanel: React.FC<{ children: React.ReactNode; title?: string; url?: string; dark?: boolean }> = ({ children, url, title, dark = true }) => (
  <MacWindow url={url} title={title} width={1560} dark={dark}>{children}</MacWindow>
);

// ═══════════════════════════════════════════════════════════════════
//  خريطة المشاهد
// ═══════════════════════════════════════════════════════════════════
const V: Record<string, Beat> = {
  // ── الفصل 1: الهوك ──
  h1: { v: () => <Slam text="تعبت!" size={330} color={W} accent={RED} font={FONT.display} />, impacts: [SLAM_IMPACT] },
  h2: { v: () => (<>
    <Sticker x={330} y={-40} rot={-6}><FakeCard title="الذكاء الاصطناعي في 5 دقائق" w={560} hue={200} /></Sticker>
    <Sticker delay={9} x={-330} y={40} rot={5} seed={2}><FakeCard title="كل شيء عن AI في 5 دقائق" w={560} hue={330} seed={1} /></Sticker>
    <Caption text="مقطعين… 5 دقائق" y={380} delay={18} />
  </>) },
  h3: { v: (d) => (<>
    <Thumb w={1150} y={-40} />
    <Sticker delay={Math.round(d * 0.35)} x={560} y={-330} rot={8} seed={3}><div style={{ background: LIME, fontFamily: FONT.display, fontSize: 72, padding: "6px 34px", borderRadius: 14, color: "#111" }}>بروفيسور</div></Sticker>
    <Sticker delay={Math.round(d * 0.55)} x={-520} y={330} rot={-7} seed={4}><div dir="rtl" style={{ background: W, fontFamily: FONT.display, fontSize: 64, padding: "6px 34px", borderRadius: 14, color: "#111" }}>خبير استراتيجي</div></Sticker>
  </>) },
  h4: { v: () => (<>
    <Typewriter text="الخبرة في الذكاء الاصطناعي: أسبوعين" size={96} color={W} font={FONT.digital} caret={LIME} />
  </>) },
  h5: { v: () => <EmptyContrib />, bg: "none" },
  h6: { v: (d) => (<>
    <Bubble text="كيف تسوي مدري إيش بالذكاء الاصطناعي!" x={200} y={-170} rot={-3} size={68} />
    <Bubble text="كيف تبني تطبيق بضغطة زر وتصير ملياردير!" delay={Math.round(d * 0.45)} x={-160} y={170} rot={3} size={68} tail="left" bg={LIME} />
  </>) },
  h7: { v: (d) => (<>
    <EchoWords words={["AI", "ثورة", "Agent", "المستقبل", "Prompt", "AGI", "ملياردير", "LLM", "بضغطة زر"]} />
    <Stamp text="ولا سالفة" at={Math.round(d * 0.72)} size={170} font={FONT.display} />
  </>) },
  h8: { v: () => <WordCascade text="المشكلة الأكبر في صناع المحتوى نفسهم" keys={["صناع", "المحتوى"]} size={130} color={W} keyColor={LIME} highlight={null} font={FONT.display} /> },
  h9: { v: (d) => (<>
    <CountUp to={95} suffix="%" size={320} color={W} accent={LIME} labelColor={W} label="من المحتوى العربي في المجال" note="تقدير شخصي · ليس إحصائية" frames={Math.min(45, d - 20)} />
  </>) },
  h10: { v: () => <CloneGrid stampAt={34} />, bg: "dark" },
  h11: { v: () => <Tiles brands={["x", "instagram", "youtube"]} size={280} gap={9} /> },
  h12: { v: (d) => <RecBeat rec={recApp} frames={d} url="youtube.com/results?search_query=كيف+تبني+تطبيق+بالذكاء+الاصطناعي" />, bg: "dark", hand: 0.5 },
  h13: { v: () => <InkReveal text="نادراً… نادراً جداً" size={170} color={W} captionColor="rgba(243,241,232,0.75)" caption="Real projects. Real depth. No show." /> },
  h14: { v: (d) => (<>
    <LogoOrbit brands={["openai", "claude", "googlegemini", "meta", "deepseek", "perplexity"]} radius={620} size={150} offsetY={170} />
    <Sequence from={Math.round(d * 0.3)} layout="none">
      <Caption text="شاف له مقطعين عن AI" y={-330} size={120} />
      <Caption text="وجالس يتفلسف!" y={-170} size={150} color={LIME} delay={10} />
    </Sequence>
    <Sfx event="title.slam" at={Math.round(d * 0.3) + 10} />
  </>), impacts: [], push: 0.06 },

  // ── الفصل 2 ──
  s1: { v: () => <Typewriter text="> تحليل المشكلة من الأساس_" size={100} color={LIME} font={FONT.digital} caret={W} /> },
  s2: { v: () => <WordCascade text="المشكلة في نوعية الشروحات نفسها" keys={["نوعية", "الشروحات"]} size={140} color={W} keyColor={LIME} highlight={null} font={FONT.punch} /> },
  s3: { v: (d) => <RecBeat rec={recLlm} frames={d} url="youtube.com/results?search_query=ما+هو+LLM" />, bg: "dark", hand: 0.5 },
  s4: { v: () => (<>
    <Sticker rot={-4}><FakeCard title="شرح كامل: ما هو الـ LLM؟ (اكتشاف خطير)" w={720} hue={45} /></Sticker>
    <Stamp text="10:00" at={22} size={120} font={FONT.mono} x={380} y={-230} rot={10} color={LIME} />
  </>) },
  s5: { v: (d) => <Chips items={["LLM؟", "Agent؟", "Prompt؟"]} gap={Math.round(d / 3.4)} size={130} /> },
  s6: { v: () => <EchoWords words={["What is LLM?", "ما هو LLM", "What is an Agent", "Prompt Engineering", "شرح Prompt", "LLM explained", "AI Agents 101"]} /> },
  s7: { v: () => <GlitchText text="مستوى الصفر" size={220} color={W} bursts={[40]} />, bg: "dark" },
  s8: { v: () => <Slam text="المشاهد مو غبي" size={210} color={W} accent={LIME} font={FONT.display} />, impacts: [SLAM_IMPACT] },
  s9: { v: () => <CycleLoop center="محتوى المبتدئين" nodes={["ما هو LLM؟", "كيف تكتب Prompt", "اصنع تطبيق بضغطة", "ما هو Agent؟"]} /> },
  s10: { v: () => <WordCascade text="محد يتجرأ يروح للمتقدم" keys={["يتجرأ"]} size={150} color={W} keyColor={LIME} highlight={null} font={FONT.display} /> },
  s11: { v: () => <LogoOrbit brands={["python", "cplusplus", "rust", "kotlin", "github", "huggingface"]} radius={520} center={<div dir="rtl" style={{ fontFamily: FONT.display, fontSize: 90, color: W, textAlign: "center" }}>أنت… الجاد</div>} /> },
  s12: { v: () => <Versus right={{ title: "المتوفر عربياً", items: ["ما هو LLM؟", "كيف تكتب Prompt", "اصنع تطبيق بضغطة زر"], color: RED }} left={{ title: "المفقود", items: ["الهندسة العكسية", "أنظمة معقدة حقيقية", "بيانات ضخمة الحجم", "ربط عميق مع النظام"], color: LIME }} /> },
  s13: { v: () => <Slam text="والسبب؟" size={280} color={W} accent={RED} font={FONT.display} />, impacts: [SLAM_IMPACT] },
  s14: { v: () => <InkReveal text="فاقد الشيء لا يعطيه" size={170} color={W} captionColor="rgba(243,241,232,0.75)" caption="You can't teach depth you don't have." /> },

  // ── الفصل 3 ──
  t1: { v: () => (<>
    <Sticker rot={-3} edge={8}>
      <div dir="rtl" style={{ width: 900, height: 560, background: "#e8c77a", borderRadius: "0 24px 24px 24px", padding: 60, fontFamily: FONT.display, fontSize: 90, color: "#3b2a0a", boxShadow: "inset 0 -20px 0 rgba(0,0,0,0.08)" }}>
        ملف:<br />اختبار النماذج
      </div>
    </Sticker>
    <Stamp text="مهزلة" at={26} size={190} font={FONT.display} y={80} />
  </>) },
  t2: { v: () => <LogoOrbit brands={["openai", "claude", "googlegemini", "meta", "deepseek", "perplexity"]} radius={500} size={160} speed={1.6} /> },
  t3: { v: (d) => (<>
    <Sticker x={-420} y={40} rot={4}><FakeCard title="هذا النموذج دمّر ChatGPT!" w={600} hue={10} seed={1} /></Sticker>
    <Bubble text="جلد كل النماذج ودمّر السوق!" delay={Math.round(d * 0.4)} x={360} y={-150} size={66} />
  </>) },
  t4: { v: (d) => (<>
    <Slam text="كيف اختبرته؟" size={220} color={W} accent={LIME} font={FONT.display} y={-60} />
    <Caption text="وش المعايير الهندسية؟" y={170} delay={Math.round(d * 0.5)} color={LIME} />
  </>), impacts: [SLAM_IMPACT] },
  t5: { v: (d) => (<GlassPanel url="chat.example.com">
    <ChatMock prompt="اصنع لي لعبة Flappy Bird" reply={["const bird = { y: 200, v: 0 };", "function flap() { bird.v = -8; }", "function loop() {", "  bird.v += 0.5; bird.y += bird.v;", "  draw(); requestAnimationFrame(loop);", "}"]} verdict="هزم الجميع!!" verdictAt={Math.round(d * 0.72)} />
  </GlassPanel>), bg: "dark" },
  t6: { v: () => <Slam text="2026" size={380} color={LIME} accent={RED} font={FONT.heavy} />, impacts: [SLAM_IMPACT] },
  t7: { v: (d) => (<>
    <RecBeat rec={recHumanEval} frames={d} url="arxiv.org/abs/2107.03374" from={0.8} />
    <Source text="Chen et al., Evaluating Large Language Models Trained on Code (HumanEval), 2021" />
  </>), bg: "dark", hand: 0.5 },
  t8: { v: () => <BarChart title="HumanEval: الاختبار اللي تشبّع" max={100} bars={[
    { label: "Codex", note: "2021", value: 28.8, color: "#9ad0ff" },
    { label: "GPT-4", note: "2023", value: 67, color: "#ffd166" },
    { label: "نماذج اليوم", note: "الأقوى", value: 90, color: LIME },
  ]} line={{ value: 90, label: "90%+ ← الاختبار فقد معناه" }} source="Chen et al. 2021 · OpenAI GPT-4 Technical Report 2023" /> },
  t9: { v: (d) => <RecBeat rec={recFlappy} frames={d} url="youtube.com/results?search_query=AI+model+test+flappy+bird" />, bg: "dark", hand: 0.5 },
  t10: { v: (d) => (<Two d={d} at={0.45}
    a={<GlitchText text="مليارات الدولارات والتدريب…" size={130} color={W} bursts={[]} />}
    b={<><Sticker rot={-4}><FakeCard title="اختبرت النموذج بلعبة فلابي بيرد!" w={640} hue={120} /></Sticker><Stamp text="؟!" at={10} size={220} x={400} y={-200} /></>} />), bg: "dark" },
  t11: { v: () => <Versus right={{ title: "الهواة", items: ["تطبيق ساعة", "فلابي بيرد", "انطباع شخصي", "فيديو بعد ساعة من الإطلاق"], color: RED }} left={{ title: "المهندسين", items: ["معايير معلنة", "مشاريع حقيقية", "نتائج قابلة للتكرار", "مقارنة منهجية"], color: LIME }} /> },
  t12: { v: (d) => (<>
    <RecBeat rec={recSwe} frames={d} url="swebench.com" />
  </>), bg: "dark", hand: 0.5 },
  t13: { v: () => (<GlassPanel url="github.com/django/django">
    <ToolLog title="SWE-bench · مهمة حقيقية من مستودع حقيقي" lines={[
      { t: "$ git clone django/django        # 2,294 مهمة من 12 مستودع Python" },
      { t: "  django/db/models/query.py" }, { t: "  django/db/models/sql/compiler.py" }, { t: "  django/forms/fields.py" },
      { t: "  django/utils/dateparse.py" }, { t: "  … آلاف الملفات" },
      { t: "issue #xxxxx: QuerySet.union() ignores ordering  ✗", ok: false },
    ]} />
  </GlassPanel>), bg: "dark" },
  t14: { v: () => (<GlassPanel url="terminal">
    <ToolLog title="agent run" lines={[
      { t: "→ read_file  django/db/models/query.py" },
      { t: "→ read_file  django/db/models/sql/compiler.py" },
      { t: "→ edit       compiler.py  (+14 −3)" },
      { t: "→ edit       query.py     (+6 −1)" },
      { t: "→ run_tests  tests/queries/" },
      { t: "✗ FAIL_TO_PASS  2/2 failing   (قبل الإصلاح)", ok: false },
      { t: "✓ FAIL_TO_PASS  2/2 passing   ✓ PASS_TO_PASS  312/312 — ما انكسر شي", ok: true },
    ]} />
  </GlassPanel>), bg: "dark" },
  t15: { v: () => <Slam text="هذا هو الاختبار" size={210} color={LIME} accent={W} font={FONT.display} />, impacts: [SLAM_IMPACT] },
  t16: { v: () => <CloneGrid title={2} stampText="سطحي" stampAt={30} />, bg: "dark" },
  t17: { v: (d) => (<GlassPanel url="clock.js">
    <CodeEditor file="clock.js" lines={["const el = document.getElementById('t');", "function tick() {", "  const d = new Date();", "  el.textContent = d.toLocaleTimeString();", "}", "setInterval(tick, 1000);", "tick();", "", "// هذا كل شي.", "// ٩ أسطر… وهزم الجميع؟"]} flagLine={9} flagText="10 أسطر" perLine={Math.max(3, Math.round(d * 0.5 / 10))} />
  </GlassPanel>), bg: "dark" },

  // ── الفصل 4 ──
  w1: { v: () => <GlitchText text="أكبر عاهة تقنية" size={200} color={W} bursts={[34]} />, bg: "dark" },
  w2: { v: () => (<GlassPanel url="chat.example.com">
    <ChatMock prompt="اصنع لي لعبة 3D متكاملة تشتغل بالمتصفح" reply={["import * as THREE from 'three';", "const scene = new THREE.Scene();", "// 40,000 شجرة + ماء + ظلال + فيزياء…", "for (let i = 0; i < 40000; i++) scene.add(tree());"]} />
  </GlassPanel>), bg: "dark" },
  w3: { v: (d) => <GlassPanel url="localhost:5173/game.html"><BrowserStrain crashAt={Math.round(d * 0.7)} /></GlassPanel>, bg: "dark" },
  w4: { v: () => <Bubble text="شفتوا؟ النموذج غبي وما يفهم بالألعاب!" size={80} rot={-3} /> },
  w5: { v: (d) => (<>
    <Slam text="العيب مو بالنموذج" size={180} color={W} accent={RED} font={FONT.display} y={-70} />
    <Caption text="العيب في فهمك للبيئة" y={140} delay={Math.round(d * 0.5)} color={LIME} size={90} />
  </>), impacts: [SLAM_IMPACT] },
  w6: { v: () => <WordCascade text="الويب مو مصنوع لمحركات 3D ضخمة" keys={["مو", "مصنوع"]} size={130} color={W} keyColor={LIME} highlight={null} font={FONT.display} /> },
  w7: { v: (d) => (<Two d={d} at={0.45}
    a={<Tiles brands={["unity", "unrealengine"]} size={300} label="كنز صناعة الألعاب" />}
    b={<><Tiles brands={["html5"]} size={200} /><Caption text="…بوسط صفحة موقع؟" y={260} size={90} color={LIME} /></>} />) },
  w8: { v: (d) => <RecBeat rec={recMdn} frames={d} url="developer.mozilla.org · JavaScript execution model" />, bg: "dark", hand: 0.5 },
  w9: { v: () => <LogoReveal brand="javascript" at={16} size={280} label="JavaScript" />, bg: "dark" },
  w10: { v: () => <Versus right={{ title: "JavaScript", items: ["تُترجم وقت التشغيل (JIT)", "جامع قمامة يوقف التنفيذ", "خيط رئيسي واحد للمنطق والرسم"], color: "#F7DF1E" }} left={{ title: "C++ / Rust", items: ["تُترجم مسبقاً لكود الآلة", "تحكم كامل بالذاكرة", "خيوط متعددة حقيقية", "وصول مباشر للعتاد"], color: LIME }} /> },
  w11: { v: () => <EventLoop />, bg: "chalk" },
  w12: { v: (d) => (<Two d={d} at={0.5}
    a={<SandboxCage chips={["Web Workers", "WebGL", "WebGPU"]} />}
    b={<><Caption text="مقيّدة داخل المتصفح" y={-60} size={120} /><Caption text="ما تعتصر المعالج وكرت الشاشة كاملين" y={90} size={70} color={LIME} delay={8} /></>} />) },
  w13: { v: (d) => (<Two d={d} at={0.4}
    a={<WordCascade text="ما تروح للمتصفح المحدود" keys={["المحدود"]} size={140} color={W} keyColor={RED} highlight={null} font={FONT.display} />}
    b={<Tiles brands={["unity", "unrealengine"]} size={320} label="اختبره في محرك ألعاب حقيقي" />} />) },
  w14: { v: (d) => (<>
    <RecBeat rec={recMcp} frames={d} url="modelcontextprotocol.io" />
  </>), bg: "dark", hand: 0.5 },
  w15: { v: () => (<GlassPanel url="terminal · mcp">
    <ToolLog title="model ⇄ MCP ⇄ Unity Editor" lines={[
      { t: "→ unity.list_scenes()" }, { t: "→ unity.create_gameobject('Player')" }, { t: "→ fs.write  Assets/Scripts/PlayerController.cs" },
      { t: "→ unity.compile()" }, { t: "✗ CS0103: 'rb' does not exist", ok: false }, { t: "→ fs.edit  PlayerController.cs (+2 −1)" },
      { t: "✓ compiled · play mode 60 FPS", ok: true },
    ]} />
  </GlassPanel>), bg: "dark" },

  // ── الفصل 5 ──
  m1: { v: () => <TableReveal head={["المعيار الهندسي", "الوصف التقني", "ما يفعله صنّاع المحتوى"]} rows={[
    ["مقياس الكسل (Laziness)", "إكمال الأكواد المعقدة بدون اختصارات مثل // todo", "يطلبون كوداً من 5 أسطر فلا يظهر الكسل"],
    ["تدهور السياق (Decay)", "متى يفقد التركيز ويهلوس بعد آلاف التوكنات؟", "محادثة جديدة لكل طلب بسيط"],
    ["الربط مع MCP", "التفاعل مع ملفات النظام وتنفيذ الأوامر فعلياً", "نسخ الكود يدوياً للمحرر"],
  ]} rowGap={60} /> },
  m2: { v: () => <BilingualSplit ar="الكسل" en="Model Laziness" size={220} color={W} line={LIME} /> },
  m3: { v: () => (<GlassPanel url="editor">
    <CodeEditor file="auth_service.ts" lines={["export class AuthService {", "  async login(email: string, password: string) {", "    const user = await this.users.findByEmail(email);", "    if (!user) throw new AuthError('not_found');", "    await this.rateLimiter.check(email);", "    const ok = await argon2.verify(user.hash, password);", "    if (!ok) throw new AuthError('bad_password');", "    return this.tokens.issue(user.id, { ttl: '15m' });", "  }", "}"]} perLine={4} />
  </GlassPanel>), bg: "dark" },
  m4: { v: () => (<GlassPanel url="editor">
    <CodeEditor file="auth_service.ts" lines={["export class AuthService {", "  async login(email: string, password: string) {", "    const user = await this.users.findByEmail(email);", "    // TODO: implement the rest of the logic here", "  }", "}"]} flagLine={3} flagText="كسل" perLine={4} />
  </GlassPanel>), bg: "dark" },
  m5: { v: () => <Slam text="طبعاً لا" size={300} color={RED} accent={W} font={FONT.display} />, impacts: [SLAM_IMPACT] },
  m6: { v: () => <BilingualSplit ar="تدهور السياق" en="Context Window Decay" size={190} color={W} line={RED} /> },
  m7: { v: (d) => <ContextDecay frames={d} /> },
  m8: { v: () => <InkReveal text="هنا يُعرف الخارق من الفاشل" size={140} color={W} captionColor="rgba(243,241,232,0.75)" caption="That's the real engineering test." /> },

  // ── الفصل 6 ──
  d1: { v: () => <WordCascade text="ليه كل النماذج خارقة في الويب؟" keys={["الويب؟"]} size={140} color={W} keyColor={LIME} highlight={null} font={FONT.display} /> },
  d2: { v: (d) => (<Two d={d} at={0.45}
    a={<LogoOrbit brands={["html5", "css", "javascript", "html5", "css", "javascript"]} radius={500} center={<AppTile brand="github" size={220} />} />}
    b={<><Caption text="JavaScript" y={-120} size={170} color="#F7DF1E" /><Caption text="اللغة الأكثر استخداماً على GitHub لقرابة عقد" y={60} size={70} delay={6} /><Source text="GitHub Octoverse (2014–2023)" /></>} />) },
  d3: { v: () => <Slam text="شبعانة داتا ويب" size={220} color={W} accent={LIME} font={FONT.display} />, impacts: [SLAM_IMPACT] },
  d4: { v: () => <WordCascade text="اختبره حيث الداتا أصعب والمعايير أصرم" keys={["أصعب", "أصرم"]} size={120} color={W} keyColor={LIME} highlight={null} font={FONT.display} /> },
  d5: { v: () => <Tiles brands={["android", "kotlin"]} size={300} label="Android · Kotlin · Architecture" /> },
  d6: { v: () => <Tiles brands={["apple", "swift"]} size={300} label="iOS · Swift · SwiftUI" /> },
  d7: { v: (d) => (<Two d={d} at={0.4}
    a={<GlassPanel url="terminal"><ToolLog title="automation" lines={[{ t: "$ python organize_downloads.py --watch" }, { t: "$ osascript -e 'tell app \"Finder\" …'" }, { t: "$ ffmpeg -i raw.mov -vf … out.mp4" }, { t: "✓ 1,284 files processed", ok: true }]} /></GlassPanel>}
    b={<><GlassPanel url="video-studio/src/episodes/fake-experts/FakeExperts.tsx"><CodeEditor file="FakeExperts.tsx" lines={["d7: { v: (d) => (", "  <Two d={d} at={0.4}", "    a={<ToolLog … />}", "    b={<CodeEditor … />}  // ← أنت تشوف هذا الآن", "  />", ") },"]} flagLine={3} flagText="هذا الفيديو نفسه" perLine={5} /></GlassPanel></>} />), bg: "dark" },
  d8: { v: () => <LogoOrbit brands={["python", "rust", "cplusplus", "kotlin", "swift", "unity", "unrealengine", "android", "apple", "huggingface"]} radius={600} size={140} center={<div dir="rtl" style={{ fontFamily: FONT.display, fontSize: 110, color: W }}>أكبر من الويب</div>} /> },
  d9: { v: () => <CloneGrid title={0} stampText="نفس الكلام" stampAt={30} />, bg: "dark" },
  d10: { v: () => <OneInHundred /> },

  // ── الفصل 7 ──
  e1: { v: () => <InkReveal text="مو إحباط… تنبيه" size={180} color={W} captionColor="rgba(243,241,232,0.75)" caption="Not an attack. A wake-up call." /> },
  e2: { v: () => <CycleLoop center="دائرة المبتدئين" nodes={["سطحية", "تكرار", "عناوين رنانة", "صفر عمق"]} /> },
  e3: { v: () => <Versus right={{ title: "شاف مقطعين", items: ["مصطلحات محفوظة", "اختبار بلعبة", "ثقة بلا دليل"], color: RED }} left={{ title: "فاهم فعلاً", items: ["مشاريع حقيقية", "معايير واضحة", "يعترف بحدود علمه"], color: LIME }} /> },
  e4: { v: (d) => (<>
    <Typewriter text="الحلقة الجاية: الاختبار الحقيقي_" size={100} color={LIME} font={FONT.digital} caret={W} cps={12} />
    <Sfx event="build.riser" at={d - 4} gain={0.8} />
  </>) },
  e5: { v: () => (<>
    <Thumb w={820} y={-150} rot={-3} />
    <Bubble text="اكتب رأيك بصراحة في التعليقات" delay={20} y={300} size={70} bg={LIME} />
    <Sfx event="drop" at={0} />
  </>) },
};

// ═══════════════════════════════════════════════════════════════════
const BG: React.FC<{ bg: Bg; accent?: string }> = ({ bg }) =>
  bg === "chalk" ? <ChalkBoard /> : bg === "dark" ? <DarkStage accent="#1d5b43" /> : null;

const BEDS = ["bed.drone.e", "bed.drone.g", "bed.drone", "bed.drone.c"] as const;

/** شريط التلقين (نسخة الدليل فقط): الجملة التي تقولها الآن + التالية */
const Prompter: React.FC = () => {
  const f = useCurrentFrame();
  const i = TL.findIndex((b) => f >= b.from && f < b.from + b.frames);
  const cur = TL[i], next = TL[i + 1];
  if (!cur) return null;
  const left = Math.max(0, Math.ceil((cur.from + cur.frames - f) / 30));
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", zIndex: 100 }}>
      <div dir="rtl" style={{ background: "rgba(0,0,0,0.86)", padding: "22px 60px 26px", fontFamily: FONT.body, borderTop: `4px solid ${LIME}` }}>
        <div style={{ color: LIME, fontSize: 22, fontFamily: FONT.mono, direction: "ltr", textAlign: "right" }}>{cur.id} · {left}s</div>
        <div style={{ color: "#fff", fontSize: 46, lineHeight: 1.45, fontWeight: 600 }}>{cur.say || `(صمت — ${cur.title})`}</div>
        {next && <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 28, marginTop: 6 }}>التالي: {next.say || next.title}</div>}
      </div>
    </AbsoluteFill>
  );
};

export const FakeExperts: React.FC<{ guide?: boolean }> = ({ guide = false }) => {
  const { fps } = useVideoConfig();
  // بساط صوتي يتغيّر طابعه مع كل فصل (جذر نغمي مختلف) — التحول يُحسّ ولا يُسمع
  const chapters = TL.filter((b) => b.id.startsWith("ch"));
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {TL.map((b) => {
        const beat = b.id.startsWith("ch") ? null : V[b.id];
        if (!b.id.startsWith("ch") && !beat) throw new Error(`لا مرئي للمشهد ${b.id}`);
        const bg: Bg = beat?.bg ?? "chalk";
        return (
          <Sequence key={b.id} from={b.from} durationInFrames={b.frames} name={`${b.id} · ${b.say.slice(0, 40)}`}>
            <Camera hand={beat?.hand ?? 1} impacts={beat?.impacts ?? []} push={beat?.push ?? 0.035} dur={b.frames}>
              <BG bg={b.id.startsWith("ch") ? "chalk" : bg} />
              {b.id.startsWith("ch") ? <Chapter n={parseInt(b.id.slice(2)) - 1} title={b.title!} sub={b.sub} /> : beat!.v(b.frames)}
            </Camera>
          </Sequence>
        );
      })}
      {chapters.map((c, i) => {
        const end = chapters[i + 1]?.from ?? TOTAL;
        const n = Math.ceil((end - c.from) / 200);
        return Array.from({ length: n }, (_, k) => (
          <Sequence key={`${c.id}-${k}`} from={c.from + k * 200} durationInFrames={Math.max(1, TOTAL - (c.from + k * 200))} layout="none">
            <Sfx event={BEDS[i % BEDS.length]} at={0} gain={0.5} />
          </Sequence>
        ));
      })}
      <Grain opacity={0.07} />
      <Vignette strength={0.15} />
      {guide && <Prompter />}
    </AbsoluteFill>
  );
};
