import React from "react";
import { Composition } from "remotion";
import { Showcase, SHOWCASE_SCENES } from "./scenes/Showcase";
import { ChalkTexture } from "./kit/Collage";
import { FakeExperts, TOTAL as FE_TOTAL } from "./episodes/fake-experts/FakeExperts";

const FPS = 30;
const T = 12;
const total = SHOWCASE_SCENES(FPS).reduce((a, b) => a + b, 0) - T * (SHOWCASE_SCENES(FPS).length - 1);

export const Root: React.FC = () => (
  <>
    <Composition id="FakeExperts" component={FakeExperts} durationInFrames={FE_TOTAL} fps={FPS} width={1920} height={1080} defaultProps={{ guide: false }} />
    <Composition id="FakeExpertsGuide" component={FakeExperts} durationInFrames={FE_TOTAL} fps={FPS} width={1920} height={1080} defaultProps={{ guide: true }} />
    <Composition id="ChalkTexture" component={ChalkTexture} durationInFrames={1} fps={FPS} width={2880} height={1620} />
    <Composition id="Showcase" component={Showcase} durationInFrames={total} fps={FPS} width={1920} height={1080} />
  </>
);
