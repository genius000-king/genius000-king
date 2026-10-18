// Panels that are not on screen when the workbench opens. Each one is its own chunk, fetched the first
// time it is shown; until then it renders nothing (or a light placeholder) instead of blocking the page.
import {lazy, Suspense} from 'react';

function later(load, fallback = null) {
  const Component = lazy(load);
  const Later = props => (
    <Suspense fallback={fallback}>
      <Component {...props} />
    </Suspense>
  );
  return Later;
}
const named = (load, name) => () => load().then(m => ({default: m[name]}));

export const WorkspaceMenu = later(() => import('./WorkspaceMenu.jsx'));
export const ProjectMenu = later(() => import('./ProjectMenu.jsx'));
export const Inspector = later(() => import('./Inspector.jsx'));
export const DiagnosticsDrawer = later(() => import('./DiagnosticsDrawer.jsx'));
export const ConnectModal = later(() => import('./modals/ConnectModal.jsx'));
export const NewFileModal = later(() => import('./modals/NewFileModal.jsx'));
export const DocsModal = later(() => import('./modals/DocsModal.jsx'));
export const Library = later(named(() => import('../panels/Library.jsx'), 'Library'));
export const ToolsModal = later(named(() => import('../panels/ToolsModal.jsx'), 'ToolsModal'));
export const ScopeView = later(named(() => import('../panels/ScopeView.jsx'), 'ScopeView'));
export const LogicView = later(named(() => import('../panels/LogicView.jsx'), 'LogicView'));
export const Editor = later(
  () => import('../editor/Editor.jsx'),
  <div className="editor-loading">Loading editor…</div>
);
/** The gallery and the 56 project definitions travel together; neither is needed until it opens. */
export const ProjectGallery = later(() =>
  Promise.all([import('../panels/ProjectGallery.jsx'), import('../../engines/projects/index.js')]).then(
    ([gallery, projects]) => ({
      default: props => <gallery.ProjectGallery projects={projects.PROJECTS} {...props} />,
    })
  )
);
