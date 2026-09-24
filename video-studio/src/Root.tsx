import React from "react";
import { Composition } from "remotion";
import { Showcase, SHOWCASE_SCENES } from "./scenes/Showcase";

const FPS = 30;
const T = 12;
const total = SHOWCASE_SCENES(FPS).reduce((a, b) => a + b, 0) - T * (SHOWCASE_SCENES(FPS).length - 1);

export const Root: React.FC = () => (
  <>
    <Composition id="Showcase" component={Showcase} durationInFrames={total} fps={FPS} width={1920} height={1080} />
  </>
);
