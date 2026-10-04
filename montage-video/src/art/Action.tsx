import React from 'react';
import {Canvas, rnd, useIds} from './util';

const BGS: Record<string, [string, string]> = {
  yellow: ['#FFD23F', '#FFE98A'],
  pink: ['#FF5FA2', '#FFA3CB'],
  cyan: ['#25C9F0', '#94E8FF'],
  purple: ['#7B61FF', '#B9A9FF'],
  orange: ['#FF7A2F', '#FFB98C'],
};

/** A jumper/skater frozen mid-air in a bold graphic frame. */
export const Jumper: React.FC<{t: number; color?: keyof typeof BGS; flip?: boolean}> = ({t, color = 'yellow', flip}) => {
  const [bg, tint] = BGS[color];
  const bob = Math.sin(t * 3) * 10;
  const ink = '#16141F';
  return (
    <Canvas>
      <rect width={1920} height={1080} fill={bg} />
      <circle cx={960} cy={500} r={360} fill={tint} />
      {Array.from({length: 7}, (_, i) => (
        <rect key={i} x={rnd(i) * 1600} y={150 + i * 120} width={180 + rnd(i + 9) * 260} height={12} rx={6} fill={ink} opacity={0.12} />
      ))}
      <ellipse cx={960} cy={930} rx={220} ry={22} fill={ink} opacity={0.15} />
      <g transform={`translate(960 ${470 + bob}) scale(${flip ? -1 : 1} 1) rotate(-8)`} stroke={ink} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx={0} cy={-210} r={46} fill={ink} stroke="none" />
        <path d="M 0 -160 L 10 -20" strokeWidth={46} />
        <path d="M 0 -130 L -120 -190 L -200 -150" strokeWidth={30} />
        <path d="M 4 -130 L 120 -170 L 190 -240" strokeWidth={30} />
        <path d="M 10 -20 L -70 40 L -10 110" strokeWidth={34} />
        <path d="M 10 -20 L 100 30 L 70 120" strokeWidth={34} />
        <g transform="translate(30 150) rotate(12)">
          <rect x={-170} y={-14} width={340} height={28} rx={14} fill={ink} stroke="none" />
          <circle cx={-110} cy={30} r={20} fill="#fff" stroke={ink} strokeWidth={8} />
          <circle cx={110} cy={30} r={20} fill="#fff" stroke={ink} strokeWidth={8} />
        </g>
      </g>
    </Canvas>
  );
};

/** Stage with sweeping light beams and a cheering crowd. */
export const Concert: React.FC<{t: number; cool?: boolean}> = ({t, cool}) => {
  const ids = useIds('beam', 'bg');
  const beam = cool ? '#4E7BFF' : '#FFB347';
  return (
    <Canvas>
      <defs>
        <linearGradient id={ids.beam} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={beam} stopOpacity=".9" />
          <stop offset="1" stopColor={beam} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={ids.bg} cx=".5" cy=".3" r=".8">
          <stop offset="0" stopColor={cool ? '#1B2350' : '#4A1E14'} />
          <stop offset="1" stopColor="#07050C" />
        </radialGradient>
      </defs>
      <rect width={1920} height={1080} fill={`url(#${ids.bg})`} />
      <rect x={0} y={90} width={1920} height={16} fill="#1A1622" />
      {Array.from({length: 9}, (_, i) => {
        const x = 160 + i * 200;
        const a = Math.sin(t * 1.3 + i * 0.9) * 22;
        return (
          <g key={i} transform={`rotate(${a} ${x} 110)`}>
            <path d={`M ${x - 14} 110 L ${x + 14} 110 L ${x + 170} 1080 L ${x - 170} 1080 Z`} fill={`url(#${ids.beam})`} opacity={0.5} />
          </g>
        );
      })}
      {Array.from({length: 9}, (_, i) => (
        <circle key={i} cx={160 + i * 200} cy={112} r={18} fill="#FFF3D6" />
      ))}
      {/* crowd */}
      {Array.from({length: 26}, (_, i) => {
        const x = i * 78 - 20 + rnd(i) * 30;
        const y = 860 + rnd(i + 5) * 60;
        const up = rnd(i + 11) > 0.45;
        const wave = Math.sin(t * 6 + i) * 10;
        return (
          <g key={i} fill="#05030A" stroke="#05030A">
            {up && <path d={`M ${x + 10} ${y + 30} L ${x + 30 + wave} ${y - 120}`} strokeWidth={22} strokeLinecap="round" />}
            <circle cx={x} cy={y} r={40} />
            <rect x={x - 70} y={y + 30} width={140} height={260} rx={60} />
          </g>
        );
      })}
    </Canvas>
  );
};
