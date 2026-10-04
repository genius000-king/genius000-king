import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ChapterTag, Cutout, Tape, tex, tornClip} from '../components/common';
import {F} from '../fonts';
import {ease, jitter, mix, pop, ramp, useSec} from '../lib';

const INK = '#2B1D12';

/** Places a child with stop-motion jitter and a "slap" entrance at `at`. */
const Piece: React.FC<{
  id: string;
  at: number;
  x: number;
  y: number;
  rot: number;
  wobble: number;
  z?: number;
  move?: {from: [number, number, number, number]; a: number; b: number};
  children: React.ReactNode;
}> = ({id, at, x, y, rot, wobble, z = 1, move, children}) => {
  const s = useSec();
  const p = pop(s, at, {damping: 12, stiffness: 220});
  let X = x;
  let Y = y;
  let R = rot;
  let S = mix(1.25, 1, p);
  if (move) {
    const t = ramp(s, move.a, move.b, ease);
    X = mix(move.from[0], x, t);
    Y = mix(move.from[1], y, t);
    R = mix(move.from[2], rot, t);
    S = mix(move.from[3], 1, t);
  }
  return (
    <div
      style={{
        position: 'absolute',
        left: X + jitter(`${id}x`, s, wobble),
        top: Y + jitter(`${id}y`, s, wobble),
        transform: `rotate(${R + jitter(`${id}r`, s, wobble * 0.4)}deg) scale(${S})`,
        opacity: s < at ? 0 : Math.min(1, p * 3),
        zIndex: z,
      }}
    >
      {children}
    </div>
  );
};

const Dymo: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div
    style={{
      background: 'linear-gradient(#1d1d1d, #0b0b0b)',
      color: '#f2f2f2',
      fontFamily: F.cairo,
      fontWeight: 700,
      fontSize: 34,
      padding: '2px 22px 6px',
      borderRadius: 6,
      direction: 'rtl',
      boxShadow: '0 3px 6px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.15)',
      textShadow: '0 1px 0 rgba(0,0,0,.8), 0 -1px 0 rgba(255,255,255,.25)',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </div>
);

const TornPaper: React.FC<{seed: string; w: number; h: number; color: string}> = ({seed, w, h, color}) => (
  <div style={{filter: 'drop-shadow(3px 5px 4px rgba(0,0,0,.3))'}}>
    <div style={{width: w, height: h, background: color, clipPath: tornClip(seed, 3, 12), backgroundImage: `url(${tex('paper.jpg')})`, backgroundBlendMode: 'multiply', backgroundSize: 'cover'}} />
  </div>
);

const Clipping: React.FC = () => (
  <Cutout seed="news" w={430} h={300} border={0} paper="#ece6d6">
    <div style={{padding: '20px 26px', direction: 'rtl', color: '#222', height: '100%', boxSizing: 'border-box'}}>
      <div style={{fontFamily: F.amiri, fontWeight: 700, fontSize: 40, lineHeight: 1.1, borderBottom: '2px solid #222', paddingBottom: 6}}>قص… لزق… حكاية</div>
      <div style={{fontFamily: F.amiri, fontSize: 21, lineHeight: 1.55, marginTop: 10, textAlign: 'justify', color: '#3a3a3a'}}>
        الكولاج فن قديم بدأ بالمقص والصمغ، وانتقل للشاشة: صور وأوراق ونصوص تتجمع فوق بعض، وكل قطعة تحكي جزء من الفكرة.
      </div>
    </div>
  </Cutout>
);

const Icon: React.FC<{kind: 'music' | 'play' | 'cassette'}> = ({kind}) => (
  <svg width={180} height={180} viewBox="0 0 100 100">
    {kind === 'music' && (
      <g fill={INK}>
        <path d="M38 20 L80 12 L80 66 A10 9 0 1 1 72 57 L72 28 L46 33 L46 74 A10 9 0 1 1 38 65 Z" />
      </g>
    )}
    {kind === 'play' && (
      <g>
        <rect x={10} y={22} width={80} height={56} rx={14} fill={INK} />
        <path d="M43 37 L63 50 L43 63 Z" fill="#f4efe4" />
      </g>
    )}
    {kind === 'cassette' && (
      <g fill="none" stroke={INK} strokeWidth={5}>
        <rect x={8} y={22} width={84} height={56} rx={6} />
        <circle cx={34} cy={48} r={8} />
        <circle cx={66} cy={48} r={8} />
        <path d="M24 78 L30 64 L70 64 L76 78" />
      </g>
    )}
  </svg>
);

const Polaroid: React.FC<{kind: 'music' | 'play' | 'cassette'; bg: string; label: string; seed: string}> = ({kind, bg, label, seed}) => (
  <Cutout seed={seed} w={400} h={470} border={0} paper="#f6f2e9">
    <div style={{padding: 22, height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 18}}>
      <div style={{flex: 1, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <Icon kind={kind} />
      </div>
      <div style={{fontFamily: F.lalezar, fontSize: 52, color: INK, textAlign: 'center', direction: 'rtl', lineHeight: 1}}>{label}</div>
    </div>
  </Cutout>
);

/** Arrow drawn like a marker stroke. */
const Marker: React.FC<{d: string; progress: number; color?: string}> = ({d, progress, color = '#111'}) => (
  <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
    <path d={d} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - progress} />
  </svg>
);

export const Collage: React.FC = () => {
  const s = useSec();
  const wob = s > 35.86 ? 3.2 : 0.9; // "وتتحرك حركة بسيطة"
  const layer = ramp(s, 34.56, 35.2); // "طبقات فوق بعض"
  const toBoard = {a: 30.2, b: 30.9};

  const pageC = ramp(s, 37.25, 37.65, ease); // first page turn
  const pageD = ramp(s, 42.3, 42.7, ease); // second page turn

  const shadow = 1 + ramp(s, 44.54, 45.2) * 1.6;

  return (
    <AbsoluteFill style={{backgroundImage: `url(${tex('kraft.jpg')})`, backgroundSize: 'cover'}}>
      {/* --- Page 1: definition board --- */}
      <AbsoluteFill style={{filter: `drop-shadow(0 0 0 transparent)`}}>
        {/* paper scraps behind */}
        <Piece id="py" at={32.26} x={50} y={600} rot={8} wobble={wob}>
          <TornPaper seed="py" w={430} h={330} color="#F5C518" />
        </Piece>
        <Piece id="pb" at={32.4} x={1230} y={120} rot={-9} wobble={wob}>
          <TornPaper seed="pb" w={360} h={260} color="#3B6BFF" />
        </Piece>
        <Piece id="pr" at={32.55} x={850} y={170} rot={16} wobble={wob}>
          <TornPaper seed="pr" w={260} h={220} color="#E63B2E" />
        </Piece>

        {/* photos: camera + desert come from the zoomed tile */}
        <Piece id="cam" at={26.7} x={90} y={200} rot={-6} wobble={wob} z={3} move={{from: [120, 104, -7, 1.42], ...toBoard}}>
          <Cutout seed="cam" w={520} h={360} photo="camera" shadow={1 + layer} />
        </Piece>
        <Piece id="des" at={26.7} x={1260} y={190} rot={5} wobble={wob} z={3} move={{from: [1224, 328, 6, 1.32], ...toBoard}}>
          <Cutout seed="des" w={420} h={510} photo="desert-boy" pos="center 35%" shadow={1 + layer} />
        </Piece>
        <Piece id="neon" at={30.98} x={640} y={310} rot={3} wobble={wob} z={4}>
          <Cutout seed="neon" w={540} h={330} photo="neon" shadow={1 + layer * 1.5} />
        </Piece>
        <Piece id="skate" at={31.3} x={1500} y={600} rot={-6} wobble={wob} z={5}>
          <Cutout seed="sk" w={340} h={440} photo="skate-smoke" shadow={1 + layer * 1.5} />
        </Piece>
        <Piece id="film" at={31.6} x={720} y={670} rot={-4} wobble={wob} z={4}>
          <Cutout seed="film" w={440} h={300} photo="film" shadow={1 + layer} />
        </Piece>
        <Piece id="news" at={32.78} x={110} y={640} rot={-3} wobble={wob} z={5}>
          <Clipping />
        </Piece>

        {/* tape */}
        {[
          {x: 130, y: 180, r: -30, at: 33.46},
          {x: 470, y: 185, r: 28, at: 33.56},
          {x: 1390, y: 170, r: 4, at: 33.66},
          {x: 830, y: 290, r: -6, at: 33.76},
          {x: 250, y: 620, r: 10, at: 33.86},
        ].map((t, i) => (
          <Piece key={i} id={`tape${i}`} at={t.at} x={t.x} y={t.y} rot={t.r} wobble={wob} z={8}>
            <Tape w={170} rot={0} style={{position: 'relative'}} />
          </Piece>
        ))}

        {/* labels */}
        <Piece id="l1" at={31.0} x={780} y={612} rot={-2} wobble={wob} z={9}>
          <Dymo>صور مقصوصة</Dymo>
        </Piece>
        <Piece id="l2" at={32.3} x={330} y={590} rot={3} wobble={wob} z={9}>
          <Dymo>ورق</Dymo>
        </Piece>
        <Piece id="l3" at={32.8} x={170} y={960} rot={-2} wobble={wob} z={9}>
          <Dymo>نصوص</Dymo>
        </Piece>
        <Piece id="l4" at={33.5} x={300} y={140} rot={4} wobble={wob} z={9}>
          <Dymo>شريط لاصق</Dymo>
        </Piece>
        <Piece id="l5" at={34.6} x={1160} y={900} rot={-3} wobble={wob} z={9}>
          <Dymo>طبقات فوق بعض</Dymo>
        </Piece>
        <Piece id="l6" at={35.9} x={1270} y={1000} rot={2} wobble={wob} z={9}>
          <Dymo>وتتحرك… بخفّة</Dymo>
        </Piece>

        {/* title strip */}
        <Piece id="title" at={28.28} x={560} y={340} rot={-3} wobble={wob} z={10} move={{from: [560, 340, -3, 1], a: 30.0, b: 30.6}}>
          <div style={{transform: `translate(${ramp(s, 30.0, 30.6) * 40}px, ${ramp(s, 30.0, 30.6) * -330}px) scale(${mix(1, 0.5, ramp(s, 30.0, 30.6))})`, transformOrigin: 'center'}}>
            <div style={{filter: 'drop-shadow(5px 8px 6px rgba(0,0,0,.4))'}}>
              <div style={{clipPath: tornClip('title', 2, 14), background: '#E63B2E', padding: '0 80px 20px', fontFamily: F.lalezar, fontSize: 210, color: '#fff', direction: 'rtl', lineHeight: 1.25}}>
                الكولاج
              </div>
            </div>
            <div style={{display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12, direction: 'ltr'}}>
              {'COLLAGE'.split('').map((ch, i) => {
                const looks = [
                  {bg: '#111', c: '#fff', f: F.serif},
                  {bg: '#F5C518', c: '#111', f: F.mono},
                  {bg: '#f6f2e9', c: '#E63B2E', f: F.type},
                  {bg: '#3B6BFF', c: '#fff', f: F.cairo},
                ][i % 4];
                const a = pop(s, 28.6 + i * 0.06, {damping: 10});
                return (
                  <div key={i} style={{background: looks.bg, color: looks.c, fontFamily: looks.f, fontWeight: 700, fontSize: 64, width: 74, textAlign: 'center', transform: `rotate(${(i % 2 ? 1 : -1) * (4 + i)}deg) scale(${a})`, boxShadow: '2px 4px 4px rgba(0,0,0,.3)'}}>
                    {ch}
                  </div>
                );
              })}
            </div>
          </div>
        </Piece>
      </AbsoluteFill>

      {/* --- Page 2: where you see it --- */}
      <AbsoluteFill style={{transform: `translateX(${(1 - pageC) * 2100}px)`, zIndex: 20}}>
        <div style={{position: 'absolute', inset: '-20px -20px -20px -40px', clipPath: tornClip('pageC', 1.2, 22), backgroundImage: `url(${tex('kraft.jpg')})`, backgroundSize: 'cover', filter: 'brightness(.93)', boxShadow: '-20px 0 40px rgba(0,0,0,.4)'}} />
        <div style={{position: 'absolute', top: 110, width: '100%', textAlign: 'center', fontFamily: F.lalezar, fontSize: 84, color: INK, direction: 'rtl', opacity: ramp(s, 37.5, 37.9)}}>
          وين تشوفه؟
        </div>
        {[
          {kind: 'music' as const, bg: '#F5C518', label: 'الأغاني', at: 38.66, x: 1260, r: -4},
          {kind: 'play' as const, bg: '#7FB3FF', label: 'المقدمات', at: 39.24, x: 760, r: 3},
          {kind: 'cassette' as const, bg: '#F08A7E', label: 'حنين للماضي', at: 41.36, x: 260, r: -2},
        ].map((c) => (
          <Piece key={c.kind} id={`pol${c.kind}`} at={c.at} x={c.x} y={300} rot={c.r} wobble={wob}>
            <Polaroid kind={c.kind} bg={c.bg} label={c.label} seed={`pol${c.kind}`} />
          </Piece>
        ))}
      </AbsoluteFill>

      {/* --- Page 3: the secret is texture --- */}
      <AbsoluteFill style={{transform: `translateX(${(1 - pageD) * 2100}px)`, zIndex: 30}}>
        <div style={{position: 'absolute', inset: '-20px -20px -20px -40px', clipPath: tornClip('pageD', 1.2, 22), backgroundImage: `url(${tex('kraft.jpg')})`, backgroundSize: 'cover', boxShadow: '-20px 0 40px rgba(0,0,0,.4)'}} />
        <AbsoluteFill style={{transform: `scale(${mix(1, 1.07, ramp(s, 42.6, 49.3, (v) => v))})`}}>
          <div style={{position: 'absolute', left: 420, top: 230, transform: 'rotate(-2deg)', filter: `drop-shadow(${10 * shadow}px ${16 * shadow}px ${10 * shadow}px rgba(0,0,0,${0.25 + 0.12 * shadow}))`}}>
            <div style={{width: 1080, height: 560, clipPath: tornClip('texture', 2.4, 26), backgroundImage: `url(${tex('paper.jpg')})`, backgroundSize: 'cover', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', direction: 'rtl'}}>
              <div style={{fontFamily: F.lalezar, fontSize: 70, color: '#E63B2E', opacity: ramp(s, 42.5, 42.9)}}>السر في</div>
              <div style={{fontFamily: F.lalezar, fontSize: 230, color: INK, lineHeight: 1, opacity: ramp(s, 43.55, 43.8), transform: `scale(${mix(1.15, 1, pop(s, 43.6))})`}}>الملمس</div>
            </div>
          </div>
          {/* annotations */}
          <Marker d="M 1650 900 C 1600 860, 1560 840, 1510 820" progress={ramp(s, 44.6, 45.0)} />
          <div style={{position: 'absolute', left: 1600, top: 900, opacity: ramp(s, 44.7, 45.0)}}>
            <Dymo>الظل</Dymo>
          </div>
          <Marker d="M 300 160 C 360 170, 420 200, 470 236" progress={ramp(s, 45.4, 45.8)} />
          <div style={{position: 'absolute', left: 90, top: 110, opacity: ramp(s, 45.5, 45.8)}}>
            <Dymo>حواف مقطّعة</Dymo>
          </div>
          {/* hand-made stamp */}
          <div
            style={{
              position: 'absolute',
              left: 1180,
              top: 690,
              transform: `rotate(-12deg) scale(${mix(2.2, 1, pop(s, 47.9, {damping: 9, stiffness: 260}))})`,
              opacity: s < 47.9 ? 0 : 0.9,
              border: '7px solid #C62828',
              borderRadius: 16,
              padding: '6px 34px 14px',
              color: '#C62828',
              fontFamily: F.lalezar,
              fontSize: 76,
              direction: 'rtl',
              mixBlendMode: 'multiply',
            }}
          >
            مسوّى باليد
          </div>
        </AbsoluteFill>
      </AbsoluteFill>

      <div style={{position: 'absolute', inset: 0, zIndex: 40, pointerEvents: 'none'}}>
        <ChapterTag n={1} en="COLLAGE" color={INK} at={27} />
      </div>
    </AbsoluteFill>
  );
};
