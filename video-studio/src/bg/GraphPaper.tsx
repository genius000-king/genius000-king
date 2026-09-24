// ورق المربّعات — امتداد لهوية صورة "الموائع": دفتر مهندس، لا خلفية رقمية مسطّحة.
// تفاصيل تصنع الواقعية: خطّ رئيسي كل 5 مربّعات، ألياف ورق (ضوضاء)، إضاءة غير متساوية،
// وانجراف بطيء جداً للكاميرا فوق الورق كي لا يبدو "صورة ثابتة".
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

export const GraphPaper: React.FC<{ cell?: number; drift?: number; tint?: string; ink?: string }> = ({
  cell = 46,
  drift = 0.25,
  tint = "#e9ebe4",
  ink = "rgba(60,90,110,",
}) => {
  const f = useCurrentFrame();
  const ox = (f * drift) % (cell * 5);
  const oy = (f * drift * 0.4) % (cell * 5);
  const minor = `${ink}0.16)`;
  const major = `${ink}0.28)`;
  return (
    <AbsoluteFill style={{ background: tint, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute", left: -cell * 5, top: -cell * 5, width: `calc(100% + ${cell * 10}px)`, height: `calc(100% + ${cell * 10}px)`,
          backgroundImage: `
            linear-gradient(${major} 1.4px, transparent 1.4px),
            linear-gradient(90deg, ${major} 1.4px, transparent 1.4px),
            linear-gradient(${minor} 1px, transparent 1px),
            linear-gradient(90deg, ${minor} 1px, transparent 1px)`,
          backgroundSize: `${cell * 5}px ${cell * 5}px, ${cell * 5}px ${cell * 5}px, ${cell}px ${cell}px, ${cell}px ${cell}px`,
          transform: `translate(${ox}px, ${oy}px)`,
        }}
      />
      {/* ألياف الورق */}
      <AbsoluteFill style={{ opacity: 0.35, mixBlendMode: "multiply" }}>
        <svg width="100%" height="100%">
          <filter id="paper">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="3" />
            <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.43  0 0 0 0 0.38  0 0 0 0.55 0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#paper)" />
        </svg>
      </AbsoluteFill>
      {/* ضوء نافذة غير متساوٍ + ظلّ الزوايا */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 38% 32%, rgba(255,255,250,0.22), transparent 70%), radial-gradient(ellipse at center, transparent 62%, rgba(40,40,30,0.16) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/** خلفية داكنة سينمائية للمقاطع التقنية: تدرّج + شبكة نقاط خافتة + ضوء متحرّك */
export const DarkStage: React.FC<{ accent?: string }> = ({ accent = "#ff2d2d" }) => {
  const f = useCurrentFrame();
  const x = 50 + Math.sin(f / 90) * 18;
  const y = 40 + Math.cos(f / 120) * 10;
  return (
    <AbsoluteFill style={{ background: "#07080b" }}>
      <AbsoluteFill
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.09) 1.2px, transparent 1.2px)",
          backgroundSize: "34px 34px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${x}% ${y}%, ${accent}33, transparent 45%)` }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.75) 100%)" }} />
    </AbsoluteFill>
  );
};
