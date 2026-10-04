import React from 'react';
import {Composition} from 'remotion';
import {DURATION, FPS} from './timing';
import {Video} from './Video';
import {ArtGallery} from './test/ArtGallery';
import {ART_NAMES} from './art';

export const Root: React.FC = () => (
  <>
    <Composition id="Montage" component={Video} durationInFrames={Math.round(DURATION * FPS)} fps={FPS} width={1920} height={1080} />
    <Composition id="ArtGallery" component={ArtGallery} durationInFrames={ART_NAMES.length} fps={FPS} width={1920} height={1080} />
  </>
);
