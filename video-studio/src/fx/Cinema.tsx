// ═══════════════════════════════════════════════════════════════════
//  الكاميرا السينمائية ثلاثية الأبعاد
//  كل مشهد يعيش في فضاء حقيقي من ثلاث طبقات:
//    1) السبورة في العمق (z = -700) — تتحرّك ببطء أكثر = اختلاف منظر (parallax)
//    2) المحتوى (z = 0)
//    3) غبار طبشور عائم أمام العدسة (z = +150..+650) — يعطي العمق "اللمس"
//  والكاميرا تتحرك بين المشاهد بحركات سينمائية بدل القطع:
//    dolly  — يندفع المشهد من العمق نحونا
//    orbit  — الكاميرا تدور حول المشهد (رافعة أفقية)
//    crane  — الكاميرا تهبط من فوق
//    roll   — دوران حول محور العدسة مع زووم
//    push   — تبدأ ملتصقة بالمشهد ثم تنسحب للخلف
//  وتخرج كل لقطة بـ"اختراق": المحتوى يعبر العدسة، فيبدو القطع كطيران متصل.
// ═══════════════════════════════════════════════════════════════════
import React from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";
import { noise2D } from "@remotion/noise";
import { Sfx } from "../sfx/library";

export type Move = "dolly" | "orbit" | "crane" | "roll" | "push";
const MOVES: Move[] = ["dolly", "orbit", "push", "crane", "dolly", "roll", "orbit", "push"];
export const moveFor = (i: number) => MOVES[i % MOVES.length];

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const IN = 18, OUT = 9;

const Dust: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <>
      {Array.from({ length: 34 }, (_, i) => {
        const z = 150 + random(`dz${i}`) * 500;
        const x = (random(`dx${i}`) - 0.5) * 2200 + noise2D(`dnx${i}`, f / 160, 0) * 60 + f * 0.25 * (random(`dv${i}`) - 0.3);
        const y = (random(`dy${i}`) - 0.5) * 1300 + noise2D(`dny${i}`, f / 160, 1) * 50 - f * 0.12;
        const s = 2 + random(`ds${i}`) * 5;
        return (
          <div key={i} style={{
            position: "absolute", left: "50%", top: "50%", width: s, height: s, borderRadius: "50%",
            background: "rgba(255,255,245,0.8)", filter: `blur(${(z - 150) / 140 + 0.3}px)`,
            transform: `translate3d(${x}px, ${y}px, ${z}px)`, opacity: 0.25 + random(`do${i}`) * 0.45,
          }} />
        );
      })}
    </>
  );
};

export const Cinema: React.FC<{
  children: React.ReactNode;
  bg: React.ReactNode;
  dur: number;
  move?: Move;
  /** مشهد شاشة/نص كثيف: حركة الكاميرا المستمرة شبه صفرية كي يُقرأ */
  calm?: boolean;
  impacts?: number[];
  sfxSeed?: number;
  whoosh?: boolean;
}> = ({ children, bg, dur, move = "dolly", calm = false, impacts = [], sfxSeed = 0, whoosh = false }) => {
  const f = useCurrentFrame();
  const pIn = interpolate(f, [0, IN], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const pOut = interpolate(f, [dur - OUT, dur], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const k = 1 - pIn; // ما تبقّى من حركة الدخول

  // ── حركة الكاميرا المستمرة (يد مصوّر على رافعة: بطيئة وعضوية)
  const amp = calm ? 0.25 : 1;
  let rx = noise2D("crx", f / 110, 0) * 2.2 * amp;
  let ry = noise2D("cry", f / 130, 1) * 3.2 * amp;
  let rz = noise2D("crz", f / 150, 2) * 0.6 * amp;
  let tz = interpolate(f, [0, dur], [0, calm ? 20 : 90]); // دفع بطيء للأمام طوال اللقطة
  let tx = 0, ty = 0;

  // ── حركة الدخول
  if (move === "dolly") tz += -1500 * k;
  if (move === "orbit") { ry += 45 * k; tz += -500 * k; }
  if (move === "crane") { rx += -48 * k; ty += 380 * k; tz += -400 * k; }
  if (move === "roll") { rz += 14 * k; tz += -900 * k; }
  if (move === "push") tz += 700 * k;

  // ── الخروج: المحتوى يخترق العدسة
  tz += 1100 * pOut;
  const outOpacity = 1 - pOut;

  // ── هزّات الارتطام (عناوين ثقيلة)
  for (const at of impacts) {
    const t = f - at;
    if (t >= 0 && t < 24) {
      const e = Math.exp(-t / 4.5) * 18;
      tx += noise2D("ix", t / 1.6, at) * e;
      ty += noise2D("iy", t / 1.6, at) * e;
      rz += noise2D("ir", t / 2, at) * e * 0.05;
      tz += t < 3 ? 60 : 60 * Math.exp(-(t - 3) / 4);
    }
  }

  const blur = Math.max(0, (move === "dolly" || move === "roll" ? 10 : 5) * k * k) + 8 * pOut * pOut;

  // الخلفية بعيدة: تأخذ جزءاً صغيراً من حركة الكاميرا (اختلاف منظر) فلا تنكشف حوافها
  const P = 0.22;
  const bgT = `translate3d(${tx * P}px, ${ty * P}px, ${-700 + Math.max(-260, Math.min(260, tz * P))}px) rotateX(${rx * P * 1.5}deg) rotateY(${ry * P * 1.5}deg) rotateZ(${rz * 0.5}deg) scale(${1 + 700 / 1500 + 0.45})`;
  const fgT = `translate3d(${tx}px, ${ty}px, ${tz}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;
  return (
    <AbsoluteFill style={{ perspective: 1500, overflow: "hidden", background: "#0e2a1f" }}>
      <AbsoluteFill style={{ transformStyle: "preserve-3d" }}>
        {/* السبورة في العمق */}
        <AbsoluteFill style={{ transform: bgT }}>{bg}</AbsoluteFill>
        {/* المحتوى + الغبار: يتحرّكان مع الكاميرا كاملة */}
        <AbsoluteFill style={{ transformStyle: "preserve-3d", transform: fgT }}>
          <AbsoluteFill style={{ opacity: outOpacity * interpolate(f, [0, 5], [0, 1], clamp), filter: blur > 0.3 ? `blur(${blur}px)` : undefined }}>
            {children}
          </AbsoluteFill>
          {!calm && <Dust />}
        </AbsoluteFill>
      </AbsoluteFill>
      {whoosh && <Sfx event="transition.whoosh" at={Math.round(IN * 0.45)} seed={sfxSeed} gain={0.45} />}
    </AbsoluteFill>
  );
};
