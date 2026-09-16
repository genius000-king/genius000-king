import React from 'react';
import {useCurrentFrame, interpolate, Easing, AbsoluteFill} from 'remotion';
import {COLOR, EASE, FONT, SPACE, TYPE} from '../design/tokens';
import {ramp, enter} from '../design/motion';
import {makeRng, range} from '../design/rng';
import {Scene, Statement, Col, Row} from '../components/Layout';
import {Chip, Kicker, Lead, Mono, Title} from '../components/Type';
import {Card, Panel} from '../components/Card';

const bez = Easing.bezier(EASE[0], EASE[1], EASE[2], EASE[3]);
const N = COLOR.neuron;

/* ------------------------------------------------------------------ */
/* A shared neuron field. Every brain scene lights the SAME nodes in    */
/* different combinations — which is the chapter's entire argument.     */
/* ------------------------------------------------------------------ */

const FIELD = (() => {
  const rng = makeRng(90210);
  const nodes = range(46).map((i) => ({
    x: 70 + rng() * 620,
    y: 60 + rng() * 380,
    r: 5 + rng() * 4,
    ph: rng() * 6.28,
  }));
  const edges: [number, number][] = [];
  nodes.forEach((a, i) =>
    nodes.forEach((b, j) => {
      if (j <= i) return;
      if (Math.hypot(a.x - b.x, a.y - b.y) < 132) edges.push([i, j]);
    })
  );
  return {nodes, edges};
})();

/** A pattern is just a set of node indices. Nothing is stored "at" a node. */
const PATTERNS: Record<string, number[]> = {
  arrow: [2, 7, 11, 18, 23, 29, 34, 40],
  house: [2, 9, 11, 21, 23, 31, 36, 40],
  face: [4, 7, 15, 18, 26, 29, 33, 44],
};

const NeuronField: React.FC<{
  active?: number[];
  intensity?: number;
  showAll?: number;
  width?: number;
  /** Strengthens the active path — used for the Hebbian scene. */
  weight?: number;
}> = ({active = [], intensity = 1, showAll = 1, width = 760, weight = 0}) => {
  const frame = useCurrentFrame();
  const set = new Set(active);

  return (
    <svg viewBox="0 0 760 500" style={{width, overflow: 'visible'}}>
      {FIELD.edges.map(([i, j], k) => {
        const hot = set.has(i) && set.has(j);
        const a = FIELD.nodes[i];
        const b = FIELD.nodes[j];
        return (
          <line
            key={k}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={hot ? N : 'rgba(255,255,255,0.26)'}
            strokeWidth={hot ? 2.5 + weight * 4 : 1}
            opacity={hot ? 1 : 0.34 * showAll}
          />
        );
      })}
      {FIELD.nodes.map((n, i) => {
        const hot = set.has(i);
        const live = 0.7 + 0.3 * Math.sin(frame / 16 + n.ph);
        return (
          <g key={i}>
            {hot ? (
              <circle cx={n.x} cy={n.y} r={n.r * 3.4} fill={N} opacity={0.20 * intensity * live} />
            ) : null}
            <circle
              cx={n.x}
              cy={n.y}
              r={hot ? n.r * 1.5 : n.r}
              fill={hot ? N : 'rgba(255,255,255,0.50)'}
              opacity={hot ? intensity : 0.55 * showAll}
            />
          </g>
        );
      })}
    </svg>
  );
};

/* =================================================================== */
/* N1 — 12:03 The number. Then what the number actually means.          */
/* =================================================================== */

export const SceneBrainScale: React.FC = () => {
  const frame = useCurrentFrame();
  const few = ramp(frame, 20, 40);
  const many = ramp(frame, 260, 70);
  const count = Math.floor(interpolate(frame, [280, 560], [6, 86], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: bez,
  }));

  return (
    <Scene tone="night">
      <Col gap={SPACE.lg} style={{flex: 1, justifyContent: 'center', maxWidth: 1600, margin: '0 auto', width: '100%'}}>
        <Row style={{justifyContent: 'space-between', alignItems: 'flex-end'}}>
          <Col gap={SPACE.sm}>
            <Kicker delay={4} night>بونص</Kicker>
            <Title delay={10} night size={TYPE.h2}>والمخ؟ كيف يخزّن هو؟</Title>
          </Col>
          <div style={{opacity: many, textAlign: 'left'}}>
            <Mono style={{fontSize: 74, fontWeight: 700, color: N}}>{count}</Mono>
            <span style={{fontSize: TYPE.h3, color: COLOR.nightMute, marginInlineStart: 12}}>مليار خلية</span>
          </div>
        </Row>

        <Row style={{justifyContent: 'center'}}>
          <div style={{opacity: 1, position: 'relative'}}>
            <NeuronField showAll={many} active={[]} width={1100} />
          </div>
        </Row>

        <Lead delay={600} night align="center" style={{maxWidth: '58ch', textAlign: 'center', margin: '0 auto'}}>
          كل خلية موصولة بآلاف غيرها، تتحدث معها بالكهرباء. العدد ليس هو المدهش —
          بل ما يفعله الاتصال.
        </Lead>
      </Col>
    </Scene>
  );
};

/* =================================================================== */
/* N2 — 12:34 Not an address. A pattern.                                */
/* =================================================================== */

export const SceneBrainPatterns: React.FC = () => {
  const frame = useCurrentFrame();

  const p1 = ramp(frame, 120, 44);
  const p2 = ramp(frame, 520, 44);
  const punch = ramp(frame, 900, 50);
  // Which pattern is lit right now.
  const active = frame < 500 ? PATTERNS.arrow : PATTERNS.house;

  return (
    <Scene tone="night">
      <Col gap={SPACE.lg} style={{flex: 1, justifyContent: 'center', maxWidth: 1620, margin: '0 auto', width: '100%'}}>
        <Row style={{justifyContent: 'space-between', alignItems: 'flex-end'}}>
          <Col gap={SPACE.sm}>
            <Kicker delay={4} night>الفرق الجوهري</Kicker>
            <Title delay={10} night size={TYPE.h2}>لا عنوان. نمط.</Title>
          </Col>
          <Chip delay={120} color={N} solid size={TYPE.h3}>
            {frame < 500 ? 'معلومة أولى' : 'معلومة ثانية'}
          </Chip>
        </Row>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 420px', gap: SPACE.xl, alignItems: 'center'}}>
          <Row style={{justifyContent: 'center'}}>
            <NeuronField active={active} intensity={frame < 500 ? p1 : p2} width={980} />
          </Row>

          <Col gap={SPACE.md}>
            <Card delay={60} night pad={SPACE.md} accent={COLOR.inkFaint}>
              <Col gap={8}>
                <span style={{fontSize: TYPE.label, color: COLOR.nightMute, fontWeight: 600}}>في الـ SSD</span>
                <Lead delay={70} night size={TYPE.small} style={{maxWidth: 'none'}}>
                  المعلومة في <strong>مكان</strong>. تعرف العنوان، تجد البيانات.
                </Lead>
              </Col>
            </Card>
            <Card delay={140} night pad={SPACE.md} accent={N}>
              <Col gap={8}>
                <span style={{fontSize: TYPE.label, color: N, fontWeight: 600}}>في المخ</span>
                <Lead delay={150} night size={TYPE.small} style={{maxWidth: 'none'}}>
                  المعلومة هي <strong>أي الخلايا اشتعلت معًا</strong>. لا مكان واحد
                  يمكن أن تشير إليه.
                </Lead>
              </Col>
            </Card>
          </Col>
        </div>

        <Card delay={900} night pad={SPACE.lg} accent={N} style={{opacity: punch}}>
          <Lead delay={910} night align="center" style={{maxWidth: 'none', textAlign: 'center', fontSize: TYPE.h3, lineHeight: 1.5, color: COLOR.nightInk}}>
            انتبه: بعض الخلايا نفسها اشتعلت في الحالتين — لكن <strong style={{color: N}}>مع رفقة مختلفة</strong>.
            فصارت معلومة أخرى تمامًا.
          </Lead>
        </Card>
      </Col>
    </Scene>
  );
};

/* =================================================================== */
/* N3 — 13:18 The demonstration. One shape, three readings.             */
/* =================================================================== */

export const SceneAmbiguousShape: React.FC = () => {
  const frame = useCurrentFrame();

  const P_ARROW = 60;
  const P_WIDEN = 420;
  const P_HOUSE = 640;
  const P_FACE = 1040;

  const draw = ramp(frame, P_ARROW, 50);
  const widen = ramp(frame, P_WIDEN, 60);
  const house = ramp(frame, P_HOUSE, 50);
  const face = ramp(frame, P_FACE, 60);

  // The body grows from a narrow shaft into a full wall. Same object.
  const bodyW = 150 + widen * 230;
  const bodyX = 250 - bodyW / 2;

  const label = frame < P_WIDEN + 40 ? 'سهم' : frame < P_FACE ? 'بيت' : 'وجه';
  const labelColor = frame < P_WIDEN + 40 ? COLOR.nightInk : frame < P_FACE ? '#8FB8E8' : N;
  const activePattern = frame < P_WIDEN + 40 ? PATTERNS.arrow : frame < P_FACE ? PATTERNS.house : PATTERNS.face;

  return (
    <Scene tone="night">
      <Col gap={SPACE.md} style={{flex: 1, justifyContent: 'center', maxWidth: 1660, margin: '0 auto', width: '100%'}}>
        <Row style={{justifyContent: 'space-between', alignItems: 'flex-end'}}>
          <Col gap={SPACE.sm}>
            <Kicker delay={4} night>تجربة</Kicker>
            <Title delay={10} night size={TYPE.h2}>شيء لم تره في حياتك قط</Title>
          </Col>
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: labelColor,
              transition: 'none',
              opacity: draw,
            }}
          >
            {label}
          </div>
        </Row>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE.xl, alignItems: 'center'}}>
          <Row style={{justifyContent: 'center'}}>
            <svg viewBox="-20 -20 540 470" style={{width: 640}}>
              {/* Roof / arrowhead — the one element that never changes. */}
              <path
                d="M250 20 L440 180 L60 180 Z"
                fill="rgba(255,255,255,0.90)"
                opacity={draw}
              />
              {/* Shaft / wall */}
              <rect
                x={bodyX}
                y={178}
                width={bodyW}
                height={212}
                fill="rgba(255,255,255,0.90)"
                opacity={draw}
              />

              {/* Door → mouth */}
              <g opacity={house}>
                <rect
                  x={215}
                  y={300 + face * 12}
                  width={70}
                  height={90 - face * 52}
                  rx={face * 26}
                  fill={COLOR.night}
                />
              </g>
              {/* Windows → eyes */}
              {[-1, 1].map((side) => (
                <g key={side} opacity={house}>
                  <rect
                    x={250 + side * 108 - 32}
                    y={218}
                    width={64}
                    height={64}
                    rx={face * 32}
                    fill={COLOR.night}
                  />
                  <circle
                    cx={250 + side * 108}
                    cy={250}
                    r={16 * face}
                    fill="rgba(255,255,255,0.92)"
                  />
                  <circle
                    cx={250 + side * 108 + side * 5}
                    cy={252}
                    r={7 * face}
                    fill={COLOR.night}
                  />
                </g>
              ))}
            </svg>
          </Row>

          <Row style={{justifyContent: 'center'}}>
            <NeuronField active={activePattern} intensity={draw} width={940} />
          </Row>
        </div>

        <Card delay={P_FACE + 120} night pad={SPACE.lg} accent={N}>
          <Lead delay={P_FACE + 130} night align="center" style={{maxWidth: 'none', textAlign: 'center', fontSize: TYPE.h3, lineHeight: 1.5, color: COLOR.nightInk}}>
            نفس الشكل. نفس الخلايا تقريبًا. ثلاث معلومات مختلفة —
            لأن <strong style={{color: N}}>النمط هو المعلومة</strong>.
          </Lead>
        </Card>
      </Col>
    </Scene>
  );
};

/* =================================================================== */
/* N4 — 14:20 Why this is the thing machines struggle with.             */
/* =================================================================== */

export const SceneRecognition: React.FC = () => {
  const frame = useCurrentFrame();
  const cards = ramp(frame, 60, 44);

  const POINTS = [
    {t: 'يتعرّف على ما لم يره', s: 'لأن التخزين نفسه أنماط، لا نسخ'},
    {t: 'يتحمّل النقص والتشويش', s: 'جزء من النمط يكفي لإشعال بقيته'},
    {t: 'يعيد استخدام الخلايا نفسها', s: 'السعة ليست مجموع المواقع'},
  ];

  return (
    <Scene tone="night">
      <Col gap={SPACE.xl} style={{flex: 1, justifyContent: 'center', maxWidth: 1560, margin: '0 auto', width: '100%'}}>
        <Col gap={SPACE.sm}>
          <Kicker delay={4} night>ما الذي يميّزه</Kicker>
          <Title delay={10} night size={TYPE.h2}>تمييز الأنماط — لا استرجاع الملفات</Title>
        </Col>

        <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: SPACE.lg}}>
          {POINTS.map((p, i) => (
            <Card key={p.t} delay={60 + i * 50} night pad={SPACE.lg} accent={N}>
              <Col gap={SPACE.sm}>
                <Mono style={{fontSize: TYPE.small, color: N, fontWeight: 700}}>
                  {String(i + 1).padStart(2, '0')}
                </Mono>
                <span style={{fontSize: TYPE.h3, fontWeight: 700, lineHeight: 1.3, color: COLOR.nightInk}}>{p.t}</span>
                <Lead delay={70 + i * 50} night size={TYPE.small} style={{maxWidth: 'none'}}>{p.s}</Lead>
              </Col>
            </Card>
          ))}
        </div>

        <Lead delay={300} night align="center" style={{maxWidth: '62ch', textAlign: 'center', margin: '0 auto'}}>
          ما زال تغييرًا لحالة فيزيائية — لكن ما يحدّد المعلومة ليس الحالة وحدها،
          بل من اشتعل معها.
        </Lead>
      </Col>
    </Scene>
  );
};

/* =================================================================== */
/* N5 — 14:52 How the brain "writes": it makes a path easier.           */
/* =================================================================== */

export const SceneHebbian: React.FC = () => {
  const frame = useCurrentFrame();

  // Five repetitions. Each one thickens the path and shortens the travel.
  const rep = Math.min(5, Math.floor(frame / 170));
  const weight = rep / 5;
  const within = (frame % 170) / 170;
  const pulse = within < 0.5 ? within * 2 : 0;

  return (
    <Scene tone="night">
      <Col gap={SPACE.lg} style={{flex: 1, justifyContent: 'center', maxWidth: 1620, margin: '0 auto', width: '100%'}}>
        <Row style={{justifyContent: 'space-between', alignItems: 'flex-end'}}>
          <Col gap={SPACE.sm}>
            <Kicker delay={4} night>الكتابة في المخ</Kicker>
            <Title delay={10} night size={TYPE.h2}>لا يغيّر الخلايا — يسهّل الطريق</Title>
          </Col>
          <Row gap={SPACE.sm}>
            <Chip delay={20} color={N} solid size={TYPE.h3}>
              التكرار {rep} / 5
            </Chip>
          </Row>
        </Row>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 400px', gap: SPACE.xl, alignItems: 'center'}}>
          <Row style={{justifyContent: 'center'}}>
            <NeuronField active={PATTERNS.face} intensity={0.55 + 0.45 * pulse} weight={weight} width={1000} />
          </Row>

          <Col gap={SPACE.md}>
            {/* Resistance falling is the whole mechanism, so it gets a meter. */}
            <Card night pad={SPACE.lg} delay={40}>
              <Col gap={SPACE.sm}>
                <span style={{fontSize: TYPE.label, color: COLOR.nightMute, fontWeight: 600}}>
                  مقاومة المسار
                </span>
                <div style={{height: 16, borderRadius: 8, background: 'rgba(255,255,255,0.10)', overflow: 'hidden'}}>
                  <div
                    style={{
                      width: `${(1 - weight * 0.82) * 100}%`,
                      height: '100%',
                      background: N,
                      borderRadius: 8,
                    }}
                  />
                </div>
                <Lead delay={50} night size={TYPE.small} style={{maxWidth: 'none'}}>
                  كل مرة يشتعل فيها النمط نفسه، يصبح اشتعاله المرة القادمة أسهل.
                </Lead>
              </Col>
            </Card>
            <Card night pad={SPACE.md} delay={120} accent={N}>
              <Lead delay={130} night size={TYPE.small} style={{maxWidth: 'none'}}>
                ولهذا يتعلّم المخ بالتكرار — لا لأنه ينسخ المعلومة خمس مرات،
                بل لأن الطريق إليها يقصُر.
              </Lead>
            </Card>
          </Col>
        </div>
      </Col>
    </Scene>
  );
};

/* =================================================================== */
/* N6 — 15:31 Out.                                                      */
/* =================================================================== */

export const SceneOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = ramp(frame, 20, 50);
  const bye = ramp(frame, 240, 50);

  return (
    <Scene tone="night" parallax={false}>
      <Col style={{flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.lg}}>
        <div style={{opacity: fade * 0.5, position: 'absolute'}}>
          <NeuronField active={PATTERNS.face} intensity={0.5} width={1500} />
        </div>

        <Col gap={SPACE.md} style={{alignItems: 'center', zIndex: 1}}>
          <Kicker delay={20} night align="center">من الحجر إلى الإلكترون إلى النمط</Kicker>
          <Title delay={40} night size={TYPE.h1} align="center" style={{maxWidth: '22ch'}}>
            كل ذاكرة هي أثر تركته على شيء ما
          </Title>
          <div style={{opacity: bye, marginTop: SPACE.lg}}>
            <span style={{fontSize: TYPE.h3, color: COLOR.nightMute}}>نشوفكم في المقطع الجاي</span>
          </div>
        </Col>
      </Col>
    </Scene>
  );
};
