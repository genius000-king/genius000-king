// UI layout: the workbench shell, one file per panel, shared helpers.
const all = (target, list) => Object.fromEntries(list.map(n => [n, target]));
export default {
  moved: {},
  files: {
    'ui/App.jsx': {
      default: 'ui/workbench/Workbench.jsx',
      targets: {
        ...all('ui/workbench/storage.js', ['KEY', 'loadIssue', 'load', 'blankState']),
        IconButton: 'ui/common/IconButton.jsx',
      },
    },
    'ui/Panels.jsx': {
      default: 'ui/panels/format.js',
      targets: {
        ...all('ui/panels/Thumb.jsx', ['Thumb', 'LEGACY_ART']),
        Library: 'ui/panels/Library.jsx',
        ...all('ui/panels/PartControls.jsx', ['Readouts', 'PartControls']),
        BoardInfo: 'ui/panels/BoardInfo.jsx',
        ProjectGallery: 'ui/panels/ProjectGallery.jsx',
        ScopeView: 'ui/panels/ScopeView.jsx',
        LogicView: 'ui/panels/LogicView.jsx',
        ...all('ui/panels/ToolsModal.jsx', ['Field', 'ToolsModal']),
      },
    },
    'ui/Editor.jsx': {default: 'ui/editor/Editor.jsx'},
    'ui/ComponentArt.jsx': {default: 'ui/panels/ComponentArt.jsx'},
  },
};
