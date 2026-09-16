import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {COLOR, t} from './design/tokens';
import {ramp} from './design/motion';
import {ChapterCard} from './components/ChapterCard';
import {SceneOpenCompare, SceneBinaryOnly} from './scenes/intro';
import {
  SceneHddAnatomy, SceneHddHead, SceneDomains,
  SceneFluxReversal, SceneWriting, SceneEMUnity, SceneDeleteMyth,
} from './scenes/hdd';
import {
  SceneOpticalSurface, SceneLaserRead, SceneOpticalScale,
  SceneOpticalDelete, SceneBurner,
} from './scenes/optical';
import {
  SceneSsdZoom, SceneSsdCell, SceneSsdLevels,
  SceneNoMovingParts, SceneSsdWriteErase,
} from './scenes/solid';
import {
  SceneRamCell, SceneRamHierarchy, SceneDestructiveRead,
  SceneDataPath, SceneComparison,
} from './scenes/ram';
import {SceneFlyingHead, SceneDriveBrain, SceneBigIdea} from './scenes/finale';
import {
  SceneBrainScale, SceneBrainPatterns, SceneAmbiguousShape,
  SceneRecognition, SceneHebbian, SceneOutro,
} from './scenes/brain';

/** Cross-fade length between scenes. Long enough to soften, short enough to
 *  never read as a "transition effect". */
const BLEND = 8;

/** Fades a scene up over whatever is still mounted beneath it. */
const Beat: React.FC<{children: React.ReactNode}> = ({children}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{opacity: ramp(frame, 0, BLEND)}}>{children}</AbsoluteFill>
  );
};

type Cut = {at: string; until: string; el: React.ReactNode};

/**
 * The running order. `at`/`until` are read straight off the script's own
 * timestamps, so the picture and the narration can never drift apart: if a
 * line moves in the edit, exactly one number changes here.
 */
const CUTS: Cut[] = [
  // — Cold open
  {at: '0:00',  until: '0:06',  el: <SceneOpenCompare />},
  {at: '0:06',  until: '0:15',  el: <SceneBinaryOnly />},

  // — I. Hard disk
  {at: '0:15',  until: '0:20',  el: <ChapterCard index="الفصل الأول" ordinal="01" title="القرص الصلب" subtitle="كيف يتحوّل المغناطيس إلى أصفار وآحاد" image="img/grad-indigo.jpg" durationInFrames={150} />},
  {at: '0:20',  until: '0:35',  el: <SceneHddAnatomy />},
  {at: '0:35',  until: '0:52',  el: <SceneHddHead />},
  {at: '0:52',  until: '1:19',  el: <SceneDomains />},
  {at: '1:19',  until: '2:05',  el: <SceneFluxReversal />},
  {at: '2:05',  until: '2:46',  el: <SceneWriting />},
  {at: '2:46',  until: '2:56',  el: <SceneEMUnity />},
  {at: '2:56',  until: '3:49',  el: <SceneDeleteMyth />},

  // — II. Optical
  {at: '3:49',  until: '3:54',  el: <ChapterCard index="الفصل الثاني" ordinal="02" title="القرص الضوئي" subtitle="حين يحلّ الضوء محلّ المغناطيس" image="img/grad-slate.jpg" durationInFrames={150} />},
  {at: '3:54',  until: '4:15',  el: <SceneOpticalSurface />},
  {at: '4:15',  until: '4:56',  el: <SceneLaserRead />},
  {at: '4:56',  until: '5:31',  el: <SceneOpticalScale />},
  {at: '5:31',  until: '6:15',  el: <SceneOpticalDelete />},
  {at: '6:15',  until: '6:55',  el: <SceneBurner />},

  // — III. Solid state
  {at: '6:55',  until: '7:00',  el: <ChapterCard index="الفصل الثالث" ordinal="03" title="الذاكرة الصلبة" subtitle="لا شيء يدور. لا شيء يتحرك." image="img/grad-emerald.jpg" durationInFrames={150} />},
  {at: '7:00',  until: '7:24',  el: <SceneSsdZoom />},
  {at: '7:24',  until: '7:47',  el: <SceneSsdCell />},
  {at: '7:47',  until: '8:02',  el: <SceneSsdLevels />},
  {at: '8:02',  until: '8:28',  el: <SceneNoMovingParts />},
  {at: '8:28',  until: '8:51',  el: <SceneSsdWriteErase />},

  // — IV. RAM
  {at: '8:51',  until: '8:56',  el: <ChapterCard index="الفصل الرابع" ordinal="04" title="الرام" subtitle="ذاكرة تنسى عمدًا — لتكون أسرع" image="img/grad-sage.jpg" durationInFrames={150} />},
  {at: '8:56',  until: '9:07',  el: <SceneRamCell />},
  {at: '9:07',  until: '9:28',  el: <SceneRamHierarchy />},
  {at: '9:28',  until: '9:42',  el: <SceneDestructiveRead />},
  {at: '9:42',  until: '9:55',  el: <SceneDataPath />},
  {at: '9:55',  until: '10:28', el: <SceneComparison />},

  // — V. Things nobody tells you
  {at: '10:28', until: '10:33', el: <ChapterCard index="الفصل الخامس" ordinal="05" title="تفاصيل مدهشة" subtitle="ما لا يُقال عن الأقراص" image="img/grad-dusk.jpg" durationInFrames={150} />},
  {at: '10:33', until: '11:04', el: <SceneFlyingHead />},
  {at: '11:04', until: '11:26', el: <SceneDriveBrain />},

  // — VI. The idea underneath all of it
  {at: '11:26', until: '11:31', el: <ChapterCard index="الفصل السادس" ordinal="06" title="الفكرة" subtitle="خمسة آلاف سنة، ومبدأ واحد" image="img/grad-slate.jpg" durationInFrames={150} />},
  {at: '11:31', until: '12:03', el: <SceneBigIdea />},

  // — VII. The brain: the payoff the cold open promised
  {at: '12:03', until: '12:09', el: <ChapterCard index="الفصل السابع" ordinal="07" title="المخ" subtitle="حيث يتوقف كل ما سبق عن الكفاية" image="img/grad-emerald.jpg" durationInFrames={180} />},
  {at: '12:09', until: '12:34', el: <SceneBrainScale />},
  {at: '12:34', until: '13:18', el: <SceneBrainPatterns />},
  {at: '13:18', until: '14:20', el: <SceneAmbiguousShape />},
  {at: '14:20', until: '14:52', el: <SceneRecognition />},
  {at: '14:52', until: '15:31', el: <SceneHebbian />},
  {at: '15:31', until: '15:55', el: <SceneOutro />},
];

export const TOTAL_FRAMES = t('15:55');

export const StorageFilm: React.FC = () => (
  // Paper, not black, sits under everything: a cross-fade must never flash.
  <AbsoluteFill style={{background: COLOR.paper}}>
    {CUTS.map((c, i) => {
      const from = t(c.at);
      // Each scene outlives its slot by the blend, so the next one dissolves
      // in over it rather than cutting.
      const dur = t(c.until) - from + (i === CUTS.length - 1 ? 0 : BLEND);
      return (
        <Sequence key={`${c.at}-${i}`} from={from} durationInFrames={dur} name={c.at}>
          <Beat>{c.el}</Beat>
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
