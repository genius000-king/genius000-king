import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import './fonts';
import {SceneProvider} from './lib';
import {FPS, SECTIONS, SectionName} from './timing';
import {Intro} from './scenes/Intro';
import {Collage} from './scenes/Collage';
import {Documentary} from './scenes/Documentary';
import {Motion} from './scenes/Motion';
import {Cinematic} from './scenes/Cinematic';
import {Fast} from './scenes/Fast';
import {Minimal} from './scenes/Minimal';
import {Commercial} from './scenes/Commercial';
import {Story} from './scenes/Story';
import {Outro} from './scenes/Outro';

const SCENES: Partial<Record<SectionName, React.FC>> = {
  intro: Intro,
  collage: Collage,
  doc: Documentary,
  motion: Motion,
  cine: Cinematic,
  fast: Fast,
  minimal: Minimal,
  ad: Commercial,
  story: Story,
  outro: Outro,
};

export const Video: React.FC = () => (
  <AbsoluteFill style={{background: '#000'}}>
    {(Object.keys(SECTIONS) as SectionName[]).map((key) => {
      const Scene = SCENES[key];
      if (!Scene) return null;
      const [a, b] = SECTIONS[key];
      const from = Math.round(a * FPS);
      return (
        <Sequence key={key} from={from} durationInFrames={Math.round(b * FPS) - from} name={key}>
          <SceneProvider value={from / FPS}>
            <Scene />
          </SceneProvider>
        </Sequence>
      );
    })}
    <Audio src={staticFile('audio/soundtrack.wav')} />
  </AbsoluteFill>
);
