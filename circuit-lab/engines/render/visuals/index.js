// The order is the order the scene applies them in.
import * as lights from './lights.js';
import * as motion from './motion.js';
import * as screens from './screens.js';

export const UPDATERS = [
  ['powerMaterial', lights.powerMaterial],
  ['ledMaterial', lights.ledMaterial],
  ['halo', lights.halo],
  ['segments', lights.segments],
  ['rgbMaterial', lights.rgbMaterial],
  ['bars', lights.bars],
  ['tlLeds', lights.tlLeds],
  ['stepShaft', motion.stepShaft],
  ['cone', motion.cone],
  ['fuseOk', motion.fuseOk],
  ['reedMagnet', motion.reedMagnet],
  ['slideKnob', motion.slideKnob],
  ['acKnob', motion.acKnob],
  ['acLamp', lights.acLamp],
  ['buckLed', lights.buckLed],
  ['irLeds', lights.irLeds],
  ['pixels', lights.pixels],
  ['lamp', lights.lamp],
  ['boardLeds', lights.boardLeds],
  ['horn', motion.horn],
  ['motorShaft', motion.motorShaft],
  ['armature', motion.armature],
  ['pirLed', lights.pirLed],
  ['mqLeds', lights.mqLeds],
  ['display', screens.display],
  ['relayLed', lights.relayLed],
  ['plunger', motion.plunger],
];
