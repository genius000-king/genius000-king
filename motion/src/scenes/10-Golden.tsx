// 10 — Black & gold luxury. Sunflower phyllotaxis: nudge the golden angle by a fraction of a degree and order breaks.
import React, {useEffect, useRef} from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {F} from '../fonts';

const GOLDEN = 180 * (3 - Math.sqrt(5)); // 137.5077…°
const MAX = 1600;
const CX = 1300;
const CY = 540;
const C = 11.6;
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export const Golden: React.FC = () => {
  const frame = useCurrentFrame();
  const canvas = useRef<HTMLCanvasElement>(null);

  const count = Math.floor(interpolate(frame, [10, 190], [0, MAX], {...clamp, easing: Easing.out(Easing.quad)}));
  const angle = interpolate(frame, [200, 245, 290, 335], [GOLDEN, 135.5, 139.5, GOLDEN], {
    ...clamp,
    easing: Easing.inOut(Easing.sin),
  });
  const spin = frame * 0.0025;
  const arms = interpolate(frame, [345, 375], [0, 1], clamp);
  const off = Math.abs(angle - GOLDEN);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 1920, 1080);
    const rad = (angle * Math.PI) / 180;
    for (let n = 0; n < count; n++) {
      const r = C * Math.sqrt(n);
      const th = n * rad + spin;
      const x = CX + r * Math.cos(th);
      const y = CY + r * Math.sin(th);
      const k = n / MAX;
      const born = Math.min(1, (count - n) / 40);
      const size = (2.2 + k * 5.5) * born;
      const onArm = n % 34 === 0 || n % 21 === 0;
      const light = 78 - k * 30;
      ctx.fillStyle = onArm && arms > 0 ? `hsla(44, 100%, ${light + 20 * arms}%, 1)` : `hsla(${42 - k * 8}, ${70 - k * 20}%, ${light}%, ${0.95 - arms * (onArm ? 0 : 0.55)})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [angle, count, spin, arms]);

  const intro = interpolate(frame, [0, 20], [0, 1], clamp);
  const outro = interpolate(frame, [425, 450], [1, 0], clamp);
  const warn = interpolate(off, [0.05, 0.4], [0, 1], clamp);
  const final = interpolate(frame, [350, 380], [0, 1], clamp);

  return (
    <AbsoluteFill style={{background: 'radial-gradient(circle at 68% 50%, #1a140a 0%, #050403 60%)', opacity: intro * outro}}>
      <canvas ref={canvas} width={1920} height={1080} style={{position: 'absolute'}} />
      {/* thin frame */}
      <div style={{position: 'absolute', inset: 50, border: '1px solid rgba(214,178,94,0.35)'}} />

      <div style={{position: 'absolute', left: 130, top: 140, color: '#d6b25e'}}>
        <div style={{fontFamily: F.grotesk, fontSize: 18, letterSpacing: 8, opacity: 0.8}}>10 — PHYLLOTAXIS</div>
        <div style={{fontFamily: F.cormorant, fontWeight: 300, fontSize: 190, lineHeight: 1, marginTop: 40, color: warn > 0.5 ? '#c4553f' : '#f3dfa2'}}>
          {angle.toFixed(3)}°
        </div>
        <div style={{fontFamily: F.cormorantItalic, fontStyle: 'italic', fontWeight: 300, fontSize: 52, marginTop: 10, color: '#f3dfa2'}}>
          {warn > 0.5 ? 'slightly off — and gaps appear.' : 'the golden angle.'}
        </div>
      </div>

      <div style={{position: 'absolute', left: 130, bottom: 140, color: '#d6b25e', opacity: final}}>
        <div style={{fontFamily: F.cormorant, fontWeight: 500, fontSize: 40, letterSpacing: 2, color: '#f3dfa2'}}>
          360° · (1 − 1/φ) &nbsp;·&nbsp; spirals of 21 & 34
        </div>
        <div style={{fontFamily: F.amiri, fontWeight: 700, fontSize: 54, marginTop: 16, direction: 'rtl', textAlign: 'right', width: 620}}>
          الطبيعة لا تُخمِّن… إنها تحسب.
        </div>
      </div>

      <div style={{position: 'absolute', right: 90, top: 80, fontFamily: F.grotesk, fontSize: 18, letterSpacing: 6, color: '#d6b25e', opacity: 0.7}}>
        n = {String(count).padStart(4, '0')}
      </div>
    </AbsoluteFill>
  );
};
