// 01 — Swiss / Bauhaus poster. e^{iπ} + 1 = 0 built term by term while a point walks half the unit circle.
import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {F} from '../fonts';

const CREAM = '#EEE8DA';
const INK = '#111111';
const RED = '#E4301B';

const CX = 1380;
const CY = 560;
const R = 300;

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const Term: React.FC<{at: number; children: React.ReactNode; color?: string; style?: React.CSSProperties}> = ({
  at,
  children,
  color = INK,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - at, fps, config: {damping: 14, mass: 0.6}});
  return (
    <span
      style={{
        display: 'inline-block',
        color,
        opacity: s,
        transform: `translateY(${(1 - s) * 120}px) rotate(${(1 - s) * -8}deg)`,
        ...style,
      }}
    >
      {children}
    </span>
  );
};

export const Euler: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const theta = interpolate(frame, [120, 300], [0, Math.PI], {
    ...clamp,
    easing: Easing.bezier(0.65, 0, 0.35, 1),
  });
  const px = CX + R * Math.cos(theta);
  const py = CY - R * Math.sin(theta);

  const grid = (i: number) => interpolate(frame, [i * 4, i * 4 + 30], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const circle = interpolate(frame, [20, 80], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const arcLen = R * theta;
  const hit = spring({frame: frame - 300, fps, config: {damping: 8}});
  const finale = interpolate(frame, [330, 360], [0, 1], clamp);
  const wipe = interpolate(frame, [395, 430], [0, 1], {...clamp, easing: Easing.inOut(Easing.quad)});

  return (
    <AbsoluteFill style={{background: CREAM, fontFamily: F.inter, overflow: 'hidden'}}>
      {/* Swiss grid */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={`v${i}`}
          style={{position: 'absolute', left: 120 + i * 336, top: 0, width: 1, height: 1080 * grid(i), background: 'rgba(0,0,0,0.12)'}}
        />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <div
          key={`h${i}`}
          style={{position: 'absolute', top: 120 + i * 280, left: 0, height: 1, width: 1920 * grid(i + 2), background: 'rgba(0,0,0,0.12)'}}
        />
      ))}

      {/* Header strip */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 120,
          right: 120,
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 26,
          fontWeight: 500,
          letterSpacing: 4,
          color: INK,
          opacity: interpolate(frame, [10, 40], [0, 1], clamp),
        }}
      >
        <span>01 — EULER, 1748</span>
        <span>FIVE CONSTANTS / ONE LINE</span>
        <span>ℂ</span>
      </div>

      {/* Big red block */}
      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 820,
          width: 672 * interpolate(frame, [30, 70], [0, 1], {...clamp, easing: Easing.out(Easing.exp)}),
          height: 140,
          background: RED,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 850,
          fontFamily: F.cairo,
          fontWeight: 900,
          fontSize: 52,
          color: CREAM,
          direction: 'rtl',
          whiteSpace: 'nowrap',
          width: 610,
          textAlign: 'right',
          opacity: interpolate(frame, [60, 80], [0, 1], clamp),
        }}
      >
        خمسة ثوابت. سطر واحد.
      </div>

      {/* Equation */}
      <div
        style={{
          position: 'absolute',
          left: 110,
          top: 300,
          fontFamily: F.archivo,
          fontSize: 200,
          lineHeight: 1,
          color: INK,
          letterSpacing: -8,
          whiteSpace: 'nowrap',
        }}
      >
        <Term at={60}>e</Term>
        <Term at={100} color={RED} style={{fontSize: 104, verticalAlign: 'top', marginTop: -16}}>
          iπ
        </Term>
        <Term at={310} style={{marginLeft: 30}}>+1</Term>
        <Term at={325} color={RED} style={{marginLeft: 30}}>=0</Term>
      </div>

      {/* Constants legend */}
      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 610,
          display: 'flex',
          gap: 40,
          fontSize: 28,
          fontWeight: 500,
          color: INK,
        }}
      >
        {['e  growth', 'i  rotation', 'π  circle', '1  unity', '0  nothing'].map((t, i) => {
          const o = interpolate(frame, [150 + i * 18, 170 + i * 18], [0, 1], clamp);
          return (
            <span key={t} style={{opacity: o, transform: `translateX(${(1 - o) * -20}px)`}}>
              {t}
            </span>
          );
        })}
      </div>

      {/* Unit circle */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        <line x1={CX - R - 80} y1={CY} x2={CX + R + 80} y2={CY} stroke={INK} strokeWidth={2} opacity={circle} />
        <line x1={CX} y1={CY - R - 80} x2={CX} y2={CY + R + 80} stroke={INK} strokeWidth={2} opacity={circle} />
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke={INK}
          strokeWidth={4}
          strokeDasharray={2 * Math.PI * R}
          strokeDashoffset={2 * Math.PI * R * (1 - circle)}
          transform={`rotate(180 ${CX} ${CY})`}
        />
        {/* traveled arc */}
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke={RED}
          strokeWidth={22}
          strokeDasharray={`${arcLen} ${2 * Math.PI * R}`}
          transform={`scale(1,-1) translate(0 ${-2 * CY})`}
        />
        {/* projections */}
        <line x1={px} y1={py} x2={px} y2={CY} stroke={INK} strokeWidth={2} strokeDasharray="8 8" opacity={theta > 0.01 && theta < 3.13 ? 1 : 0} />
        <line x1={CX} y1={CY} x2={px} y2={py} stroke={INK} strokeWidth={5} opacity={circle} />
        <circle cx={px} cy={py} r={20 + hit * 14 * (1 - finale * 0.5)} fill={RED} opacity={circle} />
        {frame > 300 && (
          <circle cx={px} cy={py} r={30 + (frame - 300) * 9} fill="none" stroke={RED} strokeWidth={3} opacity={Math.max(0, 1 - (frame - 300) / 40)} />
        )}
        <text x={CX + R + 24} y={CY - 18} fontFamily={F.inter} fontWeight={800} fontSize={34} fill={INK} opacity={circle}>
          1
        </text>
        <text x={CX - R - 70} y={CY - 18} fontFamily={F.inter} fontWeight={800} fontSize={34} fill={RED} opacity={hit}>
          −1
        </text>
        <text x={CX + 20} y={CY + R + 70} fontFamily={F.mono} fontSize={28} fill={INK} opacity={circle}>
          θ = {(theta / Math.PI).toFixed(3)}π
        </text>
      </svg>

      {/* Final statement */}
      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 700,
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: 6,
          color: INK,
          opacity: finale,
          transform: `translateY(${(1 - finale) * 20}px)`,
        }}
      >
        ROTATE BY π. LAND ON −1.
      </div>

      {/* Outro wipe */}
      <div style={{position: 'absolute', inset: 0, background: RED, transform: `translateX(${(1 - wipe) * 100}%)`}} />
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          fontFamily: F.archivo,
          fontSize: 190,
          color: CREAM,
          opacity: interpolate(frame, [420, 432], [0, 1], clamp),
          letterSpacing: -4,
        }}
      >
        <div style={{whiteSpace: 'nowrap'}}>
          e<sup style={{fontSize: 100}}>iπ</sup>+1=0
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
