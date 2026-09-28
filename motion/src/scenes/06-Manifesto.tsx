// 06 — Arabic brutalist kinetic typography. Hard cuts, slams, shake. Yellow/black.
import React from 'react';
import {AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {F} from '../fonts';

const Y = '#FFE500';
const K = '#0A0A0A';

type Beat = {word: string; from: number; dur: number; inverted: boolean; size: number; sub?: string};

const BEATS: Beat[] = [
  {word: 'لا', from: 0, dur: 14, inverted: false, size: 620},
  {word: 'تكن', from: 14, dur: 14, inverted: false, size: 560},
  {word: 'مستهلكاً', from: 28, dur: 26, inverted: false, size: 400, sub: 'CONSUMER'},
  {word: 'للمعرفة', from: 54, dur: 26, inverted: false, size: 400, sub: 'OF KNOWLEDGE'},
  {word: 'كُن', from: 80, dur: 22, inverted: true, size: 720},
  {word: 'صانعاً', from: 102, dur: 30, inverted: true, size: 520, sub: 'BUILDER'},
  {word: 'للأنظمة', from: 132, dur: 40, inverted: true, size: 460, sub: 'OF SYSTEMS'},
];

const Stripes: React.FC<{color: string; offset: number}> = ({color, offset}) => (
  <AbsoluteFill
    style={{
      background: `repeating-linear-gradient(-45deg, ${color} 0 40px, transparent 40px 80px)`,
      backgroundPosition: `${offset}px 0`,
      opacity: 0.08,
    }}
  />
);

export const Manifesto: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const beat = BEATS.find((b) => frame >= b.from && frame < b.from + b.dur);
  const idx = beat ? BEATS.indexOf(beat) : -1;

  if (beat) {
    const local = frame - beat.from;
    const bg = beat.inverted ? K : Y;
    const fg = beat.inverted ? Y : K;
    const slam = spring({frame: local, fps, config: {damping: 9, stiffness: 260, mass: 0.5}});
    const scale = interpolate(slam, [0, 1], [2.4, 1]) + local * 0.004;
    const shake = local < 6 ? 1 - local / 6 : 0;
    const sx = (random(`sx${frame}`) - 0.5) * 40 * shake;
    const sy = (random(`sy${frame}`) - 0.5) * 40 * shake;
    const flash = local < 2 && beat.inverted && idx === 4;

    return (
      <AbsoluteFill style={{background: flash ? '#fff' : bg, overflow: 'hidden'}}>
        <Stripes color={fg} offset={frame * 3} />
        {/* counter + tags */}
        <div style={{position: 'absolute', top: 50, left: 60, fontFamily: F.archivo, fontSize: 40, color: fg}}>
          {String(idx + 1).padStart(2, '0')}/{String(BEATS.length).padStart(2, '0')}
        </div>
        <div style={{position: 'absolute', top: 50, right: 60, fontFamily: F.archivo, fontSize: 40, color: fg}}>
          MANIFESTO — 06
        </div>
        <div style={{position: 'absolute', left: 60, right: 60, bottom: 60, height: 16, background: fg, transformOrigin: 'left', transform: `scaleX(${frame / 172})`}} />

        <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', transform: `translate(${sx}px, ${sy}px)`}}>
          <div
            style={{
              fontFamily: F.lalezar,
              fontSize: beat.size,
              lineHeight: 1,
              color: fg,
              transform: `scale(${scale})`,
              direction: 'rtl',
              whiteSpace: 'nowrap',
              marginTop: 60,
            }}
          >
            {beat.word}
          </div>
        </AbsoluteFill>

        {beat.sub && (
          <div
            style={{
              position: 'absolute',
              bottom: 110,
              left: 0,
              right: 0,
              textAlign: 'center',
              fontFamily: F.archivo,
              fontSize: 56,
              letterSpacing: 18,
              color: bg,
              opacity: interpolate(local, [3, 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
            }}
          >
            <span style={{background: fg, padding: '6px 26px'}}>{beat.sub}</span>
          </div>
        )}
      </AbsoluteFill>
    );
  }

  // End card
  const local = frame - 172;
  const a = spring({frame: local, fps, config: {damping: 14}});
  const b = spring({frame: local - 10, fps, config: {damping: 14}});
  const arrow = interpolate(local, [14, 30], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{background: Y, justifyContent: 'center', alignItems: 'center', overflow: 'hidden'}}>
      <Stripes color={K} offset={frame * 3} />
      <div style={{display: 'flex', alignItems: 'center', gap: 40, fontFamily: F.archivo, fontSize: 116, color: K}}>
        <span style={{transform: `translateX(${(1 - a) * -600}px)`, textDecoration: 'line-through', textDecorationThickness: 18, opacity: 0.35}}>
          CONSUMER
        </span>
        <span style={{transform: `scaleX(${arrow})`, display: 'inline-block'}}>→</span>
        <span style={{transform: `translateX(${(1 - b) * 600}px)`, background: K, color: Y, padding: '0 30px'}}>CREATOR</span>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 150,
          fontFamily: F.lalezar,
          fontSize: 90,
          color: K,
          direction: 'rtl',
          opacity: interpolate(local, [30, 45], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
        }}
      >
        من مستهلك إلى صانع
      </div>
    </AbsoluteFill>
  );
};
