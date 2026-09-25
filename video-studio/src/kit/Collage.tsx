// ═══════════════════════════════════════════════════════════════════
//  لغة الكولاج — مأخوذة من الصورة المصغّرة نفسها:
//  سبورة خضراء، قصاصات بحافة بيضاء (ملصقات)، وبلاطات تطبيقات تدور.
//  الغاية: من يضغط على الصورة المصغّرة يدخل نفس العالم، لا عالماً آخر.
// ═══════════════════════════════════════════════════════════════════
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { noise2D } from "@remotion/noise";
import manifest from "../../public/broll/logos/manifest.json";
import { FONT } from "../theme/fonts";
import { Sfx } from "../sfx/library";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const GREEN = "#1d5b43";
export const CHALK = "#f3f1e8";
export const RED = "#ff4b3e";
export const LIME = "#c6ff4d";

type Entry = { file: string; color: string; title: string };
export const logo = (k: string) => (manifest as Record<string, Entry>)[k];

// ───────────── السبورة ─────────────
/** طبقات السبورة الثابتة (بقع طبشور + خشونة). تُرندَر مرة واحدة كصورة
 *  (tools: npx remotion still src/index.ts ChalkTexture public/broll/chalk.jpg)
 *  لأن فلاتر SVG تُعاد حسابها كل فريم حين تتحرك الكاميرا ثلاثياً. */
export const ChalkTexture: React.FC<{ tone?: string }> = ({ tone = GREEN }) => (
  <AbsoluteFill style={{ background: tone, overflow: "hidden" }}>
    <AbsoluteFill style={{ opacity: 0.5, mixBlendMode: "screen" }}>
      <svg width="100%" height="100%">
        <filter id="smudge">
          <feTurbulence type="fractalNoise" baseFrequency="0.0045 0.009" numOctaves="4" seed="11" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.22 -0.06" />
        </filter>
        <rect width="100%" height="100%" filter="url(#smudge)" />
      </svg>
    </AbsoluteFill>
    <AbsoluteFill style={{ opacity: 0.35, mixBlendMode: "overlay" }}>
      <svg width="100%" height="100%">
        <filter id="grit">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="4" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.9 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grit)" />
      </svg>
    </AbsoluteFill>
  </AbsoluteFill>
);

/** السبورة الخضراء — الخلفية الأساسية للقناة. صورة مخبوزة + ضوء مسرحي يتنفّس. */
export const ChalkBoard: React.FC<{ tone?: string }> = ({ tone = GREEN }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: tone, overflow: "hidden" }}>
      <Img src={staticFile("broll/chalk.jpg")} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover" }} />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at ${50 + noise2D("lx", f / 200, 0) * 12}% ${42 + noise2D("ly", f / 200, 1) * 8}%, rgba(255,255,255,0.13), transparent 60%), radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.45) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/** حافة ملصق بيضاء حول أي شيء (نص، صورة، شعار) — تقنية الـ drop-shadow المكدّسة */
export const stickerEdge = (w = 5, color = "#fff") =>
  [
    [w, 0], [-w, 0], [0, w], [0, -w], [w * 0.7, w * 0.7], [-w * 0.7, w * 0.7], [w * 0.7, -w * 0.7], [-w * 0.7, -w * 0.7],
  ].map(([x, y]) => `drop-shadow(${x}px ${y}px 0 ${color})`).join(" ") + " drop-shadow(0 18px 24px rgba(0,0,0,0.35))";

/** يدخل كملصق يُصفع على السبورة: يأتي كبيراً مائلاً ثم يستقرّ بارتداد */
export const Sticker: React.FC<{ children: React.ReactNode; delay?: number; rot?: number; x?: number; y?: number; edge?: number; sfx?: boolean; seed?: number; radius?: number }> = ({
  children, delay = 0, rot = -3, x = 0, y = 0, edge = 6, sfx = true, seed = 0, radius = 20,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - delay, fps, config: { damping: 12, stiffness: 170, mass: 0.7 } });
  const wob = noise2D(`st${seed}`, f / 60, 0) * 1.2;
  return (
    <div style={{
      position: "absolute", left: "50%", top: "50%",
      transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${interpolate(p, [0, 1], [1.6, 1])}) rotate(${rot + (1 - p) * 12 + wob}deg)`,
      opacity: interpolate(f - delay, [0, 3], [0, 1], clamp),
      // إطار أبيض حقيقي + ظلّ واحد: نفس مظهر القصاصة، بدل 9 فلاتر drop-shadow
      // كانت تُحسب بكسلاً بكسلاً كل فريم (كانت تكلّف ~11 ثانية للفريم الواحد)
      background: edge ? "#fff" : undefined, padding: edge, borderRadius: radius + edge,
      boxShadow: edge ? "0 18px 30px rgba(0,0,0,0.35)" : undefined,
    }}>
      {edge ? <div style={{ borderRadius: radius, overflow: "hidden", lineHeight: 0 }}><div style={{ lineHeight: "normal" }}>{children}</div></div> : children}
      {sfx && <Sfx event="sticker.slap" at={delay + 5} seed={seed} />}
    </div>
  );
};

// ───────────── بلاطة تطبيق (كما في الصورة المصغّرة) ─────────────
export const AppTile: React.FC<{ brand: string; size?: number; bg?: string; style?: React.CSSProperties }> = ({ brand, size = 170, bg, style }) => {
  const e = logo(brand);
  if (!e) return null;
  const dark = parseInt(e.color.slice(1), 16) < 0x333333 || e.color.toUpperCase() === "#FFFFFF";
  const tileBg = bg ?? (e.file.includes("chatgpt") ? "#10a37f" : dark ? "#f4f4f0" : "#f4f4f0");
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.24, background: tileBg, display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: `inset 0 -${size * 0.05}px 0 rgba(0,0,0,0.12), 0 ${size * 0.12}px ${size * 0.25}px rgba(0,0,0,0.35)`, ...style,
    }}>
      <Img src={staticFile(e.file)} style={{
        width: e.file.includes("chatgpt") ? "100%" : "56%", height: e.file.includes("chatgpt") ? "100%" : "56%", objectFit: "contain",
        borderRadius: e.file.includes("chatgpt") ? size * 0.24 : 0,
        filter: e.color.toUpperCase() === "#FFFFFF" ? "invert(1)" : undefined,
      }} />
    </div>
  );
};

/** بلاطات تدور في حلقة ثلاثية الأبعاد حول نقطة، مع دوّامة ضوء — صدى الصورة المصغّرة */
export const LogoOrbit: React.FC<{ brands: string[]; radius?: number; size?: number; center?: React.ReactNode; speed?: number; offsetY?: number }> = ({
  brands, radius = 420, size = 150, center, speed = 1, offsetY = 0,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tiles = brands.map((b, i) => {
    const born = i * 3;
    const p = spring({ frame: f - born, fps, config: { damping: 14 } });
    const a = (i / brands.length) * Math.PI * 2 + (f / 90) * speed;
    const x = Math.cos(a) * radius * p;
    const z = Math.sin(a) * radius * 0.45;
    // المدار مائل: الأمامي يمرّ تحت المركز والخلفي فوقه — فلا يغطّي النص
    const y = Math.sin(a) * radius * 0.36 + Math.sin(f / 20 + i) * 10;
    const depth = (z / (radius * 0.45) + 1) / 2; // 0 خلف، 1 أمام
    return { b, x, y, z, depth, p, i };
  }).sort((a, b) => a.z - b.z);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `translateY(${offsetY}px)` }}>
      <div style={{ position: "absolute", width: radius * 2.4, height: radius * 0.8, borderRadius: "50%", border: "3px solid rgba(220,255,230,0.5)", filter: "blur(1.5px)", transform: `rotate(-8deg)`, boxShadow: "0 0 40px rgba(180,255,210,0.5)" }} />
      <div style={{ position: "absolute", width: radius * 1.2, height: radius * 1.2, borderRadius: "50%", background: "radial-gradient(circle, rgba(170,255,200,0.45), transparent 60%)" }} />
      <div style={{ position: "relative", zIndex: 6 }}>{center}</div>
      {tiles.map((t) => (
        <div key={t.b} style={{ position: "absolute", transform: `translate(${t.x}px, ${t.y}px) scale(${(0.7 + t.depth * 0.45) * t.p}) rotate(${Math.sin(f / 30 + t.i) * 6}deg)`, filter: `blur(${(1 - t.depth) * 2.5}px) brightness(${0.75 + t.depth * 0.3})`, zIndex: Math.round(t.depth * 10) }}>
          <AppTile brand={t.b} size={size} />
        </div>
      ))}
      {brands.map((_, i) => <Sfx key={i} event="tile.pop" at={i * 3 + 4} seed={i} />)}
    </AbsoluteFill>
  );
};

// ───────────── الختم ─────────────
export const Stamp: React.FC<{ text: string; at?: number; color?: string; rot?: number; size?: number; x?: number; y?: number; font?: string }> = ({
  text, at = 0, color = RED, rot = -12, size = 150, x = 0, y = 0, font = FONT.heavy,
}) => {
  const f = useCurrentFrame();
  const t = f - at;
  if (t < 0) return null;
  const p = interpolate(t, [0, 5], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const s = interpolate(p, [0, 1], [2.4, 1]) * (t > 5 ? 1 + 0.04 * Math.exp(-(t - 5) / 2) : 1);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div dir="auto" style={{
        transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${s})`, opacity: p * 0.92,
        border: `${size * 0.06}px solid ${color}`, borderRadius: size * 0.12, padding: `${size * 0.02}px ${size * 0.25}px`,
        color, fontFamily: font, fontWeight: 900, fontSize: size, lineHeight: 1.25, whiteSpace: "nowrap",
        WebkitMaskImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.2 1.7'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>\")",
        mixBlendMode: "normal", textShadow: "none",
      }}>
        {text}
      </div>
      <Sfx event="stamp" at={at + 5} seed={text.length} />
    </AbsoluteFill>
  );
};

// ───────────── شبكة النسخ واللصق ─────────────
// بطاقات فيديو متطابقة تتكاثر كالخلايا: نفس العنوان، نفس الصورة، نفس السهم الأحمر.
const CARD_TITLES = [
  "كيف تبني تطبيق بالذكاء الاصطناعي في 5 دقائق",
  "اربح آلاف الدولارات بالذكاء الاصطناعي بضغطة زر",
  "هذا النموذج دمّر ChatGPT!",
];
export const FakeCard: React.FC<{ title: string; w?: number; hue?: number; seed?: number }> = ({ title, w = 360, hue = 0, seed = 0 }) => (
  <div style={{ width: w, background: "#0f0f0f", borderRadius: 12, overflow: "hidden", fontFamily: FONT.ui, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
    <div style={{ height: w * 0.5625, background: `linear-gradient(135deg, hsl(${hue},85%,50%), hsl(${hue + 40},90%,40%))`, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div dir="rtl" style={{ fontFamily: FONT.display, color: "#fff", fontSize: w * 0.11, textAlign: "center", padding: 10, textShadow: "0 3px 0 #000, 0 0 20px rgba(0,0,0,0.6)", lineHeight: 1.2 }}>
        {seed % 2 ? "بضغطة زر!" : "سر لا يعرفه أحد"}
      </div>
      <div style={{ position: "absolute", right: 14, bottom: 10, fontSize: w * 0.16 }}>
        <svg width={w * 0.2} height={w * 0.2} viewBox="0 0 10 10"><path d="M1 9 L8 2 M8 2 L4 2 M8 2 L8 6" stroke="#ff2020" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
      </div>
      <div style={{ position: "absolute", left: 8, bottom: 8, background: "rgba(0,0,0,0.8)", color: "#fff", fontSize: w * 0.04, padding: "2px 6px", borderRadius: 4 }}>5:03</div>
    </div>
    <div dir="rtl" style={{ color: "#f1f1f1", fontSize: w * 0.045, padding: "10px 12px 14px", lineHeight: 1.35 }}>{title}</div>
  </div>
);

export const CloneGrid: React.FC<{ stampAt?: number; stampText?: string; title?: number }> = ({ stampAt = 40, stampText = "COPY + PASTE", title = 0 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cols = 5, rows = 4, w = 330;
  const cards = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      // التكاثر ينتشر من المركز للخارج
      const d = Math.hypot(c - 2, r - 1.5);
      const p = spring({ frame: f - d * 5, fps, config: { damping: 15, stiffness: 160 } });
      cards.push(
        <div key={i} style={{ position: "absolute", left: 960 + (c - 2) * (w + 26) - w / 2, top: 540 + (r - 1.5) * (w * 0.84) - w * 0.42, transform: `scale(${p}) rotate(${(random(`cr${i}`) - 0.5) * 6}deg)` }}>
          <FakeCard title={CARD_TITLES[title]} w={w} hue={0} seed={1} />
        </div>
      );
    }
  const zoomOut = interpolate(f, [0, 60], [1.25, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${zoomOut})` }}>{cards}</AbsoluteFill>
      <Stamp text={stampText} at={stampAt} size={140} font={FONT.mono} />
      <Sfx event="transition.whoosh" at={6} />
    </AbsoluteFill>
  );
};

// ───────────── فقاعة كلام ساخرة ─────────────
export const Bubble: React.FC<{ text: string; delay?: number; x?: number; y?: number; rot?: number; size?: number; tail?: "left" | "right"; bg?: string; color?: string; font?: string }> = ({
  text, delay = 0, x = 0, y = 0, rot = -2, size = 70, tail = "right", bg = "#fff", color = "#111", font = FONT.punch,
}) => (
  <Sticker delay={delay} x={x} y={y} rot={rot} edge={0} seed={delay}>
    <div style={{ position: "relative", background: bg, color, fontFamily: font, fontSize: size, padding: `${size * 0.25}px ${size * 0.5}px`, borderRadius: size * 0.5, maxWidth: 1300, textAlign: "center", lineHeight: 1.4, border: "4px solid #111" }} dir="rtl">
      {text}
      <div style={{ position: "absolute", bottom: -size * 0.45, [tail]: size * 0.8, width: 0, height: 0, borderLeft: `${size * 0.3}px solid transparent`, borderRight: `${size * 0.3}px solid transparent`, borderTop: `${size * 0.5}px solid #111` }} />
    </div>
  </Sticker>
);

/** عنوان فصل: رقم ضخم بخط رفيع + عنوان بالطبشور يُكتب */
export const Chapter: React.FC<{ n: number; title: string; sub?: string }> = ({ n, title, sub }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f, fps, config: { damping: 20 } });
  const write = interpolate(f, [8, 34], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const edge = write * 130 - 15;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", fontFamily: FONT.serifDisplay, fontSize: 620, color: "rgba(255,255,255,0.07)", transform: `translateY(${(1 - p) * 120}px)`, lineHeight: 1 }}>
        {String(n).padStart(2, "0")}
      </div>
      <div style={{ fontFamily: FONT.mono, color: LIME, fontSize: 30, letterSpacing: 8, opacity: p, marginBottom: 20 }}>CHAPTER {String(n).padStart(2, "0")}</div>
      <div dir="rtl" style={{ fontFamily: FONT.display, color: CHALK, fontSize: 130, lineHeight: 1.3, textAlign: "center", maxWidth: 1600,
        WebkitMaskImage: `linear-gradient(to left, black ${edge}%, transparent ${edge + 15}%)`, textShadow: "0 0 18px rgba(255,255,255,0.25)" }}>
        {title}
      </div>
      {sub && <div dir="rtl" style={{ fontFamily: FONT.body, color: "rgba(243,241,232,0.7)", fontSize: 40, marginTop: 10, opacity: interpolate(f, [30, 45], [0, 1], clamp) }}>{sub}</div>}
      <Sfx event="chalk.write" at={8} />
      <Sfx event="transition.whip" at={0} />
    </AbsoluteFill>
  );
};
