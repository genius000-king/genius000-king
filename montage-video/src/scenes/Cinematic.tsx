import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ChapterTag, Grain, Letterbox, Photo, Vignette, VoiceWave} from '../components/common';
import {F} from '../fonts';
import {Center, ease, mix, pop, ramp, useSec, vis} from '../lib';

const GOLD = '#E8C07D';
const CREAM = '#F3E3C3';
const BAR = 138; // 2.39:1 inside 16:9
const GRADE = 'contrast(1.12) saturate(1.2) sepia(.12) brightness(.98)';
const FLAT = 'contrast(.58) saturate(.2) brightness(1.18)';

const Caption: React.FC<{at: number; until: number; ar: string; en: string}> = ({at, until, ar, en}) => {
  const s = useSec();
  const o = vis(s, at, until, 0.35);
  return (
    <div style={{position: 'absolute', right: 120, bottom: BAR + 60, textAlign: 'right', direction: 'rtl', opacity: o, transform: `translateY(${(1 - ramp(s, at, at + 0.5)) * 12}px)`}}>
      <div style={{fontFamily: F.amiri, fontSize: 58, color: CREAM, textShadow: '0 2px 18px rgba(0,0,0,.7)'}}>{ar}</div>
      <div style={{display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'flex-start'}}>
        <div style={{width: 60, height: 1, background: GOLD}} />
        <div style={{fontFamily: F.serif, fontSize: 24, letterSpacing: 6, color: GOLD, direction: 'ltr'}}>{en}</div>
      </div>
    </div>
  );
};

const EyeEar: React.FC<{kind: 'eye' | 'ear'; on: number}> = ({kind, on}) => (
  <svg width={220} height={180} viewBox="0 0 110 90" style={{opacity: mix(0.25, 1, on), filter: on > 0.5 ? `drop-shadow(0 0 18px ${GOLD})` : 'none'}}>
    {kind === 'eye' ? (
      <g fill="none" stroke={on > 0.5 ? GOLD : CREAM} strokeWidth={3}>
        <path d="M8 45 C 30 12, 80 12, 102 45 C 80 78, 30 78, 8 45 Z" />
        <circle cx={55} cy={45} r={14} />
      </g>
    ) : (
      <g fill="none" stroke={on > 0.5 ? GOLD : CREAM} strokeWidth={4} strokeLinecap="round">
        <path d="M22 60 L22 46 C 22 22, 88 22, 88 46 L88 60" />
        <rect x={14} y={52} width={18} height={30} rx={7} fill={on > 0.5 ? GOLD : 'none'} />
        <rect x={78} y={52} width={18} height={30} rx={7} fill={on > 0.5 ? GOLD : 'none'} />
      </g>
    )}
  </svg>
);

export const Cinematic: React.FC = () => {
  const s = useSec();

  // letterbox: 2.39 normally, opened then slammed back while the voice mentions it
  const open = ramp(s, 103.86, 104.25, ease) * (1 - ramp(s, 104.5, 104.75, (v) => v * v));
  const bar = BAR * (1 - open) * ramp(s, 96.05, 96.6, ease);

  const fadeIn = ramp(s, 96.05, 97.0);
  const titleO = vis(s, 96.2, 99.0, 0.6);
  const titleBlur = mix(14, 0, ramp(s, 96.2, 97.3));

  // grading
  const wipe = ramp(s, 105.7, 106.6, ease);
  const mood = s < 106.9 ? -1 : s < 107.25 ? 0 : s < 107.6 ? 1 : s < 108.0 ? 2 : -1;
  const moods = [
    {f: 'sepia(.55) saturate(1.5) contrast(1.1) brightness(1.02)', t: 'دافي'},
    {f: 'hue-rotate(185deg) saturate(.9) contrast(1.1) brightness(.92)', t: 'بارد'},
    {f: 'grayscale(1) contrast(1.35) brightness(.85)', t: 'حزين'},
  ];

  const soundO = ramp(s, 110.1, 110.6);

  const dofBlur = mix(0, 14, ramp(s, 102.46, 103.3, ease));
  const S = 1.6;
  const bx = 960 + (1021 - 960) * S;
  const by = 540 + (580 - 540) * S;

  return (
    <AbsoluteFill style={{background: '#000'}}>
      {/* Shot 1: wide desert + title */}
      {s < 99.7 && (
        <AbsoluteFill style={{opacity: fadeIn}}>
          <Photo name="desert-boy" pos="center 14%" from={1.0} to={1.1} a={96.05} b={99.7} filter={GRADE} />
          <Center style={{opacity: titleO, filter: `blur(${titleBlur}px)`, paddingBottom: 330}}>
            <div style={{textAlign: 'center'}}>
              <div style={{fontFamily: F.amiri, fontWeight: 700, fontSize: 150, color: CREAM, textShadow: '0 4px 40px rgba(0,0,0,.6)', direction: 'rtl'}}>السينمائي</div>
              <div style={{fontFamily: F.serif, fontSize: 34, letterSpacing: 22, color: GOLD}}>CINEMATIC</div>
            </div>
          </Center>
        </AbsoluteFill>
      )}
      {/* Shot 2: calm wide + slow camera move */}
      {s >= 99.6 && s < 102.5 && (
        <AbsoluteFill style={{opacity: ramp(s, 99.6, 100.0)}}>
          <Photo name="dune-sunset" pos="center 62%" from={1.12} to={1.12} x={[60, -70]} a={99.6} b={102.5} filter={GRADE} />
        </AbsoluteFill>
      )}
      {/* Shot 3: shallow depth of field */}
      {s >= 102.4 && s < 105.7 && (
        <AbsoluteFill style={{opacity: ramp(s, 102.4, 102.7)}}>
          <Photo name="desert-boy" pos="center 30%" from={S} to={S} filter={`${GRADE} blur(${dofBlur}px)`} />
          <AbsoluteFill style={{maskImage: `radial-gradient(ellipse 210px 440px at ${bx}px ${by}px, black 68%, transparent 100%)`, WebkitMaskImage: `radial-gradient(ellipse 210px 440px at ${bx}px ${by}px, black 68%, transparent 100%)`}}>
            <Photo name="desert-boy" pos="center 30%" from={S} to={S} filter={GRADE} />
          </AbsoluteFill>
          {/* aspect-ratio annotation while the bars move */}
          <div style={{position: 'absolute', left: 120, top: '50%', transform: 'translateY(-50%)', opacity: vis(s, 104.4, 105.6, 0.2), fontFamily: F.serif, fontSize: 64, color: GOLD, letterSpacing: 4}}>2.39 : 1</div>
        </AbsoluteFill>
      )}
      {/* Shot 4: colour grading */}
      {s >= 105.6 && s < 110.6 && (
        <AbsoluteFill style={{opacity: ramp(s, 105.6, 105.8) * (1 - soundO)}}>
          <Photo name="neon" filter={FLAT} from={1.05} to={1.12} a={105.6} b={110.6} />
          <AbsoluteFill style={{clipPath: `inset(0 0 0 ${(1 - wipe) * 100}%)`}}>
            <Photo name="neon" filter={mood >= 0 ? moods[mood].f : GRADE} from={1.05} to={1.12} a={105.6} b={110.6} />
          </AbsoluteFill>
          {wipe > 0 && wipe < 1 && <div style={{position: 'absolute', top: 0, bottom: 0, left: `${(1 - wipe) * 100}%`, width: 3, background: CREAM}} />}
          <div style={{position: 'absolute', top: BAR + 40, right: 80, fontFamily: F.amiri, fontSize: 44, color: CREAM, opacity: vis(s, 105.7, 106.8, 0.2)}}>بعد</div>
          <div style={{position: 'absolute', top: BAR + 40, left: 80, fontFamily: F.amiri, fontSize: 44, color: CREAM, opacity: vis(s, 105.7, 106.6, 0.2) * (1 - wipe)}}>قبل</div>
          {mood >= 0 && (
            <Center>
              <div style={{fontFamily: F.amiri, fontWeight: 700, fontSize: 120, color: '#fff', textShadow: '0 4px 30px rgba(0,0,0,.8)'}}>{moods[mood].t}</div>
            </Center>
          )}
          <Center style={{opacity: ramp(s, 108.7, 109.0)}}>
            <div style={{fontFamily: F.serif, fontSize: 110, color: '#fff', letterSpacing: 8, textShadow: '0 4px 40px rgba(0,0,0,.8)'}}>Color Grading</div>
          </Center>
        </AbsoluteFill>
      )}
      <Caption at={99.62} until={100.85} ar="لقطات هادية" en="CALM SHOTS" />
      <Caption at={100.88} until={102.4} ar="حركة كاميرا ناعمة" en="SMOOTH CAMERA" />
      <Caption at={102.46} until={103.85} ar="خلفية مغبّشة" en="DEPTH OF FIELD" />
      <Caption at={103.86} until={105.6} ar="أشرطة سودا فوق وتحت" en="LETTERBOX" />
      <Caption at={105.64} until={108.6} ar="تلوين يعطي كل مشهد مزاجه" en="COLOR GRADING" />

      {/* The real secret: sound */}
      {s >= 110.0 && (
        <AbsoluteFill style={{opacity: soundO}}>
          <div style={{position: 'absolute', top: 230, width: '100%', textAlign: 'center', direction: 'rtl'}}>
            <span style={{fontFamily: F.amiri, fontSize: 64, color: '#a89a80', opacity: ramp(s, 110.4, 110.7)}}>السر الحقيقي في… </span>
            <span style={{fontFamily: F.amiri, fontWeight: 700, fontSize: 96, color: GOLD, opacity: ramp(s, 111.7, 111.95)}}>الصوت</span>
          </div>
          {s < 114.7 && (
            <Center style={{top: 60, opacity: ramp(s, 111.8, 112.2) * (1 - ramp(s, 114.4, 114.7))}}>
              <VoiceWave width={1100} height={220} color={GOLD} bars={72} gap={5} />
            </Center>
          )}
          <div style={{position: 'absolute', top: 720, width: '100%', display: 'flex', justifyContent: 'center', gap: 200, direction: 'rtl', opacity: 1 - ramp(s, 114.4, 114.7)}}>
            <div style={{fontFamily: F.amiri, fontSize: 60, color: CREAM, opacity: ramp(s, 112.58, 112.8)}}>موسيقى</div>
            <div style={{fontFamily: F.amiri, fontSize: 60, color: CREAM, opacity: ramp(s, 113.24, 113.45)}}>مؤثرات</div>
          </div>
          <div style={{position: 'absolute', top: 820, width: '100%', textAlign: 'center', fontFamily: F.serif, fontSize: 28, letterSpacing: 8, color: GOLD, opacity: ramp(s, 113.98, 114.2) * (1 - ramp(s, 114.4, 114.7))}}>
            SOUND DESIGN
          </div>
          {/* half the feeling comes through the ear */}
          {s >= 114.6 && (
            <AbsoluteFill style={{opacity: ramp(s, 114.6, 114.9)}}>
              <div style={{position: 'absolute', top: 400, width: '100%', display: 'flex', justifyContent: 'center', gap: 260, direction: 'rtl'}}>
                <div style={{textAlign: 'center'}}>
                  <EyeEar kind="ear" on={ramp(s, 116.1, 116.5)} />
                  <div style={{fontFamily: F.amiri, fontWeight: 700, fontSize: 56, color: GOLD, opacity: ramp(s, 116.9, 117.2)}}>من أذنك</div>
                </div>
                <div style={{textAlign: 'center', opacity: 1 - 0.6 * ramp(s, 117.78, 118.1)}}>
                  <EyeEar kind="eye" on={0} />
                  <div style={{fontFamily: F.amiri, fontSize: 56, color: CREAM, textDecoration: s > 117.9 ? 'line-through' : 'none'}}>{s > 117.75 ? 'مو من عينك' : ''}</div>
                </div>
              </div>
              <div style={{position: 'absolute', top: 760, width: '100%', textAlign: 'center', fontFamily: F.amiri, fontSize: 60, color: CREAM, direction: 'rtl', opacity: ramp(s, 115.1, 115.5)}}>
                نص الإحساس يوصلك…
              </div>
            </AbsoluteFill>
          )}
        </AbsoluteFill>
      )}

      <Grain opacity={0.1} />
      <Vignette strength={0.5} />
      <Letterbox h={bar} />
      <ChapterTag n={4} en="CINEMATIC" color={GOLD} at={96.6} font={F.serif} top={50} />
    </AbsoluteFill>
  );
};
