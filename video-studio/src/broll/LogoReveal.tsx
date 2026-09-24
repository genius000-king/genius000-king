// كشف الشعار: الشعار يُسحب من العدم بلون علامته الرسمي — دوائر ضوء بلونه
// تتمدّد، ومضة، ثم يستقرّ مع لمعة تمرّ عليه. اسم العلامة يكتب تحته.
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import manifest from "../../public/broll/logos/manifest.json";
import { FONT } from "../theme/fonts";
import { Sfx } from "../sfx/library";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
type Entry = { file: string; color: string; title: string };

/** `at` = فريم لحظة الكشف (الرايزر يُبنى قبلها تلقائياً) */
export const LogoReveal: React.FC<{ brand: keyof typeof manifest | string; at?: number; size?: number; label?: string; dark?: boolean }> = ({
  brand, at = 20, size = 300, label, dark = true,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = (manifest as Record<string, Entry>)[brand];
  if (!e) throw new Error(`الشعار "${brand}" غير موجود — شغّل: node tools/fetch-logo.mjs ${brand}`);
  const color = e.color === "#000000" && dark ? "#ffffff" : e.color;
  const pre = interpolate(f, [at - 25, at], [0, 1], clamp); // تجمّع الطاقة قبل الكشف
  const p = spring({ frame: f - at, fps, config: { damping: 11, stiffness: 120 } });
  const t = f - at;
  const rings = [0, 6, 12].map((d, i) => {
    const r = interpolate(t - d, [0, 30], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
    return <div key={i} style={{ position: "absolute", width: size * 3.2 * r, height: size * 3.2 * r, borderRadius: "50%", border: `${3 - i}px solid ${color}`, opacity: t - d > 0 ? (1 - r) * 0.7 : 0 }} />;
  });
  const sweep = interpolate(t, [10, 34], [-120, 220], clamp);
  const flash = t >= 0 ? Math.exp(-t / 3) : 0;
  const labelIn = spring({ frame: f - at - 12, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {/* هالة بلون العلامة */}
      <div style={{ position: "absolute", width: size * 3, height: size * 3, borderRadius: "50%", background: `radial-gradient(circle, ${color}55, transparent 65%)`, opacity: Math.max(pre * 0.5, p * 0.8), transform: `scale(${0.6 + pre * 0.3 + p * 0.2})` }} />
      {rings}
      <div style={{ position: "relative", width: size, height: size, transform: `scale(${p}) rotate(${(1 - p) * -25}deg)`, filter: `drop-shadow(0 20px 60px ${color}88)` }}>
        <Img src={staticFile(e.file)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        {/* لمعة تمرّ على الشعار نفسه (مقنّعة بشكله) */}
        <div style={{
          position: "absolute", inset: 0, WebkitMaskImage: `url(${staticFile(e.file)})`, WebkitMaskSize: "contain", WebkitMaskRepeat: "no-repeat", WebkitMaskPosition: "center",
          background: `linear-gradient(110deg, transparent ${sweep - 20}%, rgba(255,255,255,0.85) ${sweep}%, transparent ${sweep + 20}%)`,
        }} />
      </div>
      <div style={{ position: "absolute", inset: 0, background: "white", opacity: flash * 0.35 }} />
      <div style={{ position: "absolute", top: `calc(50% + ${size * 0.62}px)`, fontFamily: label ? FONT.kufi : FONT.serifDisplay, fontSize: size * 0.26, color: dark ? "#f2f2f2" : "#111", fontWeight: 700,
        opacity: labelIn, letterSpacing: label ? 0 : interpolate(labelIn, [0, 1], [24, 1]), transform: `translateY(${(1 - labelIn) * 25}px)` }} dir={label ? "rtl" : "ltr"}>
        {label ?? e.title}
      </div>
      <Sfx event="logo.reveal" at={at} />
    </AbsoluteFill>
  );
};
