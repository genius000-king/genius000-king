import React from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, Easing} from 'remotion';
import {COLOR, EASE, FONT, SPACE, TYPE} from '../design/tokens';
import {enter, ramp} from '../design/motion';
import {Scene, Split, Statement, Col, Row} from '../components/Layout';
import {Chip, Kicker, Lead, Mono, Title} from '../components/Type';
import {Card, Panel} from '../components/Card';
import {BitStream, Callout, CELL_W, CELL_H, Domain, Head, Measure} from '../components/Magnetics';

const bez = Easing.bezier(EASE[0], EASE[1], EASE[2], EASE[3]);

/* =================================================================== */
/* A — 0:15 Anatomy. An exploded isometric drive.                       */
/* =================================================================== */

const Platter: React.FC<{y: number; o: number; film?: number; scale?: number}> = ({
  y, o, film = 0, scale = 1,
}) => (
  <g transform={`translate(0, ${y}) scale(${scale})`} opacity={o}>
    <ellipse cx={0} cy={10} rx={300} ry={96} fill="rgba(22,34,46,0.13)" />
    <ellipse cx={0} cy={0} rx={300} ry={96} fill="#C9C4BA" />
    <ellipse cx={0} cy={-5} rx={300} ry={96} fill="#EFECE5" />
    {/* The film is a surface sheen, not a slab of colour — it is nanometres thick. */}
    <ellipse cx={0} cy={-5} rx={300} ry={96} fill={COLOR.north} opacity={0.07 * film} />
    <ellipse cx={0} cy={-5} rx={300} ry={96} fill="none" stroke={COLOR.north} strokeWidth={2} opacity={0.55 * film} />
    <ellipse cx={0} cy={-5} rx={58} ry={19} fill={COLOR.paper} stroke={COLOR.inkFaint} />
  </g>
);

/** The magnified slice. Where the "thin layer" claim becomes visible. */
const CrossSection: React.FC<{on: number; film: number}> = ({on, film}) => {
  const LAYERS = [
    {h: 96, fill: '#D6D1C7', label: 'القاعدة', sub: 'ألومنيوم أو زجاج'},
    {h: 52, fill: COLOR.north, label: 'الغشاء المغناطيسي', sub: 'هنا تعيش المعلومة'},
    {h: 30, fill: 'rgba(22,34,46,0.30)', label: 'طبقة حماية', sub: 'كربون + مزلّق'},
  ];
  let y = 0;
  return (
    <g opacity={on}>
      <rect x={-8} y={-8} width={296} height={194} rx={14} fill={COLOR.card} stroke={COLOR.line} />
      {LAYERS.map((l, i) => {
        const top = y;
        y += l.h;
        const reveal = interpolate(on, [i * 0.18, i * 0.18 + 0.42], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });
        const isFilm = i === 1;
        return (
          <g key={l.label} opacity={reveal}>
            <rect
              x={0}
              y={top}
              width={280}
              height={l.h}
              fill={l.fill}
              opacity={isFilm ? 0.30 + 0.55 * film : 1}
            />
            {isFilm ? (
              <rect x={0} y={top} width={280} height={l.h} fill="none" stroke={COLOR.north} strokeWidth={2.5} />
            ) : null}
            <line
              x1={280} y1={top + l.h / 2}
              x2={316} y2={i * 62 + 30}
              stroke={COLOR.inkFaint} strokeWidth={1.2}
            />
            <line x1={316} y1={i * 62 + 30} x2={330} y2={i * 62 + 30} stroke={COLOR.inkFaint} strokeWidth={1.2} />
            <text
              x={340} y={i * 62 + 21}
              fontFamily={FONT.sans} fontSize={21}
              fontWeight={isFilm ? 700 : 500}
              fill={isFilm ? COLOR.north : COLOR.inkSoft}
              dominantBaseline="middle" direction="rtl" textAnchor="end"
            >{l.label}</text>
            <text
              x={340} y={i * 62 + 45}
              fontFamily={FONT.sans} fontSize={17}
              fill={COLOR.inkMute}
              dominantBaseline="middle" direction="rtl" textAnchor="end"
            >{l.sub}</text>
          </g>
        );
      })}
      <text
        x={140} y={212} textAnchor="middle"
        fontFamily={FONT.sans} fontSize={16} fill={COLOR.inkMute}
        direction="rtl" opacity={0.8}
      >المقطع مكبّر — ليس بمقياس رسم</text>
    </g>
  );
};

export const SceneHddAnatomy: React.FC = () => {
  const frame = useCurrentFrame();

  const build = ramp(frame, 8, 40);
  const film = ramp(frame, 300, 50);
  const cross = ramp(frame, 380, 70);
  const spin = frame * 2.2;

  return (
    <Scene>
      <div style={{flex: 1, display: 'grid', gridTemplateColumns: '60% 40%', alignItems: 'center', gap: SPACE.lg}}>
        <svg viewBox="-400 -300 1020 660" style={{width: '100%', maxHeight: 820}}>
          <Platter y={-40} o={build} film={film} />

          {/* Actuator arm, with a visible slider riding the surface. */}
          <g opacity={build} transform={`translate(0,-45) rotate(${-16 + Math.sin(spin / 34) * 6}, 330, 0)`}>
            <circle cx={330} cy={0} r={24} fill={COLOR.ink} />
            <rect x={78} y={-8} width={256} height={16} rx={8} fill={COLOR.inkSoft} />
            <path d="M46 -13 L92 -13 L84 20 L54 20 Z" fill={COLOR.ink} />
          </g>

          {/* The magnifier: a ring on the platter joined to the slice. */}
          <g opacity={cross}>
            <circle cx={-160} cy={-30} r={34} fill="none" stroke={COLOR.amber} strokeWidth={2.5} />
            <line x1={-133} y1={-8} x2={-60} y2={96} stroke={COLOR.amber} strokeWidth={1.5} opacity={0.6} />
          </g>
          <g transform="translate(-60, 104)">
            <CrossSection on={cross} film={film} />
          </g>
        </svg>

        <Col gap={SPACE.md}>
          <Kicker delay={6}>تشريح</Kicker>
          <Title delay={12} size={TYPE.h1}>القرص الصلب<br />من الداخل</Title>
          <Lead delay={26}>
            القرص يدور، والذراع يمسح فوقه. لكن المعلومات ليست في المعدن —
            بل في غشاء أرقّ من أن تراه.
          </Lead>
          <Card delay={330} pad={SPACE.md} accent={COLOR.north}>
            <Lead delay={340} size={TYPE.small} style={{maxWidth: '32ch'}}>
              الغشاء المغناطيسي سماكته بالنانومترات — وهو كل ما يهم في القرص.
            </Lead>
          </Card>
        </Col>
      </div>
    </Scene>
  );
};

/* =================================================================== */
/* B — 0:35 The head, then the stack.                                   */
/* =================================================================== */

export const SceneHddHead: React.FC = () => {
  const frame = useCurrentFrame();
  const readIn = ramp(frame, 20, 34);
  const stack = ramp(frame, 250, 50);

  return (
    <Scene>
      <div style={{flex: 1, display: 'grid', gridTemplateColumns: '58% 42%', alignItems: 'center', gap: SPACE.lg}}>
        <svg viewBox="-400 -300 800 600" style={{width: '100%', maxHeight: 760}}>
          {[0, 1, 2].map((i) => {
            const o = i === 1 ? 1 : stack;
            const dy = (i - 1) * (150 * (0.2 + 0.8 * (i === 1 ? 1 : stack)));
            return (
              <g key={i} opacity={o} transform={`translate(0, ${dy})`}>
                <rect x={-330} y={0} width={660} height={26} rx={13} fill="#E3DFD6" stroke={COLOR.inkFaint} />
                <rect x={-330} y={0} width={660} height={8} rx={4} fill={COLOR.north} opacity={0.35} />
                {/* One head per surface — the script's exact point. */}
                <g transform="translate(120, -78)">
                  <rect x={-6} y={0} width={12} height={62} rx={6} fill={COLOR.inkSoft} />
                  <path d="M-30 58 L30 58 L20 82 L-20 82 Z" fill={COLOR.ink} />
                </g>
              </g>
            );
          })}

          <Callout
            from={[120, -20]}
            to={[-230, -210]}
            label="الإبرة"
            sub="تقرأ وتكتب. لا شيء غير ذلك"
            on={readIn}
            anchor="middle"
          />
          <Measure
            x={-330}
            y={250}
            width={660}
            label="كل طبقة ← إبرة خاصة بها"
            on={stack}
            color={COLOR.navy}
          />
        </svg>

        <Col gap={SPACE.md}>
          <Kicker delay={6}>آلية العمل</Kicker>
          <Title delay={12} size={TYPE.h1}>إبرة واحدة.<br />وظيفتان.</Title>
          <Lead delay={26}>
            الكتابة والقراءة. ولأن الأقراص طبقات فوق بعضها، لكل سطح إبرته —
            وهكذا تتضاعف المساحة.
          </Lead>
          <Card delay={260} pad={SPACE.md} accent={COLOR.navy}>
            <Lead delay={268} size={TYPE.small} style={{maxWidth: '30ch'}}>
              ٣ أقراص ← ٦ أسطح ← ٦ إبر تعمل في اللحظة نفسها.
            </Lead>
          </Card>
        </Col>
      </div>
    </Scene>
  );
};

/* =================================================================== */
/* C — 0:52 Zoom to the surface. Poles defined — correctly.             */
/* =================================================================== */

const POLES = [true, true, false, false, false, true, false, false, true, true];

export const SceneDomains: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const zoom = ramp(frame, 6, 44);
  const poleDef = ramp(frame, 180, 40);
  const fill = ramp(frame, 430, 110);

  return (
    <Scene>
      <Col gap={SPACE.xl} style={{flex: 1, justifyContent: 'center', maxWidth: 1560, margin: '0 auto', width: '100%'}}>
        <Row gap={SPACE.lg} style={{justifyContent: 'space-between', alignItems: 'flex-end'}}>
          <Col gap={SPACE.sm}>
            <Kicker delay={4}>تكبير على السطح</Kicker>
            <Title delay={10} size={TYPE.h2}>مناطق ممغنطة، صغيرة جدًا</Title>
          </Col>

          {/* The pole legend. Rendered correctly: N is north, S is south. */}
          <Row gap={SPACE.md} style={{opacity: poleDef}}>
            <Row gap={10}>
              <div style={{width: 40, height: 40, borderRadius: 10, background: COLOR.north, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.mono, fontWeight: 700, fontSize: 22}}>N</div>
              <span style={{fontSize: TYPE.small, fontWeight: 600}}>شمالي</span>
            </Row>
            <Row gap={10}>
              <div style={{width: 40, height: 40, borderRadius: 10, background: COLOR.south, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.mono, fontWeight: 700, fontSize: 22}}>S</div>
              <span style={{fontSize: TYPE.small, fontWeight: 600}}>جنوبي</span>
            </Row>
          </Row>
        </Row>

        <div style={{transform: `scale(${0.94 + zoom * 0.06})`, transformOrigin: 'center'}}>
          <svg viewBox="0 -20 1000 160" style={{width: '100%'}}>
            {POLES.map((up, i) => (
              <Domain
                key={i}
                x={i * CELL_W + 20}
                up={up}
                on={ramp(frame, 430 + i * 9, 22)}
              />
            ))}
            {/* Before the poles land, show the empty track so the viewer sees
                that the cells exist independently of what is stored in them. */}
            {POLES.map((_, i) => (
              <rect
                key={`e${i}`}
                x={i * CELL_W + 22}
                y={0}
                width={CELL_W - 4}
                height={CELL_H}
                rx={10}
                fill="none"
                stroke={COLOR.line}
                opacity={zoom * (1 - fill)}
              />
            ))}
          </svg>
        </div>

        <Row gap={SPACE.md} style={{justifyContent: 'center'}}>
          <Lead delay={200} align="center" style={{maxWidth: '54ch', textAlign: 'center'}}>
            لكل منطقة اتجاه واحد فقط: قطباها شمالي وجنوبي. عبّئ السطح كله
            باتجاهات عشوائية — ثم أطلق الإبرة.
          </Lead>
        </Row>
      </Col>
    </Scene>
  );
};

/* =================================================================== */
/* D — 1:19 The centrepiece: what the head actually reads.              */
/* =================================================================== */

/** 1 wherever the pole flips relative to the previous cell. */
const BITS = POLES.map((p, i) => (i === 0 ? '0' : p === POLES[i - 1] ? '0' : '1'));

export const SceneFluxReversal: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const PH_COIL = 0;      // 0:00 — the coil itself
  const PH_NAIVE = 250;   // 0:08 — the obvious-but-wrong idea
  const PH_SWEEP = 470;   // 0:16 — the head traverses
  const SWEEP_LEN = 560;
  const PH_SUM = 1090;

  const coil = ramp(frame, PH_COIL + 10, 36);
  const naive = ramp(frame, PH_NAIVE, 26);
  const strike = ramp(frame, PH_NAIVE + 150, 30);

  const sweepT = interpolate(frame, [PH_SWEEP, PH_SWEEP + SWEEP_LEN], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.linear,
  });
  const headX = 20 + sweepT * (POLES.length * CELL_W);
  // A bit is emitted the instant the head crosses a cell boundary.
  const crossed = Math.max(0, Math.min(POLES.length, sweepT * POLES.length));
  const sum = ramp(frame, PH_SUM, 34);

  return (
    <Scene>
      <Col gap={SPACE.md} style={{flex: 1, justifyContent: 'center', maxWidth: 1560, margin: '0 auto', width: '100%'}}>
        <Row style={{justifyContent: 'flex-start', alignItems: 'flex-end', gap: SPACE.xl}}>
          <Col gap={SPACE.sm}>
            <Kicker delay={4}>القراءة</Kicker>
            <Title delay={10} size={TYPE.h2}>
              {frame < PH_SWEEP ? 'الكويل لا يقرأ الأقطاب' : 'يقرأ التغيّر وحده'}
            </Title>
          </Col>

          <div style={{opacity: naive, position: 'relative', alignSelf: 'flex-end'}}>
            <Card
              delay={PH_NAIVE}
              pad={SPACE.md}
              elevation="flat"
              style={{background: 'transparent', border: `1px dashed ${COLOR.lineStrong}`}}
            >
              <Row gap={SPACE.md}>
                <span style={{fontSize: TYPE.small, color: COLOR.inkMute}}>الفكرة البديهية:</span>
                <Mono style={{fontSize: TYPE.small, color: COLOR.inkMute}}>S = 1</Mono>
                <Mono style={{fontSize: TYPE.small, color: COLOR.inkMute}}>N = 0</Mono>
              </Row>
            </Card>
            <div
              style={{
                position: 'absolute',
                top: '52%',
                insetInlineEnd: 0,
                height: 2,
                width: `${strike * 100}%`,
                background: COLOR.danger,
                borderRadius: 2,
              }}
            />
            <div style={{opacity: strike, fontSize: TYPE.label, color: COLOR.danger, marginTop: 8, fontWeight: 600, textAlign: 'right'}}>
              ليست كذلك
            </div>
          </div>
        </Row>

        <svg viewBox="0 -150 1010 390" style={{width: '100%', display: 'block'}}>
          {POLES.map((up, i) => {
            // The cell the head is currently over gets the highlight ring.
            const over = crossed > i && crossed < i + 1;
            return (
              <Domain
                key={i}
                x={i * CELL_W + 20}
                up={up}
                on={1}
                highlight={over}
                dim={frame > PH_SWEEP && crossed < i}
              />
            );
          })}

          {/* Boundary markers: every place a bit can be born. */}
          {POLES.map((up, i) => {
            if (i === 0) return null;
            const isFlip = up !== POLES[i - 1];
            const passed = crossed >= i;
            return (
              <line
                key={`b${i}`}
                x1={i * CELL_W + 20}
                y1={-14}
                x2={i * CELL_W + 20}
                y2={CELL_H + 14}
                stroke={isFlip ? COLOR.amber : COLOR.inkFaint}
                strokeWidth={isFlip ? 3 : 1.5}
                strokeDasharray={isFlip ? undefined : '4 6'}
                opacity={passed ? (isFlip ? 1 : 0.5) : 0.12}
              />
            );
          })}

          {frame >= PH_SWEEP - 30 ? (
            <Head x={headX - 45} current={0} label="الإبرة" />
          ) : (
            <g opacity={coil} transform="translate(420, -40)">
              <Head x={0} current={0} label="الكويل" />
            </g>
          )}

          <BitStream bits={BITS} revealed={crossed} x={20} y={CELL_H + 46} highlightLast />
        </svg>

        <Row gap={SPACE.md} style={{justifyContent: 'center', opacity: sum}}>
          <Card delay={PH_SUM} pad={SPACE.lg} accent={COLOR.amber} style={{maxWidth: 1080}}>
            <Lead delay={PH_SUM + 8} align="center" style={{maxWidth: 'none', textAlign: 'center', fontSize: TYPE.h3, color: COLOR.ink, lineHeight: 1.5}}>
              الإبرة لا تسأل «هل هذا شمالي أم جنوبي؟».
              <br />
              تسأل: <strong style={{color: COLOR.amber}}>هل تغيّر؟</strong> — تغيّر ← ١، لم يتغيّر ← ٠.
            </Lead>
          </Card>
        </Row>
      </Col>
    </Scene>
  );
};

/* =================================================================== */
/* E — 2:05 Writing: current direction decides the field direction.     */
/* =================================================================== */

export const SceneWriting: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const intro = ramp(frame, 8, 34);
  const flipCycle = ramp(frame, 200, 40);
  // Current reverses twice so the cause/effect pairing is unmistakable.
  const dir = frame < 430 ? 1 : frame < 700 ? -1 : 1;
  const writeStart = 760;
  const sweepT = interpolate(frame, [writeStart, writeStart + 380], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.linear,
  });
  const headX = 20 + sweepT * (POLES.length * CELL_W);
  const written = sweepT * POLES.length;
  const glow = frame > writeStart ? 1 : 0;

  return (
    <Scene>
      <Col gap={SPACE.md} style={{flex: 1, justifyContent: 'center', maxWidth: 1560, margin: '0 auto', width: '100%'}}>
        <Row style={{justifyContent: 'space-between', alignItems: 'flex-end'}}>
          <Col gap={SPACE.sm}>
            <Kicker delay={4}>الكتابة</Kicker>
            <Title delay={10} size={TYPE.h2}>نفس الكويل. لكن بالعكس.</Title>
          </Col>
          <Row gap={SPACE.sm} style={{opacity: flipCycle}}>
            <Chip delay={200} color={dir > 0 ? COLOR.north : COLOR.south} solid>
              {dir > 0 ? 'تيار طبيعي ← مجال شمالي' : 'تيار معكوس ← مجال جنوبي'}
            </Chip>
          </Row>
        </Row>

        <svg viewBox="0 -160 1010 400" style={{width: '100%', display: 'block'}}>
          {POLES.map((up, i) => {
            const nowWritten = written > i + 0.5;
            return (
              <Domain
                key={i}
                x={i * CELL_W + 20}
                // Everything the head passes becomes north — one uniform write.
                up={nowWritten ? dir > 0 : up}
                on={1}
                highlight={written > i && written < i + 1}
                dim={false}
              />
            );
          })}

          <g opacity={intro}>
            <Head
              x={(frame > writeStart ? headX : 440) - 45}
              current={dir}
              glow={glow}
              label="الكويل"
            />
          </g>

          {/* Current arrow — the cause, drawn above the effect. */}
          <g opacity={flipCycle} transform={`translate(${(frame > writeStart ? headX : 440) - 45}, -132)`}>
            <line x1={dir > 0 ? 0 : 92} y1={0} x2={dir > 0 ? 84 : 8} y2={0} stroke={dir > 0 ? COLOR.north : COLOR.south} strokeWidth={4} strokeLinecap="round" />
            <path
              d={dir > 0 ? 'M84 -9 L96 0 L84 9 Z' : 'M8 -9 L-4 0 L8 9 Z'}
              fill={dir > 0 ? COLOR.north : COLOR.south}
            />
          </g>
        </svg>

        <Row gap={SPACE.md} style={{justifyContent: 'center'}}>
          <Lead delay={30} align="center" style={{maxWidth: '58ch', textAlign: 'center'}}>
            الكويل لا يقرأ فقط — يصنع مجاله المغناطيسي الخاص. اعكس اتجاه الكهرباء،
            ينعكس المجال، وتنقلب المنطقة التي تمر فوقها.
          </Lead>
        </Row>
      </Col>
    </Scene>
  );
};

/* =================================================================== */
/* F — 2:46 Electricity and magnetism are one thing.                    */
/* =================================================================== */

export const SceneEMUnity: React.FC = () => {
  const frame = useCurrentFrame();
  const merge = ramp(frame, 40, 60);
  const shift = (1 - merge) * 190;

  return (
    <Statement>
      <Kicker delay={6} align="center">قاعدة تحتها كل ما سبق</Kicker>
      <svg viewBox="-360 -170 720 340" style={{width: 860}}>
        <g transform={`translate(${-shift}, 0)`}>
          <circle cx={-90} cy={0} r={126} fill={COLOR.north} opacity={0.17} />
          <text x={-90} y={10} textAnchor="middle" fontSize={34} fontWeight={600} fill={COLOR.north} fontFamily={FONT.sans} direction="rtl">كهرباء</text>
        </g>
        <g transform={`translate(${shift}, 0)`}>
          <circle cx={90} cy={0} r={126} fill={COLOR.south} opacity={0.17} />
          <text x={90} y={10} textAnchor="middle" fontSize={34} fontWeight={600} fill={COLOR.south} fontFamily={FONT.sans} direction="rtl">مغناطيس</text>
        </g>
        <text
          x={0}
          y={10}
          textAnchor="middle"
          fontSize={30}
          fontWeight={700}
          fill={COLOR.ink}
          fontFamily={FONT.sans}
          direction="rtl"
          opacity={merge}
        >
          وجهان
        </text>
      </svg>
      <Title delay={110} size={TYPE.h2} align="center" style={{maxWidth: '24ch'}}>
        ليسا صديقين. هما شيء واحد.
      </Title>
    </Statement>
  );
};

/* =================================================================== */
/* G — 2:56 Where do deleted files actually go?                         */
/* =================================================================== */

const FILES = [
  {name: 'report.pdf', sector: '0x1A4F'},
  {name: 'photo_01.jpg', sector: '0x22B0'},
  {name: 'secret.txt', sector: '0x39C1'},
  {name: 'notes.md', sector: '0x4D7E'},
];

export const SceneDeleteMyth: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const q = ramp(frame, 10, 34);
  const tableIn = ramp(frame, 150, 40);
  const deleteAt = 470;
  const deleted = ramp(frame, deleteAt, 24);
  const verdict = ramp(frame, 900, 40);

  return (
    <Scene>
      <Col gap={SPACE.lg} style={{flex: 1, justifyContent: 'center'}}>
        <Col gap={SPACE.sm} style={{opacity: q}}>
          <Kicker delay={6}>السؤال الذي يتكرر في كل مكان</Kicker>
          <Title delay={12} size={TYPE.h2}>«أين تذهب الملفات المحذوفة؟»</Title>
        </Col>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE.lg, alignItems: 'start'}}>
          {/* Left: the index. This is the only thing a delete touches. */}
          <Panel title="فهرس الملفات" delay={150} badge={<Chip delay={160} color={COLOR.navy}>العنوان</Chip>}>
            <Col gap={10}>
              {FILES.map((f, i) => {
                const gone = i === 2 ? deleted : 0;
                return (
                  <Row
                    key={f.name}
                    style={{
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: 12,
                      background: gone > 0.5 ? 'rgba(179,38,30,0.06)' : 'rgba(22,34,46,0.03)',
                      opacity: (tableIn) * (1 - gone * 0.55),
                      border: `1px solid ${gone > 0.5 ? 'rgba(179,38,30,0.25)' : COLOR.line}`,
                    }}
                  >
                    <Mono style={{fontSize: TYPE.small, color: gone > 0.5 ? COLOR.danger : COLOR.ink, textDecoration: gone > 0.5 ? 'line-through' : 'none'}}>
                      {f.name}
                    </Mono>
                    <Mono style={{fontSize: TYPE.label, color: COLOR.inkMute, textDecoration: gone > 0.5 ? 'line-through' : 'none'}}>
                      {f.sector}
                    </Mono>
                  </Row>
                );
              })}
            </Col>
          </Panel>

          {/* Right: the platter. Nothing happens here. That is the point. */}
          <Panel title="السطح المغناطيسي" delay={190} badge={<Chip delay={200} color={COLOR.north}>البيانات</Chip>}>
            <svg viewBox="0 -8 560 140" style={{width: '100%'}}>
              {POLES.slice(0, 6).map((up, i) => (
                <Domain key={i} x={i * 92} up={up} on={ramp(frame, 200 + i * 7, 20)} />
              ))}
            </svg>
            <Row gap={10} style={{marginTop: SPACE.sm, opacity: deleted}}>
              <span style={{fontSize: TYPE.small, fontWeight: 600, color: COLOR.good}}>
                لم يتغيّر شيء. ولا بِت واحد.
              </span>
            </Row>
          </Panel>
        </div>

        <Card delay={900} pad={SPACE.lg} accent={COLOR.danger} style={{opacity: verdict}}>
          <Row gap={SPACE.lg} style={{justifyContent: 'space-between'}}>
            <Lead delay={910} style={{maxWidth: '46ch', fontSize: TYPE.h3, color: COLOR.ink, lineHeight: 1.45}}>
              الحذف يشطب <strong>العنوان</strong> فقط. الحالة المغناطيسية باقية كما هي.
            </Lead>
            <Chip delay={950} color={COLOR.danger} solid size={TYPE.h3}>
              قابلة للاسترجاع — نعم
            </Chip>
          </Row>
        </Card>
      </Col>
    </Scene>
  );
};
