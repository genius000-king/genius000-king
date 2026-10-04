import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {ChapterTag} from '../components/common';
import {Phone3D} from '../components/Phone3D';
import {F} from '../fonts';
import {Center, ar, ease, easeOut, mix, pop, ramp, useSec, vis} from '../lib';

// Palette: light lavender canvas, one indigo primary, coral + sun as warm complements.
const BG = '#F6F4FF';
const INK = '#1C1745';
const MUTED = '#77739A';
const P = '#5B4CF5'; // primary
const P2 = '#9C93FF'; // primary, light
const PT = '#E8E5FF'; // primary tint
const C = '#FF6F59'; // coral
const Y = '#FFB938'; // sun
const W = '#FFFFFF';
const R = C;
const T = P2;
const SHADOW = '0 18px 40px rgba(60, 50, 160, .14)';

const Card: React.FC<{x: number; at: number; label: string; color: string; children: React.ReactNode; out: number}> = ({x, at, label, color, children, out}) => {
  const s = useSec();
  const p = pop(s, at, {damping: 13});
  return (
    <div style={{position: 'absolute', left: x, top: 380, width: 300, opacity: Math.min(1, p * 2) * (1 - out), transform: `translateY(${(1 - p) * 80 - out * 120}px) scale(${mix(0.7, 1, p)})`}}>
      <div style={{width: 300, height: 300, borderRadius: 36, background: W, boxShadow: SHADOW, borderBottom: `6px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative'}}>
        {children}
      </div>
      <div style={{marginTop: 22, textAlign: 'center', fontFamily: F.readex, fontWeight: 700, fontSize: 40, color, direction: 'rtl'}}>{label}</div>
    </div>
  );
};

const Cube: React.FC<{t: number; size: number; flat: number}> = ({t, size, flat}) => {
  const faces = [
    {tr: `translateZ(${size / 2}px)`, c: P},
    {tr: `rotateY(180deg) translateZ(${size / 2}px)`, c: P},
    {tr: `rotateY(90deg) translateZ(${size / 2}px)`, c: '#4337D4'},
    {tr: `rotateY(-90deg) translateZ(${size / 2}px)`, c: '#4337D4'},
    {tr: `rotateX(90deg) translateZ(${size / 2}px)`, c: P2},
    {tr: `rotateX(-90deg) translateZ(${size / 2}px)`, c: '#3328A8'},
  ];
  return (
    <div style={{perspective: 700}}>
      <div style={{width: size, height: size, position: 'relative', transformStyle: 'preserve-3d', transform: `rotateX(${(1 - flat) * (-25 + t * 40)}deg) rotateY(${(1 - flat) * (35 + t * 220)}deg)`}}>
        {faces.map((f, i) => (
          <div key={i} style={{position: 'absolute', inset: 0, background: f.c, transform: f.tr, opacity: i === 0 || flat < 0.98 ? 1 : 0, border: '2px solid rgba(255,255,255,.35)'}} />
        ))}
      </div>
    </div>
  );
};

const rr = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) => {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
};

/** Paints a tiny app on the 3D phone: a list, a tap on the second row, then the detail page slides in. */
const appPainter = (s: number) => (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  const tapAt = 85.9;
  const slide = ramp(s, tapAt + 0.15, tapAt + 0.55, ease);
  const u = w / 100;
  // list screen
  ctx.save();
  ctx.translate(slide * w, 0);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = INK;
  ctx.font = `700 ${7 * u}px "${F.readex}"`;
  ctx.textAlign = 'right';
  ctx.direction = 'rtl';
  ctx.fillText('رحلاتي', w - 7 * u, 26 * u);
  [Y, C, P, P2].forEach((c, i) => {
    const y = 34 * u + i * 26 * u;
    rr(ctx, 6 * u, y, w - 12 * u, 22 * u, 4 * u, W);
    if (i === 1 && s > tapAt && s < tapAt + 0.5) {
      ctx.strokeStyle = P;
      ctx.lineWidth = 0.8 * u;
      ctx.stroke();
    }
    rr(ctx, w - 22 * u, y + 4 * u, 14 * u, 14 * u, 3.5 * u, c);
    rr(ctx, 30 * u, y + 6 * u, w - 58 * u, 3.2 * u, 1.6 * u, '#CFCBEA');
    rr(ctx, 46 * u, y + 12.5 * u, w - 74 * u, 3.2 * u, 1.6 * u, '#E4E1F5');
  });
  ctx.restore();
  // detail screen
  ctx.save();
  ctx.translate((slide - 1) * w, 0);
  ctx.fillStyle = C;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.36, 18 * u, 0, Math.PI * 2);
  ctx.fill();
  rr(ctx, 22 * u, h * 0.52, w - 44 * u, 4 * u, 2 * u, 'rgba(255,255,255,.8)');
  rr(ctx, 32 * u, h * 0.57, w - 64 * u, 4 * u, 2 * u, 'rgba(255,255,255,.55)');
  rr(ctx, 14 * u, h * 0.78, w - 28 * u, 13 * u, 6.5 * u, INK);
  ctx.restore();
  // tap ripple
  if (s > tapAt && s < tapAt + 0.6) {
    const k = ramp(s, tapAt, tapAt + 0.5);
    ctx.strokeStyle = `rgba(91,76,245,${1 - k})`;
    ctx.lineWidth = 1.2 * u;
    ctx.beginPath();
    ctx.arc(w / 2, 34 * u + 26 * u + 11 * u, (6 + 14 * k) * u, 0, Math.PI * 2);
    ctx.stroke();
  }
};

const Donut: React.FC<{v: number}> = ({v}) => {
  const r = 120;
  const c = 2 * Math.PI * r;
  return (
    <svg width={300} height={300} viewBox="0 0 300 300">
      <circle cx={150} cy={150} r={r} stroke={PT} strokeWidth={36} fill="none" />
      <circle cx={150} cy={150} r={r} stroke={P} strokeWidth={36} fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - v)} transform="rotate(-90 150 150)" strokeLinecap="round" />
    </svg>
  );
};

export const Motion: React.FC = () => {
  const s = useSec();

  // Title
  const titleIn = pop(s, 72.4, {damping: 12});
  const titleUp = ramp(s, 73.5, 74.0, ease);
  const titleOut = ramp(s, 76.0, 76.3);

  // tools grid
  const gridOut = ramp(s, 81.3, 81.7, ease);

  // explain
  const explainO = vis(s, 81.55, 88.1, 0.3);

  // easing
  const easeO = ramp(s, 88.05, 88.4);
  const tA = 91.0;
  const tB = 94.4;
  const lin = ramp(s, tA, tB, (v) => v);
  const eio = ramp(s, tA, tB, (v) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2));
  const xFrom = 1500;
  const xTo = 380;

  return (
    <AbsoluteFill style={{background: BG, overflow: 'hidden'}}>
      {/* background dots grid */}
      <AbsoluteFill style={{backgroundImage: 'radial-gradient(#DDD8F6 2px, transparent 2px)', backgroundSize: '48px 48px'}} />

      {/* ---- Title + 'you don't film, you design and animate' ---- */}
      {s < 76.4 && (
        <AbsoluteFill style={{opacity: 1 - titleOut}}>
          {[
            {c: Y, shape: 'circle', dx: -680, dy: -170, d: 0},
            {c: C, shape: 'square', dx: 660, dy: -200, d: 0.08},
            {c: P, shape: 'tri', dx: -560, dy: 230, d: 0.16},
            {c: P2, shape: 'ring', dx: 580, dy: 220, d: 0.24},
          ].map((sh, i) => {
            const p = pop(s, 72.4 + sh.d, {damping: 10});
            const orbit = (s - 72.4) * 0.6 + i;
            const x = 960 + sh.dx * p + Math.cos(orbit) * 18 - 70;
            const y = 540 + sh.dy * p + Math.sin(orbit) * 18 - 70 - titleUp * 120;
            const size = 140;
            return (
              <div key={i} style={{position: 'absolute', left: x, top: y, width: size, height: size, transform: `rotate(${(s - 72.4) * 40 * (i % 2 ? 1 : -1)}deg) scale(${p * (1 - titleUp * 0.4)})`}}>
                {sh.shape === 'circle' && <div style={{width: '100%', height: '100%', borderRadius: '50%', background: sh.c}} />}
                {sh.shape === 'square' && <div style={{width: '100%', height: '100%', borderRadius: 24, background: sh.c}} />}
                {sh.shape === 'ring' && <div style={{width: '100%', height: '100%', borderRadius: '50%', border: `26px solid ${sh.c}`, boxSizing: 'border-box'}} />}
                {sh.shape === 'tri' && (
                  <svg width={size} height={size} viewBox="0 0 100 100">
                    <path d="M50 6 L96 92 L4 92 Z" fill={sh.c} />
                  </svg>
                )}
              </div>
            );
          })}
          <div style={{position: 'absolute', left: 0, right: 0, top: mix(390, 150, titleUp), textAlign: 'center', transform: `scale(${mix(0.6, 1, titleIn) * mix(1, 0.7, titleUp)})`, opacity: Math.min(1, titleIn * 1.5)}}>
            <div style={{fontFamily: F.readex, fontWeight: 700, fontSize: 170, color: INK, direction: 'rtl', lineHeight: 1.25}}>
              {'موشن جرافيك'.split(' ').map((w, i) => (
                <span key={i} style={{display: 'inline-block', margin: '0 18px', transform: `translateY(${(1 - pop(s, 72.4 + i * 0.25, {damping: 9})) * 80}px)`, color: i ? P : INK}}>
                  {w}
                </span>
              ))}
            </div>
            <div style={{fontFamily: F.mono, fontSize: 38, color: MUTED, letterSpacing: 12, marginTop: 14}}>MOTION GRAPHICS</div>
          </div>

          {/* film ✗ → design → animate */}
          <div style={{position: 'absolute', top: 560, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 120, direction: 'rtl'}}>
            {[
              {label: 'تصوّر', at: 73.64, color: MUTED},
              {label: 'تصمّم', at: 75.02, color: P},
              {label: 'تحرّك', at: 75.68, color: C},
            ].map((it, i) => {
              const p = pop(s, it.at, {damping: 12});
              return (
                <div key={it.label} style={{width: 300, textAlign: 'center', opacity: p, transform: `scale(${mix(0.6, 1, p)})`}}>
                  <div style={{height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'}}>
                    {i === 0 && (
                      <svg width={200} height={160} viewBox="0 0 100 80">
                        <rect x={8} y={20} width={64} height={46} rx={8} fill="none" stroke={MUTED} strokeWidth={5} />
                        <path d="M72 34 L92 24 L92 62 L72 52 Z" fill="none" stroke={MUTED} strokeWidth={5} strokeLinejoin="round" />
                        <path d="M4 76 L96 4" stroke={C} strokeWidth={8} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ramp(s, 74.3, 74.6)} />
                      </svg>
                    )}
                    {i === 1 && (
                      <svg width={240} height={200} viewBox="0 0 120 100">
                        <path d="M10 80 C 30 10, 90 10, 110 80" fill="none" stroke={P} strokeWidth={5} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ramp(s, 75.05, 75.6)} />
                        <line x1={10} y1={80} x2={30} y2={10} stroke={MUTED} strokeWidth={2} />
                        <line x1={110} y1={80} x2={90} y2={10} stroke={MUTED} strokeWidth={2} />
                        {[
                          [10, 80],
                          [110, 80],
                        ].map(([cx, cy]) => (
                          <rect key={cx} x={cx - 6} y={cy - 6} width={12} height={12} fill={W} stroke={P} strokeWidth={2} />
                        ))}
                        {[
                          [30, 10],
                          [90, 10],
                        ].map(([cx, cy]) => (
                          <circle key={cx} cx={cx} cy={cy} r={6} fill={P2} />
                        ))}
                      </svg>
                    )}
                    {i === 2 && (
                      <svg width={240} height={200} viewBox="0 0 120 100">
                        <path d="M10 80 C 30 10, 90 10, 110 80" fill="none" stroke="#CFC9F5" strokeWidth={4} strokeDasharray="4 6" />
                        {(() => {
                          const t = ((s - 75.68) / 1.1) % 1;
                          const u = t < 0 ? 0 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
                          const bx = (1 - u) ** 3 * 10 + 3 * (1 - u) ** 2 * u * 30 + 3 * (1 - u) * u * u * 90 + u ** 3 * 110;
                          const by = (1 - u) ** 3 * 80 + 3 * (1 - u) ** 2 * u * 10 + 3 * (1 - u) * u * u * 10 + u ** 3 * 80;
                          return <circle cx={bx} cy={by} r={11} fill={C} />;
                        })()}
                      </svg>
                    )}
                  </div>
                  <div style={{fontFamily: F.readex, fontWeight: 700, fontSize: 52, color: it.color, textDecoration: i === 0 && s > 74.4 ? 'line-through' : 'none'}}>{it.label}</div>
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      )}

      {/* ---- Toolbox ---- */}
      {s >= 76.0 && s < 81.8 && (
        <AbsoluteFill>
          <div style={{position: 'absolute', top: 150, width: '100%', textAlign: 'center', fontFamily: F.readex, fontWeight: 700, fontSize: 64, color: INK, direction: 'rtl', opacity: ramp(s, 76.1, 76.4) * (1 - gridOut)}}>
            أدواته
          </div>
          <Card x={1470} at={76.36} label="نصوص" color={P} out={gridOut}>
            <div style={{fontFamily: F.readex, fontWeight: 700, fontSize: 120, color: INK, direction: 'rtl', display: 'flex'}}>
              {['ن', 'ص'].map((ch, i) => (
                <span key={i} style={{display: 'inline-block', transform: `translateY(${Math.sin((s - 76.4) * 7 + i * 1.4) * 18}px)`}}>{ch}</span>
              ))}
            </div>
          </Card>
          <Card x={1140} at={77.38} label="أيقونات" color={C} out={gridOut}>
            <svg width={240} height={200} viewBox="0 0 120 100">
              {[
                {d: 'M30 40 C30 28, 46 24, 50 36 C54 24, 70 28, 70 40 C70 54, 50 64, 50 70 C50 64, 30 54, 30 40 Z', c: C, at: 77.4},
                {d: 'M95 22 L100 34 L113 35 L103 43 L106 56 L95 49 L84 56 L87 43 L77 35 L90 34 Z', c: Y, at: 77.55},
                {d: 'M30 92 C30 78, 36 72, 45 72 C54 72, 60 78, 60 92 Z M40 94 L50 94', c: P, at: 77.7},
              ].map((ic, i) => {
                const p = pop(s, ic.at, {damping: 8});
                return <path key={i} d={ic.d} fill={ic.c} stroke={ic.c} strokeWidth={2} style={{transform: `scale(${p})`, transformOrigin: 'center', transformBox: 'fill-box'}} />;
              })}
            </svg>
          </Card>
          <Card x={810} at={78.16} label="أشكال" color={Y} out={gridOut}>
            {(() => {
              const m = (Math.sin((s - 78.2) * 3) + 1) / 2;
              return <div style={{width: 140, height: 140, background: Y, borderRadius: `${m * 50}%`, transform: `rotate(${(s - 78.2) * 120}deg)`}} />;
            })()}
          </Card>
          <Card x={480} at={78.88} label="رسوم بيانية" color={P} out={gridOut}>
            <div style={{display: 'flex', alignItems: 'flex-end', gap: 22, height: 200}}>
              {[0.45, 0.8, 0.6, 1].map((h, i) => (
                <div key={i} style={{width: 38, height: 200 * h * pop(s, 79.0 + i * 0.1, {damping: 12}), background: [P2, C, Y, P][i], borderRadius: 8}} />
              ))}
            </div>
          </Card>
          <Card x={150} at={80.2} label={s < 80.72 ? 'تو دي 2D' : 'ثري دي 3D'} color={INK} out={gridOut}>
            <Cube t={ramp(s, 80.72, 81.8, (v) => v)} size={130} flat={1 - ramp(s, 80.72, 81.1, ease)} />
          </Card>
        </AbsoluteFill>
      )}

      {/* ---- What it explains best ---- */}
      {s >= 81.5 && s < 88.15 && (
        <AbsoluteFill style={{opacity: explainO}}>
          <div style={{position: 'absolute', top: 110, width: '100%', textAlign: 'center', direction: 'rtl'}}>
            <div style={{fontFamily: F.readex, fontWeight: 500, fontSize: 50, color: MUTED, opacity: ramp(s, 81.6, 81.9)}}>أقوى أسلوب لما تبغى تشرح</div>
            <div style={{fontFamily: F.readex, fontWeight: 700, fontSize: 96, color: INK, opacity: ramp(s, 83.4, 83.7), transform: `scale(${mix(1.2, 1, pop(s, 83.46))})`}}>
              شي <span style={{color: P}}>ما ينصوّر</span>
            </div>
          </div>
          <AbsoluteFill style={{opacity: ramp(s, 85.0, 85.3)}}>
            <Phone3D rot={[4, -14 + 6 * ramp(s, 85.0, 88.1, (v) => v), 0]} pos={[12.6, -2.2 + (1 - pop(s, 85.04)) * -4, 0]} camZ={54} studio={0.9} rim="#9C93FF" color="#E9E6F5" paint={appPainter(s)} />
          </AbsoluteFill>
          <div style={{position: 'absolute', right: 300, top: 360, opacity: ramp(s, 85.0, 85.3)}}>
            <div style={{width: 300, height: 600}} />
            <div style={{textAlign: 'center', marginTop: 16, fontFamily: F.readex, fontWeight: 700, fontSize: 40, color: INK, direction: 'rtl'}}>كيف يشتغل تطبيق</div>
          </div>
          <div style={{position: 'absolute', left: 300, top: 420, opacity: ramp(s, 86.6, 86.9), transform: `translateY(${(1 - pop(s, 86.62)) * 60}px)`}}>
            <div style={{position: 'relative', width: 300, height: 300}}>
              <Donut v={0.87 * ramp(s, 86.7, 87.8, easeOut)} />
              <Center>
                <div style={{fontFamily: F.readex, fontWeight: 700, fontSize: 80, color: INK}}>{ar(Math.round(87 * ramp(s, 86.7, 87.8, easeOut)))}٪</div>
              </Center>
            </div>
            <div style={{textAlign: 'center', marginTop: 40, fontFamily: F.readex, fontWeight: 700, fontSize: 40, color: INK, direction: 'rtl'}}>أرقام وإحصائيات</div>
          </div>
        </AbsoluteFill>
      )}

      {/* ---- Easing ---- */}
      {s >= 88.0 && (
        <AbsoluteFill style={{opacity: easeO}}>
          <div style={{position: 'absolute', top: 120, width: '100%', textAlign: 'center'}}>
            <div style={{fontFamily: F.readex, fontWeight: 500, fontSize: 46, color: MUTED, direction: 'rtl', opacity: ramp(s, 88.2, 88.5)}}>والسر في شي اسمه</div>
            <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 130, color: P, letterSpacing: 10, transform: `scale(${mix(1.3, 1, pop(s, 89.86, {damping: 10}))})`, opacity: ramp(s, 89.8, 90.0)}}>EASING</div>
          </div>
          {[
            {y: 520, label: 'آلي', sub: 'سرعة وحدة', v: lin, c: '#B9B5D3', good: false},
            {y: 760, label: 'طبيعي', sub: 'بهدوء ← يسرع ← يهدأ', v: eio, c: P, good: true},
          ].map((row) => {
            const x = mix(xFrom, xTo, row.v);
            const trail = Array.from({length: 13}, (_, k) => k / 12).filter((k) => tA + k * (tB - tA) <= s);
            const trailX = (k: number) => mix(xFrom, xTo, row.good ? (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2) : k);
            return (
              <div key={row.y} style={{position: 'absolute', left: 0, top: row.y, width: 1920, opacity: ramp(s, 90.6, 91.0)}}>
                <div style={{position: 'absolute', left: xTo, width: xFrom - xTo + 80, top: 38, height: 4, background: '#E1DDF5', borderRadius: 2}} />
                {trail.map((k) => (
                  <div key={k} style={{position: 'absolute', left: trailX(k) + 30, top: 30, width: 20, height: 20, borderRadius: '50%', background: row.c, opacity: 0.35}} />
                ))}
                <div style={{position: 'absolute', left: x, top: 0, width: 80, height: 80, borderRadius: '50%', background: row.c, boxShadow: row.good ? `0 10px 30px rgba(91,76,245,.45)` : 'none'}} />
                <div style={{position: 'absolute', left: xFrom + 120, top: -6, width: 260, textAlign: 'right', direction: 'rtl'}}>
                  <div style={{fontFamily: F.readex, fontWeight: 700, fontSize: 48, color: row.good ? P : MUTED}}>{row.label}</div>
                  <div style={{fontFamily: F.mono, fontSize: 22, color: MUTED}}>{row.good ? 'EASE IN-OUT' : 'LINEAR'}</div>
                </div>
              </div>
            );
          })}
          {/* the three phases spoken in the voice */}
          {[
            {t: 'بهدوء', at: 91.96, x: 1380},
            {t: 'تسرع', at: 92.68, x: 900},
            {t: 'تهدأ', at: 94.1, x: 420},
          ].map((w) => (
            <div key={w.t} style={{position: 'absolute', left: w.x - 60, top: 880, width: 240, textAlign: 'center', fontFamily: F.readex, fontWeight: 700, fontSize: 44, color: INK, direction: 'rtl', opacity: ramp(s, w.at, w.at + 0.2), transform: `translateY(${(1 - pop(s, w.at)) * 20}px)`}}>
              {w.t}
            </div>
          ))}
          <div style={{position: 'absolute', left: 0, right: 0, top: 960, textAlign: 'center', fontFamily: F.readex, fontWeight: 500, fontSize: 34, color: C, direction: 'rtl', opacity: ramp(s, 94.74, 95.0)}}>
            زي أي حركة طبيعية في الحياة
          </div>
        </AbsoluteFill>
      )}

      <ChapterTag n={3} en="MOTION GRAPHICS" color={MUTED} at={72.6} />
    </AbsoluteFill>
  );
};
