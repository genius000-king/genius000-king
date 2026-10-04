import React from 'react';
import {AbsoluteFill, random} from 'remotion';
import {ChapterTag} from '../components/common';
import {Phone3D, drawCover, useScreenImages} from '../components/Phone3D';
import {Art} from '../art';
import {F} from '../fonts';
import {Center, ease, easeOut, mix, pop, ramp, useSec} from '../lib';
import {WORDS} from '../words';

const YEL = '#FFE600';
const RED = '#FF2D2D';
const INK = '#0A0A0A';

export const BEAT = 0.5;
export const BEAT0 = 118.92; // music grid (scripts/make-soundtrack.py FAST0)

const PHOTOS = ['skate-stairs', 'concert', 'sneakers-splash', 'neon-alley', 'skate-park', 'concert-blue', 'sneakers-jump', 'skate-smoke', 'soup-color', 'neon', 'desert-boy', 'camera'];
const IMPACTS = [119.68, 123.64, 124.76, 125.38, 126.12, 126.68, 126.84, 131.14, 132.34, 138.6, 140.42, 144.54, 145.36];

const shakeAt = (s: number) => IMPACTS.reduce((acc, t) => (s >= t ? acc + Math.exp(-(s - t) * 9) * 26 : acc), 0);
const flashAt = (s: number) => IMPACTS.reduce((acc, t) => Math.max(acc, s >= t && s < t + 0.07 ? 1 - (s - t) / 0.07 : 0), 0);

const Cuts: React.FC<{a: number; b: number; every: number; offset?: number; zoom?: boolean}> = ({a, b, every, offset = 0, zoom = true}) => {
  const s = useSec();
  if (s < a || s >= b) return null;
  const k = Math.floor((s - a) / every);
  const name = PHOTOS[(k + offset) % PHOTOS.length];
  const local = (s - a - k * every) / every;
  const z = zoom ? mix(1.18, 1.05, easeOut(Math.min(1, local * 2))) : 1.05;
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Art name={name} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${z}) rotate(${(random(`r${k}`) - 0.5) * 3}deg)`, filter: 'saturate(1.3) contrast(1.1)'}} />
    </AbsoluteFill>
  );
};

/** TikTok-style captions: pages of up to 3 words, the current one boxed in yellow. */
const Captions: React.FC<{a: number; b: number; y?: number}> = ({a, b, y = 860}) => {
  const s = useSec();
  if (s < a || s >= b) return null;
  const words = WORDS.filter((w) => w.s >= a - 0.01 && w.s < b);
  const cur = words.findIndex((w, i) => s >= w.s && (i === words.length - 1 || s < words[i + 1].s));
  if (cur < 0) return null;
  const page = Math.floor(cur / 3);
  const shown = words.slice(page * 3, page * 3 + 3);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', gap: 18, direction: 'rtl'}}>
      {shown.map((w, i) => {
        const idx = page * 3 + i;
        const active = idx === cur;
        const p = pop(s, w.s, {damping: 10, stiffness: 300});
        if (idx > cur) return null;
        return (
          <div
            key={idx}
            style={{
              fontFamily: F.cairo,
              fontWeight: 900,
              fontSize: 76,
              lineHeight: 1.3,
              padding: '0 18px',
              borderRadius: 14,
              color: active ? INK : '#fff',
              background: active ? YEL : 'transparent',
              textShadow: active ? 'none' : '0 0 2px #000, 0 4px 0 #000, 0 0 18px rgba(0,0,0,.8)',
              transform: `scale(${mix(0.6, 1, p)}) rotate(${active ? -2 : 0}deg)`,
            }}
          >
            {w.w}
          </div>
        );
      })}
    </div>
  );
};

const Burst: React.FC<{text: string; at: number; x: number; y: number; color: string; rot: number}> = ({text, at, x, y, color, rot}) => {
  const s = useSec();
  if (s < at) return null;
  const p = pop(s, at, {damping: 8, stiffness: 320});
  const pts = Array.from({length: 24}, (_, i) => {
    const r = i % 2 ? 150 : 230;
    const a = (i / 24) * Math.PI * 2;
    return `${250 + Math.cos(a) * r},${170 + Math.sin(a) * r * 0.62}`;
  }).join(' ');
  return (
    <div style={{position: 'absolute', left: x, top: y, width: 500, height: 340, transform: `rotate(${rot}deg) scale(${p})`}}>
      <svg width={500} height={340} style={{position: 'absolute'}}>
        <polygon points={pts} fill={color} stroke={INK} strokeWidth={8} strokeLinejoin="round" />
      </svg>
      <Center>
        <div style={{fontFamily: F.lalezar, fontSize: 110, color: INK, direction: 'rtl'}}>{text}</div>
      </Center>
    </div>
  );
};

const SpeedLines: React.FC<{color: string; bg: string}> = ({color, bg}) => {
  const s = useSec();
  return (
    <AbsoluteFill
      style={{
        background: `repeating-linear-gradient(-60deg, ${bg} 0 60px, ${color} 60px 74px)`,
        backgroundPosition: `${(s * 1400) % 400}px 0`,
      }}
    />
  );
};

export const Fast: React.FC = () => {
  const s = useSec();
  const feed = useScreenImages(['sneakers-jump', 'skate-stairs']);
  const sh = shakeAt(s);
  const sx = (random(`sx${Math.round(s * 30)}`) - 0.5) * sh;
  const sy = (random(`sy${Math.round(s * 30)}`) - 0.5) * sh;
  const fl = flashAt(s);

  // jump-cut demo timeline (127.48 → 131.9)
  const collapse = ramp(s, 129.42, 129.85, ease);
  const blocks = [
    {w: 230, gap: false},
    {w: 110, gap: true},
    {w: 300, gap: false},
    {w: 140, gap: true},
    {w: 200, gap: false},
    {w: 90, gap: true},
    {w: 260, gap: false},
  ];

  // phone feed (133.38 → 139.3)
  const swipe = ramp(s, 138.3, 138.75, ease);
  const timer = Math.min(2, Math.max(0, (s - 135.02) * (2 / 1.36)));

  // chaos (144.54 →)
  const chaos = s >= 144.54;

  return (
    <AbsoluteFill style={{background: INK, overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `translate(${sx}px, ${sy}px) ${chaos ? `scale(${1.05 + random(`cz${Math.round(s * 30)}`) * 0.12})` : ''}`}}>
        {/* Title */}
        {s < 120.18 && (
          <AbsoluteFill>
            <SpeedLines color="#1d1d1d" bg={INK} />
            <Center>
              <div style={{textAlign: 'center', direction: 'rtl'}}>
                <div style={{fontFamily: F.cairo, fontWeight: 900, fontSize: 110, color: '#fff', transform: `translateX(${(1 - ramp(s, 119.0, 119.25, easeOut)) * -1400}px)`}}>المونتاج</div>
                <div style={{fontFamily: F.lalezar, fontSize: 280, lineHeight: 1, color: YEL, textShadow: `12px 12px 0 ${RED}`, transform: `skewX(-12deg) scale(${s < 119.68 ? 0 : mix(1.8, 1, pop(s, 119.68, {damping: 9, stiffness: 400}))})`}}>السريع</div>
              </div>
            </Center>
          </AbsoluteFill>
        )}

        {/* Many cuts, one second or less */}
        <Cuts a={120.17} b={123.64} every={BEAT / 2} />
        {s >= 121.68 && s < 123.64 && (
          <div style={{position: 'absolute', left: 80, top: 90, background: YEL, color: INK, fontFamily: F.mono, fontWeight: 700, fontSize: 54, padding: '6px 22px', borderRadius: 10, transform: `rotate(-3deg) scale(${pop(s, 121.68, {damping: 9})})`}}>
            ≤ 1s
          </div>
        )}
        {s >= 120.18 && s < 123.64 && (
          <div style={{position: 'absolute', right: 80, top: 90, fontFamily: F.mono, fontWeight: 700, fontSize: 40, color: '#fff', background: 'rgba(0,0,0,.6)', padding: '4px 16px', borderRadius: 8}}>
            CUT #{String(Math.floor((s - 120.18) / (BEAT / 2)) + 1).padStart(2, '0')}
          </div>
        )}

        {/* Sudden zoom */}
        {s >= 123.64 && s < 124.76 && (
          <AbsoluteFill>
            <Art name={'skate-smoke'} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 40%', transform: `scale(${mix(1.0, 1.7, ramp(s, 123.64, 123.74, easeOut))})`}} />
            <Burst text="زووم!" at={123.7} x={1250} y={120} color={YEL} rot={-8} />
          </AbsoluteFill>
        )}
        {/* Sound effects */}
        {s >= 124.76 && s < 126.12 && (
          <AbsoluteFill>
            <Art name={'concert'} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${s < 125.38 ? 1.05 : 1.25})`, filter: 'saturate(1.4)'}} />
            <Burst text="ووش!" at={124.76} x={140} y={160} color="#7FD7FF" rot={-10} />
            <Burst text="بوم!" at={125.38} x={1220} y={420} color={RED} rot={9} />
          </AbsoluteFill>
        )}
        {/* Text on screen */}
        {s >= 126.12 && s < 127.48 && (
          <AbsoluteFill style={{background: YEL}}>
            {[
              {t: 'نصوص', at: 126.12, x: 1080, y: 120, size: 260, c: INK, r: -4},
              {t: 'على', at: 126.68, x: 760, y: 470, size: 150, c: RED, r: 6},
              {t: 'الشاشة', at: 126.84, x: 180, y: 560, size: 240, c: INK, r: -3},
            ].map((w) => (
              <div key={w.t} style={{position: 'absolute', left: w.x, top: w.y, fontFamily: F.lalezar, fontSize: w.size, color: w.c, transform: `rotate(${w.r}deg) scale(${s < w.at ? 0 : mix(2, 1, pop(s, w.at, {damping: 9, stiffness: 400}))})`}}>
                {w.t}
              </div>
            ))}
          </AbsoluteFill>
        )}
        {/* Jump cut */}
        {s >= 127.48 && s < 132.34 && (
          <AbsoluteFill style={{background: '#141414'}}>
            <div style={{position: 'absolute', left: 560, top: 70, width: 800, height: 450, overflow: 'hidden', borderRadius: 18, border: '4px solid #fff'}}>
              {(() => {
                const k = s < 129.42 ? 0 : Math.floor((s - 129.42) / 0.45) % 3;
                return <Art name={'interview'} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 28%', transform: `scale(${[1, 1.22, 1.08][k]}) translateX(${[0, -30, 20][k]}px)`}} />;
              })()}
            </div>
            <div style={{position: 'absolute', left: 160, top: 610, width: 1600, height: 150, background: '#1f1f1f', borderRadius: 14, padding: '20px 30px', boxSizing: 'border-box', display: 'flex', direction: 'rtl', gap: 0}}>
              {blocks.map((b, i) => {
                const w = b.gap ? b.w * (1 - collapse) : b.w;
                return (
                  <div
                    key={i}
                    style={{
                      width: w,
                      height: 110,
                      flexShrink: 0,
                      borderRadius: 10,
                      background: b.gap ? 'repeating-linear-gradient(45deg, #333 0 10px, #2a2a2a 10px 20px)' : YEL,
                      opacity: b.gap ? 1 - collapse : 1,
                      border: b.gap ? `3px dashed ${RED}` : `3px solid ${INK}`,
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: F.cairo,
                      fontWeight: 700,
                      fontSize: 30,
                      color: b.gap ? RED : INK,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {b.gap ? (w > 60 ? 'سكتة' : '') : 'كلام'}
                  </div>
                );
              })}
            </div>
            <div style={{position: 'absolute', top: 800, width: '100%', textAlign: 'center', fontFamily: F.cairo, fontWeight: 900, fontSize: 56, color: '#fff', direction: 'rtl', opacity: ramp(s, 128.1, 128.4)}}>
              السكتات اللي بين الكلام… <span style={{color: RED, opacity: ramp(s, 129.4, 129.6)}}>تنحذف</span>
            </div>
            {s >= 130.9 && (
              <Center style={{background: `rgba(10,10,10,${0.6 * ramp(s, 130.9, 131.1)})`}}>
                <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 200, color: YEL, letterSpacing: 6, transform: `skewX(-8deg) scale(${mix(2, 1, pop(s, 131.14, {damping: 9, stiffness: 400}))})`, textShadow: `10px 10px 0 ${RED}`}}>
                  JUMP CUT
                </div>
              </Center>
            )}
          </AbsoluteFill>
        )}
        {/* Why? */}
        {s >= 132.34 && s < 133.38 && (
          <AbsoluteFill style={{background: RED}}>
            <Center>
              <div style={{fontFamily: F.lalezar, fontSize: 420, color: '#fff', transform: `rotate(${mix(-25, -4, pop(s, 132.34, {damping: 8}))}deg) scale(${mix(0.3, 1, pop(s, 132.34, {damping: 8, stiffness: 300}))})`}}>ليش؟</div>
            </Center>
          </AbsoluteFill>
        )}
        {/* Short-video feed */}
        {s >= 133.38 && s < 139.42 && (
          <AbsoluteFill style={{background: '#111'}}>
            <SpeedLines color="#171717" bg="#111" />
            <Phone3D
              rot={[0, 0, 0]}
              pos={[0, 2.6, 0]}
              camZ={47.7}
              scale={pop(s, 133.38, {damping: 13})}
              studio={0.6}
              rim="#FFE600"
              paint={(ctx, w, h) => {
                if (!feed) return;
                drawCover(ctx, feed['sneakers-jump'], w, h, -swipe);
                drawCover(ctx, feed['skate-stairs'], w, h, 1 - swipe);
                // side actions + progress, like a short-video app
                const u = w / 100;
                for (let i = 0; i < 3; i++) {
                  ctx.fillStyle = 'rgba(255,255,255,.9)';
                  ctx.beginPath();
                  ctx.arc(w - 10 * u, h * 0.55 + i * 14 * u, 4.6 * u, 0, Math.PI * 2);
                  ctx.fill();
                }
                ctx.fillStyle = 'rgba(0,0,0,.35)';
                ctx.fillRect(0, 0, w, 1.2 * u);
                ctx.fillStyle = YEL;
                ctx.fillRect(0, 0, (w * timer) / 2, 1.2 * u);
              }}
            />
            <div style={{position: 'absolute', right: 140, top: 230, textAlign: 'center', direction: 'rtl', opacity: ramp(s, 133.8, 134.0)}}>
              <div style={{fontFamily: F.cairo, fontWeight: 900, fontSize: 72, color: '#fff'}}>تيك توك</div>
              <div style={{fontFamily: F.cairo, fontWeight: 900, fontSize: 72, color: '#fff', opacity: ramp(s, 134.28, 134.45)}}>والريلز</div>
            </div>
            <div style={{position: 'absolute', left: 150, top: 200, textAlign: 'center', opacity: ramp(s, 135.0, 135.2)}}>
              <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 150, color: timer >= 2 ? RED : YEL}}>{timer.toFixed(2)}</div>
              <div style={{fontFamily: F.cairo, fontWeight: 900, fontSize: 54, color: '#fff', direction: 'rtl'}}>أول ثانيتين</div>
            </div>
            {s >= 137.78 && (
              <div style={{position: 'absolute', right: 230, top: 500, background: '#2ECC71', color: INK, fontFamily: F.cairo, fontWeight: 900, fontSize: 56, padding: '4px 30px', borderRadius: 16, transform: `rotate(-4deg) scale(${pop(s, 137.78, {damping: 9})})`, direction: 'rtl'}}>
                يكمل ✓
              </div>
            )}
            {s >= 138.26 && (
              <div style={{position: 'absolute', left: 230, top: 520, background: RED, color: '#fff', fontFamily: F.cairo, fontWeight: 900, fontSize: 56, padding: '4px 30px', borderRadius: 16, transform: `rotate(4deg) scale(${pop(s, 138.26, {damping: 9})})`, direction: 'rtl'}}>
                ولا يسحب ↑
              </div>
            )}
          </AbsoluteFill>
        )}
        {/* On the beat */}
        {s >= 139.42 && s < 144.54 && (
          <AbsoluteFill style={{background: INK}}>
            {s < 140.42 ? (
              <Center>
                <div style={{textAlign: 'center', transform: `scale(${pop(s, 139.42, {damping: 9})})`}}>
                  <svg width={260} height={230} viewBox="0 0 100 90">
                    <path d="M50 6 L96 86 L4 86 Z" fill={YEL} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
                    <rect x={46} y={32} width={8} height={30} rx={3} fill={INK} />
                    <circle cx={50} cy={72} r={5} fill={INK} />
                  </svg>
                  <div style={{fontFamily: F.lalezar, fontSize: 130, color: YEL}}>انتبه</div>
                </div>
              </Center>
            ) : (
              <>
                <div style={{position: 'absolute', left: 160, top: 90, width: 1600, height: 560, borderRadius: 20, overflow: 'hidden'}}>
                  <Cuts a={140.42} b={144.54} every={BEAT} offset={3} zoom />
                </div>
                {/* beat ruler */}
                <div style={{position: 'absolute', left: 160, top: 700, width: 1600, height: 110, direction: 'ltr'}}>
                  {Array.from({length: 17}, (_, i) => {
                    const t = 140.42 + i * BEAT;
                    const hit = s >= t ? Math.exp(-(s - t) * 8) : 0;
                    const x = 1600 - ((t - s) / 4 + 0.5) * 1600;
                    return (
                      <div key={i} style={{position: 'absolute', left: x - 18, top: 30 - hit * 10, width: 36, height: 36, borderRadius: '50%', background: s >= t ? YEL : '#333', transform: `scale(${1 + hit})`}} />
                    );
                  })}
                  <div style={{position: 'absolute', left: 799, top: 0, width: 3, height: 110, background: RED}} />
                </div>
                <div style={{position: 'absolute', top: 860, width: '100%', textAlign: 'center', fontFamily: F.cairo, fontWeight: 900, fontSize: 58, color: '#fff', direction: 'rtl'}}>
                  القص <span style={{color: YEL}}>على الإيقاع</span>
                  <span style={{opacity: ramp(s, 142.3, 142.5)}}> · وكل قصة <span style={{color: YEL}}>تضيف شي</span></span>
                </div>
              </>
            )}
          </AbsoluteFill>
        )}
        {/* Chaos */}
        {chaos && (
          <AbsoluteFill>
            <Cuts a={144.54} b={146.4} every={1 / 15} offset={5} zoom={false} />
            <AbsoluteFill style={{mixBlendMode: 'screen', background: 'rgba(255,0,0,.25)', transform: `translateX(${(random(`ch${Math.round(s * 30)}`) - 0.5) * 60}px)`}} />
            <Center>
              <div style={{fontFamily: F.lalezar, fontSize: 300, color: RED, textShadow: `${(random(`t1${Math.round(s * 30)}`) - 0.5) * 30}px 0 0 #00E5FF, 0 0 40px #000`, transform: `rotate(${(random(`t2${Math.round(s * 30)}`) - 0.5) * 16}deg)`, opacity: s >= 145.36 ? 1 : 0}}>
                إزعاج!
              </div>
            </Center>
          </AbsoluteFill>
        )}

        <Captions a={120.18} b={123.6} />
        <Captions a={133.38} b={139.4} y={880} />
      </AbsoluteFill>
      <AbsoluteFill style={{background: '#fff', opacity: fl * 0.7, pointerEvents: 'none'}} />
      <ChapterTag n={5} en="FAST-PACED" color={YEL} at={119.3} />
    </AbsoluteFill>
  );
};
