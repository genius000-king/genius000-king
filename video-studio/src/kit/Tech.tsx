// ═══════════════════════════════════════════════════════════════════
//  لوحات تقنية — تحوّل الادّعاء إلى صورة يُرى فيها الدليل:
//  محادثة، رسم بياني، حلقة أحداث، جدول، محرّر كود، سياق يتآكل…
// ═══════════════════════════════════════════════════════════════════
import React from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT } from "../theme/fonts";
import { Sfx, SfxTrain } from "../sfx/library";
import { CHALK, LIME, RED } from "./Collage";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const useSpring = (delay: number, cfg = { damping: 18 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config: cfg });
};

// ───────────── محادثة شات ─────────────
export const ChatMock: React.FC<{ prompt: string; reply: string[]; verdict?: string; verdictAt?: number }> = ({ prompt, reply, verdict, verdictAt = 70 }) => {
  const f = useCurrentFrame();
  const typed = Math.floor(interpolate(f, [6, 6 + prompt.length * 1.2], [0, prompt.length], clamp));
  const sendAt = Math.round(10 + prompt.length * 1.2);
  const lineAt = (i: number) => sendAt + 10 + i * 4;
  return (
    <AbsoluteFill style={{ background: "#212121", padding: "60px 180px", fontFamily: FONT.ui, color: "#ececec", display: "flex", flexDirection: "column", gap: 30 }}>
      {typed > 0 && (
        <div dir="rtl" style={{ alignSelf: "flex-end", background: "#303030", borderRadius: 32, padding: "22px 38px", fontSize: 54, maxWidth: "80%" }}>
          {prompt.slice(0, typed)}{f < sendAt ? "▍" : ""}
        </div>
      )}
      {f > sendAt + 4 && (
        <div style={{ fontFamily: FONT.mono, fontSize: 34, lineHeight: 1.55, background: "#0d0d0d", borderRadius: 14, padding: "20px 28px", direction: "ltr", color: "#b5e3ff" }}>
          {reply.map((l, i) => (f >= lineAt(i) ? <div key={i} style={{ whiteSpace: "pre", opacity: interpolate(f, [lineAt(i), lineAt(i) + 3], [0, 1], clamp) }}>{l}</div> : null))}
        </div>
      )}
      {verdict && f >= verdictAt && (
        <div dir="rtl" style={{ position: "absolute", left: 0, right: 0, bottom: 60, textAlign: "center", fontFamily: FONT.display, fontSize: 90, color: "#ffd84d", textShadow: "0 6px 0 #000",
          transform: `scale(${spring({ frame: f - verdictAt, fps: 30, config: { damping: 9 } })}) rotate(-3deg)` }}>
          {verdict}
        </div>
      )}
      <Sfx event="type.enter" at={sendAt} />
      {verdict && <Sfx event="word.key" at={verdictAt} />}
    </AbsoluteFill>
  );
};

// ───────────── رسم بياني بأعمدة ─────────────
export const BarChart: React.FC<{
  title: string; bars: { label: string; value: number; color?: string; note?: string }[]; max?: number; line?: { value: number; label: string }; unit?: string; source?: string;
}> = ({ title, bars, max = 100, line, unit = "%", source }) => {
  const f = useCurrentFrame();
  const H = 560, W = 1300;
  const bw = W / bars.length;
  const lineP = line ? interpolate(f, [18 + bars.length * 10, 36 + bars.length * 10], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 0;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div dir="rtl" style={{ fontFamily: FONT.display, color: CHALK, fontSize: 72, marginBottom: 30 }}>{title}</div>
      <div style={{ position: "relative", width: W, height: H, borderBottom: `3px solid ${CHALK}`, direction: "ltr" }}>
        {bars.map((b, i) => {
          const p = interpolate(f, [10 + i * 10, 34 + i * 10], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.4)) });
          const h = (b.value / max) * H * p;
          return (
            <div key={i} style={{ position: "absolute", left: i * bw + bw * 0.2, width: bw * 0.6, bottom: 0, height: h, background: b.color ?? LIME, borderRadius: "10px 10px 0 0" }}>
              <div style={{ position: "absolute", top: -78, width: "100%", textAlign: "center", fontFamily: FONT.heavy, fontWeight: 900, fontSize: 56, color: CHALK }}>
                {(b.value * Math.min(1, p)).toFixed(b.value % 1 ? 1 : 0)}{unit}
              </div>
              <div dir="rtl" style={{ position: "absolute", bottom: -96, width: "140%", left: "-20%", textAlign: "center", fontFamily: FONT.body, fontSize: 30, color: CHALK, lineHeight: 1.3 }}>
                {b.label}
                {b.note && <div style={{ fontSize: 22, opacity: 0.6 }}>{b.note}</div>}
              </div>
            </div>
          );
        })}
        {line && (
          <div style={{ position: "absolute", left: 0, width: W * lineP, bottom: (line.value / max) * H, borderTop: `4px dashed ${RED}` }}>
            <div dir="rtl" style={{ position: "absolute", left: 0, top: -58, fontFamily: FONT.punch, fontSize: 40, color: RED, whiteSpace: "nowrap", opacity: lineP }}>{line.label}</div>
          </div>
        )}
      </div>
      {source && <div style={{ position: "absolute", bottom: 40, left: 60, fontFamily: FONT.mono, fontSize: 20, color: "rgba(243,241,232,0.55)" }}>{source}</div>}
      <SfxTrain event="word.key" frames={bars.map((_, i) => 30 + i * 10)} gain={0.6} minGap={8} />
    </AbsoluteFill>
  );
};

// ───────────── حلقة الأحداث: خيط واحد، طابور طويل ─────────────
export const EventLoop: React.FC = () => {
  const f = useCurrentFrame();
  const tasks = ["فيزياء", "رسم", "إدخال", "ذكاء الأعداء", "صوت", "شبكة", "تصادمات", "إضاءة"];
  const period = 16; // كل مهمة تأخذ دورها بالتوالي
  const cur = Math.floor(f / period);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: FONT.body }}>
      <div style={{ fontFamily: FONT.mono, color: LIME, fontSize: 40, marginBottom: 12 }}>JavaScript · Main Thread</div>
      <div dir="rtl" style={{ color: CHALK, fontFamily: FONT.display, fontSize: 64, marginBottom: 50 }}>خيط واحد… والكل ينتظر دوره</div>
      <div style={{ position: "relative", width: 1600, height: 200 }}>
        {/* المعالج: بوابة واحدة */}
        <div style={{ position: "absolute", left: 0, top: 10, width: 240, height: 180, borderRadius: 24, border: `5px solid ${LIME}`, display: "flex", alignItems: "center", justifyContent: "center", color: LIME, fontFamily: FONT.mono, fontSize: 34, boxShadow: `0 0 ${20 + 20 * Math.sin(f / 3)}px ${LIME}66` }}>
          CPU
        </div>
        {Array.from({ length: 9 }, (_, slot) => {
          // طابور لا ينتهي: المهام تتدوّر، والمعالج يأخذ واحدة فقط كل مرة
          const k = cur + slot;
          const t = tasks[k % tasks.length];
          const i = k;
          const done = false;
          const x = 300 + slot * 160 + (slot === 0 ? -300 : 0) * interpolate(f % period, [0, 8], [0, 1], clamp) - interpolate(f % period, [8, period], [0, 160], clamp) * (slot === 0 ? 0 : 1);
          return (
            <div key={i} dir="rtl" style={{ position: "absolute", left: x, top: 50, width: 150, height: 100, borderRadius: 16, background: slot === 0 ? LIME : "rgba(243,241,232,0.12)", color: slot === 0 ? "#111" : CHALK,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 600, opacity: done ? 0 : 1, transition: "none", border: `2px solid ${CHALK}33` }}>
              {t}
            </div>
          );
        })}
      </div>
      <div dir="rtl" style={{ color: "rgba(243,241,232,0.7)", fontSize: 32, marginTop: 60 }}>
        مهمة ← تخلص ← اللي بعدها. (Web Workers موجودة… لكن الرسم والمنطق ما زالا على خيط واحد غالباً)
      </div>
    </AbsoluteFill>
  );
};

// ───────────── جدول يُبنى صفاً صفاً ─────────────
export const TableReveal: React.FC<{ head: string[]; rows: string[][]; rowGap?: number }> = ({ head, rows, rowGap = 26 }) => {
  const f = useCurrentFrame();
  const colW = [460, 760, 560];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div dir="rtl" style={{ fontFamily: FONT.body, color: CHALK, borderRadius: 20, overflow: "hidden", border: `2px solid ${CHALK}44`, background: "rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", background: LIME, color: "#111", fontWeight: 600, fontSize: 38 }}>
          {head.map((h, i) => <div key={i} style={{ width: colW[i], padding: "22px 28px" }}>{h}</div>)}
        </div>
        {rows.map((r, ri) => {
          const p = interpolate(f, [12 + ri * rowGap, 24 + ri * rowGap], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
          return (
            <div key={ri} style={{ display: "flex", borderTop: `1px solid ${CHALK}33`, opacity: p, transform: `translateX(${(1 - p) * -80}px)` }}>
              {r.map((c, ci) => (
                <div key={ci} style={{ width: colW[ci], padding: "24px 28px", fontSize: ci === 0 ? 40 : 34, lineHeight: 1.4, fontWeight: ci === 0 ? 600 : 400, color: ci === 2 ? "#ff9b93" : CHALK }}>{c}</div>
              ))}
            </div>
          );
        })}
      </div>
      <SfxTrain event="transition.paper" frames={rows.map((_, i) => 14 + i * rowGap)} gain={0.5} minGap={10} />
    </AbsoluteFill>
  );
};

// ───────────── محرّر كود ─────────────
const tokenColor = (l: string) =>
  l.trim().startsWith("//") ? "#6a9955" : /\b(function|const|let|return|class|if|for)\b/.test(l) ? "#c586c0" : "#d4d4d4";

export const CodeEditor: React.FC<{ file: string; lines: string[]; flagLine?: number; flagText?: string; perLine?: number }> = ({ file, lines, flagLine, flagText, perLine = 3 }) => {
  const f = useCurrentFrame();
  const flagAt = flagLine !== undefined ? 10 + flagLine * perLine + 12 : 0;
  const pulse = flagLine !== undefined && f > flagAt ? 0.5 + 0.5 * Math.sin((f - flagAt) / 3) : 0;
  return (
    <AbsoluteFill style={{ background: "#1e1e1e", fontFamily: FONT.mono, direction: "ltr" }}>
      <div style={{ height: 50, background: "#252526", display: "flex", alignItems: "center", paddingLeft: 24, color: "#ccc", fontSize: 20, borderBottom: "1px solid #111" }}>
        <span style={{ background: "#1e1e1e", padding: "12px 20px", borderTop: "2px solid #0078d4" }}>{file}</span>
      </div>
      <div style={{ padding: "26px 0", fontSize: 28, lineHeight: 1.6 }}>
        {lines.map((l, i) => {
          const at = 10 + i * perLine;
          if (f < at) return null;
          const flagged = i === flagLine;
          return (
            <div key={i} style={{ display: "flex", background: flagged ? `rgba(255,75,62,${0.15 + pulse * 0.25})` : undefined, whiteSpace: "pre" }}>
              <span style={{ width: 80, textAlign: "right", paddingRight: 24, color: "#858585" }}>{i + 1}</span>
              <span style={{ color: flagged ? "#ff8a80" : tokenColor(l), fontWeight: flagged ? 700 : 400 }}>{l}</span>
            </div>
          );
        })}
      </div>
      {flagText && f > flagAt && (
        <div dir="rtl" style={{ position: "absolute", right: 90, top: 50 + 26 + (flagLine ?? 0) * 44.8 - 10, fontFamily: FONT.display, fontSize: 64, color: RED, transform: `scale(${spring({ frame: f - flagAt, fps: 30, config: { damping: 10 } })})` }}>
          ← {flagText}
        </div>
      )}
      {flagLine !== undefined && <Sfx event="error.buzz" at={flagAt} />}
    </AbsoluteFill>
  );
};

// ───────────── تآكل السياق: التوكنات تتراكم والنص يتفكّك ─────────────
export const ContextDecay: React.FC<{ frames?: number }> = ({ frames = 150 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, frames], [0, 1], clamp);
  const tokens = Math.round(p ** 1.6 * 200000);
  const focus = Math.max(0, 1 - Math.max(0, p - 0.35) * 1.6);
  const words = "function saveUser ( user ) { validate ( user ) ; db . users . insert ( user ) ; cache . invalidate ( user . id ) ; return user . id ; }".split(" ");
  const wrong = ["undefined", "deleteAll", "???", "null", "db.drop()", "user2", "////", "NaN"];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40 }}>
      <div style={{ display: "flex", gap: 80, alignItems: "flex-end" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: FONT.heavy, fontWeight: 900, fontSize: 110, color: CHALK, direction: "ltr" }}>{tokens.toLocaleString("en-US")}</div>
          <div style={{ fontFamily: FONT.mono, color: LIME, fontSize: 28 }}>TOKENS IN CONTEXT</div>
        </div>
        <div style={{ width: 460 }}>
          <div dir="rtl" style={{ fontFamily: FONT.body, color: CHALK, fontSize: 30, marginBottom: 10 }}>تركيز النموذج</div>
          <div style={{ height: 34, borderRadius: 17, background: "rgba(255,255,255,0.12)", overflow: "hidden", direction: "ltr" }}>
            <div style={{ width: `${focus * 100}%`, height: "100%", background: focus > 0.5 ? LIME : focus > 0.25 ? "#ffc53d" : RED }} />
          </div>
        </div>
      </div>
      <div style={{ fontFamily: FONT.mono, fontSize: 36, color: "#d4d4d4", direction: "ltr", width: 1500, display: "flex", flexWrap: "wrap", lineHeight: 1.7, background: "rgba(0,0,0,0.35)", padding: "28px 40px", borderRadius: 16, boxSizing: "border-box" }}>
        {words.map((w, i) => {
          const broken = random(`cd${i}`) < (1 - focus) * 0.55;
          const flick = broken && Math.floor(f / 3 + i) % 4 === 0;
          return (
            <span key={i} style={{ color: broken ? "#ff6b61" : undefined, filter: broken ? `blur(${flick ? 2 : 0}px)` : undefined, marginRight: 10 }}>
              {broken ? wrong[i % wrong.length] : w}
            </span>
          );
        })}
      </div>
      <div dir="rtl" style={{ fontFamily: FONT.display, fontSize: 70, color: focus < 0.3 ? RED : CHALK, opacity: interpolate(p, [0.55, 0.7], [0, 1], clamp) }}>
        متى يبدأ يهلوس؟ هذا هو السؤال
      </div>
      <Sfx event="build.riser" at={Math.round(frames * 0.62)} />
      <Sfx event="glitch" at={Math.round(frames * 0.62)} />
    </AbsoluteFill>
  );
};

// ───────────── سجلّ أدوات (Agent + MCP) ─────────────
export const ToolLog: React.FC<{ lines: { t: string; ok?: boolean }[]; title?: string }> = ({ lines, title = "agent · mcp session" }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#0b0e0c", fontFamily: FONT.mono, padding: "44px 64px", direction: "ltr", fontSize: 38, lineHeight: 1.7 }}>
      <div style={{ color: "#5b6b60", marginBottom: 16 }}>── {title} ──</div>
      {lines.map((l, i) => {
        const at = 6 + i * 11;
        if (f < at) return null;
        return (
          <div key={i} style={{ color: l.ok === undefined ? "#9fe8b5" : l.ok ? LIME : RED, opacity: interpolate(f, [at, at + 4], [0, 1], clamp) }}>
            {l.t}
          </div>
        );
      })}
      <div style={{ width: 16, height: 32, background: LIME, opacity: Math.floor(f / 8) % 2 }} />
    </AbsoluteFill>
  );
};

// ───────────── لعبة ثلاثية الأبعاد تختنق داخل المتصفح ─────────────
export const BrowserStrain: React.FC<{ crashAt?: number }> = ({ crashAt = 90 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, crashAt], [0, 1], clamp);
  const fps = Math.max(3, Math.round(60 - p ** 1.5 * 56 + Math.sin(f) * 2));
  const ram = Math.round(400 + p ** 1.3 * 3600);
  // الإطار يتجمّد: نحدّث الدوران فقط كل "n" فريمات مع انخفاض الأداء
  const step = Math.max(1, Math.round(60 / fps));
  const tf = Math.floor(f / step) * step;
  const crashed = f >= crashAt;
  const cubes = Array.from({ length: 9 }, (_, i) => (
    <div key={i} style={{ position: "absolute", left: 200 + (i % 3) * 330, top: 120 + Math.floor(i / 3) * 210, width: 120, height: 120, transformStyle: "preserve-3d", transform: `rotateX(${tf * 3 + i * 20}deg) rotateY(${tf * 4 + i * 30}deg)` }}>
      {[0, 90, 180, 270].map((r) => <div key={r} style={{ position: "absolute", inset: 0, border: `3px solid ${LIME}`, transform: `rotateY(${r}deg) translateZ(60px)`, background: "rgba(198,255,77,0.08)" }} />)}
      <div style={{ position: "absolute", inset: 0, border: `3px solid ${LIME}`, transform: "rotateX(90deg) translateZ(60px)" }} />
    </div>
  ));
  return (
    <AbsoluteFill style={{ background: "#05070a", perspective: 900, overflow: "hidden" }}>
      <div style={{ filter: crashed ? "grayscale(1) brightness(0.4) blur(2px)" : undefined }}>{cubes}</div>
      <div style={{ position: "absolute", top: 20, left: 24, fontFamily: FONT.mono, fontSize: 30, lineHeight: 1.5, color: fps < 20 ? RED : LIME, background: "rgba(0,0,0,0.6)", padding: "8px 16px", borderRadius: 8 }}>
        FPS {crashed ? 0 : fps}<br />RAM {ram} MB
      </div>
      {crashed && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", color: "#222", fontFamily: FONT.ui, padding: "40px 60px", borderRadius: 16, textAlign: "center", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
            <div style={{ fontSize: 80 }}>:(</div>
            <div style={{ fontSize: 36, fontWeight: 600 }}>Aw, Snap!</div>
            <div style={{ fontSize: 24, color: "#666" }}>Out of Memory</div>
          </div>
        </AbsoluteFill>
      )}
      <Sfx event="crash" at={crashAt} />
    </AbsoluteFill>
  );
};

// ───────────── مقارنة عمودين ─────────────
export const Versus: React.FC<{ left: { title: string; items: string[]; color?: string }; right: { title: string; items: string[]; color?: string } }> = ({ left, right }) => {
  const f = useCurrentFrame();
  const col = (c: typeof left, side: 1 | -1, base: number) => {
    const p = spring({ frame: f - base, fps: 30, config: { damping: 16 } });
    return (
      <div dir="rtl" style={{ width: 760, transform: `translateX(${(1 - p) * 300 * side}px)`, opacity: p }}>
        <div style={{ fontFamily: FONT.display, fontSize: 80, color: c.color ?? CHALK, marginBottom: 20, textAlign: "center" }}>{c.title}</div>
        {c.items.map((it, i) => {
          const q = interpolate(f, [base + 10 + i * 8, base + 18 + i * 8], [0, 1], clamp);
          return (
            <div key={i} style={{ fontFamily: FONT.body, fontSize: 38, color: CHALK, padding: "16px 24px", margin: "10px 0", borderRadius: 14, background: "rgba(0,0,0,0.25)", borderRight: `8px solid ${c.color ?? CHALK}`, opacity: q, transform: `translateY(${(1 - q) * 20}px)` }}>
              {it}
            </div>
          );
        })}
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 80 }}>
      {col(right, 1, 0)}
      <div style={{ width: 4, height: 600, background: `linear-gradient(transparent, ${CHALK}, transparent)` }} />
      {col(left, -1, 8)}
      <Sfx event="transition.whoosh" at={4} />
    </AbsoluteFill>
  );
};

// ───────────── كلمات تُكرّر حتى تفقد معناها ─────────────
export const EchoWords: React.FC<{ words: string[]; stampAt?: number }> = ({ words, stampAt = 50 }) => {
  const f = useCurrentFrame();
  const items = Array.from({ length: 42 }, (_, i) => {
    const w = words[i % words.length];
    const at = i * 1.2;
    const p = interpolate(f, [at, at + 6], [0, 1], clamp);
    const x = (random(`ex${i}`) - 0.5) * 1700;
    const y = (random(`ey${i}`) - 0.5) * 900;
    const s = 0.5 + random(`es${i}`) * 1.3;
    return (
      <div key={i} style={{ position: "absolute", transform: `translate(${x}px, ${y}px) scale(${s * p}) rotate(${(random(`er${i}`) - 0.5) * 30}deg)`, fontFamily: i % 3 ? FONT.mono : FONT.display, fontSize: 60, color: CHALK, opacity: 0.25 + random(`eo${i}`) * 0.6 }}>
        {w}
      </div>
    );
  });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {items}
    </AbsoluteFill>
  );
};

// ───────────── سجلّ مساهمات فارغ (لا مشروع حقيقي قط) ─────────────
export const EmptyContrib: React.FC<{ user?: string }> = ({ user = "ai_professor" }) => {
  const f = useCurrentFrame();
  const cols = 53, rows = 7, c = 28;
  const scan = interpolate(f, [5, 45], [0, cols], clamp);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", background: "#0d1117", fontFamily: FONT.ui }}>
      <div style={{ width: cols * (c + 4), direction: "ltr" }}>
        <div style={{ color: "#e6edf3", fontSize: 46, marginBottom: 24 }}>
          <b>0 contributions</b> in the last year <span style={{ color: "#7d8590", fontSize: 24 }}>· @{user}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${c}px)`, gridAutoFlow: "column", gridTemplateRows: `repeat(${rows}, ${c}px)`, gap: 4 }}>
          {Array.from({ length: cols * rows }, (_, i) => (
            <div key={i} style={{ borderRadius: 5, background: Math.floor(i / rows) < scan ? "#2a313c" : "#1a1f27" }} />
          ))}
        </div>
      </div>
      <div dir="rtl" style={{ fontFamily: FONT.display, fontSize: 90, color: "#ff7b72", marginTop: 50, opacity: interpolate(f, [48, 58], [0, 1], clamp) }}>ولا مشروع حقيقي واحد</div>
      <Sfx event="error.buzz" at={48} />
    </AbsoluteFill>
  );
};

// ───────────── دائرة مغلقة (حلقة لا تنتهي) ─────────────
export const CycleLoop: React.FC<{ center: string; nodes: string[] }> = ({ center, nodes }) => {
  const f = useCurrentFrame();
  const R = 330;
  const rot = f * 1.2;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <svg width={900} height={900} style={{ position: "absolute", transform: `rotate(${rot}deg)` }}>
        <defs>
          <marker id="ah" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10z" fill={LIME} />
          </marker>
        </defs>
        {nodes.map((_, i) => {
          const a0 = (i / nodes.length) * Math.PI * 2 + 0.35, a1 = ((i + 1) / nodes.length) * Math.PI * 2 - 0.35;
          const p = (a: number) => `${450 + Math.cos(a) * R} ${450 + Math.sin(a) * R}`;
          return <path key={i} d={`M ${p(a0)} A ${R} ${R} 0 0 1 ${p(a1)}`} stroke={LIME} strokeWidth={6} fill="none" markerEnd="url(#ah)" />;
        })}
      </svg>
      {nodes.map((n, i) => {
        const a = (i / nodes.length) * Math.PI * 2 + (rot * Math.PI) / 180;
        return (
          <div key={i} dir="rtl" style={{ position: "absolute", transform: `translate(${Math.cos(a) * R}px, ${Math.sin(a) * R}px)`, fontFamily: FONT.body, fontWeight: 600, fontSize: 34, color: "#111", background: CHALK, padding: "10px 24px", borderRadius: 40, whiteSpace: "nowrap" }}>
            {n}
          </div>
        );
      })}
      <div dir="rtl" style={{ fontFamily: FONT.display, fontSize: 84, color: CHALK, textAlign: "center", lineHeight: 1.2, maxWidth: 480 }}>{center}</div>
      <Sfx event="transition.whoosh" at={2} />
    </AbsoluteFill>
  );
};

// ───────────── قفص المتصفح (Sandbox) ─────────────
export const SandboxCage: React.FC<{ chips: string[] }> = ({ chips }) => {
  const f = useCurrentFrame();
  const bars = interpolate(f, [30, 50], [0, 1], { ...clamp, easing: Easing.out(Easing.bounce) });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", width: 1200, height: 560, borderRadius: 20, border: `4px solid ${CHALK}`, background: "rgba(0,0,0,0.3)", overflow: "hidden" }}>
        <div style={{ height: 50, borderBottom: `3px solid ${CHALK}`, display: "flex", alignItems: "center", gap: 10, paddingLeft: 20 }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => <div key={c} style={{ width: 16, height: 16, borderRadius: 9, background: c }} />)}
          <div style={{ fontFamily: FONT.mono, color: CHALK, fontSize: 22, marginLeft: 20 }}>browser sandbox</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 30, justifyContent: "center", alignItems: "center", height: 500, padding: 40 }}>
          {chips.map((c, i) => {
            const p = spring({ frame: f - i * 6, fps: 30, config: { damping: 12 } });
            const push = Math.sin(f / 5 + i) * 6 * bars; // تتخبّط في القفص
            return (
              <div key={i} style={{ fontFamily: FONT.mono, fontSize: 46, color: "#111", background: LIME, padding: "18px 34px", borderRadius: 16, transform: `scale(${p}) translateX(${push}px)` }}>{c}</div>
            );
          })}
        </div>
        {/* القضبان */}
        {Array.from({ length: 11 }, (_, i) => (
          <div key={i} style={{ position: "absolute", top: 50, left: 55 + i * 110, width: 14, height: 510 * bars, background: "linear-gradient(90deg, #666, #ddd, #666)", borderRadius: 7 }} />
        ))}
      </div>
      <Sfx event="stamp" at={40} gain={0.7} />
    </AbsoluteFill>
  );
};

// ───────────── واحد من مئة ─────────────
export const OneInHundred: React.FC = () => {
  const f = useCurrentFrame();
  const lit = 67;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 60px)", gap: 18 }}>
        {Array.from({ length: 100 }, (_, i) => {
          const on = i === lit && f > 45;
          const p = interpolate(f, [i * 0.35, i * 0.35 + 6], [0, 1], clamp);
          return <div key={i} style={{ width: 60, height: 60, borderRadius: 30, background: on ? LIME : "rgba(243,241,232,0.18)", transform: `scale(${p * (on ? 1.35 : 1)})`, boxShadow: on ? `0 0 40px ${LIME}` : undefined }} />;
        })}
      </div>
      <div dir="rtl" style={{ fontFamily: FONT.display, fontSize: 70, color: CHALK, marginTop: 40, opacity: interpolate(f, [45, 55], [0, 1], clamp) }}>
        واحد من كل <span style={{ color: LIME }}>100</span>
      </div>
      <Sfx event="success.ding" at={46} />
    </AbsoluteFill>
  );
};
