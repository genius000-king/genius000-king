// كاميرا افتراضية: كل المشهد يمرّ عبرها.
//  - "يد": اهتزاز عضوي بطيء (ضجيج بيرلين، لا جيب — الجيب يبدو آلياً)
//  - "ارتطام": هزّة تخمد بسرعة عند فريمات محددة (تُربط بضربات العناوين)
//  - "دفع": تقريب بطيء مستمر (push-in) يعطي إحساس التقدّم
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { noise2D } from "@remotion/noise";

export const Camera: React.FC<{
  children: React.ReactNode;
  hand?: number;
  impacts?: number[];
  impactPower?: number;
  push?: number; // مقدار التقريب الكلّي على طول المشهد
  dur?: number;
}> = ({ children, hand = 1, impacts = [], impactPower = 18, push = 0, dur = 300 }) => {
  const f = useCurrentFrame();
  let x = noise2D("x", f / 70, 0) * 6 * hand;
  let y = noise2D("y", f / 70, 1) * 5 * hand;
  let r = noise2D("r", f / 90, 2) * 0.25 * hand;
  let s = 1 + push * Math.min(1, f / dur);
  for (const at of impacts) {
    const t = f - at;
    if (t >= 0 && t < 24) {
      const k = Math.exp(-t / 4.5) * impactPower;
      x += noise2D("ix", t / 1.6, at) * k;
      y += noise2D("iy", t / 1.6, at) * k;
      r += noise2D("ir", t / 2, at) * k * 0.04;
      s += (t < 3 ? 0.03 : 0.03 * Math.exp(-(t - 3) / 4));
    }
  }
  return (
    <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px) rotate(${r}deg) scale(${s})` }}>{children}</AbsoluteFill>
  );
};
