// Which blocks of the workbench become their own components (see tools/extract-jsx.mjs).
export default {
  host: 'ui/workbench/Workbench.jsx',
  component: 'App',
  context: 'context.js',
  blocks: [
    {name: 'TopBar', cls: 'topbar', doc: 'Brand, project menu button, run/pause, layout switch and the main actions.'},
    {name: 'WorkspaceMenu', cond: 'more', doc: 'The "more" menu: view, appearance, export and workspace settings.'},
    {name: 'ProjectMenu', cond: 'menu', doc: 'Project name, new/open/import/export and examples.'},
    {name: 'Inspector', cls: 'inspector', doc: 'Properties, live readouts and pins of the selected part or wire.'},
    {name: 'CanvasControls', cls: 'workspace-bottom', doc: 'Connection prompt, transform tools and camera buttons over the 3D view.'},
    {name: 'EditorPanel', cls: 'editor-panel', doc: 'Firmware files, the code editor and its diagnostics.'},
    {name: 'DiagnosticsDrawer', cond: 'drawer', doc: 'Serial monitor, oscilloscope, logic analyser, network and diagnostics.'},
    {name: 'StatusBar', cls: 'statusbar', doc: 'Simulation time, board, nets and save state.'},
    {name: 'PinTooltip', cls: 'pin-tooltip', doc: 'Hover card for a pin or terminal.'},
    {name: 'ConnectModal', cond: 'connect', file: 'modals/ConnectModal.jsx', doc: 'Connect two terminals by name.'},
    {name: 'NewFileModal', cond: 'newFile', file: 'modals/NewFileModal.jsx', doc: 'Add a source file to the active board.'},
    {name: 'DocsModal', cond: 'docs', file: 'modals/DocsModal.jsx', doc: 'The in-app reference (matches the README).'},
  ],
};
