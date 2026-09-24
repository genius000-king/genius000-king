// فيديو العرض: يستعرض كل أدوات المحرّك في 40 ثانية عن "الموائع".
// كل مشهد = كاميرا + خلفية + نص بشخصيته + أصوات مولودة من الحركة.
import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { fade } from "@remotion/transitions/fade";
import { ensureFonts } from "../theme/fonts";
import { GraphPaper, DarkStage } from "../bg/GraphPaper";
import { Camera } from "../fx/Camera";
import { Grain, Vignette } from "../fx/Finish";
import { BilingualSplit, CountUp, GlitchText, InkReveal, LiquidFill, SLAM_IMPACT, Slam, Typewriter, WordCascade } from "../text/Kinetic";
import { LogoReveal } from "../broll/LogoReveal";
import { MacWindow } from "../broll/MacWindow";
import { ScreenRec, Segment, segmentsFrames, recTimeToFrame } from "../broll/ScreenRec";
import { Sfx } from "../sfx/library";
import ytRec from "../../public/broll/rec/yt-fluids.json";

ensureFonts();

// مقاطع التسجيل: الكتابة بسرعة طبيعية، ثم التمرير مسرَّعاً ×2 (قصّ الانتظار الميت)
const SEGS: Segment[] = [
  { from: 7.9, to: 12.4 },
  { from: 17.4, to: 27.2, rate: 2 },
];

const T = 12; // طول الانتقال بالفريمات

export const SHOWCASE_SCENES = (fps: number) => {
  const recLen = segmentsFrames(SEGS, fps) + 30;
  return [150, 96, 66, 96, recLen, 90, 96, 110, 120, 120];
};

export const Showcase: React.FC = () => {
  const { fps } = useVideoConfig();
  const L = SHOWCASE_SCENES(fps);
  const k = (t: number) => recTimeToFrame(t, SEGS, fps) ?? 0;
  const click = k(ytRec.events.find((e) => e.type === "click")!.t);
  const enter = k(ytRec.events.find((e) => e.type === "enter")!.t);
  const seg2 = segmentsFrames([SEGS[0]], fps);
  // لقطات التركيز داخل نافذة الماك (بزمن المشهد، والتسجيل يبدأ بعد 20 فريم دخول)
  const off = 20;
  const zoom = [
    { at: 0, scale: 1, x: 0.5, y: 0.5 },
    { at: off + click - 4, scale: 2.3, x: 0.42, y: 0.02 },
    { at: off + enter + 10, scale: 1, x: 0.5, y: 0.5 },
    { at: off + seg2 + 20, scale: 1.45, x: 0.35, y: 0.35 },
    { at: off + seg2 + 110, scale: 1.15, x: 0.45, y: 0.55 },
  ];

  // انتقالات: كل نوع له صوته، يوضع على منتصف الانتقال
  const cuts: { kind: "paper" | "whip" | "fade" | "wipe"; }[] = [
    { kind: "paper" }, { kind: "fade" }, { kind: "whip" }, { kind: "fade" }, { kind: "whip" }, { kind: "wipe" }, { kind: "paper" }, { kind: "fade" }, { kind: "paper" },
  ];
  const cutFrames: number[] = [];
  let acc = 0;
  L.slice(0, -1).forEach((len) => { acc += len - T; cutFrames.push(acc + T / 2); });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pres = (kind: string): any =>
    kind === "paper" ? slide({ direction: "from-left" }) :
    kind === "whip" ? slide({ direction: "from-bottom" }) :
    kind === "wipe" ? wipe({ direction: "from-right" }) : fade();

  const scenes: React.ReactNode[] = [
    // 1) العنوان: القلم يرسم، والسائل يملأ الحروف
    <Camera push={0.05} dur={150}><GraphPaper /><LiquidFill text="الموائع" sub="Fluids" size={330} /></Camera>,
    // 2) جملة تبني نفسها
    <Camera push={0.04} dur={96}><GraphPaper drift={0.4} /><WordCascade text="كل شيء حولك يتدفّق حتى الهواء" keys={["يتدفّق"]} size={150} /></Camera>,
    // 3) ضربة
    <Camera impacts={[SLAM_IMPACT]} impactPower={22}><GraphPaper /><Slam text="لكن لماذا؟" size={250} /></Camera>,
    // 4) الشعار يُسحب من العدم
    <Camera push={0.06} dur={96}><DarkStage accent="#ff0000" /><LogoReveal brand="youtube" at={18} size={260} label="ابحث في يوتيوب" /></Camera>,
    // 5) البي-رول الحقيقي داخل نافذة ماك
    <Camera hand={0.6}>
      <DarkStage accent="#ff2a2a" />
      <MacWindow url="youtube.com/results?search_query=fluid+dynamics" zoom={zoom} width={1500} exitAt={L[4] - 22}>
        <Sequence from={off}><ScreenRec rec={ytRec} segments={SEGS} /></Sequence>
      </MacWindow>
    </Camera>,
    // 6) غلتش
    <Camera><DarkStage accent="#00e5ff" /><GlitchText text="عشرات الفيديوهات…" bursts={[48]} /></Camera>,
    // 7) عدّاد
    <Camera push={0.04} dur={96}><GraphPaper /><CountUp to={324} suffix="K" label="مشاهدة لفيديو واحد يشرح الموائع" /></Camera>,
    // 8) معادلة نافييه–ستوكس تُكتب
    <Camera push={0.03} dur={110}><GraphPaper /><Typewriter text="ρ(∂v/∂t + v·∇v) = −∇p + μ∇²v" font="'JetBrains Mono', monospace" size={100} dir="ltr" cps={18} /></Camera>,
    // 9) اقتباس بالرقعة
    <Camera push={0.05} dur={120}><GraphPaper /><InkReveal text="الفهم لا يُشاهَد… بل يُصنَع" caption="Understanding is built, not watched." size={120} /></Camera>,
    // 10) الختام
    <Camera push={0.04} dur={120}><GraphPaper /><BilingualSplit ar="الموائع" en="Fluids" size={230} /></Camera>,
  ];

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <TransitionSeries>
        {scenes.map((node, i) => (
          <React.Fragment key={i}>
            <TransitionSeries.Sequence durationInFrames={L[i]}>{node}</TransitionSeries.Sequence>
            {i < scenes.length - 1 && (
              <TransitionSeries.Transition
                presentation={pres(cuts[i].kind)}
                timing={cuts[i].kind === "fade" ? linearTiming({ durationInFrames: T }) : springTiming({ durationInFrames: T, config: { damping: 200 } })}
              />
            )}
          </React.Fragment>
        ))}
      </TransitionSeries>
      {/* أصوات الانتقالات */}
      {cutFrames.map((f, i) => {
        const kind = cuts[i].kind;
        if (kind === "fade") return null;
        return <Sfx key={i} event={kind === "paper" ? "transition.paper" : kind === "whip" ? "transition.whip" : "transition.whoosh"} at={f} seed={i} />;
      })}
      {/* بساط صوتي تحت كل شيء — يتكرّر بتداخل */}
      {Array.from({ length: 8 }, (_, i) => (
        <Sequence key={i} from={i * 160} layout="none"><Sfx event="bed.drone" at={0} gain={0.55} /></Sequence>
      ))}
      <Grain />
      <Vignette strength={0.14} />
    </AbsoluteFill>
  );
};
