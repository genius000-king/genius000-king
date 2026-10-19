// Project engine: the example projects, one collection per topic. A project is metadata plus build(),
// which returns a complete project (parts, breadboard seating, wires, firmware, camera).
// Importing this module registers all collections in gallery order.
import {P} from './registry.js';
import './collections/esp32.js';
import './collections/arduino-uno.js';
import './collections/more-boards.js';
import './collections/sensors-and-links.js';
import './collections/analog-circuits.js';
import './collections/modules-and-power.js';

export const PROJECTS = P;
export const projectById = id => P.find(x => x.id === id);
export * from './kit.js';
