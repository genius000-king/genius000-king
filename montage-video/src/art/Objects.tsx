import React from 'react';
import {Canvas, useIds} from './util';

export const Soup: React.FC<{t: number; bright?: boolean}> = ({t, bright}) => {
  const ids = useIds('bg', 'bowl', 'soup');
  return (
    <Canvas>
      <defs>
        <radialGradient id={ids.bg} cx=".5" cy=".55" r=".75">
          <stop offset="0" stopColor={bright ? '#FFE9C7' : '#5A524A'} />
          <stop offset="1" stopColor={bright ? '#F7C98B' : '#1E1B18'} />
        </radialGradient>
        <linearGradient id={ids.bowl} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset=".6" stopColor="#ECE6DC" />
          <stop offset="1" stopColor="#BDB4A6" />
        </linearGradient>
        <radialGradient id={ids.soup} cx=".45" cy=".4" r=".7">
          <stop offset="0" stopColor="#F3A345" />
          <stop offset="1" stopColor="#B85E1E" />
        </radialGradient>
      </defs>
      <rect width={1920} height={1080} fill={`url(#${ids.bg})`} />
      <ellipse cx={980} cy={820} rx={420} ry={60} fill="#000" opacity={0.25} />
      <path d="M 640 560 C 660 760, 800 840, 960 840 C 1120 840, 1260 760, 1280 560 Z" fill={`url(#${ids.bowl})`} />
      <ellipse cx={960} cy={560} rx={320} ry={78} fill="#FBF8F2" />
      <ellipse cx={960} cy={566} rx={286} ry={62} fill={`url(#${ids.soup})`} />
      {[
        [880, 560, '#5E8C3A'],
        [1010, 580, '#5E8C3A'],
        [960, 548, '#E8DCC0'],
        [1090, 556, '#C4442B'],
        [840, 582, '#E8DCC0'],
      ].map(([x, y, c], i) => (
        <ellipse key={i} cx={x as number} cy={y as number} rx={18} ry={8} fill={c as string} />
      ))}
      <path d="M 1160 520 L 1420 380" stroke="#C9C2B6" strokeWidth={22} strokeLinecap="round" />
      {[880, 960, 1040].map((x, i) => {
        const k = (t * 0.5 + i * 0.33) % 1;
        return (
          <path key={i} d={`M ${x} ${500 - k * 160} c 30 -40, -30 -70, 0 -110`} stroke="#fff" strokeWidth={10} fill="none" strokeLinecap="round" opacity={0.45 * Math.sin(k * Math.PI)} />
        );
      })}
    </Canvas>
  );
};

export const Coffin: React.FC<{t: number}> = () => {
  const ids = useIds('bg', 'wood');
  return (
    <Canvas>
      <defs>
        <radialGradient id={ids.bg} cx=".5" cy=".5" r=".8">
          <stop offset="0" stopColor="#4A423B" />
          <stop offset="1" stopColor="#151210" />
        </radialGradient>
        <linearGradient id={ids.wood} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8C5634" />
          <stop offset="1" stopColor="#5E351F" />
        </linearGradient>
      </defs>
      <rect width={1920} height={1080} fill={`url(#${ids.bg})`} />
      <ellipse cx={980} cy={780} rx={620} ry={70} fill="#000" opacity={0.35} />
      <path d="M 420 560 L 640 380 L 1420 400 L 1540 560 L 1420 740 L 640 740 Z" fill={`url(#${ids.wood})`} />
      <path d="M 480 560 L 670 420 L 1400 436 L 1490 560 L 1400 700 L 670 700 Z" fill="#9A6340" opacity={0.6} />
      <path d="M 520 560 L 690 450 L 1380 464 L 1450 560" stroke="#C08A5A" strokeWidth={4} fill="none" opacity={0.6} />
      {[700, 1000, 1300].map((x) => (
        <rect key={x} x={x - 40} y={734} width={80} height={16} rx={6} fill="#C9A15A" />
      ))}
      {/* flowers */}
      {Array.from({length: 14}, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return <circle key={i} cx={1000 + Math.cos(a) * 70} cy={556 + Math.sin(a) * 34} r={26} fill={i % 3 ? '#F4F1EA' : '#E9E2D2'} />;
      })}
      <circle cx={1000} cy={556} r={22} fill="#E7D9A8" />
      {[-1, 1].map((d) => (
        <path key={d} d={`M ${1000 + d * 80} 560 q ${d * 70} -10 ${d * 120} 30`} stroke="#4E6B3A" strokeWidth={14} fill="none" strokeLinecap="round" />
      ))}
    </Canvas>
  );
};

export const Camera: React.FC<{t: number}> = ({t}) => {
  const ids = useIds('bg', 'lens', 'metal');
  return (
    <Canvas>
      <defs>
        <radialGradient id={ids.bg} cx=".5" cy=".5" r=".8">
          <stop offset="0" stopColor="#F7F1E6" />
          <stop offset="1" stopColor="#DCCFBA" />
        </radialGradient>
        <radialGradient id={ids.lens} cx=".4" cy=".35" r=".7">
          <stop offset="0" stopColor="#8EA4FF" />
          <stop offset=".35" stopColor="#2A2F6B" />
          <stop offset="1" stopColor="#07080F" />
        </radialGradient>
        <linearGradient id={ids.metal} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F2F2F4" />
          <stop offset="1" stopColor="#A9ABB2" />
        </linearGradient>
      </defs>
      <rect width={1920} height={1080} fill={`url(#${ids.bg})`} />
      <ellipse cx={980} cy={880} rx={460} ry={46} fill="#000" opacity={0.18} />
      <rect x={600} y={380} width={720} height={70} rx={16} fill={`url(#${ids.metal})`} />
      <rect x={650} y={330} width={150} height={60} rx={10} fill={`url(#${ids.metal})`} />
      <rect x={1130} y={340} width={90} height={44} rx={10} fill="#2B2B2F" />
      <rect x={600} y={440} width={720} height={420} rx={30} fill="#26262A" />
      {Array.from({length: 18}, (_, i) => (
        <line key={i} x1={610} y1={460 + i * 22} x2={1310} y2={460 + i * 22} stroke="#303036" strokeWidth={6} />
      ))}
      <circle cx={960} cy={650} r={200} fill="#1A1A1E" />
      <circle cx={960} cy={650} r={168} fill={`url(#${ids.metal})`} />
      <circle cx={960} cy={650} r={138} fill="#101014" />
      <circle cx={960} cy={650} r={104} fill={`url(#${ids.lens})`} />
      <path d={`M ${905} ${600} a 70 70 0 0 1 60 -26`} stroke="#fff" strokeWidth={10} fill="none" strokeLinecap="round" opacity={0.7} />
      <circle cx={1010} cy={700} r={10} fill="#fff" opacity={0.25 + 0.2 * Math.sin(t * 2)} />
    </Canvas>
  );
};

export const FilmStrip: React.FC<{t: number}> = ({t}) => {
  const frames = ['#F2A65A', '#5B4CF5', '#FF6F59', '#2E3A70', '#FFB938'];
  return (
    <Canvas>
      <rect width={1920} height={1080} fill="#F4F1EB" />
      <g transform={`translate(960 540) rotate(-14) translate(${-1300 + ((t * 60) % 380)} -170)`}>
        <rect x={-200} y={0} width={3400} height={340} fill="#17171A" />
        {Array.from({length: 46}, (_, i) => (
          <g key={i}>
            <rect x={i * 76 - 180} y={18} width={40} height={30} rx={6} fill="#F4F1EB" />
            <rect x={i * 76 - 180} y={292} width={40} height={30} rx={6} fill="#F4F1EB" />
          </g>
        ))}
        {Array.from({length: 9}, (_, i) => (
          <rect key={i} x={i * 380 - 160} y={70} width={340} height={200} rx={6} fill={frames[i % frames.length]} opacity={0.9} />
        ))}
      </g>
    </Canvas>
  );
};
