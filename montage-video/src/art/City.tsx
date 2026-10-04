import React from 'react';
import {F} from '../fonts';
import {Canvas, rnd, useIds} from './util';

const Neon: React.FC<{x: number; y: number; text: string; color: string; size: number; on?: number; vertical?: boolean}> = ({x, y, text, color, size, on = 1, vertical}) => (
  <g transform={`translate(${x} ${y})${vertical ? ' rotate(-90)' : ''}`} opacity={0.35 + 0.65 * on}>
    <text textAnchor="middle" fontFamily={F.cairo} fontWeight={900} fontSize={size} fill="none" stroke={color} strokeWidth={size * 0.16} opacity={0.35} style={{filter: 'blur(14px)'}} direction="rtl">
      {text}
    </text>
    <text textAnchor="middle" fontFamily={F.cairo} fontWeight={900} fontSize={size} fill="none" stroke={color} strokeWidth={size * 0.045} direction="rtl">
      {text}
    </text>
    <text textAnchor="middle" fontFamily={F.cairo} fontWeight={900} fontSize={size} fill="none" stroke="#fff" strokeWidth={size * 0.012} opacity={0.8} direction="rtl">
      {text}
    </text>
  </g>
);

/** Rainy night street with Arabic neon signs. */
export const City: React.FC<{t: number; variant?: 'neon' | 'alley'}> = ({t, variant = 'neon'}) => {
  const ids = useIds('sky', 'road', 'fog');
  const c1 = variant === 'neon' ? '#FF3EA5' : '#FF6B3D';
  const c2 = variant === 'neon' ? '#2EE6FF' : '#3DFFB8';
  const c3 = '#FFD23F';
  const flick = rnd(Math.floor(t * 12)) > 0.08 ? 1 : 0.3;
  const VP = {x: 960, y: 640};
  return (
    <Canvas>
      <defs>
        <linearGradient id={ids.sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#07061A" />
          <stop offset=".7" stopColor="#2A0F3E" />
          <stop offset="1" stopColor="#4A1650" />
        </linearGradient>
        <linearGradient id={ids.road} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#150F2A" />
          <stop offset="1" stopColor="#07060F" />
        </linearGradient>
        <linearGradient id={ids.fog} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B04A9A" stopOpacity="0" />
          <stop offset="1" stopColor="#B04A9A" stopOpacity=".35" />
        </linearGradient>
      </defs>
      <rect width={1920} height={1080} fill={`url(#${ids.sky})`} />
      {/* far skyline */}
      {Array.from({length: 22}, (_, i) => {
        const w = 60 + rnd(i) * 90;
        const h = 120 + rnd(i + 50) * 260;
        const x = 380 + i * 52;
        return <rect key={i} x={x} y={VP.y - h} width={w} height={h} fill="#1C1636" />;
      })}
      <rect x={0} y={460} width={1920} height={200} fill={`url(#${ids.fog})`} />
      {/* road in perspective */}
      <path d={`M ${VP.x - 40} ${VP.y} L ${VP.x + 40} ${VP.y} L 1920 1080 L 0 1080 Z`} fill={`url(#${ids.road})`} />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const k = ((i + ((t * 0.9) % 1)) / 6) ** 2;
        const y = VP.y + k * 440;
        const w = 4 + k * 26;
        return <rect key={i} x={VP.x - w / 2} y={y} width={w} height={10 + k * 70} fill="#3A3157" opacity={0.8} />;
      })}
      {/* reflections */}
      {[
        {x: 330, c: c1},
        {x: 1600, c: c2},
        {x: 520, c: c3},
      ].map((r, i) => (
        <rect key={i} x={r.x - 50} y={VP.y + 60} width={100} height={420} fill={r.c} opacity={0.18} style={{filter: 'blur(18px)'}} />
      ))}
      {/* buildings, left */}
      <path d={`M 0 0 L 640 120 L 640 ${VP.y + 10} L 0 1080 Z`} fill="#140F2B" />
      {/* buildings, right */}
      <path d={`M 1920 0 L 1280 120 L 1280 ${VP.y + 10} L 1920 1080 Z`} fill="#120D27" />
      {/* windows on both facades */}
      {Array.from({length: 7}, (_, r) =>
        Array.from({length: 5}, (_, c) => {
          const k = c / 5;
          const lit = rnd(r * 13 + c) > 0.45;
          const xL = k * 560 + 20;
          const yTop = 40 + r * 90 + k * 60;
          const h = 46 * (1 - k * 0.45);
          const w = 70 * (1 - k * 0.5);
          return (
            <g key={`${r}-${c}`}>
              <rect x={xL} y={yTop + k * 40} width={w} height={h} fill={lit ? '#FFC970' : '#211A3E'} opacity={lit ? 0.75 : 1} />
              <rect x={1920 - xL - w} y={yTop + k * 40} width={w} height={h} fill={rnd(r * 7 + c + 99) > 0.5 ? '#9FD8FF' : '#1E183A'} opacity={0.7} />
            </g>
          );
        }),
      )}
      {/* neon signs */}
      <Neon x={330} y={560} text="مقهى" color={c1} size={110} on={flick} />
      <Neon x={1600} y={500} text="سينما" color={c2} size={100} />
      <Neon x={520} y={300} text="مفتوح" color={c3} size={64} />
      <circle cx={1450} cy={300} r={46} fill="none" stroke={c1} strokeWidth={8} opacity={0.9} />
      <circle cx={1450} cy={300} r={46} fill="none" stroke={c1} strokeWidth={22} opacity={0.25} style={{filter: 'blur(10px)'}} />
      {/* rain */}
      {Array.from({length: 70}, (_, i) => {
        const x = rnd(i + 7) * 1920;
        const y = ((rnd(i + 70) * 1080 + t * 900) % 1180) - 100;
        return <line key={i} x1={x} y1={y} x2={x - 8} y2={y + 34} stroke="#C9C2FF" strokeWidth={1.6} opacity={0.35} />;
      })}
    </Canvas>
  );
};
