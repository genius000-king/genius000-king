import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Grain} from '../components/common';
import {STYLES, StyleId, StyleTile, TileFrame} from '../components/StyleTile';
import {F} from '../fonts';
import {Center, ease, mix, pop, ramp, useSec} from '../lib';

const CREAM = '#EDE6D6';
const GOLD = '#E8C07D';

const GOALS = [
  {t: 'يفهم', at: 211.66, call: 215.78, ids: [['doc', 216.6], ['motion', 217.78], ['minimal', 219.0]]},
  {t: 'يحس', at: 212.24, call: 219.62, ids: [['cine', 220.68], ['story', 221.68]]},
  {t: 'يشتري', at: 213.04, call: 222.48, ids: [['ad', 223.48]]},
  {t: 'يوقف ويتفرج', at: 214.36, call: 224.24, ids: [['fast', 225.0], ['collage', 226.34]]},
] as const;

const colX = (c: number) => 1920 - 140 - 410 * c - 380; // right-to-left columns, 380 wide

export const Outro: React.FC = () => {
  const s = useSec();
  const tray = ramp(s, 209.64, 210.4, ease); // grid → tray at the bottom
  const merge = ramp(s, 227.3, 228.4, ease);
  const finalO = ramp(s, 228.6, 229.2);
  const fadeOut = ramp(s, 231.0, 232.0);

  const slotOf = (id: StyleId) => {
    for (let c = 0; c < GOALS.length; c++) {
      const r = GOALS[c].ids.findIndex(([x]) => x === id);
      if (r >= 0) return {c, r, at: GOALS[c].ids[r][1] as number};
    }
    return {c: 0, r: 0, at: 999};
  };

  return (
    <AbsoluteFill style={{background: '#0d0d0d'}}>
      <div style={{position: 'absolute', top: 70, width: '100%', textAlign: 'center', fontFamily: F.cairo, fontWeight: 900, fontSize: 76, color: CREAM, direction: 'rtl', opacity: ramp(s, 207.6, 207.9) * (1 - ramp(s, 209.5, 209.9))}}>
        طيب… أي واحد <span style={{color: GOLD}}>تختار؟</span>
      </div>
      <div style={{position: 'absolute', top: 60, width: '100%', textAlign: 'center', fontFamily: F.cairo, fontWeight: 700, fontSize: 52, color: '#9b9484', direction: 'rtl', opacity: ramp(s, 209.7, 210.0) * (1 - merge)}}>
        اسأل نفسك: ابغى المشاهد…
      </div>

      {/* goal columns */}
      {GOALS.map((g, c) => {
        const p = pop(s, g.at, {damping: 12});
        const active = s >= g.call;
        return (
          <div key={g.t} style={{position: 'absolute', left: colX(c), top: 170, width: 380, height: 720, borderRadius: 24, border: `2px solid ${active ? GOLD : '#2a2a2a'}`, background: active ? 'rgba(232,192,125,.06)' : 'transparent', opacity: p * (1 - merge), transform: `translateY(${(1 - p) * 30}px)`}}>
            <div style={{textAlign: 'center', marginTop: 18, fontFamily: F.cairo, fontWeight: 900, fontSize: 58, color: active ? GOLD : CREAM, direction: 'rtl'}}>{g.t}؟</div>
          </div>
        );
      })}

      {/* the eight tiles */}
      {STYLES.map((st, i) => {
        const a = pop(s, 207.7 + i * 0.08, {damping: 15});
        // 1) grid
        const gx = 102 + (3 - (i % 4)) * 436;
        const gy = 300 + Math.floor(i / 4) * 258;
        // 2) tray
        const tx = 1920 - 120 - (i + 1) * 212;
        const ty = 940;
        // 3) column slot
        const slot = slotOf(st.id);
        const fly = pop(s, slot.at, {damping: 14});
        const cx = colX(slot.c) + 380 / 2 - (480 * 0.62) / 2;
        const cy = 290 + slot.r * 196;
        // 4) merge in the centre, fanned
        const mx = 960 - (480 * 0.7) / 2 + (i - 3.5) * 46;
        const my = 400 + Math.abs(i - 3.5) * 10;

        let x = mix(gx, tx, tray);
        let y = mix(gy, ty, tray);
        let sc = mix(0.85, 0.4, tray);
        x = mix(x, cx, fly);
        y = mix(y, cy, fly);
        sc = mix(sc, 0.62, fly);
        x = mix(x, mx, merge);
        y = mix(y, my, merge);
        sc = mix(sc, 0.7, merge);
        const rot = merge * (i - 3.5) * 5;
        return (
          <div key={st.id} style={{position: 'absolute', left: x, top: y, opacity: a * (1 - finalO), transform: `translateY(${(1 - a) * 30}px) rotate(${rot}deg)`, zIndex: fly > 0.5 ? 3 : 1, borderRadius: 10, overflow: 'hidden', boxShadow: '0 12px 30px rgba(0,0,0,.6)'}}>
            <TileFrame scale={sc}>
              <StyleTile id={st.id} />
            </TileFrame>
          </div>
        );
      })}

      <div style={{position: 'absolute', bottom: 120, width: '100%', textAlign: 'center', fontFamily: F.cairo, fontWeight: 900, fontSize: 64, color: CREAM, direction: 'rtl', opacity: ramp(s, 227.3, 227.6) * (1 - finalO)}}>
        وأحلى شغل… <span style={{color: GOLD, opacity: ramp(s, 229.5, 229.8)}}>يخلط بينهم</span>
      </div>

      {/* final card: callback to the opening */}
      <AbsoluteFill style={{opacity: finalO}}>
        <Center style={{flexDirection: 'column', gap: 10}}>
          <div style={{display: 'flex', gap: 0, direction: 'rtl', fontSize: 190, lineHeight: 1.3}}>
            <span style={{fontFamily: F.lalezar, color: '#E63B2E'}}>المو</span>
            <span style={{fontFamily: F.amiri, fontWeight: 700, color: CREAM}}>نتا</span>
            <span style={{fontFamily: F.readex, fontWeight: 700, color: '#FFCC00'}}>ج</span>
          </div>
          <div style={{fontFamily: F.cairo, fontWeight: 700, fontSize: 52, color: '#9b9484', direction: 'rtl', opacity: ramp(s, 229.6, 230.1)}}>
            <span style={{color: GOLD}}>الترتيب</span> هو اللي يصنع المعنى
          </div>
        </Center>
      </AbsoluteFill>

      <Grain opacity={0.06} />
      <AbsoluteFill style={{background: '#000', opacity: fadeOut}} />
    </AbsoluteFill>
  );
};
