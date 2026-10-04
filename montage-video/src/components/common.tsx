import React from 'react';
import {AbsoluteFill, Img, random, staticFile, useCurrentFrame} from 'remotion';
import {getWaveformPortion, useAudioData} from '@remotion/media-utils';
import {F} from '../fonts';
import {mix, ramp, useSec} from '../lib';

export const img = (name: string) => staticFile(`img/${name}.jpg`);
export const tex = (name: string) => staticFile(`tex/${name}`);

/** Full-bleed photo with a Ken Burns move between seconds a and b. */
export const Photo: React.FC<{
  name: string;
  a?: number;
  b?: number;
  from?: number;
  to?: number;
  pos?: string;
  x?: [number, number];
  y?: [number, number];
  filter?: string;
  style?: React.CSSProperties;
}> = ({name, a = 0, b = 1, from = 1, to = 1, pos = 'center', x = [0, 0], y = [0, 0], filter, style}) => {
  const s = useSec();
  const t = ramp(s, a, b, (v) => v);
  return (
    <AbsoluteFill style={{overflow: 'hidden', ...style}}>
      <Img
        src={img(name)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: pos,
          transform: `translate(${mix(x[0], x[1], t)}px, ${mix(y[0], y[1], t)}px) scale(${mix(from, to, t)})`,
          filter,
        }}
      />
    </AbsoluteFill>
  );
};

export const Grain: React.FC<{opacity?: number; blend?: React.CSSProperties['mixBlendMode']}> = ({
  opacity = 0.12,
  blend = 'overlay',
}) => {
  const frame = useCurrentFrame();
  const i = Math.floor(frame / 2) % 6;
  const ox = Math.floor(random(`gx${frame}`) * 512);
  const oy = Math.floor(random(`gy${frame}`) * 512);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${tex(`grain-${i}.png`)})`,
        backgroundPosition: `${ox}px ${oy}px`,
        opacity,
        mixBlendMode: blend,
        pointerEvents: 'none',
      }}
    />
  );
};

export const Vignette: React.FC<{strength?: number}> = ({strength = 0.6}) => (
  <AbsoluteFill
    style={{background: `radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,${strength}) 100%)`}}
  />
);

export const Letterbox: React.FC<{h: number; color?: string}> = ({h, color = '#000'}) => (
  <>
    <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: h, background: color}} />
    <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: h, background: color}} />
  </>
);

/** "٠٣ / ٠٨  ·  DOCUMENTARY" chapter marker in the top-right corner. */
export const ChapterTag: React.FC<{n: number; en: string; color: string; at: number; font?: string; top?: number}> = ({
  n,
  en,
  color,
  at,
  font = F.mono,
  top = 56,
}) => {
  const s = useSec();
  const o = ramp(s, at, at + 0.5);
  return (
    <div
      style={{
        position: 'absolute',
        top,
        right: 72,
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        opacity: o,
        transform: `translateY(${(1 - o) * -12}px)`,
        color,
        fontFamily: font,
        fontSize: 24,
        letterSpacing: 3,
      }}
    >
      <span>{en}</span>
      <span style={{width: 40, height: 2, background: color, opacity: 0.6}} />
      <span style={{fontWeight: 700}}>{String(n).padStart(2, '0')} / 08</span>
    </div>
  );
};

/** Live waveform of the narrator: amplitude around the current moment, read from the actual voice file. */
export const VoiceWave: React.FC<{
  width: number;
  height: number;
  color: string;
  bars?: number;
  gap?: number;
  span?: number;
}> = ({width, height, color, bars = 64, gap = 4, span = 2.4}) => {
  const s = useSec();
  const audio = useAudioData(staticFile('audio/voice.mp3'));
  if (!audio) return null;
  const from = Math.max(0, s - span / 2);
  const vals = getWaveformPortion({audioData: audio, startTimeInSeconds: from, durationInSeconds: span, numberOfSamples: bars});
  const w = width / bars - gap;
  return (
    <div style={{width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', gap, direction: 'ltr'}}>
      {vals.map((v, i) => {
        const dist = Math.abs(i - bars / 2) / (bars / 2);
        return (
          <div
            key={v.index}
            style={{width: w, height: Math.max(4, Math.min(1, v.amplitude * 3) * height), background: color, borderRadius: w, opacity: 1 - dist * 0.75}}
          />
        );
      })}
    </div>
  );
};

/** Irregular torn-edge polygon for clip-path. */
export const tornClip = (seed: string, rough = 1.2, n = 18) => {
  const pts: string[] = [];
  const r = (k: string) => random(`${seed}-${k}`) * rough;
  for (let i = 0; i <= n; i++) pts.push(`${(i / n) * 100}% ${r(`t${i}`)}%`);
  for (let i = 0; i <= n; i++) pts.push(`${100 - r(`r${i}`)}% ${(i / n) * 100}%`);
  for (let i = n; i >= 0; i--) pts.push(`${(i / n) * 100}% ${100 - r(`b${i}`)}%`);
  for (let i = n; i >= 0; i--) pts.push(`${r(`l${i}`)}% ${(i / n) * 100}%`);
  return `polygon(${pts.join(',')})`;
};

/** Paper cutout: photo or children on a torn white border with a drop shadow. */
export const Cutout: React.FC<{
  seed: string;
  w: number;
  h: number;
  photo?: string;
  pos?: string;
  border?: number;
  paper?: string;
  shadow?: number;
  filter?: string;
  children?: React.ReactNode;
}> = ({seed, w, h, photo, pos = 'center', border = 14, paper = '#f6f2e9', shadow = 1, filter, children}) => (
  <div style={{filter: `drop-shadow(${6 * shadow}px ${10 * shadow}px ${8 * shadow}px rgba(0,0,0,${0.35 * shadow}))`}}>
    <div
      style={{
        width: w,
        height: h,
        clipPath: tornClip(seed),
        background: paper,
        backgroundImage: `url(${tex('paper.jpg')})`,
        backgroundSize: 'cover',
        padding: border,
        boxSizing: 'border-box',
      }}
    >
      {photo ? (
        <Img src={img(photo)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos, filter}} />
      ) : (
        children
      )}
    </div>
  </div>
);

export const Tape: React.FC<{w?: number; rot?: number; style?: React.CSSProperties}> = ({w = 150, rot = -8, style}) => (
  <div
    style={{
      position: 'absolute',
      width: w,
      height: 42,
      background: 'rgba(238, 226, 190, 0.78)',
      transform: `rotate(${rot}deg)`,
      clipPath: 'polygon(0 6%, 4% 0, 8% 8%, 12% 0, 16% 6%, 100% 0, 96% 50%, 100% 100%, 12% 96%, 6% 100%, 0 94%, 3% 50%)',
      boxShadow: '0 1px 2px rgba(0,0,0,.2)',
      ...style,
    }}
  />
);

/** Thin label with a line, used for annotations. */
export const Label: React.FC<{
  children: React.ReactNode;
  color: string;
  font?: string;
  size?: number;
  weight?: number;
  style?: React.CSSProperties;
}> = ({children, color, font = F.cairo, size = 40, weight = 700, style}) => (
  <div style={{fontFamily: font, fontSize: size, fontWeight: weight, color, direction: 'rtl', whiteSpace: 'nowrap', ...style}}>
    {children}
  </div>
);

/** Amplitude waveform of the voice between two seconds, drawn as bars (static, like an editor timeline). */
export const VoiceStrip: React.FC<{from: number; to: number; width: number; height: number; color: string; bars?: number}> = ({
  from,
  to,
  width,
  height,
  color,
  bars = 160,
}) => {
  const audio = useAudioData(staticFile('audio/voice.mp3'));
  if (!audio) return null;
  const portion = getWaveformPortion({audioData: audio, startTimeInSeconds: from, durationInSeconds: to - from, numberOfSamples: bars});
  const w = width / bars;
  return (
    <div style={{width, height, display: 'flex', alignItems: 'center', direction: 'ltr'}}>
      {portion.map((p) => (
        <div key={p.index} style={{width: w * 0.7, marginRight: w * 0.3, height: Math.max(2, Math.min(1, p.amplitude * 2.2) * height), background: color, borderRadius: 2}} />
      ))}
    </div>
  );
};

/** Typewriter: characters of `text` revealed from second `a` at `cps` chars/second. */
export const typed = (text: string, s: number, a: number, cps = 14) => {
  const chars = Array.from(text);
  return chars.slice(0, Math.max(0, Math.min(chars.length, Math.floor((s - a) * cps)))).join('');
};
