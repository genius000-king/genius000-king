import {icsElements} from './ics.js';
import {inputsElements} from './inputs.js';
import {instrumentsElements} from './instruments.js';
import {outputsElements} from './outputs.js';
import {passiveElements} from './passive.js';
import {powerElements} from './power.js';
import {semiconductorsElements} from './semiconductors.js';
import {sensorsElements} from './sensors.js';

export const ELEMENTS = {
  ...passiveElements,
  ...outputsElements,
  ...semiconductorsElements,
  ...powerElements,
  ...icsElements,
  ...inputsElements,
  ...sensorsElements,
  ...instrumentsElements,
};
