import React from 'react';
import {AbsoluteFill, random, useCurrentFrame} from 'remotion';
import {Grain, Vignette} from '../components/common';
import {STYLES, StyleTile, TileFrame} from '../components/StyleTile';
import {Art} from '../art';
import {F} from '../fonts';
import {Center, ar, easeOut, mix, pop, ramp, useSec, vis} from '../lib';

const CREAM = '#EDE6D6';

/** Old-cinema flicker, gate weave and scratches. */
const SilentFilm: React.FC<{children: React.ReactNode}> = ({children}) => {
  const frame = useCurrentFrame();
  const flicker = 0.92 + random(`fl${frame}`) * 0.1;
  const wx = (random(`wx${Math.floor(frame / 2)}`) - 0.5) * 3;
  const wy = (random(`wy${Math.floor(frame / 2)}`) - 0.5) * 3;
  const scratchX = random(`sx${Math.floor(frame / 3)}`) * 1920;
  const showScratch = random(`ss${Math.floor(frame / 3)}`) > 0.55;
  return (
    <AbsoluteFill style={{background: '#0a0a0a'}}>
      <AbsoluteFill style={{transform: `translate(${wx}px, ${wy}px)`, filter: `brightness(${flicker})`}}>{children}</AbsoluteFill>
      {showScratch && <div style={{position: 'absolute', left: scratchX, top: 0, bottom: 0, width: 2, background: 'rgba(255,255,255,.25)'}} />}
      <Grain opacity={0.22} />
      <Vignette strength={0.75} />
    </AbsoluteFill>
  );
};

const Intertitle: React.FC<{children: React.ReactNode; o: number}> = ({children, o}) => (
  <Center style={{opacity: o}}>
    <div
      style={{
        width: 1300,
        height: 640,
        border: `3px solid ${CREAM}`,
        outline: `1px solid ${CREAM}`,
        outlineOffset: 14,
        borderRadius: 26,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        color: CREAM,
        direction: 'rtl',
      }}
    >
      {children}
    </div>
  </Center>
);

const FilmFrame: React.FC<{photo: string; w: number; h: number; pos?: string; glow?: number; bright?: number}> = ({photo, w, h, pos = 'center', glow = 0, bright = 0.95}) => (
  <div
    style={{
      width: w,
      height: h,
      background: '#000',
      padding: '10px 34px',
      boxSizing: 'content-box',
      position: 'relative',
      boxShadow: glow ? `0 0 0 ${4 * glow}px #E8C07D, 0 0 40px rgba(232,192,125,${0.5 * glow})` : 'none',
    }}
  >
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <React.Fragment key={i}>
        <div style={{position: 'absolute', left: 9, top: 14 + i * (h / 6), width: 16, height: 22, borderRadius: 4, background: '#2a2a2a'}} />
        <div style={{position: 'absolute', right: 9, top: 14 + i * (h / 6), width: 16, height: 22, borderRadius: 4, background: '#2a2a2a'}} />
      </React.Fragment>
    ))}
    <div style={{width: w, height: h, overflow: 'hidden'}}>
      <Art name={photo} style={{width: w, height: h, objectFit: 'cover', objectPosition: pos, filter: `grayscale(1) contrast(1.15) brightness(${bright})`}} />
    </div>
  </div>
);

export const Intro: React.FC = () => {
  const s = useSec();

  // 1) Intertitles
  const t1 = vis(s, 0.05, 1.62, 0.3);
  const t2 = vis(s, 1.68, 4.62, 0.3);

  // 2) Kuleshov experiment
  const expO = vis(s, 4.7, 17.3, 0.3);
  const single = 1 - ramp(s, 8.5, 9.2); // face alone, centered
  const p1 = pop(s, 9.42);
  const r2 = pop(s, 10.2);
  const p2 = pop(s, 10.86);
  const hungry = pop(s, 13.62);
  const sad = pop(s, 15.02);
  const same = ramp(s, 16.3, 16.7);

  // 3) Definition
  const defO = vis(s, 17.38, 23.85, 0.25);
  const title = pop(s, 18.18, {damping: 11});
  const cut = ramp(s, 19.46, 19.7, easeOut) * (1 - ramp(s, 20.1, 20.5, easeOut));
  const order = pop(s, 20.38, {damping: 16});
  const meaning = pop(s, 21.34);

  // 4) Eight styles grid
  const gridO = ramp(s, 23.9, 24.1);
  const zoom = ramp(s, 26.45, 26.8, (v) => v * v * v);

  const faceW = 460;
  const faceH = 300;

  return (
    <AbsoluteFill style={{background: '#0a0a0a'}}>
      {s < 17.4 && (
        <SilentFilm>
          <Intertitle o={t1}>
            <div style={{fontFamily: F.amiri, fontSize: 92}}>قبل أكثر من {ar(100)} سنة...</div>
          </Intertitle>
          <Intertitle o={t2}>
            <div style={{fontFamily: F.serif, fontSize: 34, letterSpacing: 10, opacity: ramp(s, 1.7, 2.2)}}>SOVIET CINEMA · 1920s</div>
            <div style={{fontFamily: F.amiri, fontWeight: 700, fontSize: 140, opacity: ramp(s, 2.9, 3.3), transform: `scale(${mix(1.08, 1, ramp(s, 2.9, 3.6))})`}}>
              ليف كوليشوف
            </div>
            <div style={{fontFamily: F.amiri, fontSize: 54, opacity: ramp(s, 4.0, 4.4)}}>وتجربته اللي غيّرت السينما</div>
          </Intertitle>

          <AbsoluteFill style={{opacity: expO}}>
            {/* row 1 face (moves from center to top-right) */}
            <div
              style={{
                position: 'absolute',
                left: mix(960 - faceW / 2 - 34, 1180, 1 - single),
                top: mix(540 - faceH / 2 - 10, 150, 1 - single),
                transform: `scale(${mix(1.35, 1, 1 - single)})`,
              }}
            >
              <FilmFrame photo="face" w={faceW} h={faceH} pos="center 30%" glow={same} />
            </div>
            {single > 0.5 && (
              <div style={{position: 'absolute', top: 800, width: '100%', textAlign: 'center', fontFamily: F.amiri, fontSize: 52, color: CREAM, opacity: ramp(s, 6.5, 6.9) * single, direction: 'rtl'}}>
                وجه... بدون أي تعبير
              </div>
            )}
            {/* row 1 soup */}
            <div style={{position: 'absolute', left: 620, top: 150, opacity: p1, transform: `translateX(${(1 - p1) * -60}px)`}}>
              <FilmFrame photo="soup" w={faceW} h={faceH} />
            </div>
            {/* row 2 face + coffin */}
            <div style={{position: 'absolute', left: 1180, top: 570, opacity: r2, transform: `translateY(${(1 - r2) * 40}px)`}}>
              <FilmFrame photo="face" w={faceW} h={faceH} pos="center 30%" glow={same} />
            </div>
            <div style={{position: 'absolute', left: 620, top: 570, opacity: p2, transform: `translateX(${(1 - p2) * -60}px)`}}>
              <FilmFrame photo="coffin" w={faceW} h={faceH} />
            </div>
            {/* arrows between shots */}
            {[150, 570].map((y, i) => (
              <div key={y} style={{position: 'absolute', left: 1124, top: y + 150, fontFamily: F.cairo, fontSize: 44, color: CREAM, opacity: i === 0 ? p1 : p2}}>←</div>
            ))}
            {/* audience reading */}
            <div style={{position: 'absolute', left: 90, top: 210, width: 470, textAlign: 'center', direction: 'rtl', opacity: hungry, transform: `scale(${mix(0.8, 1, hungry)})`}}>
              <div style={{fontFamily: F.amiri, fontSize: 34, color: '#b9b2a2'}}>الجمهور:</div>
              <div style={{fontFamily: F.amiri, fontWeight: 700, fontSize: 96, color: CREAM}}>«جوعان»</div>
            </div>
            <div style={{position: 'absolute', left: 90, top: 630, width: 470, textAlign: 'center', direction: 'rtl', opacity: sad, transform: `scale(${mix(0.8, 1, sad)})`}}>
              <div style={{fontFamily: F.amiri, fontSize: 34, color: '#b9b2a2'}}>الجمهور:</div>
              <div style={{fontFamily: F.amiri, fontWeight: 700, fontSize: 96, color: CREAM}}>«حزين»</div>
            </div>
            {/* same shot marker */}
            <div style={{position: 'absolute', left: 1180, top: 486, width: faceW + 68, textAlign: 'center', opacity: same, fontFamily: F.amiri, fontWeight: 700, fontSize: 50, color: '#E8C07D', direction: 'rtl'}}>
              = نفس اللقطة!
            </div>
          </AbsoluteFill>
        </SilentFilm>
      )}

      {/* Definition */}
      {s >= 17.3 && s < 23.9 && (
        <AbsoluteFill style={{opacity: defO, background: '#0d0d0d'}}>
          <div style={{position: 'absolute', top: 110, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
            <div style={{position: 'relative', direction: 'rtl'}}>
              {/* top and bottom halves split by the cut */}
              {[0, 1].map((half) => (
                <div
                  key={half}
                  style={{
                    position: half ? 'absolute' : 'relative',
                    top: 0,
                    fontFamily: F.cairo,
                    fontWeight: 900,
                    fontSize: 170,
                    color: CREAM,
                    transform: `scale(${title}) translate(${(half ? 1 : -1) * cut * 16}px, ${(half ? 1 : -1) * cut * 4}px)`,
                    clipPath: half ? 'polygon(0 58%, 100% 42%, 100% 100%, 0 100%)' : 'polygon(0 0, 100% 0, 100% 42%, 0 58%)',
                  }}
                >
                  المونتاج
                </div>
              ))}
              <div
                style={{
                  position: 'absolute',
                  left: -60,
                  right: -60,
                  top: '50%',
                  height: 3,
                  background: '#E8C07D',
                  transform: `rotate(-4deg) scaleX(${ramp(s, 19.4, 19.6)})`,
                  transformOrigin: 'right',
                  opacity: 1 - ramp(s, 19.9, 20.2),
                }}
              />
            </div>
          </div>
          <div style={{position: 'absolute', top: 400, width: '100%', textAlign: 'center', fontFamily: F.serif, fontSize: 30, letterSpacing: 14, color: '#8f887a', opacity: title}}>
            MONTAGE
          </div>
          {/* three shots that get re-ordered */}
          {(['coffin', 'face', 'soup'] as const).map((p, i) => {
            const target = p === 'face' ? 2 : p === 'soup' ? 1 : 0; // face → soup → (coffin), read right-to-left
            const slot = mix(i, target, order);
            const appear = pop(s, 19.75 + i * 0.12);
            return (
              <div
                key={p}
                style={{
                  position: 'absolute',
                  top: 450,
                  left: 180 + slot * 540,
                  opacity: appear,
                  transform: `translateY(${(1 - appear) * 40}px) translateY(${Math.sin(order * Math.PI) * (p === 'face' ? -60 : 30)}px)`,
                }}
              >
                <Art name={p} style={{width: 480, height: 300, objectFit: 'cover', objectPosition: p === 'face' ? 'center 30%' : 'center', filter: 'grayscale(1) contrast(1.1)', border: `4px solid ${CREAM}`}} />
              </div>
            );
          })}
          <div style={{position: 'absolute', top: 800, width: '100%', textAlign: 'center', direction: 'rtl', opacity: meaning, transform: `translateY(${(1 - meaning) * 20}px)`}}>
            <span style={{fontFamily: F.cairo, fontWeight: 700, fontSize: 64, color: CREAM}}>الترتيب </span>
            <span style={{fontFamily: F.cairo, fontWeight: 400, fontSize: 64, color: '#8f887a'}}>هو اللي </span>
            <span style={{fontFamily: F.cairo, fontWeight: 900, fontSize: 64, color: '#E8C07D', opacity: ramp(s, 22.6, 22.9)}}>يصنع المعنى</span>
          </div>
        </AbsoluteFill>
      )}

      {/* The eight styles */}
      {s >= 23.85 && (
        <AbsoluteFill style={{opacity: gridO, background: '#0d0d0d'}}>
          <div style={{position: 'absolute', top: 120, width: '100%', textAlign: 'center', fontFamily: F.cairo, fontWeight: 900, fontSize: 64, color: CREAM, direction: 'rtl', opacity: 1 - zoom}}>
            أشهر <span style={{color: '#E8C07D'}}>{ar(8)}</span> أساليب
          </div>
          {STYLES.map((st, i) => {
            const col = 3 - (i % 4); // right-to-left
            const row = Math.floor(i / 4);
            const a = pop(s, 24.2 + i * 0.2, {damping: 15});
            const x = 102 + col * 436;
            const y = 300 + row * 258;
            const isFirst = i === 0;
            const sc = isFirst ? mix(0.85, 4, zoom) : 0.85;
            const tx = isFirst ? mix(x, 0, zoom) : x;
            const ty = isFirst ? mix(y, 0, zoom) : y;
            return (
              <div
                key={st.id}
                style={{
                  position: 'absolute',
                  left: tx,
                  top: ty,
                  opacity: isFirst ? a : a * (1 - zoom),
                  transform: `translateY(${(1 - a) * 30}px)`,
                  zIndex: isFirst ? 2 : 1,
                }}
              >
                <TileFrame scale={sc}>
                  <StyleTile id={st.id} label={!isFirst || zoom < 0.3} />
                </TileFrame>
              </div>
            );
          })}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
