import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import {F} from '../fonts';
import {img, tex, tornClip} from './common';

export type StyleId = 'collage' | 'doc' | 'motion' | 'cine' | 'fast' | 'minimal' | 'ad' | 'story';

export const STYLES: {id: StyleId; ar: string; en: string}[] = [
  {id: 'collage', ar: 'الكولاج', en: 'COLLAGE'},
  {id: 'doc', ar: 'الوثائقي', en: 'DOCUMENTARY'},
  {id: 'motion', ar: 'الموشن جرافيك', en: 'MOTION GRAPHICS'},
  {id: 'cine', ar: 'السينمائي', en: 'CINEMATIC'},
  {id: 'fast', ar: 'السريع', en: 'FAST-PACED'},
  {id: 'minimal', ar: 'المينيمال', en: 'MINIMAL'},
  {id: 'ad', ar: 'الإعلاني', en: 'COMMERCIAL'},
  {id: 'story', ar: 'القصصي', en: 'STORYTELLING'},
];

/** A 16:9 miniature that shows each style in its own look. Designed at 480x270. */
export const StyleTile: React.FC<{id: StyleId; label?: boolean}> = ({id, label = true}) => {
  const name = STYLES.find((x) => x.id === id)!.ar.replace(/^ال/, '');
  const base: React.CSSProperties = {width: 480, height: 270, position: 'relative', overflow: 'hidden', direction: 'rtl'};
  const center: React.CSSProperties = {position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'};
  switch (id) {
    case 'collage':
      return (
        <div style={{...base, backgroundImage: `url(${tex('kraft.jpg')})`, backgroundSize: 'cover'}}>
          <Img src={img('camera')} style={{position: 'absolute', width: 190, height: 130, objectFit: 'cover', left: 30, top: 26, transform: 'rotate(-7deg)', border: '8px solid #f4efe4', boxShadow: '3px 5px 8px rgba(0,0,0,.35)'}} />
          <Img src={img('desert-boy')} style={{position: 'absolute', width: 140, height: 170, objectFit: 'cover', right: 34, bottom: 18, transform: 'rotate(6deg)', border: '8px solid #f4efe4', boxShadow: '3px 5px 8px rgba(0,0,0,.35)'}} />
          {label && (
            <div style={{...center}}>
              <div style={{clipPath: tornClip(`tile-${id}`, 3), background: '#E63B2E', padding: '4px 30px', transform: 'rotate(-4deg)', fontFamily: F.lalezar, fontSize: 64, color: '#fff'}}>{name}</div>
            </div>
          )}
        </div>
      );
    case 'doc':
      return (
        <div style={{...base, background: '#111'}}>
          <Img src={img('factory')} style={{width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(1) sepia(.35) contrast(1.1) brightness(.75)'}} />
          {label && (
            <div style={{position: 'absolute', bottom: 22, right: 22, background: '#E9DFC9', padding: '2px 18px', fontFamily: F.amiri, fontSize: 46, color: '#222'}}>{name}</div>
          )}
          <div style={{position: 'absolute', top: 18, left: 20, fontFamily: F.type, fontSize: 20, color: '#E9DFC9'}}>ARCHIVE · 1921</div>
        </div>
      );
    case 'motion':
      return (
        <div style={{...base, background: '#0F1226'}}>
          <div style={{position: 'absolute', width: 120, height: 120, borderRadius: '50%', background: '#FFCC00', left: 40, top: 30}} />
          <div style={{position: 'absolute', width: 90, height: 90, background: '#FF5A5F', right: 60, top: 40, transform: 'rotate(18deg)', borderRadius: 14}} />
          <div style={{position: 'absolute', width: 0, height: 0, borderLeft: '55px solid transparent', borderRight: '55px solid transparent', borderBottom: '95px solid #2EC4B6', right: 120, bottom: 24}} />
          {label && <div style={{...center, fontFamily: F.readex, fontWeight: 700, fontSize: 52, color: '#fff'}}>{name}</div>}
        </div>
      );
    case 'cine':
      return (
        <div style={{...base, background: '#000'}}>
          <Img src={img('desert-boy')} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 33%', filter: 'contrast(1.1) saturate(1.15)'}} />
          <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: 34, background: '#000'}} />
          <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: 34, background: '#000'}} />
          {label && <div style={{position: 'absolute', bottom: 46, width: '100%', textAlign: 'center', fontFamily: F.amiri, fontSize: 46, color: '#F3E3C3', textShadow: '0 2px 12px rgba(0,0,0,.6)'}}>{name}</div>}
        </div>
      );
    case 'fast':
      return (
        <div style={{...base, background: '#FFE600'}}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{position: 'absolute', height: 8, width: 160 + (i % 3) * 60, background: '#111', top: 30 + i * 40, left: -20 + (i % 2) * 260, transform: 'skewX(-25deg)'}} />
          ))}
          {label && <div style={{...center, fontFamily: F.lalezar, fontSize: 96, color: '#111', transform: 'skewX(-10deg)', textShadow: '6px 6px 0 #FF2D2D'}}>{name}</div>}
        </div>
      );
    case 'minimal':
      return (
        <div style={{...base, background: '#F4F3EF'}}>
          <div style={{position: 'absolute', width: 16, height: 16, borderRadius: '50%', background: '#FF4F00', left: 232, top: 92}} />
          {label && <div style={{position: 'absolute', top: 140, width: '100%', textAlign: 'center', fontFamily: F.plex, fontWeight: 200, fontSize: 40, color: '#111'}}>{name}</div>}
        </div>
      );
    case 'ad':
      return (
        <div style={{...base, background: 'radial-gradient(circle at 50% 40%, #2a3350 0%, #07080c 65%)'}}>
          <div style={{position: 'absolute', width: 86, height: 172, borderRadius: 18, left: 54, top: 50, background: 'linear-gradient(135deg,#3a3f4b,#0d0f14 60%)', boxShadow: '0 0 40px rgba(110,150,255,.35), inset 0 0 0 2px #5b6275'}} />
          {label && <div style={{position: 'absolute', right: 40, top: 92, fontFamily: F.readex, fontWeight: 700, fontSize: 56, color: '#fff'}}>{name}</div>}
          <div style={{position: 'absolute', right: 40, top: 172, fontFamily: F.readex, fontSize: 18, color: '#9fb3ff', letterSpacing: 4}}>SHOP NOW</div>
        </div>
      );
    case 'story':
      return (
        <div style={{...base, background: '#15110D'}}>
          <svg width={480} height={270} style={{position: 'absolute'}}>
            <path d="M 30 220 C 150 220, 200 200, 260 120 S 340 60, 360 70 S 420 200, 450 220" stroke="#E0A040" strokeWidth={4} fill="none" />
            <circle cx={360} cy={70} r={9} fill="#E0A040" />
          </svg>
          {label && <div style={{position: 'absolute', top: 120, right: 40, fontFamily: F.amiri, fontWeight: 700, fontSize: 54, color: '#F2E6D0'}}>{name}</div>}
        </div>
      );
  }
};

export const TileFrame: React.FC<{children: React.ReactNode; scale?: number; style?: React.CSSProperties}> = ({children, scale = 1, style}) => (
  <div style={{width: 480 * scale, height: 270 * scale, position: 'relative', direction: 'ltr', ...style}}>
    <AbsoluteFill style={{transform: `scale(${scale})`, transformOrigin: 'top left', width: 480, height: 270, left: 0, top: 0, right: 'auto', bottom: 'auto'}}>{children}</AbsoluteFill>
  </div>
);
