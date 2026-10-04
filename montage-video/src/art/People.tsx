import React from 'react';
import {Canvas, useIds} from './util';

/** Flat portrait. 'neutral' = Kuleshov's expressionless face; 'speaker' = interview with a mic. */
export const Person: React.FC<{t: number; variant?: 'neutral' | 'speaker'}> = ({t, variant = 'neutral'}) => {
  const ids = useIds('bg', 'skin');
  const speaker = variant === 'speaker';
  const skin = speaker ? '#C98E6A' : '#E3B593';
  const skinS = speaker ? '#AE7553' : '#C99674';
  const hair = '#2A1E19';
  const shirt = speaker ? '#5B4CF5' : '#3F4A60';
  // blink every ~3.6s
  const blinkPhase = (t + 0.7) % 3.6;
  const eyeOpen = blinkPhase < 0.12 ? 0.12 : 1;
  const mouth = speaker ? 5 + Math.abs(Math.sin(t * 9.5)) * 18 * (Math.sin(t * 2.3) > -0.6 ? 1 : 0.2) : 0;
  const nod = speaker ? Math.sin(t * 1.7) * 6 : 0;
  return (
    <Canvas>
      <defs>
        <radialGradient id={ids.bg} cx=".5" cy=".42" r=".8">
          <stop offset="0" stopColor={speaker ? '#F3E6D6' : '#E4E1DB'} />
          <stop offset="1" stopColor={speaker ? '#D3BFA8' : '#B8B4AC'} />
        </radialGradient>
        <linearGradient id={ids.skin} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={skin} />
          <stop offset=".7" stopColor={skin} />
          <stop offset="1" stopColor={skinS} />
        </linearGradient>
      </defs>
      <rect width={1920} height={1080} fill={`url(#${ids.bg})`} />
      {speaker && (
        <g opacity={0.5}>
          <circle cx={300} cy={260} r={90} fill="#FFFFFF" opacity={0.5} />
          <circle cx={1620} cy={340} r={130} fill="#FFE2B8" opacity={0.6} />
          <rect x={1460} y={520} width={300} height={560} rx={20} fill="#C6AF93" />
          <rect x={160} y={600} width={240} height={480} rx={20} fill="#BFA78A" />
        </g>
      )}
      {/* shoulders */}
      <path d="M 520 1080 C 540 900, 660 820, 860 790 L 1060 790 C 1260 820, 1380 900, 1400 1080 Z" fill={shirt} />
      <path d="M 870 790 L 960 900 L 1050 790 Z" fill={skinS} />
      <g transform={`rotate(${nod * 0.3} 960 760)`}>
        <rect x={895} y={640} width={130} height={170} rx={40} fill={skinS} />
        {/* ears */}
        <ellipse cx={812} cy={520} rx={26} ry={44} fill={skinS} />
        <ellipse cx={1108} cy={520} rx={26} ry={44} fill={skinS} />
        {/* head */}
        <ellipse cx={960} cy={500} rx={150} ry={188} fill={`url(#${ids.skin})`} />
        {/* hair */}
        <path d={speaker ? 'M 800 520 C 760 340, 880 270, 980 280 C 1100 290, 1160 360, 1120 520 C 1110 430, 1060 380, 960 390 C 870 395, 820 440, 800 520 Z' : 'M 806 470 C 800 330, 900 290, 970 292 C 1070 296, 1130 350, 1114 470 C 1090 410, 1040 372, 960 372 C 880 372, 830 410, 806 470 Z'} fill={hair} />
        {/* brows */}
        <rect x={868} y={448} width={72} height={13} rx={6} fill={hair} transform={speaker ? `rotate(${-4 - Math.sin(t * 3) * 3} 904 454)` : undefined} />
        <rect x={980} y={448} width={72} height={13} rx={6} fill={hair} transform={speaker ? `rotate(${4 + Math.sin(t * 3) * 3} 1016 454)` : undefined} />
        {/* eyes */}
        <ellipse cx={904} cy={500} rx={15} ry={10 * eyeOpen} fill={hair} />
        <ellipse cx={1016} cy={500} rx={15} ry={10 * eyeOpen} fill={hair} />
        <circle cx={909} cy={497} r={3} fill="#fff" opacity={eyeOpen} />
        <circle cx={1021} cy={497} r={3} fill="#fff" opacity={eyeOpen} />
        {/* nose */}
        <path d="M 962 515 C 958 545, 950 560, 944 570 C 956 578, 972 578, 980 572" stroke={skinS} strokeWidth={6} fill="none" strokeLinecap="round" />
        {/* mouth */}
        {speaker ? (
          <ellipse cx={960} cy={618} rx={34} ry={mouth / 2 + 3} fill="#6E2E2A" />
        ) : (
          <path d="M 922 616 L 998 616" stroke="#9A5A4B" strokeWidth={7} strokeLinecap="round" />
        )}
      </g>
      {speaker && (
        <g>
          <rect x={950} y={860} width={20} height={240} fill="#1E1E22" />
          <rect x={918} y={760} width={84} height={130} rx={42} fill="#2A2A30" />
          {Array.from({length: 6}, (_, i) => (
            <line key={i} x1={926} y1={780 + i * 16} x2={994} y2={780 + i * 16} stroke="#4A4A52" strokeWidth={3} />
          ))}
        </g>
      )}
    </Canvas>
  );
};
