// ═══════════════════════════════════════════════════════════════════
//  نافذة macOS — الإطار الذي تعيش فيه كل تسجيلات الشاشة
//  تفاصيل الأصالة: الأزرار الثلاثة بألوانها الدقيقة وحدودها الداخلية،
//  شريط عنوان زجاجي، حقل رابط بقفل، زوايا 12px، ظلّان (قريب حادّ + بعيد
//  ناعم) كما يرسمها macOS فعلاً. تدخل بمنظور ثلاثي الأبعاد وتطفو.
// ═══════════════════════════════════════════════════════════════════
import React from "react";
import { AbsoluteFill, Easing, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT } from "../theme/fonts";
import { Sfx } from "../sfx/library";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const Lights: React.FC = () => (
  <div style={{ display: "flex", gap: 9, paddingInline: 18 }}>
    {[
      ["#ff5f57", "#e0443e"],
      ["#febc2e", "#dea123"],
      ["#28c840", "#1aab29"],
    ].map(([c, b]) => (
      <div key={c} style={{ width: 14, height: 14, borderRadius: 99, background: c, boxShadow: `inset 0 0 0 0.5px ${b}` }} />
    ))}
  </div>
);

export interface ZoomKey {
  /** الفريم (بزمن المشهد) */
  at: number;
  /** مقدار التقريب 1 = بلا تقريب */
  scale: number;
  /** نقطة التركيز بالنسبة 0..1 داخل الشاشة */
  x: number;
  y: number;
}

/** تقريب تلقائي على طريقة Screen Studio: انتقالات ناعمة بين "لقطات" تركيز */
const zoomAt = (f: number, keys: ZoomKey[]) => {
  if (!keys.length) return { scale: 1, x: 0.5, y: 0.5 };
  let a = keys[0], b = keys[0];
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].at <= f) { a = keys[i]; b = keys[i + 1] ?? keys[i]; }
  }
  if (f < keys[0].at) return keys[0];
  const span = Math.min(24, Math.max(1, b.at - a.at)); // الانتقال يستغرق 24 فريماً ثم يثبت
  const p = interpolate(f, [b.at - span, b.at], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  if (a === b) return a;
  return { scale: a.scale + (b.scale - a.scale) * p, x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, at: f };
};

export const MacWindow: React.FC<{
  src?: string;
  children?: React.ReactNode;
  url?: string;
  title?: string;
  width?: number;
  aspect?: number;
  startFrom?: number; // ثوانٍ داخل التسجيل
  zoom?: ZoomKey[];
  dark?: boolean;
  enterSfx?: boolean;
  exitAt?: number; // فريم الخروج (اختياري)
}> = ({ src, children, url, title, width = 1560, aspect = 1000 / 1600, startFrom = 0, zoom = [], dark = true, enterSfx = true, exitAt }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inP = spring({ frame: f, fps, config: { damping: 20, stiffness: 80, mass: 1.1 } });
  const outP = exitAt ? interpolate(f, [exitAt, exitAt + 14], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) }) : 0;
  const rx = interpolate(inP, [0, 1], [38, 4]) + Math.sin(f / 60) * 1.2;
  const ry = interpolate(inP, [0, 1], [-22, -3]) + Math.cos(f / 75) * 1.5;
  const ty = interpolate(inP, [0, 1], [500, 0]) + Math.sin(f / 45) * 6 + outP * -900;
  const sc = interpolate(inP, [0, 1], [0.7, 1]) * (1 - outP * 0.2);
  const barH = 52;
  const h = width * aspect;
  const z = zoomAt(f, zoom);
  const bar = dark ? "rgba(40,40,44,0.92)" : "rgba(236,236,236,0.92)";
  const txt = dark ? "#d8d8dc" : "#333";
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", perspective: 2200 }}>
      <div style={{
        width, borderRadius: 12, overflow: "hidden", transformStyle: "preserve-3d",
        transform: `translateY(${ty}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${sc})`,
        boxShadow: "0 0 0 0.5px rgba(0,0,0,0.6), 0 2px 6px rgba(0,0,0,0.25), 0 40px 120px rgba(0,0,0,0.55)",
        opacity: interpolate(f, [0, 6], [0, 1], clamp) * (1 - outP),
      }}>
        {/* شريط العنوان */}
        <div style={{ height: barH, background: bar, backdropFilter: "blur(20px)", display: "flex", alignItems: "center", position: "relative", borderBottom: `1px solid ${dark ? "#000" : "#cfcfcf"}` }}>
          <Lights />
          {url && (
            <div style={{
              position: "absolute", left: "50%", transform: "translateX(-50%)", width: width * 0.42, height: 32, borderRadius: 8,
              background: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              fontFamily: FONT.ui, fontSize: 17, color: txt,
            }}>
              <svg width="12" height="14" viewBox="0 0 12 14"><path d="M2 6V4a4 4 0 118 0v2h1v8H1V6zm2 0h4V4a2 2 0 10-4 0z" fill={txt} /></svg>
              {url}
            </div>
          )}
          {title && !url && <div style={{ position: "absolute", width: "100%", textAlign: "center", fontFamily: FONT.ui, fontSize: 17, color: txt }}>{title}</div>}
        </div>
        {/* المحتوى */}
        <div style={{ width, height: h, overflow: "hidden", background: "#000", position: "relative" }}>
          <div style={{ width: "100%", height: "100%", transformOrigin: `${z.x * 100}% ${z.y * 100}%`, transform: `scale(${z.scale})` }}>
            {src ? (
              <OffthreadVideo src={staticFile(src)} startFrom={Math.round(startFrom * fps)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : children}
          </div>
          {/* لمعة زجاج خفيفة على الشاشة */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(115deg, rgba(255,255,255,0.07), transparent 35%)", pointerEvents: "none" }} />
        </div>
      </div>
      {enterSfx && <Sfx event="window.open" at={4} />}
      {exitAt !== undefined && <Sfx event="window.close" at={exitAt + 4} />}
      {zoom.slice(1).map((k, i) => <Sfx key={i} event="screen.zoom" at={k.at - 12} seed={i} />)}
    </AbsoluteFill>
  );
};
