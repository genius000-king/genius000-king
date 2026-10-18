// How the workbench component splits into hooks (see tools/extract-hooks.mjs). Statement indices are
// positions in App's body; the hooks run in this order on every render.
export default {
  host: 'ui/workbench/Workbench.jsx',
  component: 'App',
  contextValue: 'workbench',
  drop: [51],
  groups: [
    {
      name: 'useWorkbenchState',
      file: 'hooks/useWorkbenchState.js',
      root: true,
      statements: [0, 3, 4, 5, 6, 7],
      doc: 'Every piece of workbench state and every ref, in one place. Also exposes the test hook.',
    },
    {
      name: 'useFullscreen',
      file: 'hooks/useFullscreen.js',
      statements: [1, 2],
      doc: 'Real fullscreen where the browser allows it, an immersive layout where it does not (iPhone).',
    },
    {
      name: 'usePerformance',
      file: 'hooks/usePerformance.js',
      statements: [8, 9, 10],
      doc: 'The device tier, the user’s graphics mode and the simulation snapshot rate that follows them.',
    },
    {
      name: 'useNotify',
      file: 'hooks/useNotify.js',
      statements: [11, 31],
      doc: 'Short toasts, and the one that reports an unreadable autosave.',
    },
    {
      name: 'useHistory',
      file: 'hooks/useHistory.js',
      statements: [12, 13, 14, 15],
      doc: 'Project edits with undo/redo (60 steps).',
    },
    {
      name: 'useEditing',
      file: 'hooks/useEditing.js',
      statements: [16, 17, 18, 19, 20, 21, 22],
      doc: 'Selecting, adding, duplicating, rotating and deleting parts; connecting terminals with wires.',
    },
    {
      name: 'useDerived',
      file: 'hooks/useDerived.js',
      statements: [46, 47],
      doc: 'Values computed from state on each render: the selection and the merged diagnostics.',
    },
    {
      name: 'useSimulation',
      file: 'hooks/useSimulation.js',
      statements: [24, 35, 36, 37, 38],
      doc: 'The simulation worker: start, messages, compile errors mapped to files, run/pause, board choice.',
    },
    {
      name: 'useSceneCallbacks',
      file: 'hooks/useSceneCallbacks.js',
      statements: [23],
      doc: 'What the 3D scene reports back: picks, drags, hovers, camera moves and hand controls.',
    },
    {
      name: 'useScene',
      file: 'hooks/useScene.js',
      statements: [25, 26, 27, 28, 29, 30],
      doc: 'The 3D scene’s life cycle and keeping it, the worker and the autosave in step with the project.',
    },
    {
      name: 'useProjectFiles',
      file: 'hooks/useProjectFiles.js',
      statements: [39, 40, 41, 42, 43, 45],
      doc: 'Saving, exporting, importing (projects and .ino sources) and opening example projects.',
    },
    {
      name: 'usePanels',
      file: 'hooks/usePanels.js',
      statements: [32, 34, 44, 48, 49],
      doc: 'Layout: 3D / split / floating editor, the split divider, the floating panel and the serial scroll.',
    },
    {name: 'useShortcuts', file: 'hooks/useShortcuts.js', statements: [33], doc: 'Keyboard shortcuts.'},
    {
      name: 'useSound',
      file: 'hooks/useSound.js',
      statements: [50],
      doc: 'Buzzer and speaker audio (after a user gesture).',
    },
  ],
};
