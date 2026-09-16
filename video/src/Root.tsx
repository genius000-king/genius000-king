import React from 'react';
import {Composition} from 'remotion';
import {FPS, H, W} from './design/tokens';
import {StorageFilm, TOTAL_FRAMES} from './Video';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="StorageFilm"
    component={StorageFilm}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={W}
    height={H}
  />
);
