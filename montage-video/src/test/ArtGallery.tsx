import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import '../fonts';
import {ART_NAMES, Art} from '../art';

/** One illustration per frame, for review stills and phone-screen textures. */
export const ArtGallery: React.FC<{name?: string}> = ({name}) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Art name={name ?? ART_NAMES[f % ART_NAMES.length]} t={2.5} />
    </AbsoluteFill>
  );
};
