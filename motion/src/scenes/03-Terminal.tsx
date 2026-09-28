// 03 — Green-phosphor CRT. A sovereignty boot log types out, then glitches into a manifesto.
import React from 'react';
import {AbsoluteFill, interpolate, random, useCurrentFrame} from 'remotion';
import {F} from '../fonts';

const GREEN = '#39ff7a';
const DIM = '#1d7a3e';

const LINES: {text: string; at: number; speed?: number; color?: string}[] = [
  {text: '$ g++ -O3 -std=c++23 sovereign.cpp -o me', at: 10, speed: 1.6},
  {text: '$ ./me --no-tracking --offline', at: 80, speed: 1.6},
  {text: '[ OK ] telemetry ............. disabled', at: 130, speed: 3},
  {text: '[ OK ] cloud lock-in ......... removed', at: 150, speed: 3},
  {text: '[ OK ] local model ........... loaded (8B · q4)', at: 170, speed: 3},
  {text: '[ OK ] disk encryption ....... AES-256-GCM', at: 190, speed: 3},
  {text: '[ OK ] dependencies .......... understood', at: 210, speed: 3},
  {text: '[WARN] comfort zone .......... not found', at: 235, speed: 3, color: '#ffd23f'},
  {text: '>>> own your stack_', at: 270, speed: 1.2},
];

const typed = (frame: number, at: number, text: string, speed = 2) =>
  text.slice(0, Math.max(0, Math.floor((frame - at) * speed)));

export const Terminal: React.FC = () => {
  const frame = useCurrentFrame();
  const flicker = 0.93 + random(`f${frame}`) * 0.07;
  const glitch = frame >= 320 && frame < 345;
  const manifesto = frame >= 335;
  const shift = glitch ? (random(`g${frame}`) - 0.5) * 60 : 0;
  const boot = interpolate(frame, [0, 8], [0, 1], {extrapolateRight: 'clamp'});
  const outro = interpolate(frame, [425, 450], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const cursorOn = Math.floor(frame / 8) % 2 === 0;

  return (
    <AbsoluteFill style={{background: '#010603'}}>
      <AbsoluteFill
        style={{
          margin: 40,
          borderRadius: 60,
          overflow: 'hidden',
          background: 'radial-gradient(ellipse at center, #06200f 0%, #020904 75%)',
          boxShadow: 'inset 0 0 180px rgba(0,0,0,0.95)',
          opacity: flicker * outro,
          transform: `scaleY(${boot})`,
        }}
      >
        {!manifesto && (
          <div
            style={{
              padding: '90px 110px',
              fontFamily: F.vt,
              fontSize: 54,
              lineHeight: 1.28,
              color: GREEN,
              textShadow: `0 0 8px ${GREEN}, 0 0 22px rgba(57,255,122,0.5)`,
              transform: `translateX(${shift}px)`,
            }}
          >
            <div style={{color: '#2fae5a', marginBottom: 20, textShadow: 'none', opacity: 0.8}}>GENIUS/OS v1.0 — tty1 — {String(frame).padStart(4, '0')}</div>
            {LINES.map((l, i) => {
              const s = typed(frame, l.at, l.text, l.speed);
              if (!s) return null;
              const last = LINES.findLastIndex((x) => frame >= x.at) === i;
              return (
                <div key={i} style={{color: l.color ?? GREEN, whiteSpace: 'pre'}}>
                  {s.replace(/_$/, '')}
                  {last && cursorOn ? '█' : ''}
                </div>
              );
            })}
          </div>
        )}

        {manifesto && (
          <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
            {[
              {c: '#ff004c', dx: -8},
              {c: '#00e5ff', dx: 8},
              {c: GREEN, dx: 0},
            ].map((layer, i) => {
              const jitter = frame < 360 ? (random(`j${frame}${i}`) - 0.5) * 30 : Math.sin(frame / 3 + i) * 2;
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    textAlign: 'center',
                    mixBlendMode: i < 2 ? 'screen' : 'normal',
                    color: layer.c,
                    transform: `translateX(${layer.dx + jitter}px)`,
                    textShadow: i === 2 ? `0 0 30px ${GREEN}` : undefined,
                  }}
                >
                  <div style={{fontFamily: F.vt, fontSize: 250, lineHeight: 0.9}}>OWN YOUR</div>
                  <div style={{fontFamily: F.vt, fontSize: 250, lineHeight: 0.9}}>STACK.</div>
                  <div style={{fontFamily: F.kufi, fontWeight: 700, fontSize: 90, marginTop: 30}}>امتلك أدواتك</div>
                </div>
              );
            })}
          </AbsoluteFill>
        )}

        {/* glitch slices */}
        {glitch &&
          Array.from({length: 7}).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: random(`t${frame}${i}`) * 1000,
                height: 6 + random(`h${frame}${i}`) * 40,
                background: i % 2 ? 'rgba(57,255,122,0.35)' : 'rgba(255,0,76,0.25)',
                transform: `translateX(${(random(`x${frame}${i}`) - 0.5) * 300}px)`,
              }}
            />
          ))}

        {/* scanlines + rolling bar */}
        <AbsoluteFill
          style={{background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.35) 0px, rgba(0,0,0,0.35) 2px, transparent 2px, transparent 5px)'}}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 180,
            top: ((frame * 6) % 1300) - 200,
            background: 'linear-gradient(transparent, rgba(57,255,122,0.06), transparent)',
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
