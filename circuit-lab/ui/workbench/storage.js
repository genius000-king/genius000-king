import {validateProject, newProject} from '../../engines/workspace/project.js';

export const KEY = 'circuit-lab-project-v2';

export const loadIssue = {message: ''};

export function load() {
  try {
    const s = localStorage.getItem(KEY);
    return s ? validateProject(JSON.parse(s)) : newProject();
  } catch (e) {
    loadIssue.message =
      'Saved project could not be loaded. The original remains stored; export or inspect browser storage before saving. ' +
      e.message;
    return newProject();
  }
}

export const blankState = {
  time: 0,
  running: false,
  boot: 'idle',
  voltages: {},
  components: {},
  gpio: {},
  diagnostics: [],
  warnings: [],
  logs: [],
  transactions: [],
  oled: {},
  trace: [],
  nets: 0,
};

/** Tests set this session flag to reach window.__circuitLab in a production build. */
export const debugHook = (() => {
  try {
    return sessionStorage.getItem('circuit-lab-debug') === '1';
  } catch {
    return false;
  }
})();
