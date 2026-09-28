// 08 — 1986 synthwave / VHS. Infinite neon grid, striped sun, chrome title.
import React from 'react';
import {AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {F} from '../fonts';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const Mountains: React.FC<{color: string; seed: string; amp: number; y: number; opacity: number}> = ({color, seed, amp, y, opacity}) => {
  const pts: string[] = [];
  for (let i = 0; i <= 24; i++) {
    const x = (i / 24) * 1920;
    const center = Math.abs(i - 12) / 12; // lower in the middle, where the sun is
    const h = amp * (0.25 + random(`${seed}${i}`) * 0.75) * (0.3 + center);
    pts.push(`${x},${y - h}`);
  }
  return <polygon points={`0,${y} ${pts.join(' ')} 1920,${y}`} fill={color} opacity={opacity} />;
};

export const Synthwave: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const HORIZON = 640;

  const sunRise = interpolate(frame, [0, 70], [260, 0], {...clamp, easing: (x) => 1 - Math.pow(1 - x, 3)});
  const title = spring({frame: frame - 60, fps, config: {damping: 11, mass: 0.8}});
  const sub = interpolate(frame, [110, 125], [0, 1], clamp);
  const sheen = interpolate(frame, [80, 150], [-60, 160], clamp);
  const outro = interpolate(frame, [335, 360], [1, 0], clamp);
  const tracking = frame < 8 || (frame > 200 && frame < 205);
  const seconds = Math.floor(frame / 30);

  return (
    <AbsoluteFill style={{background: 'linear-gradient(#0b0120 0%, #2a0a4a 35%, #7a1a6e 50%, #ff4f8b 59.2%, #120016 59.3%)', overflow: 'hidden', opacity: outro}}>
      {/* stars */}
      <svg width={1920} height={HORIZON} style={{position: 'absolute'}}>
        {Array.from({length: 90}).map((_, i) => (
          <circle
            key={i}
            cx={random(`sx${i}`) * 1920}
            cy={random(`sy${i}`) * 380}
            r={random(`sr${i}`) * 1.8 + 0.4}
            fill="#fff"
            opacity={0.3 + 0.7 * Math.abs(Math.sin(frame / 12 + i))}
          />
        ))}
      </svg>

      {/* sun */}
      <div
        style={{
          position: 'absolute',
          left: 960 - 280,
          top: HORIZON - 470 + sunRise,
          width: 560,
          height: 560,
          borderRadius: '50%',
          background: 'linear-gradient(#ffe45e 0%, #ff9a3c 45%, #ff2d95 90%)',
          boxShadow: '0 0 120px 30px rgba(255,60,150,0.45)',
          WebkitMaskImage:
            'linear-gradient(to bottom, #000 0 52%, transparent 52% 55%, #000 55% 62%, transparent 62% 66%, #000 66% 72%, transparent 72% 77%, #000 77% 82%, transparent 82% 88%, #000 88% 92%, transparent 92%)',
        }}
      />

      <svg width={1920} height={HORIZON} style={{position: 'absolute'}}>
        <Mountains color="#3b0f5e" seed="far" amp={200} y={HORIZON} opacity={0.9} />
        <Mountains color="#1a0530" seed="near" amp={120} y={HORIZON} opacity={1} />
      </svg>

      {/* grid floor: hand-projected perspective (screen y = horizon + f·h / z) */}
      <svg width={1920} height={1080} style={{position: 'absolute', filter: 'drop-shadow(0 0 6px #ff2df1)'}}>
        {Array.from({length: 26}).map((_, k) => {
          const z = 1 + k - ((frame * 0.08) % 1);
          const y = HORIZON + 900 / z;
          if (y > 1080 || z <= 0) return null;
          return <line key={`h${k}`} x1={0} x2={1920} y1={y} y2={y} stroke="#ff2df1" strokeWidth={Math.max(1, 4 / Math.sqrt(z))} opacity={Math.min(1, 3 / z)} />;
        })}
        {Array.from({length: 41}).map((_, i) => {
          const xw = (i - 20) * 1.1;
          const zNear = 0.7;
          return <line key={`v${i}`} x1={960} y1={HORIZON} x2={960 + (xw * 900) / zNear} y2={HORIZON + 900 / zNear} stroke="#ff2df1" strokeWidth={2.5} />;
        })}
      </svg>
      <div style={{position: 'absolute', top: HORIZON, left: 0, right: 0, height: 200, background: 'linear-gradient(#120016 0%, transparent 100%)'}} />
      <div style={{position: 'absolute', top: HORIZON - 2, left: 0, right: 0, height: 4, background: '#ff9ef5', boxShadow: '0 0 30px 8px #ff2df1'}} />

      {/* chrome title */}
      <AbsoluteFill style={{alignItems: 'center', top: 150}}>
        <div style={{transform: `scale(${title}) skewX(-8deg)`, position: 'relative'}}>
          <div
            style={{
              fontFamily: F.orbitron,
              fontWeight: 900,
              fontSize: 230,
              letterSpacing: 10,
              background: `linear-gradient(180deg, #e8f7ff 0%, #8ad4ff 40%, #1a2a6c 50%, #ffffff 52%, #ff7ad9 100%)`,
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              WebkitTextStroke: '3px rgba(255,255,255,0.8)',
              filter: 'drop-shadow(0 8px 0 #2a0a4a) drop-shadow(0 0 30px rgba(255,100,220,0.6))',
            }}
          >
            GENIUS
          </div>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(100deg, transparent ${sheen - 10}%, rgba(255,255,255,0.8) ${sheen}%, transparent ${sheen + 10}%)`,
              mixBlendMode: 'overlay',
            }}
          />
        </div>
        <div
          style={{
            fontFamily: F.script,
            fontSize: 150,
            color: '#fff',
            marginTop: -90,
            transform: `rotate(-6deg) scale(${0.8 + sub * 0.2})`,
            opacity: sub,
            textShadow: '0 0 10px #ff2df1, 0 0 30px #ff2df1, 0 0 60px #ff2df1',
          }}
        >
          build · break · rebuild
        </div>
      </AbsoluteFill>

      {/* VHS overlay */}
      <AbsoluteFill style={{background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 2px, transparent 2px 4px)'}} />
      {tracking && <AbsoluteFill style={{background: 'rgba(255,255,255,0.12)', transform: `translateX(${random(frame) * 40 - 20}px)`}} />}
      <div style={{position: 'absolute', top: 50, left: 70, fontFamily: F.vt, fontSize: 56, color: '#fff', textShadow: '2px 0 #f0f, -2px 0 #0ff'}}>
        PLAY ▶
      </div>
      <div style={{position: 'absolute', bottom: 50, right: 70, fontFamily: F.vt, fontSize: 56, color: '#fff', textShadow: '2px 0 #f0f, -2px 0 #0ff'}}>
        SEP.28 1986 &nbsp; 00:00:{String(seconds).padStart(2, '0')}
      </div>
      <div style={{position: 'absolute', top: 50, right: 70, fontFamily: F.vt, fontSize: 40, color: '#fff', opacity: 0.8}}>08 / SP</div>
    </AbsoluteFill>
  );
};
