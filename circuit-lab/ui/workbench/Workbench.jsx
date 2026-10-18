import {CheckCircle2, GripVertical} from 'lucide-react';
import {TYPES} from '../../engines/catalog/types.js';
import '../styles.css';
import {WorkbenchContext} from './context.js';
import {
  WorkspaceMenu,
  ProjectMenu,
  Inspector,
  DiagnosticsDrawer,
  ConnectModal,
  NewFileModal,
  DocsModal,
  Library,
  ToolsModal,
  ProjectGallery,
} from './lazy.jsx';
import TopBar from './TopBar.jsx';
import CanvasControls from './CanvasControls.jsx';
import EditorPanel from './EditorPanel.jsx';
import StatusBar from './StatusBar.jsx';
import PinTooltip from './PinTooltip.jsx';
import {useWorkbenchState} from './hooks/useWorkbenchState.js';
import {useFullscreen} from './hooks/useFullscreen.js';
import {usePerformance} from './hooks/usePerformance.js';
import {useNotify} from './hooks/useNotify.js';
import {useHistory} from './hooks/useHistory.js';
import {useEditing} from './hooks/useEditing.js';
import {useDerived} from './hooks/useDerived.js';
import {useSimulation} from './hooks/useSimulation.js';
import {useSceneCallbacks} from './hooks/useSceneCallbacks.js';
import {useScene} from './hooks/useScene.js';
import {useProjectFiles} from './hooks/useProjectFiles.js';
import {usePanels} from './hooks/usePanels.js';
import {useShortcuts} from './hooks/useShortcuts.js';
import {useSound} from './hooks/useSound.js';

// The workbench: its state and behaviour live in ./hooks (one hook per concern, sharing the `wb` object),
// the panels in their own components; this file only wires them together and lays them out.
export function App() {
  const wb = useWorkbenchState();
  Object.assign(wb, useFullscreen(wb));
  Object.assign(wb, usePerformance(wb));
  Object.assign(wb, useNotify(wb));
  Object.assign(wb, useHistory(wb));
  Object.assign(wb, useEditing(wb));
  Object.assign(wb, useDerived(wb));
  Object.assign(wb, useSimulation(wb));
  Object.assign(wb, useSceneCallbacks(wb));
  Object.assign(wb, useScene(wb));
  Object.assign(wb, useProjectFiles(wb));
  Object.assign(wb, usePanels(wb));
  Object.assign(wb, useShortcuts(wb));
  Object.assign(wb, useSound(wb));
  const {
    add,
    connect,
    dock,
    docs,
    drawer,
    full,
    gallery,
    hover,
    importFile,
    importProject,
    importRef,
    library,
    loadProject,
    menu,
    more,
    newFile,
    pending,
    profile,
    project,
    scene,
    sceneRoot,
    selected,
    selectedComponent,
    selectedWire,
    setGallery,
    setLibrary,
    setTools,
    split,
    startSplit,
    toast,
    tools,
    wireId,
  } = wb;
  return (
    <WorkbenchContext.Provider value={wb}>
      <div
        className={`app theme-${project.appearance?.theme ?? 'dark'} layout-${project.layout} dock-${dock} ${drawer ? 'has-drawer' : ''} ${full ? 'immersive' : ''} ${selected.length ? 'has-selection' : ''} ${profile.glass ? '' : 'low-power'}`}
        style={{'--split': `${split}%`, '--glass-alpha': project.appearance?.opacity ?? 0.36}}
      >
        <TopBar />
        {more && <WorkspaceMenu />}
        {menu && <ProjectMenu />}
        <input
          type="file"
          accept=".json,.circuitlab,.ino,.cpp,.h,.c,.txt"
          ref={importRef}
          hidden
          onChange={importProject}
        />
        <main className="workbench">
          <div
            className="canvas-region"
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const type = e.dataTransfer.getData('component');
              if (TYPES[type]) add(type, scene.current?.dropPosition?.(e));
              else for (const f of e.dataTransfer.files ?? []) importFile(f);
            }}
          >
            <div ref={sceneRoot} className="scene-canvas" />
            <div className="canvas-vignette" />
            {library && <Library onAdd={key => add(key)} onClose={() => setLibrary(false)} />}
            {(selectedComponent || selectedWire) && <Inspector key={selectedComponent?.id || wireId} />}

            <CanvasControls />
          </div>
          {project.layout !== '3d' && <EditorPanel />}
          {project.layout === 'split' && (
            <div className="split-divider" onPointerDown={startSplit}>
              <GripVertical size={16} />
            </div>
          )}
          {drawer && <DiagnosticsDrawer />}
        </main>
        <StatusBar />
        {hover && !pending && <PinTooltip />}
        {toast && (
          <div className="toast glass" role="status">
            <CheckCircle2 size={15} />
            {toast}
          </div>
        )}
        {connect && <ConnectModal />}
        {gallery && <ProjectGallery onLoad={loadProject} onClose={() => setGallery(false)} />}
        {tools && <ToolsModal onClose={() => setTools(false)} />}
        {newFile && <NewFileModal />}
        {docs && <DocsModal />}
      </div>
    </WorkbenchContext.Provider>
  );
}

export default App;
