import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import {ChapterTag, img} from '../components/common';
import {F} from '../fonts';
import {Center, ease, easeOut, mix, pop, ramp, useSec, vis} from '../lib';

const W = '#FFFFFF';
const BLUE = '#6E8BFF';
const MUTE = '#8C93A8';
const BEAT = 60 / 96;
const BEAT0 = 165.48;

/** Fictional product, drawn in code: no real brand involved. */
const Phone: React.FC<{side: 'back' | 'front'; rotY?: number; rotX?: number; sweep?: number; screen?: string; screenOn?: number}> = ({side, rotY = 0, rotX = 0, sweep = -1, screen, screenOn = 0}) => (
  <div style={{perspective: 1600}}>
    <div
      style={{
        width: 380,
        height: 780,
        borderRadius: 64,
        position: 'relative',
        transform: `rotateY(${rotY}deg) rotateX(${rotX}deg)`,
        background: side === 'back' ? 'linear-gradient(150deg, #2a2f3b 0%, #12141a 45%, #0a0b0f 100%)' : '#07080b',
        boxShadow: `0 0 0 3px #3b4150, 0 0 0 5px #15171d, 0 60px 120px rgba(0,0,0,.7), 0 0 80px rgba(110,139,255,.18)`,
        overflow: 'hidden',
      }}
    >
      {side === 'back' ? (
        <>
          <div style={{position: 'absolute', left: 34, top: 34, width: 170, height: 170, borderRadius: 44, background: 'linear-gradient(150deg,#323847,#16181f)', boxShadow: 'inset 0 0 0 2px #444b5c, 0 10px 20px rgba(0,0,0,.5)'}}>
            {[
              [22, 22],
              [92, 92],
            ].map(([x, y]) => (
              <div key={x} style={{position: 'absolute', left: x, top: y, width: 58, height: 58, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #5f7cff 0%, #1a2350 30%, #05060a 62%)', boxShadow: '0 0 0 6px #22262f, 0 0 0 8px #4a5163'}} />
            ))}
            <div style={{position: 'absolute', left: 112, top: 34, width: 18, height: 18, borderRadius: '50%', background: '#f5e9c8', boxShadow: '0 0 8px #f5e9c8'}} />
          </div>
          <div style={{position: 'absolute', bottom: 70, width: '100%', textAlign: 'center', fontFamily: F.readex, fontWeight: 500, fontSize: 30, color: '#59607a', direction: 'rtl'}}>لَمحة</div>
        </>
      ) : (
        <div style={{position: 'absolute', inset: 14, borderRadius: 52, overflow: 'hidden', background: '#000'}}>
          {screen && <Img src={img(screen)} style={{width: '100%', height: '100%', objectFit: 'cover', opacity: screenOn}} />}
          <div style={{position: 'absolute', top: 18, left: '50%', marginLeft: -50, width: 100, height: 30, borderRadius: 15, background: '#000'}} />
        </div>
      )}
      {sweep > -1 && (
        <div style={{position: 'absolute', inset: -200, background: `linear-gradient(115deg, transparent ${sweep * 100 - 12}%, rgba(255,255,255,.28) ${sweep * 100}%, transparent ${sweep * 100 + 12}%)`, mixBlendMode: 'screen'}} />
      )}
    </div>
  </div>
);

const Label: React.FC<{at: number; until: number; t: string}> = ({at, until, t}) => {
  const s = useSec();
  const o = vis(s, at, until, 0.2);
  return (
    <div style={{position: 'absolute', right: 120, bottom: 110, direction: 'rtl', opacity: o, transform: `translateX(${(1 - ramp(s, at, at + 0.35, easeOut)) * -30}px)`}}>
      <div style={{fontFamily: F.readex, fontWeight: 500, fontSize: 46, color: W}}>{t}</div>
      <div style={{width: 80 * ramp(s, at, at + 0.4), height: 3, background: BLUE, marginTop: 8}} />
    </div>
  );
};

export const Commercial: React.FC = () => {
  const s = useSec();
  const studio = ramp(s, 172.86, 173.5); // key light comes on
  const beatK = Math.floor((s - BEAT0) / BEAT);

  return (
    <AbsoluteFill style={{background: '#040406', overflow: 'hidden'}}>
      {/* spotlight */}
      <AbsoluteFill style={{background: `radial-gradient(ellipse 900px 700px at 50% 45%, rgba(70,90,170,${0.35 + studio * 0.25}) 0%, rgba(10,12,22,.0) 70%)`}} />
      <AbsoluteFill style={{background: `linear-gradient(180deg, transparent 70%, rgba(110,139,255,${0.08 + studio * 0.08}) 100%)`}} />

      {/* Title → "it sells" */}
      {s < 168.6 && (
        <AbsoluteFill>
          <Center style={{opacity: vis(s, 165.4, 167.7, 0.25)}}>
            <div style={{textAlign: 'center', transform: `scale(${mix(0.92, 1, ramp(s, 165.45, 166.4, easeOut))})`}}>
              <div style={{fontFamily: F.readex, fontWeight: 700, fontSize: 170, lineHeight: 1.5, padding: '0 20px 30px', color: W, direction: 'rtl', backgroundImage: `linear-gradient(110deg, #9aa3bd 30%, #ffffff ${mix(20, 80, ramp(s, 165.5, 166.6))}%, #9aa3bd 70%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>
                الإعلاني
              </div>
              <div style={{fontFamily: F.readex, fontWeight: 300, fontSize: 30, letterSpacing: 16, color: MUTE}}>COMMERCIAL</div>
              <div style={{fontFamily: F.readex, fontWeight: 300, fontSize: 42, color: MUTE, direction: 'rtl', marginTop: 40, opacity: ramp(s, 166.44, 166.7)}}>هدفه واحد</div>
            </div>
          </Center>
          <Center style={{opacity: vis(s, 167.75, 168.65, 0.12)}}>
            <div style={{fontFamily: F.readex, fontWeight: 700, fontSize: 340, color: W, direction: 'rtl', textShadow: `0 0 60px ${BLUE}`, transform: `scale(${mix(1.4, 1, pop(s, 167.8, {damping: 12}))})`}}>يبيع.</div>
          </Center>
        </AbsoluteFill>
      )}

      {/* Hero */}
      {s >= 168.5 && s < 170.66 && (
        <Center>
          <div style={{transform: `translateY(${(1 - pop(s, 168.54, {damping: 16, stiffness: 80})) * 900}px) scale(.86)`}}>
            <Phone side="back" rotY={mix(-22, 10, ramp(s, 168.5, 170.7, ease))} rotX={6} sweep={ramp(s, 169.8, 170.5, ease) * 1.4 - 0.2} />
          </div>
          <div style={{position: 'absolute', bottom: 50, width: '100%', textAlign: 'center', fontFamily: F.readex, fontWeight: 300, fontSize: 46, color: MUTE, direction: 'rtl', opacity: ramp(s, 169.2, 169.5)}}>
            المنتج هو <span style={{color: W, fontWeight: 700}}>البطل</span>
          </div>
        </Center>
      )}

      {/* Macro details */}
      {s >= 170.66 && s < 172.86 && (
        <AbsoluteFill>
          <Center>
            <div style={{transform: s < 171.58 ? `scale(${mix(3.0, 3.3, ramp(s, 170.66, 171.58, (v) => v))}) translate(80px, 220px)` : `scale(${mix(3.2, 3.5, ramp(s, 171.58, 172.86, (v) => v))}) translate(0px, -300px)`}}>
              <Phone side="back" rotY={0} sweep={s < 171.58 ? ramp(s, 170.7, 171.5) * 1.4 - 0.2 : ramp(s, 171.6, 172.8) * 1.4 - 0.2} />
            </div>
          </Center>
          <Label at={170.66} until={172.85} t="لقطات قريبة… تفاصيل" />
        </AbsoluteFill>
      )}

      {/* Clean light + smooth move */}
      {s >= 172.86 && s < 175.14 && (
        <AbsoluteFill>
          <Center>
            <Phone side="back" rotY={mix(-25, 25, ramp(s, 173.6, 175.14, ease))} rotX={4} sweep={ramp(s, 172.9, 173.6) * 1.4 - 0.2} />
          </Center>
          {/* softbox */}
          <div style={{position: 'absolute', left: 1320, top: 120, width: 360, height: 220, borderRadius: 18, background: 'linear-gradient(#fff,#cfd8ff)', opacity: 0.9 * studio, filter: 'blur(1px)', boxShadow: `0 0 120px rgba(200,215,255,${studio})`}} />
          <Label at={172.86} until={173.98} t="إضاءة نظيفة" />
          <Label at={174.0} until={175.12} t="حركة سلسة" />
        </AbsoluteFill>
      )}

      {/* Cuts on the music */}
      {s >= 175.14 && s < 177.0 && (
        <AbsoluteFill>
          <Center>
            {(() => {
              const k = ((beatK % 3) + 3) % 3;
              const views = [
                {sc: 1.0, rx: 4, ry: -18, rz: 0, tx: 0, ty: 0},
                {sc: 2.4, rx: 0, ry: 8, rz: -10, tx: 90, ty: 230},
                {sc: 0.9, rx: 35, ry: 0, rz: 24, tx: 0, ty: 0},
              ][k];
              return (
                <div style={{transform: `scale(${views.sc}) rotateZ(${views.rz}deg) translate(${views.tx}px, ${views.ty}px)`}}>
                  <Phone side="back" rotX={views.rx} rotY={views.ry} />
                </div>
              );
            })()}
          </Center>
          <div style={{position: 'absolute', left: 120, bottom: 120, display: 'flex', gap: 14}}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{width: 18, height: 18, borderRadius: '50%', background: (beatK % 4) === i ? BLUE : '#2a2f45'}} />
            ))}
          </div>
          <Label at={175.14} until={176.98} t="قصات ماشية مع الموسيقى" />
        </AbsoluteFill>
      )}

      {/* Logo + call to action */}
      {s >= 177.0 && s < 180.5 && (
        <AbsoluteFill>
          <Center style={{flexDirection: 'column', gap: 30}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 22, direction: 'rtl', opacity: ramp(s, 177.8, 178.1), transform: `scale(${mix(0.9, 1, ramp(s, 177.8, 178.5, easeOut))})`}}>
              <div style={{width: 74, height: 74, borderRadius: 22, background: `linear-gradient(135deg, ${BLUE}, #b3c1ff)`, boxShadow: `0 0 40px ${BLUE}`}} />
              <div style={{fontFamily: F.readex, fontWeight: 700, fontSize: 150, color: W}}>لَمحة</div>
            </div>
            <div style={{fontFamily: F.readex, fontWeight: 300, fontSize: 34, color: MUTE, direction: 'rtl', opacity: ramp(s, 178.2, 178.5)}}>كل لحظة… تستاهل صورة</div>
            <div
              style={{
                marginTop: 30,
                padding: '18px 70px',
                borderRadius: 60,
                background: s > 179.9 && s < 180.15 ? '#c8d2ff' : W,
                color: '#0a0b10',
                fontFamily: F.readex,
                fontWeight: 700,
                fontSize: 52,
                direction: 'rtl',
                transform: `scale(${(s > 179.9 && s < 180.15 ? 0.94 : 1) * pop(s, 179.3, {damping: 12})})`,
                boxShadow: `0 0 50px rgba(110,139,255,.5)`,
              }}
            >
              اطلب الحين
            </div>
          </Center>
        </AbsoluteFill>
      )}

      {/* Don't sell specs, sell the feeling */}
      {s >= 180.5 && s < 184.28 && (
        <AbsoluteFill>
          <AbsoluteFill style={{opacity: ramp(s, 183.0, 183.4)}}>
            <Img src={img('desert-boy')} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', transform: `scale(${mix(1.0, 1.08, ramp(s, 183, 184.3, (v) => v))})`}} />
            <AbsoluteFill style={{background: 'linear-gradient(transparent 50%, rgba(0,0,0,.55))'}} />
          </AbsoluteFill>
          <div style={{position: 'absolute', top: 260, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26, opacity: 1 - ramp(s, 182.9, 183.2)}}>
            {['108MP  كاميرا', '5000mAh  بطارية', '256GB  تخزين'].map((t, i) => (
              <div key={t} style={{position: 'relative', fontFamily: F.mono, fontSize: 64, color: W, direction: 'rtl', opacity: ramp(s, 180.55 + i * 0.12, 180.75 + i * 0.12)}}>
                {t}
                <div style={{position: 'absolute', left: -20, right: -20, top: '52%', height: 6, background: '#FF5A5F', transform: `scaleX(${ramp(s, 181.8 + i * 0.12, 182.1 + i * 0.12)})`, transformOrigin: 'right'}} />
              </div>
            ))}
            <div style={{fontFamily: F.readex, fontWeight: 500, fontSize: 44, color: MUTE, direction: 'rtl', marginTop: 20, opacity: ramp(s, 181.44, 181.7)}}>لا تبيع المواصفات</div>
          </div>
          <Center style={{opacity: ramp(s, 183.1, 183.4)}}>
            <div style={{fontFamily: F.readex, fontWeight: 700, fontSize: 150, color: W, direction: 'rtl', textShadow: '0 6px 40px rgba(0,0,0,.6)'}}>بيع الإحساس</div>
          </Center>
        </AbsoluteFill>
      )}

      {/* People buy the photos */}
      {s >= 184.28 && (
        <AbsoluteFill>
          <Center>
            <Phone side="front" rotY={mix(-8, 8, ramp(s, 184.3, 188, ease))} screen={['desert-boy', 'concert', 'neon', 'skate-smoke'][Math.max(0, Math.floor((s - 185.9) / 0.35)) % 4]} screenOn={ramp(s, 185.88, 186.1)} />
          </Center>
          <div style={{position: 'absolute', top: 90, width: '100%', textAlign: 'center', fontFamily: F.readex, fontWeight: 500, fontSize: 50, color: W, direction: 'rtl'}}>
            <span style={{opacity: ramp(s, 184.3, 184.6)}}>الناس ما تشتري جوال… </span>
            <span style={{color: BLUE, fontWeight: 700, opacity: ramp(s, 185.9, 186.2)}}>تشتري الصور</span>
          </div>
          {[
            {n: 'concert', x: 300, y: 260, r: -8},
            {n: 'neon', x: 1330, y: 300, r: 7},
            {n: 'dune-sunset', x: 360, y: 640, r: 5},
            {n: 'skate-stairs', x: 1290, y: 660, r: -6},
          ].map((c, i) => {
            const p = pop(s, 186.6 + i * 0.12, {damping: 13});
            return (
              <div key={c.n} style={{position: 'absolute', left: mix(810, c.x, p), top: mix(400, c.y, p), width: 300, height: 200, transform: `rotate(${c.r * p}deg) scale(${mix(0.3, 1, p)})`, opacity: s < 186.6 + i * 0.12 ? 0 : 1, border: '8px solid #fff', boxShadow: '0 20px 40px rgba(0,0,0,.6)'}}>
                <Img src={img(c.n)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
              </div>
            );
          })}
        </AbsoluteFill>
      )}

      <ChapterTag n={7} en="COMMERCIAL" color={MUTE} at={165.7} />
    </AbsoluteFill>
  );
};
