// 3D model registry. Models are grouped by part category and fetched the first time a part of
// that category appears, so opening the app downloads only the models the bench actually needs.
import {PARTS} from '../../catalog/parts/index.js';

export const PART_MODELS = {};

const LOADERS = {
  passive: () => import('./passive.js'),
  semiconductors: () => import('./semiconductors.js'),
  ics: () => import('./ics.js'),
  power: () => import('./power.js'),
  outputs: () => import('./outputs.js'),
  inputs: () => import('./inputs.js'),
  sensors: () => import('./sensors.js'),
  instruments: () => import('./instruments.js'),
};
const pending = new Map();
const ready = new Set();

export function modelCategory(type) {
  const category = PARTS[type]?.category?.toLowerCase();
  return LOADERS[category] ? category : null;
}

export function loadModelCategory(category) {
  if (!LOADERS[category]) return Promise.resolve();
  if (!pending.has(category))
    pending.set(category, LOADERS[category]().then(module => {
      Object.assign(PART_MODELS, module[category + 'Models']);
      ready.add(category);
    }));
  return pending.get(category);
}

/** Types whose model module has not arrived yet. */
export function missingModels(types) {
  return [...new Set(types.map(modelCategory).filter(c => c && !ready.has(c)))];
}

export function loadModels(types) {
  return Promise.all(missingModels(types).map(loadModelCategory));
}

/** Everything, for tools like the parts showcase and the library thumbnails. */
export function loadAllModels() {
  return Promise.all(Object.keys(LOADERS).map(loadModelCategory));
}
