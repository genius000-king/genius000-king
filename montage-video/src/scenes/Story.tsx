import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import {ChapterTag, Grain, Vignette, img} from '../components/common';
import {STYLES, StyleTile, TileFrame} from '../components/StyleTile';
import {F} from '../fonts';
import {Center, ease, easeOut, mix, pop, ramp, useSec, vis} from '../lib';

const BG = '#15110D';
const CREAM = '#F2E6D0';
const AMBER = '#E0A040';
const DIM = '#8a7c66';

// Story arc, read right-to-left: start → problem → rising → climax → end
const ARC = 'M 1720 800 C 1560 800, 1500 760, 1400 700 S 1150 560, 1050 520 S 800 330, 720 330 S 420 620, 220 760';
const BEATS = [
  {t: 'بداية', at: 195.72, x: 1720, y: 800, p: 0.0},
  {t: 'مشكلة', at: 196.54, x: 1400, y: 700, p: 0.2},
  {t: 'تصاعد', at: 197.26, x: 1050, y: 520, p: 0.45},
  {t: 'ذروة', at: 198.06, x: 720, y: 330, p: 0.66},
  {t: 'نهاية', at: 198.68, x: 220, y: 760, p: 1.0},
];

const CLIPS = ['interview', 'map', 'dune-sunset', 'factory', 'face'];

export const Story: React.FC = () => {
  const s = useSec();

  const titleO = vis(s, 188.1, 193.2, 0.3);
  const arcO = vis(s, 193.1, 202.1, 0.3);
  const ruleO = ramp(s, 202.1, 202.4);

  // how much of the arc is drawn, following the spoken beats
  const drawn = (() => {
    for (let i = BEATS.length - 1; i >= 0; i--) {
      if (s >= BEATS[i].at) {
        const next = BEATS[i + 1];
        if (!next) return 1;
        return mix(BEATS[i].p, next.p, ramp(s, BEATS[i].at, next.at, (v) => v));
      }
    }
    return 0;
  })();
  const head = BEATS.reduce((acc, b) => (s >= b.at ? b : acc), BEATS[0]);

  // ripple delete of the pretty shot
  const lift = ramp(s, 206.42, 206.7, easeOut);
  const close = ramp(s, 206.7, 207.1, ease);

  return (
    <AbsoluteFill style={{background: BG}}>
      {/* Chapter title */}
      {s < 193.3 && (
        <AbsoluteFill style={{opacity: titleO}}>
          <Center style={{flexDirection: 'column'}}>
            <div style={{fontFamily: F.amiri, fontSize: 44, color: DIM, direction: 'rtl', opacity: ramp(s, 188.14, 188.6)}}>والفصل الأخير</div>
            <div style={{display: 'flex', alignItems: 'center', gap: 40}}>
              <div style={{width: 200 * ramp(s, 189.3, 190.0, easeOut), height: 2, background: AMBER}} />
              <div style={{fontFamily: F.amiri, fontWeight: 700, fontSize: 210, color: CREAM, opacity: ramp(s, 189.35, 189.8), lineHeight: 1.4}}>القصصي</div>
              <div style={{width: 200 * ramp(s, 189.3, 190.0, easeOut), height: 2, background: AMBER}} />
            </div>
            <div style={{fontFamily: F.serif, fontSize: 30, letterSpacing: 14, color: DIM, opacity: ramp(s, 189.6, 190.0)}}>STORYTELLING</div>
            <div style={{marginTop: 50, direction: 'rtl', fontFamily: F.amiri, fontSize: 64, color: CREAM, display: 'flex', gap: 40}}>
              <span style={{opacity: ramp(s, 190.22, 190.5), position: 'relative', color: DIM}}>
                مو شكل
                <span style={{position: 'absolute', left: -10, right: -10, top: '55%', height: 4, background: '#c0533a', transform: `scaleX(${ramp(s, 190.95, 191.25)})`, transformOrigin: 'right'}} />
              </span>
              <span style={{opacity: ramp(s, 191.5, 191.8), color: AMBER, fontWeight: 700}}>طريقة تفكير</span>
            </div>
          </Center>
        </AbsoluteFill>
      )}

      {/* Story arc */}
      {s >= 193.1 && s < 202.2 && (
        <AbsoluteFill style={{opacity: arcO}}>
          <div style={{position: 'absolute', top: 90, width: '100%', textAlign: 'center', fontFamily: F.amiri, fontSize: 60, color: CREAM, direction: 'rtl'}}>
            المونتاج كله يتبني على <span style={{color: AMBER, fontWeight: 700}}>قصة</span>
          </div>
          <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
            <path d={ARC} fill="none" stroke="#2c241b" strokeWidth={6} />
            <path d={ARC} fill="none" stroke={AMBER} strokeWidth={6} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - drawn} />
          </svg>
          {BEATS.map((b, i) => {
            const p = pop(s, b.at, {damping: 11});
            return (
              <React.Fragment key={b.t}>
                <div style={{position: 'absolute', left: b.x - 16, top: b.y - 16, width: 32, height: 32, borderRadius: '50%', background: s >= b.at ? AMBER : '#2c241b', border: `3px solid ${BG}`, transform: `scale(${mix(0.6, 1, p)})`, boxShadow: head === b && s >= b.at ? `0 0 30px ${AMBER}` : 'none'}} />
                <div style={{position: 'absolute', left: b.x - 120, top: b.y + (i === 3 ? -110 : 34), width: 240, textAlign: 'center', direction: 'rtl', opacity: p, transform: `translateY(${(1 - p) * 16}px)`}}>
                  <div style={{fontFamily: F.amiri, fontWeight: 700, fontSize: 54, color: CREAM}}>{b.t}</div>
                </div>
              </React.Fragment>
            );
          })}
          {/* combine with any other style */}
          <div style={{position: 'absolute', bottom: 60, width: '100%', display: 'flex', justifyContent: 'center', gap: 18, direction: 'rtl'}}>
            {STYLES.filter((x) => x.id !== 'story').map((st, i) => {
              const p = pop(s, 199.4 + i * 0.22, {damping: 12});
              return (
                <div key={st.id} style={{opacity: p, transform: `translateY(${(1 - p) * 40}px)`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 20px rgba(0,0,0,.5)'}}>
                  <TileFrame scale={0.36}>
                    <StyleTile id={st.id} />
                  </TileFrame>
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      )}

      {/* The hardest rule */}
      {s >= 202.1 && (
        <AbsoluteFill style={{opacity: ruleO}}>
          <div style={{position: 'absolute', top: 140, width: '100%', textAlign: 'center', direction: 'rtl'}}>
            <div style={{fontFamily: F.amiri, fontSize: 48, color: DIM}}>وأصعب قاعدة فيه</div>
          </div>
          <div style={{position: 'absolute', left: 160, top: 400, width: 1600, height: 240, background: '#1f1912', borderRadius: 16, border: '2px solid #2e251b', direction: 'rtl', display: 'flex', alignItems: 'center', padding: '0 30px', boxSizing: 'border-box'}}>
            {CLIPS.map((c, i) => {
              const pretty = i === 2;
              const w = pretty ? 300 * (1 - close) : 300;
              return (
                <div key={c} style={{width: w, flexShrink: 0, height: 180, marginLeft: pretty ? 8 * (1 - close) : 8, position: 'relative'}}>
                  {(!pretty || lift < 1 || close < 1) && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: 300,
                        borderRadius: 10,
                        overflow: 'hidden',
                        border: pretty ? `4px solid ${s >= 205.16 ? '#e0533a' : AMBER}` : `2px solid #3a2f22`,
                        boxShadow: pretty && s >= 203.84 ? `0 0 40px ${s >= 205.16 ? 'rgba(224,83,58,.6)' : 'rgba(224,160,64,.6)'}` : 'none',
                        transform: pretty ? `translateY(${-lift * 160}px) rotate(${lift * -6}deg) scale(${mix(1, 0.85, lift)})` : 'none',
                        opacity: pretty ? 1 - close : 1,
                      }}
                    >
                      <Img src={img(c)} style={{width: 300, height: '100%', objectFit: 'cover', filter: pretty ? 'saturate(1.2)' : 'saturate(.6) brightness(.8)'}} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{position: 'absolute', left: 1020, top: 330, width: 0, overflow: 'visible', direction: 'rtl', opacity: ramp(s, 204.4, 204.7) * (1 - lift)}}>
            <div style={{fontFamily: F.amiri, fontWeight: 700, fontSize: 46, color: AMBER, whiteSpace: 'nowrap'}}>لقطة حلوة ✦</div>
          </div>
          <div style={{position: 'absolute', top: 720, width: '100%', textAlign: 'center', direction: 'rtl', fontFamily: F.amiri, fontSize: 60, color: CREAM}}>
            <span style={{opacity: ramp(s, 203.84, 204.1)}}>عندك لقطة حلوة… </span>
            <span style={{opacity: ramp(s, 205.16, 205.4), color: '#e0533a'}}>بس ما تخدم القصة؟</span>
          </div>
          <div style={{position: 'absolute', top: 820, width: '100%', textAlign: 'center', fontFamily: F.amiri, fontWeight: 700, fontSize: 130, color: CREAM, opacity: ramp(s, 206.4, 206.55), transform: `scale(${mix(1.4, 1, pop(s, 206.42, {damping: 10}))})`}}>
            احذفها.
          </div>
        </AbsoluteFill>
      )}

      <Grain opacity={0.08} />
      <Vignette strength={0.5} />
      <ChapterTag n={8} en="STORYTELLING" color={DIM} at={188.4} font={F.serif} />
    </AbsoluteFill>
  );
};
