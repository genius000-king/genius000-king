import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ChapterTag, Grain, Photo, Vignette, VoiceStrip, tex, typed} from '../components/common';
import {Art} from '../art';
import {F} from '../fonts';
import {Center, ease, easeOut, mix, pop, ramp, useSec, vis} from '../lib';

const CREAM = '#E9DFC9';
const RED = '#B3261E';
const ARCH = 'grayscale(1) sepia(.35) contrast(1.12) brightness(.85)';

const Stamp: React.FC<{text: string; at: number; rot?: number; size?: number; style?: React.CSSProperties}> = ({text, at, rot = -10, size = 80, style}) => {
  const s = useSec();
  const p = pop(s, at, {damping: 9, stiffness: 260});
  return (
    <div
      style={{
        position: 'absolute',
        border: `6px solid ${RED}`,
        color: RED,
        borderRadius: 10,
        padding: '0 30px 8px',
        fontFamily: F.amiri,
        fontWeight: 700,
        fontSize: size,
        transform: `rotate(${rot}deg) scale(${mix(2, 1, p)})`,
        opacity: s < at ? 0 : 0.88,
        direction: 'rtl',
        mixBlendMode: 'multiply',
        ...style,
      }}
    >
      {text}
    </div>
  );
};

const Caption: React.FC<{children: React.ReactNode; o: number; style?: React.CSSProperties}> = ({children, o, style}) => (
  <div
    style={{
      position: 'absolute',
      background: CREAM,
      color: '#1c1c1c',
      fontFamily: F.type,
      fontSize: 30,
      padding: '8px 22px',
      opacity: o,
      transform: `translateY(${(1 - o) * 14}px)`,
      boxShadow: '0 6px 18px rgba(0,0,0,.35)',
      ...style,
    }}
  >
    {children}
  </div>
);

const Clip: React.FC<{name: string; x: number; w: number; at: number}> = ({name, x, w, at}) => {
  const s = useSec();
  const p = pop(s, at, {damping: 15});
  return (
    <div style={{position: 'absolute', left: x, top: 8, width: w, height: 124, opacity: p, transform: `translateY(${(1 - p) * -50}px)`, border: `3px solid ${CREAM}`, borderRadius: 6, overflow: 'hidden'}}>
      <Art name={name} style={{width: '100%', height: '100%', objectFit: 'cover', filter: ARCH}} />
    </div>
  );
};

export const Documentary: React.FC = () => {
  const s = useSec();

  const titleO = vis(s, 49.3, 51.8, 0.2);
  const tlO = vis(s, 51.7, 56.8, 0.25);
  const playhead = ramp(s, 51.74, 56.8, (v) => v);

  return (
    <AbsoluteFill style={{background: '#141414'}}>
      {/* Title card */}
      {s < 51.9 && (
        <AbsoluteFill style={{opacity: titleO}}>
          <Photo name="map" filter="grayscale(1) brightness(.35) blur(2px)" from={1.1} to={1.0} a={49.3} b={52} />
          <Center>
            <div
              style={{
                width: 1060,
                height: 460,
                backgroundImage: `url(${tex('archive.jpg')})`,
                backgroundSize: 'cover',
                transform: 'rotate(-1.2deg)',
                boxShadow: '0 30px 60px rgba(0,0,0,.6)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{position: 'absolute', top: 26, left: 34, fontFamily: F.type, fontSize: 24, color: '#555'}}>FILE No. 03 — CONFIDENTIAL</div>
              <div style={{fontFamily: F.amiri, fontWeight: 700, fontSize: 170, color: '#1c1c1c', direction: 'rtl', height: 230, lineHeight: 1.3}}>{typed('الوثائقي', s, 49.44, 12)}</div>
              <div style={{fontFamily: F.type, fontSize: 46, color: '#333', letterSpacing: 6, height: 60}}>{typed('DOCUMENTARY', s, 49.9, 20)}</div>
              <Stamp text="الحقيقة" at={51.04} style={{right: 60, bottom: 40}} />
            </div>
          </Center>
        </AbsoluteFill>
      )}

      {/* Editing timeline: the voice is the spine, images prove it */}
      {s >= 51.6 && s < 56.9 && (
        <AbsoluteFill style={{opacity: tlO}}>
          <div style={{position: 'absolute', top: 150, width: '100%', textAlign: 'center', direction: 'rtl', fontFamily: F.amiri, fontWeight: 700, fontSize: 70, color: CREAM}}>
            <span style={{opacity: ramp(s, 51.74, 52.1)}}>العمود الفقري: </span>
            <span style={{color: '#E8C07D', opacity: ramp(s, 53.0, 53.3)}}>التعليق الصوتي</span>
          </div>
          <div style={{position: 'absolute', left: 160, top: 360, width: 1600, height: 330, background: '#1d1d1d', border: '2px solid #333', borderRadius: 12}}>
            {/* track headers (RTL: on the right) */}
            {[
              {y: 16, t: 'صورة', c: '#7d8fb3'},
              {y: 176, t: 'صوت', c: '#E8C07D'},
            ].map((h) => (
              <div key={h.t} style={{position: 'absolute', right: 14, top: h.y, width: 110, height: 140, background: '#262626', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.cairo, fontWeight: 700, fontSize: 30, color: h.c, direction: 'rtl'}}>
                {h.t}
              </div>
            ))}
            <div style={{position: 'absolute', left: 20, top: 16, width: 1440, height: 140}}>
              <Clip name="factory" x={0} w={420} at={54.38} />
              <Clip name="interview" x={440} w={360} at={54.7} />
              <Clip name="map" x={820} w={300} at={55.02} />
              <Clip name="machine" x={1140} w={300} at={55.4} />
            </div>
            <div style={{position: 'absolute', left: 20, top: 176, width: 1440, height: 140, background: 'rgba(232,192,125,.08)', borderRadius: 8, display: 'flex', alignItems: 'center'}}>
              <VoiceStrip from={51.74} to={56.8} width={1440} height={120} color="#E8C07D" bars={180} />
            </div>
            <div style={{position: 'absolute', left: 20 + playhead * 1440, top: -10, bottom: -10, width: 3, background: '#ff4d4d', boxShadow: '0 0 12px #ff4d4d'}} />
          </div>
          <div style={{position: 'absolute', top: 760, width: '100%', textAlign: 'center', direction: 'rtl', fontFamily: F.amiri, fontSize: 60, color: CREAM, opacity: ramp(s, 54.4, 54.8)}}>
            والصورة شغلتها… <span style={{fontWeight: 700, color: '#fff', borderBottom: `4px solid ${RED}`}}>تثبت الكلام</span>
          </div>
        </AbsoluteFill>
      )}

      {/* Archive */}
      {s >= 56.8 && s < 57.7 && (
        <AbsoluteFill>
          <Photo name="factory" filter={ARCH} from={1.12} to={1.0} a={56.8} b={57.7} />
          <Caption o={ramp(s, 56.85, 57.05)} style={{right: 90, bottom: 110, fontFamily: F.amiri, fontSize: 52, fontWeight: 700, direction: 'rtl'}}>أرشيف</Caption>
          <Caption o={ramp(s, 56.9, 57.1)} style={{left: 90, top: 90, fontSize: 26}}>ARCHIVE · No. 0417</Caption>
        </AbsoluteFill>
      )}
      {/* Interview with lower third */}
      {s >= 57.66 && s < 58.6 && (
        <AbsoluteFill>
          <Photo name="interview" filter="saturate(.55) contrast(1.05)" from={1.0} to={1.08} a={57.66} b={58.6} pos="center 30%" />
          <div style={{position: 'absolute', right: 120, bottom: 120, direction: 'rtl', display: 'flex', alignItems: 'stretch', transform: `translateX(${(1 - ramp(s, 57.7, 57.95, easeOut)) * 200}px)`, opacity: ramp(s, 57.7, 57.9)}}>
            <div style={{width: 12, background: RED}} />
            <div style={{background: 'rgba(15,15,15,.88)', padding: '10px 30px 14px'}}>
              <div style={{fontFamily: F.amiri, fontWeight: 700, fontSize: 52, color: '#fff'}}>مقابلات</div>
              <div style={{fontFamily: F.type, fontSize: 22, color: '#bbb'}}>INTERVIEW</div>
            </div>
          </div>
        </AbsoluteFill>
      )}
      {/* Map with a route */}
      {s >= 58.58 && s < 59.35 && (
        <AbsoluteFill>
          <Photo name="map" filter="sepia(.5) contrast(1.1) brightness(.85)" from={1.15} to={1.05} a={58.58} b={59.35} />
          <svg width={1920} height={1080} style={{position: 'absolute'}}>
            <path d="M 1400 300 C 1200 380, 1050 300, 900 460 S 650 700, 520 640" fill="none" stroke={RED} strokeWidth={8} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ramp(s, 58.6, 59.2)} />
            <circle cx={1400} cy={300} r={16} fill={RED} />
            <circle cx={520} cy={640} r={16 * ramp(s, 59.0, 59.2)} fill={RED} />
          </svg>
          <Caption o={ramp(s, 58.62, 58.8)} style={{right: 90, bottom: 110, fontFamily: F.amiri, fontSize: 52, fontWeight: 700, direction: 'rtl'}}>خرايط</Caption>
        </AbsoluteFill>
      )}
      {/* Dates */}
      {s >= 59.32 && s < 60.1 && (
        <AbsoluteFill style={{backgroundImage: `url(${tex('archive.jpg')})`, backgroundSize: 'cover'}}>
          <Center>
            <div style={{textAlign: 'center', direction: 'rtl'}}>
              <div style={{fontFamily: F.type, fontSize: 210, color: '#1c1c1c', letterSpacing: 10}}>{Math.round(mix(1890, 1921, ramp(s, 59.32, 59.8, easeOut)))}</div>
              <div style={{fontFamily: F.amiri, fontWeight: 700, fontSize: 56, color: RED}}>تواريخ</div>
            </div>
          </Center>
        </AbsoluteFill>
      )}
      {/* A-roll vs B-roll */}
      {s >= 60.08 && s < 62.75 && (
        <AbsoluteFill>
          <Photo name="pipes" filter={ARCH} from={1.0} to={1.1} a={60.08} b={62.75} />
          <div
            style={{
              position: 'absolute',
              right: mix(0, 90, ramp(s, 60.1, 60.6, ease)),
              top: mix(0, 90, ramp(s, 60.1, 60.6, ease)),
              width: mix(1920, 520, ramp(s, 60.1, 60.6, ease)),
              height: mix(1080, 292, ramp(s, 60.1, 60.6, ease)),
              overflow: 'hidden',
              border: `4px solid ${CREAM}`,
              boxShadow: '0 20px 40px rgba(0,0,0,.5)',
            }}
          >
            <Art name={'interview'} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%', filter: 'saturate(.55)'}} />
            <div style={{position: 'absolute', left: 0, bottom: 0, background: CREAM, fontFamily: F.type, fontSize: 24, padding: '4px 12px', opacity: ramp(s, 60.6, 60.8)}}>A-ROLL · المتكلم</div>
          </div>
          <div style={{position: 'absolute', left: 110, bottom: 110, direction: 'rtl', opacity: ramp(s, 60.4, 60.7)}}>
            <div style={{fontFamily: F.amiri, fontWeight: 700, fontSize: 64, color: '#fff', textShadow: '0 4px 20px #000'}}>لقطات داعمة</div>
          </div>
          <div style={{position: 'absolute', left: 110, bottom: 210, fontFamily: F.type, fontSize: 120, color: CREAM, textShadow: '0 4px 30px #000', opacity: ramp(s, 61.9, 62.1), transform: `scale(${mix(1.3, 1, pop(s, 61.94))})`, transformOrigin: 'left bottom'}}>
            B-ROLL
          </div>
        </AbsoluteFill>
      )}
      {/* Still photo, then Ken Burns */}
      {s >= 62.7 && s < 67.4 && (
        <AbsoluteFill style={{background: '#141414', opacity: vis(s, 62.7, 67.45, 0.15)}}>
          <div style={{position: 'absolute', left: 260, top: 150, width: 1400, height: 788, overflow: 'hidden', border: `4px solid ${CREAM}`}}>
            <Art name={'machine'}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: s < 64.98 ? `${ARCH} brightness(.75)` : ARCH,
                transform: `scale(${mix(1, 1.35, ramp(s, 64.98, 67.4, (v) => v))}) translate(${ramp(s, 64.98, 67.4, (v) => v) * -60}px, ${ramp(s, 64.98, 67.4, (v) => v) * 30}px)`,
              }}
            />
          </div>
          <div style={{position: 'absolute', top: 60, width: '100%', textAlign: 'center', direction: 'rtl', fontFamily: F.amiri, fontWeight: 700, fontSize: 56, color: CREAM}}>
            {s < 64.98 ? 'صورة ثابتة…' : 'زوم بطيء = حياة'}
          </div>
          <Caption o={ramp(s, 65.3, 65.5)} style={{right: 300, bottom: 170, fontSize: 30}}>KEN BURNS EFFECT</Caption>
          {s < 64.98 && <Stamp text="ميتة؟" at={63.64} rot={8} size={70} style={{left: 340, top: 200}} />}
        </AbsoluteFill>
      )}
      {/* Golden rule */}
      {s >= 67.3 && s < 71.06 && (
        <AbsoluteFill style={{background: '#141414', opacity: ramp(s, 67.3, 67.5)}}>
          <div style={{position: 'absolute', top: 210, width: '100%', textAlign: 'center', fontFamily: F.amiri, fontWeight: 700, fontSize: 92, color: '#E8C07D', direction: 'rtl'}}>
            {typed('القاعدة الذهبية', s, 67.4, 18)}
          </div>
          <div style={{position: 'absolute', top: 520, width: '100%', display: 'flex', justifyContent: 'center', gap: 160, direction: 'rtl'}}>
            <div style={{textAlign: 'center', opacity: ramp(s, 68.8, 69.0)}}>
              <div style={{fontFamily: F.cairo, fontSize: 40, color: '#aaa'}}>تسمع</div>
              <div style={{fontFamily: F.amiri, fontWeight: 700, fontSize: 120, color: CREAM}}>«مصنع»</div>
            </div>
            <div style={{fontFamily: F.cairo, fontSize: 90, color: '#666', alignSelf: 'center', opacity: ramp(s, 70.2, 70.4)}}>←</div>
            <div style={{textAlign: 'center', opacity: ramp(s, 70.3, 70.5)}}>
              <div style={{fontFamily: F.cairo, fontSize: 40, color: '#aaa'}}>لازم تشوف</div>
              <div style={{width: 300, height: 170, marginTop: 10, border: `3px dashed ${CREAM}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.type, fontSize: 40, color: '#777'}}>?</div>
            </div>
          </div>
        </AbsoluteFill>
      )}
      {s >= 71.06 && (
        <AbsoluteFill>
          <Photo name="factory" filter={ARCH} from={1.18} to={1.08} a={71.06} b={72.3} />
          <Center>
            <div style={{fontFamily: F.amiri, fontWeight: 700, fontSize: 200, color: '#fff', textShadow: '0 8px 40px rgba(0,0,0,.8)', transform: `scale(${mix(1.25, 1, pop(s, 71.1))})`}}>مصنع</div>
          </Center>
        </AbsoluteFill>
      )}

      <Grain opacity={0.14} />
      <Vignette strength={0.55} />
      <ChapterTag n={2} en="DOCUMENTARY" color={CREAM} at={49.6} font={F.type} />
    </AbsoluteFill>
  );
};
