import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ChapterTag} from '../components/common';
import {F} from '../fonts';
import {Center, easeOut, mix, ramp, useSec, vis} from '../lib';

const BG = '#F4F3EF';
const INK = '#141414';
const GREY = '#9B9A94';
const ACC = '#FF4F00';

const slow = (s: number, a: number, d = 0.9) => ramp(s, a, a + d, easeOut);

const Small: React.FC<{children: React.ReactNode; o: number; style?: React.CSSProperties}> = ({children, o, style}) => (
  <div style={{position: 'absolute', fontFamily: F.plex, fontWeight: 300, fontSize: 34, color: INK, direction: 'rtl', opacity: o, ...style}}>{children}</div>
);

export const Minimal: React.FC = () => {
  const s = useSec();

  const dot = slow(s, 146.4, 0.7);
  const titleO = vis(s, 146.6, 149.0, 0.5);

  const p1 = vis(s, 149.16, 150.25, 0.25);
  const p2 = vis(s, 150.32, 151.35, 0.25);
  const p3 = vis(s, 151.42, 152.55, 0.25);
  const p4 = vis(s, 152.62, 154.05, 0.25);
  const brand = vis(s, 154.14, 157.3, 0.3);
  const rule = vis(s, 157.4, 160.85, 0.3);
  const space = ramp(s, 160.88, 161.4);

  // where the accent dot lives in each beat
  const dotPos = (() => {
    if (s < 149.1) return {x: 960, y: 470, r: 22};
    if (s < 160.88) return {x: 960, y: 470, r: 0};
    return {x: mix(960, 1280, slow(s, 160.9, 1.2)), y: mix(470, 360, slow(s, 160.9, 1.2)), r: 22};
  })();
  const pulse = s > 164.6 ? 1 + Math.sin(Math.min(1, (s - 164.6) / 0.6) * Math.PI) * 0.6 : 1;

  return (
    <AbsoluteFill style={{background: BG}}>
      {/* accent dot */}
      <div
        style={{
          position: 'absolute',
          left: dotPos.x - dotPos.r,
          top: dotPos.y - dotPos.r,
          width: dotPos.r * 2,
          height: dotPos.r * 2,
          borderRadius: '50%',
          background: ACC,
          transform: `scale(${(s < 149.1 ? dot : 1) * pulse})`,
          opacity: s < 149.1 ? 1 - ramp(s, 148.8, 149.1) : space,
        }}
      />
      {/* title */}
      <div style={{position: 'absolute', top: 540, width: '100%', textAlign: 'center', opacity: titleO}}>
        <div style={{fontFamily: F.plex, fontWeight: 200, fontSize: 92, color: INK, direction: 'rtl'}}>مينيمال</div>
        <div style={{fontFamily: F.mono, fontSize: 18, letterSpacing: 14, color: GREY, marginTop: 6}}>MINIMAL</div>
      </div>
      <Small o={ramp(s, 147.1, 147.6) * titleO} style={{bottom: 120, width: '100%', textAlign: 'center', color: GREY, fontSize: 30}}>
        عكس اللي قبله تمامًا
      </Small>

      {/* few elements */}
      <AbsoluteFill style={{opacity: p1}}>
        <Center style={{gap: 120}}>
          <div style={{width: 40, height: 40, borderRadius: '50%', background: INK, transform: `scale(${slow(s, 149.2, 0.5)})`}} />
          <div style={{width: 160 * slow(s, 149.3, 0.6), height: 2, background: INK}} />
          <div style={{width: 60, height: 60, border: `2px solid ${INK}`, opacity: slow(s, 149.45, 0.5)}} />
        </Center>
        <Small o={1} style={{top: 640, width: '100%', textAlign: 'center'}}>عناصر قليلة</Small>
      </AbsoluteFill>
      {/* few colours */}
      <AbsoluteFill style={{opacity: p2}}>
        <Center style={{gap: 40}}>
          {[BG, INK, ACC].map((c, i) => (
            <div key={c} style={{width: 90, height: 90, borderRadius: '50%', background: c, border: c === BG ? `1px solid ${GREY}` : 'none', transform: `scale(${slow(s, 150.35 + i * 0.12, 0.5)})`}} />
          ))}
        </Center>
        <Small o={1} style={{top: 640, width: '100%', textAlign: 'center'}}>ألوان قليلة</Small>
      </AbsoluteFill>
      {/* clear lines */}
      <AbsoluteFill style={{opacity: p3}}>
        <div style={{position: 'absolute', top: 540, right: 0, width: 1920 * slow(s, 151.42, 0.8), height: 2, background: INK}} />
        <div style={{position: 'absolute', top: 440, width: '100%', textAlign: 'center', fontFamily: F.plex, fontWeight: 500, fontSize: 64, color: INK, direction: 'rtl', opacity: slow(s, 151.6, 0.5)}}>
          خطوط واضحة
        </div>
      </AbsoluteFill>
      {/* lots of empty space */}
      <AbsoluteFill style={{opacity: p4}}>
        <div style={{position: 'absolute', left: 140, top: 140, right: 140, bottom: 220, border: `1px dashed ${GREY}`, opacity: slow(s, 152.9, 0.6)}} />
        <Small o={slow(s, 152.7, 0.5)} style={{right: 140, bottom: 140, fontSize: 30}}>
          ومساحات فاضية… كثير
        </Small>
      </AbsoluteFill>

      {/* where you see it */}
      <AbsoluteFill style={{opacity: brand}}>
        <div style={{position: 'absolute', left: 1080, top: 300, width: 180, height: 370, borderRadius: 34, border: `2px solid ${INK}`, opacity: slow(s, 155.1, 0.6), transform: `translateY(${(1 - slow(s, 155.1, 0.8)) * 30}px)`}}>
          <div style={{position: 'absolute', top: 16, left: 74, width: 32, height: 6, borderRadius: 3, background: INK}} />
        </div>
        <div style={{position: 'absolute', left: 660, top: 375, width: 220, height: 220, borderRadius: '50%', border: `2px solid ${INK}`, opacity: slow(s, 156.1, 0.6), transform: `translateY(${(1 - slow(s, 156.1, 0.8)) * 30}px)`}}>
          <div style={{position: 'absolute', left: 109, top: 30, width: 2, height: 80, background: INK, transformOrigin: 'bottom', transform: `rotate(${(s - 156) * 30}deg)`}} />
          <div style={{position: 'absolute', left: 104, top: 104, width: 12, height: 12, borderRadius: '50%', background: ACC}} />
        </div>
        <Small o={slow(s, 155.6, 0.5)} style={{left: 1080, width: 180, textAlign: 'center', top: 700}}>تقنية</Small>
        <Small o={slow(s, 156.8, 0.5)} style={{left: 660, width: 220, textAlign: 'center', top: 700}}>فخامة</Small>
      </AbsoluteFill>

      {/* every element has a reason */}
      <AbsoluteFill style={{opacity: rule}}>
        <div style={{position: 'absolute', right: 520, top: 380, fontFamily: F.plex, fontWeight: 500, fontSize: 84, color: INK, direction: 'rtl', opacity: slow(s, 157.5, 0.6)}}>فكرة وحدة</div>
        <div style={{position: 'absolute', right: 520, top: 520, width: 420 * slow(s, 157.8, 0.6), height: 2, background: INK}} />
        <div style={{position: 'absolute', left: 560, top: 420, width: 36, height: 36, borderRadius: '50%', background: ACC, transform: `scale(${slow(s, 158.0, 0.5)})`}} />
        {/* annotations */}
        {[
          {x1: 1400, y1: 420, x2: 1600, y2: 300, t: 'يقول الفكرة', at: 158.5},
          {x1: 1200, y1: 522, x2: 1400, y2: 700, t: 'يفصل', at: 158.9},
          {x1: 578, y1: 438, x2: 420, y2: 640, t: 'يلفت عينك', at: 159.4},
        ].map((a) => (
          <React.Fragment key={a.t}>
            <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
              <line x1={a.x1} y1={a.y1} x2={mix(a.x1, a.x2, slow(s, a.at, 0.5))} y2={mix(a.y1, a.y2, slow(s, a.at, 0.5))} stroke={GREY} strokeWidth={1.5} />
            </svg>
            <Small o={slow(s, a.at + 0.3, 0.4)} style={{left: a.x2 - 120, top: a.y2 + (a.y2 > a.y1 ? 10 : -56), width: 240, textAlign: 'center', fontSize: 28, color: GREY}}>
              {a.t}
            </Small>
          </React.Fragment>
        ))}
        <Small o={slow(s, 160.2, 0.4)} style={{bottom: 140, width: '100%', textAlign: 'center', fontSize: 34}}>
          كل عنصر… له <span style={{color: ACC, fontWeight: 500}}>سبب</span>
        </Small>
      </AbsoluteFill>

      {/* empty space guides the eye */}
      {s >= 160.88 && (
        <AbsoluteFill style={{opacity: space}}>
          <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
            {[
              [0, 0],
              [1920, 0],
              [0, 1080],
              [1920, 1080],
              [0, 360],
              [1920, 720],
            ].map(([x, y], i) => {
              const t = slow(s, 163.2 + i * 0.08, 1.1);
              return <line key={i} x1={x} y1={y} x2={mix(x, 1280, t)} y2={mix(y, 360, t)} stroke={GREY} strokeWidth={1} opacity={0.5} />;
            })}
          </svg>
          <Small o={slow(s, 161.5, 0.6)} style={{left: 160, bottom: 140, color: GREY, fontSize: 30}}>
            المساحة الفاضية مو فراغ
          </Small>
          <Small o={slow(s, 164.55, 0.4)} style={{left: 1330, top: 336, fontWeight: 500, color: ACC, fontSize: 34}}>
            المهم
          </Small>
        </AbsoluteFill>
      )}

      <ChapterTag n={6} en="MINIMAL" color={GREY} at={146.8} />
    </AbsoluteFill>
  );
};
