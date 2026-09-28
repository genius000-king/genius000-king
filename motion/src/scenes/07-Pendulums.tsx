// 07 — Soft Scandinavian pastel. A 15-pendulum wave, seen from above. It realigns exactly at t = 20 s.
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {F} from '../fonts';

const N = 15;
const PERIOD = 20; // seconds for the whole pattern to realign
const BASE = 16; // pendulum 0 swings 16 times in 20 s, pendulum n swings 16 + n times
const CX = 1100;
const AMP = 470;
const TOP = 150;
const GAP = 56;
const INK = '#2b2a33';

const color = (i: number) => `hsl(${(350 + i * 17) % 360}, 72%, 66%)`;

const posX = (i: number, t: number) => CX + AMP * Math.cos((2 * Math.PI * (BASE + i) * t) / PERIOD);

// Catmull-Rom → cubic Bézier through the bobs.
const smooth = (pts: [number, number][]) => {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
};

export const Pendulums: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const t = frame / fps;
  const intro = interpolate(frame, [0, 20], [0, 1], {extrapolateRight: 'clamp'});
  const aligned = interpolate(frame, [durationInFrames - 20, durationInFrames - 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const pts = Array.from({length: N}, (_, i) => [posX(i, t), TOP + i * GAP] as [number, number]);

  return (
    <AbsoluteFill style={{background: '#F4F0E8', opacity: intro}}>
      {/* paper grain via subtle dots */}
      <AbsoluteFill style={{backgroundImage: 'radial-gradient(rgba(43,42,51,0.06) 1px, transparent 1px)', backgroundSize: '22px 22px'}} />

      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        <line x1={CX} y1={TOP - 50} x2={CX} y2={TOP + (N - 1) * GAP + 50} stroke={INK} strokeOpacity={0.15} strokeDasharray="4 8" />
        {pts.map(([, y], i) => (
          <g key={`track${i}`}>
            <line x1={CX - AMP} y1={y} x2={CX + AMP} y2={y} stroke={INK} strokeOpacity={0.07} strokeWidth={2} />
            <circle cx={CX} cy={y} r={3} fill={INK} opacity={0.3} />
          </g>
        ))}
        <path d={smooth(pts)} fill="none" stroke={INK} strokeWidth={2} strokeOpacity={0.35} />
        {pts.map(([x, y], i) => (
          <g key={i}>
            {[6, 4, 2].map((lag) => (
              <circle key={lag} cx={posX(i, t - lag / fps)} cy={y} r={20} fill={color(i)} opacity={0.12 * (7 - lag) / 6} />
            ))}
            <line x1={CX} y1={y} x2={x} y2={y} stroke={color(i)} strokeWidth={3} strokeOpacity={0.5} />
            <circle cx={x} cy={y} r={21} fill={color(i)} />
            <circle cx={x - 6} cy={y - 6} r={6} fill="#fff" opacity={0.55} />
          </g>
        ))}
      </svg>

      <div style={{position: 'absolute', left: 110, top: 150, width: 400, color: INK}}>
        <div style={{fontFamily: F.grotesk, fontSize: 20, letterSpacing: 5, opacity: 0.6}}>07 — PENDULUM WAVE</div>
        <div style={{fontFamily: F.cormorant, fontWeight: 500, fontSize: 76, lineHeight: 1.02, marginTop: 30}}>
          Fifteen
          <br />
          rhythms.
          <br />
          <span style={{fontFamily: F.cormorantItalic, fontWeight: 300, fontStyle: 'italic'}}>One law.</span>
        </div>
        <div style={{fontFamily: F.amiri, fontWeight: 700, fontSize: 40, marginTop: 30, direction: 'rtl', textAlign: 'right', opacity: 0.8}}>
          قانونٌ واحد، خمسة عشر إيقاعاً
        </div>
      </div>

      <div style={{position: 'absolute', left: 110, bottom: 130, fontFamily: F.mono, fontSize: 24, color: INK, lineHeight: 1.8}}>
        <div style={{opacity: 0.6}}>T = 2π √(L / g)</div>
        <div style={{opacity: 0.6}}>ωₙ = 2π(16 + n) / 20</div>
        <div style={{fontSize: 44, marginTop: 10}}>t = {t.toFixed(2)} s</div>
        <div style={{fontFamily: F.grotesk, fontWeight: 700, fontSize: 26, color: color(0), opacity: aligned, marginTop: 6}}>
          realigned. ✓
        </div>
      </div>
    </AbsoluteFill>
  );
};
