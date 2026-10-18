import {icsParts} from './ics.js';
import {inputsParts} from './inputs.js';
import {instrumentsParts} from './instruments.js';
import {outputsParts} from './outputs.js';
import {passiveParts} from './passive.js';
import {powerParts} from './power.js';
import {prototypingParts} from './prototyping.js';
import {semiconductorsParts} from './semiconductors.js';
import {sensorsParts} from './sensors.js';

export const PARTS = {...outputsParts, ...passiveParts, ...semiconductorsParts, ...powerParts, ...icsParts, ...inputsParts, ...sensorsParts, ...instrumentsParts, ...prototypingParts};
