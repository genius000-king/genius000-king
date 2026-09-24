// ═══════════════════════════════════════════════════════════════════
//  مكتبة الطباعة الحركية
//  كل نص له "شخصية" = خطّ + حركة + صوت. الثلاثة يُعرَّفون معاً هنا،
//  فلا يمكن أن تظهر كلمة بلا صوتها، ولا أن يُستعمل صوت لا يخصّها.
//
//  ملاحظة عربية مهمّة: الحروف العربية متّصلة، فتحريك كل حرف منفرداً
//  يكسر الوصل ويشوّه الكلمة. لذلك نحرّك العربي بالكلمة أو بالقناع
//  (clip/mask)، ونحرّك اللاتيني بالحرف.
// ═══════════════════════════════════════════════════════════════════
import React, { useId } from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT } from "../theme/fonts";
import { Sfx, SfxTrain } from "../sfx/library";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const Center: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", ...style }}>{children}</AbsoluteFill>
);

// ───────────────────────────────────────────────────────────────────
// 1) LiquidFill — الكلمة تُرسم بالقلم أولاً، ثم يمتلئ داخلها سائل يرتفع
//    بموجة حقيقية وفقاعات، ثم يستقرّ الحبر. (خاص بعنوان مثل "الموائع")
// ───────────────────────────────────────────────────────────────────
export const LiquidFill: React.FC<{
  text: string;
  sub?: string;
  size?: number;
  font?: string;
  liquid?: string;
  ink?: string;
  drawFrames?: number;
  fillFrames?: number;
}> = ({ text, sub, size = 300, font = FONT.display, liquid = "#1f6fb2", ink = "#17171a", drawFrames = 40, fillFrames = 70 }) => {
  const f = useCurrentFrame();
  const id = useId().replace(/:/g, "");
  const W = 1920, H = 1080, baseY = 560;
  const draw = interpolate(f, [0, drawFrames], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const fillStart = drawFrames - 8;
  const fill = interpolate(f, [fillStart, fillStart + fillFrames], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  // مستوى السائل من أسفل الحروف إلى أعلاها
  const top = baseY - size * 0.95, bottom = baseY + size * 0.35;
  const level = bottom - (bottom - top) * fill;
  // الموجة تهدأ كلما امتلأت (سائل يستقرّ) — سعة تتناقص
  const amp = 18 * (1 - fill) + 2;
  const ph = f / 5;
  let d = `M 0 ${H} L 0 ${level}`;
  for (let x = 0; x <= W; x += 24) {
    const y = level + Math.sin(x / 70 + ph) * amp + Math.sin(x / 31 - ph * 1.7) * amp * 0.35;
    d += ` L ${x} ${y}`;
  }
  d += ` L ${W} ${H} Z`;
  // تحوّل لون السائل إلى الحبر النهائي بعد الامتلاء
  const settle = interpolate(f, [fillStart + fillFrames - 10, fillStart + fillFrames + 15], [0, 1], clamp);
  const bubbles = Array.from({ length: 26 }, (_, i) => {
    const born = fillStart + random(`b${i}`) * fillFrames * 0.9;
    const age = f - born;
    if (age < 0 || age > 40) return null;
    const bx = W / 2 + (random(`bx${i}`) - 0.5) * size * text.length * 0.42;
    const by = bottom - age * (4 + random(`bs${i}`) * 5);
    if (by < level) return null;
    return <circle key={i} cx={bx + Math.sin(age / 4 + i) * 6} cy={by} r={3 + random(`br${i}`) * 7} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={2} />;
  });
  const subIn = spring({ frame: f - (fillStart + fillFrames - 20), fps: 30, config: { damping: 200 } });
  const textProps = {
    x: W / 2, y: baseY, textAnchor: "middle" as const, fontFamily: font, fontSize: size, direction: "rtl" as const,
  };
  // أزمنة الفقاعات الصوتية = لحظة ولادة بعض الفقاعات المرئية (الصوت يتبع الصورة فعلاً)
  const bubbleHits = Array.from({ length: 10 }, (_, i) => Math.round(fillStart + random(`b${i * 2}`) * fillFrames * 0.9));
  return (
    <AbsoluteFill>
      <svg width={W} height={H} style={{ position: "absolute" }}>
        <defs>
          <clipPath id={`c${id}`}>
            <text {...textProps}>{text}</text>
          </clipPath>
          <linearGradient id={`lg${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6cc4ff" />
            <stop offset="1" stopColor={liquid} />
          </linearGradient>
        </defs>
        {/* السائل داخل الحروف */}
        <g clipPath={`url(#c${id})`}>
          <path d={d} fill={`url(#lg${id})`} opacity={1 - settle} />
          <rect width={W} height={H} fill={ink} opacity={settle} />
          <g opacity={1 - settle}>{bubbles}</g>
        </g>
        {/* الحدّ المرسوم بالقلم */}
        <text {...textProps} fill="none" stroke={ink} strokeWidth={3} strokeDasharray={1400} strokeDashoffset={1400 * (1 - draw)} opacity={1 - settle}>
          {text}
        </text>
      </svg>
      {sub && (
        <div
          style={{
            position: "absolute", top: baseY + size * 0.28, width: "100%", textAlign: "center",
            fontFamily: FONT.serif, fontSize: size * 0.42, color: ink, letterSpacing: interpolate(subIn, [0, 1], [30, 2]),
            opacity: subIn, filter: `blur(${(1 - subIn) * 10}px)`,
          }}
        >
          {sub}
        </div>
      )}
      <Sfx event="write.pen" at={0} maxDur={drawFrames + 4} />
      <Sfx event="fluid.fill" at={fillStart} maxDur={fillFrames + 10} />
      <SfxTrain event="fluid.bubble" frames={bubbleHits} />

    </AbsoluteFill>
  );
};

// ───────────────────────────────────────────────────────────────────
// 2) Slam — كلمة ثقيلة تسقط من فوق الكاميرا وترتطم: موجة صدمة + غبار
//    + ظلّ لوني. ارتطامها عند `impact` (يُمرَّر للكاميرا كي تهتزّ).
// ───────────────────────────────────────────────────────────────────
export const SLAM_IMPACT = 9;
export const Slam: React.FC<{ text: string; size?: number; font?: string; color?: string; accent?: string; y?: number }> = ({
  text, size = 260, font = FONT.heavy, color = "#111", accent = "#e63946", y = 0,
}) => {
  const f = useCurrentFrame();
  const fall = interpolate(f, [0, SLAM_IMPACT], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const scale = interpolate(fall, [0, 1], [3.2, 1]) * (f >= SLAM_IMPACT ? 1 + 0.06 * Math.exp(-(f - SLAM_IMPACT) / 3) * Math.cos((f - SLAM_IMPACT) * 1.3) : 1);
  const blur = (1 - fall) * 18;
  const t = f - SLAM_IMPACT;
  const ring = t >= 0 ? interpolate(t, [0, 22], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 0;
  const split = t >= 0 ? 14 * Math.exp(-t / 5) : 0;
  const dust = Array.from({ length: 34 }, (_, i) => {
    if (t < 0 || t > 30) return null;
    const a = random(`da${i}`) * Math.PI * 2;
    const v = 8 + random(`dv${i}`) * 26;
    const px = Math.cos(a) * v * t * (1 - t / 60);
    const py = Math.sin(a) * v * t * 0.5 * (1 - t / 60) + t * t * 0.15;
    return (
      <div key={i} style={{
        position: "absolute", left: "50%", top: `calc(50% + ${y + size * 0.3}px)`, width: 6 + random(`ds${i}`) * 10, height: 6 + random(`ds${i}`) * 10,
        borderRadius: 99, background: "rgba(40,40,40,0.5)", transform: `translate(${px}px, ${py}px)`, opacity: 1 - t / 30, filter: "blur(1px)",
      }} />
    );
  });
  const shadow = `${split}px 0 0 ${accent}aa, ${-split}px 0 0 rgba(0,160,255,0.6)`;
  return (
    <Center>
      <div style={{
        position: "absolute", width: 900 * ring, height: 900 * ring * 0.35, borderRadius: "50%",
        border: `${6 * (1 - ring)}px solid ${accent}`, opacity: (1 - ring) * 0.8, transform: `translateY(${y + size * 0.3}px)`,
      }} />
      {dust}
      <div dir="rtl" style={{
        fontFamily: font, fontSize: size, color, fontWeight: 900, lineHeight: 1.2, transform: `translateY(${y}px) scale(${scale})`,
        filter: `blur(${blur}px)`, opacity: interpolate(f, [0, 3], [0, 1], clamp), textShadow: shadow,
      }}>
        {text}
      </div>
      <Sfx event="title.slam" at={SLAM_IMPACT} />
    </Center>
  );
};

// ───────────────────────────────────────────────────────────────────
// 3) WordCascade — جملة تبني نفسها كلمة كلمة: كل كلمة تصعد من الضباب
//    وتدور قليلاً في العمق. الكلمات المفتاحية يمرّ خلفها قلم تحديد.
// ───────────────────────────────────────────────────────────────────
export const WordCascade: React.FC<{
  text: string; size?: number; font?: string; color?: string; stagger?: number; keys?: string[]; highlight?: string | null; keyColor?: string; maxWidth?: number;
}> = ({ text, size = 110, font = FONT.punch, color = "#151515", stagger = 6, keys = [], highlight = "#ffe45c", keyColor, maxWidth = 1500 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  const hits: number[] = [];
  return (
    <Center>
      <div dir="rtl" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: `0 ${size * 0.28}px`, maxWidth, perspective: 800 }}>
        {words.map((w, i) => {
          const start = i * stagger;
          hits.push(start);
          const p = spring({ frame: f - start, fps, config: { damping: 14, mass: 0.6, stiffness: 140 } });
          const isKey = keys.includes(w);
          const hl = isKey ? interpolate(f, [start + 8, start + 20], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 0;
          return (
            <span key={i} style={{ position: "relative", display: "inline-block", fontFamily: font, fontSize: size, color: isKey && keyColor ? keyColor : color, lineHeight: 1.45,
              transform: `translateY(${(1 - p) * 70}px) rotateX(${(1 - p) * -70}deg)`, opacity: Math.min(1, p * 1.5), filter: `blur(${Math.max(0, 1 - p) * 14}px)` }}>
              {isKey && highlight && (
                <span style={{ position: "absolute", insetInline: -10, top: "38%", height: "46%", background: highlight, zIndex: -1,
                  transformOrigin: "right", transform: `scaleX(${hl}) skewX(-8deg)`, borderRadius: 6, mixBlendMode: "multiply" }} />
              )}
              {w}
            </span>
          );
        })}
      </div>
      <SfxTrain event="word.pop" frames={hits} gain={0.9} />
      {highlight && words.map((w, i) => (keys.includes(w) ? <Sfx key={`k${i}`} event="mark.highlight" at={i * stagger + 8} seed={i} /> : null))}
    </Center>
  );
};

// ───────────────────────────────────────────────────────────────────
// 4) Typewriter — خطّ رقمي، حرف بحرف، مؤشّر يرمش، وصوت مفتاح لكل حرف
//    بتوقيت "بشري" غير منتظم (البشر لا يكتبون بإيقاع ثابت).
// ───────────────────────────────────────────────────────────────────
export const Typewriter: React.FC<{ text: string; size?: number; font?: string; color?: string; cps?: number; dir?: "rtl" | "ltr"; caret?: string }> = ({
  text, size = 90, font = FONT.digital, color = "#101010", cps = 16, dir = "rtl", caret = "#e63946",
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // جدول زمني لكل حرف مع تذبذب بشري، وتوقّف أطول بعد المسافات وعلامات الترقيم
  const times: number[] = [];
  let t = 0;
  for (let i = 0; i < text.length; i++) {
    times.push(Math.round(t));
    const ch = text[i];
    t += (fps / cps) * (0.6 + random(`tw${i}`) * 0.8) * (ch === " " ? 1.6 : /[،,.:؟?]/.test(ch) ? 3 : 1);
  }
  const shown = times.filter((x) => x <= f).length;
  const blink = Math.floor(f / 8) % 2 === 0 || shown < text.length;
  const keyFrames = times.filter((_, i) => text[i] !== " ");
  return (
    <Center>
      <div dir={dir} style={{ fontFamily: font, fontSize: size, color, whiteSpace: "pre", fontWeight: 700 }}>
        {text.slice(0, shown)}
        <span style={{ display: "inline-block", width: size * 0.08, height: size * 0.95, background: caret, marginInline: 8, verticalAlign: "middle", opacity: blink ? 1 : 0 }} />
      </div>
      <SfxTrain event="type.key" frames={keyFrames} />
      <Sfx event="type.enter" at={Math.round(t) + 4} />
    </Center>
  );
};

// ───────────────────────────────────────────────────────────────────
// 5) GlitchText — يدخل مكسوراً: شرائح تنزاح، قنوات RGB تنفصل، ثم يستقرّ.
//    ويعود للارتعاش في "دفقات" قصيرة كأنّ الإشارة غير مستقرة.
// ───────────────────────────────────────────────────────────────────
export const GlitchText: React.FC<{ text: string; size?: number; font?: string; color?: string; bursts?: number[] }> = ({
  text, size = 170, font = FONT.kufi, color = "#f4f4f4", bursts = [40],
}) => {
  const f = useCurrentFrame();
  const inBurst = f < 14 || bursts.some((b) => f >= b && f < b + 8);
  const k = inBurst ? 1 : 0;
  const slices = 7;
  return (
    <Center>
      <div style={{ position: "relative", fontFamily: font, fontSize: size, fontWeight: 700, lineHeight: 1.3 }} dir="rtl">
        {Array.from({ length: slices }, (_, i) => {
          const off = k * (random(`gx${i}-${Math.floor(f / 2)}`) - 0.5) * 80;
          const top = (i / slices) * 100, bot = 100 - ((i + 1) / slices) * 100;
          return (
            <div key={i} style={{ position: i ? "absolute" : "relative", inset: 0, clipPath: `inset(${top}% 0 ${bot}% 0)`, transform: `translateX(${off}px)` }}>
              <span style={{ position: "absolute", inset: 0, color: "#ff004c", transform: `translateX(${k * 9}px)`, mixBlendMode: "screen", opacity: 0.9 }}>{text}</span>
              <span style={{ position: "absolute", inset: 0, color: "#00e5ff", transform: `translateX(${-k * 9}px)`, mixBlendMode: "screen", opacity: 0.9 }}>{text}</span>
              <span style={{ position: "relative", color }}>{text}</span>
            </div>
          );
        })}
      </div>
      <Sfx event="glitch" at={0} />
      {bursts.map((b, i) => <Sfx key={i} event="glitch" at={b} seed={i + 1} gain={0.6} />)}
    </Center>
  );
};

// ───────────────────────────────────────────────────────────────────
// 6) InkReveal — اقتباس بخطّ الرقعة: قناع حبر ينساب من اليمين لليسار
//    بحافة ناعمة، مع توهّج خفيف. (أنيق، للجمل التي لها روح)
// ───────────────────────────────────────────────────────────────────
export const InkReveal: React.FC<{ text: string; size?: number; font?: string; color?: string; frames?: number; caption?: string; captionColor?: string }> = ({
  text, size = 130, font = FONT.ruqaa, color = "#1b1b1b", frames = 45, caption, captionColor = "#555",
}) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, frames], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const edge = p * 130 - 15; // الحافة تتحرك من اليمين
  const mask = `linear-gradient(to left, black ${edge}%, transparent ${edge + 15}%)`;
  const cap = spring({ frame: f - frames + 5, fps: 30, config: { damping: 200 } });
  return (
    <Center style={{ flexDirection: "column" }}>
      <div dir="rtl" style={{ fontFamily: font, fontSize: size, color, fontWeight: 700, WebkitMaskImage: mask, maskImage: mask, textShadow: "0 0 30px rgba(0,0,0,0.12)", lineHeight: 1.5 }}>
        {text}
      </div>
      {caption && (
        <div style={{ fontFamily: FONT.serifDisplay, fontStyle: "italic", fontSize: size * 0.4, color: captionColor, opacity: cap, transform: `translateY(${(1 - cap) * 20}px)` }}>
          {caption}
        </div>
      )}
      <Sfx event="write.pen" at={0} maxDur={frames} gain={0.6} />
      <Sfx event="reveal.elegant" at={frames - 6} />
    </Center>
  );
};

// ───────────────────────────────────────────────────────────────────
// 7) BilingualSplit — عربي وإنجليزي ينزلقان من جهتين متعاكستين تحت
//    قناع، ويُرسم بينهما خط رفيع. (للمصطلحات: "الموائع / Fluids")
// ───────────────────────────────────────────────────────────────────
export const BilingualSplit: React.FC<{ ar: string; en: string; size?: number; color?: string; line?: string }> = ({
  ar, en, size = 150, color = "#141414", line = "#e63946",
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame: f - 6, fps, config: { damping: 18, stiffness: 90 } });
  const b = spring({ frame: f - 12, fps, config: { damping: 18, stiffness: 90 } });
  const l = interpolate(f, [0, 16], [0, 1], { ...clamp, easing: Easing.out(Easing.exp) });
  return (
    <Center style={{ flexDirection: "column" }}>
      <div style={{ overflow: "hidden", padding: "0 30px" }}>
        <div dir="rtl" style={{ fontFamily: FONT.display, fontSize: size, color, transform: `translateX(${(1 - a) * 700}px)`, lineHeight: 1.35 }}>{ar}</div>
      </div>
      <div style={{ width: 620 * l, height: 3, background: line, margin: "6px 0 16px" }} />
      <div style={{ overflow: "hidden", padding: "0 30px" }}>
        <div style={{ fontFamily: FONT.serif, fontSize: size * 0.62, color, transform: `translateX(${(b - 1) * 700}px)`, fontStyle: "italic" }}>{en}</div>
      </div>
      <Sfx event="transition.whoosh" at={10} />
    </Center>
  );
};

// ───────────────────────────────────────────────────────────────────
// 8) CountUp — عدّاد "عدّاد مسافات": كل خانة تدور مستقلّة، والتسارع يتباطأ
//    قرب النهاية. صوت نقرة عند كل تغيّر في الخانة الأعلى + نغمة وصول.
// ───────────────────────────────────────────────────────────────────
export const CountUp: React.FC<{ to: number; frames?: number; suffix?: string; label?: string; size?: number; color?: string; accent?: string; labelColor?: string; note?: string }> = ({
  to, frames = 50, suffix = "", label, size = 260, color = "#111", accent = "#e63946", labelColor = "#444", note,
}) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, frames], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const v = to * p;
  const digits = String(Math.round(to)).length;
  const cols = Array.from({ length: digits }, (_, i) => {
    const place = 10 ** (digits - 1 - i);
    // منطق عدّاد المسافات الحقيقي: الخانة ثابتة على رقمها، ولا تدور إلا حين
    // تكون الخانات الأدنى منها تعبر من 9 إلى 0 (آخر 10% من دورتها)
    const x = v / place;
    const base = Math.floor(x) % 10;
    const rem = x - Math.floor(x);
    const roll = place === 1 ? rem : rem > 0.9 ? (rem - 0.9) * 10 : 0;
    return base + roll;
  });
  const ticks: number[] = [];
  let last = -1;
  for (let i = 0; i <= frames; i++) {
    const vv = Math.floor((to * interpolate(i, [0, frames], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) })) / Math.max(1, 10 ** (digits - 2)));
    if (vv !== last && i - (ticks[ticks.length - 1] ?? -9) >= 2) { ticks.push(i); last = vv; }
  }
  const done = spring({ frame: f - frames, fps: 30, config: { damping: 10 } });
  return (
    <Center style={{ flexDirection: "column" }}>
      <div style={{ display: "flex", fontFamily: FONT.heavy, fontWeight: 900, fontSize: size, color, lineHeight: 1, direction: "ltr", transform: `scale(${1 + done * 0.04 - (f > frames ? 0.04 * Math.min(1, (f - frames) / 10) : 0)})` }}>
        {cols.map((c, i) => (
          <div key={i} style={{ height: size, overflow: "hidden", width: size * 0.62, textAlign: "center" }}>
            <div style={{ transform: `translateY(${-c * size}px)` }}>
              {Array.from({ length: 11 }, (_, n) => <div key={n} style={{ height: size }}>{n % 10}</div>)}
            </div>
          </div>
        ))}
        <span style={{ color: accent }}>{suffix}</span>
      </div>
      {label && <div dir="rtl" style={{ fontFamily: FONT.body, fontWeight: 600, fontSize: size * 0.2, color: labelColor, marginTop: 20, opacity: interpolate(f, [frames - 10, frames + 5], [0, 1], clamp) }}>{label}</div>}
      {note && <div dir="rtl" style={{ fontFamily: FONT.mono, fontSize: 24, color: labelColor, opacity: 0.6, marginTop: 10 }}>{note}</div>}
      <SfxTrain event="count.tick" frames={ticks} />
      <Sfx event="count.done" at={frames} />
    </Center>
  );
};
