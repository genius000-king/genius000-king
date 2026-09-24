// طبقة "الفيلم": حبيبات متحرّكة + فينيت + تشوّه لوني خفيف على الأطراف.
// هذه الطبقة وحدها تنقل الصورة من "رسوم كمبيوتر" إلى "لقطة".
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.09 }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity, mixBlendMode: "overlay" }}>
      <svg width="100%" height="100%">
        <filter id={`g${f % 6}`}>
          {/* seed يتغيّر كل فريمين = حبيبات حيّة كفيلم 24fps */}
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={Math.floor(f / 2) % 97} />
        </filter>
        <rect width="100%" height="100%" filter={`url(#g${f % 6})`} />
      </svg>
    </AbsoluteFill>
  );
};

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.35 }) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background: `radial-gradient(ellipse at center, transparent 58%, rgba(0,0,0,${strength}) 100%)`,
    }}
  />
);
